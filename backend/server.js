require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { Pool } = require('pg')
const jwt = require('jsonwebtoken')
const axios = require('axios')
const Anthropic = require('@anthropic-ai/sdk')
const cheerio = require('cheerio')
const dns = require('dns').promises
const net = require('net')
const nodemailer = require('nodemailer')
const cron = require('node-cron')

const app = express()
const PORT = process.env.PORT || 4000

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5174', credentials: true }))
app.use(express.json())

const auth = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'No token' })
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const { rows } = await pool.query('SELECT id, email FROM users WHERE id=$1 LIMIT 1', [decoded.id])
    if (!rows[0]) return res.status(401).json({ error: 'Session expired. Please login again.' })
    req.user = decoded
    next()
  }
  catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}

const verifySite = async (req, res, next) => {
  const siteId = req.params.siteId
  if (!siteId) return res.status(400).json({ error: 'siteId required' })
  const { rows } = await pool.query('SELECT id FROM sites WHERE id=$1 AND user_id=$2', [siteId, req.user.id])
  if (!rows[0]) return res.status(403).json({ error: 'Site not found or access denied' })
  req.siteId = parseInt(siteId)
  next()
}

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

async function fetchSerpResults(keyword, engine) {
  const normalizedEngine = normalizeEngine(engine)
  // Primary for all engines: SerpAPI if available
  if (process.env.SERPAPI_KEY) {
    try {
      const { data } = await axios.get('https://serpapi.com/search.json', {
        params: { api_key: process.env.SERPAPI_KEY, q: keyword, num: 10, gl: 'us', hl: 'en', engine: normalizedEngine },
        timeout: 15000,
      })
      const rows = mapOrganicResults(data.organic_results || [])
      if (rows.length) return rows
    } catch (e) { console.error('SerpAPI error:', e.message) }
  }

  // Secondary for Google only: ValueSERP
  if (normalizedEngine === 'google' && process.env.VALUESERP_KEY) {
    try {
      const { data } = await axios.get('https://api.valueserp.com/search', {
        params: { api_key: process.env.VALUESERP_KEY, q: keyword, num: 10, gl: 'us', hl: 'en', output: 'json' },
        timeout: 15000,
      })
      const rows = mapOrganicResults(data.organic_results || [])
      if (rows.length) return rows
    } catch (e) { console.error('ValueSERP error:', e.message) }
  }

  // Final fallback: lightweight HTML scraping
  try { return await scrapeEngineResults(keyword, normalizedEngine) }
  catch (e) { console.error(`${normalizedEngine} scrape error:`, e.message); return [] }
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

async function scanSiteKeywordTransitions(siteId, engines = SUPPORTED_ENGINES, keywordLimit = 30) {
  const normalizedEngines = (Array.isArray(engines) ? engines : SUPPORTED_ENGINES).map(normalizeEngine)
  const limit = Math.min(Math.max(parseInt(keywordLimit || 30), 1), 80)

  const { rows: siteRows } = await pool.query('SELECT id, name, url FROM sites WHERE id=$1 LIMIT 1', [siteId])
  const site = siteRows[0]
  if (!site) return { checked: 0, alertsCreated: 0, report: null }
  const targetDomain = extractDomain(site.url)

  const { rows: keywords } = await pool.query(
    'SELECT id, keyword, rank_state FROM keywords WHERE site_id=$1 ORDER BY created_at ASC LIMIT $2',
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
      positions: [],
    }
  })

  const keywordSummaries = []

  for (const kw of keywords) {
    const state = (kw.rank_state && typeof kw.rank_state === 'object') ? kw.rank_state : {}
    const nextState = { ...state }

    for (const engine of normalizedEngines) {
      const results = await fetchSerpResults(kw.keyword, engine)
      const hit = results.find(r => isDomainMatch(r.domain, targetDomain))
      const currentPos = hit ? hit.position : null

      const prevPosRaw = state?.[engine]?.position
      const prevPos = Number.isFinite(Number(prevPosRaw)) ? Number(prevPosRaw) : null
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
        transitions.push({
          keyword: kw.keyword,
          engine,
          action: nowInFirstPage ? 'entered' : 'dropped',
          prevPosition: prevPos,
          currentPosition: currentPos,
        })
        if (nowInFirstPage) engineStats[engine].enteredCount += 1
        else engineStats[engine].droppedCount += 1
      }

      nextState[engine] = {
        position: currentPos,
        checked_at: new Date().toISOString(),
      }
      checked += 1
    }

    const currentByEngine = {}
    normalizedEngines.forEach((engine) => {
      const pRaw = nextState?.[engine]?.position
      const pos = Number.isFinite(Number(pRaw)) ? Number(pRaw) : null
      currentByEngine[engine] = {
        position: pos,
        inFirstPage: !!pos && pos <= 10,
      }
    })
    keywordSummaries.push({ id: kw.id, keyword: kw.keyword, current: currentByEngine })

    await pool.query('UPDATE keywords SET rank_state=$1 WHERE id=$2 AND site_id=$3', [nextState, kw.id, siteId])
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

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      photo TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS sites (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS seo_metrics (
      id SERIAL PRIMARY KEY,
      site_id INTEGER UNIQUE REFERENCES sites(id) ON DELETE CASCADE,
      dr INTEGER DEFAULT 0,
      clicks INTEGER DEFAULT 0,
      impressions INTEGER DEFAULT 0,
      health INTEGER DEFAULT 100,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS keywords (
      id SERIAL PRIMARY KEY,
      site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
      keyword TEXT NOT NULL,
      volume INTEGER DEFAULT 0,
      difficulty TEXT DEFAULT 'Easy',
      position INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS backlinks (
      id SERIAL PRIMARY KEY,
      site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      dr INTEGER DEFAULT 0,
      status TEXT DEFAULT 'Todo',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE backlinks ADD COLUMN IF NOT EXISTS anchor TEXT DEFAULT '';
    ALTER TABLE backlinks ADD COLUMN IF NOT EXISTS url TEXT DEFAULT '';
    ALTER TABLE backlinks ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'dofollow';
    ALTER TABLE backlinks ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';
    CREATE TABLE IF NOT EXISTS competitors (
      id SERIAL PRIMARY KEY,
      site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      dr INTEGER DEFAULT 0,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS actions (
      id SERIAL PRIMARY KEY,
      site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      impact TEXT DEFAULT 'Medium',
      done BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS audit_results (
      id SERIAL PRIMARY KEY,
      site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
      results JSONB,
      score INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS alerts (
      id SERIAL PRIMARY KEY,
      site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      severity TEXT DEFAULT 'info',
      read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS integration_settings (
      site_id INTEGER PRIMARY KEY REFERENCES sites(id) ON DELETE CASCADE,
      ga4_connected BOOLEAN DEFAULT FALSE,
      ga4_property_id TEXT,
      ga4_measurement_id TEXT,
      ahrefs_connected BOOLEAN DEFAULT FALSE,
      ahrefs_last_import_at TIMESTAMPTZ,
      ahrefs_source TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS ahrefs_metrics (
      id SERIAL PRIMARY KEY,
      site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
      dr INTEGER DEFAULT 0,
      backlinks INTEGER DEFAULT 0,
      ref_domains INTEGER DEFAULT 0,
      organic_traffic INTEGER DEFAULT 0,
      organic_keywords INTEGER DEFAULT 0,
      source TEXT DEFAULT 'manual',
      imported_at TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE users ADD COLUMN IF NOT EXISTS gsc_refresh_token TEXT;
    ALTER TABLE competitors ADD COLUMN IF NOT EXISTS url TEXT DEFAULT '';

    CREATE TABLE IF NOT EXISTS email_report_settings (
      id SERIAL PRIMARY KEY,
      site_id INTEGER UNIQUE REFERENCES sites(id) ON DELETE CASCADE,
      enabled BOOLEAN DEFAULT FALSE,
      recipients TEXT[] DEFAULT ARRAY[]::TEXT[],
      send_hour INTEGER DEFAULT 8,
      last_sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    -- Compatibility migrations for older deployments
    ALTER TABLE seo_metrics ADD COLUMN IF NOT EXISTS site_id INTEGER;
    ALTER TABLE seo_metrics ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    ALTER TABLE keywords ADD COLUMN IF NOT EXISTS site_id INTEGER;
    ALTER TABLE keywords ADD COLUMN IF NOT EXISTS rank_state JSONB DEFAULT '{}'::jsonb;
    ALTER TABLE backlinks ADD COLUMN IF NOT EXISTS site_id INTEGER;
    ALTER TABLE competitors ADD COLUMN IF NOT EXISTS site_id INTEGER;
    ALTER TABLE actions ADD COLUMN IF NOT EXISTS site_id INTEGER;

    -- Backfill site_id for legacy rows where metric row id used to equal site id
    UPDATE seo_metrics sm
    SET site_id = sm.id
    WHERE sm.site_id IS NULL
      AND EXISTS (SELECT 1 FROM sites s WHERE s.id = sm.id);

    UPDATE keywords k
    SET site_id = k.id
    WHERE k.site_id IS NULL
      AND EXISTS (SELECT 1 FROM sites s WHERE s.id = k.id);

    UPDATE backlinks b
    SET site_id = b.id
    WHERE b.site_id IS NULL
      AND EXISTS (SELECT 1 FROM sites s WHERE s.id = b.id);

    UPDATE competitors c
    SET site_id = c.id
    WHERE c.site_id IS NULL
      AND EXISTS (SELECT 1 FROM sites s WHERE s.id = c.id);

    UPDATE actions a
    SET site_id = a.id
    WHERE a.site_id IS NULL
      AND EXISTS (SELECT 1 FROM sites s WHERE s.id = a.id);

    CREATE UNIQUE INDEX IF NOT EXISTS seo_metrics_site_id_uidx
      ON seo_metrics(site_id)
      WHERE site_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS keywords_site_id_idx ON keywords(site_id);
    CREATE INDEX IF NOT EXISTS backlinks_site_id_idx ON backlinks(site_id);
    CREATE INDEX IF NOT EXISTS competitors_site_id_idx ON competitors(site_id);
    CREATE INDEX IF NOT EXISTS actions_site_id_idx ON actions(site_id);

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'seo_metrics_site_id_fkey'
      ) THEN
        ALTER TABLE seo_metrics
          ADD CONSTRAINT seo_metrics_site_id_fkey
          FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;
      END IF;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END $$;

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'keywords_site_id_fkey') THEN
        ALTER TABLE keywords
          ADD CONSTRAINT keywords_site_id_fkey
          FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'backlinks_site_id_fkey') THEN
        ALTER TABLE backlinks
          ADD CONSTRAINT backlinks_site_id_fkey
          FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'competitors_site_id_fkey') THEN
        ALTER TABLE competitors
          ADD CONSTRAINT competitors_site_id_fkey
          FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'actions_site_id_fkey') THEN
        ALTER TABLE actions
          ADD CONSTRAINT actions_site_id_fkey
          FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;
      END IF;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END $$;
  `)
  console.log('DB initialized')
}

const toInt = (v) => {
  if (v === null || v === undefined) return 0
  const n = parseInt(String(v).replace(/[^\d-]/g, ''), 10)
  return Number.isFinite(n) ? n : 0
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
      // Some real sites block server-side checks and return 401/403/405.
      // If DNS resolves and the host responds with any non-5xx status, treat it as a valid live domain.
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

async function ensureSiteIsVerifiedInGsc(userId, siteUrl) {
  const { rows: userRows } = await pool.query('SELECT gsc_refresh_token FROM users WHERE id=$1', [userId])
  const refreshToken = userRows[0]?.gsc_refresh_token
  if (!refreshToken) {
    throw new Error('Connect Google Search Console first to validate domain ownership before adding a project.')
  }

  const accessToken = await getGscAccessToken(refreshToken)
  const { data } = await axios.get('https://www.googleapis.com/webmasters/v3/sites', {
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: 12000,
  })

  const entries = data?.siteEntry || []
  const targetHost = new URL(siteUrl).hostname.toLowerCase().replace(/^www\./, '')

  const isVerified = entries.some((entry) => {
    const property = String(entry?.siteUrl || '').trim().toLowerCase()
    const permission = String(entry?.permissionLevel || '').trim()
    if (!property || permission === 'siteUnverifiedUser') return false

    if (property.startsWith('sc-domain:')) {
      const domain = property.replace('sc-domain:', '').replace(/^www\./, '')
      return targetHost === domain || targetHost.endsWith(`.${domain}`)
    }

    try {
      const propertyHost = new URL(property).hostname.toLowerCase().replace(/^www\./, '')
      return targetHost === propertyHost || targetHost.endsWith(`.${propertyHost}`) || propertyHost.endsWith(`.${targetHost}`)
    } catch {
      return false
    }
  })

  if (!isVerified) {
    throw new Error('This domain is not verified in your Google Search Console account. Verify the property in GSC first.')
  }
}

// Auth
app.post('/api/auth/google', async (req, res) => {
  try {
    const { token } = req.body
    const { data: profile } = await axios.get(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${token}`)
    const allowed = (process.env.ALLOWED_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean)
    if (allowed.length > 0 && !allowed.includes(profile.email))
      return res.status(403).json({ error: 'Access denied. You are not authorized.' })
    const { rows } = await pool.query(
      'INSERT INTO users (email, name, photo) VALUES ($1,$2,$3) ON CONFLICT (email) DO UPDATE SET name=$2, photo=$3 RETURNING *',
      [profile.email, profile.name, profile.picture]
    )
    const user = rows[0]
    const jwtToken = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '30d' })
    res.json({ token: jwtToken, user: { id: user.id, email: user.email, name: user.name, photo: user.photo } })
  } catch (e) { console.error(e); res.status(500).json({ error: 'Auth failed' }) }
})

