const axios = require('axios')
const { pool } = require('../clients')
const { extractDomain, inferRankingLocale } = require('./helpers')
const { getGscAccessToken, resolveGscPropertyUrl } = require('./gsc')

const AUTO_DISCOVER_QUERY = '__auto_discover__'
const QUESTION_RE = /^(who|what|where|when|why|how|which|is|are|can|do|does|did|will|should|vs|versus)\b|\?$/i

// Relevance filter for auto-discovered keyword suggestions.
// A keyword only qualifies for goodToHave/howToGetThem if it either
// contains a business-relevant term, or has clear commercial intent.
const BUSINESS_TERMS = [
  'web', 'seo', 'design', 'nettside', 'website', 'app', 'development',
  'utvikling', 'marketing', 'markedsforing', 'markedsf\u00f8ring', 'digital',
  'responsive', 'responsiv', 'landing', 'page', 'hosting', 'webdesign',
  'webutvikling', 'webshop', 'e-commerce', 'ecommerce',
]

// Known false positives - platform/tool names that pass the business-term
// or commercial-intent check but aren't real content opportunities.
const EXCLUDED_TERMS = [
  'uniweb', 'rcube', 'kontrollpanel', 'websupporten',
]

function isExcludedKeyword(keyword) {
  const k = String(keyword || '').toLowerCase()
  return EXCLUDED_TERMS.some((term) => k.includes(term))
}

function isRelevantKeyword(keyword, intent) {
  const k = String(keyword || '').toLowerCase()
  if (isExcludedKeyword(k)) return false
  const hasBusinessTerm = BUSINESS_TERMS.some((term) => k.includes(term))
  const isCommercial = intent === 'Commercial' || intent === 'Transactional'
  return hasBusinessTerm || isCommercial
}

const DFS_LOCATIONS = {
  2840: { code: 2840, name: 'United States', language: 'English', languageCode: 'en' },
  2826: { code: 2826, name: 'United Kingdom', language: 'English', languageCode: 'en' },
  2578: { code: 2578, name: 'Norway', language: 'English', languageCode: 'en' },
  2036: { code: 2036, name: 'Australia', language: 'English', languageCode: 'en' },
  2124: { code: 2124, name: 'Canada', language: 'English', languageCode: 'en' },
  2276: { code: 2276, name: 'Germany', language: 'German', languageCode: 'de' },
  2356: { code: 2356, name: 'India', language: 'English', languageCode: 'en' },
}

function getDataForSEOAuth() {
  const login = process.env.DATAFORSEO_LOGIN
  const password = process.env.DATAFORSEO_PASSWORD
  if (!login || !password) return null
  return Buffer.from(`${login}:${password}`).toString('base64')
}

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

