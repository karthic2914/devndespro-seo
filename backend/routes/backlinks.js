const express = require('express')
const { pool } = require('../clients')
const { auth, verifySite, requireFeature } = require('../middleware')
const { firstValueByKey, parseCsvRows, toInt } = require('../utils/helpers')
const { analyzeBacklinkLandscape } = require('../utils/backlinkEngine')
const { verifyBacklink } = require('../utils/backlinkVerifier')
const {
  fetchDataForSeoBacklinks,
  fetchDataForSeoTimeseries,
  fetchBacklinkOverview,
  fetchDomainIntersection,
  normalizeTarget,
} = require('../utils/dataForSeoBacklinks')
const { calculateBacklinkQuality, calculateAuthority } = require('../utils/backlinkScoreEngine')
const { discoverCandidates, verifyCandidateBatch } = require('../utils/backlinkDiscoveryEngine')
const { crawlLinkGraph, normalizeHost: normalizeIndexHost } = require('../utils/webLinkCrawler')

const router = express.Router()

// Backlinks: admin always; others need is_paid or backlinks_enabled.
router.use('/:siteId/backlinks', auth, verifySite, requireFeature('backlinks'))
router.use('/:siteId/backlink-opportunities', auth, verifySite, requireFeature('backlinks'))

const normalizeBacklinkDomain = (raw) => {
  const value = String(raw || '').trim()
  if (!value) return ''

  try {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`
    return new URL(withProtocol).hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return value
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .split('/')[0]
      .toLowerCase()
  }
}

let backlinkSchemaReady = false

const ensureBacklinkIntelligenceSchema = async () => {
  if (backlinkSchemaReady) return

  await pool.query(`
    ALTER TABLE backlinks
      ADD COLUMN IF NOT EXISTS source_domain TEXT,
      ADD COLUMN IF NOT EXISTS target_url TEXT,
      ADD COLUMN IF NOT EXISTS first_seen TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS last_checked TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS http_status INTEGER,
      ADD COLUMN IF NOT EXISTS is_live BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS is_lost BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS is_broken BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS quality_score INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS spam_score INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'Unverified',
      ADD COLUMN IF NOT EXISTS verification_reason TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS source_final_url TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS source_page_title TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS source_language TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS source_canonical TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS source_robots_noindex BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS rel_nofollow BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS rel_sponsored BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS rel_ugc BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS link_position TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS link_context TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS verification_evidence JSONB DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS verification_source TEXT DEFAULT '',
      ADD COLUMN IF NOT EXISTS provider_rank INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS provider_page_rank INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS provider_spam_score INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS provider_first_seen TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS provider_last_seen TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS quality_breakdown JSONB DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS quality_updated_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS dofollow BOOLEAN
  `)

  // Keep dofollow boolean in sync with type + rel_nofollow so queries
  // that use "dofollow" never hit "column does not exist".
  await pool.query(`
    UPDATE backlinks
    SET dofollow = CASE
      WHEN COALESCE(rel_nofollow, FALSE) = TRUE THEN FALSE
      WHEN LOWER(COALESCE(type, '')) = 'nofollow' THEN FALSE
      ELSE TRUE
    END
    WHERE dofollow IS NULL
       OR dofollow IS DISTINCT FROM (
         CASE
           WHEN COALESCE(rel_nofollow, FALSE) = TRUE THEN FALSE
           WHEN LOWER(COALESCE(type, '')) = 'nofollow' THEN FALSE
           ELSE TRUE
         END
       )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS backlink_opportunities (
      id BIGSERIAL PRIMARY KEY,
      site_id BIGINT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      source_domain TEXT NOT NULL,
      source_url TEXT DEFAULT '',
      target_url TEXT DEFAULT '',
      strategy TEXT DEFAULT '',
      opportunity_type TEXT DEFAULT 'prospect',
      relevance TEXT DEFAULT '',
      estimated_dr INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'Prospect',
      evidence TEXT DEFAULT '',
      source TEXT NOT NULL DEFAULT 'manual',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_backlink_opportunity_site_domain_url
    ON backlink_opportunities(
      site_id,
      lower(source_domain),
      lower(COALESCE(source_url, ''))
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS backlink_growth_cache (
      site_id BIGINT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      months INTEGER NOT NULL,
      source TEXT NOT NULL DEFAULT 'tracked',
      target TEXT DEFAULT '',
      series JSONB NOT NULL DEFAULT '[]'::jsonb,
      cost NUMERIC DEFAULT 0,
      fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (site_id, months)
    )
  `)

    await pool.query(`
    ALTER TABLE sites
      ADD COLUMN IF NOT EXISTS authority_version TEXT DEFAULT '3.0',
      ADD COLUMN IF NOT EXISTS authority_breakdown JSONB DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS domain_rank INTEGER,
      ADD COLUMN IF NOT EXISTS domain_rank_updated_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS domain_rank_meta JSONB DEFAULT '{}'::jsonb,
      ADD COLUMN IF NOT EXISTS disavow_tracker JSONB DEFAULT '{}'::jsonb
  `)
backlinkSchemaReady = true
}


let backlinkDiscoverySchemaReady = false

const ensureBacklinkDiscoverySchema = async () => {
  if (backlinkDiscoverySchemaReady) return

  await pool.query(`
    CREATE TABLE IF NOT EXISTS backlink_discovery_runs (
      id BIGSERIAL PRIMARY KEY,
      site_id BIGINT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      provider TEXT NOT NULL DEFAULT 'hybrid',
      status TEXT NOT NULL DEFAULT 'Running',
      queries_run INTEGER NOT NULL DEFAULT 0,
      candidates_found INTEGER NOT NULL DEFAULT 0,
      candidates_verified INTEGER NOT NULL DEFAULT 0,
      live_found INTEGER NOT NULL DEFAULT 0,
      lost_found INTEGER NOT NULL DEFAULT 0,
      broken_found INTEGER NOT NULL DEFAULT 0,
      errors JSONB NOT NULL DEFAULT '[]'::jsonb,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at TIMESTAMPTZ
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS backlink_candidates (
      id BIGSERIAL PRIMARY KEY,
      site_id BIGINT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      discovery_run_id BIGINT REFERENCES backlink_discovery_runs(id) ON DELETE SET NULL,
      source_url TEXT NOT NULL,
      source_domain TEXT NOT NULL DEFAULT '',
      result_title TEXT DEFAULT '',
      result_description TEXT DEFAULT '',
      query TEXT DEFAULT '',
      provider TEXT NOT NULL DEFAULT 'unknown',
      candidate_status TEXT NOT NULL DEFAULT 'Candidate',
      verification_status TEXT DEFAULT 'Unverified',
      verification_reason TEXT DEFAULT '',
      discovered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      verified_at TIMESTAMPTZ,
      evidence JSONB NOT NULL DEFAULT '{}'::jsonb
    )
  `)

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_backlink_candidate_site_url
    ON backlink_candidates(site_id, lower(source_url))
  `)

  backlinkDiscoverySchemaReady = true
}
let linkIndexSchemaReady = false

const ensureLinkIndexSchema = async () => {
  if (linkIndexSchemaReady) return

  await pool.query(`
    CREATE TABLE IF NOT EXISTS link_index_pages (
      id BIGSERIAL PRIMARY KEY,
      url TEXT NOT NULL,
      normalized_url TEXT NOT NULL,
      domain TEXT NOT NULL,
      http_status INTEGER,
      content_type TEXT DEFAULT '',
      page_title TEXT DEFAULT '',
      canonical_url TEXT DEFAULT '',
      robots_allowed BOOLEAN DEFAULT TRUE,
      crawl_status TEXT NOT NULL DEFAULT 'Pending',
      crawl_depth INTEGER NOT NULL DEFAULT 0,
      first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_crawled TIMESTAMPTZ,
      next_crawl TIMESTAMPTZ,
      last_error TEXT DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_link_index_pages_normalized_url
    ON link_index_pages(lower(normalized_url))
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS link_index_edges (
      id BIGSERIAL PRIMARY KEY,
      source_url TEXT NOT NULL,
      source_domain TEXT NOT NULL,
      target_url TEXT NOT NULL,
      target_domain TEXT NOT NULL,
      anchor_text TEXT DEFAULT '',
      rel_nofollow BOOLEAN DEFAULT FALSE,
      rel_sponsored BOOLEAN DEFAULT FALSE,
      rel_ugc BOOLEAN DEFAULT FALSE,
      link_position TEXT DEFAULT '',
      first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_checked TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      is_present BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS uq_link_index_edge
    ON link_index_edges(
      lower(source_url),
      lower(target_url),
      lower(anchor_text)
    )
  `)

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_link_index_edges_target_domain
    ON link_index_edges(lower(target_domain))
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS link_index_runs (
      id BIGSERIAL PRIMARY KEY,
      site_id BIGINT REFERENCES sites(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'Running',
      seed_count INTEGER NOT NULL DEFAULT 0,
      pages_crawled INTEGER NOT NULL DEFAULT 0,
      pages_skipped INTEGER NOT NULL DEFAULT 0,
      links_extracted INTEGER NOT NULL DEFAULT 0,
      backlinks_detected INTEGER NOT NULL DEFAULT 0,
      errors JSONB NOT NULL DEFAULT '[]'::jsonb,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at TIMESTAMPTZ
    )
  `)

  linkIndexSchemaReady = true
}
const persistBacklinkVerification = async (siteId, backlinkId, result) => {
  const status = result.isLive
    ? 'Live'
    : result.verificationStatus === 'Lost'
      ? 'Lost'
      : result.verificationStatus === 'Broken'
        ? 'Broken'
        : 'Todo'

  const { rows } = await pool.query(
    `UPDATE backlinks
     SET
       status = $1,
       anchor = CASE
         WHEN $2 <> '' THEN $2
         ELSE anchor
       END,
       type = COALESCE(NULLIF($3, ''), type),
       target_url = CASE
         WHEN $4 <> '' THEN $4
         ELSE target_url
       END,
       verified_at = NOW(),
       verification_status = $5,
       verification_reason = $6,
       source_final_url = $7,
       source_page_title = $8,
       source_language = $9,
       source_canonical = $10,
       source_robots_noindex = $11,
       rel_nofollow = $12,
       rel_sponsored = $13,
       rel_ugc = $14,
       link_position = $15,
       link_context = $16,
       verification_evidence = $17::jsonb,
       http_status = $18,
       is_live = $19,
       is_lost = $20,
       is_broken = $21,
       last_checked = NOW(),
       last_seen = CASE
         WHEN $19 THEN NOW()
         ELSE last_seen
       END,
       first_seen = CASE
         WHEN $19 THEN COALESCE(first_seen, NOW())
         ELSE first_seen
       END
     WHERE id = $22
       AND site_id = $23
     RETURNING *`,
    [
      status,
      result.anchorText || '',
      result.type || '',
      result.targetResolvedUrl || '',
      result.verificationStatus || 'Unverified',
      result.reason || '',
      result.sourceFinalUrl || '',
      result.sourcePageTitle || '',
      result.sourceLanguage || '',
      result.sourceCanonical || '',
      Boolean(result.sourceRobotsNoindex),
      Boolean(result.relNofollow),
      Boolean(result.relSponsored),
      Boolean(result.relUgc),
      result.linkPosition || '',
      result.linkContext || '',
      JSON.stringify(result.evidence || {}),
      result.httpStatus ?? null,
      Boolean(result.isLive),
      Boolean(result.isLost),
      Boolean(result.isBroken),
      backlinkId,
      siteId,
    ]
  )

  return rows[0] || null
}
const recalculateBacklinkQualityForSite = async (siteId) => {
  const { rows } = await pool.query(
    `SELECT *
     FROM backlinks
     WHERE site_id=$1
       AND COALESCE(source, '') <> 'domain'`,
    [siteId]
  )

  const updated = []

  for (const row of rows) {
    const quality = calculateBacklinkQuality(row)

    const result = await pool.query(
      `UPDATE backlinks
       SET
         quality_score=$1,
         spam_score=$2,
         quality_breakdown=$3::jsonb,
         quality_updated_at=NOW()
       WHERE id=$4
         AND site_id=$5
       RETURNING *`,
      [
        quality.score,
        quality.spamScore,
        JSON.stringify(quality.breakdown),
        row.id,
        siteId,
      ]
    )

    if (result.rows[0]) {
      updated.push(result.rows[0])
    }
  }

  return updated
}
router.get('/:siteId/backlinks', auth, verifySite, async (req, res) => {
  await ensureBacklinkIntelligenceSchema()

  const { rows } = await pool.query(
    `SELECT *
     FROM backlinks
     WHERE site_id = $1
       AND COALESCE(source, '') <> 'domain'
     ORDER BY dr DESC, id DESC`,
    [req.siteId]
  )

  res.json(rows)
})
router.post('/:siteId/backlinks', auth, verifySite, async (req, res) => {
  await ensureBacklinkIntelligenceSchema()

  const {
    name,
    dr,
    status,
    anchor,
    url,
    type,
    source,
    targetUrl,
    httpStatus,
  } = req.body

  const finalSource = ['manual', 'csv', 'crawled'].includes(
    String(source || '').toLowerCase()
  )
    ? String(source).toLowerCase()
    : 'manual'

  const sourceDomain = normalizeBacklinkDomain(url || name)
  const finalStatus = status || 'Todo'
  const isLive = finalStatus === 'Live'

  const { rows } = await pool.query(
    `INSERT INTO backlinks (
       site_id, name, dr, status, anchor, url, type, source,
       source_domain, target_url, first_seen, last_seen,
       last_checked, http_status, is_live, is_lost, is_broken
     )
     VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
       NOW(),
       CASE WHEN $11 THEN NOW() ELSE NULL END,
       NOW(),
       $12,
       $11,
       FALSE,
       FALSE
     )
     RETURNING *`,
    [
      req.siteId,
      name || sourceDomain,
      dr || 0,
      finalStatus,
      anchor || '',
      url || '',
      type || 'dofollow',
      finalSource,
      sourceDomain,
      targetUrl || '',
      isLive,
      httpStatus || null,
    ]
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

router.get('/:siteId/backlinks/discovery-health', auth, verifySite, async (req, res) => {
  await ensureBacklinkDiscoverySchema()

  const latestRun = await pool.query(
    `SELECT *
     FROM backlink_discovery_runs
     WHERE site_id=$1
     ORDER BY started_at DESC
     LIMIT 1`,
    [req.siteId]
  )

  const candidateCounts = await pool.query(
    `SELECT
       COUNT(*) AS total,
       COUNT(*) FILTER (
         WHERE candidate_status='VerifiedBacklink'
       ) AS verified,
       COUNT(*) FILTER (
         WHERE verification_status='Lost'
       ) AS lost,
       COUNT(*) FILTER (
         WHERE verification_status='Broken'
       ) AS broken
     FROM backlink_candidates
     WHERE site_id=$1`,
    [req.siteId]
  )

  res.json({
    provider: 'brave',
    providerConfigured:
      Boolean(process.env.BRAVE_SEARCH_API_KEY),
    latestRun: latestRun.rows[0] || null,
    candidates: {
      total: Number(candidateCounts.rows[0]?.total || 0),
      verified: Number(candidateCounts.rows[0]?.verified || 0),
      lost: Number(candidateCounts.rows[0]?.lost || 0),
      broken: Number(candidateCounts.rows[0]?.broken || 0),
    },
  })
})
router.post('/:siteId/backlinks/discover', auth, verifySite, async (req, res) => {
  await ensureBacklinkIntelligenceSchema()
  await ensureBacklinkDiscoverySchema()

  const siteResult = await pool.query(
    'SELECT id, name, url FROM sites WHERE id=$1',
    [req.siteId]
  )

  const site = siteResult.rows[0]

  if (!site?.url) {
    return res.status(400).json({
      error: 'Target site URL is missing'
    })
  }

  const requestedMax = Number(req.body?.maxResults || 120)
  const maxResults = Math.max(1, Math.min(200, requestedMax))

  const seedUrls = Array.isArray(req.body?.seeds)
    ? req.body.seeds.slice(0, 30)
    : []

  const opportunityResult = await pool.query(
    `SELECT source_url
     FROM backlink_opportunities
     WHERE site_id=$1
       AND COALESCE(source_url, '') <> ''
       AND status NOT IN ('Won', 'Rejected')
     ORDER BY estimated_dr DESC, updated_at DESC
     LIMIT 100`,
    [req.siteId]
  )

  const opportunityUrls = opportunityResult.rows
    .map((row) => row.source_url)
    .filter(Boolean)

  const runResult = await pool.query(
    `INSERT INTO backlink_discovery_runs (
       site_id,
       provider,
       status
     )
     VALUES ($1, 'hybrid', 'Running')
     RETURNING *`,
    [req.siteId]
  )

  const run = runResult.rows[0]

  try {
    const discovery = await discoverCandidates({
      siteName: site.name,
      siteUrl: site.url,
      seedUrls,
      opportunityUrls,
      maxResults,
      country: String(req.body?.country || 'ALL').slice(0, 3).toUpperCase(),
      searchLang: String(req.body?.searchLang || 'en').slice(0, 8),
    })

    const existingResult = await pool.query(
      `SELECT
         lower(COALESCE(source_final_url, url, '')) AS source_url
       FROM backlinks
       WHERE site_id=$1`,
      [req.siteId]
    )

    const existingUrls = new Set(
      existingResult.rows
        .map((row) => String(row.source_url || '').toLowerCase())
        .filter(Boolean)
    )

    const candidates = discovery.candidates.filter(
      (candidate) =>
        !existingUrls.has(String(candidate.url || '').toLowerCase())
    )

    for (const candidate of candidates) {
      await pool.query(
        `INSERT INTO backlink_candidates (
           site_id,
           discovery_run_id,
           source_url,
           source_domain,
           result_title,
           result_description,
           query,
           provider,
           candidate_status,
           evidence
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Candidate',$9::jsonb)
         ON CONFLICT (
           site_id,
           lower(source_url)
         )
         DO UPDATE SET
           discovery_run_id = EXCLUDED.discovery_run_id,
           result_title = EXCLUDED.result_title,
           result_description = EXCLUDED.result_description,
           query = EXCLUDED.query,
           provider = EXCLUDED.provider,
           discovered_at = NOW()`,
        [
          req.siteId,
          run.id,
          candidate.url,
          candidate.domain || '',
          candidate.title || '',
          candidate.description || '',
          candidate.query || '',
          candidate.provider || 'unknown',
          JSON.stringify({
            searchTitle: candidate.title || '',
            searchDescription: candidate.description || '',
          }),
        ]
      )
    }

    const verified = await verifyCandidateBatch({
      candidates,
      targetUrl: site.url,
      concurrency: Number(req.body?.concurrency || 4),
    })

    const savedBacklinks = []
    const verifiedResults = []

    for (const item of verified) {
      const candidate = item.candidate
      const verification = item.verification
      const isVerifiedLink = Boolean(verification?.isLive)

      await pool.query(
        `UPDATE backlink_candidates
         SET
           candidate_status = $1,
           verification_status = $2,
           verification_reason = $3,
           verified_at = NOW(),
           evidence = evidence || $4::jsonb
         WHERE site_id=$5
           AND lower(source_url)=lower($6)`,
        [
          isVerifiedLink ? 'VerifiedBacklink' : 'Checked',
          verification?.verificationStatus || 'Unverified',
          verification?.reason || '',
          JSON.stringify({
            verification: verification?.evidence || {},
            httpStatus: verification?.httpStatus ?? null,
          }),
          req.siteId,
          candidate.url,
        ]
      )

      verifiedResults.push({
        sourceUrl: candidate.url,
        domain: candidate.domain,
        provider: candidate.provider,
        verificationStatus:
          verification?.verificationStatus || 'Unverified',
        reason: verification?.reason || '',
        isLive: Boolean(verification?.isLive),
        isLost: Boolean(verification?.isLost),
        isBroken: Boolean(verification?.isBroken),
        httpStatus: verification?.httpStatus ?? null,
      })

      if (!isVerifiedLink) continue

      const duplicateResult = await pool.query(
        `SELECT id
         FROM backlinks
         WHERE site_id=$1
           AND (
             lower(COALESCE(url, ''))=lower($2)
             OR lower(COALESCE(source_final_url, ''))=lower($3)
           )
         LIMIT 1`,
        [
          req.siteId,
          candidate.url,
          verification.sourceFinalUrl || candidate.url,
        ]
      )

      if (duplicateResult.rows[0]) {
        const updated = await persistBacklinkVerification(
          req.siteId,
          duplicateResult.rows[0].id,
          verification
        )

        if (updated) savedBacklinks.push(updated)
        continue
      }

      const insertResult = await pool.query(
        `INSERT INTO backlinks (
           site_id,
           name,
           dr,
           status,
           anchor,
           url,
           type,
           source,
           source_domain,
           target_url,
           first_seen,
           last_seen,
           last_checked,
           http_status,
           is_live,
           is_lost,
           is_broken
         )
         VALUES (
           $1,$2,0,'Todo',$3,$4,$5,'discovery',$6,$7,
           NOW(),NULL,NOW(),$8,FALSE,FALSE,FALSE
         )
         RETURNING *`,
        [
          req.siteId,
          candidate.domain || candidate.url,
          verification.anchorText || '',
          candidate.url,
          verification.type || 'dofollow',
          candidate.domain || '',
          verification.targetResolvedUrl || site.url,
          verification.httpStatus ?? null,
        ]
      )

      const inserted = insertResult.rows[0]

      const persisted = await persistBacklinkVerification(
        req.siteId,
        inserted.id,
        verification
      )

      if (persisted) savedBacklinks.push(persisted)
    }

    const liveFound = verifiedResults.filter((r) => r.isLive).length
    const lostFound = verifiedResults.filter((r) => r.isLost).length
    const brokenFound = verifiedResults.filter((r) => r.isBroken).length

    await pool.query(
      `UPDATE backlink_discovery_runs
       SET
         status='Completed',
         queries_run=$1,
         candidates_found=$2,
         candidates_verified=$3,
         live_found=$4,
         lost_found=$5,
         broken_found=$6,
         errors=$7::jsonb,
         finished_at=NOW()
       WHERE id=$8`,
      [
        discovery.queries.length,
        candidates.length,
        verifiedResults.length,
        liveFound,
        lostFound,
        brokenFound,
        JSON.stringify(discovery.errors || []),
        run.id,
      ]
    )

    res.json({
      runId: run.id,
      providerConfigured: discovery.providerConfigured,
      searchProvider: 'brave',
      queries: discovery.queries,
      candidatesFound: candidates.length,
      checked: verifiedResults.length,
      saved: savedBacklinks.length,
      liveFound,
      lostFound,
      brokenFound,
      results: verifiedResults,
      errors: discovery.errors,
      message: discovery.providerConfigured
        ? 'Discovery completed'
        : 'Search provider is not configured; seed and saved-opportunity URLs were still checked',
    })
  } catch (error) {
    await pool.query(
      `UPDATE backlink_discovery_runs
       SET
         status='Failed',
         errors=$1::jsonb,
         finished_at=NOW()
       WHERE id=$2`,
      [
        JSON.stringify([
          { error: String(error?.message || error) }
        ]),
        run.id,
      ]
    ).catch(() => {})

    console.error('Backlink discovery failed:', error)

    res.status(500).json({
      error: 'Backlink discovery failed',
      detail: String(error?.message || error),
    })
  }
})

router.get('/:siteId/backlinks/discovery-runs', auth, verifySite, async (req, res) => {
  await ensureBacklinkDiscoverySchema()

  const { rows } = await pool.query(
    `SELECT *
     FROM backlink_discovery_runs
     WHERE site_id=$1
     ORDER BY started_at DESC
     LIMIT 20`,
    [req.siteId]
  )

  res.json(rows)
})

router.get('/:siteId/backlinks/candidates', auth, verifySite, async (req, res) => {
  await ensureBacklinkDiscoverySchema()

  const { rows } = await pool.query(
    `SELECT *
     FROM backlink_candidates
     WHERE site_id=$1
     ORDER BY discovered_at DESC
     LIMIT 500`,
    [req.siteId]
  )

  res.json(rows)
})
router.post('/:siteId/backlinks/index-crawl', auth, verifySite, async (req, res) => {
  await ensureBacklinkIntelligenceSchema()
  await ensureLinkIndexSchema()

  const siteResult = await pool.query(
    'SELECT id, name, url FROM sites WHERE id=$1',
    [req.siteId]
  )

  const site = siteResult.rows[0]

  if (!site?.url) {
    return res.status(400).json({ error: 'Target site URL is missing' })
  }

  const seeds = Array.isArray(req.body?.seeds)
    ? req.body.seeds
        .map((value) => String(value || '').trim())
        .filter(Boolean)
        .slice(0, 25)
    : []

  if (!seeds.length) {
    return res.status(400).json({
      error: 'Add at least one public external seed URL.'
    })
  }

  const maxPages = Math.max(1, Math.min(500, Number(req.body?.maxPages || 200)))
  const maxDepth = Math.max(0, Math.min(2, Number(req.body?.maxDepth ?? 1)))
  const domainDelayMs = Math.max(
    500,
    Math.min(5000, Number(req.body?.domainDelayMs || 1200))
  )

  const runResult = await pool.query(
    `INSERT INTO link_index_runs (site_id, seed_count, status)
     VALUES ($1,$2,'Running')
     RETURNING *`,
    [req.siteId, seeds.length]
  )

  const run = runResult.rows[0]

  try {
    const graph = await crawlLinkGraph({
      seeds,
      maxPages,
      maxDepth,
      domainDelayMs,
      userAgent: 'DevnDesproBot/1.0 (+https://www.devndespro.com)',
    })

    for (const page of graph.pages) {
      await pool.query(
        `INSERT INTO link_index_pages (
           url, normalized_url, domain, http_status,
           content_type, page_title, canonical_url,
           robots_allowed, crawl_status, crawl_depth,
           last_crawled, next_crawl, last_error
         )
         VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
           NOW(), NOW() + INTERVAL '7 days', $11
         )
         ON CONFLICT (lower(normalized_url))
         DO UPDATE SET
           url=EXCLUDED.url,
           domain=EXCLUDED.domain,
           http_status=EXCLUDED.http_status,
           content_type=EXCLUDED.content_type,
           page_title=EXCLUDED.page_title,
           canonical_url=EXCLUDED.canonical_url,
           robots_allowed=EXCLUDED.robots_allowed,
           crawl_status=EXCLUDED.crawl_status,
           crawl_depth=LEAST(link_index_pages.crawl_depth, EXCLUDED.crawl_depth),
           last_crawled=NOW(),
           next_crawl=NOW() + INTERVAL '7 days',
           last_error=EXCLUDED.last_error,
           updated_at=NOW()`,
        [
          page.url,
          page.finalUrl || page.url,
          page.domain || '',
          page.httpStatus ?? null,
          page.contentType || '',
          page.title || '',
          page.canonical || '',
          Boolean(page.robotsAllowed),
          page.error ? 'Failed' : 'Crawled',
          Number(page.depth || 0),
          page.error || '',
        ]
      )
    }

    for (const edge of graph.edges) {
      await pool.query(
        `INSERT INTO link_index_edges (
           source_url, source_domain, target_url, target_domain,
           anchor_text, rel_nofollow, rel_sponsored, rel_ugc,
           link_position, first_seen, last_seen, last_checked, is_present
         )
         VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,
           NOW(),NOW(),NOW(),TRUE
         )
         ON CONFLICT (
           lower(source_url),
           lower(target_url),
           lower(anchor_text)
         )
         DO UPDATE SET
           source_domain=EXCLUDED.source_domain,
           target_domain=EXCLUDED.target_domain,
           rel_nofollow=EXCLUDED.rel_nofollow,
           rel_sponsored=EXCLUDED.rel_sponsored,
           rel_ugc=EXCLUDED.rel_ugc,
           link_position=EXCLUDED.link_position,
           last_seen=NOW(),
           last_checked=NOW(),
           is_present=TRUE,
           updated_at=NOW()`,
        [
          edge.sourceUrl,
          edge.sourceDomain,
          edge.targetUrl,
          edge.targetDomain,
          edge.anchorText || '',
          Boolean(edge.relNofollow),
          Boolean(edge.relSponsored),
          Boolean(edge.relUgc),
          edge.linkPosition || '',
        ]
      )
    }

    const targetHost = normalizeIndexHost(site.url)
    const backlinkEdges = graph.edges.filter(
      (edge) =>
        String(edge.targetDomain || '').toLowerCase() ===
        String(targetHost || '').toLowerCase()
    )

    const detected = []
    const seenSources = new Set()

    for (const edge of backlinkEdges) {
      const sourceKey = String(edge.sourceUrl || '').toLowerCase()
      if (!sourceKey || seenSources.has(sourceKey)) continue
      seenSources.add(sourceKey)

      const verification = await verifyBacklink({
        sourceUrl: edge.sourceUrl,
        targetUrl: site.url,
      })

      if (!verification.isLive) continue

      const existing = await pool.query(
        `SELECT id
         FROM backlinks
         WHERE site_id=$1
           AND (
             lower(COALESCE(url,''))=lower($2)
             OR lower(COALESCE(source_final_url,''))=lower($3)
           )
         LIMIT 1`,
        [
          req.siteId,
          edge.sourceUrl,
          verification.sourceFinalUrl || edge.sourceUrl,
        ]
      )

      let backlink

      if (existing.rows[0]) {
        backlink = await persistBacklinkVerification(
          req.siteId,
          existing.rows[0].id,
          verification
        )
      } else {
        const inserted = await pool.query(
          `INSERT INTO backlinks (
             site_id, name, dr, status, anchor, url, type, source,
             source_domain, target_url, first_seen, last_seen,
             last_checked, http_status, is_live, is_lost, is_broken
           )
           VALUES (
             $1,$2,0,'Todo',$3,$4,$5,'own-index',$6,$7,
             NOW(),NULL,NOW(),$8,FALSE,FALSE,FALSE
           )
           RETURNING *`,
          [
            req.siteId,
            edge.sourceDomain || edge.sourceUrl,
            verification.anchorText || edge.anchorText || '',
            edge.sourceUrl,
            verification.type || 'dofollow',
            edge.sourceDomain || '',
            verification.targetResolvedUrl || site.url,
            verification.httpStatus ?? null,
          ]
        )

        backlink = await persistBacklinkVerification(
          req.siteId,
          inserted.rows[0].id,
          verification
        )
      }

      if (backlink) detected.push(backlink)
    }

    await recalculateBacklinkQualityForSite(req.siteId)

    await pool.query(
      `UPDATE link_index_runs
       SET
         status='Completed',
         pages_crawled=$1,
         pages_skipped=$2,
         links_extracted=$3,
         backlinks_detected=$4,
         errors=$5::jsonb,
         finished_at=NOW()
       WHERE id=$6`,
      [
        graph.stats.pagesCrawled,
        graph.errors.length,
        graph.stats.linksExtracted,
        detected.length,
        JSON.stringify(graph.errors || []),
        run.id,
      ]
    )

    res.json({
      runId: run.id,
      status: 'Completed',
      stats: {
        ...graph.stats,
        errors: graph.errors.length,
        backlinksDetected: detected.length,
      },
      backlinks: detected,
      errors: graph.errors.slice(0, 50),
    })
  } catch (error) {
    await pool.query(
      `UPDATE link_index_runs
       SET status='Failed',
           errors=$1::jsonb,
           finished_at=NOW()
       WHERE id=$2`,
      [
        JSON.stringify([{ error: String(error?.message || error) }]),
        run.id,
      ]
    ).catch(() => {})

    console.error('Own link index crawl failed:', error)

    res.status(500).json({
      error: 'Own link index crawl failed',
      detail: String(error?.message || error),
    })
  }
})

router.get('/:siteId/backlinks/index-stats', auth, verifySite, async (req, res) => {
  await ensureLinkIndexSchema()

  const siteResult = await pool.query(
    'SELECT url FROM sites WHERE id=$1',
    [req.siteId]
  )

  const site = siteResult.rows[0]

  if (!site?.url) {
    return res.status(400).json({ error: 'Target site URL is missing' })
  }

  const targetHost = normalizeIndexHost(site.url)

  const [pagesResult, edgesResult, targetResult, runResult] =
    await Promise.all([
      pool.query(
        `SELECT
           COUNT(*) AS pages,
           COUNT(DISTINCT domain) AS domains,
           MAX(last_crawled) AS last_crawled
         FROM link_index_pages`
      ),
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE is_present=TRUE) AS edges,
           COUNT(DISTINCT source_domain) FILTER (WHERE is_present=TRUE) AS source_domains,
           COUNT(DISTINCT target_domain) FILTER (WHERE is_present=TRUE) AS target_domains
         FROM link_index_edges`
      ),
      pool.query(
        `SELECT
           COUNT(*) FILTER (WHERE is_present=TRUE) AS backlinks,
           COUNT(DISTINCT source_domain) FILTER (WHERE is_present=TRUE) AS referring_domains
         FROM link_index_edges
         WHERE lower(target_domain)=lower($1)`,
        [targetHost]
      ),
      pool.query(
        `SELECT *
         FROM link_index_runs
         WHERE site_id=$1
         ORDER BY started_at DESC
         LIMIT 1`,
        [req.siteId]
      ),
    ])

  res.json({
    index: {
      pages: Number(pagesResult.rows[0]?.pages || 0),
      domains: Number(pagesResult.rows[0]?.domains || 0),
      edges: Number(edgesResult.rows[0]?.edges || 0),
      sourceDomains: Number(edgesResult.rows[0]?.source_domains || 0),
      targetDomains: Number(edgesResult.rows[0]?.target_domains || 0),
      lastCrawled: pagesResult.rows[0]?.last_crawled || null,
    },
    target: {
      domain: targetHost,
      backlinks: Number(targetResult.rows[0]?.backlinks || 0),
      referringDomains: Number(targetResult.rows[0]?.referring_domains || 0),
    },
    latestRun: runResult.rows[0] || null,
  })
})
router.post('/:siteId/backlinks/dataforseo-sync', auth, verifySite, async (req, res) => {
  await ensureBacklinkIntelligenceSchema()

  const siteResult = await pool.query(
    'SELECT id, name, url FROM sites WHERE id=$1',
    [req.siteId]
  )

  const site = siteResult.rows[0]

  if (!site?.url) {
    return res.status(400).json({
      error: 'Target site URL is missing'
    })
  }

  const limit = Math.max(
    1,
    Math.min(
      1000,
      Number(req.body?.limit || 500)
    )
  )

  const verifyLimit = Math.max(
    0,
    Math.min(
      100,
      Number(req.body?.verifyLimit || 25)
    )
  )

  try {
    const provider = await fetchDataForSeoBacklinks({
      target: site.url,
      limit,
      mode: 'as_is',
    })

    let imported = 0
    let updated = 0
    let skipped = 0

    const candidatesForOwnVerification = []

    for (const item of provider.items) {
      if (!item.sourceUrl || !item.sourceDomain) {
        skipped += 1
        continue
      }

      const type = item.dofollow
        ? 'dofollow'
        : 'nofollow'

      const providerEvidence = {
        provider: 'dataforseo',
        sourceTitle: item.sourceTitle,
        sourceLanguage: item.sourceLanguage,
        textPre: item.textPre,
        textPost: item.textPost,
        semanticLocation: item.semanticLocation,
        dofollow: item.dofollow,
        nofollow: item.nofollow,
        sponsored: item.sponsored,
        ugc: item.ugc,
        domainRank: item.rank,
        pageRank: item.pageRank,
        backlinkRank: item.backlinkRank,
        spamScore: item.spamScore,
        linksCount: item.linksCount,
        firstSeen: item.firstSeen,
        lastSeen: item.lastSeen,
        isNew: item.isNew,
        isLost: item.isLost,
        isBroken: item.isBroken,
        attributes: item.attributes,
      }

      const existing = await pool.query(
        `SELECT id
         FROM backlinks
         WHERE site_id=$1
           AND (
             lower(COALESCE(url,''))=lower($2)
             OR lower(COALESCE(source_final_url,''))=lower($2)
           )
         LIMIT 1`,
        [
          req.siteId,
          item.sourceUrl,
        ]
      )

      let backlinkId

      if (existing.rows[0]) {
        backlinkId = existing.rows[0].id

        await pool.query(
          `UPDATE backlinks
           SET
             name=$1,
             anchor=$2,
             type=$3,
             source='dataforseo',
             source_domain=$4,
             target_url=$5,
             status='Live',
             verification_status='Live',
             verification_source='dataforseo',
             http_status=$6,
             is_live=TRUE,
             is_lost=FALSE,
             is_broken=$7,
             rel_nofollow=$8,
             rel_sponsored=$9,
             rel_ugc=$10,
             source_page_title=$11,
             source_page_language=$12,
             link_position=$13,
             link_context=$14,
             provider_rank=$15,
             provider_page_rank=$16,
             provider_spam_score=$17,
             provider_first_seen=$18,
             provider_last_seen=$19,
             first_seen=COALESCE(first_seen,$18,NOW()),
             last_seen=COALESCE($19,NOW()),
             last_checked=NOW(),
             verified_at=NOW(),
             verification_reason='Live in DataForSEO backlink index',
             verification_evidence=$20::jsonb
           WHERE id=$21
             AND site_id=$22`,
          [
            item.sourceDomain,
            item.anchor || '',
            type,
            item.sourceDomain,
            item.targetUrl || site.url,
            item.httpStatus,
            Boolean(item.isBroken),
            Boolean(item.nofollow),
            Boolean(item.sponsored),
            Boolean(item.ugc),
            item.sourceTitle || '',
            item.sourceLanguage || '',
            item.semanticLocation || '',
            `${item.textPre || ''} ${item.anchor || ''} ${item.textPost || ''}`.trim(),
            item.rank,
            item.pageRank,
            item.spamScore,
            item.firstSeen,
            item.lastSeen,
            JSON.stringify(providerEvidence),
            backlinkId,
            req.siteId,
          ]
        )

        updated += 1
      } else {
        const inserted = await pool.query(
          `INSERT INTO backlinks (
             site_id,
             name,
             dr,
             status,
             anchor,
             url,
             type,
             source,
             source_domain,
             target_url,
             first_seen,
             last_seen,
             last_checked,
             verified_at,
             verification_status,
             verification_source,
             verification_reason,
             verification_evidence,
             http_status,
             is_live,
             is_lost,
             is_broken,
             rel_nofollow,
             rel_sponsored,
             rel_ugc,
             source_page_title,
             source_page_language,
             link_position,
             link_context,
             provider_rank,
             provider_page_rank,
             provider_spam_score,
             provider_first_seen,
             provider_last_seen
           )
           VALUES (
             $1,$2,0,'Live',$3,$4,$5,'dataforseo',
             $6,$7,
             COALESCE($8,NOW()),
             COALESCE($9,NOW()),
             NOW(),NOW(),
             'Live',
             'dataforseo',
             'Live in DataForSEO backlink index',
             $10::jsonb,
             $11,
             TRUE,FALSE,$12,
             $13,$14,$15,
             $16,$17,$18,$19,
             $20,$21,$22,$23,$24
           )
           RETURNING id`,
          [
            req.siteId,
            item.sourceDomain,
            item.anchor || '',
            item.sourceUrl,
            type,
            item.sourceDomain,
            item.targetUrl || site.url,
            item.firstSeen,
            item.lastSeen,
            JSON.stringify(providerEvidence),
            item.httpStatus,
            Boolean(item.isBroken),
            Boolean(item.nofollow),
            Boolean(item.sponsored),
            Boolean(item.ugc),
            item.sourceTitle || '',
            item.sourceLanguage || '',
            item.semanticLocation || '',
            `${item.textPre || ''} ${item.anchor || ''} ${item.textPost || ''}`.trim(),
            item.rank,
            item.pageRank,
            item.spamScore,
            item.firstSeen,
            item.lastSeen,
          ]
        )

        backlinkId = inserted.rows[0]?.id
        imported += 1
      }

      if (backlinkId) {
        candidatesForOwnVerification.push({
          id: backlinkId,
          sourceUrl: item.sourceUrl,
          rank: item.rank,
          pageRank: item.pageRank,
        })
      }
    }

    // Re-verify a controlled high-value sample with our own verifier.
    const toVerify = candidatesForOwnVerification
      .sort((a, b) =>
        (b.rank + b.pageRank) -
        (a.rank + a.pageRank)
      )
      .slice(0, verifyLimit)

    let devnVerified = 0
    let devnFailed = 0

    for (const item of toVerify) {
      const verification = await verifyBacklink({
        sourceUrl: item.sourceUrl,
        targetUrl: site.url,
      })

      if (verification.isLive) {
        await persistBacklinkVerification(
          req.siteId,
          item.id,
          verification
        )

        await pool.query(
          `UPDATE backlinks
           SET verification_source='devndespro+dataforseo'
           WHERE id=$1 AND site_id=$2`,
          [
            item.id,
            req.siteId,
          ]
        )

        devnVerified += 1
      } else {
        // Keep provider evidence, but flag that our immediate fetch
        // did not independently reconfirm the link.
        await pool.query(
          `UPDATE backlinks
           SET
             verification_reason=$1,
             last_checked=NOW()
           WHERE id=$2 AND site_id=$3`,
          [
            `DataForSEO live; DevnDespro recheck: ${
              verification.verificationStatus ||
              verification.reason ||
              'not reconfirmed'
            }`,
            item.id,
            req.siteId,
          ]
        )

        devnFailed += 1
      }
    }

    await recalculateBacklinkQualityForSite(req.siteId)

    const authorityRows = await pool.query(
      `SELECT *
       FROM backlinks
       WHERE site_id=$1
         AND COALESCE(source,'') <> 'domain'`,
      [req.siteId]
    )

    const authority = calculateAuthority({
      rows: authorityRows.rows,
    })

    const { rows: existingAuth } = await pool.query(
      `SELECT authority_breakdown FROM sites WHERE id=$1`,
      [req.siteId]
    )
    const prevBreakdown = existingAuth[0]?.authority_breakdown || {}
    const mergedBreakdown = {
      ...authority.breakdown,
      domainRank: prevBreakdown.domainRank ?? null,
      domainRankSource: prevBreakdown.domainRankSource || null,
      domainRankMeta: prevBreakdown.domainRankMeta || null,
    }

    await pool.query(
      `UPDATE sites
       SET
         authority_score=$1,
         authority_updated_at=NOW(),
         authority_version=$2,
         authority_breakdown=$3::jsonb
       WHERE id=$4`,
      [
        authority.score,
        authority.version,
        JSON.stringify(mergedBreakdown),
        req.siteId,
      ]
    )

    res.json({
      provider: 'dataforseo',
      target: provider.target,
      providerTotal: provider.totalCount,
      received: provider.itemsCount,
      imported,
      updated,
      skipped,
      devnDesproVerified: devnVerified,
      devnDesproNotReconfirmed: devnFailed,
      verificationSampleSize: toVerify.length,
      costUsd: provider.cost,
      authorityScore: authority.score,
      authorityVersion: authority.version,
    })
  } catch (error) {
    console.error(
      'DataForSEO backlink sync failed:',
      error
    )

    res.status(500).json({
      error: 'DataForSEO backlink sync failed',
      detail: String(error?.message || error),
    })
  }
})
router.get('/:siteId/backlink-opportunities', auth, verifySite, async (req, res) => {
  await ensureBacklinkIntelligenceSchema()

  const { rows } = await pool.query(
    `SELECT *
     FROM backlink_opportunities
     WHERE site_id = $1
     ORDER BY estimated_dr DESC, created_at DESC`,
    [req.siteId]
  )

  res.json(rows)
})

