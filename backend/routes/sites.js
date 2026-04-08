const express = require('express')
const { pool } = require('../clients')
const { auth, verifySite } = require('../middleware')
const { normalizeAndVerifyWebsite } = require('../utils/helpers')
const { ensureSiteIsVerifiedInGsc } = require('../utils/gsc')

const router = express.Router()

// Sites
router.get('/', auth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT
      s.*,
      m.health AS health,
      COALESCE(m.dr, 0) AS dr,
      COALESCE(k.keyword_count, 0) AS keyword_count,
      COALESCE(b.backlink_count, 0) AS backlink_count
    FROM sites s
    INNER JOIN site_access sa ON sa.site_id = s.id AND sa.user_id = $1
    LEFT JOIN seo_metrics m ON m.site_id = s.id
    LEFT JOIN (SELECT site_id, COUNT(*)::int AS keyword_count FROM keywords GROUP BY site_id) k ON k.site_id = s.id
    LEFT JOIN (SELECT site_id, COUNT(*)::int AS backlink_count FROM backlinks GROUP BY site_id) b ON b.site_id = s.id
    ORDER BY s.created_at ASC`,
    [req.user.id]
  )
  res.json(rows)
})

router.post('/', auth, async (req, res) => {
  const { name, url } = req.body
  if (!name || !url) return res.status(400).json({ error: 'name and url required' })
  if (!String(name).trim()) return res.status(400).json({ error: 'Project name is required' })
  try {
    const verifiedUrl = await normalizeAndVerifyWebsite(url)
    await ensureSiteIsVerifiedInGsc(req.user.id, verifiedUrl)
    const { rows } = await pool.query(
      'INSERT INTO sites (user_id, name, url) VALUES ($1,$2,$3) RETURNING *',
      [req.user.id, String(name).trim(), verifiedUrl]
    )
 await pool.query('INSERT INTO seo_metrics (site_id) VALUES ($1)', [rows[0].id])
    await pool.query('INSERT INTO site_access (site_id, user_id) VALUES ($1,$2)', [rows[0].id, req.user.id])

    // Notify admin
    const axios = require('axios')
    axios.post(
      'https://api.zeptomail.com/v1.1/email',
      {
        from: { address: 'noreply@devndespro.com', name: 'DevNdesPro SEO' },
        to: [{ email_address: { address: 'karthic2914@gmail.com' } }],
        subject: `New project added: ${rows[0].name}`,
        htmlbody: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
            <h2 style="color:#E66A39;margin:0 0 16px">New Project Added ✓</h2>
            <p style="color:#555;margin:0 0 8px"><strong>${rows[0].name}</strong> was added.</p>
            <p style="color:#555;margin:0 0 8px">URL: ${rows[0].url}</p>
            <p style="color:#999;font-size:12px;margin:0">DevNdesPro SEO notification.</p>
          </div>
        `,
      },
      {
        headers: {
          'Authorization': process.env.ZEPTOMAIL_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    ).catch(e => console.error('Admin notify failed:', e.message))

    res.json(rows[0])
  } catch (e) {
    res.status(400).json({ error: e.message || 'Website verification failed' })
  }
})

router.delete('/:id', auth, async (req, res) => {
  await pool.query('DELETE FROM sites WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id])
  res.json({ ok: true })
})

// Metrics
router.get('/:siteId/metrics', auth, verifySite, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM seo_metrics WHERE site_id=$1 LIMIT 1', [req.siteId])
  res.json(rows[0] || { dr: 0, clicks: 0, impressions: 0, health: 100 })
})

router.put('/:siteId/metrics', auth, verifySite, async (req, res) => {
  const { dr, clicks, impressions, health } = req.body
  const { rows } = await pool.query(
    `INSERT INTO seo_metrics (site_id, dr, clicks, impressions, health) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (site_id) DO UPDATE SET dr=$2, clicks=$3, impressions=$4, health=$5, updated_at=NOW() RETURNING *`,
    [req.siteId, dr, clicks, impressions, health]
  )
  res.json(rows[0])
})

