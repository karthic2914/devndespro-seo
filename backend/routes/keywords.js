const express = require('express')
const axios = require('axios')
const { pool, anthropic } = require('../clients')
const { auth, verifySite } = require('../middleware')
const { normalizeEngine, extractDomain, isDomainMatch, SUPPORTED_ENGINES, buildHeuristicKeywordSuggestions } = require('../utils/helpers')
const { fetchSerpResults, scanSiteKeywordTransitions } = require('../utils/serp')
const { sendRankScanReportEmail } = require('../utils/email')

const router = express.Router()

function buildRankSummaryAlertMessage(report) {
  if (!report) return 'Weekly rank scan completed.'
  const parts = (report.engines || []).map((e) => `${e.label}: ${e.inFirstPageCount}/${e.checked} on page 1`)
  return `Weekly rank scan completed for ${report.siteName}. ${parts.join(' | ')}.`
}

function getDataForSEOAuth() {
  const login = process.env.DATAFORSEO_LOGIN
  const password = process.env.DATAFORSEO_PASSWORD
  if (!login || !password) return null
  return Buffer.from(`${login}:${password}`).toString('base64')
}

router.get('/:siteId/keywords', auth, verifySite, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM keywords WHERE site_id=$1 ORDER BY created_at ASC', [req.siteId])
  res.json(rows)
})

router.post('/:siteId/keywords', auth, verifySite, async (req, res) => {
  const { keyword, volume, difficulty, position } = req.body
  const { rows } = await pool.query(
    'INSERT INTO keywords (site_id, keyword, volume, difficulty, position) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [req.siteId, keyword, volume || 0, difficulty || 'Easy', position || null]
  )
  res.json(rows[0])
})

router.put('/:siteId/keywords/:id', auth, verifySite, async (req, res) => {
  const { rows } = await pool.query(
    'UPDATE keywords SET position=$1 WHERE id=$2 AND site_id=$3 RETURNING *',
    [req.body.position, req.params.id, req.siteId]
  )
  res.json(rows[0])
})

router.delete('/:siteId/keywords/:id', auth, verifySite, async (req, res) => {
  await pool.query('DELETE FROM keywords WHERE id=$1 AND site_id=$2', [req.params.id, req.siteId])
  res.json({ ok: true })
})

// DataForSEO keyword suggestions with real volume + difficulty
router.post('/:siteId/keywords/dataforseo-suggest', auth, verifySite, async (req, res) => {
  const { keyword } = req.body
  if (!keyword) return res.status(400).json({ error: 'keyword required' })

  const authHeader = getDataForSEOAuth()
  if (!authHeader) return res.status(500).json({ error: 'DataForSEO not configured' })

  try {
    const { data } = await axios.post(
      'https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_suggestions/live',
      [{
        keyword,
        language_name: 'English',
        location_code: 2840,
        limit: 10,
        include_serp_info: false,
        include_seed_keyword: true,
      }],
      {
        headers: { 'Authorization': `Basic ${authHeader}`, 'Content-Type': 'application/json' },
        timeout: 15000,
      }
    )

    const items = data?.tasks?.[0]?.result?.[0]?.items || []
    const suggestions = items.map(item => ({
      keyword: item.keyword,
      volume: item.keyword_info?.search_volume || 0,
      difficulty: item.keyword_properties?.keyword_difficulty
        ? item.keyword_properties.keyword_difficulty < 33 ? 'Easy'
          : item.keyword_properties.keyword_difficulty < 66 ? 'Medium' : 'Hard'
        : 'Medium',
      difficultyScore: item.keyword_properties?.keyword_difficulty || 0,
      cpc: item.keyword_info?.cpc || 0,
      competition: item.keyword_info?.competition || 0,
      trend: (item.keyword_info?.monthly_searches || []).slice(-6).map(m => m.search_volume),
    }))

    res.json({ suggestions, source: 'dataforseo' })
  } catch (e) {
    console.error('DataForSEO suggest error:', e.response?.data || e.message)
    res.status(500).json({ error: 'DataForSEO request failed' })
  }
})