router.post('/:siteId/backlink-opportunities', auth, verifySite, async (req, res) => {
  await ensureBacklinkIntelligenceSchema()

  const {
    sourceDomain,
    sourceUrl,
    targetUrl,
    strategy,
    opportunityType,
    relevance,
    estimatedDR,
    status,
    evidence,
    source,
  } = req.body

  const domain = normalizeBacklinkDomain(sourceDomain || sourceUrl)

  if (!domain) {
    return res.status(400).json({ error: 'A referring domain is required' })
  }

  const { rows } = await pool.query(
    `INSERT INTO backlink_opportunities (
       site_id, source_domain, source_url, target_url,
       strategy, opportunity_type, relevance,
       estimated_dr, status, evidence, source
     )
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (
       site_id,
       lower(source_domain),
       lower(COALESCE(source_url, ''))
     )
     DO UPDATE SET
       strategy = EXCLUDED.strategy,
       relevance = EXCLUDED.relevance,
       estimated_dr = GREATEST(
         backlink_opportunities.estimated_dr,
         EXCLUDED.estimated_dr
       ),
       evidence = CASE
         WHEN EXCLUDED.evidence <> '' THEN EXCLUDED.evidence
         ELSE backlink_opportunities.evidence
       END,
       updated_at = NOW()
     RETURNING *`,
    [
      req.siteId,
      domain,
      sourceUrl || '',
      targetUrl || '',
      strategy || '',
      opportunityType || 'prospect',
      relevance || '',
      Math.max(0, Math.min(100, Number(estimatedDR || 0))),
      status || 'Prospect',
      evidence || '',
      source || 'manual',
    ]
  )

  res.json(rows[0])
})

