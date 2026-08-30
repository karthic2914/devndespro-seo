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

// GSC verified properties available to import (excludes already-added projects)
router.get('/gsc-properties', auth, async (req, res) => {
  const axios = require('axios')
  const { getGscAccessToken } = require('../utils/gsc')
  try {
    const { rows: userRows } = await pool.query('SELECT gsc_refresh_token FROM users WHERE id=$1', [req.user.id])
    const refreshToken = userRows[0]?.gsc_refresh_token
    if (!refreshToken) return res.json({ connected: false, properties: [] })

    const accessToken = await getGscAccessToken(refreshToken)
    const { data } = await axios.get('https://www.googleapis.com/webmasters/v3/sites', {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 12000,
    })
    const entries = data?.siteEntry || []
    const properties = entries
      .filter(e => String(e?.permissionLevel || '') !== 'siteUnverifiedUser')
      .map(e => {
        const raw = String(e.siteUrl || '')
        const display = raw.startsWith('sc-domain:')
          ? raw.replace('sc-domain:', '')
          : raw.replace(/^https?:\/\//, '').replace(/\/$/, '')
        return { propertyUrl: raw, displayUrl: display, permissionLevel: e.permissionLevel }
      })

    const { rows: existingSites } = await pool.query(
      `SELECT s.url FROM sites s INNER JOIN site_access sa ON sa.site_id = s.id AND sa.user_id = $1`,
      [req.user.id]
    )
    const existingHosts = new Set(existingSites.map(s => {
      try { return new URL(s.url.startsWith('http') ? s.url : `https://${s.url}`).hostname.replace(/^www\./, '') }
      catch { return s.url }
    }))
    const available = properties.filter(p => !existingHosts.has(p.displayUrl.replace(/^www\./, '')))

    res.json({ connected: true, properties: available })
  } catch (e) {
    console.error('GSC properties fetch failed:', e.response?.data || e.message)
    res.status(500).json({ connected: true, properties: [], error: 'Failed to fetch GSC properties' })
  }
})

// Single site by ID
router.get('/:siteId', auth, verifySite, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT
      s.*,
      m.health AS health,
      m.dr AS dr,
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
  const { sortActions, ensureActionColumns } = require('../utils/actionSync')
  await ensureActionColumns()
  const { rows } = await pool.query('SELECT * FROM actions WHERE site_id=$1', [req.siteId])
  res.json(sortActions(rows))
})

router.post('/:siteId/actions', auth, verifySite, async (req, res) => {
  const { ensureActionColumns } = require('../utils/actionSync')
  await ensureActionColumns()
  const { text, impact, category, why } = req.body
  const { rows } = await pool.query(
    `INSERT INTO actions (site_id, text, impact, source, category, why, priority_score)
     VALUES ($1,$2,$3,'manual',$4,$5,$6) RETURNING *`,
    [
      req.siteId,
      text,
      impact || 'Medium',
      category || 'Custom',
      why || null,
      String(impact).toLowerCase() === 'critical' ? 90
        : String(impact).toLowerCase() === 'high' ? 75
          : String(impact).toLowerCase() === 'low' ? 30
            : 50,
    ]
  )
  res.json(rows[0])
})

function healthDeltaForImpact(impact) {
  const i = String(impact || '').toLowerCase()
  if (i === 'critical') return 6
  if (i === 'high') return 5
  if (i === 'low') return 2
  return 3 // medium / default
}

async function bumpSiteHealth(siteId, delta) {
  if (!delta || delta <= 0) return null

  await pool.query(
    `INSERT INTO seo_metrics (site_id, health)
     VALUES ($1, LEAST(100, GREATEST(0, $2)))
     ON CONFLICT (site_id) DO UPDATE
     SET health = LEAST(100, GREATEST(0, COALESCE(seo_metrics.health, 0) + $2)),
         updated_at = NOW()`,
    [siteId, delta]
  )

  // Keep multipage overview gauge in sync when a completed audit exists
  const { rows: auditRows } = await pool.query(
    `SELECT id, results, site_health_pct
     FROM audit_results
     WHERE site_id=$1 AND status='complete'
     ORDER BY created_at DESC
     LIMIT 1`,
    [siteId]
  )
  if (auditRows[0]) {
    const prev = Number(auditRows[0].site_health_pct) || 0
    const next = Math.min(100, Math.max(0, prev + delta))
    let results = auditRows[0].results
    if (results && typeof results === 'object') {
      results = { ...results, siteHealthPct: next }
    } else if (typeof results === 'string') {
      try {
        const parsed = JSON.parse(results)
        results = { ...parsed, siteHealthPct: next }
      } catch {
        results = { siteHealthPct: next }
      }
    } else {
      results = { siteHealthPct: next }
    }
    await pool.query(
      `UPDATE audit_results
       SET site_health_pct=$1, results=$2, score=GREATEST(COALESCE(score, 0), $1)
       WHERE id=$3`,
      [next, JSON.stringify(results), auditRows[0].id]
    )
  }

  const { rows: m } = await pool.query(
    'SELECT health FROM seo_metrics WHERE site_id=$1 LIMIT 1',
    [siteId]
  )
  return Number(m[0]?.health) || null
}