app.get('/api/auth/me', auth, async (req, res) => {
  const { rows } = await pool.query('SELECT id, email, name, photo FROM users WHERE id=$1', [req.user.id])
  if (!rows[0]) return res.status(404).json({ error: 'Not found' })
  res.json(rows[0])
})

// Sites
app.get('/api/sites', auth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT
      s.*,
      COALESCE(m.health, 100) AS health,
      COALESCE(m.dr, 0) AS dr,
      COALESCE(k.keyword_count, 0) AS keyword_count,
      COALESCE(b.backlink_count, 0) AS backlink_count
    FROM sites s
    LEFT JOIN seo_metrics m ON m.site_id = s.id
    LEFT JOIN (
      SELECT site_id, COUNT(*)::int AS keyword_count
      FROM keywords
      GROUP BY site_id
    ) k ON k.site_id = s.id
    LEFT JOIN (
      SELECT site_id, COUNT(*)::int AS backlink_count
      FROM backlinks
      GROUP BY site_id
    ) b ON b.site_id = s.id
    WHERE s.user_id=$1
    ORDER BY s.created_at ASC`,
    [req.user.id]
  )
  res.json(rows)
})

app.post('/api/sites', auth, async (req, res) => {
  const { name, url } = req.body
  if (!name || !url) return res.status(400).json({ error: 'name and url required' })
  if (!String(name).trim()) return res.status(400).json({ error: 'Project name is required' })
  try {
    const verifiedUrl = await normalizeAndVerifyWebsite(url)
    await ensureSiteIsVerifiedInGsc(req.user.id, verifiedUrl)
    const { rows } = await pool.query(
      'INSERT INTO sites (user_id, name, url) VALUES ($1,$2,$3) RETURNING *',
      [req.user.id, String(name).trim(), verifiedUrl]
    )
    await pool.query('INSERT INTO seo_metrics (site_id) VALUES ($1)', [rows[0].id])
    res.json(rows[0])
  } catch (e) {
    res.status(400).json({ error: e.message || 'Website verification failed' })
  }
})

app.delete('/api/sites/:id', auth, async (req, res) => {
  await pool.query('DELETE FROM sites WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id])
  res.json({ ok: true })
})

// Metrics
app.get('/api/sites/:siteId/metrics', auth, verifySite, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM seo_metrics WHERE site_id=$1 LIMIT 1', [req.siteId])
  res.json(rows[0] || { dr: 0, clicks: 0, impressions: 0, health: 100 })
})

app.put('/api/sites/:siteId/metrics', auth, verifySite, async (req, res) => {
  const { dr, clicks, impressions, health } = req.body
  const { rows } = await pool.query(
    `INSERT INTO seo_metrics (site_id, dr, clicks, impressions, health) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (site_id) DO UPDATE SET dr=$2, clicks=$3, impressions=$4, health=$5, updated_at=NOW() RETURNING *`,
    [req.siteId, dr, clicks, impressions, health]
  )
  res.json(rows[0])
})

// Keywords
app.get('/api/sites/:siteId/keywords', auth, verifySite, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM keywords WHERE site_id=$1 ORDER BY created_at ASC', [req.siteId])
  res.json(rows)
})
app.post('/api/sites/:siteId/keywords', auth, verifySite, async (req, res) => {
  const { keyword, volume, difficulty, position } = req.body
  const { rows } = await pool.query('INSERT INTO keywords (site_id, keyword, volume, difficulty, position) VALUES ($1,$2,$3,$4,$5) RETURNING *', [req.siteId, keyword, volume || 0, difficulty || 'Easy', position || null])
  res.json(rows[0])
})
app.put('/api/sites/:siteId/keywords/:id', auth, verifySite, async (req, res) => {
  const { rows } = await pool.query('UPDATE keywords SET position=$1 WHERE id=$2 AND site_id=$3 RETURNING *', [req.body.position, req.params.id, req.siteId])
  res.json(rows[0])
})
app.delete('/api/sites/:siteId/keywords/:id', auth, verifySite, async (req, res) => {
  await pool.query('DELETE FROM keywords WHERE id=$1 AND site_id=$2', [req.params.id, req.siteId])
  res.json({ ok: true })
})

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

app.post('/api/sites/:siteId/keywords/ai-suggest', auth, verifySite, async (req, res) => {
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
    const competitorHints = cR.rows
      .map(c => `${c.name}${c.url ? ` (${c.url})` : ''}${c.dr ? ` DR ${c.dr}` : ''}`)
      .join(', ') || 'none'

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
      try {
        parsed = JSON.parse(jsonStart >= 0 ? text.slice(jsonStart, jsonEnd + 1) : text)
      } catch {
        parsed = { suggestions: [] }
      }

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
      cleaned = buildHeuristicKeywordSuggestions({
        siteName: site.name,
        siteUrl: site.url,
        existingSet,
        limit,
      })
      return res.json({ suggestions: cleaned, source: 'fallback' })
    }

    res.json({ suggestions: cleaned, source: 'ai' })
  } catch (e) {
    console.error('AI keyword suggest failed:', e)
    res.status(500).json({ error: 'AI keyword suggestion failed' })
  }
})

app.post('/api/sites/:siteId/keywords/first-page-status', auth, verifySite, async (req, res) => {
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
    details.push({
      id: k.id,
      keyword: k.keyword,
      position,
      inFirstPage: !!position && position <= 10,
      top10: results,
    })
  }

  const inFirstPageCount = details.filter(d => d.inFirstPage).length
  res.json({
    engine,
    siteDomain: targetDomain,
    checked: details.length,
    inFirstPageCount,
    details,
  })
})

app.post('/api/sites/:siteId/keywords/scan-weekly-now', auth, verifySite, async (req, res) => {
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

// Backlinks
app.get('/api/sites/:siteId/backlinks', auth, verifySite, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM backlinks WHERE site_id=$1 ORDER BY dr DESC', [req.siteId])
  res.json(rows)
})
app.post('/api/sites/:siteId/backlinks', auth, verifySite, async (req, res) => {
  const { name, dr, status, anchor, url, type } = req.body
  const { rows } = await pool.query(
    'INSERT INTO backlinks (site_id, name, dr, status, anchor, url, type) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
    [req.siteId, name, dr || 0, status || 'Todo', anchor || '', url || '', type || 'dofollow']
  )
  res.json(rows[0])
})
app.put('/api/sites/:siteId/backlinks/:id', auth, verifySite, async (req, res) => {
  const { rows } = await pool.query('UPDATE backlinks SET status=$1 WHERE id=$2 AND site_id=$3 RETURNING *', [req.body.status, req.params.id, req.siteId])
  res.json(rows[0])
})
app.delete('/api/sites/:siteId/backlinks/:id', auth, verifySite, async (req, res) => {
  await pool.query('DELETE FROM backlinks WHERE id=$1 AND site_id=$2', [req.params.id, req.siteId])
  res.json({ ok: true })
})

app.post('/api/sites/:siteId/backlinks/import-detailed-csv', auth, verifySite, async (req, res) => {
  const rows = parseCsvRows(req.body?.csvText)
  if (!rows.length) return res.status(400).json({ error: 'Invalid CSV. Add a header row and at least one data row.' })

  const pick = (row, names) => firstValueByKey(row, names) || ''
  const normalizeType = (v) => String(v || '').toLowerCase().includes('no') ? 'nofollow' : 'dofollow'
  const normalizeStatus = (v) => {
    const s = String(v || '').toLowerCase().trim()
    if (s === 'live') return 'Live'
    if (s === 'pending') return 'Pending'
    return 'Todo'
  }

  const { rows: existingRows } = await pool.query('SELECT url, name, anchor FROM backlinks WHERE site_id=$1', [req.siteId])
  const seen = new Set(existingRows.map(r => `${String(r.url || '').toLowerCase()}|${String(r.name || '').toLowerCase()}|${String(r.anchor || '').toLowerCase()}`))

  let imported = 0
  let skipped = 0

  for (const row of rows.slice(0, 3000)) {
    const name = String(pick(row, ['domain', 'referring domain', 'site', 'name']) || '').trim()
    const url = String(pick(row, ['url', 'source url', 'page', 'referring page']) || '').trim()
    const anchor = String(pick(row, ['anchor', 'anchor text']) || '').trim()
    const dr = Math.max(0, Math.min(100, toInt(pick(row, ['dr', 'domain rating']))))
    const type = normalizeType(pick(row, ['type', 'link type', 'follow']))
    const status = normalizeStatus(pick(row, ['status']))

    const finalName = name || (() => {
      try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
    })()
    const finalUrl = (() => {
      if (!url) return ''
      try {
        const w = /^https?:\/\//i.test(url) ? url : `https://${url}`
        return new URL(w).href
      } catch { return '' }
    })()

    if (!finalName) { skipped++; continue }

    const key = `${String(finalUrl).toLowerCase()}|${String(finalName).toLowerCase()}|${String(anchor).toLowerCase()}`
    if (seen.has(key)) { skipped++; continue }
    seen.add(key)

    await pool.query(
      `INSERT INTO backlinks (site_id, name, dr, status, anchor, url, type, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'csv')`,
      [req.siteId, finalName, dr, status, anchor, finalUrl, type]
    )
    imported++
  }

  res.json({ imported, skipped, totalRows: rows.length })
})

