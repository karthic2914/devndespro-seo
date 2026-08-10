const axios = require('axios')
const cheerio = require('cheerio')
const { pool } = require('../clients')
const { SUPPORTED_ENGINES, normalizeEngine, extractDomain, mapOrganicResults, isDomainMatch, engineLabel } = require('./helpers')

const MAX_RANK_DEPTH = 100

async function scrapeEngineResults(keyword, engine) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  }
  let results = []

  if (engine === 'google') {
    const { data: html } = await axios.get('https://www.google.com/search', {
      params: { q: keyword, num: 10, hl: 'en', safe: 'active' },
      headers,
      timeout: 12000,
    })
    const $ = cheerio.load(html)
    $('div.g, div[jscontroller][jsaction][data-hveid], article').each((_, el) => {
      if (results.length >= 10) return false
      const a = $(el).find('a[href^="http"]').first()
      const href = a.attr('href')
      const title = $(el).find('h3').first().text().trim()
      const snippet = $(el).find('[data-sncf], .VwiC3b, [style*="-webkit-line-clamp"]').first().text().trim()
      if (href && title && !href.includes('google.com') && !href.includes('youtube.com/results')) {
        const domain = extractDomain(href)
        if (!results.find(r => r.domain === domain)) {
          results.push({ position: results.length + 1, title, url: href, domain, snippet: snippet.slice(0, 220) })
        }
      }
    })
  }

  if (engine === 'bing') {
    const { data: html } = await axios.get('https://www.bing.com/search', {
      params: { q: keyword, count: 10, setlang: 'en-US' },
      headers,
      timeout: 12000,
    })
    const $ = cheerio.load(html)
    $('li.b_algo').each((i, el) => {
      const a = $(el).find('h2 a').first()
      const href = a.attr('href')
      const title = a.text().trim()
      const snippet = $(el).find('.b_caption p').first().text().trim()
      if (href && href.startsWith('http') && title) {
        results.push({ position: i + 1, title, url: href, domain: extractDomain(href), snippet })
      }
    })
  }

  if (engine === 'duckduckgo') {
    const { data: html } = await axios.get('https://duckduckgo.com/html/', {
      params: { q: keyword },
      headers,
      timeout: 12000,
    })
    const $ = cheerio.load(html)
    $('.result').each((i, el) => {
      const a = $(el).find('a.result__a, h2 a').first()
      const href = a.attr('href')
      const title = a.text().trim()
      const snippet = $(el).find('.result__snippet').first().text().trim()
      if (href && href.startsWith('http') && title) {
        results.push({ position: i + 1, title, url: href, domain: extractDomain(href), snippet })
      }
    })
  }

  return results.slice(0, 10)
}

async function fetchSerpResults(keyword, engine, context = {}) {
  const normalizedEngine = normalizeEngine(engine)
const country = String(context.country || process.env.SERP_COUNTRY || 'us').toLowerCase()
const language = String(context.language || process.env.SERP_LANGUAGE || 'en').toLowerCase()
const location = context.location ? String(context.location).trim() : null
const device = context.device === 'mobile' ? 'mobile' : 'desktop'
  if (process.env.SERPAPI_KEY) {
  try {
    const allRows = []
    const seenUrls = new Set()

    let start = 0

    while (start < MAX_RANK_DEPTH) {
      let data = null

      for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
          const response = await axios.get('https://serpapi.com/search.json', {
            params: {
              api_key: process.env.SERPAPI_KEY,
              q: keyword,
              num: 10,
              start,
              gl: country,
              hl: language,
              engine: normalizedEngine,
              device,
              ...(location ? { location } : {}),
            },
            timeout: 20000,
          })

          data = response.data
          break
        } catch (e) {
          console.warn(
            `SerpAPI page start=${start} attempt=${attempt} failed:`,
            e.response?.data || e.message
          )

          if (attempt === 2) {
            break
          }
        }
      }

      if (!data) {
        console.warn(
          `Stopping SERP pagination at start=${start}. Collected ${allRows.length} results.`
        )
        break
      }

      const pageRows = mapOrganicResults(data.organic_results || [])

      if (!pageRows.length) {
        break
      }

      for (const row of pageRows) {
        if (!row?.url) continue

        const key = row.url.toLowerCase()

        if (seenUrls.has(key)) continue
        seenUrls.add(key)

        allRows.push({
          ...row,
          position: allRows.length + 1,
        })

        if (allRows.length >= MAX_RANK_DEPTH) {
          break
        }
      }

      if (allRows.length >= MAX_RANK_DEPTH) {
        break
      }

      const nextStart =
        Number(data?.serpapi_pagination?.next_start)

      if (Number.isFinite(nextStart) && nextStart > start) {
        start = nextStart
        continue
      }

      if (
        data?.serpapi_pagination?.next ||
        data?.serpapi_pagination?.next_link
      ) {
        start += 10
        continue
      }

      if (pageRows.length >= 10) {
        start += 10
        continue
      }

      break
    }

    if (allRows.length) {
      return allRows.slice(0, MAX_RANK_DEPTH)
    }

  } catch (e) {
    console.error(
      'SerpAPI pagination error:',
      e.response?.data || e.message
    )
  }
}
if (normalizedEngine === 'google' && process.env.VALUESERP_KEY) {
    try {
      const { data } = await axios.get('https://api.valueserp.com/search', {
        params: { api_key: process.env.VALUESERP_KEY, q: keyword, num: MAX_RANK_DEPTH, gl: 'us', hl: 'en', output: 'json' },
        timeout: 15000,
      })
      const rows = mapOrganicResults(data.organic_results || [])
      if (rows.length) return rows.slice(0, MAX_RANK_DEPTH)
    } catch (e) { console.error('ValueSERP error:', e.message) }
  }

  try { return await scrapeEngineResults(keyword, normalizedEngine) }
  catch (e) { console.error(`${normalizedEngine} scrape error:`, e.message); return [] }
}

