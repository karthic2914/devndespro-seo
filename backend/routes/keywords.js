const express = require('express')
const axios = require('axios')
const { pool, anthropic } = require('../clients')
const { auth, verifySite, requireFeature } = require('../middleware')
const {
  normalizeEngine,
  extractDomain,
  isDomainMatch,
  findLocalMatch,
  inferRankingLocale,
  SUPPORTED_ENGINES,
  buildHeuristicKeywordSuggestions,
} = require('../utils/helpers')
const { fetchSerpVisibility, scanSiteKeywordTransitions, getDfsRankedPosition } = require('../utils/serp')
const { sendRankScanReportEmail } = require('../utils/email')
const { getGscAccessToken, resolveGscPropertyUrl } = require('../utils/gsc')
const { runKeywordAutoDiscover, getCachedDiscovery, runKeywordGap } = require('../utils/keywordDiscover')
const { parseAiOverviewFromSerpResult, languageCodeFromName } = require('../utils/aiOverview')

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

const DFS_LOCATIONS = {
  2840: { code: 2840, name: 'United States', language: 'English' },
  2826: { code: 2826, name: 'United Kingdom', language: 'English' },
  2578: { code: 2578, name: 'Norway', language: 'English' },
  2036: { code: 2036, name: 'Australia', language: 'English' },
  2124: { code: 2124, name: 'Canada', language: 'English' },
  2276: { code: 2276, name: 'Germany', language: 'German' },
  2356: { code: 2356, name: 'India', language: 'English' },
}

const QUESTION_RE = /^(who|what|where|when|why|how|which|is|are|can|do|does|did|will|should|vs|versus)\b|\?$/i

function difficultyLabel(score) {
  if (score == null || Number.isNaN(Number(score))) return 'Medium'
  const n = Number(score)
  if (n < 33) return 'Easy'
  if (n < 66) return 'Medium'
  return 'Hard'
}

function capitalizeIntent(intent) {
  if (!intent || typeof intent !== 'string') return null
  return intent.charAt(0).toUpperCase() + intent.slice(1).toLowerCase()
}

function mapDfsKeywordItem(raw) {
  const data = raw?.keyword_data || raw || {}
  const info = data.keyword_info || {}
  const props = data.keyword_properties || {}
  const intentInfo = data.search_intent_info || {}
  const serp = data.serp_info || raw?.serp_info || {}
  const kd = props.keyword_difficulty != null
    ? Number(props.keyword_difficulty)
    : (raw?.keyword_difficulty != null ? Number(raw.keyword_difficulty) : null)
  const monthly = Array.isArray(info.monthly_searches) ? info.monthly_searches : []
  const trend = monthly
    .slice()
    .sort((a, b) => (a.year - b.year) || (a.month - b.month))
    .slice(-12)
    .map((m) => m.search_volume ?? 0)

  const keyword = data.keyword || raw?.keyword || ''
  const resultsRaw = serp.se_results_count
  const resultsCount = resultsRaw != null && resultsRaw !== '' ? Number(resultsRaw) : null
  const relatednessRaw = raw?.relatedness_score ?? data?.relatedness_score
  const relatedness = relatednessRaw != null ? Number(relatednessRaw) : null

  return {
    keyword,
    volume: info.search_volume ?? 0,
    difficulty: difficultyLabel(kd),
    difficultyScore: kd ?? 0,
    cpc: info.cpc ?? 0,
    competition: info.competition ?? 0,
    competitionLevel: info.competition_level || null,
    trend,
    intent: capitalizeIntent(intentInfo.main_intent),
    parentTopic: props.core_keyword || null,
    categories: Array.isArray(info.categories) ? info.categories.slice(0, 3) : [],
    isQuestion: QUESTION_RE.test(String(keyword).trim()),
    resultsCount: Number.isFinite(resultsCount) ? resultsCount : null,
    relatedness: Number.isFinite(relatedness) ? relatedness : null,
    serpTypes: Array.isArray(serp.serp_item_types) ? serp.serp_item_types.slice(0, 8) : [],
  }
}