// Backlink Crawler
app.post('/api/sites/:siteId/backlinks/crawl', auth, verifySite, async (req, res) => {
  const { rows: siteRows } = await pool.query('SELECT url FROM sites WHERE id=$1', [req.siteId])
  if (!siteRows[0]) return res.status(404).json({ error: 'Site not found' })

  const rawUrl = siteRows[0].url
  let targetDomain
  try {
    targetDomain = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`).hostname.replace(/^www\./, '')
  } catch {
    return res.status(400).json({ error: 'Invalid site URL' })
  }

  const discovered = []
  const errors = []

  // ── Helper: safely fetch a URL ─────────────────────────────────────
  const safeFetch = async (url) => {
    try {
      const r = await axios.get(url, {
        timeout: 10000,
        maxRedirects: 3,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SEOToolBot/1.0)' },
        validateStatus: s => s < 400,
      })
      return r.data
    } catch { return null }
  }

  // ── Source 1: Common Crawl CDX Index ──────────────────────────────
  // Query recent crawls for pages that mention the target domain
  try {
    const cdxUrl = `https://index.commoncrawl.org/CC-MAIN-2025-13-index?url=*.${targetDomain}&output=json&limit=50&filter=status:200`
    const cdxRes = await axios.get(cdxUrl, { timeout: 12000 }).catch(() => null)
    if (cdxRes?.data) {
      const lines = String(cdxRes.data).trim().split('\n').filter(Boolean).slice(0, 30)
      for (const line of lines) {
        try {
          const entry = JSON.parse(line)
          if (entry.url && !entry.url.includes(targetDomain)) {
            discovered.push({ sourceUrl: entry.url, via: 'Common Crawl' })
          }
        } catch { /* skip malformed */ }
      }
    }
  } catch (e) { errors.push(`Common Crawl: ${e.message}`) }

  // ── Source 2: Seed URLs provided by user ──────────────────────────
  const seedUrls = Array.isArray(req.body?.seeds) ? req.body.seeds.slice(0, 10) : []
  for (const seedUrl of seedUrls) {
    const html = await safeFetch(seedUrl)
    if (!html) continue
    try {
      const $ = cheerio.load(html)
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href') || ''
        const anchor = $(el).text().trim().slice(0, 100)
        if (href.includes(targetDomain)) {
          discovered.push({ sourceUrl: seedUrl, linkUrl: href, anchor, via: 'Seed crawl' })
        }
      })
    } catch { /* skip parse errors */ }
  }

  // ── Source 3: Bing HTML search for link mentions ──────────────────
  try {
    const searchHtml = await safeFetch(`https://www.bing.com/search?q=${encodeURIComponent(`"${targetDomain}" -site:${targetDomain}`)}&count=20`)
    if (searchHtml) {
      const $ = cheerio.load(searchHtml)
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href') || ''
        if (href.startsWith('http') && !href.includes('bing.com') && !href.includes(targetDomain)) {
          discovered.push({ sourceUrl: href, via: 'Bing search' })
        }
      })
    }
  } catch (e) { errors.push(`Bing search: ${e.message}`) }

  // ── Verify & save discovered links ────────────────────────────────
  const saved = []
  const seen = new Set()

  // Get existing backlink URLs to avoid duplicates
  const { rows: existing } = await pool.query('SELECT url FROM backlinks WHERE site_id=$1', [req.siteId])
  existing.forEach(r => r.url && seen.add(r.url))

  for (const item of discovered) {
    const pageUrl = item.sourceUrl
    if (!pageUrl || seen.has(pageUrl)) continue
    seen.add(pageUrl)

    // Verify the page actually links to us (for CDX / Bing results)
    let verified = item.via === 'Seed crawl' // seed crawl already verified
    let anchor = item.anchor || ''
    let linkType = 'dofollow'

    if (!verified) {
      const html = await safeFetch(pageUrl)
      if (html) {
        try {
          const $ = cheerio.load(html)
          $('a[href]').each((_, el) => {
            const href = $(el).attr('href') || ''
            if (href.includes(targetDomain)) {
              verified = true
              anchor = anchor || $(el).text().trim().slice(0, 100)
              const rel = ($(el).attr('rel') || '').toLowerCase()
              linkType = rel.includes('nofollow') ? 'nofollow' : 'dofollow'
            }
          })
        } catch { /* skip */ }
      }
    }

    if (!verified) continue

    let domain = pageUrl
    try { domain = new URL(pageUrl).hostname } catch { /* keep raw */ }

    const { rows: inserted } = await pool.query(
      `INSERT INTO backlinks (site_id, name, dr, status, anchor, url, type, source)
       VALUES ($1,$2,0,'Todo',$3,$4,$5,'crawled') RETURNING *`,
      [req.siteId, domain, anchor, pageUrl, linkType]
    )
    saved.push(inserted[0])
  }

  res.json({ saved: saved.length, details: saved, errors })
})

// Competitors
app.get('/api/sites/:siteId/competitors', auth, verifySite, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM competitors WHERE site_id=$1 ORDER BY dr DESC', [req.siteId])
  res.json(rows)
})
app.post('/api/sites/:siteId/competitors', auth, verifySite, async (req, res) => {
  const { name, dr, notes } = req.body
  const { rows } = await pool.query('INSERT INTO competitors (site_id, name, dr, notes) VALUES ($1,$2,$3,$4) RETURNING *', [req.siteId, name, dr || 0, notes || ''])
  res.json(rows[0])
})
app.delete('/api/sites/:siteId/competitors/:id', auth, verifySite, async (req, res) => {
  await pool.query('DELETE FROM competitors WHERE id=$1 AND site_id=$2', [req.params.id, req.siteId])
  res.json({ ok: true })
})

// Actions
app.get('/api/sites/:siteId/actions', auth, verifySite, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM actions WHERE site_id=$1 ORDER BY done ASC, created_at ASC', [req.siteId])
  res.json(rows)
})
app.post('/api/sites/:siteId/actions', auth, verifySite, async (req, res) => {
  const { text, impact } = req.body
  const { rows } = await pool.query('INSERT INTO actions (site_id, text, impact) VALUES ($1,$2,$3) RETURNING *', [req.siteId, text, impact || 'Medium'])
  res.json(rows[0])
})
app.put('/api/sites/:siteId/actions/:id', auth, verifySite, async (req, res) => {
  const { rows } = await pool.query('UPDATE actions SET done=$1 WHERE id=$2 AND site_id=$3 RETURNING *', [req.body.done, req.params.id, req.siteId])
  res.json(rows[0])
})
app.delete('/api/sites/:siteId/actions/:id', auth, verifySite, async (req, res) => {
  await pool.query('DELETE FROM actions WHERE id=$1 AND site_id=$2', [req.params.id, req.siteId])
  res.json({ ok: true })
})

// AI
app.post('/api/sites/:siteId/ai/chat', auth, verifySite, async (req, res) => {
  try {
    const trimText = (value, max = 420) => {
      const s = String(value || '')
      return s.length > max ? `${s.slice(0, max)}...` : s
    }

    const allMessages = Array.isArray(req.body?.messages) ? req.body.messages : []

    const [siteR, metricsR, keywordsR, backlinksR] = await Promise.all([
      pool.query('SELECT name, url FROM sites WHERE id=$1 LIMIT 1', [req.siteId]),
      pool.query('SELECT dr, clicks, impressions FROM seo_metrics WHERE site_id=$1 LIMIT 1', [req.siteId]),
      pool.query(
        `SELECT keyword, volume, position
         FROM keywords
         WHERE site_id=$1
         ORDER BY COALESCE(volume, 0) DESC, created_at DESC
         LIMIT 20`,
        [req.siteId]
      ),
      pool.query(
        `SELECT name, dr, status
         FROM backlinks
         WHERE site_id=$1
         ORDER BY (status='Live') DESC, dr DESC, created_at DESC
         LIMIT 25`,
        [req.siteId]
      ),
    ])

    const site = siteR.rows[0] || {}
    const metrics = metricsR.rows[0] || {}
    const topKeywords = keywordsR.rows
      .map(k => `${k.keyword}${Number.isFinite(Number(k.position)) ? ` (pos ${k.position})` : ''}`)
      .join(', ')
    const liveBacklinks = backlinksR.rows
      .filter(b => b.status === 'Live')
      .map(b => `${b.name}${b.dr ? ` (DR ${b.dr})` : ''}`)
      .join(', ')

    const systemPrompt = `You are an expert SEO consultant for ${site.name || 'this site'} (${site.url || 'unknown URL'}).
Current data: DR=${metrics.dr || 0}, Clicks=${metrics.clicks || 0}, Impressions=${metrics.impressions || 0}.
Top keywords: ${topKeywords || 'none'}.
Live backlinks: ${liveBacklinks || 'none'}.
Give specific, actionable SEO advice. Be concise and practical.`

    const promptMessages = allMessages
      .slice(-6)
      .map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: trimText(m.content, 420),
      }))

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: trimText(systemPrompt, 1800),
      messages: promptMessages,
    })
    res.json({ reply: response.content[0].text })
  } catch (e) { console.error(e); res.status(500).json({ error: 'AI error' }) }
})

// ─── GSC OAuth ────────────────────────────────────────────────────────────────
async function getGscAccessToken(refreshToken) {
  const { data } = await axios.post('https://oauth2.googleapis.com/token', {
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })
  return data.access_token
}

app.get('/api/auth/gsc', auth, (req, res) => {
  const state = Buffer.from(JSON.stringify({ userId: req.user.id })).toString('base64url')
  const backendUrl = process.env.BACKEND_URL || `http://localhost:${PORT}`
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${backendUrl}/api/auth/gsc/callback`,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` })
})