// GSC data for a site
router.get('/:siteId/gsc', auth, verifySite, async (req, res) => {
  const axios = require('axios')
  const { getGscAccessToken } = require('../utils/gsc')
  try {
    const { rows: u } = await pool.query('SELECT email, gsc_refresh_token FROM users WHERE id=$1', [req.user.id])
    const accountEmail = u[0]?.email || null
    if (!u[0]?.gsc_refresh_token) return res.json({ connected: false, accountEmail })
    const { rows: s } = await pool.query('SELECT url FROM sites WHERE id=$1', [req.siteId])
    const siteUrl = s[0].url
    const accessToken = await getGscAccessToken(u[0].gsc_refresh_token)
    const endDate = new Date().toISOString().split('T')[0]
    const startDate = new Date(Date.now() - 28 * 864e5).toISOString().split('T')[0]
    const headers = { Authorization: `Bearer ${accessToken}` }
    const base = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`
    const [qr, pr, tr, dr] = await Promise.all([
      axios.post(base, { startDate, endDate, dimensions: ['query'], rowLimit: 10, orderBy: [{ fieldName: 'clicks', sortOrder: 'DESCENDING' }] }, { headers }),
      axios.post(base, { startDate, endDate, dimensions: ['page'], rowLimit: 5, orderBy: [{ fieldName: 'clicks', sortOrder: 'DESCENDING' }] }, { headers }),
      axios.post(base, { startDate, endDate, rowLimit: 1 }, { headers }),
      axios.post(base, { startDate, endDate, dimensions: ['date'], rowLimit: 28 }, { headers }),
    ])
    res.json({
      connected: true,
      accountEmail,
      queries: qr.data.rows || [],
      pages: pr.data.rows || [],
      daily: dr.data.rows || [],
      totals: tr.data.rows?.[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 },
    })
  } catch (e) {
    const status = Number(e.response?.status)
    const apiMessage = String(e.response?.data?.error?.message || e.message || '')
    const permissionIssue = status === 403 && /(permission|access|insufficient)/i.test(apiMessage)
    const mismatchIssue = status === 404 || /not found/i.test(apiMessage)
    const tokenIssue = status === 401 || /invalid_grant|invalid credentials/i.test(apiMessage)
    let errorCode = 'gsc_fetch_failed'
    let error = 'Failed to fetch GSC data. Please try reconnecting Google Search Console.'
    let connected = true

    if (permissionIssue) {
      errorCode = 'property_access'
      error = 'This Google account does not have access to this Search Console property.'
    } else if (mismatchIssue) {
      errorCode = 'site_mismatch'
      error = 'The site URL does not match a property in this Google Search Console account.'
    } else if (tokenIssue) {
      errorCode = 'token_expired'
      error = 'Google Search Console connection expired. Please reconnect.'
      connected = false
    }

    console.error('GSC fetch:', e.response?.data || e.message)
    res.json({ connected, errorCode, error })
  }
})

// Actions
router.get('/:siteId/actions', auth, verifySite, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM actions WHERE site_id=$1 ORDER BY done ASC, created_at ASC', [req.siteId])
  res.json(rows)
})
router.post('/:siteId/actions', auth, verifySite, async (req, res) => {
  const { text, impact } = req.body
  const { rows } = await pool.query('INSERT INTO actions (site_id, text, impact) VALUES ($1,$2,$3) RETURNING *', [req.siteId, text, impact || 'Medium'])
  res.json(rows[0])
})
router.put('/:siteId/actions/:id', auth, verifySite, async (req, res) => {
  const { rows } = await pool.query('UPDATE actions SET done=$1 WHERE id=$2 AND site_id=$3 RETURNING *', [req.body.done, req.params.id, req.siteId])
  res.json(rows[0])
})
router.delete('/:siteId/actions/:id', auth, verifySite, async (req, res) => {
  await pool.query('DELETE FROM actions WHERE id=$1 AND site_id=$2', [req.params.id, req.siteId])
  res.json({ ok: true })
})

// Competitors
router.get('/:siteId/competitors', auth, verifySite, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM competitors WHERE site_id=$1 ORDER BY dr DESC', [req.siteId])
  res.json(rows)
})
router.post('/:siteId/competitors', auth, verifySite, async (req, res) => {
  const { name, dr, notes } = req.body
  const { rows } = await pool.query('INSERT INTO competitors (site_id, name, dr, notes) VALUES ($1,$2,$3,$4) RETURNING *', [req.siteId, name, dr || 0, notes || ''])
  res.json(rows[0])
})
router.delete('/:siteId/competitors/:id', auth, verifySite, async (req, res) => {
  await pool.query('DELETE FROM competitors WHERE id=$1 AND site_id=$2', [req.params.id, req.siteId])
  res.json({ ok: true })
})

module.exports = router
