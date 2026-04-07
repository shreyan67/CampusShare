const express = require('express')
const { queryOne } = require('../db/pool')
const { requireAuth } = require('../middleware/auth')

const router = express.Router()

router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await queryOne(
      `SELECT u.*, c.name AS college_name, c.domain AS college_domain
       FROM users u JOIN colleges c ON u.college_id=c.id WHERE u.id=$1`,
      [req.userId]
    )
    if (!user) return res.status(404).json({ error: 'User not found.' })
    res.json({ user })
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed.' }) }
})

module.exports = router
