import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Force load the root .env file if DATABASE_URL is missing locally
if (!process.env.DATABASE_URL) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  dotenv.config({ path: path.join(__dirname, '../.env') });
}

import pkg from 'pg';
const { Pool } = pkg;

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/crevanotap';
const databaseUrl = new URL(connectionString);
const isLocalDatabase = ['localhost', '127.0.0.1', '::1'].includes(databaseUrl.hostname);

const pool = new Pool({
  connectionString,
  ssl: isLocalDatabase ? false : { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

export const databaseConfig = (() => {
  try {
    return {
      host: databaseUrl.hostname,
      port: databaseUrl.port || '5432',
      database: databaseUrl.pathname.replace(/^\//, ''),
      user: decodeURIComponent(databaseUrl.username || ''),
      ssl: isLocalDatabase ? 'off' : 'on',
    };
  } catch {
    return { host: 'invalid DATABASE_URL', port: '', database: '', user: '' };
  }
})();

export const query = async (text, params) => {
  try {
    return await pool.query(text, params);
  } catch (error) {
    if (error instanceof AggregateError || error.name === 'AggregateError') {
      throw new Error(`Could not connect to PostgreSQL at ${databaseConfig.host}:${databaseConfig.port}/${databaseConfig.database}. Check DATABASE_URL and confirm PostgreSQL is running.`);
    }
    if (error.message === 'Connection terminated unexpectedly') {
      throw new Error(`Connection to PostgreSQL was terminated at ${databaseConfig.host}:${databaseConfig.port}/${databaseConfig.database}. Check that DATABASE_URL is the hosted database URL and that SSL is enabled for non-local databases.`);
    }
    throw error;
  }
};
export default pool;
