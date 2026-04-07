require('dotenv').config()
const bcrypt = require('bcryptjs')
const nodemailer = require('nodemailer')
const { query, queryOne } = require('../db/pool')

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

// ── SMTP CHECK ─────────────────────────────
function smtpReady() {
  return process.env.SMTP_USER && process.env.SMTP_PASS
}

// ── SEND EMAIL ─────────────────────────────
async function sendOtpEmail(email, name, otp) {
  // DEV MODE
  if (false) {
    console.log('\n╔══════════════════════════════════════╗')
    console.log(`║  OTP for ${name.padEnd(26)}║`)
    console.log(`║  Email : ${email.padEnd(26)}║`)
    console.log(`║  Code  : ${otp.padEnd(26)}  ║`)
    console.log('╚══════════════════════════════════════╝\n')
    return { devOtp: otp }
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })

    await transporter.verify()

    await transporter.sendMail({
      from: `"CampusShare" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `CampusShare verification code: ${otp}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px">
          <h2>Hi ${name},</h2>
          <p style="color:#555">Your one-time code for CampusShare:</p>
          <div style="font-size:40px;font-weight:800;letter-spacing:0.25em;background:#f5f5f5;
                      padding:20px;border-radius:10px;text-align:center;margin:24px 0;
                      color:#e94560">${otp}</div>
          <p style="color:#888;font-size:13px">Expires in 5 minutes. Never share this code.</p>
        </div>
      `,
    })

    return {}

  } catch (err) {
    console.error('❌ Email sending failed:', err)
    return { devOtp: otp } // fallback
  }
  console.log("Sending OTP to:", email)
}

module.exports = {
  generateOtp,
  storeOtp,
  verifyOtp,
  sendOtpEmail,
  smtpReady,
}