app.get('/api/auth/gsc/callback', async (req, res) => {
  try {
    const { code, state } = req.query
    const backendUrl = process.env.BACKEND_URL || `http://localhost:${PORT}`
    const { userId } = JSON.parse(Buffer.from(state, 'base64url').toString())
    const { data } = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${backendUrl}/api/auth/gsc/callback`,
      grant_type: 'authorization_code',
    })
    await pool.query('UPDATE users SET gsc_refresh_token=$1 WHERE id=$2', [data.refresh_token, userId])
    const frontend = process.env.FRONTEND_URL || 'http://localhost:5174'
    res.send(`<html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><div style="font-size:48px;margin-bottom:12px">✓</div><h2 style="color:#22C55E;margin:0 0 8px">GSC Connected!</h2><p style="color:#6b7280">You can close this window.</p><script>window.opener?.postMessage('gsc_connected','${frontend}');setTimeout(()=>window.close(),1800)<\/script></div></body></html>`)
  } catch (e) {
    console.error('GSC callback:', e.response?.data || e.message)
    res.status(500).send('Connection failed. Please try again.')
  }
})

app.get('/api/auth/gsc/status', auth, async (req, res) => {
  const { rows } = await pool.query('SELECT gsc_refresh_token FROM users WHERE id=$1', [req.user.id])
  res.json({ connected: !!rows[0]?.gsc_refresh_token })
})

app.delete('/api/auth/gsc', auth, async (req, res) => {
  await pool.query('UPDATE users SET gsc_refresh_token=NULL WHERE id=$1', [req.user.id])
  res.json({ ok: true })
})

app.get('/api/sites/:siteId/gsc', auth, verifySite, async (req, res) => {
  try {
    const { rows: u } = await pool.query('SELECT gsc_refresh_token FROM users WHERE id=$1', [req.user.id])
    if (!u[0]?.gsc_refresh_token) return res.json({ connected: false })
    const { rows: s } = await pool.query('SELECT url FROM sites WHERE id=$1', [req.siteId])
    const siteUrl = s[0].url
    const accessToken = await getGscAccessToken(u[0].gsc_refresh_token)
    const endDate = new Date().toISOString().split('T')[0]
    const startDate = new Date(Date.now() - 28 * 864e5).toISOString().split('T')[0]
    const headers = { Authorization: `Bearer ${accessToken}` }
    const base = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`
    const [qr, pr, tr, dr] = await Promise.all([
      axios.post(base, { startDate, endDate, dimensions: ['query'], rowLimit: 10, orderBy: [{ fieldName: 'clicks', sortOrder: 'DESCENDING' }] }, { headers }),
      axios.post(base, { startDate, endDate, dimensions: ['page'], rowLimit: 5, orderBy: [{ fieldName: 'clicks', sortOrder: 'DESCENDING' }] }, { headers }),
      axios.post(base, { startDate, endDate, rowLimit: 1 }, { headers }),
      axios.post(base, { startDate, endDate, dimensions: ['date'], rowLimit: 28 }, { headers }),
    ])
    res.json({ connected: true, queries: qr.data.rows || [], pages: pr.data.rows || [], daily: dr.data.rows || [], totals: tr.data.rows?.[0] || { clicks: 0, impressions: 0, ctr: 0, position: 0 } })
  } catch (e) {
    console.error('GSC fetch:', e.response?.data || e.message)
    res.json({ connected: true, error: 'Failed to fetch — verify site URL matches GSC property exactly' })
  }
})

// ─── Site Audit ───────────────────────────────────────────────────────────────
app.post('/api/sites/:siteId/audit/run', auth, verifySite, async (req, res) => {
  const { rows: s } = await pool.query('SELECT url FROM sites WHERE id=$1', [req.siteId])
  const url = s[0].url
  try {
    const { data: html } = await axios.get(url, {
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SEOAuditBot/1.0; +https://devndespro.com)' },
      maxRedirects: 5,
    })
    const $ = cheerio.load(html)
    const checks = []
    const add = (check, status, message, impact, category) =>
      checks.push({ check, status, message, impact, category })

    // On-Page
    const title = $('title').text().trim()
    if (!title) add('title', 'error', 'Missing <title> tag', 'High', 'On-Page SEO')
    else if (title.length < 30) add('title', 'warning', `Title too short: "${title.substring(0,50)}" — ${title.length} chars (aim 50-60)`, 'Medium', 'On-Page SEO')
    else if (title.length > 60) add('title', 'warning', `Title too long: ${title.length} chars — may be truncated in SERPs`, 'Medium', 'On-Page SEO')
    else add('title', 'pass', `Title OK: "${title.substring(0,55)}"`, 'High', 'On-Page SEO')

    const metaDesc = $('meta[name="description"]').attr('content') || ''
    if (!metaDesc) add('meta_desc', 'error', 'Missing meta description', 'High', 'On-Page SEO')
    else if (metaDesc.length < 100) add('meta_desc', 'warning', `Meta description too short: ${metaDesc.length} chars (aim 150-160)`, 'Medium', 'On-Page SEO')
    else if (metaDesc.length > 160) add('meta_desc', 'warning', `Meta description too long: ${metaDesc.length} chars (trim to 160)`, 'Low', 'On-Page SEO')
    else add('meta_desc', 'pass', 'Meta description: good length', 'High', 'On-Page SEO')

    const h1s = $('h1')
    if (h1s.length === 0) add('h1', 'error', 'No H1 heading found on page', 'High', 'On-Page SEO')
    else if (h1s.length > 1) add('h1', 'warning', `${h1s.length} H1 tags found — keep only one`, 'Medium', 'On-Page SEO')
    else add('h1', 'pass', `H1: "${h1s.first().text().trim().substring(0,55)}"`, 'High', 'On-Page SEO')

    const ogTitle = $('meta[property="og:title"]').attr('content') || ''
    if (!ogTitle) add('og', 'warning', 'Missing og:title — poor social media preview', 'Low', 'On-Page SEO')
    else add('og', 'pass', 'Open Graph (og:title) present', 'Low', 'On-Page SEO')

    const imgCount = $('img').length
    const imgNoAlt = $('img').filter((_, el) => { const a = $(el).attr('alt'); return a === undefined || a === '' }).length
    if (imgNoAlt > 0) add('img_alt', 'warning', `${imgNoAlt}/${imgCount} images missing alt text`, 'Medium', 'On-Page SEO')
    else if (imgCount > 0) add('img_alt', 'pass', `All ${imgCount} images have alt text`, 'Medium', 'On-Page SEO')

    // Content
    const wordCount = $('body').text().replace(/\s+/g, ' ').trim().split(' ').filter(w => w.length > 2).length
    if (wordCount < 300) add('content', 'error', `Very low word count: ~${wordCount} words (aim 500+)`, 'High', 'Content Quality')
    else if (wordCount < 700) add('content', 'warning', `Low word count: ~${wordCount} words (aim 800+ for ranking)`, 'Medium', 'Content Quality')
    else add('content', 'pass', `Good content volume: ~${wordCount} words`, 'Medium', 'Content Quality')

    const h2Count = $('h2').length
    if (h2Count === 0) add('structure', 'warning', 'No H2 subheadings — poor content hierarchy', 'Low', 'Content Quality')
    else add('structure', 'pass', `${h2Count} H2 subheadings — good structure`, 'Low', 'Content Quality')

    // Technical
    const canonical = $('link[rel="canonical"]').attr('href') || ''
    if (!canonical) add('canonical', 'warning', 'No canonical URL — risk of duplicate content', 'Medium', 'Technical SEO')
    else add('canonical', 'pass', `Canonical: ${canonical.substring(0,60)}`, 'High', 'Technical SEO')

    const viewport = $('meta[name="viewport"]').attr('content') || ''
    if (!viewport) add('viewport', 'error', 'Missing viewport meta — fails mobile-friendly test', 'High', 'Technical SEO')
    else add('viewport', 'pass', 'Viewport meta present (mobile-ready)', 'High', 'Technical SEO')

    const robotsContent = $('meta[name="robots"]').attr('content') || ''
    if (robotsContent.toLowerCase().includes('noindex'))
      add('robots', 'error', `Page set to noindex: "${robotsContent}" — Google won't index this`, 'High', 'Technical SEO')
    else add('robots', 'pass', 'Page is indexable', 'High', 'Technical SEO')

    const hasSchema = html.includes('"@context"') || html.includes("'@context'")
    if (!hasSchema) add('schema', 'warning', 'No JSON-LD structured data — missing rich result eligibility', 'Medium', 'Technical SEO')
    else add('schema', 'pass', 'Structured data (JSON-LD) found', 'Medium', 'Technical SEO')

    // Score
    const errors = checks.filter(c => c.status === 'error').length
    const warnings = checks.filter(c => c.status === 'warning').length
    const score = Math.max(0, 100 - errors * 13 - warnings * 5)

    // PageSpeed Insights (optional, requires PAGESPEED_API_KEY env var)
    let speed = null
    if (process.env.PAGESPEED_API_KEY) {
      try {
        const { data: ps } = await axios.get(
          `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&key=${process.env.PAGESPEED_API_KEY}&strategy=mobile`,
          { timeout: 30000 }
        )
        const lh = ps.lighthouseResult
        speed = {
          performance: Math.round((lh?.categories?.performance?.score || 0) * 100),
          lcp: lh?.audits?.['largest-contentful-paint']?.displayValue || null,
          cls: lh?.audits?.['cumulative-layout-shift']?.displayValue || null,
          tbt: lh?.audits?.['total-blocking-time']?.displayValue || null,
        }
        const p = speed.performance
        if (p < 50) checks.push({ check: 'perf', status: 'error', message: `Mobile PageSpeed very low: ${p}/100`, impact: 'High', category: 'Page Speed' })
        else if (p < 80) checks.push({ check: 'perf', status: 'warning', message: `Mobile PageSpeed needs work: ${p}/100`, impact: 'Medium', category: 'Page Speed' })
        else checks.push({ check: 'perf', status: 'pass', message: `Mobile PageSpeed good: ${p}/100`, impact: 'Medium', category: 'Page Speed' })
      } catch (e) { console.log('PageSpeed API failed:', e.message) }
    }

    const result = { checks, score, speed, scannedAt: new Date().toISOString(), url }
    await pool.query('INSERT INTO audit_results (site_id, results, score) VALUES ($1,$2,$3)', [req.siteId, JSON.stringify(result), score])
    await pool.query('INSERT INTO seo_metrics (site_id, health) VALUES ($1,$2) ON CONFLICT (site_id) DO UPDATE SET health=$2, updated_at=NOW()', [req.siteId, score])
    for (const c of checks.filter(x => x.status === 'error')) {
      await pool.query('INSERT INTO alerts (site_id, type, message, severity) VALUES ($1,$2,$3,$4)', [req.siteId, 'audit', c.message, 'error'])
    }
    res.json(result)
  } catch (e) {
    console.error('Audit error:', e.message)
    res.status(500).json({ error: `Failed to crawl ${url}: ${e.message}` })
  }
})

app.get('/api/sites/:siteId/audit/latest', auth, verifySite, async (req, res) => {
  const { rows } = await pool.query('SELECT results, score, created_at FROM audit_results WHERE site_id=$1 ORDER BY created_at DESC LIMIT 1', [req.siteId])
  if (!rows[0]) return res.json(null)
  res.json({ ...rows[0].results, score: rows[0].score, scannedAt: rows[0].created_at })
})

