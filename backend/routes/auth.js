const express = require('express')
const axios = require('axios')
const jwt = require('jsonwebtoken')
const { pool } = require('../clients')
const { auth } = require('../middleware')
const { getGscAccessToken } = require('../utils/gsc')
const { ensureUserFeatureSchema, featureFlagsFor } = require('../utils/features')

const router = express.Router()
const PORT = process.env.PORT || 4000

function getBackendUrl(req) {
  if (process.env.BACKEND_URL) return process.env.BACKEND_URL
  const proto = req.get('x-forwarded-proto') || req.protocol || 'http'
  const host = req.get('x-forwarded-host') || req.get('host')
  if (host) return `${proto}://${host}`
  return `http://localhost:${PORT}`
}

function getGscRedirectUri(req) {
  if (process.env.GSC_REDIRECT_URI) return process.env.GSC_REDIRECT_URI
  return `${getBackendUrl(req)}/api/auth/gsc/callback`
}

function parseAllowedEmails() {
  return (process.env.ALLOWED_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * Login is dynamic:
 * - ALLOWED_EMAILS = bootstrap admins (optional)
 * - existing users row = already known account (Feature access list)
 * - invite accepted/granted/pending = invited people
 */
async function resolveLoginAccess(email) {
  const normalized = String(email || '').trim().toLowerCase()
  const allowed = parseAllowedEmails()
  const isAllowlisted = allowed.length > 0 && allowed.includes(normalized)

  const { rows: existingRows } = await pool.query(
    'SELECT id FROM users WHERE LOWER(email)=$1 LIMIT 1',
    [normalized]
  )
  const isExistingUser = existingRows.length > 0

  const { rows: inviteRows } = await pool.query(
    `SELECT * FROM invited_users
     WHERE LOWER(email)=$1
       AND status IN ('accepted', 'granted', 'pending')`,
    [normalized]
  )
  const isInvited = inviteRows.length > 0

  return {
    email: normalized,
    allowed,
    isAllowlisted,
    isExistingUser,
    isInvited,
    inviteRows,
    canLogin: isAllowlisted || isExistingUser || isInvited,
  }
}

router.post('/email', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase()
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Enter a valid email address.' })
    }

    const access = await resolveLoginAccess(email)
    if (!access.canLogin) {
      return res.status(403).json({
        error: 'Access denied. Ask an admin to invite you or enable your account.',
      })
    }

    const { rows } = await pool.query(
      'INSERT INTO users (email, name, photo) VALUES ($1,$2,$3) ON CONFLICT (email) DO UPDATE SET name=COALESCE(EXCLUDED.name, users.name), photo=COALESCE(EXCLUDED.photo, users.photo) RETURNING *',
      [email, email, null]
    )
    const user = rows[0]

    if (access.isInvited) {
      for (const invite of access.inviteRows) {
        if (invite.site_id) {
          await pool.query(
            'INSERT INTO site_access (site_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
            [invite.site_id, user.id]
          )
        }
        if (invite.status === 'pending') {
          await pool.query(
            `UPDATE invited_users SET status='accepted', accepted_at=NOW() WHERE id=$1`,
            [invite.id]
          )
        }
      }
    }

    if (access.isAllowlisted) {
      await pool.query(
        `INSERT INTO site_access (site_id, user_id)
         SELECT id, $1 FROM sites WHERE user_id=$1
         ON CONFLICT DO NOTHING`,
        [user.id]
      )
    }

    const jwtToken = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '30d' })
    res.json({ token: jwtToken, user: { id: user.id, email: user.email, name: user.name, photo: user.photo } })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Auth failed' })
  }
})

router.post('/google', async (req, res) => {
  try {
    const { token } = req.body
    const { data: profile } = await axios.get(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${token}`)
    const email = String(profile.email || '').trim().toLowerCase()

    const access = await resolveLoginAccess(email)
    if (!access.canLogin) {
      return res.status(403).json({
        error: 'Access denied. Ask an admin to invite you or enable your account.',
      })
    }

    const { rows } = await pool.query(
      'INSERT INTO users (email, name, photo) VALUES ($1,$2,$3) ON CONFLICT (email) DO UPDATE SET name=$2, photo=$3 RETURNING *',
      [email, profile.name, profile.picture]
    )
    const user = rows[0]

    if (access.isInvited) {
      for (const invite of access.inviteRows) {
        if (invite.site_id) {
          await pool.query(
            'INSERT INTO site_access (site_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
            [invite.site_id, user.id]
          )
        }
        if (invite.status === 'pending') {
          await pool.query(
            `UPDATE invited_users SET status='accepted', accepted_at=NOW() WHERE id=$1`,
            [invite.id]
          )
        }
      }
    }

    if (access.isAllowlisted) {
      await pool.query(
        `INSERT INTO site_access (site_id, user_id)
         SELECT id, $1 FROM sites WHERE user_id=$1
         ON CONFLICT DO NOTHING`,
        [user.id]
      )
    }

    const jwtToken = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '30d' })
    res.json({ token: jwtToken, user: { id: user.id, email: user.email, name: user.name, photo: user.photo } })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Auth failed' })
  }
})

router.get('/me', auth, async (req, res) => {
  await ensureUserFeatureSchema()
  const { rows } = await pool.query(
    `SELECT id, email, name, photo, plan, is_paid, backlinks_enabled, keywords_enabled, ai_assistant_enabled,
            cold_emails_enabled, features_updated_at
     FROM users WHERE id=$1`,
    [req.user.id]
  )
  if (!rows[0]) return res.status(404).json({ error: 'Not found' })
  const user = rows[0]
  res.json({
    ...user,
    features: featureFlagsFor(user),
  })
})

// GSC OAuth
router.get('/gsc', auth, (req, res) => {
  const state = Buffer.from(JSON.stringify({ userId: req.user.id })).toString('base64url')
  const redirectUri = getGscRedirectUri(req)
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` })
})

router.get('/gsc/callback', async (req, res) => {
  try {
    const { code, state } = req.query
    const redirectUri = getGscRedirectUri(req)
    const { userId } = JSON.parse(Buffer.from(state, 'base64url').toString())
    const { data } = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    })
    await pool.query('UPDATE users SET gsc_refresh_token=$1 WHERE id=$2', [data.refresh_token, userId])
    const frontend = process.env.FRONTEND_URL || 'http://localhost:5174'
    res.send(`<html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><div style="font-size:48px;margin-bottom:12px">✓</div><h2 style="color:#22C55E;margin:0 0 8px">GSC Connected!</h2><p style="color:#6b7280">You can now return to DevNdesPro SEO and close this tab.</p><script>window.opener?.postMessage('gsc_connected','${frontend}');<\/script></div></body></html>`)
  } catch (e) {
    console.error('GSC callback:', e.response?.data || e.message)
    res.status(500).send('Connection failed. Please try again.')
  }
})

router.get('/gsc/status', auth, async (req, res) => {
  const { rows } = await pool.query('SELECT gsc_refresh_token FROM users WHERE id=$1', [req.user.id])
  res.json({ connected: !!rows[0]?.gsc_refresh_token })
})

router.delete('/gsc', auth, async (req, res) => {
  await pool.query('UPDATE users SET gsc_refresh_token=NULL WHERE id=$1', [req.user.id])
  res.json({ ok: true })
})

module.exports = router