/** Mark done ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ remove from pending/banner focus and increase site health. */
router.put('/:siteId/actions/:id', auth, verifySite, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'UPDATE actions SET done=$1 WHERE id=$2 AND site_id=$3 RETURNING *',
      [req.body.done, req.params.id, req.siteId]
    )
    const action = rows[0]
    if (!action) return res.status(404).json({ error: 'Action not found' })

    let health = null
    let healthDelta = 0
    if (req.body.done === true || req.body.done === 'true') {
      healthDelta = healthDeltaForImpact(action.impact)
      health = await bumpSiteHealth(req.siteId, healthDelta)
    }

    res.json({ ...action, health, healthDelta })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to update action' })
  }
})

router.delete('/:siteId/actions/:id', auth, verifySite, async (req, res) => {
  await pool.query('DELETE FROM actions WHERE id=$1 AND site_id=$2', [req.params.id, req.siteId])
  res.json({ ok: true })
})

/**
 * Reconcile Action Plan with latest audit:
 * - health = audit score
 * - new issues ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ pending tasks
 * - fixed issues ÃƒÂ¢Ã¢â‚¬Â Ã¢â‚¬â„¢ auto-complete / remove from banner focus
 */
router.post('/:siteId/actions/sync-from-audit', auth, verifySite, async (req, res) => {
  try {
    const { reconcileActionsFromAudit } = require('../utils/actionSync')
    const result = await reconcileActionsFromAudit(req.siteId, {
      afterAudit: true,
      setHealthEvenIfZero: true,
    })
    res.json(result)
  } catch (e) {
    console.error('sync-from-audit error:', e)
    res.status(500).json({ error: 'Failed to sync actions from audit' })
  }
})

// Competitors
function normalizeCompetitorDomain(raw) {
  const value = String(raw || '').trim()
  if (!value) return ''
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`)
    return url.hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return value
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .split('/')[0]
      .toLowerCase()
  }
}

const CRAWL_SKIP_HOSTS = new Set([
  'facebook.com', 'fb.com', 'instagram.com', 'twitter.com', 'x.com', 'linkedin.com',
  'youtube.com', 'youtu.be', 'tiktok.com', 'pinterest.com', 'reddit.com',
  'google.com', 'googleapis.com', 'gstatic.com', 'goo.gl', 'bit.ly',
  'apple.com', 'microsoft.com', 'cloudflare.com', 'cdnjs.com', 'jsdelivr.net',
  'w3.org', 'schema.org', 'wikipedia.org', 'wikimedia.org', 'github.com', 'gitlab.com',
  'npmjs.com', 'unpkg.com', 'fontawesome.com', 'fonts.googleapis.com', 'fonts.gstatic.com',
])

async function discoverCompetitorsFromSiteCrawl(siteUrl, targetDomain) {
  const axios = require('axios')
  const cheerio = require('cheerio')
  const found = new Map()
  try {
    const start = /^https?:\/\//i.test(siteUrl) ? siteUrl : `https://${siteUrl}`
    const { data: html } = await axios.get(start, {
      timeout: 12000,
      maxRedirects: 5,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DevnDesproSEO/1.0)' },
      responseType: 'text',
      validateStatus: (s) => s >= 200 && s < 400,
    })
    const $ = cheerio.load(String(html || ''))
    $('a[href]').each((_, el) => {
      const href = String($(el).attr('href') || '').trim()
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return
      let host = ''
      try {
        host = new URL(href, start).hostname.replace(/^www\./i, '').toLowerCase()
      } catch {
        return
      }
      if (!host || host === targetDomain || host.endsWith(`.${targetDomain}`)) return
      const root = host.split('.').slice(-2).join('.')
      if (CRAWL_SKIP_HOSTS.has(host) || CRAWL_SKIP_HOSTS.has(root)) return
      if (/\.(png|jpg|jpeg|gif|svg|css|js|pdf|zip)$/i.test(host)) return
      const prev = found.get(host) || { name: host, hits: 0 }
      prev.hits += 1
      found.set(host, prev)
    })
  } catch (e) {
    console.warn('Site crawl competitor discovery skipped:', e.message)
  }

  return [...found.values()]
    .sort((a, b) => b.hits - a.hits)
    .slice(0, MAX_AUTO_DISCOVERED_COMPETITORS)
    .map((c) => ({
      name: c.name,
      dr: 0,
      notes: `Suggested from site crawl (${c.hits} outbound link${c.hits === 1 ? '' : 's'})`,
      source: 'crawl',
    }))
}

