require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { Pool } = require('pg')

const app = express()
const PORT = process.env.PORT || 4000

// ===== DATABASE =====
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
})

// ===== CORS =====
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    'https://campusshare-frontend.onrender.com'
  ],
  credentials: true
}))
app.options('*', cors())

// ===== BODY PARSER =====
app.use(express.json({ limit: '20mb' }))
app.use(express.urlencoded({ extended: true }))

// ===== DEV LOGGING =====
if (process.env.NODE_ENV === 'development') {
  app.use((req, _res, next) => {
    console.log(`${req.method} ${req.path}`)
    next()
  })
}

// ===== ADMIN MIDDLEWARE =====
const adminAuth = (req, res, next) => {
  const key = req.query.key

  if (key !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ message: "Unauthorized" })
  }

  next()
}

// ===== ROUTES =====
app.use('/api/auth', require('./routes/auth'))
app.use('/api/items', require('./routes/items'))
app.use('/api/requests', require('./routes/requests'))
app.use('/api/users', require('./routes/users'))
app.use('/api/lostfound', require('./routes/lostfound'))

// ===== HEALTH =====
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))

// ===== ADMIN ROUTES =====

// 👉 View all items
app.get('/admin/items', adminAuth, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM items ORDER BY id DESC")
    res.json(result.rows)
  } catch (err) {
    console.error(err)
    res.status(500).send("Error fetching items")
  }
})

// 👉 Delete ALL items
app.delete('/admin/delete-all', adminAuth, async (req, res) => {
  try {
    const result = await pool.query("DELETE FROM items RETURNING *")

    res.json({
      message: "All items deleted",
      count: result.rowCount
    })
  } catch (err) {
    console.error(err)
    res.status(500).send("Error deleting items")
  }
})

// 👉 Delete ONE item
app.delete('/admin/delete-item/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params

    const result = await pool.query(
      "DELETE FROM items WHERE id = $1 RETURNING *",
      [id]
    )

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Item not found" })
    }

    res.json({
      message: "Item deleted",
      item: result.rows[0]
    })

  } catch (err) {
    console.error(err)
    res.status(500).send("Error deleting item")
  }
})

// ===== 404 =====
app.use((_req, res) => res.status(404).json({ error: 'Route not found.' }))

// ===== ERROR HANDLER =====
app.use((err, _req, res, _next) => {
  console.error('Unhandled:', err.message)
  res.status(500).json({ error: err.message || 'Internal server error.' })
})

// ===== SERVER =====
app.listen(PORT, () => {
  console.log(`\n🚀 CampusShare API → http://localhost:${PORT}`)
  console.log(`   Health: http://localhost:${PORT}/api/health\n`)
})