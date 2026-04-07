const axios = require('axios')
const dns = require('dns').promises
const net = require('net')

const SUPPORTED_ENGINES = ['google', 'bing', 'duckduckgo']

function normalizeEngine(engine) {
  const value = String(engine || 'google').toLowerCase().trim()
  return SUPPORTED_ENGINES.includes(value) ? value : 'google'
}

function extractDomain(url) {
  try {
    const normalized = String(url || '').startsWith('http') ? String(url) : `https://${String(url || '')}`
    return new URL(normalized).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return String(url || '').toLowerCase().replace(/^www\./, '')
  }
}

function mapOrganicResults(items = []) {
  return items.slice(0, 10).map((r, i) => {
    const url = r.link || r.url || ''
    return {
      position: i + 1,
      title: r.title || '',
      url,
      domain: extractDomain(url),
      snippet: r.snippet || '',
    }
  }).filter(r => r.url)
}

function isDomainMatch(resultDomain, targetDomain) {
  const rd = String(resultDomain || '').toLowerCase().replace(/^www\./, '')
  const td = String(targetDomain || '').toLowerCase().replace(/^www\./, '')
  return rd === td || rd.endsWith(`.${td}`) || td.endsWith(`.${rd}`)
}

function engineLabel(engine) {
  if (engine === 'duckduckgo') return 'DuckDuckGo'
  return String(engine || 'google').charAt(0).toUpperCase() + String(engine || 'google').slice(1)
}

function isPrivateIp(ip) {
  const version = net.isIP(ip)
  if (version === 4) {
    const [a, b] = ip.split('.').map(Number)
    if (a === 10) return true
    if (a === 127) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 0) return true
    return false
  }
  if (version === 6) {
    const n = ip.toLowerCase()
    return n === '::1' || n.startsWith('fe80:') || n.startsWith('fc') || n.startsWith('fd')
  }
  return false
}

async function normalizeAndVerifyWebsite(inputUrl) {
  const raw = String(inputUrl || '').trim()
  if (!raw) throw new Error('Website URL is required')

  const withProto = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  let parsed
  try { parsed = new URL(withProto) }
  catch { throw new Error('Invalid website URL format') }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http/https URLs are allowed')
  }

  const host = parsed.hostname.toLowerCase()
  if (!host || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new Error('Please enter a public website domain')
  }
  if (!host.includes('.')) {
    throw new Error('Please enter a valid domain (example.com)')
  }

  let addresses = []
  try {
    addresses = await dns.lookup(host, { all: true })
  } catch {
    throw new Error('Domain could not be resolved. Check the URL and try again.')
  }
  if (!addresses.length) {
    throw new Error('Domain could not be resolved. Check the URL and try again.')
  }
  if (addresses.some(a => isPrivateIp(a.address))) {
    throw new Error('Private or local network addresses are not allowed')
  }

  let lastErr = null
  for (const candidate of [parsed.toString(), `${parsed.protocol}//${host}${parsed.pathname || ''}`]) {
    try {
      const r = await axios.get(candidate, {
        timeout: 12000,
        maxRedirects: 5,
        validateStatus: s => s >= 200 && s < 500,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SiteVerifyBot/1.0)' },
      })
      if (r.status >= 200 && r.status < 500) {
        return candidate.endsWith('/') ? candidate.slice(0, -1) : candidate
      }
      lastErr = new Error(`Website returned status ${r.status}`)
    } catch (e) {
      lastErr = e
    }
  }
  throw new Error(lastErr?.message || 'Website verification failed. Ensure the site is live and public.')
}

const firstValueByKey = (obj, candidates) => {
  const keys = Object.keys(obj || {})
  for (const c of candidates) {
    const found = keys.find(k => k.toLowerCase().includes(c))
    if (found) return obj[found]
  }
  return undefined
}

