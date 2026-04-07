const express = require('express')
const crypto = require('crypto')
const nodemailer = require('nodemailer')
const { pool } = require('../clients')
const { auth } = require('../middleware')

const router = express.Router()

function getTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })
}

// List all invited users
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, email, status, invited_at, accepted_at FROM invited_users ORDER BY invited_at DESC`
    )
    res.json(rows)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to list users' })
  }
})

// Invite a new user
router.post('/invite', auth, async (req, res) => {
  const { email } = req.body
  if (!email || !String(email).includes('@')) return res.status(400).json({ error: 'Valid email required' })

  const normalizedEmail = String(email).trim().toLowerCase()

  try {
    // Check if already invited
    const { rows: existing } = await pool.query(
      'SELECT id, status FROM invited_users WHERE email=$1', [normalizedEmail]
    )
    if (existing.length > 0) {
      return res.status(409).json({ error: `${normalizedEmail} is already invited (status: ${existing[0].status})` })
    }

    // Check if already a registered user
    const { rows: users } = await pool.query('SELECT id FROM users WHERE email=$1', [normalizedEmail])
    if (users.length > 0) {
      return res.status(409).json({ error: `${normalizedEmail} already has an account` })
    }

    const token = crypto.randomBytes(32).toString('hex')
    await pool.query(
      `INSERT INTO invited_users (email, token, invited_by, status) VALUES ($1, $2, $3, 'pending')`,
      [normalizedEmail, token, req.user.id]
    )

    const frontend = process.env.FRONTEND_URL || 'http://localhost:5174'
    const inviteUrl = `${frontend}/accept-invite?token=${token}`

    const transporter = getTransport()
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: normalizedEmail,
      subject: 'You\'ve been invited to DevNdesPro SEO',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
          <div style="text-align:center;margin-bottom:24px">
            <h1 style="font-size:22px;font-weight:800;color:#E66A39;margin:0">DevNdesPro SEO</h1>
          </div>
          <h2 style="font-size:18px;font-weight:700;color:#1a1a1a;margin:0 0 12px">You've been invited!</h2>
          <p style="color:#555;line-height:1.6;margin:0 0 24px">
            You've been given access to DevNdesPro SEO — a powerful tool to track, analyze, and improve your website's search performance.
          </p>
          <a href="${inviteUrl}" style="display:inline-block;background:#E66A39;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:15px">
            Accept Invitation →
          </a>
          <p style="color:#999;font-size:12px;margin-top:24px">
            This link expires in 7 days. If you didn't expect this email, you can ignore it.
          </p>
        </div>
      `,
    })

    res.json({ ok: true, message: `Invitation sent to ${normalizedEmail}` })
  } catch (e) {
    console.error('Invite error:', e)
    res.status(500).json({ error: 'Failed to send invitation' })
  }
})

// Resend invite
router.post('/resend/:id', auth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM invited_users WHERE id=$1', [req.params.id])
    if (!rows[0]) return res.status(404).json({ error: 'Invite not found' })

    const token = crypto.randomBytes(32).toString('hex')
    await pool.query('UPDATE invited_users SET token=$1, invited_at=NOW(), status=$2 WHERE id=$3',
      [token, 'pending', req.params.id])

    const frontend = process.env.FRONTEND_URL || 'http://localhost:5174'
    const inviteUrl = `${frontend}/accept-invite?token=${token}`

    const transporter = getTransport()
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: rows[0].email,
      subject: 'Your invitation to DevNdesPro SEO (resent)',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
          <h1 style="font-size:22px;font-weight:800;color:#E66A39;margin:0 0 16px">DevNdesPro SEO</h1>
          <p style="color:#555;line-height:1.6;margin:0 0 24px">Here's your updated invitation link:</p>
          <a href="${inviteUrl}" style="display:inline-block;background:#E66A39;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:15px">
            Accept Invitation →
          </a>
          <p style="color:#999;font-size:12px;margin-top:24px">This link expires in 7 days.</p>
        </div>
      `,
    })

    res.json({ ok: true })
  } catch (e) {
    console.error('Resend error:', e)
    res.status(500).json({ error: 'Failed to resend invitation' })
  }
})

// Revoke invite
router.delete('/:id', auth, async (req, res) => {
  await pool.query('DELETE FROM invited_users WHERE id=$1', [req.params.id])
  res.json({ ok: true })
})

// Accept invite (public — no auth)
router.get('/accept', async (req, res) => {
  const { token } = req.query
  if (!token) return res.status(400).json({ error: 'Token required' })

  try {
    const { rows } = await pool.query(
      `SELECT * FROM invited_users WHERE token=$1 AND status='pending' AND invited_at > NOW() - INTERVAL '7 days'`,
      [token]
    )
    if (!rows[0]) return res.status(410).json({ error: 'Invite link expired or already used' })

    await pool.query(`UPDATE invited_users SET status='accepted', accepted_at=NOW(), token=NULL WHERE id=$1`, [rows[0].id])

    res.json({ ok: true, email: rows[0].email })
  } catch (e) {
    console.error('Accept error:', e)
    res.status(500).json({ error: 'Failed to accept invite' })
  }
})

module.exports = router