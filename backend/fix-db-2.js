require('dotenv').config()
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

async function run() {
  try {
    console.log("Adding listing_type column...")

    await pool.query(`
      ALTER TABLE items
      ADD COLUMN IF NOT EXISTS listing_type TEXT DEFAULT 'borrow';
    `)

    console.log("✅ listing_type added!")
  } catch (err) {
    console.error("❌ Error:", err.message)
  } finally {
    await pool.end()
  }
}

run()