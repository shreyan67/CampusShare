require('dotenv').config()
const bcrypt = require('bcryptjs')
const { query, queryOne } = require('../db/pool')
const { Resend } = require('resend')

// ✅ CREATE INSTANCE
const resend = new Resend(process.env.RESEND_API_KEY)

// ── OTP GENERATION ─────────────────────────
function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

// ── STORE OTP ──────────────────────────────
async function storeOtp(userId, otp) {
  await query('UPDATE otps SET used=TRUE WHERE user_id=$1 AND used=FALSE', [userId])

  const hash = await bcrypt.hash(otp, 8)
  const expiresAt = new Date(
    Date.now() + parseInt(process.env.OTP_EXPIRY_SECONDS || '300') * 1000
  )

  await query(
    'INSERT INTO otps(user_id,code_hash,expires_at) VALUES($1,$2,$3)',
    [userId, hash, expiresAt]
  )
}

// ── VERIFY OTP ─────────────────────────────
async function verifyOtp(userId, otp) {
  const rec = await queryOne(
    'SELECT * FROM otps WHERE user_id=$1 AND used=FALSE AND expires_at>NOW() ORDER BY created_at DESC LIMIT 1',
    [userId]
  )

  if (!rec) return false

  const ok = await bcrypt.compare(otp, rec.code_hash)
  if (!ok) return false

  await query('UPDATE otps SET used=TRUE WHERE id=$1', [rec.id])
  return true
}

// ── SEND EMAIL (RESEND) ────────────────────
async function sendOtpEmail(email, name, otp) {
  try {
    console.log("Sending OTP via Resend to:", email)

    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: email,
      subject: `CampusShare verification code`,
      html: `
        <div style="font-family:sans-serif">
          <h2>Hi ${name},</h2>
          <p>Your OTP is:</p>
          <h1>${otp}</h1>
          <p>Valid for 5 minutes</p>
        </div>
      `,
    })

    return {}

  } catch (err) {
    console.error("❌ Resend error:", err)
    return { devOtp: otp } // fallback
  }
}

module.exports = {
  generateOtp,
  storeOtp,
  verifyOtp,
  sendOtpEmail
}