router.put('/:siteId/backlink-opportunities/:id', auth, verifySite, async (req, res) => {
  await ensureBacklinkIntelligenceSchema()

  const allowed = ['Prospect', 'Qualified', 'Contacted', 'Replied', 'Won', 'Rejected']
  const status = allowed.includes(req.body?.status) ? req.body.status : 'Prospect'

  const { rows } = await pool.query(
    `UPDATE backlink_opportunities
     SET status = $1,
         updated_at = NOW()
     WHERE id = $2 AND site_id = $3
     RETURNING *`,
    [status, req.params.id, req.siteId]
  )

  res.json(rows[0] || null)
})

router.delete('/:siteId/backlink-opportunities/:id', auth, verifySite, async (req, res) => {
  await ensureBacklinkIntelligenceSchema()

  await pool.query(
    'DELETE FROM backlink_opportunities WHERE id=$1 AND site_id=$2',
    [req.params.id, req.siteId]
  )

  res.json({ ok: true })
})

const DEFAULT_DISAVOW_WAIT_DAYS = 21

function enrichDisavowTracker(raw = {}) {
  const submittedAt = raw.submittedAt || null
  const checkAfterDays = Math.max(
    1,
    Math.min(90, Number(raw.checkAfterDays || DEFAULT_DISAVOW_WAIT_DAYS))
  )
  const checkAfterAt =
    raw.checkAfterAt ||
    (submittedAt
      ? new Date(
          new Date(submittedAt).getTime() + checkAfterDays * 24 * 60 * 60 * 1000
        ).toISOString()
      : null)
  const checkedAt = raw.checkedAt || null
  const now = Date.now()
  let phase = 'none'
  let daysLeft = null

  if (checkedAt) {
    phase = 'checked'
  } else if (submittedAt && checkAfterAt) {
    const leftMs = new Date(checkAfterAt).getTime() - now
    daysLeft = Math.ceil(leftMs / (24 * 60 * 60 * 1000))
    phase = leftMs <= 0 ? 'ready' : 'waiting'
  }

  return {
    submittedAt,
    checkAfterDays,
    checkAfterAt,
    checkedAt,
    domainCount: Number(raw.domainCount || 0) || 0,
    fileName: raw.fileName || 'disavow-spam-domains.txt',
    note: raw.note || '',
    phase,
    daysLeft: phase === 'waiting' ? Math.max(0, daysLeft) : daysLeft,
    canCheck: phase === 'ready',
    message:
      phase === 'none'
        ? 'Not marked as uploaded to Google yet.'
        : phase === 'waiting'
          ? `Waiting for Google (~${Math.max(0, daysLeft)} day${Math.max(0, daysLeft) === 1 ? '' : 's'} left). Then re-check in Search Console and re-run Site Audit.`
          : phase === 'ready'
            ? 'Wait period is over. Check Google Disavow status, then re-run Site Audit.'
            : 'Marked as checked. You can submit a new list anytime if spam changes.',
  }
}

