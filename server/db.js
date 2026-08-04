import pg from 'pg';

const { Pool } = require('pg');

// Render injects DATABASE_URL directly into process.env 
// from your render.yaml blueprint configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false } // Required for secure Render database connections
    : false
});

module.exports = pool;