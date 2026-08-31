const express = require('express')
const { pool } = require('../clients')
const { auth } = require('../middleware')
const router = express.Router()

let schemaPromise
function ensureReportsSchema() {
  if (!schemaPromise) schemaPromise = pool.query(`
    CREATE TABLE IF NOT EXISTS seo_reports (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      name VARCHAR(180) NOT NULL,
      report_type VARCHAR(40) NOT NULL DEFAULT 'complete',
      status VARCHAR(24) NOT NULL DEFAULT 'ready',
      snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE seo_reports ADD COLUMN IF NOT EXISTS site_id BIGINT;
    ALTER TABLE seo_reports ADD COLUMN IF NOT EXISTS scope VARCHAR(20) NOT NULL DEFAULT 'portfolio';
    CREATE INDEX IF NOT EXISTS idx_seo_reports_user_created ON seo_reports(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_seo_reports_site ON seo_reports(site_id);
  `).catch(error => { schemaPromise = null; throw error })
  return schemaPromise
}

const isAdmin = req => Number(req.user?.id) === 1
const cleanName = (value, fallback) => String(value || fallback).replace(/[<>]/g, '').trim().slice(0, 180)

async function allowedSites(req) {
  const params = []
  const access = isAdmin(req) ? '' : 'INNER JOIN site_access sa ON sa.site_id=s.id AND sa.user_id=$1'
  if (!isAdmin(req)) params.push(req.user.id)
  const { rows } = await pool.query(`
    SELECT s.id, s.name, s.url, COALESCE(m.health,0)::int AS health,
      COALESCE(k.count,0)::int AS "keywordCount", COALESCE(b.count,0)::int AS "backlinkCount"
    FROM sites s ${access}
    LEFT JOIN seo_metrics m ON m.site_id=s.id
    LEFT JOIN (SELECT site_id,COUNT(*)::int count FROM keywords GROUP BY site_id) k ON k.site_id=s.id
    LEFT JOIN (SELECT site_id,COUNT(*)::int count FROM backlinks GROUP BY site_id) b ON b.site_id=s.id
    ORDER BY s.name ASC
  `, params)
  return rows
}

async function verifySiteAccess(req, siteId) {
  const id = Number(siteId)
  if (!Number.isInteger(id) || id < 1) return null
  const params = [id]
  const access = isAdmin(req) ? '' : 'INNER JOIN site_access sa ON sa.site_id=s.id AND sa.user_id=$2'
  if (!isAdmin(req)) params.push(req.user.id)
  const { rows } = await pool.query(`SELECT s.id,s.name,s.url FROM sites s ${access} WHERE s.id=$1 LIMIT 1`, params)
  return rows[0] || null
}

async function snapshotFor(req, scope, siteId) {
  let where = ''
  let params = []
  let subject = { name: 'All projects', url: '' }
  if (scope === 'site') {
    const site = await verifySiteAccess(req, siteId)
    if (!site) { const error = new Error('Project not found or access denied.'); error.status = 403; throw error }
    where = 'WHERE s.id=$1'; params = [site.id]; subject = site
  } else {
    if (!isAdmin(req)) { const error = new Error('Only an administrator can generate an all-project report.'); error.status = 403; throw error }
  }
  const [projects, keywords, backlinks, health, recent] = await Promise.all([
    pool.query(`SELECT COUNT(*)::int count FROM sites s ${where}`, params),
    pool.query(`SELECT COUNT(*)::int count FROM keywords x JOIN sites s ON s.id=x.site_id ${where}`, params),
    pool.query(`SELECT COUNT(*)::int count FROM backlinks x JOIN sites s ON s.id=x.site_id ${where}`, params),
    pool.query(`SELECT COALESCE(ROUND(AVG(m.health)),0)::int value FROM seo_metrics m JOIN sites s ON s.id=m.site_id ${where}`, params),
    pool.query(`SELECT s.name,a.created_at,a.type,a.severity,a.message FROM alerts a JOIN sites s ON s.id=a.site_id ${where} ORDER BY a.created_at DESC LIMIT 12`, params),
  ])
  return { scope, siteId: scope === 'site' ? Number(siteId) : null, subject,
    projects: projects.rows[0].count, keywords: keywords.rows[0].count,
    backlinks: backlinks.rows[0].count, avgHealth: health.rows[0].value,
    recent: recent.rows, generatedAt: new Date().toISOString() }
}

