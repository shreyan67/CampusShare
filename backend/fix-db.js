require('dotenv').config()
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // important for Render
})

async function run() {
  try {
    console.log("Connecting to DB...")

    await pool.query(`
      ALTER TABLE items
      ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
    `)

    console.log("✅ Column added successfully!")
  } catch (err) {
    console.error("❌ Error:", err.message)
  } finally {
    await pool.end()
  }
}

run()