function normalizeKeyword(value) {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

function keywordKey(value) {
  return normalizeKeyword(value).toLowerCase()
}

function mapDfsKeywordItem(raw) {
  const data = raw?.keyword_data || raw || {}
  const info = data.keyword_info || {}
  const props = data.keyword_properties || {}
  const intentInfo = data.search_intent_info || {}
  const kd = props.keyword_difficulty != null ? Number(props.keyword_difficulty) : null
  const keyword = normalizeKeyword(data.keyword || raw?.keyword || '')
  return {
    keyword,
    volume: info.search_volume ?? 0,
    difficulty: difficultyLabel(kd),
    difficultyScore: kd ?? 0,
    cpc: info.cpc ?? 0,
    competition: info.competition ?? 0,
    intent: capitalizeIntent(intentInfo.main_intent),
    parentTopic: props.core_keyword || null,
    isQuestion: QUESTION_RE.test(keyword),
  }
}

function mapRankedKeywordItem(item) {
  const mapped = mapDfsKeywordItem(item)
  const serp = item?.ranked_serp_element?.serp_item || {}
  const isOrganic = serp.type === 'organic'
  const positionRaw = isOrganic ? Number(serp.rank_group) : NaN
  const position = Number.isFinite(positionRaw) && positionRaw >= 1 ? Math.round(positionRaw) : null
  return {
    ...mapped,
    position,
    source: 'dfs_ranked',
  }
}

function dedupeByKeyword(list) {
  const seen = new Set()
  const out = []
  for (const item of list) {
    const key = keywordKey(item.keyword)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

function resolveLocation(site) {
  const locale = inferRankingLocale(site)
  if (locale.country === 'no') return DFS_LOCATIONS[2578]
  if (locale.country === 'gb' || locale.country === 'uk') return DFS_LOCATIONS[2826]
  return DFS_LOCATIONS[2840]
}

async function dfsPost(authHeader, path, payload) {
  const { data } = await axios.post(
    `https://api.dataforseo.com/v3/${path}`,
    [payload],
    {
      headers: { Authorization: `Basic ${authHeader}`, 'Content-Type': 'application/json' },
      timeout: 15000,
    }
  )
  const task = data?.tasks?.[0]

  console.log('[DataForSEO]', JSON.stringify({
    path,
    apiStatusCode: data?.status_code,
    apiStatusMessage: data?.status_message,
    taskStatusCode: task?.status_code,
    taskStatusMessage: task?.status_message,
    resultCount: Array.isArray(task?.result) ? task.result.length : 0,
    itemCount: Array.isArray(task?.result?.[0]?.items) ? task.result[0].items.length : 0,
    totalCount: task?.result?.[0]?.total_count ?? null,
  }))

  return task?.result?.[0] || null
}

function opportunityTag(volume, difficultyScore) {
  const vol = volume || 0
  const diff = difficultyScore ?? 50
  if (vol >= 500 && diff < 40) return 'Quick Win'
  if (vol >= 1000 && diff < 66) return 'High Value'
  if (vol < 200 && diff < 40) return 'Long Tail'
  if (vol >= 500 && diff >= 66) return 'High Competition'
  if (vol < 100 && diff >= 50) return 'Low Priority'
  return 'Standard'
}

function buildHowTip(item) {
  if (item.isQuestion || QUESTION_RE.test(item.keyword || '')) {
    return 'Publish an FAQ or guide that answers this query clearly.'
  }
  const intent = String(item.intent || '').toLowerCase()
  if (intent === 'commercial' || intent === 'transactional') {
    return 'Create a service or landing page targeting this phrase.'
  }
  if ((item.volume || 0) < 200 && (item.difficultyScore || 50) < 40) {
    return 'Add a blog post or section using this exact phrase.'
  }
  return 'Create focused content and internal links targeting this keyword.'
}

function buildWhy(item, seed) {
  const parts = []
  if (seed) parts.push(`Related to "${seed}"`)
  if (item.difficultyScore != null) parts.push(`KD ${item.difficultyScore}`)
  if (item.intent) parts.push(`${item.intent} intent`)
  if (item.volume) parts.push(`${Number(item.volume).toLocaleString()} searches/mo`)
  // Use ASCII separator only - Unicode middot gets mojibake'd in some DB/client paths
  return parts.join(' | ') || 'Adjacent opportunity for your niche'
}

/** Clean mojibake separators from cached discovery text. */
function sanitizeDiscoveryText(value) {
  if (typeof value !== 'string') return value
  return value
    // Drop corrupted Unicode separator junk (mojibake middots/bullets)
    .replace(/[^\w\s"'.,:;#/+%-]+/g, ' | ')
    .replace(/(?:\s*\|\s*)+/g, ' | ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function sanitizeDiscoveryPayload(payload) {
  if (!payload || typeof payload !== 'object') return payload
  const cleanList = (list, fields) =>
    (Array.isArray(list) ? list : []).map((item) => {
      const next = { ...item }
      for (const field of fields) {
        if (typeof next[field] === 'string') next[field] = sanitizeDiscoveryText(next[field])
      }
      return next
    })

  return {
    ...payload,
    alreadyRanking: cleanList(payload.alreadyRanking, ['keyword', 'source']),
    goodToHave: cleanList(payload.goodToHave, ['keyword', 'why', 'opportunity', 'source', 'intent']),
    howToGetThem: cleanList(payload.howToGetThem, ['keyword', 'how', 'source', 'intent']),
  }
}

async function fetchGscRankingKeywords({ siteId, userId, siteUrl, limit = 40 }) {
  try {
    const userR = await pool.query('SELECT gsc_refresh_token FROM users WHERE id=$1 LIMIT 1', [userId])
    const refreshToken = userR.rows[0]?.gsc_refresh_token
    if (!refreshToken) return { items: [], sourceUsed: false }

    const accessToken = await getGscAccessToken(refreshToken)
    const propertyUrl = await resolveGscPropertyUrl(accessToken, siteUrl)
    const endDate = new Date().toISOString().split('T')[0]
    const startDate = new Date(Date.now() - 90 * 864e5).toISOString().split('T')[0]
    const base = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(propertyUrl)}/searchAnalytics/query`
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
    const items = rows.map((r) => {
      const keyword = normalizeKeyword(r.keys?.[0])
      const positionRaw = Number(r.position)
      const position = Number.isFinite(positionRaw) && positionRaw >= 1 ? Math.round(positionRaw) : null
      const impressions = Number(r.impressions || 0)
      return {
        keyword,
        volume: Number.isFinite(impressions) ? Math.round(impressions) : 0,
        difficulty: 'Medium',
        difficultyScore: 50,
        position,
        intent: null,
        source: 'gsc',
      }
    }).filter((i) => i.keyword && i.keyword.length >= 2)

    return { items, sourceUsed: true }
  } catch (e) {
    console.warn('GSC ranking discovery failed:', e.response?.data || e.message)
    return { items: [], sourceUsed: false }
  }
}

async function fetchDfsRankedKeywords({ authHeader, domain, location, limit = 50 }) {
  if (!authHeader || !domain) return []
  try {
    const result = await dfsPost(authHeader, 'dataforseo_labs/google/ranked_keywords/live', {
      target: domain,
      location_code: location.code,
      limit,
      item_types: ['organic'],
      order_by: ['keyword_data.keyword_info.search_volume,desc'],
      filters: [
        ['keyword_data.keyword_info.search_volume', '>', 0],
      ],
    })
    return (result?.items || [])       .map(mapRankedKeywordItem)       .filter((i) => i.keyword && i.position != null)
  } catch (e) {
    console.warn('DataForSEO ranked_keywords failed:', e.response?.data || e.message)
    return []
  }
}

async function fetchDfsIdeaSets({ authHeader, seed, location, limit = 40 }) {
  if (!authHeader || !seed) {
    return { matching: [], related: [], questions: [] }
  }

  const basePayload = {
    keyword: seed,
    location_code: location.code,
    include_serp_info: false,
    include_seed_keyword: true,
  }

  const [matchingResult, relatedResult, questionResult, broadIdeasResult] = await Promise.all([
    dfsPost(authHeader, 'dataforseo_labs/google/keyword_suggestions/live', {
      ...basePayload,
      limit,
      order_by: ['keyword_info.search_volume,desc'],
    }).catch((err) => {
      console.warn('DFS suggestions failed:', err.response?.data || err.message)
      return null
    }),
    Promise.resolve(null), // related_keywords temporarily skipped for Norway Labs locale compatibility
    dfsPost(authHeader, 'dataforseo_labs/google/keyword_suggestions/live', {
      ...basePayload,
      limit: Math.min(limit, 40),
      order_by: ['keyword_info.search_volume,desc'],
    }).catch((err) => {
      console.warn('DFS questions failed:', err.response?.data || err.message)
      return null
    }),
    dfsPost(authHeader, 'dataforseo_labs/google/keyword_ideas/live', {
      keywords: [seed],
      location_code: location.code,
      limit: Math.min(limit, 100),
      order_by: [
        'relevance,desc',
        'keyword_info.search_volume,desc',
      ],
      include_serp_info: false,
      closely_variants: false,
    }).catch((err) => {
      console.warn('DFS keyword ideas failed:', err.response?.data || err.message)
      return null
    }),
  ])

  const matching = dedupeByKeyword((matchingResult?.items || []).map(mapDfsKeywordItem))
  const broadIdeas = dedupeByKeyword(
    (broadIdeasResult?.items || []).map(mapDfsKeywordItem)
  )

  const related = dedupeByKeyword([
    ...(relatedResult?.items || []).map(mapDfsKeywordItem),
    ...broadIdeas,
  ])
  const questions = dedupeByKeyword([
    ...((questionResult?.items || []).map(mapDfsKeywordItem)),
    ...matching.filter((s) => s.isQuestion),
    ...related.filter((s) => s.isQuestion),
  ]).sort((a, b) => (b.volume || 0) - (a.volume || 0))

  console.log(
    '[KeywordDiscover] DFS ideas',
    JSON.stringify({
      seed,
      matching: matching.length,
      related: related.length,
      questions: questions.length,
      broadIdeas: broadIdeas.length,
    })
  )

  return { matching, related, questions }
}

async function insertTrackedKeyword(siteId, item) {
  const keyword = normalizeKeyword(item.keyword)
  if (!keyword) return { inserted: false, reason: 'empty' }

  const volumeNumber = Number(item.volume)
  const safeVolume =
    Number.isFinite(volumeNumber) && volumeNumber >= 0 ? Math.round(volumeNumber) : 0
  const positionNumber = Number(item.position)
  const safePosition =
    Number.isFinite(positionNumber) && positionNumber >= 1 ? Math.round(positionNumber) : null
  const safeDifficulty =
    typeof item.difficulty === 'string' && item.difficulty.trim()
      ? item.difficulty.trim()
      : difficultyLabel(item.difficultyScore)

  try {
    await pool.query(
      `INSERT INTO keywords (site_id, keyword, volume, difficulty, position)
       VALUES ($1,$2,$3,$4,$5)`,
      [siteId, keyword, safeVolume, safeDifficulty, safePosition]
    )
    return { inserted: true }
  } catch (e) {
    if (e.code === '23505') return { inserted: false, reason: 'duplicate' }
    throw e
  }
}

async function persistDiscovery(siteId, payload) {
  await pool.query(
    `INSERT INTO keyword_discoveries (site_id, results, discovered_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (site_id) DO UPDATE SET results=$2, discovered_at=NOW()`,
    [siteId, JSON.stringify(payload)]
  )
}

async function getCachedDiscovery(siteId) {
  const { rows } = await pool.query(
    'SELECT results, discovered_at FROM keyword_discoveries WHERE site_id=$1 LIMIT 1',
    [siteId]
  )
  if (!rows.length) return null
  return {
    ...sanitizeDiscoveryPayload(rows[0].results || {}),
    discoveredAt: rows[0].discovered_at,
  }
}

/**
 * Full auto-discover pipeline for a site.
 * Auto-tracks Already ranking; returns Good to have + How to get them for user accept.
 */
async function runKeywordAutoDiscover({ siteId, userId }) {
  const { rows: siteRows } = await pool.query(
    'SELECT id, name, url FROM sites WHERE id=$1 LIMIT 1',
    [siteId]
  )
  const site = siteRows[0]
  if (!site) {
    const err = new Error('Site not found')
    err.status = 404
    throw err
  }

  const domain = extractDomain(site.url)
  const location = resolveLocation(site)
  const authHeader = getDataForSEOAuth()
  const sourcesUsed = []

  const { rows: existingRows } = await pool.query(
    'SELECT keyword FROM keywords WHERE site_id=$1',
    [siteId]
  )
  const existingSet = new Set(existingRows.map((r) => keywordKey(r.keyword)))

  const gsc = await fetchGscRankingKeywords({
    siteId,
    userId,
    siteUrl: site.url,
    limit: 40,
  })
  if (gsc.sourceUsed) sourcesUsed.push('gsc')

  let dfsRanked = []
  if (authHeader) {
    dfsRanked = await fetchDfsRankedKeywords({
      authHeader,
      domain,
      location,
      limit: 50,
    })
    if (dfsRanked.length) sourcesUsed.push('dfs_ranked')
  }

  // Merge already-ranking: prefer GSC position when both exist
  const alreadyMap = new Map()
  for (const item of dfsRanked) {
    const key = keywordKey(item.keyword)
    if (!key) continue
    alreadyMap.set(key, { ...item, source: 'dfs_ranked' })
  }
  for (const item of gsc.items) {
    const key = keywordKey(item.keyword)
    if (!key) continue
    const prev = alreadyMap.get(key)
    if (!prev) {
      alreadyMap.set(key, { ...item, source: 'gsc' })
    } else {
      alreadyMap.set(key, {
        ...prev,
        ...item,
        volume: prev.volume || item.volume,
        difficulty: prev.difficultyScore ? prev.difficulty : item.difficulty,
        difficultyScore: prev.difficultyScore || item.difficultyScore,
        position: item.position ?? prev.position,
        source: prev.source === 'dfs_ranked' ? 'gsc+dfs' : 'gsc',
      })
    }
  }

  const brandSeed = normalizeKeyword(site.name) || domain.split('.')[0] || domain
  if (!alreadyMap.size && brandSeed) sourcesUsed.push('brand_seed')

  const alreadyRankingRaw = [...alreadyMap.values()]
    .sort((a, b) => {
      const ap = a.position == null ? 9999 : a.position
      const bp = b.position == null ? 9999 : b.position
      if (ap !== bp) return ap - bp
      return (b.volume || 0) - (a.volume || 0)
    })
    .slice(0, 50)

  let importedCount = 0
  const alreadyRanking = []
  for (const item of alreadyRankingRaw) {
    const key = keywordKey(item.keyword)
    let tracked = existingSet.has(key)
    if (!tracked) {
      const result = await insertTrackedKeyword(siteId, item)
      if (result.inserted) {
        importedCount += 1
        tracked = true
        existingSet.add(key)
      } else if (result.reason === 'duplicate') {
        tracked = true
        existingSet.add(key)
      }
    }
    alreadyRanking.push({
      keyword: item.keyword,
      volume: item.volume || 0,
      difficulty: item.difficulty || difficultyLabel(item.difficultyScore),
      difficultyScore: item.difficultyScore ?? 0,
      position: item.position ?? null,
      source: item.source,
      tracked,
    })
  }

  // Idea seeds: top ranking terms + brand
  const seeds = dedupeByKeyword([
    ...alreadyRankingRaw.slice(0, 5).map((i) => ({ keyword: i.keyword })),
    { keyword: brandSeed },
    { keyword: `${brandSeed} services` },
  ])
    .map((s) => s.keyword)
    .filter(Boolean)
    .slice(0, 4)

  let matching = []
  let related = []
  let questions = []
  if (authHeader && seeds.length) {
    sourcesUsed.push('dfs_ideas')
    for (const seed of seeds.slice(0, 2)) {
      const ideas = await fetchDfsIdeaSets({
        authHeader,
        seed,
        location,
        limit: 35,
      })
      matching = matching.concat(
        ideas.matching.map((i) => ({ ...i, seed, source: 'dfs_matching' }))
      )
      related = related.concat(
        ideas.related.map((i) => ({ ...i, seed, source: 'dfs_related' }))
      )
      questions = questions.concat(
        ideas.questions.map((i) => ({ ...i, seed, source: 'dfs_questions' }))
      )
    }
  }

  // Optional competitor gap (if competitors already exist)
  try {
    const { rows: competitors } = await pool.query(
      'SELECT name, url FROM competitors WHERE site_id=$1 ORDER BY dr DESC NULLS LAST LIMIT 2',
      [siteId]
    )
    if (authHeader && competitors.length) {
      for (const comp of competitors) {
        const compDomain = extractDomain(comp.url || comp.name)
        if (!compDomain || compDomain === domain) continue
        const compRanked = await fetchDfsRankedKeywords({
          authHeader,
          domain: compDomain,
          location,
          limit: 25,
        })
        if (compRanked.length) sourcesUsed.push('competitor_gap')
        related = related.concat(
          compRanked.map((i) => ({
            ...i,
            seed: compDomain,
            source: 'competitor_gap',
          }))
        )
      }
    }
  } catch (e) {
    console.warn('Competitor gap discovery skipped:', e.message)
  }

  const blocked = new Set([...existingSet, ...alreadyRanking.map((i) => keywordKey(i.keyword))])

  const goodPool = dedupeByKeyword([...matching, ...related])
    .filter((i) => {
      const key = keywordKey(i.keyword)
      if (!key || blocked.has(key)) return false
      if ((i.difficultyScore || 50) >= 70 && (i.volume || 0) < 100) return false
      if (!isRelevantKeyword(i.keyword, i.intent)) return false
      return true
    })
    .sort((a, b) => {
      const scoreA = (a.volume || 0) * (1 - Math.min(a.difficultyScore || 50, 100) / 120)
      const scoreB = (b.volume || 0) * (1 - Math.min(b.difficultyScore || 50, 100) / 120)
      return scoreB - scoreA
    })

  const howPool = dedupeByKeyword([
    ...questions,
    ...goodPool.filter(
      (i) => i.isQuestion || ((i.volume || 0) < 200 && (i.difficultyScore || 50) < 40)
    ),
  ])
    .filter((i) => {
      const key = keywordKey(i.keyword)
      return key && !blocked.has(key) && isRelevantKeyword(i.keyword, i.intent)
    })
    .sort((a, b) => (b.volume || 0) - (a.volume || 0))

  const goodToHave = goodPool
    .filter((i) => !howPool.some((h) => keywordKey(h.keyword) === keywordKey(i.keyword)))
    .slice(0, 25)
    .map((i) => ({
      keyword: i.keyword,
      volume: i.volume || 0,
      difficulty: i.difficulty || difficultyLabel(i.difficultyScore),
      difficultyScore: i.difficultyScore ?? 0,
      intent: i.intent,
      opportunity: opportunityTag(i.volume, i.difficultyScore),
      source: i.source || 'dfs_ideas',
      why: buildWhy(i, i.seed),
    }))

  const howKeys = new Set(goodToHave.map((i) => keywordKey(i.keyword)))
  const howToGetThem = howPool
    .filter((i) => !howKeys.has(keywordKey(i.keyword)))
    .slice(0, 20)
    .map((i) => ({
      keyword: i.keyword,
      volume: i.volume || 0,
      difficulty: i.difficulty || difficultyLabel(i.difficultyScore),
      difficultyScore: i.difficultyScore ?? 0,
      intent: i.intent,
      source: i.source || 'dfs_questions',
      how: buildHowTip(i),
    }))

  const payload = {
    alreadyRanking,
    goodToHave,
    howToGetThem,
    meta: {
      locale: {
        locationCode: location.code,
        locationName: location.name,
        languageName: location.language,
        country: inferRankingLocale(site).country,
      },
      sourcesUsed: [...new Set(sourcesUsed)],
      importedCount,
      domain,
      siteName: site.name,
      query: AUTO_DISCOVER_QUERY,
    },
  }

  const cleanPayload = sanitizeDiscoveryPayload(payload)
  await persistDiscovery(siteId, cleanPayload)
  return cleanPayload
}

module.exports = {
  AUTO_DISCOVER_QUERY,
  runKeywordAutoDiscover,
  runKeywordGap,
  getCachedDiscovery,
  persistDiscovery,
  sanitizeDiscoveryText,
  sanitizeDiscoveryPayload,
}

/**
 * Keyword Gap: keywords competitors rank for that you don't (or where they outrank you).
 */
async function runKeywordGap({ siteId, competitorDomains = [], locationCode = null, limit = 80 }) {
  const { rows: siteRows } = await pool.query('SELECT * FROM sites WHERE id=$1', [siteId])
  const site = siteRows[0]
  if (!site) {
    const err = new Error('Site not found')
    err.status = 404
    throw err
  }

  const yourDomain = extractDomain(site.url)
  let domains = (Array.isArray(competitorDomains) ? competitorDomains : [])
    .map((d) => extractDomain(d) || String(d || '').trim().toLowerCase())
    .filter((d) => d && d !== yourDomain)

  if (!domains.length) {
    const { rows } = await pool.query(
      'SELECT name, url FROM competitors WHERE site_id=$1 ORDER BY dr DESC LIMIT 4',
      [siteId]
    )
    domains = rows
      .map((r) => extractDomain(r.url || r.name) || String(r.name || '').toLowerCase())
      .filter((d) => d && d !== yourDomain)
      .slice(0, 4)
  }

  domains = [...new Set(domains)].slice(0, 4)
  if (!domains.length) {
    return {
      yourDomain,
      competitors: [],
      missing: [],
      shared: [],
      uniqueToYou: [],
      warning: 'Add competitor domains first.',
    }
  }

  const authHeader = getDataForSEOAuth()
  if (!authHeader) {
    const err = new Error('DataForSEO credentials are not configured')
    err.status = 503
    throw err
  }

  const location = locationCode && DFS_LOCATIONS[locationCode]
    ? DFS_LOCATIONS[locationCode]
    : resolveLocation(site)

  const perDomainLimit = Math.max(30, Math.min(150, Number(limit) || 80))

  const withHardTimeout = (promise, ms, label) =>
    Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => {
          const err = new Error(`${label} took too long. Try fewer competitors or try again.`)
          err.status = 504
          reject(err)
        }, ms)
      ),
    ])

  const [yours, ...compLists] = await withHardTimeout(
    Promise.all([
      fetchDfsRankedKeywords({ authHeader, domain: yourDomain, location, limit: perDomainLimit }),
      ...domains.map((domain) =>
        fetchDfsRankedKeywords({ authHeader, domain, location, limit: perDomainLimit })
      ),
    ]),
    20000,
    'Keyword gap lookup'
  )

  const yourMap = new Map(yours.map((k) => [keywordKey(k.keyword), k]))
  const competitorMaps = domains.map((domain, i) => ({
    domain,
    map: new Map((compLists[i] || []).map((k) => [keywordKey(k.keyword), k])),
  }))

  const allCompKeys = new Set()
  for (const c of competitorMaps) {
    for (const key of c.map.keys()) allCompKeys.add(key)
  }

  const missing = []
  const shared = []
  for (const key of allCompKeys) {
    const yoursItem = yourMap.get(key)
    const fromCompetitors = competitorMaps
      .map((c) => {
        const item = c.map.get(key)
        if (!item) return null
        return { domain: c.domain, position: item.position, volume: item.volume, difficulty: item.difficultyScore }
      })
      .filter(Boolean)
      .sort((a, b) => (a.position || 999) - (b.position || 999))

    if (!fromCompetitors.length) continue
    const best = fromCompetitors[0]
    const base = competitorMaps
      .map((c) => c.map.get(key))
      .find(Boolean)

    const relevant = isRelevantKeyword(base.keyword, base.intent)

    const row = {
      keyword: base.keyword,
      volume: base.volume || best.volume || 0,
      difficulty: base.difficulty,
      difficultyScore: base.difficultyScore,
      intent: base.intent,
      yourPosition: yoursItem?.position ?? null,
      bestCompetitor: best.domain,
      bestCompetitorPosition: best.position,
      competitors: fromCompetitors,
      relevance: relevant,
      opportunity: relevant
        ? opportunityTag(base.volume || 0, base.difficultyScore || 50)
        : {
            label: 'Low relevance',
            color: '#64748b',
            bg: '#f1f5f9',
            score: 0,
          },
    }

    if (yoursItem == null) {
      missing.push(row)
    } else {
      shared.push(row)
    }
  }

  const uniqueToYou = yours
    .filter((k) => !allCompKeys.has(keywordKey(k.keyword)))
    .map((k) => ({
      keyword: k.keyword,
      volume: k.volume || 0,
      difficulty: k.difficulty,
      difficultyScore: k.difficultyScore,
      intent: k.intent,
      yourPosition: k.position,
      opportunity: opportunityTag(k.volume || 0, k.difficultyScore || 50),
    }))

  const byOpp = (a, b) =>
    (b.volume || 0) - (a.volume || 0) ||
    (a.bestCompetitorPosition || 99) - (b.bestCompetitorPosition || 99) ||
    (a.difficultyScore || 50) - (b.difficultyScore || 50)

  missing.sort(byOpp)
  shared.sort(byOpp)
  uniqueToYou.sort((a, b) => (b.volume || 0) - (a.volume || 0))

  // Keyword Gap should surface SEO/business opportunities,
  // not every unrelated phrase a competitor happens to rank for.
  const relevantMissing = missing.filter((row) => row.relevance !== false)
  const relevantShared = shared.filter((row) => row.relevance !== false)

  return {
    yourDomain,
    competitors: domains,
    location: location.name || location.code,
    missing: relevantMissing.slice(0, 100),
    shared: relevantShared.slice(0, 50),
    uniqueToYou: uniqueToYou.slice(0, 50),
    counts: {
      missing: relevantMissing.length,
      shared: relevantShared.length,
      uniqueToYou: uniqueToYou.length,
    },
  }
}
