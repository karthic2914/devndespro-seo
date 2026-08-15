const { URL } = require('url')

const ENDPOINT =
  'https://api.dataforseo.com/v3/backlinks/backlinks/live'

const getCredentials = () => {
  const login =
    process.env.DATAFORSEO_LOGIN ||
    process.env.DATAFORSEO_API_LOGIN ||
    ''

  const password =
    process.env.DATAFORSEO_PASSWORD ||
    process.env.DATAFORSEO_API_PASSWORD ||
    ''

  return {
    login: String(login).trim(),
    password: String(password).trim(),
  }
}

const normalizeTarget = (raw) => {
  const value = String(raw || '').trim()
  if (!value) return ''

  try {
    const url = new URL(
      /^https?:\/\//i.test(value)
        ? value
        : `https://${value}`
    )

    return url.hostname
      .replace(/^www\./i, '')
      .toLowerCase()
  } catch {
    return value
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .split('/')[0]
      .toLowerCase()
  }
}

const normalizeUrl = (raw) => {
  const value = String(raw || '').trim()
  if (!value) return ''

  try {
    const url = new URL(
      /^https?:\/\//i.test(value)
        ? value
        : `https://${value}`
    )
    url.hash = ''
    return url.href
  } catch {
    return ''
  }
}

const parseDate = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return null

  const normalized = raw
    .replace(
      /^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2}):(\d{2}) ([+-]\d{2}:\d{2})$/,
      '$1T$2:$3:$4$5'
    )

  const date = new Date(normalized)
  return Number.isNaN(date.getTime())
    ? null
    : date.toISOString()
}

const fetchDataForSeoBacklinks = async ({
  target,
  limit = 500,
  offset = 0,
  mode = 'as_is',
}) => {
  const credentials = getCredentials()

  if (!credentials.login || !credentials.password) {
    throw new Error(
      'DataForSEO credentials are missing. Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD in the backend environment.'
    )
  }

  const normalizedTarget = normalizeTarget(target)

  if (!normalizedTarget) {
    throw new Error('Invalid backlink target')
  }

  const safeLimit = Math.max(
    1,
    Math.min(1000, Number(limit || 500))
  )

  const safeOffset = Math.max(
    0,
    Math.min(20000, Number(offset || 0))
  )

  const auth = Buffer.from(
    `${credentials.login}:${credentials.password}`
  ).toString('base64')

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify([
      {
        target: normalizedTarget,
        mode,
        limit: safeLimit,
        offset: safeOffset,
        backlinks_status_type: 'live',
        include_subdomains: true,
        exclude_internal_backlinks: true,
        rank_scale: 'one_hundred',
        order_by: [
          'domain_from_rank,desc',
          'page_from_rank,desc',
        ],
        tag: 'devndespro-backlink-sync',
      },
    ]),
  })

  const text = await response.text()

  let payload
  try {
    payload = JSON.parse(text)
  } catch {
    throw new Error(
      `DataForSEO returned invalid JSON (HTTP ${response.status})`
    )
  }

  if (!response.ok) {
    throw new Error(
      `DataForSEO HTTP ${response.status}: ` +
      String(
        payload?.status_message ||
        text ||
        'Request failed'
      ).slice(0, 300)
    )
  }

  const task = payload?.tasks?.[0]

  if (!task) {
    throw new Error('DataForSEO response contained no task')
  }

  if (
    Number(task.status_code || 0) >= 40000
  ) {
    throw new Error(
      `DataForSEO task failed: ${
        task.status_message || task.status_code
      }`
    )
  }

  const result = task?.result?.[0] || {}
  const items = Array.isArray(result?.items)
    ? result.items
    : []

  return {
    provider: 'dataforseo',
    target: normalizedTarget,
    totalCount: Number(result?.total_count || 0),
    itemsCount: Number(result?.items_count || items.length),
    cost: Number(task?.cost || 0),
    searchAfterToken:
      result?.search_after_token || null,
    items: items.map((item) => {
      const attributes = Array.isArray(item?.attributes)
        ? item.attributes.map((x) =>
            String(x || '').toLowerCase()
          )
        : []

      return {
        sourceDomain:
          String(item?.domain_from || '').toLowerCase(),
        sourceUrl:
          normalizeUrl(item?.url_from),
        targetUrl:
          normalizeUrl(item?.url_to),
        targetDomain:
          String(item?.domain_to || '').toLowerCase(),
        anchor:
          String(item?.anchor || ''),
        textPre:
          String(item?.text_pre || ''),
        textPost:
          String(item?.text_post || ''),
        semanticLocation:
          String(item?.semantic_location || ''),
        dofollow:
          Boolean(item?.dofollow),
        nofollow:
          !Boolean(item?.dofollow) ||
          attributes.includes('nofollow'),
        sponsored:
          attributes.includes('sponsored'),
        ugc:
          attributes.includes('ugc'),
        rank:
          Number(item?.domain_from_rank || 0),
        pageRank:
          Number(item?.page_from_rank || 0),
        backlinkRank:
          Number(item?.rank || 0),
        spamScore:
          Number(item?.backlink_spam_score || 0),
        httpStatus:
          Number(item?.page_from_status_code || 0) || null,
        targetStatus:
          Number(item?.url_to_status_code || 0) || null,
        sourceTitle:
          String(item?.page_from_title || ''),
        sourceLanguage:
          String(item?.page_from_language || ''),
        firstSeen:
          parseDate(item?.first_seen),
        lastSeen:
          parseDate(item?.last_seen),
        isNew:
          Boolean(item?.is_new),
        isLost:
          Boolean(item?.is_lost),
        isBroken:
          Boolean(item?.is_broken),
        linksCount:
          Number(item?.links_count || 1),
        attributes,
        raw: item,
      }
    }).filter((item) =>
      item.sourceUrl &&
      item.sourceDomain
    ),
  }
}