// Enrich existing keywords with real volume from DataForSEO
router.post('/:siteId/keywords/enrich', auth, verifySite, async (req, res) => {
  const authHeader = getDataForSEOAuth()
  if (!authHeader) return res.status(500).json({ error: 'DataForSEO not configured' })

  try {
    const { rows: keywords } = await pool.query(
      'SELECT id, keyword FROM keywords WHERE site_id=$1 AND (volume IS NULL OR volume=0) LIMIT 10',
      [req.siteId]
    )
    if (!keywords.length) return res.json({ enriched: 0, message: 'All keywords already have volume data' })

    const { data } = await axios.post(
      'https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live',
      [{ keywords: keywords.map(k => k.keyword), language_name: 'English', location_code: 2840 }],
      {
        headers: { 'Authorization': `Basic ${authHeader}`, 'Content-Type': 'application/json' },
        timeout: 15000,
      }
    )

    const results = data?.tasks?.[0]?.result || []
    let enriched = 0
    for (const r of results) {
      const kw = keywords.find(k => k.keyword.toLowerCase() === r.keyword?.toLowerCase())
      if (kw && r.search_volume != null) {
        const diff = r.competition_index != null
          ? r.competition_index < 33 ? 'Easy' : r.competition_index < 66 ? 'Medium' : 'Hard'
          : 'Medium'
        await pool.query(
          'UPDATE keywords SET volume=$1, difficulty=$2 WHERE id=$3',
          [r.search_volume, diff, kw.id]
        )
        enriched++
      }
    }
    res.json({ enriched })
  } catch (e) {
    console.error('Enrich error:', e.response?.data || e.message)
    res.status(500).json({ error: 'Enrichment failed' })
  }
})

// AI keyword suggestions
router.post('/:siteId/keywords/ai-suggest', auth, verifySite, async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.body?.limit || 12), 3), 25)
    const [siteR, kR, cR] = await Promise.all([
      pool.query('SELECT name, url FROM sites WHERE id=$1 LIMIT 1', [req.siteId]),
      pool.query('SELECT keyword, position, difficulty FROM keywords WHERE site_id=$1 ORDER BY created_at ASC LIMIT 60', [req.siteId]),
      pool.query('SELECT name, url, dr FROM competitors WHERE site_id=$1 ORDER BY dr DESC LIMIT 20', [req.siteId]),
    ])
    const site = siteR.rows[0]
    if (!site) return res.status(404).json({ error: 'Site not found' })

    const existingKeywords = kR.rows.map(k => `${k.keyword} (pos ${k.position || '?'}, ${k.difficulty || 'Unknown'})`).join(', ') || 'none'
    const competitorHints = cR.rows.map(c => `${c.name}${c.url ? ` (${c.url})` : ''}${c.dr ? ` DR ${c.dr}` : ''}`).join(', ') || 'none'

    const prompt = `You are an expert SEO strategist.
Generate high-opportunity keyword ideas for this business.

Business: ${site.name}
Website: ${site.url}
Existing keywords: ${existingKeywords}
Competitors: ${competitorHints}

Rules:
- Return ${limit} keywords
- Avoid duplicates and avoid exact matches from existing keywords
- Focus on realistic opportunities (mix of quick wins + strategic terms)
- Include short-tail and long-tail keywords

Return ONLY valid JSON:
{
  "suggestions": [
    {
      "keyword": "...",
      "intent": "Informational|Commercial|Transactional|Navigational",
      "difficulty": "Easy|Medium|Hard",
      "estimatedVolume": 0,
      "why": "short reason why this is a good target"
    }
  ]
}`

    const existingSet = new Set(kR.rows.map(k => String(k.keyword || '').toLowerCase().trim()))
    let cleaned = []

    try {
      const r = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1400,
        messages: [{ role: 'user', content: prompt }],
      })
      const text = r.content?.[0]?.text?.trim() || '{}'
      const jsonStart = text.indexOf('{')
      const jsonEnd = text.lastIndexOf('}')
      let parsed = { suggestions: [] }
      try { parsed = JSON.parse(jsonStart >= 0 ? text.slice(jsonStart, jsonEnd + 1) : text) }
      catch { parsed = { suggestions: [] } }

      cleaned = (Array.isArray(parsed.suggestions) ? parsed.suggestions : [])
        .map(s => ({
          keyword: String(s?.keyword || '').trim(),
          intent: ['Informational', 'Commercial', 'Transactional', 'Navigational'].includes(String(s?.intent || '')) ? s.intent : 'Informational',
          difficulty: ['Easy', 'Medium', 'Hard'].includes(String(s?.difficulty || '')) ? s.difficulty : 'Medium',
          estimatedVolume: Math.max(0, parseInt(s?.estimatedVolume || 0) || 0),
          why: String(s?.why || '').trim(),
        }))
        .filter(s => s.keyword)
        .filter(s => !existingSet.has(s.keyword.toLowerCase()))
        .slice(0, limit)
    } catch (e) {
      console.error('AI keyword suggest upstream failed:', e.message)
    }

    if (cleaned.length === 0) {
      cleaned = buildHeuristicKeywordSuggestions({ siteName: site.name, siteUrl: site.url, existingSet, limit })
      return res.json({ suggestions: cleaned, source: 'fallback' })
    }
    res.json({ suggestions: cleaned, source: 'ai' })
  } catch (e) {
    console.error('AI keyword suggest failed:', e)
    res.status(500).json({ error: 'AI keyword suggestion failed' })
  }
})

