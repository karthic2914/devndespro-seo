const axios = require('axios')
const cheerio = require('cheerio')
const { pool } = require('../clients')

async function ensureCompetitorDetailColumns() {
  await pool.query(`ALTER TABLE competitors ADD COLUMN IF NOT EXISTS title TEXT DEFAULT ''`)
  await pool.query(`ALTER TABLE competitors ADD COLUMN IF NOT EXISTS summary TEXT DEFAULT ''`)
  await pool.query(`ALTER TABLE competitors ADD COLUMN IF NOT EXISTS industry TEXT DEFAULT ''`)
  await pool.query(`ALTER TABLE competitors ADD COLUMN IF NOT EXISTS location TEXT DEFAULT ''`)
}

function normalizeDomain(raw) {
  const value = String(raw || '').trim()
  if (!value) return ''
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`)
    return url.hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return value
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .split('/')[0]
      .toLowerCase()
  }
}

/**
 * Pull basic public details from a competitor homepage.
 */
async function fetchCompetitorPageBasics(domain) {
  const host = normalizeDomain(domain)
  if (!host) return null
  const url = `https://${host}/`
  try {
    const { data: html } = await axios.get(url, {
      timeout: 10000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DevnDesproSEO/1.0; +https://seo.devndespro.com)',
        Accept: 'text/html',
      },
      responseType: 'text',
      validateStatus: (s) => s >= 200 && s < 400,
    })
    const $ = cheerio.load(String(html || ''))
    const title = String($('title').first().text() || '').replace(/\s+/g, ' ').trim().slice(0, 180)
    const metaDesc = String(
      $('meta[name="description"]').attr('content') ||
      $('meta[property="og:description"]').attr('content') ||
      ''
    ).replace(/\s+/g, ' ').trim().slice(0, 280)
    const h1 = String($('h1').first().text() || '').replace(/\s+/g, ' ').trim().slice(0, 160)
    return {
      domain: host,
      url,
      title,
      summary: metaDesc || h1 || title || '',
      h1,
    }
  } catch {
    return {
      domain: host,
      url: `https://${host}/`,
      title: '',
      summary: '',
      h1: '',
    }
  }
}

async function enrichCompetitorBasics(domains = []) {
  const unique = [...new Set((domains || []).map(normalizeDomain).filter(Boolean))].slice(0, 8)
  const out = []
  for (const domain of unique) {
    // sequential to avoid hammering many sites at once
    // eslint-disable-next-line no-await-in-loop
    out.push(await fetchCompetitorPageBasics(domain))
  }
  return out
}

function isAutoSourcedCompetitor(row) {
  const notes = String(row?.notes || '').toLowerCase()
  return (
    notes.includes('backlink competitor') ||
    notes.includes('ranking overlap') ||
    notes.includes('suggested from site crawl') ||
    notes.includes('auto-discovered') ||
    notes.includes('ai-suggested') ||
    notes.includes('ai suggested') ||
    notes.startsWith('same niche')
  )
}

module.exports = {
  ensureCompetitorDetailColumns,
  normalizeDomain,
  fetchCompetitorPageBasics,
  enrichCompetitorBasics,
  isAutoSourcedCompetitor,
}