const TIMESERIES_ENDPOINT =
  'https://api.dataforseo.com/v3/backlinks/timeseries_summary/live'

const formatYmd = (date) => {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

/**
 * Live monthly backlink / referring-domain history from DataForSEO.
 * Docs: POST /v3/backlinks/timeseries_summary/live
 */
const fetchDataForSeoTimeseries = async ({
  target,
  months = 12,
  dateFrom,
  dateTo,
}) => {
  const credentials = getCredentials()

  if (!credentials.login || !credentials.password) {
    throw new Error(
      'DataForSEO credentials are missing. Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD in the backend environment.'
    )
  }

  const normalizedTarget = normalizeTarget(target)
  if (!normalizedTarget) {
    throw new Error('Invalid backlink target')
  }

  const safeMonths = Math.max(1, Math.min(36, Number(months || 12)))
  const to = dateTo ? new Date(dateTo) : new Date()
  const from = dateFrom
    ? new Date(dateFrom)
    : new Date(to.getFullYear(), to.getMonth() - (safeMonths - 1), 1)

  const auth = Buffer.from(
    `${credentials.login}:${credentials.password}`
  ).toString('base64')

  const response = await fetch(TIMESERIES_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify([
      {
        target: normalizedTarget,
        date_from: formatYmd(from),
        date_to: formatYmd(to),
        group_range: 'month',
        include_subdomains: true,
        rank_scale: 'one_hundred',
        tag: 'devndespro-backlink-growth',
      },
    ]),
  })

  const text = await response.text()
  let payload
  try {
    payload = JSON.parse(text)
  } catch {
    throw new Error(
      `DataForSEO returned invalid JSON (HTTP ${response.status})`
    )
  }

  if (!response.ok) {
    throw new Error(
      `DataForSEO HTTP ${response.status}: ` +
      String(payload?.status_message || text || 'Request failed').slice(0, 300)
    )
  }

  const task = payload?.tasks?.[0]
  if (!task) {
    throw new Error('DataForSEO response contained no task')
  }
  if (Number(task.status_code || 0) >= 40000) {
    throw new Error(
      `DataForSEO task failed: ${task.status_message || task.status_code}`
    )
  }

  const result = task?.result?.[0] || {}
  const items = Array.isArray(result?.items) ? result.items : []

  const series = items
    .map((item) => {
      const date = parseDate(item?.date) || item?.date
      const d = date ? new Date(date) : null
      if (!d || Number.isNaN(d.getTime())) return null
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
      return {
        key,
        date: formatYmd(d),
        backlinks: Number(item?.backlinks || 0),
        referringDomains: Number(
          item?.referring_main_domains ||
          item?.referring_domains ||
          0
        ),
        rank: Number(item?.rank || 0),
      }
    })
    .filter(Boolean)
    .sort((a, b) => String(a.key).localeCompare(String(b.key)))

  return {
    provider: 'dataforseo',
    target: normalizedTarget,
    dateFrom: formatYmd(from),
    dateTo: formatYmd(to),
    cost: Number(task?.cost || 0),
    series,
  }
}

module.exports = {
  fetchDataForSeoBacklinks,
  fetchDataForSeoTimeseries,
  fetchBacklinkCompetitors,
  fetchBacklinkOverview,
  fetchDomainIntersection,
  normalizeTarget,
}