router.get('/:siteId/backlinks/disavow-status', auth, verifySite, async (req, res) => {
  await ensureBacklinkIntelligenceSchema()
  const { rows } = await pool.query(
    'SELECT disavow_tracker FROM sites WHERE id=$1',
    [req.siteId]
  )
  res.json(enrichDisavowTracker(rows[0]?.disavow_tracker || {}))
})

router.post('/:siteId/backlinks/disavow-status', auth, verifySite, async (req, res) => {
  await ensureBacklinkIntelligenceSchema()

  const action = String(req.body?.action || 'submit').toLowerCase()
  const { rows: existing } = await pool.query(
    'SELECT disavow_tracker FROM sites WHERE id=$1',
    [req.siteId]
  )
  const prev = existing[0]?.disavow_tracker || {}

  let next = { ...prev }

  if (action === 'clear' || action === 'reset') {
    next = {}
  } else if (action === 'checked' || action === 'check') {
    if (!prev.submittedAt) {
      return res.status(400).json({ error: 'Mark as uploaded to Google first' })
    }
    next = {
      ...prev,
      checkedAt: new Date().toISOString(),
      note: String(req.body?.note || prev.note || '').slice(0, 500),
    }
  } else {
    // submit / uploaded
    const checkAfterDays = Math.max(
      1,
      Math.min(90, Number(req.body?.checkAfterDays || prev.checkAfterDays || DEFAULT_DISAVOW_WAIT_DAYS))
    )
    const submittedAt = new Date().toISOString()
    next = {
      submittedAt,
      checkAfterDays,
      checkAfterAt: new Date(
        Date.now() + checkAfterDays * 24 * 60 * 60 * 1000
      ).toISOString(),
      checkedAt: null,
      domainCount: Number(req.body?.domainCount || prev.domainCount || 0) || 0,
      fileName: String(req.body?.fileName || 'disavow-spam-domains.txt').slice(0, 120),
      note: String(req.body?.note || '').slice(0, 500),
    }
  }

  const { rows } = await pool.query(
    `UPDATE sites
     SET disavow_tracker = $1::jsonb
     WHERE id = $2
     RETURNING disavow_tracker`,
    [JSON.stringify(next), req.siteId]
  )

  res.json(enrichDisavowTracker(rows[0]?.disavow_tracker || next))
})

