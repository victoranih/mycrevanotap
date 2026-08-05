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

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // This will now perfectly resolve
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false } 
    : false
});

export const query = (text, params) => pool.query(text, params);
export default pool;