async function dfsPost(path, body) {
  const credentials = getCredentials()
  if (!credentials.login || !credentials.password) {
    throw new Error(
      'DataForSEO credentials are missing. Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD in the backend environment.'
    )
  }
  const auth = Buffer.from(
    `${credentials.login}:${credentials.password}`
  ).toString('base64')

  const response = await fetch(`https://api.dataforseo.com/v3/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  })

  const text = await response.text()
  let payload
  try {
    payload = JSON.parse(text)
  } catch {
    throw new Error(`DataForSEO returned invalid JSON (HTTP ${response.status})`)
  }

  if (!response.ok) {
    throw new Error(
      `DataForSEO HTTP ${response.status}: ` +
        String(payload?.status_message || text || 'Request failed').slice(0, 300)
    )
  }

  const task = payload?.tasks?.[0]
  if (!task) throw new Error('DataForSEO response contained no task')
  if (Number(task.status_code || 0) >= 40000) {
    throw new Error(`DataForSEO task failed: ${task.status_message || task.status_code}`)
  }

  return { task, result: task?.result?.[0] || {}, cost: Number(task?.cost || 0) }
}

/**
 * Domains that share backlink profile with target (backlink competitors).
 */
async function fetchBacklinkCompetitors({ target, limit = 10 } = {}) {
  const normalizedTarget = normalizeTarget(target)
  if (!normalizedTarget) throw new Error('Invalid backlink target')

  const { result, cost } = await dfsPost('backlinks/competitors/live', [
    {
      target: normalizedTarget,
      limit: Math.max(1, Math.min(50, Number(limit) || 10)),
      order_by: ['intersections,desc', 'rank,desc'],
      filters: ['intersections', '>', 2],
      rank_scale: 'one_hundred',
      tag: 'devndespro-bl-competitors',
    },
  ])

  const items = Array.isArray(result?.items) ? result.items : []
  return {
    provider: 'dataforseo',
    target: normalizedTarget,
    cost,
    items: items
      .map((item) => ({
        domain: normalizeTarget(item?.target || item?.domain || ''),
        rank: Number(item?.rank || 0),
        intersections: Number(item?.intersections || 0),
      }))
      .filter((x) => x.domain && x.domain !== normalizedTarget),
  }
}

/**
 * Backlink overview / summary for a domain.
 */
async function fetchBacklinkOverview({ target } = {}) {
  const normalizedTarget = normalizeTarget(target)
  if (!normalizedTarget) throw new Error('Invalid backlink target')

  const { result, cost } = await dfsPost('backlinks/summary/live', [
    {
      target: normalizedTarget,
      include_subdomains: true,
      rank_scale: 'one_hundred',
      tag: 'devndespro-bl-overview',
    },
  ])

  return {
    provider: 'dataforseo',
    target: normalizedTarget,
    cost,
    // Keep null when API omits rank — do not coerce missing → 0
    rank:
      result?.rank === undefined || result?.rank === null
        ? null
        : Number(result.rank),
    backlinks: Number(result?.backlinks || 0),
    referringDomains: Number(
      result?.referring_main_domains || result?.referring_domains || 0
    ),
    referringPages: Number(result?.referring_pages || 0),
    brokenBacklinks: Number(result?.broken_backlinks || 0),
    dofollow: Number(result?.referring_links_dofollow || result?.dofollow || 0),
  }
}

/**
 * Domains linking to competitor targets but not to excludeTargets (link gap).
 */
async function fetchDomainIntersection({
  targets = {},
  excludeTargets = [],
  limit = 20,
} = {}) {
  const cleanTargets = {}
  for (const [k, v] of Object.entries(targets || {})) {
    const d = normalizeTarget(v)
    if (d) cleanTargets[String(k)] = d
  }
  if (!Object.keys(cleanTargets).length) {
    throw new Error('At least one intersection target is required')
  }

  const exclude = (Array.isArray(excludeTargets) ? excludeTargets : [])
    .map(normalizeTarget)
    .filter(Boolean)

  const payload = {
    targets: cleanTargets,
    limit: Math.max(1, Math.min(100, Number(limit) || 20)),
    order_by: ['1.rank,desc'],
    rank_scale: 'one_hundred',
    tag: 'devndespro-bl-intersection',
  }
  if (exclude.length) payload.exclude_targets = exclude

  const { result, cost } = await dfsPost('backlinks/domain_intersection/live', [payload])
  const items = Array.isArray(result?.items) ? result.items : []

  return {
    provider: 'dataforseo',
    cost,
    items: items.map((item) => {
      const first = item?.domain_intersection?.['1'] || item?.domain_intersection?.[1] || {}
      return {
        domain: normalizeTarget(item?.domain || first?.target || first?.domain || ''),
        rank: Number(first?.rank || item?.rank || 0),
        backlinks: Number(first?.backlinks || item?.backlinks || 0),
      }
    }).filter((x) => x.domain),
  }
}