router.get('/:siteId/competitors', auth, verifySite, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM competitors WHERE site_id=$1 ORDER BY dr DESC', [req.siteId])
  res.json(rows)
})
router.post('/:siteId/competitors', auth, verifySite, async (req, res) => {
  const { ensureCompetitorDetailColumns } = require('../utils/competitorEnrich')
  await ensureCompetitorDetailColumns()

  const domain = normalizeCompetitorDomain(req.body?.name || req.body?.domain || req.body?.url)
  if (!domain) return res.status(400).json({ error: 'Competitor domain is required' })
  const dr = Number(req.body?.dr) || 0
  const notes = String(req.body?.notes || '').trim()
  const url = String(req.body?.url || `https://${domain}`).trim()
  const title = String(req.body?.title || '').trim()
  const summary = String(req.body?.summary || '').trim()
  const industry = String(req.body?.industry || '').trim()
  const location = String(req.body?.location || '').trim()

  const existing = await pool.query(
    `SELECT id FROM competitors
     WHERE site_id=$1 AND lower(btrim(name))=lower(btrim($2))
     LIMIT 1`,
    [req.siteId, domain]
  )
  if (existing.rows[0]) {
    const { rows } = await pool.query(
      `UPDATE competitors
       SET dr=CASE WHEN $3::int > 0 THEN $3 ELSE dr END,
           notes=CASE WHEN $4 <> '' THEN $4 ELSE notes END,
           url=$5,
           title=CASE WHEN $6 <> '' THEN $6 ELSE title END,
           summary=CASE WHEN $7 <> '' THEN $7 ELSE summary END,
           industry=CASE WHEN $8 <> '' THEN $8 ELSE industry END,
           location=CASE WHEN $9 <> '' THEN $9 ELSE location END
       WHERE id=$1 AND site_id=$2
       RETURNING *`,
      [existing.rows[0].id, req.siteId, dr, notes, url, title, summary, industry, location]
    )
    return res.json(rows[0])
  }

  const { rows } = await pool.query(
    `INSERT INTO competitors (site_id, name, dr, notes, url, title, summary, industry, location)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [req.siteId, domain, dr, notes, url, title, summary, industry, location]
  )
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

// Auto-discover SAME-NICHE competitors + basic details (industry, summary, location, DR)
router.post('/:siteId/competitors/auto-discover', auth, verifySite, async (req, res) => {
  const axios = require('axios')
  const {
    ensureCompetitorDetailColumns,
    enrichCompetitorBasics,
    isAutoSourcedCompetitor,
  } = require('../utils/competitorEnrich')

  try {
    await ensureCompetitorDetailColumns()

    const { rows: siteRows } = await pool.query('SELECT name, url, description FROM sites WHERE id=$1', [req.siteId])
    const site = siteRows[0]
    if (!site) return res.status(404).json({ error: 'Site not found' })

    const targetDomain = extractDomain(site.url)
    const prune = req.body?.prune !== false // default: remove weak auto-sourced mismatches
    const { rows: existingRows } = await pool.query('SELECT * FROM competitors WHERE site_id=$1', [req.siteId])

    // Stronger business context from our own homepage if description is thin
    let businessContext = String(site.description || '').trim()
    try {
      const ours = await enrichCompetitorBasics([targetDomain])
      const self = ours[0]
      if (self?.summary || self?.title) {
        businessContext = [
          businessContext,
          self.title ? `Site title: ${self.title}` : '',
          self.summary ? `Site about: ${self.summary}` : '',
        ].filter(Boolean).join('\n')
      }
    } catch { /* optional */ }

    if (!businessContext) {
      businessContext = `Digital agency / web design, web development, and SEO services company (${site.name} / ${targetDomain}). Prefer local or regional agency competitors in the same services niche.`
    }

    let discovered = []
    let source = 'mixed'

    // 1) Ranking-overlap (try NO + US ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â small markets can return empty)
    const authHeader = getDataForSEOAuthSites()
    if (authHeader) {
      for (const locationCode of [2578, 2840]) {
        try {
          const { data } = await axios.post(
            'https://api.dataforseo.com/v3/dataforseo_labs/google/competitors_domain/live',
            [{
              target: targetDomain,
              language_name: 'English',
              location_code: locationCode,
              limit: 12,
              exclude_top_domains: true,
            }],
            { headers: { Authorization: `Basic ${authHeader}`, 'Content-Type': 'application/json' }, timeout: 20000 }
          )
          const items = data?.tasks?.[0]?.result?.[0]?.items || []
          const labs = items
            .filter(item => item?.domain && item.domain.toLowerCase() !== targetDomain.toLowerCase())
            .map(item => {
              const etv = Number(item?.full_domain_metrics?.organic?.etv || item?.metrics?.organic?.etv || 0)
              const keywordCount = Number(item?.full_domain_metrics?.organic?.count || item?.metrics?.organic?.count || 0)
              const estAuthority = Math.max(1, Math.min(100, Math.round(Math.log10(etv + 1) * 18 + Math.log10(keywordCount + 1) * 6)))
              return {
                name: item.domain,
                dr: estAuthority,
                notes: `Ranking overlap: ${keywordCount} shared keywords`,
                source: 'labs',
              }
            })
          if (labs.length) {
            discovered = discovered.concat(labs)
            source = 'dataforseo'
          }
        } catch (e) {
          console.error(`DataForSEO competitors_domain (${locationCode}) failed:`, e.response?.data || e.message)
        }
      }
    }

    // 2) Backlink-profile competitors as WEAK candidates only (often wrong niche)
    try {
      const { fetchBacklinkCompetitors } = require('../utils/dataForSeoBacklinks')
      const bl = await fetchBacklinkCompetitors({ target: targetDomain, limit: 8 })
      for (const item of bl.items || []) {
        discovered.push({
          name: item.domain,
          dr: Math.max(1, Math.min(100, Number(item.rank) || 0)),
          notes: `Backlink overlap: ${item.intersections} shared referring domains`,
          source: 'backlinks',
          weak: true,
        })
      }
    } catch (e) {
      console.warn('Backlink competitors discover skipped:', e.message)
    }

    // NOTE: outbound crawl links are NOT treated as competitors (partners/blogs/tools ÃƒÂ¢Ã¢â‚¬Â°Ã‚Â  rivals)

    // Dedupe
    const byDomain = new Map()
    for (const c of discovered) {
      const key = normalizeCompetitorDomain(c.name)
      if (!key || key === targetDomain) continue
      const prev = byDomain.get(key)
      if (!prev || (!c.weak && prev.weak) || Number(c.dr || 0) > Number(prev.dr || 0)) {
        byDomain.set(key, { ...c, name: key })
      }
    }
    discovered = [...byDomain.values()].slice(0, 14)

    // Enrich candidates with homepage basics before AI judges relevance
    const basicsList = await enrichCompetitorBasics(discovered.map((d) => d.name))
    const basicsMap = new Map(basicsList.map((b) => [b.domain, b]))
    for (const d of discovered) {
      const b = basicsMap.get(d.name)
      if (!b) continue
      d.title = b.title || ''
      d.summary = b.summary || ''
      d.url = b.url || `https://${d.name}`
    }

    // Strict same-niche filter + structured details
    let profiles = []
    try {
      const candidateList = discovered.map((d) => {
        return `- ${d.name}
  source: ${d.source}${d.weak ? ' (weak signal)' : ''}
  title: ${d.title || 'n/a'}
  about: ${d.summary || d.notes || 'n/a'}`
      }).join('\n')

      const relevancePrompt = `You are a market analyst for a LOCAL / REGIONAL digital services company.

OUR BUSINESS
Name: ${site.name}
Website: ${site.url}
What we do (must match competitors to this niche):
${businessContext}

Task: From the candidates below, keep ONLY genuine direct or close competitors ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â companies that sell the SAME core services to similar customers (e.g. web design, web development, SEO / digital marketing agencies).

EXCLUDE:
- Blogs, personal sites, SaaS tools, directories, job boards, news sites
- Unrelated industries that only share a few keywords or backlinks
- Global mega-brands / platforms
- Weak-signal backlink-only overlaps that are not agencies in our niche
If unsure, EXCLUDE.

For each KEEP, return basic details.

Return ONLY valid JSON:
{
  "competitors": [
    {
      "domain": "example.com",
      "industry": "Web design & SEO agency",
      "summary": "One sentence: what they sell / who they serve",
      "location": "City/Country if known, else empty string",
      "reason": "Why they compete with us",
      "dr": 0
    }
  ]
}

Candidates:
${candidateList || '(none ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â invent up to ${MAX_AUTO_DISCOVERED_COMPETITORS} real niche competitors instead)'}`

      const r = await anthropic.messages.create({
        model: 'claude-sonnet-5',
        max_tokens: 1800,
        messages: [{ role: 'user', content: relevancePrompt }],
      })
      const text = r.content?.[0]?.text?.trim() || '{}'
      const jsonStart = text.indexOf('{')
      const jsonEnd = text.lastIndexOf('}')
      let parsed = { competitors: [] }
      try {
        parsed = JSON.parse(jsonStart >= 0 ? text.slice(jsonStart, jsonEnd + 1) : text)
      } catch (parseErr) {
        console.error('Competitor profile JSON parse failed:', parseErr.message, '| raw:', text)
      }
      profiles = (Array.isArray(parsed.competitors) ? parsed.competitors : [])
        .map((c) => {
          const name = normalizeCompetitorDomain(c?.domain)
          if (!name || name === targetDomain) return null
          const prior = byDomain.get(name) || {}
          return {
            name,
            dr: Number(c.dr) > 0 ? Number(c.dr) : Number(prior.dr || 0),
            title: prior.title || '',
            summary: String(c.summary || prior.summary || '').trim().slice(0, 280),
            industry: String(c.industry || '').trim().slice(0, 120),
            location: String(c.location || '').trim().slice(0, 120),
            notes: `Same niche: ${String(c.reason || '').trim()}`.slice(0, 280),
            url: prior.url || `https://${name}`,
            source: prior.source || 'ai',
          }
        })
        .filter(Boolean)
        .slice(0, MAX_AUTO_DISCOVERED_COMPETITORS)
      if (profiles.length) source = discovered.length ? 'filtered' : 'ai'
    } catch (e) {
      console.error('Competitor niche filter failed:', e.message)
    }

    // AI-only fallback with full details if nothing passed the filter
    if (!profiles.length) {
      source = 'ai'
      try {
        const prompt = `You are a market research analyst.
Business: ${site.name} (${site.url})
What they do:
${businessContext}

List up to ${MAX_AUTO_DISCOVERED_COMPETITORS} REAL direct competitors in the SAME niche (web design / web development / SEO / digital agencies serving similar markets). Prefer real company domains.

Return ONLY valid JSON:
{
  "competitors": [
    {
      "domain": "example.com",
      "industry": "Web design & development agency",
      "summary": "One sentence about services",
      "location": "City, Country",
      "reason": "Why they compete",
      "dr": 0
    }
  ]
}`
        const r = await anthropic.messages.create({
          model: 'claude-sonnet-5',
          max_tokens: 1200,
          messages: [{ role: 'user', content: prompt }],
        })
        const text = r.content?.[0]?.text?.trim() || '{}'
        const jsonStart = text.indexOf('{')
        const jsonEnd = text.lastIndexOf('}')
        let parsed = { competitors: [] }
        try {
          parsed = JSON.parse(jsonStart >= 0 ? text.slice(jsonStart, jsonEnd + 1) : text)
        } catch { parsed = { competitors: [] } }

        profiles = (Array.isArray(parsed.competitors) ? parsed.competitors : [])
          .map((c) => ({
            name: normalizeCompetitorDomain(c?.domain),
            dr: Number(c.dr) || 0,
            title: '',
            summary: String(c.summary || '').trim().slice(0, 280),
            industry: String(c.industry || '').trim().slice(0, 120),
            location: String(c.location || '').trim().slice(0, 120),
            notes: `AI-suggested: ${String(c.reason || '').trim()}`.slice(0, 280),
            url: `https://${normalizeCompetitorDomain(c?.domain)}`,
            source: 'ai',
          }))
          .filter((c) => c.name && c.name !== targetDomain)
          .slice(0, MAX_AUTO_DISCOVERED_COMPETITORS)

        // Fill missing summaries from live pages
        const extraBasics = await enrichCompetitorBasics(profiles.map((p) => p.name))
        const em = new Map(extraBasics.map((b) => [b.domain, b]))
        for (const p of profiles) {
          const b = em.get(p.name)
          if (!b) continue
          if (!p.summary && b.summary) p.summary = b.summary
          if (!p.title && b.title) p.title = b.title
        }
      } catch (e) {
        console.error('AI competitor fallback failed:', e.message)
      }
    }

    // Last resort: keep top candidates (including weak) so Auto-fill never returns empty
    if (!profiles.length && discovered.length) {
      source = 'labs-fallback'
      profiles = discovered.slice(0, MAX_AUTO_DISCOVERED_COMPETITORS).map((d) => ({
        name: d.name,
        dr: Number(d.dr || 0),
        title: d.title || '',
        summary: d.summary || 'Competitor candidate from search/backlink data ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â verify niche fit',
        industry: 'Digital / marketing related (verify)',
        location: '',
        notes: `Auto-fill fallback: ${d.notes || d.source || ''}`.slice(0, 280),
        url: d.url || `https://${d.name}`,
        source: d.source || 'fallback',
      }))
    }

    // Absolute last resort: invent plausible same-niche agencies via short AI prompt
    if (!profiles.length) {
      source = 'ai-seed'
      try {
        const prompt = `Return ONLY JSON with up to ${MAX_AUTO_DISCOVERED_COMPETITORS} real web design / web development / SEO agency competitor domains for a company like ${site.name} (${targetDomain}), preferably Norway/Scandinavia/Europe if relevant.
{"competitors":[{"domain":"x.com","industry":"Web design & SEO agency","summary":"...","location":"...","reason":"..."}]}`
        const r = await anthropic.messages.create({
          model: 'claude-sonnet-5',
          max_tokens: 900,
          messages: [{ role: 'user', content: prompt }],
        })
        const text = r.content?.[0]?.text?.trim() || '{}'
        const jsonStart = text.indexOf('{')
        const jsonEnd = text.lastIndexOf('}')
        const parsed = JSON.parse(jsonStart >= 0 ? text.slice(jsonStart, jsonEnd + 1) : text)
        profiles = (Array.isArray(parsed.competitors) ? parsed.competitors : [])
          .map((c) => ({
            name: normalizeCompetitorDomain(c?.domain),
            dr: 0,
            title: '',
            summary: String(c.summary || '').trim().slice(0, 280),
            industry: String(c.industry || 'Web design & SEO agency').trim().slice(0, 120),
            location: String(c.location || '').trim().slice(0, 120),
            notes: `AI-suggested: ${String(c.reason || '').trim()}`.slice(0, 280),
            url: `https://${normalizeCompetitorDomain(c?.domain)}`,
            source: 'ai',
          }))
          .filter((c) => c.name && c.name !== targetDomain)
          .slice(0, MAX_AUTO_DISCOVERED_COMPETITORS)
      } catch (e) {
        console.error('AI seed competitors failed:', e.message)
      }
    }

    // Never wipe the list if we failed to find replacements
    let pruned = 0
    if (prune && profiles.length > 0) {
      for (const row of existingRows) {
        if (!isAutoSourcedCompetitor(row)) continue
        const keep = profiles.some((p) => p.name === normalizeCompetitorDomain(row.name))
        if (!keep) {
          await pool.query('DELETE FROM competitors WHERE id=$1 AND site_id=$2', [row.id, req.siteId])
          pruned += 1
        }
      }
    } else if (prune && !profiles.length) {
      console.warn('Auto-discover: skipping prune because no replacement competitors were found')
    }

    const { rows: afterPrune } = await pool.query('SELECT name FROM competitors WHERE site_id=$1', [req.siteId])
    const existingDomains = new Set(afterPrune.map((r) => String(r.name || '').toLowerCase().trim()))

    let inserted = 0
    let updated = 0
    const insertErrors = []
    for (const c of profiles) {
      if (!c?.name) continue
      try {
        if (existingDomains.has(c.name.toLowerCase())) {
          await pool.query(
            `UPDATE competitors
             SET dr=CASE WHEN $3::int > 0 THEN $3 ELSE dr END,
                 notes=$4,
                 url=$5,
                 title=COALESCE(NULLIF($6,''), title),
                 summary=COALESCE(NULLIF($7,''), summary),
                 industry=COALESCE(NULLIF($8,''), industry),
                 location=COALESCE(NULLIF($9,''), location)
             WHERE site_id=$1 AND lower(btrim(name))=lower(btrim($2))`,
            [req.siteId, c.name, c.dr || 0, c.notes || '', c.url || `https://${c.name}`, c.title || '', c.summary || '', c.industry || '', c.location || '']
          )
          updated += 1
        } else {
          await pool.query(
            `INSERT INTO competitors (site_id, name, dr, notes, url, title, summary, industry, location)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [req.siteId, c.name, c.dr || 0, c.notes || '', c.url || `https://${c.name}`, c.title || '', c.summary || '', c.industry || '', c.location || '']
          )
          existingDomains.add(c.name.toLowerCase())
          inserted += 1
        }
      } catch (e) {
        insertErrors.push(`${c.name}: ${e.message}`)
        console.error('Competitor upsert failed:', c.name, e.message)
      }
    }

    const { rows: allRows } = await pool.query(
      'SELECT * FROM competitors WHERE site_id=$1 ORDER BY dr DESC, name ASC',
      [req.siteId]
    )

    if (!allRows.length) {
      return res.status(422).json({
        inserted: 0,
        updated: 0,
        pruned: 0,
        competitors: [],
        errors: insertErrors,
        error: 'No competitors could be saved. Add a Business description on Competitors, or type domains manually in C1.',
        tip: 'Example: Web design, web development and SEO agency for businesses in Norway / Scandinavia.',
      })
    }

    res.json({
      inserted,
      updated,
      pruned,
      skipped: Math.max(0, profiles.length - inserted - updated),
      source,
      competitors: allRows,
      errors: insertErrors.length ? insertErrors : undefined,
      tip: !String(site.description || '').trim()
        ? 'Add a Business description on Competitors for even better niche matching.'
        : undefined,
    })
  } catch (e) {
    console.error('Auto-discover competitors failed:', e.response?.data || e.message)
    res.status(500).json({ error: e.message || 'Could not auto-discover competitors' })
  }
})