function mapOrganicSerpItems(serpResult) {
  const items = Array.isArray(serpResult?.items) ? serpResult.items : []
  return items
    .filter((i) => i && i.type === 'organic')
    .slice(0, 10)
    .map((i) => ({
      rank: i.rank_group || i.rank_absolute || null,
      title: i.title || '',
      url: i.url || '',
      domain: (i.domain || '').replace(/^www\./i, ''),
      description: i.description || '',
    }))
}

function mapSeedOverview(overviewResult, seedKeyword) {
  const item = (overviewResult?.items || []).find(
    (x) => String(x?.keyword || '').toLowerCase() === String(seedKeyword || '').toLowerCase()
  ) || overviewResult?.items?.[0]
  if (!item) return null
  const mapped = mapDfsKeywordItem(item)
  const avgBl = item.avg_backlinks_info || {}
  return {
    ...mapped,
    avgBacklinks: avgBl.backlinks ?? null,
    avgReferringDomains: avgBl.referring_domains ?? null,
    avgRank: avgBl.main_domain_rank ?? null,
  }
}

function dedupeSuggestions(list) {
  const seen = new Set()
  const out = []
  for (const item of list) {
    const key = String(item.keyword || '').toLowerCase().trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

async function dfsPost(authHeader, path, payload, timeout = 25000) {
  const { data } = await axios.post(
    `https://api.dataforseo.com/v3/${path}`,
    [payload],
    {
      headers: { Authorization: `Basic ${authHeader}`, 'Content-Type': 'application/json' },
      timeout,
    }
  )
  return data?.tasks?.[0]?.result?.[0] || null
}

async function dfsPostTasks(authHeader, path, payloads, timeout = 90000) {
  const { data } = await axios.post(
    `https://api.dataforseo.com/v3/${path}`,
    payloads,
    {
      headers: { Authorization: `Basic ${authHeader}`, 'Content-Type': 'application/json' },
      timeout,
    }
  )
  return data?.tasks || []
}

router.get('/:siteId/keywords', auth, verifySite, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM keywords WHERE site_id=$1 ORDER BY created_at ASC', [req.siteId])
  res.json(rows)
})

router.post('/:siteId/keywords', auth, verifySite, async (req, res) => {
  try {
    const { keyword, volume, difficulty, position } = req.body

    const normalizedKeyword =
      typeof keyword === 'string'
        ? keyword.trim().replace(/\s+/g, ' ')
        : ''

    if (!normalizedKeyword) {
      return res.status(400).json({ error: 'Keyword is required' })
    }

    if (normalizedKeyword.length > 255) {
      return res.status(400).json({ error: 'Keyword must be 255 characters or fewer' })
    }

    // Reject domain-like strings (not real search keywords)
    if (/\.(com|no|net|org|io|co)$/i.test(normalizedKeyword)) {
      return res.status(400).json({ error: 'This looks like a domain, not a search keyword' })
    }

    const volumeNumber = Number(volume)
    const safeVolume =
      Number.isFinite(volumeNumber) && volumeNumber >= 0
        ? Math.round(volumeNumber)
        : 0

    const positionNumber = Number(position)
    const safePosition =
      position !== null &&
      position !== undefined &&
      position !== '' &&
      Number.isFinite(positionNumber) &&
      positionNumber >= 1
        ? Math.round(positionNumber)
        : null

    const safeDifficulty =
      typeof difficulty === 'string' && difficulty.trim()
        ? difficulty.trim()
        : 'Easy'

    const { rows } = await pool.query(
      `INSERT INTO keywords
         (site_id, keyword, volume, difficulty, position)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [req.siteId, normalizedKeyword, safeVolume, safeDifficulty, safePosition]
    )

    res.status(201).json(rows[0])
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ error: 'Keyword already tracked for this project' })
    }

    console.error('Add keyword failed:', e.message)
    res.status(500).json({ error: 'Could not add keyword' })
  }
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

// Get last keyword search for this site
router.get('/:siteId/keywords/last-search', auth, verifySite, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT query, results, searched_at FROM keyword_searches WHERE site_id=$1 ORDER BY searched_at DESC LIMIT 1',
      [req.siteId]
    )
    if (!rows.length) return res.json({ query: '', suggestions: [], matching: [], related: [], questions: [] })

    const results = rows[0].results
    // New shape: { suggestions, matching, related, questions, meta, overview, organic }
    if (results && typeof results === 'object' && !Array.isArray(results)) {
      return res.json({
        query: rows[0].query,
        suggestions: results.suggestions || results.matching || [],
        matching: results.matching || results.suggestions || [],
        related: results.related || [],
        questions: results.questions || [],
        overview: results.overview || null,
        organic: results.organic || [],
        meta: results.meta || null,
        searchedAt: rows[0].searched_at,
      })
    }

    // Legacy shape: bare array
    const list = Array.isArray(results) ? results : []
    res.json({
      query: rows[0].query,
      suggestions: list,
      matching: list,
      related: [],
      questions: list.filter((s) => QUESTION_RE.test(String(s.keyword || '').trim())),
      overview: null,
      organic: [],
      searchedAt: rows[0].searched_at,
    })
  } catch (e) {
    res.json({ query: '', suggestions: [], matching: [], related: [], questions: [] })
  }
})

// DataForSEO keyword research: matching terms + related + questions (vendor-style)
router.post('/:siteId/keywords/dataforseo-suggest', auth, verifySite, requireFeature('keywords'), async (req, res) => {
  const keyword = typeof req.body?.keyword === 'string' ? req.body.keyword.trim() : ''
  if (!keyword) return res.status(400).json({ error: 'keyword required' })

  const authHeader = getDataForSEOAuth()
  if (!authHeader) return res.status(500).json({ error: 'DataForSEO not configured' })

  const locationCode = Number(req.body?.locationCode) || 2840
  const location = DFS_LOCATIONS[locationCode] || DFS_LOCATIONS[2840]
  const languageName =
    typeof req.body?.languageName === 'string' && req.body.languageName.trim()
      ? req.body.languageName.trim()
      : location.language
  const limit = Math.min(Math.max(parseInt(req.body?.limit || 50, 10) || 50, 10), 100)

  try {
    const basePayload = {
      keyword,
      language_name: languageName,
      location_code: location.code,
      include_serp_info: true,
      include_seed_keyword: true,
    }

    const includeLiveSerp = req.body?.includeSerp !== false

    const [matchingResult, relatedResult, questionResult, overviewResult, serpResult] = await Promise.all([
      dfsPost(authHeader, 'dataforseo_labs/google/keyword_suggestions/live', {
        ...basePayload,
        limit,
        order_by: ['keyword_info.search_volume,desc'],
      }),
      dfsPost(authHeader, 'dataforseo_labs/google/related_keywords/live', {
        ...basePayload,
        limit: Math.min(limit, 72),
        depth: 2,
        order_by: ['keyword_data.keyword_info.search_volume,desc'],
      }).catch((err) => {
        console.warn('DataForSEO related keywords failed:', err.response?.data || err.message)
        return null
      }),
      dfsPost(authHeader, 'dataforseo_labs/google/keyword_suggestions/live', {
        ...basePayload,
        limit: Math.min(limit, 50),
        order_by: ['keyword_info.search_volume,desc'],
        filters: [
          ['keyword', 'regex', '^(who|what|where|when|why|how|which|is|are|can|do|does|did|will|should)\\b'],
        ],
      }).catch((err) => {
        console.warn('DataForSEO question keywords failed:', err.response?.data || err.message)
        return null
      }),
      dfsPost(authHeader, 'dataforseo_labs/google/keyword_overview/live', {
        keywords: [keyword],
        language_name: languageName,
        location_code: location.code,
        include_serp_info: true,
      }).catch((err) => {
        console.warn('DataForSEO keyword overview failed:', err.response?.data || err.message)
        return null
      }),
      includeLiveSerp
        ? dfsPost(authHeader, 'serp/google/organic/live/advanced', {
            keyword,
            language_name: languageName,
            location_code: location.code,
            device: 'desktop',
            os: 'windows',
            depth: 10,
          }, 60000).catch((err) => {
            console.warn('DataForSEO SERP overview failed:', err.response?.data || err.message)
            return null
          })
        : Promise.resolve(null),
    ])

    const matching = dedupeSuggestions(
      (matchingResult?.items || []).map(mapDfsKeywordItem)
    )
    const related = dedupeSuggestions(
      (relatedResult?.items || []).map(mapDfsKeywordItem)
    )
    const fromQuestionsEndpoint = (questionResult?.items || []).map(mapDfsKeywordItem)
    const questions = dedupeSuggestions([
      ...fromQuestionsEndpoint,
      ...matching.filter((s) => s.isQuestion),
      ...related.filter((s) => s.isQuestion),
    ]).sort((a, b) => (b.volume || 0) - (a.volume || 0))

    // Backward-compatible flat list (matching first)
    const suggestions = matching.length ? matching : related
    const overview = mapSeedOverview(overviewResult, keyword)
      || matching.find((s) => s.keyword.toLowerCase() === keyword.toLowerCase())
      || null
    const organic = mapOrganicSerpItems(serpResult)

    const payload = {
      suggestions,
      matching,
      related,
      questions,
      overview,
      organic,
      meta: {
        query: keyword,
        locationCode: location.code,
        locationName: location.name,
        languageName,
        limit,
        counts: {
          matching: matching.length,
          related: related.length,
          questions: questions.length,
          organic: organic.length,
        },
      },
      source: 'dataforseo',
    }

    await pool.query(
      `INSERT INTO keyword_searches (site_id, query, results)
       VALUES ($1, $2, $3)
       ON CONFLICT (site_id) DO UPDATE SET query=$2, results=$3, searched_at=NOW()`,
      [req.siteId, keyword, JSON.stringify(payload)]
    )

    res.json(payload)
  } catch (e) {
    console.error('DataForSEO suggest error:', e.response?.data || e.message)
    res.status(500).json({ error: 'DataForSEO request failed' })
  }
})

// Google AI Overview presence + citations (DataForSEO SERP live advanced)
router.post('/:siteId/keywords/ai-overview', auth, verifySite, requireFeature('keywords'), async (req, res) => {
  const authHeader = getDataForSEOAuth()
  if (!authHeader) return res.status(500).json({ error: 'DataForSEO not configured' })

  const rawList = Array.isArray(req.body?.keywords) ? req.body.keywords : []
  const keywords = [...new Set(
    rawList
      .map((k) => String(k || '').trim())
      .filter(Boolean)
  )].slice(0, 15)

  if (!keywords.length) return res.status(400).json({ error: 'keywords required (max 15)' })

  const locationCode = Number(req.body?.locationCode) || 2840
  const location = DFS_LOCATIONS[locationCode] || DFS_LOCATIONS[2840]
  const languageName =
    typeof req.body?.languageName === 'string' && req.body.languageName.trim()
      ? req.body.languageName.trim()
      : location.language
  const languageCode = languageCodeFromName(languageName)
  const loadAsync = req.body?.loadAsync !== false

  try {
    const payloads = keywords.map((keyword) => ({
      keyword,
      location_code: location.code,
      language_code: languageCode,
      language_name: languageName,
      device: 'desktop',
      os: 'windows',
      depth: 10,
      load_async_ai_overview: loadAsync,
    }))

    const tasks = await dfsPostTasks(
      authHeader,
      'serp/google/organic/live/advanced',
      payloads,
      120000
    )

    const byKeyword = {}
    for (const kw of keywords) {
      byKeyword[kw.toLowerCase()] = {
        keyword: kw,
        hasAiOverview: false,
        citations: [],
        snippet: null,
        error: null,
      }
    }

    for (const task of tasks) {
      const kw = String(task?.data?.keyword || task?.result?.[0]?.keyword || '').trim()
      const key = kw.toLowerCase()
      if (!key) continue

      if (task?.status_code && task.status_code !== 20000) {
        byKeyword[key] = {
          keyword: kw,
          hasAiOverview: false,
          citations: [],
          snippet: null,
          error: task.status_message || 'SERP task failed',
        }
        continue
      }

      const result = Array.isArray(task?.result) ? task.result[0] : null
      const parsed = parseAiOverviewFromSerpResult(result)
      byKeyword[key] = {
        keyword: kw,
        hasAiOverview: parsed.hasAiOverview,
        citations: parsed.citations,
        snippet: parsed.snippet,
        asynchronous: parsed.asynchronous,
        incomplete: parsed.incomplete,
        error: null,
      }
    }

    const results = keywords.map((kw) => byKeyword[kw.toLowerCase()])

    res.json({
      results,
      meta: {
        locationCode: location.code,
        locationName: location.name,
        languageName,
        languageCode,
        checked: results.length,
        withAiOverview: results.filter((r) => r.hasAiOverview).length,
        source: 'dataforseo',
        note: 'Uses Google Organic SERP Live Advanced with load_async_ai_overview (billed per keyword).',
      },
    })
  } catch (e) {
    console.error('AI Overview check error:', e.response?.data || e.message)
    res.status(500).json({ error: e.response?.data?.tasks?.[0]?.status_message || 'AI Overview check failed' })
  }
})

// Enrich existing keywords with real volume from DataForSEO
router.post('/:siteId/keywords/enrich', auth, verifySite, requireFeature('keywords'), async (req, res) => {
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

// Cached keyword discovery (Already ranking / Good to have / How to get them)
router.get('/:siteId/keywords/auto-discover', auth, verifySite, requireFeature('keywords'), async (req, res) => {
  try {
    const cached = await getCachedDiscovery(req.siteId)
    if (!cached) {
      return res.json({
        alreadyRanking: [],
        goodToHave: [],
        howToGetThem: [],
        meta: null,
        cached: false,
      })
    }
    res.json({ ...cached, cached: true })
  } catch (e) {
    console.error('Get keyword discovery cache failed:', e.message)
    res.status(500).json({ error: 'Could not load keyword discovery' })
  }
})

// Run automatic ranking-keyword discovery (auto-tracks Already ranking)
router.post('/:siteId/keywords/auto-discover', auth, verifySite, requireFeature('keywords'), async (req, res) => {
  try {
    const payload = await runKeywordAutoDiscover({
      siteId: req.siteId,
      userId: req.user.id,
    })
    res.json({ ...payload, cached: false })
  } catch (e) {
    console.error('Keyword auto-discover failed:', e.response?.data || e.message)
    if (e.status === 404) return res.status(404).json({ error: 'Site not found' })
    res.status(500).json({ error: 'Keyword auto-discovery failed' })
  }
})

// Keyword Gap — keywords competitors rank for that you don't
router.post('/:siteId/keywords/gap', auth, verifySite, requireFeature('keywords'), async (req, res) => {
  try {
    const domains = Array.isArray(req.body?.domains) ? req.body.domains : []
    const locationCode = req.body?.locationCode != null ? Number(req.body.locationCode) : null
    const limit = Math.min(Math.max(Number(req.body?.limit) || 80, 20), 150)
    const payload = await runKeywordGap({
      siteId: req.siteId,
      competitorDomains: domains,
      locationCode,
      limit,
    })
    res.json(payload)
  } catch (e) {
    console.error('Keyword gap failed:', e.response?.data || e.message)
    if (e.status === 404) return res.status(404).json({ error: 'Site not found' })
    if (e.status === 503) return res.status(503).json({ error: e.message })
    res.status(500).json({ error: e.message || 'Keyword gap failed' })
  }
})

// Import keyword ideas from this project's GSC query data
router.post('/:siteId/keywords/import-from-gsc', auth, verifySite, requireFeature('keywords'), async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.body?.limit || 25), 5), 100)
    const [userR, siteR, existingR] = await Promise.all([
      pool.query('SELECT gsc_refresh_token FROM users WHERE id=$1 LIMIT 1', [req.user.id]),
      pool.query('SELECT url FROM sites WHERE id=$1 LIMIT 1', [req.siteId]),
      pool.query('SELECT keyword FROM keywords WHERE site_id=$1', [req.siteId]),
    ])

    if (!siteR.rows[0]) return res.status(404).json({ error: 'Site not found' })
    if (!userR.rows[0]?.gsc_refresh_token) {
      return res.status(400).json({ error: 'Connect Google Search Console first' })
    }

    const rawSiteUrl = siteR.rows[0].url
    const accessToken = await getGscAccessToken(userR.rows[0].gsc_refresh_token)
    const siteUrl = await resolveGscPropertyUrl(accessToken, rawSiteUrl)
    const endDate = new Date().toISOString().split('T')[0]
    const startDate = new Date(Date.now() - 90 * 864e5).toISOString().split('T')[0]
    const base = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`
    const { data } = await axios.post(
      base,
      {
        startDate,
        endDate,
        dimensions: ['query'],
        rowLimit: limit,
        orderBy: [{ fieldName: 'clicks', sortOrder: 'DESCENDING' }],
      },
      { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 15000 }
    )

    const rows = Array.isArray(data?.rows) ? data.rows : []
    if (!rows.length) return res.json({ imported: 0, skipped: 0, totalRows: 0 })

    const existing = new Set(existingR.rows.map(k => String(k.keyword || '').toLowerCase().trim()))
    let imported = 0
    let skipped = 0

    for (const r of rows) {
      const keyword = String(r.keys?.[0] || '').trim()
      if (!keyword || keyword.length < 2) { skipped++; continue }
      if (existing.has(keyword.toLowerCase())) { skipped++; continue }

      const positionRaw = Number(r.position)
      const position = Number.isFinite(positionRaw) ? Math.max(1, Math.round(positionRaw)) : null
      const impressions = Number(r.impressions || 0)

      await pool.query(
        'INSERT INTO keywords (site_id, keyword, volume, difficulty, position) VALUES ($1,$2,$3,$4,$5)',
        [req.siteId, keyword, impressions, 'Medium', position]
      )
      existing.add(keyword.toLowerCase())
      imported++
    }

    res.json({ imported, skipped, totalRows: rows.length })
  } catch (e) {
    console.error('GSC keyword import failed:', e.response?.data || e.message)
    res.status(500).json({ error: 'Could not import keywords from GSC for this project' })
  }
})

// AI keyword suggestions
router.post('/:siteId/keywords/ai-suggest', auth, verifySite, requireFeature('keywords'), async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.body?.limit || 12), 3), 25)
    const refresh = req.body?.refresh === true
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
    const normalizeSuggestions = (list) => (Array.isArray(list) ? list : [])
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

    if (!refresh) {
      const { rows: cacheRows } = await pool.query(
        'SELECT suggestions, updated_at FROM ai_keyword_suggestions WHERE site_id=$1 LIMIT 1',
        [req.siteId]
      )
      const cache = cacheRows[0]
      const cacheAgeMs = cache?.updated_at ? (Date.now() - new Date(cache.updated_at).getTime()) : Number.POSITIVE_INFINITY
      if (cache && cacheAgeMs < 7 * 24 * 60 * 60 * 1000) {
        const cachedSuggestions = normalizeSuggestions(cache.suggestions)
        if (cachedSuggestions.length > 0) {
          return res.json({ suggestions: cachedSuggestions, source: 'cache', cachedAt: cache.updated_at })
        }
      }
    }

    let cleaned = []

    try {
      const r = await anthropic.messages.create({
        model: 'claude-sonnet-5',
        max_tokens: 1400,
        messages: [{ role: 'user', content: prompt }],
      })
      const text = r.content?.[0]?.text?.trim() || '{}'
      const jsonStart = text.indexOf('{')
      const jsonEnd = text.lastIndexOf('}')
      let parsed = { suggestions: [] }
      try { parsed = JSON.parse(jsonStart >= 0 ? text.slice(jsonStart, jsonEnd + 1) : text) }
      catch { parsed = { suggestions: [] } }

      cleaned = normalizeSuggestions(parsed.suggestions)
    } catch (e) {
      console.error('AI keyword suggest upstream failed:', e.message)
    }

    if (cleaned.length === 0) {
      cleaned = buildHeuristicKeywordSuggestions({ siteName: site.name, siteUrl: site.url, existingSet, limit })
      await pool.query(
        `INSERT INTO ai_keyword_suggestions (site_id, suggestions, source, updated_at)
         VALUES ($1,$2,'fallback',NOW())
         ON CONFLICT (site_id) DO UPDATE SET suggestions=$2, source='fallback', updated_at=NOW()`,
        [req.siteId, JSON.stringify(cleaned)]
      )
      return res.json({ suggestions: cleaned, source: 'fallback' })
    }

    await pool.query(
      `INSERT INTO ai_keyword_suggestions (site_id, suggestions, source, updated_at)
       VALUES ($1,$2,'ai',NOW())
       ON CONFLICT (site_id) DO UPDATE SET suggestions=$2, source='ai', updated_at=NOW()`,
      [req.siteId, JSON.stringify(cleaned)]
    )
    res.json({ suggestions: cleaned, source: 'ai' })
  } catch (e) {
    console.error('AI keyword suggest failed:', e)
    res.status(500).json({ error: 'AI keyword suggestion failed' })
  }
})

