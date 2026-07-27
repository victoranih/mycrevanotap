import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/crevanotap',
});

export async function query(text, params) {
  const result = await pool.query(text, params);
  return result;
}