router.post('/:siteId/keywords/first-page-status', auth, verifySite, async (req, res) => {
  const engine = normalizeEngine(req.body?.engine)
  const limit = Math.min(Math.max(parseInt(req.body?.limit || 20), 1), 50)

  const { rows: siteRows } = await pool.query('SELECT url FROM sites WHERE id=$1 LIMIT 1', [req.siteId])
  if (!siteRows[0]) return res.status(404).json({ error: 'Site not found' })
  const targetDomain = extractDomain(siteRows[0].url)

  const { rows: keywords } = await pool.query(
    'SELECT id, keyword FROM keywords WHERE site_id=$1 ORDER BY created_at ASC LIMIT $2',
    [req.siteId, limit]
  )

  const details = []
  for (const k of keywords) {
    const results = await fetchSerpResults(k.keyword, engine)
    const hit = results.find(r => isDomainMatch(r.domain, targetDomain))
    const position = hit ? hit.position : null
    details.push({ id: k.id, keyword: k.keyword, position, inFirstPage: !!position && position <= 10, top10: results })
  }

  const inFirstPageCount = details.filter(d => d.inFirstPage).length
  res.json({ engine, siteDomain: targetDomain, checked: details.length, inFirstPageCount, details })
})

router.post('/:siteId/keywords/scan-weekly-now', auth, verifySite, async (req, res) => {
  try {
    const engines = Array.isArray(req.body?.engines) && req.body.engines.length
      ? req.body.engines.map(normalizeEngine)
      : SUPPORTED_ENGINES
    const limit = Math.min(Math.max(parseInt(req.body?.limit || 30), 1), 80)
    const scan = await scanSiteKeywordTransitions(req.siteId, engines, limit)

    if (scan.report) {
      await pool.query(
        'INSERT INTO alerts (site_id, type, message, severity) VALUES ($1,$2,$3,$4)',
        [req.siteId, 'rank-weekly-report', buildRankSummaryAlertMessage(scan.report), 'info']
      )
    }

    let emailedTo = []
    let emailError = null
    const sendEmail = req.body?.sendEmail !== false
    if (sendEmail && scan.report) {
      const { rows: eRows } = await pool.query('SELECT enabled, recipients FROM email_report_settings WHERE site_id=$1 LIMIT 1', [req.siteId])
      const configured = eRows[0]
      const recipients = configured?.enabled && Array.isArray(configured?.recipients) && configured.recipients.length
        ? configured.recipients
        : (req.user?.email ? [req.user.email] : [])

      if (recipients.length) {
        try {
          await sendRankScanReportEmail(recipients, scan.report)
          emailedTo = recipients
        } catch (e) {
          emailError = e.message
          console.error('Manual weekly scan email failed:', e.message)
        }
      }
    }

    res.json({ ok: true, ...scan, engines, emailedTo, emailError })
  } catch (e) {
    console.error('Manual weekly scan failed:', e)
    res.status(500).json({ error: 'Weekly scan failed' })
  }
})

module.exports = router