// Enrich saved competitors with title / summary / industry basics
router.post('/:siteId/competitors/enrich', auth, verifySite, async (req, res) => {
  const {
    ensureCompetitorDetailColumns,
    enrichCompetitorBasics,
  } = require('../utils/competitorEnrich')
  try {
    await ensureCompetitorDetailColumns()
    const { rows } = await pool.query(
      'SELECT * FROM competitors WHERE site_id=$1 ORDER BY dr DESC LIMIT 12',
      [req.siteId]
    )
    if (!rows.length) return res.json({ updated: 0, competitors: [] })

    const basics = await enrichCompetitorBasics(rows.map((r) => r.name))
    const map = new Map(basics.map((b) => [b.domain, b]))
    let updated = 0
    for (const row of rows) {
      const b = map.get(normalizeCompetitorDomain(row.name))
      if (!b) continue
      const title = b.title || row.title || ''
      const summary = row.summary || b.summary || ''
      await pool.query(
        `UPDATE competitors SET title=$1, summary=CASE WHEN COALESCE(summary,'')='' THEN $2 ELSE summary END, url=$3
         WHERE id=$4 AND site_id=$5`,
        [title, summary, b.url || row.url || `https://${row.name}`, row.id, req.siteId]
      )
      updated += 1
    }
    const { rows: all } = await pool.query(
      'SELECT * FROM competitors WHERE site_id=$1 ORDER BY dr DESC',
      [req.siteId]
    )
    res.json({ updated, competitors: all })
  } catch (e) {
    console.error('Competitor enrich failed:', e.message)
    res.status(500).json({ error: 'Could not enrich competitors' })
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