// ─── Audit AI Fix ─────────────────────────────────────────────────────────────
app.post('/api/sites/:siteId/audit/ai-fix', auth, verifySite, async (req, res) => {
  const { issue, siteUrl } = req.body
  if (!issue || !siteUrl) return res.status(400).json({ error: 'issue and siteUrl required' })
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: `You are an expert SEO engineer. Given an SEO issue, provide:
1. A 1-sentence plain-English explanation of WHY it matters for rankings
2. The EXACT fix — specific code, copy, or action steps
3. A "Before" and "After" example if applicable
4. Estimated time to fix

Respond in JSON only, no markdown:
{
  "why": "...",
  "fix": "...",
  "before": "...",
  "after": "...",
  "timeToFix": "...",
  "priorityNote": "..."
}`,
      messages: [{
        role: 'user',
        content: `Site: ${siteUrl}\nIssue: ${issue.message}\nCategory: ${issue.category}\nImpact: ${issue.impact}\nStatus: ${issue.status}`
      }]
    })
    const text = response.content?.[0]?.text || '{}'
    try { res.json(JSON.parse(text)) } catch { res.json({ fix: text }) }
  } catch (e) { console.error(e); res.status(500).json({ error: 'AI error' }) }
})

// ─── SERP Analysis — Rank #1 ─────────────────────────────────────────────────
app.post('/api/sites/:siteId/serp-analysis', auth, verifySite, async (req, res) => {
  const { keyword } = req.body
  const engine = normalizeEngine(req.body?.engine)
  if (!keyword || typeof keyword !== 'string' || keyword.trim().length === 0)
    return res.status(400).json({ error: 'keyword required' })
  const kw = keyword.trim().slice(0, 200)

  const { rows: s } = await pool.query('SELECT name, url FROM sites WHERE id=$1', [req.siteId])
  const site = s[0]

  const serpResults = await fetchSerpResults(kw, engine)

  // AI ranking plan
  let plan = null
  try {
    const competitorList = serpResults.length
      ? serpResults.map(r => `${r.position}. ${r.domain} — "${r.title}"`).join('\n')
      : '(SERP data unavailable — generate plan based on keyword only)'
    const engineLabel = engine === 'duckduckgo' ? 'DuckDuckGo' : engine[0].toUpperCase() + engine.slice(1)
    const prompt = `You are a world-class SEO strategist. A site owner wants to rank #1 on ${engineLabel} for: "${kw}"

Their site: ${site.name} (${site.url})

Current ${engineLabel} Page 1 results:
${competitorList}

Create a concrete ranking plan. Return ONLY valid JSON, no markdown, no explanation:
{
  "difficulty": "Easy|Medium|Hard|Very Hard",
  "timeEstimate": "e.g. 2–4 months",
  "whyItMatters": "one sentence on why this keyword drives business value",
  "contentAngle": "the specific content angle / unique spin to beat the #1 result",
  "backlinkTarget": "rough number of backlinks needed",
  "quickWin": "one action they can do this week",
  "steps": [
    { "step": 1, "title": "...", "description": "2–3 sentence action description", "timeframe": "e.g. Week 1", "priority": "High|Medium|Low" }
  ]
}`
    const r = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514', max_tokens: 1800,
      messages: [{ role: 'user', content: prompt }]
    })
    const text = r.content[0].text.trim()
    const jsonStart = text.indexOf('{')
    const jsonEnd = text.lastIndexOf('}')
    try { plan = JSON.parse(jsonStart >= 0 ? text.slice(jsonStart, jsonEnd + 1) : text) }
    catch { plan = { quickWin: text, steps: [] } }
  } catch (e) { console.error('AI plan error:', e) }

  res.json({ keyword: kw, engine, results: serpResults, plan })
})

// ─── AI Visibility Score ──────────────────────────────────────────────────────
app.post('/api/sites/:siteId/ai/visibility', auth, verifySite, async (req, res) => {
  const { query: q } = req.body
  if (!q) return res.status(400).json({ error: 'query required' })
  const { rows: s } = await pool.query('SELECT name, url FROM sites WHERE id=$1', [req.siteId])
  const site = s[0]
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514', max_tokens: 700,
      messages: [{ role: 'user', content: q }],
    })
    const answer = response.content[0].text
    const brand = site.name.toLowerCase()
    const domain = site.url.replace(/https?:\/\/(www\.)?/, '').split('/')[0].toLowerCase()
    const mentioned = answer.toLowerCase().includes(brand) || answer.toLowerCase().includes(domain)
    res.json({ query: q, answer, mentioned, brand: site.name, score: mentioned ? 90 : 15 })
  } catch (e) { console.error(e); res.status(500).json({ error: 'AI error' }) }
})

// ─── AI Action Plan ───────────────────────────────────────────────────────────
app.post('/api/sites/:siteId/ai/action-plan', auth, verifySite, async (req, res) => {
  try {
    const selectedTasks = Array.isArray(req.body?.selectedTasks)
      ? req.body.selectedTasks.filter(t => t && typeof t.text === 'string' && t.text.trim())
      : []

    // Fast path: customer approved specific checked tasks, save directly without regenerating.
    if (req.body.save && selectedTasks.length > 0) {
      let savedCount = 0
      for (const t of selectedTasks) {
        const text = String(t.text || '').trim()
        const impact = String(t.impact || 'Medium').trim() || 'Medium'
        const { rowCount } = await pool.query(
          `INSERT INTO actions (site_id, text, impact)
           SELECT $1, $2, $3
           WHERE NOT EXISTS (
             SELECT 1 FROM actions
             WHERE site_id=$1
               AND LOWER(text)=LOWER($2)
               AND done=false
           )`,
          [req.siteId, text, impact]
        )
        savedCount += rowCount
      }
      return res.json({ saved: savedCount, tasks: selectedTasks })
    }

    const [sR, mR, kR, bR, aR] = await Promise.all([
      pool.query('SELECT * FROM sites WHERE id=$1', [req.siteId]),
      pool.query('SELECT * FROM seo_metrics WHERE site_id=$1 LIMIT 1', [req.siteId]),
      pool.query('SELECT keyword, position FROM keywords WHERE site_id=$1 LIMIT 15', [req.siteId]),
      pool.query('SELECT name, dr, status FROM backlinks WHERE site_id=$1 LIMIT 15', [req.siteId]),
      pool.query('SELECT results FROM audit_results WHERE site_id=$1 ORDER BY created_at DESC LIMIT 1', [req.siteId]),
    ])
    const issues = (aR.rows[0]?.results?.checks || [])
      .filter(c => c.status !== 'pass').map(c => `• ${c.message}`).join('\n') || 'No audit run yet'
    const prompt = `You are a senior SEO strategist. Build a prioritized 6-task action plan.\nSite: ${sR.rows[0]?.name} (${sR.rows[0]?.url})\nDR: ${mR.rows[0]?.dr || 0}, Health: ${mR.rows[0]?.health || 0}, Clicks: ${mR.rows[0]?.clicks || 0}\nKeywords: ${kR.rows.map(k => `${k.keyword} pos${k.position || '?'}`).join(', ') || 'none'}\nBacklinks: ${bR.rows.length} total, ${bR.rows.filter(b => b.status === 'Live').length} live\nAudit issues:\n${issues}\n\nReturn ONLY a JSON array:\n[{"text":"...","impact":"High|Medium|Low","category":"On-Page|Technical|Content|Backlinks|Speed"}]`
    const r = await anthropic.messages.create({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] })
    let tasks = []
    try {
      const raw = r.content[0].text.trim()
      const json = raw.startsWith('[') ? raw : raw.slice(raw.indexOf('['), raw.lastIndexOf(']') + 1)
      tasks = JSON.parse(json)
    } catch { tasks = [{ text: 'Run a site audit to get personalized recommendations', impact: 'High', category: 'Technical' }] }
    if (req.body.save) {
      const toSave = selectedTasks.length > 0 ? selectedTasks : tasks
      let savedCount = 0
      for (const t of toSave) {
        const text = String(t.text || '').trim()
        if (!text) continue
        const impact = String(t.impact || 'Medium').trim() || 'Medium'
        const { rowCount } = await pool.query(
          `INSERT INTO actions (site_id, text, impact)
           SELECT $1, $2, $3
           WHERE NOT EXISTS (
             SELECT 1 FROM actions
             WHERE site_id=$1
               AND LOWER(text)=LOWER($2)
               AND done=false
           )`,
          [req.siteId, text, impact]
        )
        savedCount += rowCount
      }
      return res.json({ saved: savedCount, tasks: toSave })
    }
    res.json(tasks)
  } catch (e) { console.error(e); res.status(500).json({ error: 'Action plan failed' }) }
})

