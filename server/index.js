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

// FIX 1: Defined clientOrigin at the top so paystack and send helper can access it safely
const clientOrigin = process.env.NODE_ENV === 'production'
  ? 'https://victoranih.github.io'
  : 'http://localhost:5173';

const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
const paystackCallbackUrl = process.env.PAYSTACK_CALLBACK_URL || `${clientOrigin}/`;

const app = express();

// Initialize CORS middleware correctly
app.use(cors({
  origin: clientOrigin,
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

// ==========================================
// 3. EXPRESS ROUTE API ENDPOINTS
// ==========================================
app.get('/api/health', async (req, res) => {
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
    res.status(err.status || 500).json({ error: err.message });
  }
});

app.get('/', (req, res) => {
  res.status(200).send('Backend status: Live and Running');
});

// FIX 3: Restored the vital Port binding listener so Render's port-scanner connects
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server successfully listening on port ${PORT}`);
});
