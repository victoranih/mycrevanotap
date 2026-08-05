
import pkg from 'pg';
const { Pool } = pkg;

// Use a fallback to process.env.DATABASE_URL for safety
const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString: connectionString,
  // CRUCIAL: Render Free PostgreSQL requires SSL in production
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false } 
    : false
});

export const query = (text, params) => pool.query(text, params);
export default pool;
