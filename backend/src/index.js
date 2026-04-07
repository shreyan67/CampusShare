require('dotenv').config()
const express = require('express')
const cors    = require('cors')

const app = express()
const PORT = process.env.PORT || 4000

app.use(cors({ origin: 'http://localhost:3000', credentials: true }))
app.use(express.json({ limit: '20mb' }))   // large limit for base64 images
app.use(express.urlencoded({ extended: true }))

// Log requests in dev
if (process.env.NODE_ENV === 'development') {
  app.use((req, _res, next) => { console.log(`${req.method} ${req.path}`); next() })
}

app.use('/api/auth',      require('./routes/auth'))
app.use('/api/items',     require('./routes/items'))
app.use('/api/requests',  require('./routes/requests'))
app.use('/api/users',     require('./routes/users'))
app.use('/api/lostfound', require('./routes/lostfound'))

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))
app.use((_req, res) => res.status(404).json({ error: 'Route not found.' }))
app.use((err, _req, res, _next) => {
  console.error('Unhandled:', err.message)
  res.status(500).json({ error: err.message || 'Internal server error.' })
})

app.listen(PORT, () => {
  console.log(`\n🚀 CampusShare API → http://localhost:${PORT}`)
  console.log(`   Health: http://localhost:${PORT}/api/health\n`)
})
