const axios = require('axios')
const cheerio = require('cheerio')
const { pool } = require('../clients')
const {
  SUPPORTED_ENGINES,
  normalizeEngine,
  extractDomain,
  mapOrganicResults,
  extractLocalPlaces,
  mapLocalResults,
  findLocalMatch,
  inferRankingLocale,
  isDomainMatch,
  engineLabel,
  toRankPosition,
  computeRankMovement,
} = require('./helpers')

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

async function fetchSerpVisibility(keyword, engine, context = {}) {
  const normalizedEngine = normalizeEngine(engine)
  const country = String(context.country || process.env.SERP_COUNTRY || 'us').toLowerCase()
  const language = String(context.language || process.env.SERP_LANGUAGE || 'en').toLowerCase()
  const location = context.location ? String(context.location).trim() : null
  const device = context.device === 'mobile' ? 'mobile' : 'desktop'
  const googleDomain = context.google_domain || (country === 'no' ? 'google.no' : null)

  let local = []

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
                engine: normalizedEngine === 'google' ? 'google' : normalizedEngine,
                device,
                ...(location ? { location } : {}),
                ...(googleDomain && normalizedEngine === 'google' ? { google_domain: googleDomain } : {}),
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
            if (attempt === 2) break
          }
        }

        if (!data) {
          console.warn(
            `Stopping SERP pagination at start=${start}. Collected ${allRows.length} results.`
          )
          break
        }

        // Local Pack only appears on the first results page
        if (start === 0) {
          local = mapLocalResults(extractLocalPlaces(data))
        }

        const pageRows = mapOrganicResults(data.organic_results || [])
        if (!pageRows.length) break

        for (const row of pageRows) {
          if (!row?.url) continue
          const key = row.url.toLowerCase()
          if (seenUrls.has(key)) continue
          seenUrls.add(key)
          allRows.push({ ...row, position: allRows.length + 1 })
          if (allRows.length >= MAX_RANK_DEPTH) break
        }

        if (allRows.length >= MAX_RANK_DEPTH) break

        const nextStart = Number(data?.serpapi_pagination?.next_start)
        if (Number.isFinite(nextStart) && nextStart > start) {
          start = nextStart
          continue
        }
        if (data?.serpapi_pagination?.next || data?.serpapi_pagination?.next_link) {
          start += 10
          continue
        }
        if (pageRows.length >= 10) {
          start += 10
          continue
        }
        break
      }

      if (allRows.length || local.length) {
        return {
          organic: allRows.slice(0, MAX_RANK_DEPTH),
          local,
          source: 'serpapi',
          country,
          location,
        }
      }
    } catch (e) {
      console.error('SerpAPI pagination error:', e.response?.data || e.message)
    }
  }

  if (normalizedEngine === 'google' && process.env.VALUESERP_KEY) {
    try {
      const { data } = await axios.get('https://api.valueserp.com/search', {
        params: {
          api_key: process.env.VALUESERP_KEY,
          q: keyword,
          num: MAX_RANK_DEPTH,
          gl: country,
          hl: language,
          output: 'json',
          ...(location ? { location } : {}),
        },
        timeout: 15000,
      })
      const organic = mapOrganicResults(data.organic_results || [])
      local = mapLocalResults(extractLocalPlaces(data))
      if (organic.length || local.length) {
        return { organic: organic.slice(0, MAX_RANK_DEPTH), local, source: 'valueserp', country, location }
      }
    } catch (e) {
      console.error('ValueSERP error:', e.message)
    }
  }

  try {
    const organic = await scrapeEngineResults(keyword, normalizedEngine)
    return { organic, local: [], source: 'scrape', country, location }
  } catch (e) {
    console.error(`${normalizedEngine} scrape error:`, e.message)
    return { organic: [], local: [], source: 'none', country, location }
  }
}

/** Backward-compatible: organic blue links only. */
async function fetchSerpResults(keyword, engine, context = {}) {
  const snapshot = await fetchSerpVisibility(keyword, engine, context)
  return snapshot.organic || []
}