router.use(auth)

router.get('/context', async (req,res) => {
  try { res.json({ isAdmin: isAdmin(req), sites: await allowedSites(req) }) }
  catch (error) { console.error('reports/context:', error); res.status(500).json({ error: 'Failed to load report access.' }) }
})

router.get('/summary', async (req,res) => {
  try {
    await ensureReportsSchema()
    const sites = await allowedSites(req)
    const reports = await pool.query('SELECT COUNT(*)::int count FROM seo_reports WHERE user_id=$1',[req.user.id])
    const total = key => sites.reduce((sum,site) => sum + Number(site[key] || 0),0)
    const scored = sites.filter(site => Number(site.health) > 0)
    res.json({ reports: reports.rows[0].count, projects: sites.length, keywords: total('keywordCount'),
      backlinks: total('backlinkCount'), avgHealth: scored.length ? Math.round(total('health')/scored.length) : 0 })
  } catch (error) { console.error('reports/summary:',error); res.status(500).json({ error:'Failed to fetch report summary.' }) }
})

router.get('/list', async (req,res) => {
  try {
    await ensureReportsSchema()
    const { rows } = await pool.query(`SELECT id,name,report_type AS "reportType",status,scope,site_id AS "siteId",snapshot,created_at AS "createdAt" FROM seo_reports WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100`,[req.user.id])
    res.json(rows)
  } catch (error) { console.error('reports/list:',error); res.status(500).json({ error:'Failed to load reports.' }) }
})

router.post('/generate', async (req,res) => {
  try {
    await ensureReportsSchema()
    const scope = req.body?.scope === 'portfolio' ? 'portfolio' : 'site'
    const reportType = ['complete','executive','technical'].includes(req.body?.reportType) ? req.body.reportType : 'complete'
    const snapshot = await snapshotFor(req,scope,req.body?.siteId)
    const fallback = `${snapshot.subject.name} SEO Report`
    const name = cleanName(req.body?.name,fallback)
    const { rows } = await pool.query(`INSERT INTO seo_reports(user_id,site_id,scope,name,report_type,status,snapshot) VALUES($1,$2,$3,$4,$5,'ready',$6::jsonb) RETURNING id,name,report_type AS "reportType",status,scope,site_id AS "siteId",snapshot,created_at AS "createdAt"`,[req.user.id,snapshot.siteId,scope,name,reportType,JSON.stringify(snapshot)])
    res.status(201).json(rows[0])
  } catch (error) { console.error('reports/generate:',error); res.status(error.status || 500).json({ error:error.status ? error.message : 'Failed to generate report.' }) }
})

router.get('/:id', async (req,res) => {
  try { await ensureReportsSchema(); const { rows }=await pool.query(`SELECT id,name,report_type AS "reportType",status,scope,site_id AS "siteId",snapshot,created_at AS "createdAt" FROM seo_reports WHERE id=$1 AND user_id=$2`,[req.params.id,req.user.id]); if(!rows[0]) return res.status(404).json({error:'Report not found.'}); res.json(rows[0]) }
  catch { res.status(500).json({error:'Failed to load report.'}) }
})

router.delete('/:id', async (req,res) => {
  try { await ensureReportsSchema(); const result=await pool.query('DELETE FROM seo_reports WHERE id=$1 AND user_id=$2',[req.params.id,req.user.id]); if(!result.rowCount) return res.status(404).json({error:'Report not found.'}); res.status(204).end() }
  catch { res.status(500).json({error:'Failed to delete report.'}) }
})

module.exports = router
