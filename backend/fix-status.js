require('dotenv').config()
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
})

async function run() {
  try {
    console.log("Fixing borrow_requests status constraint...")

    // drop old constraint
    await pool.query(`
      ALTER TABLE borrow_requests
      DROP CONSTRAINT IF EXISTS borrow_requests_status_check;
    `)

    // add new constraint
    await pool.query(`
      ALTER TABLE borrow_requests
      ADD CONSTRAINT borrow_requests_status_check
      CHECK (status IN (
        'pending',
        'selected',
        'active',
        'returned',
        'declined',
        'overdue'
      ));
    `)

    console.log("✅ Status updated successfully!")

  } catch (err) {
    console.error("❌ Error:", err.message)
  } finally {
    await pool.end()
  }
}

run()