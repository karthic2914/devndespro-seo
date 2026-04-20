const express = require('express')
const { pool } = require('../clients')
const { auth, verifySite } = require('../middleware')
const { firstValueByKey, parseCsvRows, toInt } = require('../utils/helpers')
const { analyzeBacklinkLandscape } = require('../utils/backlinkEngine')

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
  const [siteRows, existingRows] = await Promise.all([
    pool.query('SELECT name, url FROM sites WHERE id=$1', [req.siteId]),
    pool.query('SELECT name, url, anchor FROM backlinks WHERE site_id=$1', [req.siteId]),
  ])

  if (!siteRows.rows[0]) return res.status(404).json({ error: 'Site not found' })

  const seedUrls = Array.isArray(req.body?.seeds) ? req.body.seeds.slice(0, 10) : []
  const analysis = await analyzeBacklinkLandscape({
    siteName: siteRows.rows[0].name,
    siteUrl: siteRows.rows[0].url,
    existingBacklinks: existingRows.rows,
    seedUrls,
  })

  const saved = []
  for (const item of analysis.verifiedBacklinks) {
    const { rows } = await pool.query(
      `INSERT INTO backlinks (site_id, name, dr, status, anchor, url, type, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [req.siteId, item.name, Number(item.dr || 0), item.status || 'Live', item.anchor || '', item.url || '', item.type || 'dofollow', item.source || 'crawled']
    )
    saved.push(rows[0])
  }

  res.json({
    saved: saved.length,
    details: saved,
    opportunities: analysis.opportunities,
    stats: analysis.stats,
    errors: analysis.errors,
  })
})

module.exports = router
