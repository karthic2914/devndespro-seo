const { URL } = require('url')
const { verifyBacklink } = require('./backlinkVerifier')

const SEARCH_ENDPOINT =
  'https://api.search.brave.com/res/v1/web/search'

const MAX_RESULTS_PER_QUERY = 20
const MAX_SEARCH_OFFSETS = 4

const normalizeUrl = (raw) => {
  const value = String(raw || '').trim()
  if (!value) return ''

  try {
    const withProtocol = /^https?:\/\//i.test(value)
      ? value
      : `https://${value}`

    const url = new URL(withProtocol)

    if (!['http:', 'https:'].includes(url.protocol)) {
      return ''
    }

    url.hash = ''

    // Remove common tracking parameters so the same source page
    // does not become multiple backlink candidates.
    const trackingParams = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'gclid',
      'fbclid',
    ]

    for (const key of trackingParams) {
      url.searchParams.delete(key)
    }

    return url.href
  } catch {
    return ''
  }
}

const normalizeHost = (raw) => {
  const normalized = normalizeUrl(raw)
  if (!normalized) return ''

  try {
    return new URL(normalized)
      .hostname
      .replace(/^www\./i, '')
      .toLowerCase()
  } catch {
    return ''
  }
}

const cleanSiteName = (name) =>
  String(name || '')
    .replace(/[^\p{L}\p{N} ._-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const domainVariants = (siteUrl) => {
  const host = normalizeHost(siteUrl)
  if (!host) return []

  return [
    host,
    `www.${host}`,
    `https://${host}`,
    `https://www.${host}`,
    `http://${host}`,
    `http://www.${host}`,
  ]
}

const buildDiscoveryQueries = ({ siteName, siteUrl }) => {
  const targetHost = normalizeHost(siteUrl)
  const cleanName = cleanSiteName(siteName)

  if (!targetHost) return []

  const queries = [
    `"${targetHost}" NOT site:${targetHost}`,
    `inpage:"${targetHost}" NOT site:${targetHost}`,
    `"https://${targetHost}" NOT site:${targetHost}`,
    `"https://www.${targetHost}" NOT site:${targetHost}`,
    `"www.${targetHost}" NOT site:${targetHost}`,
  ]

  if (
    cleanName &&
    cleanName.toLowerCase() !== targetHost.toLowerCase()
  ) {
    queries.push(
      `"${cleanName}" "${targetHost}" NOT site:${targetHost}`,
      `"${cleanName}" NOT site:${targetHost}`
    )
  }

  return [...new Set(queries)]
    .filter(Boolean)
    .slice(0, 10)
}

const candidateEvidenceScore = ({
  item,
  targetHost,
  siteName,
}) => {
  const haystack = [
    item.title,
    item.description,
    ...(Array.isArray(item.extraSnippets)
      ? item.extraSnippets
      : []),
  ]
    .join(' ')
    .toLowerCase()

  let score = 0

  if (haystack.includes(targetHost.toLowerCase())) {
    score += 60
  }

  const compactHost = targetHost
    .replace(/\./g, '')
    .toLowerCase()

  if (
    compactHost &&
    haystack.replace(/[^a-z0-9]/g, '').includes(compactHost)
  ) {
    score += 15
  }

  const cleanName = cleanSiteName(siteName).toLowerCase()

  if (cleanName && haystack.includes(cleanName)) {
    score += 20
  }

  if (
    /href|website|visit|source|portfolio|profile|author|directory|agency/i
      .test(haystack)
  ) {
    score += 5
  }

  return Math.min(100, score)
}

const searchBravePage = async ({
  query,
  apiKey,
  offset = 0,
  count = MAX_RESULTS_PER_QUERY,
  country = 'ALL',
  searchLang = 'en',
}) => {
  if (!apiKey) {
    return {
      provider: 'brave',
      configured: false,
      results: [],
      moreResultsAvailable: false,
      error: 'BRAVE_SEARCH_API_KEY is not configured',
    }
  }

  const params = new URLSearchParams({
    q: query,
    count: String(
      Math.max(
        1,
        Math.min(MAX_RESULTS_PER_QUERY, Number(count || 20))
      )
    ),
    offset: String(
      Math.max(
        0,
        Math.min(9, Number(offset || 0))
      )
    ),
    country,
    search_lang: searchLang,
    extra_snippets: 'true',
    safesearch: 'moderate',
  })

  try {
    const response = await fetch(
      `${SEARCH_ENDPOINT}?${params.toString()}`,
      {
        headers: {
          Accept: 'application/json',
          'X-Subscription-Token': apiKey,
        },
      }
    )

    if (!response.ok) {
      const body = await response.text().catch(() => '')

      return {
        provider: 'brave',
        configured: true,
        results: [],
        moreResultsAvailable: false,
        error:
          `Search API HTTP ${response.status}: ` +
          body.slice(0, 240),
      }
    }

    const data = await response.json()

    const rawResults = Array.isArray(data?.web?.results)
      ? data.web.results
      : []

    const results = rawResults
      .map((item) => ({
        url: normalizeUrl(item?.url),
        title: String(item?.title || '').trim(),
        description: String(
          item?.description || ''
        ).trim(),
        extraSnippets: Array.isArray(item?.extra_snippets)
          ? item.extra_snippets
          : [],
        query,
        provider: 'brave',
        offset,
      }))
      .filter((item) => item.url)

    return {
      provider: 'brave',
      configured: true,
      results,
      moreResultsAvailable:
        Boolean(data?.query?.more_results_available),
      error: '',
    }
  } catch (error) {
    return {
      provider: 'brave',
      configured: true,
      results: [],
      moreResultsAvailable: false,
      error: String(
        error?.message || 'Search request failed'
      ),
    }
  }
}

const dedupeCandidates = ({
  candidates,
  targetUrl,
  siteName,
}) => {
  const targetHost = normalizeHost(targetUrl)
  const seenUrls = new Set()
  const output = []

  for (const candidate of candidates) {
    const url = normalizeUrl(candidate?.url)
    if (!url) continue

    const host = normalizeHost(url)

    // Never attempt to count the target site's own pages as backlinks.
    if (!host || host === targetHost) continue

    const key = url
      .replace(/\/$/, '')
      .toLowerCase()

    if (seenUrls.has(key)) continue
    seenUrls.add(key)

    output.push({
      ...candidate,
      url,
      domain: host,
      evidenceScore: candidateEvidenceScore({
        item: candidate,
        targetHost,
        siteName,
      }),
    })
  }

  return output.sort((a, b) => {
    if (b.evidenceScore !== a.evidenceScore) {
      return b.evidenceScore - a.evidenceScore
    }

    return a.domain.localeCompare(b.domain)
  })
}

const discoverCandidates = async ({
  siteName,
  siteUrl,
  seedUrls = [],
  opportunityUrls = [],
  maxResults = 120,
  country = 'ALL',
  searchLang = 'en',
}) => {
  const errors = []
  const candidates = []
  const queries = buildDiscoveryQueries({
    siteName,
    siteUrl,
  })

  const apiKey =
    process.env.BRAVE_SEARCH_API_KEY || ''

  let requestsMade = 0

  if (apiKey) {
    for (const query of queries) {
      if (candidates.length >= maxResults) break

      for (
        let offset = 0;
        offset < MAX_SEARCH_OFFSETS;
        offset += 1
      ) {
        if (candidates.length >= maxResults) break

        const result = await searchBravePage({
          query,
          apiKey,
          offset,
          count: MAX_RESULTS_PER_QUERY,
          country,
          searchLang,
        })

        requestsMade += 1

        if (result.error) {
          errors.push({
            provider: result.provider,
            query,
            offset,
            error: result.error,
          })
          break
        }

        for (const item of result.results) {
          candidates.push(item)

          if (candidates.length >= maxResults) {
            break
          }
        }

        if (!result.moreResultsAvailable) {
          break
        }
      }
    }
  } else {
    errors.push({
      provider: 'brave',
      query: '',
      error:
        'BRAVE_SEARCH_API_KEY is not configured. ' +
        'Automatic public-web discovery is disabled.',
    })
  }

  // Explicit source-page seeds are always supported.
  // Do NOT pass the target site's own homepage as a seed.
  for (const raw of seedUrls) {
    const url = normalizeUrl(raw)
    if (!url) continue

    candidates.push({
      url,
      title: '',
      description: '',
      extraSnippets: [],
      query: 'explicit-seed',
      provider: 'seed',
      offset: 0,
    })
  }

  // Existing prospect/opportunity URLs are also verified.
  for (const raw of opportunityUrls) {
    const url = normalizeUrl(raw)
    if (!url) continue

    candidates.push({
      url,
      title: '',
      description: '',
      extraSnippets: [],
      query: 'saved-opportunity',
      provider: 'opportunity',
      offset: 0,
    })
  }

  const deduped = dedupeCandidates({
    candidates,
    targetUrl: siteUrl,
    siteName,
  }).slice(0, maxResults)

  return {
    providerConfigured: Boolean(apiKey),
    provider: 'brave',
    queries,
    queryCount: queries.length,
    requestsMade,
    targetVariants: domainVariants(siteUrl),
    candidates: deduped,
    errors,
  }
}

const verifyCandidateBatch = async ({
  candidates,
  targetUrl,
  concurrency = 4,
}) => {
  const queue = [...candidates]
  const results = []

  const workerCount = Math.max(
    1,
    Math.min(8, Number(concurrency || 4))
  )

  const worker = async () => {
    while (queue.length) {
      const candidate = queue.shift()
      if (!candidate) return

      const verification = await verifyBacklink({
        sourceUrl: candidate.url,
        targetUrl,
      })

      results.push({
        candidate,
        verification,
      })
    }
  }

  await Promise.all(
    Array.from(
      { length: workerCount },
      () => worker()
    )
  )

  return results.sort((a, b) => {
    const liveDelta =
      Number(Boolean(b.verification?.isLive)) -
      Number(Boolean(a.verification?.isLive))

    if (liveDelta !== 0) return liveDelta

    return (
      Number(b.candidate?.evidenceScore || 0) -
      Number(a.candidate?.evidenceScore || 0)
    )
  })
}

module.exports = {
  discoverCandidates,
  verifyCandidateBatch,
  normalizeUrl,
  normalizeHost,
  buildDiscoveryQueries,
  domainVariants,
}