function parseSimpleCsv(csvText) {
  const lines = String(csvText || '')
    .split(/\r?\n/)
    .map(x => x.trim())
    .filter(Boolean)
  if (lines.length < 2) return null
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  const values = lines[1].split(',').map(v => v.trim().replace(/^"|"$/g, ''))
  const row = {}
  headers.forEach((h, i) => { row[h] = values[i] })
  return row
}

function parseCsvLine(line) {
  const out = []
  let cur = ''
  let q = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (q && line[i + 1] === '"') { cur += '"'; i++ }
      else q = !q
      continue
    }
    if (ch === ',' && !q) { out.push(cur.trim()); cur = ''; continue }
    cur += ch
  }
  out.push(cur.trim())
  return out
}

function parseCsvRows(csvText) {
  const lines = String(csvText || '')
    .split(/\r?\n/)
    .map(x => x.trim())
    .filter(Boolean)
  if (lines.length < 2) return []
  const headers = parseCsvLine(lines[0]).map(h => String(h || '').replace(/^"|"$/g, '').trim())
  return lines.slice(1).map(line => {
    const values = parseCsvLine(line).map(v => String(v || '').replace(/^"|"$/g, '').trim())
    const row = {}
    headers.forEach((h, i) => { row[h] = values[i] })
    return row
  })
}

const toInt = (v) => {
  if (v === null || v === undefined) return 0
  const n = parseInt(String(v).replace(/[^\d-]/g, ''), 10)
  return Number.isFinite(n) ? n : 0
}

function buildHeuristicKeywordSuggestions({ siteName, siteUrl, existingSet, limit }) {
  const host = extractDomain(siteUrl || '').split('.').slice(0, -1).join(' ').replace(/[-_]/g, ' ').trim()
  const brand = String(siteName || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()

  const seeds = [
    ...Array.from(existingSet || []),
    host,
    brand,
  ]
    .map(s => String(s || '').trim())
    .filter(Boolean)
    .slice(0, 20)

  const templates = [
    { t: '%s services', intent: 'Commercial', difficulty: 'Easy', vol: 80, why: 'Clear service intent and easier to convert.' },
    { t: 'best %s', intent: 'Commercial', difficulty: 'Medium', vol: 140, why: 'Comparison intent often brings qualified leads.' },
    { t: '%s pricing', intent: 'Transactional', difficulty: 'Easy', vol: 60, why: 'Price-focused searches can convert quickly.' },
    { t: '%s near me', intent: 'Transactional', difficulty: 'Easy', vol: 110, why: 'Local modifiers improve relevance and CTR.' },
    { t: '%s consultant', intent: 'Commercial', difficulty: 'Medium', vol: 70, why: 'Matches buyers looking for expert help.' },
    { t: 'how to choose %s', intent: 'Informational', difficulty: 'Easy', vol: 55, why: 'Top-of-funnel keyword for content authority.' },
    { t: '%s for small business', intent: 'Commercial', difficulty: 'Medium', vol: 90, why: 'Niche targeting reduces competition.' },
  ]

  const out = []
  const seen = new Set(Array.from(existingSet || []))
  for (const seed of seeds) {
    const base = seed.toLowerCase().replace(/\s+/g, ' ').trim()
    if (!base || base.length < 3) continue
    for (const tpl of templates) {
      const kw = tpl.t.replace('%s', base).replace(/\s+/g, ' ').trim()
      if (!kw || seen.has(kw)) continue
      seen.add(kw)
      out.push({
        keyword: kw,
        intent: tpl.intent,
        difficulty: tpl.difficulty,
        estimatedVolume: tpl.vol,
        why: tpl.why,
      })
      if (out.length >= limit) return out
    }
  }
  return out.slice(0, limit)
}

module.exports = {
  SUPPORTED_ENGINES,
  normalizeEngine,
  extractDomain,
  mapOrganicResults,
  isDomainMatch,
  engineLabel,
  isPrivateIp,
  normalizeAndVerifyWebsite,
  firstValueByKey,
  parseSimpleCsv,
  parseCsvLine,
  parseCsvRows,
  toInt,
  buildHeuristicKeywordSuggestions,
}
