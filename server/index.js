import http from 'node:http';
import crypto from 'node:crypto';
import { URL } from 'node:url';
import { query } from './db.js';


const PORT = process.env.PORT || 5000; 

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server successfully running on port ${PORT}`);
});

const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
const paystackCallbackUrl = process.env.PAYSTACK_CALLBACK_URL || `${clientOrigin}/`;

const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors({
  origin: 'https://github.io', // Your exact GitHub Pages or frontend URL
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));


const send = (response, status, data) => {
  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': clientOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  response.end(JSON.stringify(data));
};

const readJson = async (request) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString() || '{}');
};

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const createPlainToken = () => crypto.randomBytes(24).toString('hex');

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 210000, 32, 'sha256').toString('hex');
  return `pbkdf2_sha256$210000$${salt}$${hash}`;
};

const verifyPassword = (password, storedHash = '') => {
  const [scheme, iterations, salt, hash] = storedHash.split('$');
  if (scheme !== 'pbkdf2_sha256' || !iterations || !salt || !hash) return false;
  const candidate = crypto.pbkdf2Sync(password, salt, Number(iterations), 32, 'sha256');
  const saved = Buffer.from(hash, 'hex');
  return saved.length === candidate.length && crypto.timingSafeEqual(saved, candidate);
};

const createSession = async (clientId) => {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
  await query(
    `
      INSERT INTO user_sessions (client_id, token_hash, expires_at)
      VALUES ($1, $2, $3);
    `,
    [clientId, hashToken(token), expiresAt],
  );
  return { token, expiresAt: expiresAt.toISOString() };
};

const mapClientUser = (row) => ({
  id: row.id,
  name: row.contact_name,
  email: row.email,
  company: row.company_name,
  role: 'client',
  plan: row.plan_name || 'Monthly',
  subscriptionStatus: row.subscription_status || 'Trial',
});

async function registerClient(body) {
  if (!body.company || !body.name || !body.email || !body.password) {
    const error = new Error('Company, name, email, and password are required.');
    error.status = 400;
    throw error;
  }

  const existing = await query('SELECT id FROM clients WHERE lower(email) = lower($1);', [body.email]);
  if (existing.rows.length > 0) {
    const error = new Error('A user with this email already exists.');
    error.status = 409;
    throw error;
  }

  const verificationToken = createPlainToken();
  const verificationExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);
  const client = await query(
    `
      INSERT INTO clients (
        company_name, contact_name, email, password_hash,
        email_verification_token_hash, email_verification_expires_at
      )
      VALUES ($1, $2, lower($3), $4, $5, $6)
      RETURNING id, company_name, contact_name, email;
    `,
    [body.company, body.name, body.email, hashPassword(body.password), hashToken(verificationToken), verificationExpiresAt],
  );

  await query(
    `
      INSERT INTO subscriptions (client_id, plan_id, status, starts_on, renews_on)
      VALUES ($1, $2, 'Trial', CURRENT_DATE, CURRENT_DATE + INTERVAL '14 days');
    `,
    [client.rows[0].id, body.planId || 'monthly'],
  );

  return {
    email: client.rows[0].email,
    verificationToken,
    verificationExpiresAt: verificationExpiresAt.toISOString(),
    message: 'Account created. Verify email before logging in.',
  };
}

async function loginClient(body) {
  const result = await query(
    `
      SELECT c.id, c.company_name, c.contact_name, c.email, c.password_hash, c.email_verified_at, s.status AS subscription_status, sp.name AS plan_name
      FROM clients c
      LEFT JOIN subscriptions s ON s.client_id = c.id
      LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
      WHERE lower(c.email) = lower($1)
      ORDER BY s.created_at DESC
      LIMIT 1;
    `,
    [body.email],
  );

  const client = result.rows[0];
  if (!client || !verifyPassword(body.password, client.password_hash)) {
    const error = new Error('Invalid email or password.');
    error.status = 401;
    throw error;
  }

  if (!client.email_verified_at) {
    const error = new Error('Email must be verified before login.');
    error.status = 403;
    throw error;
  }

  await query('UPDATE clients SET last_login_at = now() WHERE id = $1;', [client.id]);
  const session = await createSession(client.id);
  return { user: mapClientUser(client), ...session };
}

async function verifyClientEmail(body) {
  const tokenHash = hashToken(body.token || '');
  const result = await query(
    `
      UPDATE clients
      SET email_verified_at = now(),
          email_verification_token_hash = NULL,
          email_verification_expires_at = NULL
      WHERE lower(email) = lower($1)
        AND email_verification_token_hash = $2
        AND email_verification_expires_at > now()
      RETURNING id;
    `,
    [body.email, tokenHash],
  );

  if (result.rows.length === 0) {
    const error = new Error('Invalid or expired verification token.');
    error.status = 400;
    throw error;
  }

  return { ok: true, message: 'Email verified. You can now log in.' };
}

async function requestPasswordReset(body) {
  const resetToken = createPlainToken();
  const resetExpiresAt = new Date(Date.now() + 1000 * 60 * 30);
  const result = await query(
    `
      UPDATE clients
      SET password_reset_token_hash = $2,
          password_reset_expires_at = $3
      WHERE lower(email) = lower($1)
      RETURNING email;
    `,
    [body.email, hashToken(resetToken), resetExpiresAt],
  );

  return {
    ok: true,
    resetToken: result.rows.length ? resetToken : '',
    resetExpiresAt: result.rows.length ? resetExpiresAt.toISOString() : '',
    message: 'If the email exists, a password reset token has been generated.',
  };
}

async function resetPassword(body) {
  if (!body.email || !body.token || !body.password) {
    const error = new Error('Email, reset token, and new password are required.');
    error.status = 400;
    throw error;
  }

  const result = await query(
    `
      UPDATE clients
      SET password_hash = $3,
          password_reset_token_hash = NULL,
          password_reset_expires_at = NULL
      WHERE lower(email) = lower($1)
        AND password_reset_token_hash = $2
        AND password_reset_expires_at > now()
      RETURNING id;
    `,
    [body.email, hashToken(body.token), hashPassword(body.password)],
  );

  if (result.rows.length === 0) {
    const error = new Error('Invalid or expired password reset token.');
    error.status = 400;
    throw error;
  }

  return { ok: true, message: 'Password reset. You can now log in.' };
}

async function getSessionUser(request) {
  const authorization = request.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return null;

  const result = await query(
    `
      SELECT c.id, c.company_name, c.contact_name, c.email, s.status AS subscription_status, sp.name AS plan_name
      FROM user_sessions us
      JOIN clients c ON c.id = us.client_id
      LEFT JOIN subscriptions s ON s.client_id = c.id
      LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
      WHERE us.token_hash = $1
        AND us.expires_at > now()
      ORDER BY s.created_at DESC
      LIMIT 1;
    `,
    [hashToken(token)],
  );

  return result.rows[0] ? mapClientUser(result.rows[0]) : null;
}

const mapApplication = (row) => ({
  id: row.id,
  title: row.title,
  contractType: row.contract_type,
  extendingCertificateNumber: row.extending_certificate_number,
  certificateNumber: row.certificate_number,
  duration: Number(row.duration_years),
  effectiveDate: row.effective_date,
  approvedFee: Number(row.approved_fee),
  currency: row.currency,
  transferor: row.transferor,
  transferee: row.transferee,
  sector: row.sector,
  status: row.status,
  remittances: row.remittances || [],
});

async function getApplications(user) {
  const result = await query(`
    SELECT
      a.id,
      a.title,
      a.contract_type,
      a.extending_certificate_number,
      a.certificate_number,
      a.duration_years,
      to_char(a.effective_date, 'YYYY-MM-DD') AS effective_date,
      a.approved_fee,
      a.currency,
      a.transferor,
      a.transferee,
      a.sector,
      a.status,
      COALESCE(
        json_agg(
          json_build_object(
            'id', r.id,
            'type', r.remittance_type,
            'amount', r.amount,
            'currency', r.currency,
            'taxPercent', r.tax_percent,
            'exchangeRate', r.exchange_rate,
            'convertedAmount', r.amount_in_approved_currency,
            'date', to_char(r.remitted_on, 'YYYY-MM-DD')
          )
          ORDER BY r.remitted_on, r.id
        ) FILTER (WHERE r.id IS NOT NULL),
        '[]'
      ) AS remittances
    FROM applications a
    LEFT JOIN remittances r ON r.application_id = a.id
    WHERE a.client_id = $1
    GROUP BY a.id
    ORDER BY a.created_at DESC;
  `, [user.id]);

  return result.rows.map(mapApplication);
}

async function createApplication(user, body) {
  const normalizedBody = await normalizeApplicationBody(user, body);
  const result = await query(
    `
      INSERT INTO applications (
        client_id, title, contract_type, extending_certificate_number, certificate_number, duration_years, effective_date, approved_fee,
        currency, transferor, transferee, sector, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id;
    `,
    [
      user.id,
      normalizedBody.title,
      normalizedBody.contractType || 'New',
      normalizedBody.extendingCertificateNumber || null,
      normalizedBody.certificateNumber,
      normalizedBody.duration,
      normalizedBody.effectiveDate,
      normalizedBody.approvedFee,
      normalizedBody.currency,
      normalizedBody.transferor,
      normalizedBody.transferee,
      normalizedBody.sector,
      normalizedBody.status,
    ],
  );

  return result.rows[0].id;
}

async function updateApplication(user, applicationId, body) {
  const normalizedBody = await normalizeApplicationBody(user, body, applicationId);
  await query(
    `
      UPDATE applications
      SET title = $1,
          contract_type = $2,
          extending_certificate_number = $3,
          certificate_number = $4,
          duration_years = $5,
          effective_date = $6,
          approved_fee = $7,
          currency = $8,
          transferor = $9,
          transferee = $10,
          sector = $11,
          status = $12
      WHERE id = $13
        AND client_id = $14;
    `,
    [
      normalizedBody.title,
      normalizedBody.contractType || 'New',
      normalizedBody.extendingCertificateNumber || null,
      normalizedBody.certificateNumber,
      normalizedBody.duration,
      normalizedBody.effectiveDate,
      normalizedBody.approvedFee,
      normalizedBody.currency,
      normalizedBody.transferor,
      normalizedBody.transferee,
      normalizedBody.sector,
      normalizedBody.status,
      applicationId,
      user.id,
    ],
  );
}

async function normalizeApplicationBody(user, body, currentApplicationId = null) {
  const contractTypesRequiringCertificate = ['Renewal', 'Extention', 'Additional fee'];
  if (!contractTypesRequiringCertificate.includes(body.contractType)) {
    return { ...body, extendingCertificateNumber: null };
  }

  if (!body.extendingCertificateNumber) {
    const error = new Error('Certificate number being extended is required.');
    error.status = 400;
    throw error;
  }

  const result = await query(
    `
      SELECT
        a.title,
        a.status,
        a.sector,
        a.transferor,
        a.transferee,
        a.currency,
        GREATEST(a.approved_fee - COALESCE(SUM(r.amount_in_approved_currency), 0), 0) AS balance
      FROM applications a
      LEFT JOIN remittances r ON r.application_id = a.id
      WHERE a.client_id = $1
        AND a.certificate_number = $2
        AND ($3::BIGINT IS NULL OR a.id <> $3)
      GROUP BY a.id;
    `,
    [user.id, body.extendingCertificateNumber, currentApplicationId],
  );

  const extended = result.rows[0];
  if (!extended) {
    const error = new Error('The certificate number being extended was not found for this client.');
    error.status = 400;
    throw error;
  }

  return {
    ...body,
    title: extended.title,
    status: extended.status,
    sector: extended.sector,
    transferor: extended.transferor,
    transferee: extended.transferee,
    approvedFee: body.contractType === 'Extention' ? Number(extended.balance) : body.approvedFee,
    currency: body.contractType === 'Extention' ? extended.currency : body.currency,
  };
}

async function createRemittance(user, applicationId, body) {
  const result = await query(
    `
      INSERT INTO remittances (application_id, remittance_type, amount, currency, tax_percent, exchange_rate, remitted_on)
      SELECT a.id, $2, $3, $4, $5, $6, $7
      FROM applications a
      WHERE a.id = $1
        AND a.client_id = $8
        AND (a.effective_date + (a.duration_years || ' years')::INTERVAL)::DATE >= CURRENT_DATE;
    `,
    [applicationId, body.type, body.amount, body.currency, body.taxPercent || 0, body.exchangeRate || 1, body.date, user.id],
  );
  if (result.rowCount === 0) {
    const error = new Error('Remittance and WHT cannot be added to an expired certificate.');
    error.status = 400;
    throw error;
  }
}

async function updateRemittance(user, applicationId, remittanceId, body) {
  const result = await query(
    `
      UPDATE remittances
      SET remittance_type = $1,
          amount = $2,
          currency = $3,
          tax_percent = $4,
          exchange_rate = $5,
          remitted_on = $6
      WHERE id = $7
        AND application_id = $8
        AND EXISTS (
          SELECT 1
          FROM applications a
          WHERE a.id = remittances.application_id
            AND a.client_id = $9
            AND (a.effective_date + (a.duration_years || ' years')::INTERVAL)::DATE >= CURRENT_DATE
        );
    `,
    [body.type, body.amount, body.currency, body.taxPercent || 0, body.exchangeRate || 1, body.date, remittanceId, applicationId, user.id],
  );
  if (result.rowCount === 0) {
    const error = new Error('Remittance and WHT cannot be edited on an expired certificate.');
    error.status = 400;
    throw error;
  }
}

const getRequiredSessionUser = async (request) => {
  const user = await getSessionUser(request);
  if (!user) {
    const error = new Error('Login is required.');
    error.status = 401;
    throw error;
  }
  return user;
};

const paystackRequest = async (path, options = {}) => {
  if (!paystackSecretKey) {
    const error = new Error('PAYSTACK_SECRET_KEY is not configured on the server.');
    error.status = 500;
    throw error;
  }

  const response = await fetch(`https://api.paystack.co${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${paystackSecretKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await response.json();

  if (!response.ok || data.status === false) {
    const error = new Error(data.message || 'Paystack request failed.');
    error.status = 502;
    throw error;
  }

  return data;
};

