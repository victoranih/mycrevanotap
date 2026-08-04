import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false } // Required for Render Postgres connections
    : false
});

// Create and explicitly EXPORT the query function that your index.js is asking for
export const query = (text, params) => pool.query(text, params);

// Optional: Export the entire pool just in case you need it elsewhere
export default pool;
