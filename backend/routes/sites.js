const express = require('express')
const { pool, anthropic } = require('../clients')
const { auth, verifySite } = require('../middleware')
const { normalizeAndVerifyWebsite, extractDomain } = require('../utils/helpers')
const { ensureSiteIsVerifiedInGsc } = require('../utils/gsc')

const router = express.Router()

function isInternalProject(name, url) {
  const safeName = String(name || '').toLowerCase()
  const safeUrl = String(url || '').toLowerCase()
  if (safeName.includes('devndespro')) return true
  if (safeUrl.includes('devndespro.com')) return true
  return false
}

// Sites
router.get('/', auth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT
      s.*,
      m.health AS health,
      m.ai_snippet_score,
        m.aeo_score,
        m.chatgpt_cited,
        m.claude_cited,
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

// Summary stats across all user's sites
router.get('/summary', auth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT
      COALESCE(MAX(m.dr), 0) AS max_dr,
      COALESCE(SUM(k.kcount), 0) AS total_keywords,
      COALESCE(SUM(b.bcount), 0) AS total_backlinks,
      COUNT(s.id) AS total_sites,
      BOOL_OR(u.gsc_refresh_token IS NOT NULL) AS gsc_connected,
      COALESCE(AVG(m.health), 0) AS avg_health,
      COALESCE(AVG(m.ai_snippet_score), 0) AS avg_ai_snippet,
      COALESCE(AVG(m.aeo_score), 0) AS avg_aeo
    FROM sites s
    INNER JOIN site_access sa ON sa.site_id = s.id AND sa.user_id = $1
    LEFT JOIN seo_metrics m ON m.site_id = s.id
    LEFT JOIN (SELECT site_id, COUNT(*)::int AS kcount FROM keywords GROUP BY site_id) k ON k.site_id = s.id
    LEFT JOIN (SELECT site_id, COUNT(*)::int AS bcount FROM backlinks GROUP BY site_id) b ON b.site_id = s.id
    LEFT JOIN users u ON u.id = $1`,
    [req.user.id]
  )
  const summary = rows[0]

  const checklist = [
    { done: Boolean(summary.gsc_connected),              label: 'Google Search Console connected' },
    { done: Number(summary.total_sites) > 0,             label: 'First project added' },
    { done: Number(summary.total_keywords) > 0,          label: 'Keywords tracked' },
    { done: Number(summary.total_backlinks) > 0,         label: 'Backlinks recorded' },
    { done: Number(summary.avg_health) >= 60,            label: 'Site health above 60' },
    { done: Number(summary.avg_ai_snippet) >= 70,        label: 'AI Snippet score above 70' },
    { done: Number(summary.avg_aeo) >= 50,               label: 'AEO score above 50' },
  ]

  const actions = []
  if (!summary.gsc_connected)
    actions.push({ title: 'Connect Google Search Console', desc: 'Link GSC to start tracking impressions, clicks and keyword positions.', impact: 'High', eta: '5 min' })
  if (Number(summary.total_keywords) === 0)
    actions.push({ title: 'Add Target Keywords', desc: 'Research and add keywords you want to rank for in each project.', impact: 'High', eta: '30 min' })
  if (Number(summary.total_backlinks) === 0)
    actions.push({ title: 'Start Link Building', desc: 'Add backlink targets and begin outreach to niche-relevant domains.', impact: 'High', eta: '2 days' })
  if (Number(summary.avg_health) < 80)
    actions.push({ title: 'Fix Site Health Issues', desc: 'Run a site audit and resolve critical on-page issues dragging health below 80.', impact: 'Medium', eta: '1 day' })
  if (Number(summary.avg_ai_snippet) < 70)
    actions.push({ title: 'Improve AI Snippet Score', desc: 'Re-run site audits and fix AI snippet issues to boost visibility in ChatGPT and AI search.', impact: 'High', eta: '2-3 days' })
  actions.push({ title: 'Publish SEO Content', desc: 'Publish a 1,500+ word post targeting a low-difficulty keyword cluster.', impact: 'High', eta: '3 days' })

  res.json({
    max_dr: Number(summary.max_dr),
    avg_ai_snippet: Number(summary.avg_ai_snippet),
    avg_aeo: Number(summary.avg_aeo),
    total_keywords: Number(summary.total_keywords),
    total_backlinks: Number(summary.total_backlinks),
    total_sites: Number(summary.total_sites),
    gsc_connected: Boolean(summary.gsc_connected),
    checklist,
    actions: actions.slice(0, 4),
  })
})

// Single site by ID
router.get('/:siteId', auth, verifySite, async (req, res) => {
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
    WHERE s.id = $2`,
    [req.user.id, req.siteId]
  )
  if (!rows[0]) return res.status(404).json({ error: 'Site not found' })
  res.json(rows[0])
})

