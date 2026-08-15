console.log("🚀 RENDER IS SUCCESSFULLY EXECUTING SERVER/INDEX.JS!");

import express from 'express';
import cors from 'cors';
import path from 'path';
import crypto from 'node:crypto'; // FIX 2: Restored missing crypto module for hashing
import { fileURLToPath } from 'url'; 
import dotenv from 'dotenv';
import { query } from './db.js';

// 1. Setup Global Error Monitors to log hidden issues
process.on('uncaughtException', (err) => {
  console.error('🔥 CRITICAL UNCAUGHT EXCEPTION:', err.stack || err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 CRITICAL UNHANDLED REJECTION AT:', promise, 'REASON:', reason);
  process.exit(1);
});

// 2. Setup absolute directory tracking for local environment loading
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (process.env.NODE_ENV !== 'production') {
  dotenv.config({ path: path.join(__dirname, '../.env') });
}

const clientOrigin = process.env.CLIENT_ORIGIN || process.env.FRONTEND_URL || 'http://127.0.0.1:5173';
const allowedOrigins = new Set([
  clientOrigin,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://victoranih.github.io',
  'https://mycrevanotap.onrender.com',
]);

const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
const paystackCallbackUrl = process.env.PAYSTACK_CALLBACK_URL || `${clientOrigin}/`;

const app = express();

app.use(cors({
  origin(origin, callback) {
    const isRenderPreview = /^https:\/\/[a-z0-9-]+\.onrender\.com$/i.test(origin || '');
    if (!origin || allowedOrigins.has(origin) || isRenderPreview) {
      callback(null, true);
      return;
    }
    callback(new Error(`Origin ${origin} is not allowed by CORS.`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));
app.use(express.json());

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

  return { ok: true, message: 'Password reset successful.' };
}

async function getSessionUser(req) {
  const authorization = req.headers.authorization || '';
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

async function requireSessionUser(req) {
  const user = await getSessionUser(req);
  if (!user) {
    const error = new Error('Login is required.');
    error.status = 401;
    throw error;
  }
  return user;
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
  const result = await query(
    `
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
    `,
    [user.id],
  );

  return result.rows.map(mapApplication);
}

async function normalizeApplicationBody(user, body, currentApplicationId = null) {
  const contractTypesRequiringCertificate = ['Renewal', 'Extention', 'Additional fee'];
  if (!contractTypesRequiringCertificate.includes(body.contractType)) {
    return { ...body, extendingCertificateNumber: null };
  }

  if (!body.extendingCertificateNumber) {
    const error = new Error('Certificate number being renewed, extended, or used for additional fee is required.');
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

  const referenced = result.rows[0];
  if (!referenced) {
    const error = new Error('The referenced certificate number was not found for this client.');
    error.status = 400;
    throw error;
  }

  return {
    ...body,
    title: referenced.title,
    status: referenced.status,
    sector: referenced.sector,
    transferor: referenced.transferor,
    transferee: referenced.transferee,
    approvedFee: body.contractType === 'Extention' ? Number(referenced.balance) : body.approvedFee,
    currency: body.contractType === 'Extention' ? referenced.currency : body.currency,
  };
}

async function createApplication(user, body) {
  const normalizedBody = await normalizeApplicationBody(user, body);
  await query(
    `
      INSERT INTO applications (
        client_id, title, contract_type, extending_certificate_number, certificate_number, duration_years,
        effective_date, approved_fee, currency, transferor, transferee, sector, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13);
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

const route = (handler) => async (req, res) => {
  try {
    const data = await handler(req, res);
    if (!res.headersSent) res.json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

// ==========================================
// 3. EXPRESS ROUTE API ENDPOINTS
// ==========================================
app.get('/api/health', async (req, res) => {
  res.json({ status: 'ok', service: 'crevanotap' });
});

app.get('/api/db-health', async (req, res) => {
  try {
    const result = await query('SELECT NOW()'); 
    res.json({ status: "ok", dbTime: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const data = await registerClient(req.body);
    res.status(201).json(data);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const data = await loginClient(req.body);
    res.json(data);
  } catch (err) {
    console.error('Login failed:', err);
    const message = err.status || process.env.NODE_ENV !== 'production'
      ? (err.message || String(err))
      : 'Authentication failed.';
    res.status(err.status || 500).json({ error: message });
  }
});

app.post('/api/auth/verify-email', route((req) => verifyClientEmail(req.body)));

app.post('/api/auth/forgot-password', route((req) => requestPasswordReset(req.body)));

app.post('/api/auth/reset-password', route((req) => resetPassword(req.body)));

app.get('/api/auth/me', route(async (req) => {
  const user = await requireSessionUser(req);
  return { user };
}));

app.post('/api/auth/logout', route(async (req) => {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (token) {
    await query('DELETE FROM user_sessions WHERE token_hash = $1;', [hashToken(token)]);
  }
  return { ok: true };
}));

app.get('/api/applications', route(async (req) => {
  const user = await requireSessionUser(req);
  return getApplications(user);
}));

app.post('/api/applications', route(async (req) => {
  const user = await requireSessionUser(req);
  await createApplication(user, req.body);
  return getApplications(user);
}));

app.put('/api/applications/:applicationId', route(async (req) => {
  const user = await requireSessionUser(req);
  await updateApplication(user, Number(req.params.applicationId), req.body);
  return getApplications(user);
}));

app.post('/api/applications/:applicationId/remittances', route(async (req) => {
  const user = await requireSessionUser(req);
  await createRemittance(user, Number(req.params.applicationId), req.body);
  return getApplications(user);
}));

app.put('/api/applications/:applicationId/remittances/:remittanceId', route(async (req) => {
  const user = await requireSessionUser(req);
  await updateRemittance(user, Number(req.params.applicationId), Number(req.params.remittanceId), req.body);
  return getApplications(user);
}));

const distDir = path.join(__dirname, '../dist');
app.use(express.static(distDir));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({ error: 'API route not found.' });
    return;
  }
  res.sendFile(path.join(distDir, 'index.html'));
});

// FIX 3: Restored the vital Port binding listener so Render's port-scanner connects
const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server successfully listening on port ${PORT}`);
});
