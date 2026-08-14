const { pool } = require('../clients')

function parseResults(raw) {
  if (!raw) return null
  if (typeof raw === 'object') return raw
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function normalizeActionKey(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 280)
}

function extractFailingChecks(results) {
  if (!results) return []
  const checks = []

  if (Array.isArray(results.topIssues)) {
    for (const i of results.topIssues) {
      checks.push({
        message: i.message || i.title || i.check,
        status: i.status || (i.severity === 'error' ? 'error' : 'warning'),
      })
    }
  }
  if (Array.isArray(results.checks)) checks.push(...results.checks)

  if (Array.isArray(results.pages)) {
    for (const p of results.pages) {
      if (Array.isArray(p.checks)) checks.push(...p.checks)
      if (Array.isArray(p.issues)) {
        for (const i of p.issues) {
          checks.push({
            message: i.message || i.title || i.check,
            status: i.status || 'warning',
          })
        }
      }
    }
  }

  if (results.issueSummary && typeof results.issueSummary === 'object') {
    const summary = Array.isArray(results.issueSummary)
      ? results.issueSummary
      : Object.entries(results.issueSummary).map(([k, v]) => ({
          message: typeof v === 'object' ? (v.sampleMessage || v.message || k) : k,
          status: (v && (v.status || (v.count > 0 ? 'warning' : 'pass'))) || 'pass',
          check: typeof v === 'object' ? v.check || k : k,
        }))
    for (const i of summary) {
      checks.push({
        message: i.sampleMessage || i.message || i.title || i.check,
        status: i.status || (Number(i.count) > 0 ? 'warning' : 'pass'),
        check: i.check,
      })
    }
  }

  const failing = []
  const seen = new Set()
  for (const c of checks) {
    if (!c) continue
    const st = String(c.status || '').toLowerCase()
    if (st !== 'error' && st !== 'warning' && st !== 'fail') continue
    const text = String(c.message || c.title || c.name || c.check || '').trim()
    if (!text) continue
    const key = normalizeActionKey(text)
    if (seen.has(key)) continue
    seen.add(key)
    failing.push({
      text: text.slice(0, 280),
      impact: st === 'error' || st === 'fail' ? 'High' : 'Medium',
      key,
    })
  }
  return failing.slice(0, 15)
}

async function loadLatestAuditBundle(siteId) {
  // Prefer multipage / richest audit (issueSummary or pages) over thin homepage row
  const { rows } = await pool.query(
    `SELECT results, score, site_health_pct, created_at
     FROM audit_results
     WHERE site_id=$1 AND COALESCE(status, 'complete') IN ('complete')
     ORDER BY created_at DESC
     LIMIT 8`,
    [siteId]
  )
  if (!rows.length) return null

  const scored = rows.map((row) => {
    const results = parseResults(row.results)
    let richness = 0
    if (Array.isArray(results?.issueSummary) && results.issueSummary.length) richness += 40
    if (Array.isArray(results?.pages) && results.pages.length) richness += 30
    if (Array.isArray(results?.checks) && results.checks.length) richness += 10
    if (results?.siteHealthPct != null) richness += 5
    return { row, results, richness }
  })
  scored.sort((a, b) => b.richness - a.richness || 0)
  const best = scored[0]
  const row = best.row
  return {
    results: best.results,
    score: Number(row.score) || 0,
    siteHealthPct:
      Number(row.site_health_pct) ||
      Number(best.results?.siteHealthPct) ||
      Number(row.score) ||
      0,
  }
}

async function ensureActionSourceColumn() {
  await pool.query(`ALTER TABLE actions ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual'`)
}

/**
 * After audit completes or on refresh:
 * 1) Set health from real audit score
 * 2) Add new failing issues as pending actions (source=audit)
 * 3) Auto-complete audit actions that are no longer failing (fixed)
 * 4) Re-open completed audit actions if the issue returns
 */
async function reconcileActionsFromAudit(siteId, options = {}) {
  await ensureActionSourceColumn()

  const audit = options.auditBundle || (await loadLatestAuditBundle(siteId))
  const results = options.results || audit?.results || null
  const healthScore = Math.min(
    100,
    Math.max(
      0,
      Number(
        options.healthScore ??
          audit?.siteHealthPct ??
          audit?.score ??
          results?.siteHealthPct ??
          0
      ) || 0
    )
  )

  if (healthScore > 0 || options.setHealthEvenIfZero) {
    await pool.query(
      `INSERT INTO seo_metrics (site_id, health)
       VALUES ($1, $2)
       ON CONFLICT (site_id) DO UPDATE
       SET health=$2, updated_at=NOW()`,
      [siteId, healthScore]
    )
  }

  if (!results) {
    const { rows: all } = await pool.query(
      'SELECT * FROM actions WHERE site_id=$1 ORDER BY done ASC, created_at ASC',
      [siteId]
    )
    return { seeded: 0, completed: 0, health: healthScore || null, actions: all }
  }

  const failing = extractFailingChecks(results)
  const failingKeys = new Set(failing.map(f => f.key))

  const { rows: pending } = await pool.query(
    `SELECT id, text, COALESCE(source, 'manual') AS source
     FROM actions WHERE site_id=$1 AND done=FALSE`,
    [siteId]
  )

  let completed = 0
  for (const row of pending) {
    if (String(row.source) !== 'audit') continue
    const key = normalizeActionKey(row.text)
    if (!failingKeys.has(key)) {
      await pool.query('UPDATE actions SET done=TRUE WHERE id=$1 AND site_id=$2', [
        row.id,
        siteId,
      ])
      completed += 1
    }
  }

  let seeded = 0
  for (const f of failing) {
    const ins = await pool.query(
      `INSERT INTO actions (site_id, text, impact, source)
       SELECT $1, $2, $3, 'audit'
       WHERE NOT EXISTS (
         SELECT 1 FROM actions
         WHERE site_id=$1 AND lower(btrim(text))=lower(btrim($2)) AND done=FALSE
       )
       RETURNING id`,
      [siteId, f.text, f.impact]
    )
    if (ins.rowCount > 0) seeded += 1

    await pool.query(
      `UPDATE actions SET done=FALSE, impact=$3, source='audit'
       WHERE id = (
         SELECT id FROM actions
         WHERE site_id=$1 AND lower(btrim(text))=lower(btrim($2)) AND done=TRUE
         ORDER BY created_at DESC
         LIMIT 1
       )
       AND NOT EXISTS (
         SELECT 1 FROM actions
         WHERE site_id=$1 AND lower(btrim(text))=lower(btrim($2)) AND done=FALSE
       )`,
      [siteId, f.text, f.impact]
    )
  }

  // Tag older open tasks that match current audit issues as audit-sourced
  for (const f of failing) {
    await pool.query(
      `UPDATE actions SET source='audit'
       WHERE site_id=$1 AND done=FALSE AND lower(btrim(text))=lower(btrim($2))
         AND COALESCE(source, 'manual') <> 'audit'`,
      [siteId, f.text]
    )
  }

  const { rows: all } = await pool.query(
    'SELECT * FROM actions WHERE site_id=$1 ORDER BY done ASC, created_at ASC',
    [siteId]
  )

  return {
    seeded,
    completed,
    health: healthScore,
    failingCount: failing.length,
    actions: all,
  }
}

module.exports = {
  reconcileActionsFromAudit,
  extractFailingChecks,
  normalizeActionKey,
}
