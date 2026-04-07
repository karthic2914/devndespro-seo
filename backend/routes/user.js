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
      `SELECT iu.id, iu.email, iu.status, iu.invited_at, iu.accepted_at, iu.site_id,
              s.name AS site_name
       FROM invited_users iu
       LEFT JOIN sites s ON s.id = iu.site_id
       ORDER BY iu.invited_at DESC`
    )
    res.json(rows)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to list users' })
  }
})

// List sites (for invite dropdown)
router.get('/sites', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.id, s.name, s.url FROM sites s
       INNER JOIN site_access sa ON sa.site_id = s.id AND sa.user_id = $1
       ORDER BY s.name ASC`,
      [req.user.id]
    )
    res.json(rows)
  } catch (e) {
    res.status(500).json({ error: 'Failed to load sites' })
  }
})

// Invite a new user
router.post('/invite', auth, async (req, res) => {
  const { email, siteId } = req.body
  if (!email || !String(email).includes('@')) return res.status(400).json({ error: 'Valid email required' })
  if (!siteId) return res.status(400).json({ error: 'Select a project to grant access to' })

  const normalizedEmail = String(email).trim().toLowerCase()

  try {
    // Check if already invited for this site
    const { rows: existing } = await pool.query(
      'SELECT id, status FROM invited_users WHERE email=$1 AND site_id=$2',
      [normalizedEmail, siteId]
    )
    if (existing.length > 0) {
      return res.status(409).json({ error: `${normalizedEmail} is already invited to this project (status: ${existing[0].status})` })
    }

    // Check if already a registered user — grant access directly
    const { rows: users } = await pool.query('SELECT id FROM users WHERE email=$1', [normalizedEmail])
    if (users.length > 0) {
      await pool.query(
        'INSERT INTO site_access (site_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [siteId, users[0].id]
      )
      return res.json({ ok: true, message: `Access granted to ${normalizedEmail}` })
    }

    const token = crypto.randomBytes(32).toString('hex')
    await pool.query(
      `INSERT INTO invited_users (email, token, invited_by, status, site_id) VALUES ($1, $2, $3, 'pending', $4)`,
      [normalizedEmail, token, req.user.id, siteId]
    )

    const { rows: siteRows } = await pool.query('SELECT name FROM sites WHERE id=$1', [siteId])
    const siteName = siteRows[0]?.name || 'your project'

    const frontend = process.env.FRONTEND_URL || 'http://localhost:5174'
    const inviteUrl = `${frontend}/accept-invite?token=${token}`

    const transporter = getTransport()
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: normalizedEmail,
      subject: `You've been invited to access ${siteName} on DevNdesPro SEO`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
          <div style="text-align:center;margin-bottom:24px">
            <h1 style="font-size:22px;font-weight:800;color:#E66A39;margin:0">DevNdesPro SEO</h1>
          </div>
          <h2 style="font-size:18px;font-weight:700;color:#1a1a1a;margin:0 0 12px">You've been invited!</h2>
          <p style="color:#555;line-height:1.6;margin:0 0 8px">
            You've been given access to the SEO dashboard for <strong>${siteName}</strong>.
          </p>
          <p style="color:#555;line-height:1.6;margin:0 0 24px">
            Track keywords, backlinks, site health and more — all in one place.
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
    const { rows } = await pool.query(
      'SELECT iu.*, s.name AS site_name FROM invited_users iu LEFT JOIN sites s ON s.id = iu.site_id WHERE iu.id=$1',
      [req.params.id]
    )
    if (!rows[0]) return res.status(404).json({ error: 'Invite not found' })

    const token = crypto.randomBytes(32).toString('hex')
    await pool.query('UPDATE invited_users SET token=$1, invited_at=NOW(), status=$2 WHERE id=$3',
      [token, 'pending', req.params.id])

    const frontend = process.env.FRONTEND_URL || 'http://localhost:5174'
    const inviteUrl = `${frontend}/accept-invite?token=${token}`
    const siteName = rows[0].site_name || 'your project'

    const transporter = getTransport()
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: rows[0].email,
      subject: `Your invitation to ${siteName} on DevNdesPro SEO (resent)`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
          <h1 style="font-size:22px;font-weight:800;color:#E66A39;margin:0 0 16px">DevNdesPro SEO</h1>
          <p style="color:#555;line-height:1.6;margin:0 0 8px">Here's your updated invitation link for <strong>${siteName}</strong>:</p>
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