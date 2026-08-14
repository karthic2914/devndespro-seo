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

/**
 * Rank issues by how much they usually help search visibility / rankings.
 * Critical = crawl/index blockers; High = strong ranking signals; Medium/Low = polish.
 */
function classifyForRanking(message, status) {
  const t = String(message || '').toLowerCase()
  const st = String(status || '').toLowerCase()

  const rules = [
    {
      test: /noindex|robots\.txt|blocked from indexing|not indexable|x-robots|disallow:\s*\//i,
      impact: 'Critical',
      category: 'Indexing',
      why: 'Google may not index these pages at all.',
      score: 100,
    },
    {
      test: /5\d\d|server error|ssl|https|certificate|redirect loop|canonical.*(missing|conflict)/i,
      impact: 'Critical',
      category: 'Technical',
      why: 'Crawl and trust problems block rankings.',
      score: 95,
    },
    {
      test: /4\d\d|broken|404|soft 404|dead link/i,
      impact: 'High',
      category: 'Technical',
      why: 'Broken pages waste crawl budget and lose rankings.',
      score: 88,
    },
    {
      test: /missing (page )?title|title tag missing|no title/i,
      impact: 'High',
      category: 'On-page',
      why: 'Titles are a top ranking and CTR signal.',
      score: 86,
    },
    {
      test: /share a title|duplicate title|same title/i,
      impact: 'High',
      category: 'On-page',
      why: 'Duplicate titles confuse which page should rank.',
      score: 84,
    },
    {
      test: /word count|thin content|low word/i,
      impact: 'High',
      category: 'Content',
      why: 'Thin pages rarely win competitive keywords.',
      score: 82,
    },
    {
      test: /missing h1|no h1|multiple h1/i,
      impact: 'High',
      category: 'On-page',
      why: 'Clear H1 helps topical relevance.',
      score: 78,
    },
    {
      test: /share a meta description|duplicate meta description/i,
      impact: 'Medium',
      category: 'On-page',
      why: 'Hurts CTR more than raw rankings, still worth fixing.',
      score: 62,
    },
    {
      test: /title length|meta description length|description (too|should)/i,
      impact: 'Medium',
      category: 'On-page',
      why: 'Improves snippet clarity and click-through.',
      score: 58,
    },
    {
      test: /alt text|image alt|missing alt/i,
      impact: 'Medium',
      category: 'On-page',
      why: 'Helps image search and accessibility.',
      score: 52,
    },
    {
      test: /slow|core web vital|lcp|cls|performance|mobile/i,
      impact: 'Medium',
      category: 'Technical',
      why: 'Speed is a ranking and UX factor.',
      score: 55,
    },
    {
      test: /og:|open graph|twitter card|favicon|structured data|schema/i,
      impact: 'Low',
      category: 'Polish',
      why: 'Nice for sharing and richness; lower ranking impact.',
      score: 35,
    },
  ]

  for (const rule of rules) {
    if (rule.test.test(t)) {
      return {
        impact: rule.impact,
        category: rule.category,
        why: rule.why,
        score: rule.score,
      }
    }
  }

  if (st === 'error' || st === 'fail') {
    return {
      impact: 'High',
      category: 'Technical',
      why: 'Failing checks usually hurt crawl or on-page quality.',
      score: 75,
    }
  }

  return {
    impact: 'Medium',
    category: 'On-page',
    why: 'Improves site quality; do after critical ranking blockers.',
    score: 50,
  }
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
    const meta = classifyForRanking(text, st)
    failing.push({
      text: text.slice(0, 280),
      impact: meta.impact,
      category: meta.category,
      why: meta.why,
      score: meta.score,
      key,
      source: 'audit',
    })
  }

  failing.sort((a, b) => (b.score || 0) - (a.score || 0))
  return failing.slice(0, 20)
}