router.get('/:siteId/backlinks/summary', auth, verifySite, async (req, res) => {
  await ensureBacklinkIntelligenceSchema()

  const { rows } = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE is_live = TRUE AND verification_status IN ('Live','Redirected')) AS total_backlinks,
       COUNT(
         DISTINCT COALESCE(
           NULLIF(source_domain, ''),
           NULLIF(name, '')
         )
       ) FILTER (WHERE is_live = TRUE AND verification_status IN ('Live','Redirected')) AS referring_domains,
       COUNT(*) FILTER (
         WHERE is_live = TRUE
           AND verification_status IN ('Live','Redirected')
           AND COALESCE(
             dofollow,
             (
               LOWER(COALESCE(type, 'dofollow')) <> 'nofollow'
               AND COALESCE(rel_nofollow, FALSE) = FALSE
             )
           ) = TRUE
       ) AS dofollow_count,
       COUNT(*) FILTER (WHERE is_lost = TRUE) AS lost_count,
       COUNT(*) FILTER (WHERE is_broken = TRUE) AS broken_count,
       COUNT(*) FILTER (
         WHERE first_seen >= NOW() - INTERVAL '30 days'
           AND is_live = TRUE
           AND verification_status IN ('Live','Redirected')
       ) AS new_30d,
       COALESCE(
         (
           SELECT AVG(domain_rank)
           FROM (
             SELECT
               COALESCE(
                 NULLIF(MAX(provider_rank), 0),
                 NULLIF(MAX(dr), 0),
                 0
               ) AS domain_rank
             FROM backlinks b2
             WHERE b2.site_id = $1
               AND COALESCE(b2.source, '') <> 'domain'
               AND b2.is_live = TRUE
               AND b2.verification_status IN ('Live','Redirected')
             GROUP BY COALESCE(
               NULLIF(b2.source_domain, ''),
               NULLIF(b2.name, '')
             )
           ) domain_scores
         ),
         0
       ) AS avg_dr
     FROM backlinks
     WHERE site_id = $1
       AND COALESCE(source, '') <> 'domain'`,
    [req.siteId]
  )

  const opps = await pool.query(
    `SELECT COUNT(*) AS opportunities
     FROM backlink_opportunities
     WHERE site_id = $1
       AND status NOT IN ('Won', 'Rejected')`,
    [req.siteId]
  )

  const row = rows[0] || {}
  const totalBacklinks = Number(row.total_backlinks || 0)
  const dofollowCount = Number(row.dofollow_count || 0)

  res.json({
    totalBacklinks,
    referringDomains: Number(row.referring_domains || 0),
    dofollowCount,
    dofollowRatio: totalBacklinks > 0
      ? Math.round((dofollowCount / totalBacklinks) * 1000) / 10
      : 0,
    new30d: Number(row.new_30d || 0),
    lost: Number(row.lost_count || 0),
    broken: Number(row.broken_count || 0),
    avgDr: Math.round(Number(row.avg_dr || 0) * 10) / 10,
    opportunities: Number(opps.rows[0]?.opportunities || 0),
  })
})

/** Aggregated referring domains from tracked + synced backlinks */
router.get('/:siteId/backlinks/referring-domains', auth, verifySite, async (req, res) => {
  try {
    await ensureBacklinkIntelligenceSchema()
    const { rows } = await pool.query(
      `SELECT
         COALESCE(NULLIF(btrim(source_domain), ''), NULLIF(btrim(name), ''), 'unknown') AS domain,
         COUNT(*)::int AS backlinks,
         COUNT(*) FILTER (
           WHERE COALESCE(
             dofollow,
             (
               LOWER(COALESCE(type, 'dofollow')) <> 'nofollow'
               AND COALESCE(rel_nofollow, FALSE) = FALSE
             )
           ) = TRUE
         )::int AS dofollow,
         COUNT(*) FILTER (WHERE is_broken = TRUE)::int AS broken,
         COUNT(*) FILTER (WHERE is_lost = TRUE)::int AS lost,
         COUNT(*) FILTER (
           WHERE is_live = TRUE AND verification_status IN ('Live','Redirected')
         )::int AS live,
         COALESCE(MAX(NULLIF(provider_rank, 0)), MAX(NULLIF(dr, 0)), 0)::int AS rank,
         MIN(COALESCE(first_seen, created_at)) AS first_seen,
         MAX(COALESCE(last_seen, last_checked, created_at)) AS last_seen
       FROM backlinks
       WHERE site_id = $1
         AND COALESCE(source, '') <> 'domain'
       GROUP BY 1
       HAVING COALESCE(NULLIF(btrim(source_domain), ''), NULLIF(btrim(name), ''), 'unknown') <> 'unknown'
       ORDER BY backlinks DESC, rank DESC
       LIMIT 500`,
      [req.siteId]
    )
    res.json({
      total: rows.length,
      domains: rows.map((r) => ({
        domain: r.domain,
        backlinks: Number(r.backlinks || 0),
        dofollow: Number(r.dofollow || 0),
        broken: Number(r.broken || 0),
        lost: Number(r.lost || 0),
        live: Number(r.live || 0),
        rank: Number(r.rank || 0),
        firstSeen: r.first_seen,
        lastSeen: r.last_seen,
      })),
    })
  } catch (e) {
    console.error('referring-domains error:', e)
    res.status(500).json({ error: 'Failed to load referring domains' })
  }
})

/**
 * Dynamic backlink competitor comparison:
 * - overview metrics for your site + selected competitors
 * - link-gap domains (link to competitor, not you)
 */
router.post('/:siteId/backlinks/competitor-compare', auth, verifySite, async (req, res) => {
  try {
    const { ensureCompetitorDetailColumns } = require('../utils/competitorEnrich')
    await ensureCompetitorDetailColumns()

    const { rows: siteRows } = await pool.query('SELECT url, name FROM sites WHERE id=$1', [req.siteId])
    const site = siteRows[0]
    if (!site) return res.status(404).json({ error: 'Site not found' })

    const yourDomain = normalizeTarget(site.url)
    const { rows: competitorRows } = await pool.query(
      'SELECT * FROM competitors WHERE site_id=$1 ORDER BY dr DESC',
      [req.siteId]
    )

    const requested = Array.isArray(req.body?.domains)
      ? req.body.domains.map(normalizeTarget).filter(Boolean)
      : []

    let selected = competitorRows
    if (requested.length) {
      const want = new Set(requested)
      selected = competitorRows.filter((c) => want.has(normalizeTarget(c.name || c.url)))
      // allow ad-hoc domains not yet saved
      for (const d of requested) {
        if (!selected.some((c) => normalizeTarget(c.name) === d) && d !== yourDomain) {
          selected.push({ id: null, name: d, dr: 0, notes: 'Ad-hoc compare', url: `https://${d}` })
        }
      }
    }

    selected = selected.slice(0, 4)
    if (!selected.length) {
      return res.json({
        yourDomain,
        you: null,
        competitors: [],
        linkGap: [],
        warning: 'Add competitors first (type a domain or Auto-Discover).',
      })
    }

    let you = null
    let cost = 0
    const warnings = []

    try {
      you = await fetchBacklinkOverview({ target: yourDomain })
      cost += Number(you.cost || 0)
    } catch (e) {
      warnings.push(`Your overview unavailable: ${e.message}`)
      you = {
        target: yourDomain,
        rank: 0,
        backlinks: 0,
        referringDomains: 0,
        source: 'unavailable',
      }
    }

    const competitors = []
    for (const c of selected) {
      const domain = normalizeTarget(c.name || c.url)
      try {
        const overview = await fetchBacklinkOverview({ target: domain })
        cost += Number(overview.cost || 0)
        competitors.push({
          id: c.id,
          domain,
          notes: c.notes || '',
          title: c.title || '',
          summary: c.summary || '',
          industry: c.industry || '',
          location: c.location || '',
          savedDr: Number(c.dr || 0),
          rank: overview.rank,
          backlinks: overview.backlinks,
          referringDomains: overview.referringDomains,
          deltaRefDomains: overview.referringDomains - Number(you.referringDomains || 0),
          deltaBacklinks: overview.backlinks - Number(you.backlinks || 0),
        })

        // Keep stored DR in sync with live rank when available
        if (c.id && overview.rank > 0) {
          await pool.query(
            'UPDATE competitors SET dr=$1, url=$2 WHERE id=$3 AND site_id=$4',
            [overview.rank, `https://${domain}`, c.id, req.siteId]
          )
        }
      } catch (e) {
        warnings.push(`${domain}: ${e.message}`)
        competitors.push({
          id: c.id,
          domain,
          notes: c.notes || '',
          title: c.title || '',
          summary: c.summary || '',
          industry: c.industry || '',
          location: c.location || '',
          savedDr: Number(c.dr || 0),
          rank: Number(c.dr || 0),
          backlinks: null,
          referringDomains: null,
          error: e.message,
        })
      }
    }

    // Fill missing company basics for ad-hoc / thin competitor rows
    const needsBasics = competitors.filter((c) => !c.summary && !c.industry && !c.title)
    if (needsBasics.length) {
      try {
        const { enrichCompetitorBasics } = require('../utils/competitorEnrich')
        const basics = await enrichCompetitorBasics(needsBasics.map((c) => c.domain))
        const bmap = new Map(basics.map((b) => [b.domain, b]))
        for (const c of competitors) {
          const b = bmap.get(c.domain)
          if (!b) continue
          if (!c.title) c.title = b.title || ''
          if (!c.summary) c.summary = b.summary || ''
        }
      } catch (e) {
        warnings.push(`Company basics enrich skipped: ${e.message}`)
      }
    }

    let linkGap = []
    const gapSeen = new Set()
    const gapCompetitors = competitors.filter((c) => c.domain).slice(0, 3)
    for (const primary of gapCompetitors) {
      try {
        const gap = await fetchDomainIntersection({
          targets: { 1: primary.domain },
          excludeTargets: [yourDomain],
          limit: Number(req.body?.limit) || 20,
        })
        cost += Number(gap.cost || 0)
        for (const item of gap.items || []) {
          const key = String(item.domain || '').toLowerCase()
          if (!key || gapSeen.has(key) || key === yourDomain) continue
          gapSeen.add(key)
          linkGap.push({
            ...item,
            vsCompetitor: primary.domain,
          })
        }
      } catch (e) {
        warnings.push(`Link gap vs ${primary.domain}: ${e.message}`)
      }
    }
    linkGap = linkGap
      .sort((a, b) => (b.rank || 0) - (a.rank || 0) || (b.backlinks || 0) - (a.backlinks || 0))
      .slice(0, 50)

    res.json({
      yourDomain,
      you,
      competitors,
      linkGap,
      cost,
      warnings,
      fetchedAt: new Date().toISOString(),
    })
  } catch (e) {
    console.error('competitor-compare error:', e)
    res.status(500).json({ error: e.message || 'Competitor compare failed' })
  }
})