app.post('/api/sites/:siteId/seo/rank-forecast', auth, verifySite, async (req, res) => {
  try {
    const selectedTasks = Array.isArray(req.body?.selectedTasks)
      ? req.body.selectedTasks.filter(t => t && typeof t.text === 'string')
      : []

    const [metricsR, keywordsR, backlinksR, actionsR] = await Promise.all([
      pool.query('SELECT dr, clicks, impressions, health FROM seo_metrics WHERE site_id=$1 LIMIT 1', [req.siteId]),
      pool.query('SELECT keyword, position, volume FROM keywords WHERE site_id=$1 ORDER BY COALESCE(volume, 0) DESC NULLS LAST LIMIT 40', [req.siteId]),
      pool.query('SELECT name, dr, status, type FROM backlinks WHERE site_id=$1', [req.siteId]),
      pool.query('SELECT done, impact FROM actions WHERE site_id=$1', [req.siteId]),
    ])

    const metrics = metricsR.rows[0] || {}
    const keywords = keywordsR.rows || []
    const backlinks = backlinksR.rows || []
    const actions = actionsR.rows || []

    const dr = Number(metrics.dr || 0)
    const health = Number(metrics.health || 0)

    const positions = keywords
      .map(k => Number(k.position))
      .filter(n => Number.isFinite(n) && n > 0)
    const bestPos = positions.length ? Math.min(...positions) : null
    const avgPos = positions.length ? positions.reduce((s, n) => s + n, 0) / positions.length : null

    const liveBacklinks = backlinks.filter(b => b.status === 'Live')
    const liveRefDomains = new Set(liveBacklinks.map(b => String(b.name || '').trim().toLowerCase()).filter(Boolean)).size
    const dofollowCount = liveBacklinks.filter(b => String(b.type || '').toLowerCase() === 'dofollow').length
    const dofollowPct = liveBacklinks.length ? Math.round((dofollowCount / liveBacklinks.length) * 100) : 0

    const completedActions = actions.filter(a => !!a.done).length
    const actionCompletionRatio = actions.length ? (completedActions / actions.length) : 0

    let baseDays = 420
    if (bestPos !== null) {
      if (bestPos <= 3) baseDays = 45
      else if (bestPos <= 10) baseDays = 90
      else if (bestPos <= 20) baseDays = 150
      else if (bestPos <= 50) baseDays = 240
      else baseDays = 365
    }

    let adjustments = 0
    if (dr >= 50) adjustments -= 45
    else if (dr >= 30) adjustments -= 25
    else if (dr >= 15) adjustments -= 10
    else adjustments += 35

    if (health >= 85) adjustments -= 35
    else if (health >= 70) adjustments -= 15
    else if (health < 50) adjustments += 35

    if (liveRefDomains >= 50) adjustments -= 30
    else if (liveRefDomains >= 20) adjustments -= 15
    else if (liveRefDomains < 5) adjustments += 25

    if (dofollowPct >= 60) adjustments -= 20
    else if (dofollowPct < 30) adjustments += 15

    if (actionCompletionRatio >= 0.6) adjustments -= 20
    else if (actionCompletionRatio < 0.2) adjustments += 20

    const selectedBoostRaw = selectedTasks.reduce((sum, t) => {
      const impact = String(t.impact || '').toLowerCase()
      if (impact === 'high' || impact === 'critical') return sum + 12
      if (impact === 'medium') return sum + 7
      return sum + 4
    }, 0)
    const selectedBoost = Math.min(60, selectedBoostRaw)

    const currentDays = Math.max(30, Math.min(720, Math.round(baseDays + adjustments)))
    const estimatedDays = Math.max(30, Math.min(720, Math.round(baseDays + adjustments - selectedBoost)))

    let confidence = 35
    if (bestPos !== null) confidence += 15
    if (keywords.length >= 5) confidence += 10
    if (liveRefDomains >= 10) confidence += 10
    if (health >= 70) confidence += 10
    if (actions.length >= 5) confidence += 5
    confidence = Math.max(10, Math.min(92, confidence))

    const rangeFrom = Math.max(20, Math.round(estimatedDays * 0.8))
    const rangeTo = Math.max(rangeFrom + 5, Math.round(estimatedDays * 1.35))

    res.json({
      estimatedDays,
      currentDays,
      estimatedRange: { from: rangeFrom, to: rangeTo },
      confidence,
      snapshot: {
        dr,
        health,
        bestPosition: bestPos,
        avgPosition: avgPos ? Number(avgPos.toFixed(1)) : null,
        trackedKeywords: keywords.length,
        liveRefDomains,
        dofollowPct,
        completedActions,
        totalActions: actions.length,
      },
      assumptions: [
        'Forecast assumes consistent execution every week.',
        'Google rankings depend on competition and algorithm changes.',
        'This is an estimate, not a guaranteed ranking date.',
      ],
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Forecast failed' })
  }
})

// ─── Link Opportunities ───────────────────────────────────────────────────────
app.post('/api/sites/:siteId/ai/link-opportunities', auth, verifySite, async (req, res) => {
  try {
    const [sR, cR, kR, bR] = await Promise.all([
      pool.query('SELECT name, url FROM sites WHERE id=$1', [req.siteId]),
      pool.query('SELECT name FROM competitors WHERE site_id=$1 LIMIT 10', [req.siteId]),
      pool.query('SELECT keyword FROM keywords WHERE site_id=$1 LIMIT 10', [req.siteId]),
      pool.query('SELECT name FROM backlinks WHERE site_id=$1', [req.siteId]),
    ])
    const site = sR.rows[0]
    const prompt = `You are a link building expert. Suggest 8 specific, realistic link opportunities.\nSite: ${site?.name} (${site?.url})\nKeywords: ${kR.rows.map(k => k.keyword).join(', ') || 'web design, digital agency'}\nCompetitors: ${cR.rows.map(c => c.name).join(', ') || 'none tracked'}\nAlready linked from: ${bR.rows.map(b => b.name).join(', ') || 'none yet'}\n\nReturn ONLY a JSON array:\n[{"site":"Clutch.co","type":"Directory|Guest post|Resource page|Unlinked mention|Partnership","relevance":"High|Medium","strategy":"specific action","estimatedDR":75}]`
    const r = await anthropic.messages.create({ model: 'claude-sonnet-4-20250514', max_tokens: 1200, messages: [{ role: 'user', content: prompt }] })
    let opps = []
    try {
      const raw = r.content[0].text.trim()
      const json = raw.startsWith('[') ? raw : raw.slice(raw.indexOf('['), raw.lastIndexOf(']') + 1)
      opps = JSON.parse(json)
    } catch { opps = [] }
    res.json(opps)
  } catch (e) { console.error(e); res.status(500).json({ error: 'Link opportunities failed' }) }
})

// ─── Alerts ───────────────────────────────────────────────────────────────────
app.get('/api/sites/:siteId/alerts', auth, verifySite, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM alerts WHERE site_id=$1 ORDER BY created_at DESC LIMIT 50', [req.siteId])
  res.json(rows)
})
app.put('/api/alerts/:id/read', auth, async (req, res) => {
  await pool.query('UPDATE alerts SET read=true WHERE id=$1', [req.params.id])
  res.json({ ok: true })
})
app.put('/api/sites/:siteId/alerts/read-all', auth, verifySite, async (req, res) => {
  await pool.query('UPDATE alerts SET read=true WHERE site_id=$1', [req.siteId])
  res.json({ ok: true })
})

function buildRankSummaryAlertMessage(report) {
  if (!report) return 'Weekly rank scan completed.'
  const parts = (report.engines || []).map((e) => `${e.label}: ${e.inFirstPageCount}/${e.checked} on page 1`)
  return `Weekly rank scan completed for ${report.siteName}. ${parts.join(' | ')}.`
}

// ─── Integrations Hub ────────────────────────────────────────────────────────
app.get('/api/sites/:siteId/integrations', auth, verifySite, async (req, res) => {
  const [uR, iR, aR] = await Promise.all([
    pool.query('SELECT gsc_refresh_token FROM users WHERE id=$1', [req.user.id]),
    pool.query('SELECT * FROM integration_settings WHERE site_id=$1 LIMIT 1', [req.siteId]),
    pool.query('SELECT * FROM ahrefs_metrics WHERE site_id=$1 ORDER BY imported_at DESC LIMIT 1', [req.siteId]),
  ])
  res.json({
    gsc: { connected: !!uR.rows[0]?.gsc_refresh_token },
    ga4: {
      connected: !!iR.rows[0]?.ga4_connected,
      propertyId: iR.rows[0]?.ga4_property_id || '',
      measurementId: iR.rows[0]?.ga4_measurement_id || '',
    },
    ahrefs: {
      connected: !!iR.rows[0]?.ahrefs_connected,
      source: iR.rows[0]?.ahrefs_source || null,
      lastImportAt: iR.rows[0]?.ahrefs_last_import_at || null,
      latest: aR.rows[0] || null,
    },
  })
})

app.put('/api/sites/:siteId/integrations/ga4', auth, verifySite, async (req, res) => {
  const { propertyId, measurementId } = req.body
  if (!propertyId) return res.status(400).json({ error: 'propertyId required' })
  await pool.query(
    `INSERT INTO integration_settings (site_id, ga4_connected, ga4_property_id, ga4_measurement_id, updated_at)
     VALUES ($1, true, $2, $3, NOW())
     ON CONFLICT (site_id) DO UPDATE SET
       ga4_connected=true,
       ga4_property_id=$2,
       ga4_measurement_id=$3,
       updated_at=NOW()`,
    [req.siteId, String(propertyId), measurementId ? String(measurementId) : null]
  )
  res.json({ ok: true })
})

app.delete('/api/sites/:siteId/integrations/ga4', auth, verifySite, async (req, res) => {
  await pool.query(
    `INSERT INTO integration_settings (site_id, ga4_connected, ga4_property_id, ga4_measurement_id, updated_at)
     VALUES ($1, false, NULL, NULL, NOW())
     ON CONFLICT (site_id) DO UPDATE SET
       ga4_connected=false,
       ga4_property_id=NULL,
       ga4_measurement_id=NULL,
       updated_at=NOW()`,
    [req.siteId]
  )
  res.json({ ok: true })
})

app.post('/api/sites/:siteId/integrations/ahrefs/manual', auth, verifySite, async (req, res) => {
  const dr = toInt(req.body.dr)
  const backlinks = toInt(req.body.backlinks)
  const refDomains = toInt(req.body.refDomains)
  const organicTraffic = toInt(req.body.organicTraffic)
  const organicKeywords = toInt(req.body.organicKeywords)

  const { rows } = await pool.query(
    `INSERT INTO ahrefs_metrics (site_id, dr, backlinks, ref_domains, organic_traffic, organic_keywords, source)
     VALUES ($1,$2,$3,$4,$5,$6,'manual') RETURNING *`,
    [req.siteId, dr, backlinks, refDomains, organicTraffic, organicKeywords]
  )

  await Promise.all([
    pool.query(
      `INSERT INTO integration_settings (site_id, ahrefs_connected, ahrefs_last_import_at, ahrefs_source, updated_at)
       VALUES ($1, true, NOW(), 'manual', NOW())
       ON CONFLICT (site_id) DO UPDATE SET
         ahrefs_connected=true,
         ahrefs_last_import_at=NOW(),
         ahrefs_source='manual',
         updated_at=NOW()`,
      [req.siteId]
    ),
    pool.query(
      `INSERT INTO seo_metrics (site_id, dr) VALUES ($1,$2)
       ON CONFLICT (site_id) DO UPDATE SET dr=$2, updated_at=NOW()`,
      [req.siteId, dr]
    ),
  ])

  res.json(rows[0])
})

app.post('/api/sites/:siteId/integrations/ahrefs/import-csv', auth, verifySite, async (req, res) => {
  const parsed = parseSimpleCsv(req.body.csvText)
  if (!parsed) return res.status(400).json({ error: 'Invalid CSV. Add a header row and one data row.' })

  const dr = toInt(firstValueByKey(parsed, ['domain rating', 'dr']))
  const backlinks = toInt(firstValueByKey(parsed, ['backlinks']))
  const refDomains = toInt(firstValueByKey(parsed, ['referring domains', 'ref domains']))
  const organicTraffic = toInt(firstValueByKey(parsed, ['organic traffic']))
  const organicKeywords = toInt(firstValueByKey(parsed, ['organic keywords']))

  if ([dr, backlinks, refDomains, organicTraffic, organicKeywords].every(v => v === 0)) {
    return res.status(400).json({
      error: 'No supported metrics found. Include columns like Domain Rating, Backlinks, Referring Domains, Organic Traffic, Organic Keywords.',
    })
  }

  const { rows } = await pool.query(
    `INSERT INTO ahrefs_metrics (site_id, dr, backlinks, ref_domains, organic_traffic, organic_keywords, source)
     VALUES ($1,$2,$3,$4,$5,$6,'csv') RETURNING *`,
    [req.siteId, dr, backlinks, refDomains, organicTraffic, organicKeywords]
  )

  await Promise.all([
    pool.query(
      `INSERT INTO integration_settings (site_id, ahrefs_connected, ahrefs_last_import_at, ahrefs_source, updated_at)
       VALUES ($1, true, NOW(), 'csv', NOW())
       ON CONFLICT (site_id) DO UPDATE SET
         ahrefs_connected=true,
         ahrefs_last_import_at=NOW(),
         ahrefs_source='csv',
         updated_at=NOW()`,
      [req.siteId]
    ),
    pool.query(
      `INSERT INTO seo_metrics (site_id, dr) VALUES ($1,$2)
       ON CONFLICT (site_id) DO UPDATE SET dr=$2, updated_at=NOW()`,
      [req.siteId, dr]
    ),
  ])

  res.json(rows[0])
})

app.delete('/api/sites/:siteId/integrations/ahrefs', auth, verifySite, async (req, res) => {
  await pool.query(
    `INSERT INTO integration_settings (site_id, ahrefs_connected, ahrefs_last_import_at, ahrefs_source, updated_at)
     VALUES ($1, false, NULL, NULL, NOW())
     ON CONFLICT (site_id) DO UPDATE SET
       ahrefs_connected=false,
       ahrefs_last_import_at=NULL,
       ahrefs_source=NULL,
       updated_at=NOW()`,
    [req.siteId]
  )
  res.json({ ok: true })
})

// ─── Email Transporter ───────────────────────────────────────────────────────
function createTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })
}