async function scanSiteKeywordTransitions(siteId, engines = SUPPORTED_ENGINES, keywordLimit = 30) {
  const normalizedEngines = (Array.isArray(engines) ? engines : SUPPORTED_ENGINES).map(normalizeEngine)
  const limit = Math.min(Math.max(parseInt(keywordLimit || 30), 1), 80)

  const { rows: siteRows } = await pool.query('SELECT id, name, url FROM sites WHERE id=$1 LIMIT 1', [siteId])
  const site = siteRows[0]
  if (!site) return { checked: 0, alertsCreated: 0, report: null }
  const targetDomain = extractDomain(site.url)

  const { rows: keywords } = await pool.query(
    'SELECT id, keyword, rank_state, rank_country, rank_language, rank_location FROM keywords WHERE site_id=$1 ORDER BY created_at ASC LIMIT $2',
    [siteId, limit]
  )

  let checked = 0
  let alertsCreated = 0
  const transitions = []
  const engineStats = {}
  normalizedEngines.forEach((engine) => {
    engineStats[engine] = { engine, label: engineLabel(engine), checked: 0, inFirstPageCount: 0, enteredCount: 0, droppedCount: 0, positions: [] }
  })

  const keywordSummaries = []

  for (const kw of keywords) {
    const state = (kw.rank_state && typeof kw.rank_state === 'object') ? kw.rank_state : {}
    const nextState = { ...state }

    for (const engine of normalizedEngines) {
      const rankingContext = {
        country: kw.rank_country || 'us',
        language: kw.rank_language || 'en',
        location: kw.rank_location || null,
        device: 'desktop',
      }

      const results = await fetchSerpResults(
        kw.keyword,
        engine,
        rankingContext
      )
      const hit = results.find(r => isDomainMatch(r.domain, targetDomain))
      const currentPos = hit ? hit.position : null

  const previousRankingResult = await pool.query(
    "SELECT position FROM keyword_rankings WHERE keyword_id=$1 AND site_id=$2 AND engine=$3 AND country=$4 AND language=$5 AND COALESCE(location, '')=COALESCE($6, '') AND device=$7 ORDER BY checked_at DESC LIMIT 1",
    [
      kw.id,
      siteId,
      engine,
      rankingContext.country,
      rankingContext.language,
      rankingContext.location,
      rankingContext.device,
    ]
  )

  const previousRankingRaw = previousRankingResult.rows[0]?.position
  const previousRankingPosition = Number(previousRankingRaw) > 0
    ? Number(previousRankingRaw)
    : null

      const prevPosRaw = previousRankingPosition
      const prevPos = Number(prevPosRaw) > 0 ? Number(prevPosRaw) : null
      const wasInFirstPage = !!prevPos && prevPos <= 10
      const nowInFirstPage = !!currentPos && currentPos <= 10

      engineStats[engine].checked += 1
      if (nowInFirstPage) engineStats[engine].inFirstPageCount += 1
      if (currentPos) engineStats[engine].positions.push(currentPos)

      if (prevPos !== null && wasInFirstPage !== nowInFirstPage) {
        const msg = nowInFirstPage
          ? `${kw.keyword} entered page 1 on ${engineLabel(engine)} at #${currentPos}.`
          : `${kw.keyword} dropped out of page 1 on ${engineLabel(engine)} (was #${prevPos}).`

        await pool.query(
          'INSERT INTO alerts (site_id, type, message, severity) VALUES ($1,$2,$3,$4)',
          [siteId, 'rank-change', msg, nowInFirstPage ? 'info' : 'warning']
        )
        alertsCreated += 1
        transitions.push({ keyword: kw.keyword, engine, action: nowInFirstPage ? 'entered' : 'dropped', prevPosition: prevPos, currentPosition: currentPos })
        if (nowInFirstPage) engineStats[engine].enteredCount += 1
        else engineStats[engine].droppedCount += 1
      }

      const hasPreviousObservation = previousRankingResult.rows.length > 0

      let change = null
      let movementStatus = 'initial'

      if (hasPreviousObservation) {
        if (prevPos === null && currentPos !== null) {
          movementStatus = 'new'
        } else if (prevPos !== null && currentPos === null) {
          movementStatus = 'lost'
        } else if (prevPos !== null && currentPos !== null) {
          change = prevPos - currentPos

          if (change > 0) {
            movementStatus = 'up'
          } else if (change < 0) {
            movementStatus = 'down'
          } else {
            movementStatus = 'same'
          }
        } else {
          movementStatus = 'not-ranked'
        }
      }

      nextState[engine] = {
        position: currentPos,
        previous_position: hasPreviousObservation ? prevPos : null,
        change,
        status: movementStatus,
        checked_at: new Date().toISOString(),
      }

  await pool.query(
    "INSERT INTO keyword_rankings (keyword_id, site_id, engine, country, language, location, device, position, ranking_url, previous_position, change, status, checked_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())",
    [
      kw.id,
      siteId,
      engine,
      rankingContext.country,
      rankingContext.language,
      rankingContext.location,
      rankingContext.device,
      currentPos,
      hit?.url || null,
      hasPreviousObservation ? prevPos : null,
      change,
      movementStatus,
    ]
  )
      checked += 1
    }

    const currentByEngine = {}
    normalizedEngines.forEach((engine) => {
      const pRaw = nextState?.[engine]?.position
      const pos = Number.isFinite(Number(pRaw)) ? Number(pRaw) : null
      currentByEngine[engine] = {
      position: pos,
      previousPosition: nextState?.[engine]?.previous_position ?? null,
      change: nextState?.[engine]?.change ?? null,
      status: nextState?.[engine]?.status || 'initial',
      checkedAt: nextState?.[engine]?.checked_at || null,
      inFirstPage: !!pos && pos <= 10,
    }
    })
    keywordSummaries.push({ id: kw.id, keyword: kw.keyword, current: currentByEngine })

    const googleWasScanned = normalizedEngines.includes('google')

if (googleWasScanned) {
  const googlePositionRaw = nextState?.google?.position
  const googlePosition = Number.isFinite(Number(googlePositionRaw))
    ? Number(googlePositionRaw)
    : null

  await pool.query(
    'UPDATE keywords SET rank_state=$1, position=$2 WHERE id=$3 AND site_id=$4',
    [nextState, googlePosition, kw.id, siteId]
  )
} else {
  await pool.query(
    'UPDATE keywords SET rank_state=$1 WHERE id=$2 AND site_id=$3',
    [nextState, kw.id, siteId]
  )
}
  }

  const enginesSummary = normalizedEngines.map((engine) => {
    const s = engineStats[engine]
    const avgPos = s.positions.length
      ? Number((s.positions.reduce((sum, n) => sum + n, 0) / s.positions.length).toFixed(1))
      : null
    return { engine, label: s.label, checked: s.checked, inFirstPageCount: s.inFirstPageCount, enteredCount: s.enteredCount, droppedCount: s.droppedCount, avgPosition: avgPos }
  })

  const report = {
    generatedAt: new Date().toISOString(),
    siteId: site.id,
    siteName: site.name,
    siteUrl: site.url,
    siteDomain: targetDomain,
    checkedKeywords: keywords.length,
    checked,
    alertsCreated,
    transitions,
    engines: enginesSummary,
    keywordSummaries,
  }

  return { checked, alertsCreated, report }
}

module.exports = { scrapeEngineResults, fetchSerpResults, scanSiteKeywordTransitions }