async function loadLatestAuditBundle(siteId) {
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

async function ensureActionColumns() {
  await pool.query(`ALTER TABLE actions ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual'`)
  await pool.query(`ALTER TABLE actions ADD COLUMN IF NOT EXISTS category TEXT`)
  await pool.query(`ALTER TABLE actions ADD COLUMN IF NOT EXISTS why TEXT`)
  await pool.query(`ALTER TABLE actions ADD COLUMN IF NOT EXISTS priority_score INTEGER DEFAULT 50`)
}

async function buildGrowthActions(siteId) {
  const growth = []

  const [{ rows: siteRows }, { rows: kwRows }, { rows: blRows }, { rows: metricRows }, { rows: userRows }] =
    await Promise.all([
      pool.query('SELECT id, url, user_id FROM sites WHERE id=$1', [siteId]),
      pool.query('SELECT COUNT(*)::int AS n FROM keywords WHERE site_id=$1', [siteId]),
      pool.query(
        `SELECT COUNT(*)::int AS n FROM backlinks WHERE site_id=$1 AND COALESCE(status,'') <> 'prospect'`,
        [siteId]
      ),
      pool.query('SELECT health FROM seo_metrics WHERE site_id=$1', [siteId]),
      pool.query(
        `SELECT u.gsc_refresh_token
         FROM sites s JOIN users u ON u.id = s.user_id
         WHERE s.id=$1`,
        [siteId]
      ),
    ])

  const site = siteRows[0]
  if (!site) return growth

  const keywordCount = Number(kwRows[0]?.n) || 0
  const backlinkCount = Number(blRows[0]?.n) || 0
  const health = Number(metricRows[0]?.health) || 0
  const gscConnected = Boolean(userRows[0]?.gsc_refresh_token)

  if (!gscConnected) {
    growth.push({
      text: 'Connect Google Search Console to track clicks, impressions and keyword positions',
      impact: 'Critical',
      category: 'Rankings',
      why: 'Without GSC you cannot measure what already drives traffic.',
      score: 98,
      source: 'growth',
      key: normalizeActionKey('connect google search console'),
    })
  }

  if (keywordCount === 0) {
    growth.push({
      text: 'Add and track target keywords (gap + research) so you know what to rank for',
      impact: 'Critical',
      category: 'Rankings',
      why: 'Rankings need a keyword target list before content or links pay off.',
      score: 96,
      source: 'growth',
      key: normalizeActionKey('add and track target keywords'),
    })
  }

  if (health > 0 && health < 75) {
    growth.push({
      text: 'Raise site health above 75 by fixing Critical/High audit issues first',
      impact: 'High',
      category: 'Technical',
      why: 'Weak technical health caps ranking potential even with good content.',
      score: 90,
      source: 'growth',
      key: normalizeActionKey('raise site health above 75'),
    })
  }

  if (backlinkCount === 0) {
    growth.push({
      text: 'Start backlink outreach: find gap prospects and earn 1–2 quality links',
      impact: 'High',
      category: 'Links',
      why: 'Authority from real links is a major ranking factor vs competitors.',
      score: 85,
      source: 'growth',
      key: normalizeActionKey('start backlink outreach'),
    })
  }

  if (keywordCount > 0 && keywordCount < 10) {
    growth.push({
      text: 'Expand tracked keywords to cover your main money / service terms',
      impact: 'Medium',
      category: 'Rankings',
      why: 'A fuller keyword set shows where you can win page-1 next.',
      score: 60,
      source: 'growth',
      key: normalizeActionKey('expand tracked keywords'),
    })
  }

  return growth
}

function impactRank(impact) {
  const i = String(impact || '').toLowerCase()
  if (i === 'critical') return 0
  if (i === 'high') return 1
  if (i === 'medium') return 2
  if (i === 'low') return 3
  return 4
}

function sortActions(rows) {
  return [...(rows || [])].sort((a, b) => {
    if (Boolean(a.done) !== Boolean(b.done)) return a.done ? 1 : -1
    const scoreDiff = (Number(b.priority_score) || 0) - (Number(a.priority_score) || 0)
    if (scoreDiff) return scoreDiff
    const impactDiff = impactRank(a.impact) - impactRank(b.impact)
    if (impactDiff) return impactDiff
    return new Date(a.created_at || 0) - new Date(b.created_at || 0)
  })
}

/**
 * After audit completes or on refresh:
 * 1) Set health from real audit score
 * 2) Add failing issues as pending actions (source=audit) with ranking-based priority
 * 3) Seed growth actions (keywords / GSC / backlinks gaps)
 * 4) Auto-complete audit actions that are no longer failing
 * 5) Re-open completed audit actions if the issue returns
 */
async function reconcileActionsFromAudit(siteId, options = {}) {
  await ensureActionColumns()

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

  const failing = results ? extractFailingChecks(results) : []
  const growth = await buildGrowthActions(siteId)
  const desired = [...growth, ...failing]
  const failingKeys = new Set(failing.map((f) => f.key))

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

  // Auto-complete growth tasks when the gap is closed
  const stillNeeded = new Set(growth.map((g) => g.key))
  const { rows: openGrowth } = await pool.query(
    `SELECT id, text FROM actions
     WHERE site_id=$1 AND done=FALSE AND COALESCE(source,'manual')='growth'`,
    [siteId]
  )
  for (const row of openGrowth) {
    const key = normalizeActionKey(row.text)
    if (!stillNeeded.has(key)) {
      await pool.query('UPDATE actions SET done=TRUE WHERE id=$1 AND site_id=$2', [
        row.id,
        siteId,
      ])
      completed += 1
    }
  }

  let seeded = 0
  for (const f of desired) {
    const ins = await pool.query(
      `INSERT INTO actions (site_id, text, impact, source, category, why, priority_score)
       SELECT $1, $2, $3, $4, $5, $6, $7
       WHERE NOT EXISTS (
         SELECT 1 FROM actions
         WHERE site_id=$1 AND lower(btrim(text))=lower(btrim($2)) AND done=FALSE
       )
       RETURNING id`,
      [siteId, f.text, f.impact, f.source || 'audit', f.category || null, f.why || null, f.score || 50]
    )
    if (ins.rowCount > 0) seeded += 1

    await pool.query(
      `UPDATE actions
       SET done=FALSE,
           impact=$3,
           source=COALESCE($4, source),
           category=COALESCE($5, category),
           why=COALESCE($6, why),
           priority_score=COALESCE($7, priority_score)
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
      [siteId, f.text, f.impact, f.source || 'audit', f.category || null, f.why || null, f.score || 50]
    )

    // Refresh priority metadata on existing open matches
    await pool.query(
      `UPDATE actions
       SET impact=$3,
           source=COALESCE($4, source),
           category=COALESCE($5, category),
           why=COALESCE($6, why),
           priority_score=COALESCE($7, priority_score)
       WHERE site_id=$1 AND done=FALSE AND lower(btrim(text))=lower(btrim($2))`,
      [siteId, f.text, f.impact, f.source || 'audit', f.category || null, f.why || null, f.score || 50]
    )
  }

  for (const f of failing) {
    await pool.query(
      `UPDATE actions SET source='audit'
       WHERE site_id=$1 AND done=FALSE AND lower(btrim(text))=lower(btrim($2))
         AND COALESCE(source, 'manual') NOT IN ('audit', 'growth')`,
      [siteId, f.text]
    )
  }

  const { rows: all } = await pool.query(
    'SELECT * FROM actions WHERE site_id=$1',
    [siteId]
  )

  return {
    seeded,
    completed,
    health: healthScore,
    failingCount: failing.length,
    growthCount: growth.length,
    actions: sortActions(all),
  }
}

module.exports = {
  reconcileActionsFromAudit,
  extractFailingChecks,
  normalizeActionKey,
  classifyForRanking,
  sortActions,
  ensureActionColumns,
}