const monthKeyFromDate = (value) => {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

const monthLabelFromKey = (key) => {
  const [y, m] = String(key).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-GB', {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  })
}

const buildMonthKeys = (months) => {
  const now = new Date()
  const keys = []
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
  }
  return keys
}

const buildTrackedGrowthSeries = async (siteId, months) => {
  const keys = buildMonthKeys(months)
  const { rows } = await pool.query(
    `SELECT
       COALESCE(provider_first_seen, first_seen, created_at, verified_at, last_seen) AS seen_at,
       COALESCE(NULLIF(source_domain, ''), NULLIF(name, '')) AS domain
     FROM backlinks
     WHERE site_id = $1
       AND COALESCE(source, '') <> 'domain'`,
    [siteId]
  )

  const events = rows
    .map((r) => ({
      key: monthKeyFromDate(r.seen_at),
      domain: String(r.domain || '').replace(/^www\./i, '').toLowerCase() || 'unknown',
    }))
    .filter((e) => e.key)

  return keys.map((key) => {
    const upTo = events.filter((e) => e.key <= key)
    const domains = new Set(upTo.map((e) => e.domain))
    return {
      key,
      label: monthLabelFromKey(key),
      backlinks: upTo.length,
      referringDomains: domains.size,
    }
  })
}

const decorateSeries = (series) =>
  (Array.isArray(series) ? series : []).map((point) => ({
    ...point,
    label: point.label || monthLabelFromKey(point.key),
  }))