async function scanSiteKeywordTransitions(siteId, engines = SUPPORTED_ENGINES, keywordLimit = 30) {
  const normalizedEngines = (Array.isArray(engines) ? engines : SUPPORTED_ENGINES).map(normalizeEngine)
  const limit = Math.min(Math.max(parseInt(keywordLimit || 30), 1), 80)

  const { rows: siteRows } = await pool.query('SELECT id, name, url FROM sites WHERE id=$1 LIMIT 1', [siteId])
  const site = siteRows[0]
  if (!site) return { checked: 0, alertsCreated: 0, report: null }
  const targetDomain = extractDomain(site.url)
  const localeDefaults = inferRankingLocale(site)

  const { rows: keywords } = await pool.query(
    'SELECT id, keyword, rank_state, rank_country, rank_language, rank_location FROM keywords WHERE site_id=$1 ORDER BY created_at ASC LIMIT $2',
    [siteId, limit]
  )

  let checked = 0
  let alertsCreated = 0
  const transitions = []
  const engineStats = {}
  normalizedEngines.forEach((engine) => {
    engineStats[engine] = {
      engine,
      label: engineLabel(engine),
      checked: 0,
      inFirstPageCount: 0,
      enteredCount: 0,
      droppedCount: 0,
      localPackCount: 0,
      positions: [],
    }
  })

  const keywordSummaries = []

  for (const kw of keywords) {
    const state = (kw.rank_state && typeof kw.rank_state === 'object') ? kw.rank_state : {}
    const nextState = { ...state }

    for (const engine of normalizedEngines) {
      // Prefer site locale (e.g. Norway) over the old DB default "us"
      const country =
        kw.rank_location
          ? (kw.rank_country || localeDefaults.country || 'us')
          : (!kw.rank_country || kw.rank_country === 'us')
            ? (localeDefaults.country || 'us')
            : kw.rank_country

      const rankingContext = {
        country,
        language: kw.rank_language || localeDefaults.language || 'en',
        location: kw.rank_location || localeDefaults.location || null,
        google_domain:
          localeDefaults.google_domain ||
          (country === 'no' ? 'google.no' : null),
        device: 'desktop',
        brandName: site.name,
        domain: targetDomain,
      }

      const snapshot = await fetchSerpVisibility(kw.keyword, engine, rankingContext)
      const organic = snapshot.organic || []
      const local = snapshot.local || []

      const organicHit = organic.find((r) => isDomainMatch(r.domain, targetDomain))
      const localHit = findLocalMatch(local, { domain: targetDomain, brandName: site.name })
      const currentOrganicPos = toRankPosition(organicHit?.position)
      const currentLocalPos = toRankPosition(localHit?.position)

      const previousRankingResult = await pool.query(
        `SELECT position, local_position
         FROM keyword_rankings
         WHERE keyword_id=$1
           AND site_id=$2
           AND engine=$3
           AND country=$4
           AND language=$5
           AND COALESCE(location, '')=COALESCE($6, '')
           AND device=$7
         ORDER BY checked_at DESC
         LIMIT 1`,
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

      const hasPreviousObservation = previousRankingResult.rows.length > 0
      const prevRow = previousRankingResult.rows[0] || null
      const prevOrganicPos = hasPreviousObservation ? toRankPosition(prevRow?.position) : null
      const prevLocalPos = hasPreviousObservation
        ? toRankPosition(prevRow?.local_position ?? state?.[engine]?.local_position)
        : null

      const organicMovement = computeRankMovement(prevOrganicPos, currentOrganicPos, { hasPreviousObservation })
      const localMovement = computeRankMovement(prevLocalPos, currentLocalPos, { hasPreviousObservation })

      // Real page-1 visibility = Local Pack OR organic top 10
      const wasInFirstPage = (prevLocalPos != null) || (prevOrganicPos != null && prevOrganicPos <= 10)
      const nowInFirstPage = (currentLocalPos != null) || (currentOrganicPos != null && currentOrganicPos <= 10)

      // Display/status prefers Local Pack when present (matches what users see in Google)
      const displayStatus = currentLocalPos != null
        ? (localMovement.status === 'not-ranked' ? 'new' : localMovement.status)
        : organicMovement.status

      engineStats[engine].checked += 1
      if (nowInFirstPage) engineStats[engine].inFirstPageCount += 1
      if (currentLocalPos != null) engineStats[engine].localPackCount += 1
      if (currentOrganicPos != null) engineStats[engine].positions.push(currentOrganicPos)

      if (hasPreviousObservation && wasInFirstPage !== nowInFirstPage) {
        const msg = nowInFirstPage
          ? currentLocalPos != null
            ? `${kw.keyword} is visible on page 1 via Local Pack (#${currentLocalPos}) on ${engineLabel(engine)}.`
            : `${kw.keyword} entered page 1 on ${engineLabel(engine)} at organic #${currentOrganicPos}.`
          : `${kw.keyword} dropped out of page-1 visibility on ${engineLabel(engine)}.`

        await pool.query(
          'INSERT INTO alerts (site_id, type, message, severity) VALUES ($1,$2,$3,$4)',
          [siteId, 'rank-change', msg, nowInFirstPage ? 'info' : 'warning']
        )
        alertsCreated += 1
        transitions.push({
          keyword: kw.keyword,
          engine,
          action: nowInFirstPage ? 'entered' : 'dropped',
          prevPosition: prevOrganicPos,
          prevLocalPosition: prevLocalPos,
          currentPosition: currentOrganicPos,
          currentLocalPosition: currentLocalPos,
        })
        if (nowInFirstPage) engineStats[engine].enteredCount += 1
        else engineStats[engine].droppedCount += 1
      }

      let visibility = 'none'
      if (currentLocalPos != null && currentOrganicPos != null) visibility = 'both'
      else if (currentLocalPos != null) visibility = 'local'
      else if (currentOrganicPos != null) visibility = 'organic'

      nextState[engine] = {
        position: organicMovement.position,
        previous_position: organicMovement.previousPosition,
        change: organicMovement.change,
        status: displayStatus,
        local_position: localMovement.position,
        previous_local_position: localMovement.previousPosition,
        local_change: localMovement.change,
        local_status: localMovement.status,
        visibility,
        in_first_page: nowInFirstPage,
        ranking_url: organicHit?.url || localHit?.url || null,
        local_title: localHit?.title || null,
        checked_at: new Date().toISOString(),
        country: rankingContext.country,
        location: rankingContext.location,
      }

      await pool.query(
        `INSERT INTO keyword_rankings
           (keyword_id, site_id, engine, country, language, location, device,
            position, ranking_url, previous_position, change, status,
            local_position, previous_local_position, local_status, checked_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW())`,
        [
          kw.id,
          siteId,
          engine,
          rankingContext.country,
          rankingContext.language,
          rankingContext.location,
          rankingContext.device,
          organicMovement.position,
          organicHit?.url || localHit?.url || null,
          organicMovement.previousPosition,
          organicMovement.change,
          organicMovement.status,
          localMovement.position,
          localMovement.previousPosition,
          localMovement.status,
        ]
      )
      checked += 1
    }

    const currentByEngine = {}
    normalizedEngines.forEach((engine) => {
      const st = nextState?.[engine] || {}
      const organicPos = toRankPosition(st.position)
      const localPos = toRankPosition(st.local_position)
      currentByEngine[engine] = {
        position: organicPos,
        localPosition: localPos,
        previousPosition: toRankPosition(st.previous_position),
        previousLocalPosition: toRankPosition(st.previous_local_position),
        change: st.change ?? null,
        status: st.status || 'not-ranked',
        visibility: st.visibility || 'none',
        checkedAt: st.checked_at || null,
        inFirstPage: !!st.in_first_page || localPos != null || (organicPos != null && organicPos <= 10),
      }
    })
    keywordSummaries.push({ id: kw.id, keyword: kw.keyword, current: currentByEngine })

    const googleWasScanned = normalizedEngines.includes('google')

    if (googleWasScanned) {
      // Keep keywords.position as best "visible" rank: local pack first, else organic
      const googleBest =
        toRankPosition(nextState?.google?.local_position) ||
        toRankPosition(nextState?.google?.position)

      await pool.query(
        'UPDATE keywords SET rank_state=$1, position=$2 WHERE id=$3 AND site_id=$4',
        [nextState, googleBest, kw.id, siteId]
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
    return {
      engine,
      label: s.label,
      checked: s.checked,
      inFirstPageCount: s.inFirstPageCount,
      localPackCount: s.localPackCount,
      enteredCount: s.enteredCount,
      droppedCount: s.droppedCount,
      avgPosition: avgPos,
    }
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

module.exports = {
  scrapeEngineResults,
  fetchSerpResults,
  fetchSerpVisibility,
  scanSiteKeywordTransitions,
}
