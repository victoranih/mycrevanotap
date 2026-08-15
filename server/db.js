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

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false } 
    : false
});

export const databaseConfig = (() => {
  try {
    const url = new URL(connectionString);
    return {
      host: url.hostname,
      port: url.port || '5432',
      database: url.pathname.replace(/^\//, ''),
      user: decodeURIComponent(url.username || ''),
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
    throw error;
  }
};
export default pool;
