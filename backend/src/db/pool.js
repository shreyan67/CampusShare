require('dotenv').config()
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
})

pool.on('error', err => console.error('DB pool error:', err))

async function query(sql, params) {
  const client = await pool.connect()
  try {
    const result = await client.query(sql, params)
    return result.rows
  } finally {
    client.release()
  }
}

async function queryOne(sql, params) {
  const rows = await query(sql, params)
  return rows[0] || null
}

module.exports = { pool, query, queryOne }
