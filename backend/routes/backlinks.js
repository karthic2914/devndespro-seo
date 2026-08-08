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

router.post('/:siteId/authority-score', auth, verifySite, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         COUNT(*) AS total_backlinks,
         COUNT(DISTINCT name) AS referring_domains,
         COALESCE(AVG(dr), 0) AS avg_dr,
         COUNT(*) FILTER (WHERE type = 'dofollow') AS dofollow_count
       FROM backlinks
       WHERE site_id = $1
         AND status = 'Live'`,
      [req.siteId]
    )

    const row = rows[0] || {}

    const totalBacklinks = Math.max(
      0,
      parseInt(row.total_backlinks || 0, 10)
    )

    const referringDomains = Math.max(
      0,
      parseInt(row.referring_domains || 0, 10)
    )

    const avgDr = Math.max(
      0,
      Math.min(100, parseFloat(row.avg_dr || 0))
    )

    const dofollowCount = Math.max(
      0,
      parseInt(row.dofollow_count || 0, 10)
    )

    // ---------------------------------------------------------
    // Authority Engine v2
    // ---------------------------------------------------------
    //
    // Uses logarithmic scaling because authority growth
    // should have diminishing returns.
    //
    // 200 referring domains ~= maximum domain-diversity score.
    // 1000 live backlinks ~= maximum backlink-volume score.
    // ---------------------------------------------------------

    const logScore = (value, target) => {
      if (!value || value <= 0) return 0

      return Math.min(
        100,
        Math.round(
          100 *
          Math.log10(value + 1) /
          Math.log10(target + 1)
        )
      )
    }

    const referringDomainScore =
      logScore(referringDomains, 200)

    const drScore =
      Math.round(avgDr)

    const dofollowRatio =
      totalBacklinks > 0
        ? (dofollowCount / totalBacklinks) * 100
        : 0

    // Full credit around 70%+ dofollow.
    // This prevents raw dofollow backlink count from
    // artificially inflating authority.
    const dofollowScore =
      Math.min(
        100,
        Math.round((dofollowRatio / 70) * 100)
      )

    const backlinkVolumeScore =
      logScore(totalBacklinks, 1000)

    const weightedScore =
      (referringDomainScore * 0.40) +
      (drScore * 0.30) +
      (dofollowScore * 0.15) +
      (backlinkVolumeScore * 0.15)

    const score = Math.max(
      0,
      Math.min(100, Math.round(weightedScore))
    )

    const { rows: updated } = await pool.query(
      `UPDATE sites
       SET authority_score = $1,
           authority_updated_at = NOW()
       WHERE id = $2
       RETURNING authority_score, authority_updated_at`,
      [score, req.siteId]
    )

    res.json({
      ...updated[0],

      authority_version: '2.0',

      breakdown: {
        referringDomains: {
          value: referringDomains,
          score: referringDomainScore,
          weight: 40
        },

        averageDR: {
          value: Math.round(avgDr * 10) / 10,
          score: drScore,
          weight: 30
        },

        dofollow: {
          count: dofollowCount,
          ratio: Math.round(dofollowRatio * 10) / 10,
          score: dofollowScore,
          weight: 15
        },

        backlinks: {
          value: totalBacklinks,
          score: backlinkVolumeScore,
          weight: 15
        }
      }
    })

  } catch (error) {
    console.error(
      'Authority score calculation failed:',
      error
    )

    res.status(500).json({
      error: 'Failed to calculate authority score'
    })
  }
})
module.exports = router