// Live growth chart: DataForSEO timeseries first, tracked DB fallback.
// Cached 24h to avoid re-billing on every page load (?refresh=1 to bypass).
// Provider live fetch + refresh are admin-only (user id 1); common users get
// series only (cached live if available, else tracked) with no source metadata.
router.get('/:siteId/backlinks/growth', auth, verifySite, async (req, res) => {
  await ensureBacklinkIntelligenceSchema()

  const months = Math.max(1, Math.min(36, Number(req.query.months || 12)))
  const isAdmin = Number(req.user?.id) === 1
  const forceRefresh = isAdmin && String(req.query.refresh || '') === '1'

  const publicPayload = ({ series, months: m }) => ({
    months: m,
    series: decorateSeries(series),
  })

  const adminPayload = (extra) => ({
    ...publicPayload(extra),
    source: extra.source,
    target: extra.target || null,
    cached: !!extra.cached,
    fetchedAt: extra.fetchedAt || null,
    cost: Number(extra.cost || 0),
    warning: extra.warning || undefined,
  })

  try {
    if (!forceRefresh) {
      const cached = await pool.query(
        `SELECT source, target, series, cost, fetched_at
         FROM backlink_growth_cache
         WHERE site_id = $1
           AND months = $2
           AND fetched_at > NOW() - INTERVAL '24 hours'`,
        [req.siteId, months]
      )
      if (cached.rows[0]) {
        const row = cached.rows[0]
        if (!isAdmin) {
          return res.json(publicPayload({ series: row.series, months }))
        }
        return res.json(adminPayload({
          series: row.series,
          months,
          source: row.source,
          target: row.target,
          cached: true,
          fetchedAt: row.fetched_at,
          cost: row.cost,
        }))
      }
    }

    const siteResult = await pool.query(
      'SELECT url FROM sites WHERE id = $1',
      [req.siteId]
    )
    const siteUrl = siteResult.rows[0]?.url || ''
    let source = 'tracked'
    let target = siteUrl ? normalizeTarget(siteUrl) : ''
    let series = []
    let cost = 0
    let error = null

    // Only admin triggers paid DataForSEO history calls.
    if (isAdmin && siteUrl) {
      try {
        const live = await fetchDataForSeoTimeseries({
          target: siteUrl,
          months,
        })
        if (live.series?.length) {
          source = 'dataforseo'
          target = live.target
          cost = Number(live.cost || 0)
          const keys = buildMonthKeys(months)
          const byKey = new Map(live.series.map((p) => [p.key, p]))
          let lastBacklinks = 0
          let lastDomains = 0
          series = keys.map((key) => {
            const hit = byKey.get(key)
            if (hit) {
              lastBacklinks = hit.backlinks
              lastDomains = hit.referringDomains
            }
            return {
              key,
              label: monthLabelFromKey(key),
              backlinks: hit ? hit.backlinks : lastBacklinks,
              referringDomains: hit ? hit.referringDomains : lastDomains,
              rank: hit?.rank || 0,
            }
          })
        }
      } catch (err) {
        error = err.message || 'DataForSEO growth unavailable'
        console.warn('backlinks/growth DataForSEO fallback:', error)
      }
    }

    if (!series.length) {
      source = 'tracked'
      series = await buildTrackedGrowthSeries(req.siteId, months)
    }

    // Cache only when admin fetched (so live series can be shared), or always cache tracked.
    await pool.query(
      `INSERT INTO backlink_growth_cache (site_id, months, source, target, series, cost, fetched_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, NOW())
       ON CONFLICT (site_id, months) DO UPDATE SET
         source = EXCLUDED.source,
         target = EXCLUDED.target,
         series = EXCLUDED.series,
         cost = EXCLUDED.cost,
         fetched_at = NOW()`,
      [req.siteId, months, source, target || '', JSON.stringify(series), cost]
    )

    if (!isAdmin) {
      return res.json(publicPayload({ series, months }))
    }

    res.json(adminPayload({
      series,
      months,
      source,
      target,
      cached: false,
      fetchedAt: new Date().toISOString(),
      cost,
      warning: error || undefined,
    }))
  } catch (err) {
    console.error('backlinks/growth error:', err)
    try {
      const series = await buildTrackedGrowthSeries(req.siteId, months)
      if (!isAdmin) {
        return res.json(publicPayload({ series, months }))
      }
      return res.json(adminPayload({
        series,
        months,
        source: 'tracked',
        warning: err.message || 'Failed to load live growth',
      }))
    } catch (fallbackErr) {
      res.status(500).json({ error: 'Failed to load backlink growth' })
    }
  }
})

