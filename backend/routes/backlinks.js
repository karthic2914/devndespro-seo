const express = require('express')
const axios = require('axios')
const cheerio = require('cheerio')
const { pool } = require('../clients')
const { auth, verifySite } = require('../middleware')
const { firstValueByKey, parseCsvRows, toInt } = require('../utils/helpers')

const router = express.Router()

router.get('/:siteId/backlinks', auth, verifySite, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM backlinks WHERE site_id=$1 ORDER BY dr DESC', [req.siteId])
  res.json(rows)
})
router.post('/:siteId/backlinks', auth, verifySite, async (req, res) => {
  const { name, dr, status, anchor, url, type, source } = req.body
  const finalSource = ['manual', 'domain'].includes(String(source || '').toLowerCase())
    ? String(source).toLowerCase()
    : 'manual'
  const { rows } = await pool.query(
    'INSERT INTO backlinks (site_id, name, dr, status, anchor, url, type, source) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
    [req.siteId, name, dr || 0, status || 'Todo', anchor || '', url || '', type || 'dofollow', finalSource]
  )
  res.json(rows[0])
})
router.put('/:siteId/backlinks/:id', auth, verifySite, async (req, res) => {
  const { rows } = await pool.query('UPDATE backlinks SET status=$1 WHERE id=$2 AND site_id=$3 RETURNING *', [req.body.status, req.params.id, req.siteId])
  res.json(rows[0])
})
router.delete('/:siteId/backlinks/:id', auth, verifySite, async (req, res) => {
  await pool.query('DELETE FROM backlinks WHERE id=$1 AND site_id=$2', [req.params.id, req.siteId])
  res.json({ ok: true })
})

router.post('/:siteId/backlinks/import-detailed-csv', auth, verifySite, async (req, res) => {
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
      `INSERT INTO backlinks (site_id, name, dr, status, anchor, url, type, source) VALUES ($1,$2,$3,$4,$5,$6,$7,'csv')`,
      [req.siteId, finalName, dr, status, anchor, finalUrl, type]
    )
    imported++
  }

  res.json({ imported, skipped, totalRows: rows.length })
})

router.post('/:siteId/backlinks/crawl', auth, verifySite, async (req, res) => {
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

  const safeFetch = async (url) => {
    try {
      const r = await axios.get(url, {
        timeout: 10000, maxRedirects: 3,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SEOToolBot/1.0)' },
        validateStatus: s => s < 400,
      })
      return r.data
    } catch { return null }
  }

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

  const saved = []
  const seen = new Set()
  const { rows: existing } = await pool.query('SELECT url FROM backlinks WHERE site_id=$1', [req.siteId])
  existing.forEach(r => r.url && seen.add(r.url))

  for (const item of discovered) {
    const pageUrl = item.sourceUrl
    if (!pageUrl || seen.has(pageUrl)) continue
    seen.add(pageUrl)

    let verified = item.via === 'Seed crawl'
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
      `INSERT INTO backlinks (site_id, name, dr, status, anchor, url, type, source) VALUES ($1,$2,0,'Todo',$3,$4,$5,'crawled') RETURNING *`,
      [req.siteId, domain, anchor, pageUrl, linkType]
    )
    saved.push(inserted[0])
  }

  res.json({ saved: saved.length, details: saved, errors })
})

module.exports = router