router.post('/:siteId/keywords/first-page-status', auth, verifySite, requireFeature('keywords'), async (req, res) => {
  const engine = normalizeEngine(req.body?.engine)
  const limit = Math.min(Math.max(parseInt(req.body?.limit || 20), 1), 50)

  const { rows: siteRows } = await pool.query('SELECT name, url FROM sites WHERE id=$1 LIMIT 1', [req.siteId])
  if (!siteRows[0]) return res.status(404).json({ error: 'Site not found' })
  const site = siteRows[0]
  const targetDomain = extractDomain(site.url)
  const locale = inferRankingLocale(site)

  const { rows: keywords } = await pool.query(
    'SELECT id, keyword, rank_country, rank_language, rank_location FROM keywords WHERE site_id=$1 ORDER BY created_at ASC LIMIT $2',
    [req.siteId, limit]
  )

  const details = []
  for (const k of keywords) {
    const country =
      k.rank_location
        ? (k.rank_country || locale.country)
        : (!k.rank_country || k.rank_country === 'us')
          ? locale.country
          : k.rank_country
    const rankingContext = {
      country,
      language: k.rank_language || locale.language,
      location: k.rank_location || locale.location,
      google_domain: locale.google_domain || (country === 'no' ? 'google.no' : null),
      device: 'desktop',
    }
    const snapshot = await fetchSerpVisibility(k.keyword, engine, rankingContext)
    const organic = snapshot.organic || []
    const local = snapshot.local || []
    const organicHit = organic.find((r) => isDomainMatch(r.domain, targetDomain))
    const localHit = findLocalMatch(local, { domain: targetDomain, brandName: site.name })
    let position = organicHit ? organicHit.position : null
    const localPosition = localHit ? localHit.position : null

    // Not found in the shallow (page-1) live scan  fall back to the
    // cached DataForSEO ranked_keywords position instead of reporting
    // "not ranked" when the site actually ranks deeper than page 1.
    if (position == null) {
      const dfsPosition = await getDfsRankedPosition(req.siteId, k.keyword)
      if (dfsPosition != null) position = dfsPosition
    }
    const inFirstPage = localPosition != null || (!!position && position <= 10)
    details.push({
      id: k.id,
      keyword: k.keyword,
      position,
      localPosition,
      visibility: localPosition != null && position != null
        ? 'both'
        : localPosition != null
          ? 'local'
          : position != null
            ? 'organic'
            : 'none',
      inFirstPage,
      top10: organic.slice(0, 10),
      localPack: local.slice(0, 3),
    })
  }

  const inFirstPageCount = details.filter((d) => d.inFirstPage).length
  const localPackCount = details.filter((d) => d.localPosition != null).length
  res.json({
    engine,
    siteDomain: targetDomain,
    locale,
    checked: details.length,
    inFirstPageCount,
    localPackCount,
    details,
  })
})

router.post('/:siteId/keywords/scan-weekly-now', auth, verifySite, requireFeature('keywords'), async (req, res) => {
  try {
    const engines = Array.isArray(req.body?.engines) && req.body.engines.length
      ? req.body.engines.map(normalizeEngine)
      : SUPPORTED_ENGINES
    const limit = Math.min(Math.max(parseInt(req.body?.limit || 30), 1), 80)
    console.log('[Keywords] Weekly scan starting', {
      siteId: req.siteId,
      engines,
      limit,
    })
    const scan = await scanSiteKeywordTransitions(req.siteId, engines, limit)
    console.log('[Keywords] Weekly scan finished', {
      siteId: req.siteId,
      checked: scan?.checked,
      alertsCreated: scan?.alertsCreated,
      transitions: (scan?.report?.transitions || []).length,
    })

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
