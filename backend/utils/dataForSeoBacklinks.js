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

module.exports = {
  fetchDataForSeoBacklinks,
  normalizeTarget,
}