router.post('/:siteId/backlinks/:id/verify', auth, verifySite, async (req, res) => {
  await ensureBacklinkIntelligenceSchema()

  const backlinkResult = await pool.query(
    `SELECT *
     FROM backlinks
     WHERE id = $1
       AND site_id = $2`,
    [req.params.id, req.siteId]
  )

  const backlink = backlinkResult.rows[0]

  if (!backlink) {
    return res.status(404).json({ error: 'Backlink not found' })
  }

  const siteResult = await pool.query(
    'SELECT url FROM sites WHERE id = $1',
    [req.siteId]
  )

  const site = siteResult.rows[0]

  if (!site?.url) {
    return res.status(400).json({ error: 'Target site URL is missing' })
  }

  if (!backlink.url) {
    return res.status(400).json({
      error: 'Backlink source URL is missing and cannot be verified'
    })
  }

  const verification = await verifyBacklink({
    sourceUrl: backlink.url,
    targetUrl: site.url,
  })

  const saved = await persistBacklinkVerification(
    req.siteId,
    backlink.id,
    verification
  )

  res.json({
    backlink: saved,
    verification,
  })
})

router.post('/:siteId/backlinks/verify-all', auth, verifySite, async (req, res) => {
  await ensureBacklinkIntelligenceSchema()

  const requestedLimit = Number(req.body?.limit || 50)
  const limit = Math.max(1, Math.min(200, requestedLimit))

  const siteResult = await pool.query(
    'SELECT url FROM sites WHERE id = $1',
    [req.siteId]
  )

  const site = siteResult.rows[0]

  if (!site?.url) {
    return res.status(400).json({ error: 'Target site URL is missing' })
  }

  const backlinkResult = await pool.query(
    `SELECT *
     FROM backlinks
     WHERE site_id = $1
       AND COALESCE(url, '') <> ''
       AND COALESCE(source, '') <> 'domain'
     ORDER BY
       COALESCE(last_checked, TIMESTAMPTZ '1970-01-01') ASC,
       id ASC
     LIMIT $2`,
    [req.siteId, limit]
  )

  const results = []

  for (const backlink of backlinkResult.rows) {
    const verification = await verifyBacklink({
      sourceUrl: backlink.url,
      targetUrl: site.url,
    })

    const saved = await persistBacklinkVerification(
      req.siteId,
      backlink.id,
      verification
    )

    results.push({
      id: backlink.id,
      sourceUrl: backlink.url,
      verificationStatus: verification.verificationStatus,
      isLive: Boolean(verification.isLive),
      isLost: Boolean(verification.isLost),
      isBroken: Boolean(verification.isBroken),
      httpStatus: verification.httpStatus ?? null,
      reason: verification.reason || '',
      backlink: saved,
    })
  }

  const summary = {
    checked: results.length,
    live: results.filter((r) => r.isLive).length,
    lost: results.filter((r) => r.isLost).length,
    broken: results.filter((r) => r.isBroken).length,
    unverified: results.filter(
      (r) =>
        !r.isLive &&
        !r.isLost &&
        !r.isBroken
    ).length,
  }

  res.json({
    summary,
    results,
  })
})
router.post('/:siteId/backlinks/recalculate-quality', auth, verifySite, async (req, res) => {
  await ensureBacklinkIntelligenceSchema()

  const updated = await recalculateBacklinkQualityForSite(req.siteId)

  res.json({
    updated: updated.length,
    backlinks: updated,
  })
})
router.post('/:siteId/authority-score', auth, verifySite, async (req, res) => {
  try {
    await ensureBacklinkIntelligenceSchema()

    const { rows: siteRows } = await pool.query(
      `SELECT url, authority_breakdown FROM sites WHERE id=$1`,
      [req.siteId]
    )
    const siteUrl = siteRows[0]?.url || ''
    const prevBreakdown = siteRows[0]?.authority_breakdown || {}

    // 1) Domain Rank first — independent of link-quality recalc so a
    // slow/failed quality pass cannot leave domain_rank null forever.
    let domainRank = null
    let domainRankMeta = {}
    try {
      const overview = await fetchBacklinkOverview({ target: siteUrl })
      domainRank =
        overview.rank === null || overview.rank === undefined
          ? null
          : Number.isFinite(Number(overview.rank))
            ? Math.max(0, Math.min(100, Math.round(Number(overview.rank))))
            : null
      domainRankMeta = {
        source: 'dataforseo',
        provider: overview.provider || 'dataforseo',
        target: overview.target || normalizeTarget(siteUrl),
        referringDomains: overview.referringDomains,
        backlinks: overview.backlinks,
        referringPages: overview.referringPages,
        dofollow: overview.dofollow,
        brokenBacklinks: overview.brokenBacklinks,
        cost: overview.cost,
        fetchedAt: new Date().toISOString(),
      }
    } catch (rankError) {
      console.warn(
        '[authority-score] Domain rank fetch failed:',
        rankError?.message || rankError
      )
      domainRankMeta = {
        source: 'dataforseo',
        error: String(rankError?.message || rankError),
        fetchedAt: new Date().toISOString(),
      }
    }

    if (domainRank != null) {
      await pool.query(
        `UPDATE sites
         SET
           domain_rank=$1,
           domain_rank_updated_at=NOW(),
           domain_rank_meta=$2::jsonb,
           authority_breakdown = COALESCE(authority_breakdown, '{}'::jsonb)
             || jsonb_build_object(
               'domainRank', $1::int,
               'domainRankSource', 'dataforseo',
               'domainRankMeta', $2::jsonb
             )
         WHERE id=$3`,
        [domainRank, JSON.stringify(domainRankMeta), req.siteId]
      )
      await pool.query(
        `INSERT INTO seo_metrics (site_id, dr)
         VALUES ($1, $2)
         ON CONFLICT (site_id) DO UPDATE SET
           dr=$2,
           updated_at=NOW()`,
        [req.siteId, domainRank]
      )
    } else {
      await pool.query(
        `UPDATE sites
         SET domain_rank_meta=$1::jsonb
         WHERE id=$2`,
        [JSON.stringify(domainRankMeta), req.siteId]
      )
    }

    // 2) Link Score from verified backlinks
    await recalculateBacklinkQualityForSite(req.siteId)

    const { rows } = await pool.query(
      `SELECT *
       FROM backlinks
       WHERE site_id=$1
         AND COALESCE(source, '') <> 'domain'`,
      [req.siteId]
    )

    const authority = calculateAuthority({
      rows,
    })

    const breakdown = {
      ...authority.breakdown,
      domainRank:
        domainRank ??
        prevBreakdown.domainRank ??
        null,
      domainRankSource: 'dataforseo',
      domainRankMeta:
        Object.keys(domainRankMeta).length
          ? domainRankMeta
          : (prevBreakdown.domainRankMeta || {}),
    }

    const { rows: updated } = await pool.query(
      `UPDATE sites
       SET
         authority_score=$1,
         authority_updated_at=NOW(),
         authority_version=$2,
         authority_breakdown=$3::jsonb
       WHERE id=$4
       RETURNING
         authority_score,
         authority_updated_at,
         authority_version,
         authority_breakdown,
         domain_rank,
         domain_rank_updated_at,
         domain_rank_meta`,
      [
        authority.score,
        authority.version,
        JSON.stringify(breakdown),
        req.siteId,
      ]
    )

    const row = updated[0] || {}

    res.json({
      ...row,
      authority_version: authority.version,
      link_score: authority.score,
      domain_rank: row.domain_rank ?? domainRank,
      domain_rank_meta: row.domain_rank_meta || domainRankMeta,
      counts: authority.counts,
      breakdown,
      methodology: {
        linkScore: {
          name: 'DevnDespro Link Score',
          scale: '0-100',
          verifiedLinksOnly: true,
          note: 'In-app score from your verified backlinks. Not Moz Domain Authority.',
          weights: {
            domainDiversity: 30,
            verifiedLinkQuality: 25,
            followNaturality: 15,
            linkStability: 10,
            verificationFreshness: 10,
            domainConcentration: 10,
          },
        },
        domainRank: {
          name: 'DataForSEO Domain Rank',
          scale: '0-100',
          note: 'Industry DA-style score (not Moz DA). Same 0–100 class as Moz DA / Ahrefs DR.',
        },
      },
    })
  } catch (error) {
    console.error(
      'Authority score calculation failed:',
      error
    )

    res.status(500).json({
      error: 'Failed to calculate authority score',
      detail: String(error?.message || error),
    })
  }
})
module.exports = router