function buildRankScanEmailHtml(report) {
  const generatedAt = new Date(report.generatedAt || Date.now()).toLocaleString('en-GB')
  const engineRows = (report.engines || []).map(e => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#1e293b">${e.label}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center;color:#1e293b">${e.inFirstPageCount}/${e.checked}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center;color:#16a34a">+${e.enteredCount}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center;color:#dc2626">-${e.droppedCount}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center;color:#64748b">${e.avgPosition ?? '&mdash;'}</td>
    </tr>
  `).join('')

  const transitionRows = (report.transitions || []).slice(0, 14).map(t => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#1e293b">${t.keyword}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center;color:#475569">${engineLabel(t.engine)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center;color:${t.action === 'entered' ? '#16a34a' : '#dc2626'};font-weight:700">${t.action === 'entered' ? 'Entered' : 'Dropped'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center;color:#64748b">${t.prevPosition ?? '&mdash;'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center;color:#1e293b">${t.currentPosition ?? '&mdash;'}</td>
    </tr>
  `).join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:700px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
  <div style="background:linear-gradient(135deg,#1e3a8a,#1d4ed8);padding:26px 30px;color:#fff">
    <h1 style="margin:0 0 6px;font-size:22px;font-weight:700">Weekly Rank Scan Report</h1>
    <p style="margin:0;opacity:.9;font-size:14px">${report.siteName} &middot; ${report.siteDomain}</p>
    <p style="margin:8px 0 0;opacity:.75;font-size:12px">Generated ${generatedAt}</p>
  </div>
  <div style="padding:24px 30px">
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px">
      <div style="flex:1;min-width:130px;background:#f8fafc;border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:24px;font-weight:700;color:#1e293b">${report.checkedKeywords}</div>
        <div style="font-size:12px;color:#64748b">Keywords Checked</div>
      </div>
      <div style="flex:1;min-width:130px;background:#f8fafc;border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:24px;font-weight:700;color:#16a34a">${(report.transitions || []).filter(t => t.action === 'entered').length}</div>
        <div style="font-size:12px;color:#64748b">Entered Page 1</div>
      </div>
      <div style="flex:1;min-width:130px;background:#f8fafc;border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:24px;font-weight:700;color:#dc2626">${(report.transitions || []).filter(t => t.action === 'dropped').length}</div>
        <div style="font-size:12px;color:#64748b">Dropped from Page 1</div>
      </div>
      <div style="flex:1;min-width:130px;background:#f8fafc;border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:24px;font-weight:700;color:#2563eb">${report.alertsCreated || 0}</div>
        <div style="font-size:12px;color:#64748b">Alerts Created</div>
      </div>
    </div>

    <h2 style="margin:0 0 12px;font-size:16px;color:#1e293b">Coverage by Search Engine</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:22px">
      <thead><tr style="background:#f8fafc">
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase">Engine</th>
        <th style="padding:8px 12px;text-align:center;font-size:12px;color:#64748b;text-transform:uppercase">Page 1 Coverage</th>
        <th style="padding:8px 12px;text-align:center;font-size:12px;color:#64748b;text-transform:uppercase">Entered</th>
        <th style="padding:8px 12px;text-align:center;font-size:12px;color:#64748b;text-transform:uppercase">Dropped</th>
        <th style="padding:8px 12px;text-align:center;font-size:12px;color:#64748b;text-transform:uppercase">Avg Pos</th>
      </tr></thead>
      <tbody>${engineRows}</tbody>
    </table>

    <h2 style="margin:0 0 12px;font-size:16px;color:#1e293b">Transitions</h2>
    ${(report.transitions || []).length ? `
      <table style="width:100%;border-collapse:collapse;margin-bottom:10px">
        <thead><tr style="background:#f8fafc">
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase">Keyword</th>
          <th style="padding:8px 12px;text-align:center;font-size:12px;color:#64748b;text-transform:uppercase">Engine</th>
          <th style="padding:8px 12px;text-align:center;font-size:12px;color:#64748b;text-transform:uppercase">Action</th>
          <th style="padding:8px 12px;text-align:center;font-size:12px;color:#64748b;text-transform:uppercase">Prev</th>
          <th style="padding:8px 12px;text-align:center;font-size:12px;color:#64748b;text-transform:uppercase">Now</th>
        </tr></thead>
        <tbody>${transitionRows}</tbody>
      </table>
    ` : `<p style="margin:0;color:#64748b;font-size:14px">No page-1 transitions this week. Rankings were stable.</p>`}
  </div>
</div>
</body>
</html>`
}

async function sendRankScanReportEmail(recipients, report) {
  const transporter = createTransporter()
  if (!transporter) throw new Error('SMTP not configured. Add SMTP_HOST, SMTP_USER, SMTP_PASS to .env')
  await transporter.sendMail({
    from: process.env.SMTP_FROM || `"SEO Reports" <${process.env.SMTP_USER}>`,
    to: recipients.join(', '),
    subject: `Weekly Rank Scan — ${report.siteName} (${new Date().toLocaleDateString('en-GB')})`,
    html: buildRankScanEmailHtml(report),
  })
}

// ─── Email HTML Builder ──────────────────────────────────────────────────────
function buildEmailHtml({ siteName, siteUrl, date, metrics, keywords, backlinks, actions, competitors, alerts }) {
  const dr = metrics?.dr ?? 0
  const health = metrics?.health ?? 0
  const clicks = metrics?.clicks ?? 0
  const impressions = metrics?.impressions ?? 0
  const topKeywords = (keywords || []).slice(0, 10)
  const liveBacklinks = (backlinks || []).filter(b => b.status === 'Live')
  const pendingActions = (actions || []).filter(a => !a.done)
  const doneActions = (actions || []).filter(a => a.done)
  const recentAlerts = (alerts || []).filter(a => !a.read).slice(0, 5)
  const healthColor = health >= 80 ? '#22c55e' : health >= 60 ? '#f97316' : '#ef4444'
  const drColor = dr >= 40 ? '#22c55e' : dr >= 20 ? '#f97316' : '#ef4444'

  const kRows = topKeywords.map(k => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#1e293b">${k.keyword}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center;font-weight:600;color:${k.position <= 10 ? '#22c55e' : k.position <= 30 ? '#f97316' : '#94a3b8'}">${k.position != null ? '#' + k.position : '&mdash;'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center;color:#64748b">${k.volume ? Number(k.volume).toLocaleString() : '&mdash;'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center"><span style="background:${k.difficulty === 'Easy' ? '#dcfce7' : k.difficulty === 'Medium' ? '#fef3c7' : '#fee2e2'};color:${k.difficulty === 'Easy' ? '#166534' : k.difficulty === 'Medium' ? '#92400e' : '#991b1b'};padding:2px 8px;border-radius:99px;font-size:12px">${k.difficulty || '&mdash;'}</span></td>
    </tr>`).join('')

  const blRows = liveBacklinks.slice(0, 10).map(b => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#1e293b">${b.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center;font-weight:600;color:#f97316">DR ${b.dr || 0}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center"><span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:99px;font-size:12px">${b.type === 'dofollow' ? 'Dofollow' : 'Nofollow'}</span></td>
    </tr>`).join('')

  const actionRows = pendingActions.slice(0, 8).map(a => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#1e293b"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${a.impact === 'High' || a.impact === 'Critical' ? '#f97316' : a.impact === 'Medium' ? '#eab308' : '#94a3b8'};margin-right:8px;vertical-align:middle"></span>${a.text}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center"><span style="background:${a.impact === 'High' || a.impact === 'Critical' ? '#fff7ed' : a.impact === 'Medium' ? '#fefce8' : '#f8fafc'};color:${a.impact === 'High' || a.impact === 'Critical' ? '#c2410c' : a.impact === 'Medium' ? '#a16207' : '#64748b'};padding:2px 8px;border-radius:99px;font-size:12px">${a.impact || 'Medium'}</span></td>
    </tr>`).join('')

  const competitorRows = (competitors || []).slice(0, 6).map(c => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#1e293b">${c.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center;font-weight:600;color:#f97316">DR ${c.dr || 0}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:13px">${c.notes || '&mdash;'}</td>
    </tr>`).join('')

  const alertRows = recentAlerts.map(a => `
    <div style="padding:10px 14px;border-left:3px solid ${a.severity === 'danger' ? '#ef4444' : a.severity === 'warning' ? '#f97316' : '#3b82f6'};background:${a.severity === 'danger' ? '#fef2f2' : a.severity === 'warning' ? '#fff7ed' : '#eff6ff'};margin-bottom:8px;border-radius:0 6px 6px 0">
      <p style="margin:0;color:${a.severity === 'danger' ? '#991b1b' : a.severity === 'warning' ? '#9a3412' : '#1d4ed8'};font-size:14px">${a.message}</p>
    </div>`).join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:660px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
  <div style="background:linear-gradient(135deg,#1e1b2e,#2d1b69);padding:28px 32px;color:#fff">
    <h1 style="margin:0 0 4px;font-size:22px;font-weight:700">Daily SEO Report</h1>
    <p style="margin:0;opacity:.8;font-size:14px">${siteName} &middot; ${siteUrl}</p>
    <p style="margin:8px 0 0;opacity:.6;font-size:13px">${date}</p>
  </div>
  <div style="padding:28px 32px">
    <div style="display:flex;gap:12px;margin-bottom:28px;flex-wrap:wrap">
      <div style="flex:1;min-width:110px;background:#f8fafc;border-radius:10px;padding:16px 14px;text-align:center">
        <div style="font-size:26px;font-weight:700;color:${drColor}">${dr}</div>
        <div style="font-size:12px;color:#64748b;margin-top:4px">Domain Rating</div>
      </div>
      <div style="flex:1;min-width:110px;background:#f8fafc;border-radius:10px;padding:16px 14px;text-align:center">
        <div style="font-size:26px;font-weight:700;color:${healthColor}">${health}%</div>
        <div style="font-size:12px;color:#64748b;margin-top:4px">Site Health</div>
      </div>
      <div style="flex:1;min-width:110px;background:#f8fafc;border-radius:10px;padding:16px 14px;text-align:center">
        <div style="font-size:26px;font-weight:700;color:#3b82f6">${Number(clicks).toLocaleString()}</div>
        <div style="font-size:12px;color:#64748b;margin-top:4px">Clicks</div>
      </div>
      <div style="flex:1;min-width:110px;background:#f8fafc;border-radius:10px;padding:16px 14px;text-align:center">
        <div style="font-size:26px;font-weight:700;color:#8b5cf6">${Number(impressions).toLocaleString()}</div>
        <div style="font-size:12px;color:#64748b;margin-top:4px">Impressions</div>
      </div>
      <div style="flex:1;min-width:110px;background:#f8fafc;border-radius:10px;padding:16px 14px;text-align:center">
        <div style="font-size:26px;font-weight:700;color:#22c55e">${doneActions.length}</div>
        <div style="font-size:12px;color:#64748b;margin-top:4px">Actions Done</div>
      </div>
      <div style="flex:1;min-width:110px;background:#f8fafc;border-radius:10px;padding:16px 14px;text-align:center">
        <div style="font-size:26px;font-weight:700;color:#f97316">${pendingActions.length}</div>
        <div style="font-size:12px;color:#64748b;margin-top:4px">Pending Actions</div>
      </div>
    </div>

    ${topKeywords.length ? `
    <h2 style="margin:0 0 12px;font-size:16px;color:#1e293b;border-bottom:2px solid #f1f5f9;padding-bottom:8px">Keywords (${topKeywords.length})</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:28px">
      <thead><tr style="background:#f8fafc">
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase">Keyword</th>
        <th style="padding:8px 12px;text-align:center;font-size:12px;color:#64748b;text-transform:uppercase">Position</th>
        <th style="padding:8px 12px;text-align:center;font-size:12px;color:#64748b;text-transform:uppercase">Volume</th>
        <th style="padding:8px 12px;text-align:center;font-size:12px;color:#64748b;text-transform:uppercase">Difficulty</th>
      </tr></thead>
      <tbody>${kRows}</tbody>
    </table>` : ''}

    ${liveBacklinks.length ? `
    <h2 style="margin:0 0 12px;font-size:16px;color:#1e293b;border-bottom:2px solid #f1f5f9;padding-bottom:8px">Live Backlinks (${liveBacklinks.length})</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:28px">
      <thead><tr style="background:#f8fafc">
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase">Domain</th>
        <th style="padding:8px 12px;text-align:center;font-size:12px;color:#64748b;text-transform:uppercase">DR</th>
        <th style="padding:8px 12px;text-align:center;font-size:12px;color:#64748b;text-transform:uppercase">Type</th>
      </tr></thead>
      <tbody>${blRows}</tbody>
    </table>` : ''}

    ${pendingActions.length ? `
    <h2 style="margin:0 0 12px;font-size:16px;color:#1e293b;border-bottom:2px solid #f1f5f9;padding-bottom:8px">Open SEO Actions (${pendingActions.length})</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:28px">
      <thead><tr style="background:#f8fafc">
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase">Action</th>
        <th style="padding:8px 12px;text-align:center;font-size:12px;color:#64748b;text-transform:uppercase">Impact</th>
      </tr></thead>
      <tbody>${actionRows}</tbody>
    </table>` : ''}

    ${competitors && competitors.length ? `
    <h2 style="margin:0 0 12px;font-size:16px;color:#1e293b;border-bottom:2px solid #f1f5f9;padding-bottom:8px">Competitors (${competitors.length})</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:28px">
      <thead><tr style="background:#f8fafc">
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase">Name</th>
        <th style="padding:8px 12px;text-align:center;font-size:12px;color:#64748b;text-transform:uppercase">DR</th>
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase">Notes</th>
      </tr></thead>
      <tbody>${competitorRows}</tbody>
    </table>` : ''}

    ${recentAlerts.length ? `
    <h2 style="margin:0 0 12px;font-size:16px;color:#1e293b;border-bottom:2px solid #f1f5f9;padding-bottom:8px">Unread Alerts</h2>
    <div style="margin-bottom:28px">${alertRows}</div>` : ''}

  </div>
  <div style="background:#f1f5f9;padding:18px 32px;text-align:center">
    <p style="margin:0;font-size:13px;color:#64748b">Daily SEO Report for <strong>${siteName}</strong></p>
    <p style="margin:6px 0 0;font-size:12px;color:#94a3b8">Manage email settings in your SEO tool &rarr; Email Reports</p>
  </div>
</div>
</body>
</html>`
}

