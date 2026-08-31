const express = require('express')
const { pool } = require('../clients')
const { auth } = require('../middleware')
const router = express.Router()

let schemaPromise
function ensureReportsSchema() {
  if (!schemaPromise) {
    schemaPromise = pool.query(`
      CREATE TABLE IF NOT EXISTS seo_reports (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        name VARCHAR(180) NOT NULL,
        report_type VARCHAR(40) NOT NULL DEFAULT 'portfolio',
        status VARCHAR(24) NOT NULL DEFAULT 'ready',
        snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_seo_reports_user_created
        ON seo_reports(user_id, created_at DESC);
    `).catch(error => {
      schemaPromise = null
      throw error
    })
  }
  return schemaPromise
}

function getUserId(req) {
  const value = req.user?.id ?? req.user?.userId ?? req.userId
  const id = Number(value)
  return Number.isFinite(id) && id > 0 ? id : null
}

function requireUser(req, res) {
  const userId = getUserId(req)
  if (!userId) res.status(401).json({ error: 'Authentication required.' })
  return userId
}

function cleanName(value, fallback = 'SEO Portfolio Report') {
  const name = String(value || '').replace(/[<>]/g, '').trim().slice(0, 180)
  return name || fallback
}

async function getPortfolioSnapshot(userId) {
  const [projects, keywords, backlinks, avgHealth, recent] = await Promise.all([
    pool.query('SELECT COUNT(*) FROM sites WHERE user_id=$1', [userId]),
    pool.query('SELECT COUNT(*) FROM keywords k JOIN sites s ON s.id=k.site_id WHERE s.user_id=$1', [userId]),
    pool.query('SELECT COUNT(*) FROM backlinks b JOIN sites s ON s.id=b.site_id WHERE s.user_id=$1', [userId]),
    pool.query('SELECT AVG(m.health) FROM seo_metrics m JOIN sites s ON s.id=m.site_id WHERE s.user_id=$1', [userId]),
    pool.query(`
      SELECT s.name, a.created_at, a.type, a.severity, a.message
      FROM alerts a JOIN sites s ON a.site_id=s.id
      WHERE s.user_id=$1 ORDER BY a.created_at DESC LIMIT 10
    `, [userId]),
  ])
  return {
    projects: Number(projects.rows[0].count),
    keywords: Number(keywords.rows[0].count),
    backlinks: Number(backlinks.rows[0].count),
    avgHealth: avgHealth.rows[0].avg ? Math.round(Number(avgHealth.rows[0].avg)) : 0,
    recent: recent.rows,
    generatedAt: new Date().toISOString(),
  }
}

router.use(auth)

router.get('/summary', async (req, res) => {
  const userId = requireUser(req, res)
  if (!userId) return
  try {
    const snapshot = await getPortfolioSnapshot(userId)
    const reports = await pool.query(
      'SELECT COUNT(*) FROM seo_reports WHERE user_id=$1', [userId]
    ).catch(() => ({ rows: [{ count: 0 }] }))
    res.json({ ...snapshot, reports: Number(reports.rows[0].count) })
  } catch (error) {
    console.error('reports/summary error:', error)
    res.status(500).json({ error: 'Failed to fetch report summary.' })
  }
})

router.get('/list', async (req, res) => {
  const userId = requireUser(req, res)
  if (!userId) return
  try {
    await ensureReportsSchema()
    const { rows } = await pool.query(`
      SELECT id, name, report_type AS "reportType", status, snapshot, created_at AS "createdAt"
      FROM seo_reports WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100
    `, [userId])
    res.json(rows)
  } catch (error) {
    console.error('reports/list error:', error)
    res.status(500).json({ error: 'Failed to load reports.' })
  }
})

router.post('/generate', async (req, res) => {
  const userId = requireUser(req, res)
  if (!userId) return
  try {
    await ensureReportsSchema()
    const snapshot = await getPortfolioSnapshot(userId)
    const name = cleanName(req.body?.name)
    const reportType = ['portfolio', 'executive', 'technical'].includes(req.body?.reportType)
      ? req.body.reportType : 'portfolio'
    const { rows } = await pool.query(`
      INSERT INTO seo_reports(user_id, name, report_type, status, snapshot)
      VALUES($1,$2,$3,'ready',$4::jsonb)
      RETURNING id, name, report_type AS "reportType", status, snapshot, created_at AS "createdAt"
    `, [userId, name, reportType, JSON.stringify(snapshot)])
    res.status(201).json(rows[0])
  } catch (error) {
    console.error('reports/generate error:', error)
    res.status(500).json({ error: 'Failed to generate report.' })
  }
})

router.get('/:id', async (req, res) => {
  const userId = requireUser(req, res)
  if (!userId) return
  try {
    await ensureReportsSchema()
    const { rows } = await pool.query(`
      SELECT id, name, report_type AS "reportType", status, snapshot, created_at AS "createdAt"
      FROM seo_reports WHERE id=$1 AND user_id=$2
    `, [req.params.id, userId])
    if (!rows[0]) return res.status(404).json({ error: 'Report not found.' })
    res.json(rows[0])
  } catch (error) {
    res.status(500).json({ error: 'Failed to load report.' })
  }
})

router.delete('/:id', async (req, res) => {
  const userId = requireUser(req, res)
  if (!userId) return
  try {
    await ensureReportsSchema()
    const result = await pool.query(
      'DELETE FROM seo_reports WHERE id=$1 AND user_id=$2', [req.params.id, userId]
    )
    if (!result.rowCount) return res.status(404).json({ error: 'Report not found.' })
    res.status(204).end()
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete report.' })
  }
})

async function trend(req, res, sql, valueKey) {
  const userId = requireUser(req, res)
  if (!userId) return
  try {
    const result = await pool.query(sql, [userId])
    res.json({
      dates: result.rows.map(row => row.date),
      values: result.rows.map(row => Number(row[valueKey] || 0)),
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch report trend.' })
  }
}

router.get('/trend/health', (req, res) => trend(req, res, `
  SELECT DATE(m.created_at) AS date, ROUND(AVG(m.health)) AS value
  FROM seo_metrics m JOIN sites s ON s.id=m.site_id
  WHERE s.user_id=$1 AND m.created_at > NOW()-INTERVAL '30 days'
  GROUP BY DATE(m.created_at) ORDER BY DATE(m.created_at)
`, 'value'))

router.get('/trend/keywords', (req, res) => trend(req, res, `
  SELECT d::date AS date, COUNT(s.id) AS value
  FROM generate_series(NOW()-INTERVAL '29 days',NOW(),'1 day') d
  LEFT JOIN keywords k ON DATE(k.created_at)=d::date
  LEFT JOIN sites s ON s.id=k.site_id AND s.user_id=$1
  GROUP BY d ORDER BY d
`, 'value'))

router.get('/trend/backlinks', (req, res) => trend(req, res, `
  SELECT d::date AS date, COUNT(s.id) AS value
  FROM generate_series(NOW()-INTERVAL '29 days',NOW(),'1 day') d
  LEFT JOIN backlinks b ON DATE(b.created_at)=d::date
  LEFT JOIN sites s ON s.id=b.site_id AND s.user_id=$1
  GROUP BY d ORDER BY d
`, 'value'))

module.exports = router
