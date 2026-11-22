const fs = require('fs');
const path = require('path');
const { Pool, types } = require('pg');

// Return DATE columns as 'YYYY-MM-DD' strings and NUMERIC as numbers
types.setTypeParser(1082, (v) => v);
types.setTypeParser(1700, (v) => parseFloat(v));

const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || '');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

async function initDb() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
}

const query = (text, params) => pool.query(text, params);

module.exports = { pool, query, initDb };
