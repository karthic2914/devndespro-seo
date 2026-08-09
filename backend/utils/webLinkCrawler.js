const dns = require('dns').promises
const net = require('net')
const { URL } = require('url')

const MAX_HTML_BYTES = 2 * 1024 * 1024
const DEFAULT_TIMEOUT_MS = 12000
const MAX_REDIRECTS = 5

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const normalizeUrl = (raw, baseUrl = null) => {
  const value = String(raw || '').trim()
  if (!value) return ''

  try {
    const url = baseUrl
      ? new URL(value, baseUrl)
      : new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`)

    if (!['http:', 'https:'].includes(url.protocol)) return ''

    url.hash = ''

    for (const key of [
      'utm_source', 'utm_medium', 'utm_campaign',
      'utm_term', 'utm_content', 'gclid', 'fbclid'
    ]) {
      url.searchParams.delete(key)
    }

    return url.href
  } catch {
    return ''
  }
}

const normalizeHost = (raw) => {
  const url = normalizeUrl(raw)
  if (!url) return ''
  try {
    return new URL(url).hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return ''
  }
}

const isPrivateIpv4 = (ip) => {
  const p = ip.split('.').map(Number)
  if (p.length !== 4) return false
  const [a, b] = p
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  )
}

const isPrivateIpv6 = (ip) => {
  const v = String(ip || '').toLowerCase()
  return (
    v === '::1' ||
    v === '::' ||
    v.startsWith('fc') ||
    v.startsWith('fd') ||
    v.startsWith('fe80:')
  )
}

const assertPublicUrl = async (rawUrl) => {
  const normalized = normalizeUrl(rawUrl)
  if (!normalized) throw new Error('Invalid URL')

  const url = new URL(normalized)
  const hostname = url.hostname.toLowerCase()

  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local')
  ) {
    throw new Error('Local/private hosts are not crawlable')
  }

  if (net.isIP(hostname)) {
    if (
      (net.isIPv4(hostname) && isPrivateIpv4(hostname)) ||
      (net.isIPv6(hostname) && isPrivateIpv6(hostname))
    ) {
      throw new Error('Private IP addresses are not crawlable')
    }
    return normalized
  }

  const addresses = await dns.lookup(hostname, { all: true, verbatim: true })
  if (!addresses.length) throw new Error('Host did not resolve')

  for (const entry of addresses) {
    if (
      (entry.family === 4 && isPrivateIpv4(entry.address)) ||
      (entry.family === 6 && isPrivateIpv6(entry.address))
    ) {
      throw new Error('Host resolves to a private IP address')
    }
  }

  return normalized
}

const attr = (tag, name) => {
  const re = new RegExp(
    `${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    'i'
  )
  const m = String(tag || '').match(re)
  return m ? (m[1] ?? m[2] ?? m[3] ?? '') : ''
}

const stripTags = (value) =>
  String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()

const pageTitle = (html) => {
  const m = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return m ? stripTags(m[1]).slice(0, 300) : ''
}

const canonicalUrl = (html, baseUrl) => {
  const tags = String(html || '').match(/<link\b[^>]*>/gi) || []
  for (const tag of tags) {
    const rel = attr(tag, 'rel').toLowerCase().split(/\s+/)
    if (!rel.includes('canonical')) continue
    const href = attr(tag, 'href')
    if (!href) continue
    return normalizeUrl(href, baseUrl)
  }
  return ''
}

const detectPosition = (html, index) => {
  const before = html.slice(0, index).toLowerCase()
  const open = (tag) => before.lastIndexOf(`<${tag}`)
  const close = (tag) => before.lastIndexOf(`</${tag}>`)

  if (open('footer') > close('footer')) return 'footer'
  if (open('nav') > close('nav')) return 'navigation'
  if (open('aside') > close('aside')) return 'sidebar'
  if (open('header') > close('header')) return 'header'
  if (open('article') > close('article')) return 'article'
  if (open('main') > close('main')) return 'main-content'
  return 'body'
}

const extractLinks = (html, sourceUrl) => {
  const sourceDomain = normalizeHost(sourceUrl)
  const anchors = String(html || '').match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) || []
  const links = []

  for (const tag of anchors) {
    const openTag = tag.match(/^<a\b[^>]*>/i)?.[0] || ''
    const href = attr(openTag, 'href')

    if (
      !href ||
      href.startsWith('#') ||
      /^mailto:/i.test(href) ||
      /^tel:/i.test(href) ||
      /^javascript:/i.test(href)
    ) continue

    const targetUrl = normalizeUrl(href, sourceUrl)
    const targetDomain = normalizeHost(targetUrl)
    if (!targetUrl || !targetDomain) continue

    const rel = attr(openTag, 'rel').toLowerCase().split(/\s+/).filter(Boolean)
    const index = html.indexOf(tag)

    links.push({
      sourceUrl,
      sourceDomain,
      targetUrl,
      targetDomain,
      anchorText: stripTags(
        tag.replace(/^<a\b[^>]*>/i, '').replace(/<\/a>$/i, '')
      ).slice(0, 500),
      relNofollow: rel.includes('nofollow'),
      relSponsored: rel.includes('sponsored'),
      relUgc: rel.includes('ugc'),
      linkPosition: detectPosition(html, index),
    })
  }

  const seen = new Set()
  return links.filter((link) => {
    const key = `${link.targetUrl.toLowerCase()}|${link.anchorText.toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const parseRobots = (text, userAgent) => {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*$/, '').trim())
    .filter(Boolean)

  const groups = []
  let current = null

  for (const line of lines) {
    const i = line.indexOf(':')
    if (i < 0) continue

    const key = line.slice(0, i).trim().toLowerCase()
    const value = line.slice(i + 1).trim()

    if (key === 'user-agent') {
      if (!current || current.rules.length > 0) {
        current = { agents: [], rules: [] }
        groups.push(current)
      }
      current.agents.push(value.toLowerCase())
      continue
    }

    if (current && ['allow', 'disallow'].includes(key)) {
      current.rules.push({ type: key, path: value })
    }
  }

  const ua = String(userAgent || '').toLowerCase()
  return groups
    .filter((group) =>
      group.agents.some((agent) => agent === '*' || ua.includes(agent))
    )
    .flatMap((group) => group.rules)
}

const robotsAllows = ({ rules, pathname }) => {
  if (!Array.isArray(rules) || !rules.length) return true

  const matches = rules
    .filter((rule) => rule.path && pathname.startsWith(rule.path))
    .sort((a, b) => b.path.length - a.path.length)

  if (!matches.length) return true
  return matches[0].type === 'allow'
}

const createCrawler = ({
  userAgent = 'DevnDesproBot/1.0 (+https://www.devndespro.com)',
  timeoutMs = DEFAULT_TIMEOUT_MS,
  domainDelayMs = 1200,
}) => {
  const robotsCache = new Map()
  const hostLastRequest = new Map()

  const politeWait = async (host) => {
    const last = hostLastRequest.get(host) || 0
    const elapsed = Date.now() - last
    const wait = Math.max(0, domainDelayMs - elapsed)
    if (wait > 0) await sleep(wait)
    hostLastRequest.set(host, Date.now())
  }

  const safeFetch = async (rawUrl, options = {}) => {
    let currentUrl = await assertPublicUrl(rawUrl)

    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
      await politeWait(normalizeHost(currentUrl))

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeoutMs)

      try {
        const response = await fetch(currentUrl, {
          ...options,
          redirect: 'manual',
          signal: controller.signal,
          headers: {
            'user-agent': userAgent,
            accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
            ...(options.headers || {}),
          },
        })

        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get('location')
          if (!location) return { response, finalUrl: currentUrl }

          currentUrl = await assertPublicUrl(
            normalizeUrl(location, currentUrl)
          )
          continue
        }

        return { response, finalUrl: currentUrl }
      } finally {
        clearTimeout(timer)
      }
    }

    throw new Error(`Too many redirects for ${rawUrl}`)
  }

  const getRobotsRules = async (pageUrl) => {
    const url = new URL(pageUrl)
    const key = url.origin

    if (robotsCache.has(key)) return robotsCache.get(key)

    try {
      const { response } = await safeFetch(`${url.origin}/robots.txt`, {
        headers: { accept: 'text/plain,*/*;q=0.5' },
      })

      if (!response.ok) {
        robotsCache.set(key, [])
        return []
      }

      const rules = parseRobots(await response.text(), userAgent)
      robotsCache.set(key, rules)
      return rules
    } catch {
      robotsCache.set(key, [])
      return []
    }
  }

  const crawlPage = async (rawUrl) => {
    const normalized = await assertPublicUrl(rawUrl)
    const url = new URL(normalized)

    const rules = await getRobotsRules(normalized)
    const allowed = robotsAllows({
      rules,
      pathname: `${url.pathname}${url.search}`,
    })

    if (!allowed) {
      return {
        url: normalized,
        finalUrl: normalized,
        domain: normalizeHost(normalized),
        robotsAllowed: false,
        httpStatus: null,
        contentType: '',
        title: '',
        canonical: '',
        links: [],
        error: 'Blocked by robots.txt',
      }
    }

    try {
      const { response, finalUrl } = await safeFetch(normalized)
      const contentType = String(
        response.headers.get('content-type') || ''
      ).toLowerCase()

      if (
        !contentType.includes('text/html') &&
        !contentType.includes('application/xhtml+xml')
      ) {
        return {
          url: normalized,
          finalUrl,
          domain: normalizeHost(finalUrl),
          robotsAllowed: true,
          httpStatus: response.status,
          contentType,
          title: '',
          canonical: '',
          links: [],
          error: 'Unsupported content type',
        }
      }

      const text = await response.text()
      const html = text.length > MAX_HTML_BYTES
        ? text.slice(0, MAX_HTML_BYTES)
        : text

      return {
        url: normalized,
        finalUrl,
        domain: normalizeHost(finalUrl),
        robotsAllowed: true,
        httpStatus: response.status,
        contentType,
        title: pageTitle(html),
        canonical: canonicalUrl(html, finalUrl),
        links: extractLinks(html, finalUrl),
        error: '',
      }
    } catch (error) {
      return {
        url: normalized,
        finalUrl: normalized,
        domain: normalizeHost(normalized),
        robotsAllowed: true,
        httpStatus: null,
        contentType: '',
        title: '',
        canonical: '',
        links: [],
        error: String(error?.message || 'Crawl failed'),
      }
    }
  }

  return { crawlPage }
}

const crawlLinkGraph = async ({
  seeds,
  maxPages = 200,
  maxDepth = 1,
  userAgent,
  domainDelayMs = 1200,
}) => {
  const crawler = createCrawler({ userAgent, domainDelayMs })
  const queue = []
  const queued = new Set()
  const visited = new Set()

  const enqueue = (rawUrl, depth) => {
    const normalized = normalizeUrl(rawUrl)
    if (!normalized || depth > maxDepth) return

    const key = normalized.replace(/\/$/, '').toLowerCase()
    if (queued.has(key) || visited.has(key)) return

    queued.add(key)
    queue.push({ url: normalized, depth })
  }

  for (const seed of seeds) enqueue(seed, 0)

  const pages = []
  const edges = []
  const errors = []

  while (queue.length && pages.length < maxPages) {
    const item = queue.shift()
    const key = item.url.replace(/\/$/, '').toLowerCase()
    queued.delete(key)

    if (visited.has(key)) continue
    visited.add(key)

    const result = await crawler.crawlPage(item.url)
    pages.push({ ...result, depth: item.depth })

    if (result.error) {
      errors.push({ url: item.url, error: result.error })
    }

    for (const link of result.links) {
      edges.push(link)

      if (
        item.depth < maxDepth &&
        pages.length + queue.length < maxPages * 4
      ) {
        enqueue(link.targetUrl, item.depth + 1)
      }
    }
  }

  return {
    pages,
    edges,
    errors,
    stats: {
      seedCount: Array.isArray(seeds) ? seeds.length : 0,
      pagesCrawled: pages.length,
      linksExtracted: edges.length,
      uniqueDomains: new Set(
        pages.map((p) => p.domain).filter(Boolean)
      ).size,
    },
  }
}

module.exports = {
  createCrawler,
  crawlLinkGraph,
  normalizeUrl,
  normalizeHost,
  extractLinks,
  assertPublicUrl,
}
