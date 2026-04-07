require('dotenv').config()
const express = require('express')
const jwt     = require('jsonwebtoken')
const { query, queryOne } = require('../db/pool')
const { generateOtp, storeOtp, verifyOtp, sendOtpEmail } = require('../services/otp')

const router = express.Router()

const EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/

function makeToken(userId, collegeId) {
  return jwt.sign({ sub: userId, collegeId }, process.env.JWT_SECRET, { expiresIn: '30d' })
}

function safeUser(u) {
  const { code_hash, ...rest } = u
  return rest
}

// GET /api/auth/colleges
router.get('/colleges', async (_req, res) => {
  try {
    const colleges = await query('SELECT id, name, domain FROM colleges ORDER BY name')
    res.json({ colleges })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Could not load colleges.' })
  }
})

// POST /api/auth/signup
// Body: { name, email, rollNumber, collegeId }
router.post('/signup', async (req, res) => {
  try {
    const { name, email, rollNumber } = req.body

    // ✅ FIXED (removed collegeId)
    if (!name || !email || !rollNumber)
      return res.status(400).json({ error: 'All fields are required.' })

    if (!EMAIL_RE.test(email))
      return res.status(400).json({ error: 'Invalid email format.' })

    // 🔥 AUTO-DETECT COLLEGE
    const emailDomain = email.split('@')[1]

    const college = await queryOne(
      'SELECT * FROM colleges WHERE domain = $1',
      [emailDomain]
    )

    if (!college) {
      return res.status(400).json({
        error: 'Your college is not supported yet.'
      })
    }

    // Check duplicate email
    if (await queryOne('SELECT id FROM users WHERE email=$1', [email]))
      return res.status(409).json({ error: 'An account with this email already exists.' })

    const avatar = name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()
    const colors = ['#185FA5','#D4537E','#1D9E75','#BA7517','#534AB7']
    const color  = colors[Math.floor(Math.random() * colors.length)]

    // ✅ FIXED INSERT
    const user = await queryOne(
      `INSERT INTO users(college_id, name, email, roll_number, avatar, color)
       VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
      [college.id, name, email, rollNumber, avatar, color]
    )

    const otp = generateOtp()
    await storeOtp(user.id, otp)
    const { devOtp } = await sendOtpEmail(email, name, otp)

    const resp = { userId: user.id, collegeName: college.name }
    if (devOtp) resp._devOtp = devOtp

    res.status(201).json(resp)

  } catch (err) {
    console.error('Signup error:', err)
    res.status(500).json({ error: 'Signup failed. Please try again.' })
  }
})

// POST /api/auth/login  (passwordless — sends OTP to registered email)
router.post('/login', async (req, res) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ error: 'Email is required.' })

    const user = await queryOne('SELECT id, name, email FROM users WHERE email=$1', [email])
    if (!user) return res.status(404).json({ error: 'No account with that email. Please sign up first.' })

    const otp = generateOtp()
    await storeOtp(user.id, otp)
    const { devOtp } = await sendOtpEmail(email, user.name, otp)

    const resp = { userId: user.id }
    if (devOtp) resp._devOtp = devOtp
    res.json(resp)
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ error: 'Login failed. Please try again.' })
  }
})

// POST /api/auth/verify-otp
router.post('/verify-otp', async (req, res) => {
  try {
    const { userId, otp } = req.body
    if (!userId || !otp) return res.status(400).json({ error: 'userId and otp required.' })

    const ok = await verifyOtp(userId, String(otp))
    if (!ok) return res.status(400).json({ error: 'Wrong or expired code. Try again.' })

    await query('UPDATE users SET is_verified=TRUE WHERE id=$1', [userId])
    const user = await queryOne(
      `SELECT u.*, c.name AS college_name, c.domain AS college_domain
       FROM users u JOIN colleges c ON u.college_id=c.id WHERE u.id=$1`,
      [userId]
    )
    const token = makeToken(userId, user.college_id)
    res.json({ token, user: safeUser(user) })
  } catch (err) {
    console.error('Verify OTP error:', err)
    res.status(500).json({ error: 'Verification failed.' })
  }
})

module.exports = router