// Update a project's business description (used for AI competitor relevance, AI keyword suggestions, etc.)
router.patch('/:siteId/description', auth, verifySite, async (req, res) => {
  const description = String(req.body?.description || '').trim().slice(0, 1000)
  const { rows } = await pool.query(
    'UPDATE sites SET description=$1 WHERE id=$2 RETURNING *',
    [description, req.siteId]
  )
  if (!rows[0]) return res.status(404).json({ error: 'Site not found' })
  res.json(rows[0])
})

router.post('/', auth, async (req, res) => {
  const { name, url, contactEmail, notifyAdmin } = req.body
  if (!name || !url) return res.status(400).json({ error: 'name and url required' })
  if (!String(name).trim()) return res.status(400).json({ error: 'Project name is required' })
  try {
    const isAdmin = req.user.id === 1
    const { rows: userRows } = await pool.query('SELECT is_paid FROM users WHERE id=$1', [req.user.id])
    const isPaid = Boolean(userRows[0]?.is_paid)
    if (!isAdmin && !isPaid) {
      const { rows: countRows } = await pool.query(
        'SELECT COUNT(*)::int AS count FROM sites s INNER JOIN site_access sa ON sa.site_id = s.id WHERE sa.user_id = $1',
        [req.user.id]
      )
      if (countRows[0].count >= 1) {
        return res.status(403).json({ error: 'Free plan allows 1 project. Upgrade to add more.', locked: true })
      }
    }
    const verifiedUrl = await normalizeAndVerifyWebsite(url)
    await ensureSiteIsVerifiedInGsc(req.user.id, verifiedUrl)
    const { rows } = await pool.query(
      'INSERT INTO sites (user_id, name, url, status) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.user.id, String(name).trim(), verifiedUrl, isAdmin ? 'approved' : 'pending']
    )
    await pool.query('INSERT INTO seo_metrics (site_id) VALUES ($1)', [rows[0].id])
    await pool.query('INSERT INTO site_access (site_id, user_id) VALUES ($1,$2)', [rows[0].id, req.user.id])

    if (!isInternalProject(rows[0].name, rows[0].url)) {
      const { rows: prospectRows } = await pool.query(
        `INSERT INTO cold_email_prospects (site_id, name, website, status, sent_at)
         VALUES ($1, $2, $3, 'draft', NULL)
         RETURNING id`,
        [rows[0].id, String(rows[0].name).trim(), rows[0].url]
      )
      if (contactEmail && String(contactEmail).trim()) {
        await pool.query(
          `UPDATE cold_email_prospects SET email=$1 WHERE id=$2`,
          [String(contactEmail).trim(), prospectRows[0].id]
        )
      }
    }

    let shouldNotify = true
    if (notifyAdmin === false) {
      shouldNotify = false
    } else {
      const { getSetting } = require('../utils/settings')
      shouldNotify = await getSetting('notify_on_new_site', true)
    }
    if (shouldNotify) {
      const axios = require('axios')
      axios.post(
        'https://api.zeptomail.com/v1.1/email',
        {
          from: { address: 'noreply@devndespro.com', name: 'DevNdesPro SEO' },
          to: [{ email_address: { address: 'karthic2914@gmail.com' } }],
          subject: `New project added: ${rows[0].name}`,
          htmlbody: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
              <h2 style="color:#E66A39;margin:0 0 16px">New Project Added ?</h2>
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
    }

    res.json(rows[0])
  } catch (e) {
    const message = String(e?.message || 'Website verification failed')
    const statusFromMessage = Number((message.match(/\b(5\d{2})\b/) || [])[1] || 0)
    if (statusFromMessage >= 500) {
      return res.status(503).json({ error: message })
    }
    res.status(400).json({ error: message })
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
  const { getGscAccessToken, resolveGscPropertyUrl } = require('../utils/gsc')
  try {
    const { rows: u } = await pool.query('SELECT email, gsc_refresh_token FROM users WHERE id=$1', [req.user.id])
    const accountEmail = u[0]?.email || null
    if (!u[0]?.gsc_refresh_token) return res.json({ connected: false, accountEmail })
    const { rows: s } = await pool.query('SELECT url FROM sites WHERE id=$1', [req.siteId])
    const rawSiteUrl = s[0].url
    const accessToken = await getGscAccessToken(u[0].gsc_refresh_token)
    const siteUrl = await resolveGscPropertyUrl(accessToken, rawSiteUrl)
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

function getDataForSEOAuthSites() {
  const login = process.env.DATAFORSEO_LOGIN
  const password = process.env.DATAFORSEO_PASSWORD
  if (!login || !password) return null
  return Buffer.from(`${login}:${password}`).toString('base64')
}

// Auto-discover competitors: real ranking-overlap data from DataForSEO first, AI suggestions as fallback
router.post('/:siteId/competitors/auto-discover', auth, verifySite, async (req, res) => {
  const axios = require('axios')
  try {
    const { rows: siteRows } = await pool.query('SELECT name, url FROM sites WHERE id=$1', [req.siteId])
    const site = siteRows[0]
    if (!site) return res.status(404).json({ error: 'Site not found' })

    const targetDomain = extractDomain(site.url)
    const { rows: existingRows } = await pool.query('SELECT name FROM competitors WHERE site_id=$1', [req.siteId])
    const existingDomains = new Set(existingRows.map(r => String(r.name || '').toLowerCase().trim()))

    let discovered = []
    let source = 'dataforseo'

    const authHeader = getDataForSEOAuthSites()
    if (authHeader) {
      try {
        const { data } = await axios.post(
          'https://api.dataforseo.com/v3/dataforseo_labs/google/competitors_domain/live',
          [{
            target: targetDomain,
            language_name: 'English',
            location_code: 2840,
            limit: 8,
            exclude_top_domains: true,
          }],
          { headers: { Authorization: `Basic ${authHeader}`, 'Content-Type': 'application/json' }, timeout: 20000 }
        )
        const items = data?.tasks?.[0]?.result?.[0]?.items || []
        discovered = items
          .filter(item => item?.domain && item.domain.toLowerCase() !== targetDomain.toLowerCase())
          .map(item => {
            const etv = Number(item?.full_domain_metrics?.organic?.etv || item?.metrics?.organic?.etv || 0)
            const keywordCount = Number(item?.full_domain_metrics?.organic?.count || item?.metrics?.organic?.count || 0)
            const estAuthority = Math.max(1, Math.min(100, Math.round(Math.log10(etv + 1) * 18 + Math.log10(keywordCount + 1) * 6)))
            return {
              name: item.domain,
              dr: estAuthority,
              notes: `Auto-discovered (DataForSEO): ${keywordCount} shared ranking keywords, est. traffic value ${Math.round(etv)}`,
            }
          })
      } catch (e) {
        console.error('DataForSEO competitors_domain failed:', e.response?.data || e.message)
      }
    }

    if (!discovered.length) {
      source = 'ai'
      try {
        const prompt = `You are an SEO/market research analyst.
Business name: ${site.name}
Website: ${site.url}

List up to 6 real, plausible direct competitors for this business (same industry/niche). For each, give just the competitor's domain name (e.g. "example.com") and one short reason it competes.

Return ONLY valid JSON:
{ "competitors": [ { "domain": "...", "reason": "..." } ] }`

        const r = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 700,
          messages: [{ role: 'user', content: prompt }],
        })
        const text = r.content?.[0]?.text?.trim() || '{}'
        const jsonStart = text.indexOf('{')
        const jsonEnd = text.lastIndexOf('}')
        let parsed = { competitors: [] }
        try { parsed = JSON.parse(jsonStart >= 0 ? text.slice(jsonStart, jsonEnd + 1) : text) } catch { parsed = { competitors: [] } }

        discovered = (Array.isArray(parsed.competitors) ? parsed.competitors : [])
          .map(c => ({
            name: String(c?.domain || '').trim(),
            dr: 0,
            notes: `AI-suggested (no live ranking data available): ${String(c?.reason || '').trim()}`,
          }))
          .filter(c => c.name)
      } catch (e) {
        console.error('AI competitor fallback failed:', e.message)
      }
    }

    const toInsert = discovered.filter(c => c.name && !existingDomains.has(c.name.toLowerCase()))
    let inserted = 0
    for (const c of toInsert) {
      await pool.query(
        'INSERT INTO competitors (site_id, name, dr, notes) VALUES ($1,$2,$3,$4)',
        [req.siteId, c.name, c.dr, c.notes]
      )
      existingDomains.add(c.name.toLowerCase())
      inserted++
    }

    const { rows: allRows } = await pool.query('SELECT * FROM competitors WHERE site_id=$1 ORDER BY dr DESC', [req.siteId])
    res.json({ inserted, skipped: discovered.length - inserted, source, competitors: allRows })
  } catch (e) {
    console.error('Auto-discover competitors failed:', e.response?.data || e.message)
    res.status(500).json({ error: 'Could not auto-discover competitors' })
  }
})

router.patch('/:siteId/ai-cron', auth, verifySite, async (req, res) => {
  const { enabled } = req.body
  await pool.query('UPDATE sites SET enable_ai_cron = $1 WHERE id = $2', [!!enabled, req.siteId])
  res.json({ success: true, enable_ai_cron: !!enabled })
})

// Admin: approve a pending project
router.patch('/:siteId/approve', auth, verifySite, async (req, res) => {
  if (req.user.id !== 1) return res.status(403).json({ error: 'Admin only' })
  const { rows } = await pool.query(
    "UPDATE sites SET status='approved' WHERE id=$1 RETURNING *",
    [req.siteId]
  )
  if (!rows[0]) return res.status(404).json({ error: 'Site not found' })
  res.json(rows[0])
})

// Admin: list pending projects awaiting approval
router.get('/pending/all', auth, async (req, res) => {
  if (req.user.id !== 1) return res.status(403).json({ error: 'Admin only' })
  const { rows } = await pool.query(
    `SELECT s.*, u.email AS owner_email, u.name AS owner_name
     FROM sites s
     LEFT JOIN users u ON u.id = s.user_id
     WHERE s.status = 'pending'
     ORDER BY s.created_at ASC`
  )
  res.json(rows)
})

module.exports = router