async function initializePaystackPayment(user, body) {
  const planId = body.planId || 'monthly';
  const planResult = await query(
    `
      SELECT id, name, price
      FROM subscription_plans
      WHERE id = $1
        AND is_active = true;
    `,
    [planId],
  );
  const plan = planResult.rows[0];
  if (!plan) {
    const error = new Error('Selected subscription plan was not found.');
    error.status = 400;
    throw error;
  }
  if (!plan.price) {
    const error = new Error('Enterprise subscriptions require CREVA billing support.');
    error.status = 400;
    throw error;
  }

  const subscription = await query(
    `
      INSERT INTO subscriptions (client_id, plan_id, status, starts_on)
      VALUES ($1, $2, 'Past Due', CURRENT_DATE)
      RETURNING id;
    `,
    [user.id, plan.id],
  );

  const reference = `creva_${user.id}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const amount = Number(plan.price);
  const paystack = await paystackRequest('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email: user.email,
      amount: Math.round(amount * 100),
      currency: 'NGN',
      reference,
      callback_url: paystackCallbackUrl,
      metadata: {
        clientId: user.id,
        planId: plan.id,
        subscriptionId: subscription.rows[0].id,
      },
    }),
  });

  await query(
    `
      INSERT INTO subscription_payments (
        subscription_id, amount, currency, payment_status, provider_reference,
        paystack_access_code, paystack_authorization_url, paystack_response
      )
      VALUES ($1, $2, 'NGN', 'Pending', $3, $4, $5, $6);
    `,
    [
      subscription.rows[0].id,
      amount,
      reference,
      paystack.data.access_code,
      paystack.data.authorization_url,
      JSON.stringify(paystack),
    ],
  );

  return {
    reference,
    authorizationUrl: paystack.data.authorization_url,
    accessCode: paystack.data.access_code,
  };
}

async function verifyPaystackPayment(user, body) {
  if (!body.reference) {
    const error = new Error('Payment reference is required.');
    error.status = 400;
    throw error;
  }

  const paymentResult = await query(
    `
      SELECT
        spay.id,
        spay.subscription_id,
        spay.amount,
        spay.currency,
        s.plan_id
      FROM subscription_payments spay
      JOIN subscriptions s ON s.id = spay.subscription_id
      WHERE spay.provider_reference = $1
        AND s.client_id = $2;
    `,
    [body.reference, user.id],
  );
  const payment = paymentResult.rows[0];
  if (!payment) {
    const error = new Error('Payment reference was not found for this user.');
    error.status = 404;
    throw error;
  }

  const paystack = await paystackRequest(`/transaction/verify/${encodeURIComponent(body.reference)}`);
  const transaction = paystack.data;
  const expectedAmount = Math.round(Number(payment.amount) * 100);
  const paidSuccessfully = transaction.status === 'success'
    && Number(transaction.amount) === expectedAmount
    && transaction.currency === payment.currency;

  if (!paidSuccessfully) {
    await query(
      `
        UPDATE subscription_payments
        SET payment_status = 'Failed',
            paystack_response = $2
        WHERE id = $1;
      `,
      [payment.id, JSON.stringify(paystack)],
    );
    const error = new Error('Payment could not be verified.');
    error.status = 400;
    throw error;
  }

  const renewalInterval = payment.plan_id === 'yearly' ? "INTERVAL '1 year'" : "INTERVAL '1 month'";
  await query(
    `
      UPDATE subscription_payments
      SET payment_status = 'Paid',
          paid_on = now(),
          paystack_response = $2
      WHERE id = $1;
    `,
    [payment.id, JSON.stringify(paystack)],
  );
  await query(
    `
      UPDATE subscriptions
      SET status = 'Active',
          starts_on = CURRENT_DATE,
          renews_on = CURRENT_DATE + ${renewalInterval}
      WHERE id = $1;
    `,
    [payment.subscription_id],
  );

  return { ok: true, status: 'Paid', planId: payment.plan_id };
}

const server = http.createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    send(response, 204, {});
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host}`);

  try {
    if (request.method === 'GET' && url.pathname === '/api/health') {
      await query('SELECT 1;');
      send(response, 200, { ok: true });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/register') {
      const body = await readJson(request);
      send(response, 201, await registerClient(body));
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/login') {
      const body = await readJson(request);
      send(response, 200, await loginClient(body));
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/verify-email') {
      const body = await readJson(request);
      send(response, 200, await verifyClientEmail(body));
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/forgot-password') {
      const body = await readJson(request);
      send(response, 200, await requestPasswordReset(body));
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/reset-password') {
      const body = await readJson(request);
      send(response, 200, await resetPassword(body));
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/auth/me') {
      const user = await getSessionUser(request);
      if (!user) {
        send(response, 401, { error: 'Session is invalid or expired.' });
        return;
      }
      send(response, 200, { user });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
      const authorization = request.headers.authorization || '';
      const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
      if (token) {
        await query('DELETE FROM user_sessions WHERE token_hash = $1;', [hashToken(token)]);
      }
      send(response, 200, { ok: true });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/paystack/initialize') {
      const user = await getRequiredSessionUser(request);
      const body = await readJson(request);
      send(response, 200, await initializePaystackPayment(user, body));
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/paystack/verify') {
      const user = await getRequiredSessionUser(request);
      const body = await readJson(request);
      send(response, 200, await verifyPaystackPayment(user, body));
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/applications') {
      const user = await getSessionUser(request);
      if (!user) {
        send(response, 401, { error: 'Login is required.' });
        return;
      }
      send(response, 200, await getApplications(user));
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/applications') {
      const user = await getSessionUser(request);
      if (!user) {
        send(response, 401, { error: 'Login is required.' });
        return;
      }
      const body = await readJson(request);
      await createApplication(user, body);
      send(response, 201, await getApplications(user));
      return;
    }

    const applicationMatch = url.pathname.match(/^\/api\/applications\/(\d+)$/);
    if (request.method === 'PUT' && applicationMatch) {
      const user = await getSessionUser(request);
      if (!user) {
        send(response, 401, { error: 'Login is required.' });
        return;
      }
      const body = await readJson(request);
      await updateApplication(user, Number(applicationMatch[1]), body);
      send(response, 200, await getApplications(user));
      return;
    }

    const remittanceMatch = url.pathname.match(/^\/api\/applications\/(\d+)\/remittances$/);
    if (request.method === 'POST' && remittanceMatch) {
      const user = await getSessionUser(request);
      if (!user) {
        send(response, 401, { error: 'Login is required.' });
        return;
      }
      const body = await readJson(request);
      await createRemittance(user, Number(remittanceMatch[1]), body);
      send(response, 201, await getApplications(user));
      return;
    }

    const remittanceUpdateMatch = url.pathname.match(/^\/api\/applications\/(\d+)\/remittances\/(\d+)$/);
    if (request.method === 'PUT' && remittanceUpdateMatch) {
      const user = await getSessionUser(request);
      if (!user) {
        send(response, 401, { error: 'Login is required.' });
        return;
      }
      const body = await readJson(request);
      await updateRemittance(user, Number(remittanceUpdateMatch[1]), Number(remittanceUpdateMatch[2]), body);
      send(response, 200, await getApplications(user));
      return;
    }

    send(response, 404, { error: 'Route not found' });
  } catch (error) {
    if (error.status) {
      send(response, error.status, { error: error.message });
      return;
    }
    const message = error.constraint ? 'Database validation failed.' : error.message;
    send(response, 500, { error: message });
  }
});

const host = process.env.HOST || '0.0.0.0';
server.listen(port, host, () => {
  console.log(`CREVA NOTAP API running on http://${host}:${port}`);
});