// ─── Send Report Helper ──────────────────────────────────────────────────────
async function sendSiteReport(siteId, recipients) {
  const transporter = createTransporter()
  if (!transporter) throw new Error('SMTP not configured. Add SMTP_HOST, SMTP_USER, SMTP_PASS to .env')
  const [siteR, metricsR, keywordsR, backlinksR, actionsR, competitorsR, alertsR] = await Promise.all([
    pool.query('SELECT name, url FROM sites WHERE id=$1', [siteId]),
    pool.query('SELECT dr, clicks, impressions, health FROM seo_metrics WHERE site_id=$1 LIMIT 1', [siteId]),
    pool.query('SELECT keyword, volume, difficulty, position FROM keywords WHERE site_id=$1 ORDER BY COALESCE(volume,0) DESC LIMIT 20', [siteId]),
    pool.query('SELECT name, dr, status, type FROM backlinks WHERE site_id=$1', [siteId]),
    pool.query('SELECT text, impact, done FROM actions WHERE site_id=$1 ORDER BY done ASC, created_at DESC', [siteId]),
    pool.query('SELECT name, dr, notes FROM competitors WHERE site_id=$1 ORDER BY dr DESC LIMIT 10', [siteId]),
    pool.query('SELECT * FROM alerts WHERE site_id=$1 AND read=false ORDER BY created_at DESC LIMIT 10', [siteId]),
  ])
  const site = siteR.rows[0]
  if (!site) throw new Error('Site not found')
  const html = buildEmailHtml({
    siteName: site.name, siteUrl: site.url,
    date: new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    metrics: metricsR.rows[0],
    keywords: keywordsR.rows,
    backlinks: backlinksR.rows,
    actions: actionsR.rows,
    competitors: competitorsR.rows,
    alerts: alertsR.rows,
  })
  await transporter.sendMail({
    from: process.env.SMTP_FROM || `"SEO Reports" <${process.env.SMTP_USER}>`,
    to: recipients.join(', '),
    subject: `Daily SEO Report — ${site.name} (${new Date().toLocaleDateString('en-GB')})`,
    html,
  })
}

// ─── Email Report API ─────────────────────────────────────────────────────────
app.get('/api/sites/:siteId/email-report', auth, verifySite, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM email_report_settings WHERE site_id=$1 LIMIT 1', [req.siteId])
  res.json(rows[0] || { site_id: req.siteId, enabled: false, recipients: [], send_hour: 8, last_sent_at: null })
})

app.put('/api/sites/:siteId/email-report', auth, verifySite, async (req, res) => {
  const enabled = !!req.body.enabled
  const recipients = (Array.isArray(req.body.recipients) ? req.body.recipients : [])
    .map(e => String(e).trim().toLowerCase())
    .filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
    .slice(0, 20)
  const sendHour = Math.max(0, Math.min(23, parseInt(req.body.send_hour ?? 8)))
  const { rows } = await pool.query(
    `INSERT INTO email_report_settings (site_id, enabled, recipients, send_hour, updated_at)
     VALUES ($1,$2,$3,$4,NOW())
     ON CONFLICT (site_id) DO UPDATE SET enabled=$2, recipients=$3, send_hour=$4, updated_at=NOW()
     RETURNING *`,
    [req.siteId, enabled, recipients, sendHour]
  )
  res.json(rows[0])
})

app.post('/api/sites/:siteId/email-report/send-now', auth, verifySite, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM email_report_settings WHERE site_id=$1', [req.siteId])
    const toList = (Array.isArray(req.body.recipients) && req.body.recipients.length)
      ? req.body.recipients
      : (rows[0]?.recipients || [])
    if (!toList.length) return res.status(400).json({ error: 'No recipients configured' })
    await sendSiteReport(req.siteId, toList)
    res.json({ ok: true, sent_to: toList })
  } catch (e) {
    console.error('Email send failed:', e)
    res.status(500).json({ error: e.message || 'Failed to send email' })
  }
})

// ─── Daily Cron (runs every hour, sends when send_hour matches UTC hour) ─────
cron.schedule('0 * * * *', async () => {
  const hour = new Date().getUTCHours()
  try {
    const { rows } = await pool.query(
      `SELECT site_id, recipients FROM email_report_settings
       WHERE enabled=true
         AND array_length(recipients,1) > 0
         AND send_hour=$1
         AND (last_sent_at IS NULL OR last_sent_at < NOW() - INTERVAL '20 hours')`,
      [hour]
    )
    for (const row of rows) {
      try {
        await sendSiteReport(row.site_id, row.recipients)
        await pool.query('UPDATE email_report_settings SET last_sent_at=NOW() WHERE site_id=$1', [row.site_id])
        console.log(`Report sent: site ${row.site_id} -> ${row.recipients.join(', ')}`)
      } catch (e) {
        console.error(`Report failed site ${row.site_id}:`, e.message)
      }
    }
  } catch (e) {
    console.error('Cron check failed:', e)
  }
})

// ─── Weekly Rank Transition Scan (Sunday 02:20 UTC) ─────────────────────────
cron.schedule('20 2 * * 0', async () => {
  try {
    const { rows: sites } = await pool.query(
      `SELECT s.id
       FROM sites s
       WHERE EXISTS (SELECT 1 FROM keywords k WHERE k.site_id=s.id)
       ORDER BY s.id ASC`
    )

    let totalChecked = 0
    let totalAlerts = 0
    for (const s of sites) {
      try {
        const scan = await scanSiteKeywordTransitions(s.id, SUPPORTED_ENGINES, 30)
        totalChecked += scan.checked
        totalAlerts += scan.alertsCreated

        if (scan.report) {
          await pool.query(
            'INSERT INTO alerts (site_id, type, message, severity) VALUES ($1,$2,$3,$4)',
            [s.id, 'rank-weekly-report', buildRankSummaryAlertMessage(scan.report), 'info']
          )

          const { rows: eRows } = await pool.query(
            'SELECT enabled, recipients FROM email_report_settings WHERE site_id=$1 LIMIT 1',
            [s.id]
          )
          const cfg = eRows[0]
          const recipients = cfg?.enabled && Array.isArray(cfg?.recipients) && cfg.recipients.length
            ? cfg.recipients
            : []
          if (recipients.length) {
            try {
              await sendRankScanReportEmail(recipients, scan.report)
            } catch (e) {
              console.error(`Weekly rank scan email failed for site ${s.id}:`, e.message)
            }
          }
        }
      } catch (e) {
        console.error(`Weekly rank scan failed for site ${s.id}:`, e.message)
      }
    }
    console.log(`Weekly rank scan complete: checks=${totalChecked}, alerts=${totalAlerts}, sites=${sites.length}`)
  } catch (e) {
    console.error('Weekly rank scan cron failed:', e)
  }
})

initDB().then(() => {
  app.listen(PORT, () => console.log(`SEO backend running on port ${PORT}`))
}).catch(err => { console.error('DB init failed:', err); process.exit(1) })
