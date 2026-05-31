require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { initDB } = require('./db')

const authRouter = require('./routes/auth')
const sitesRouter = require('./routes/sites')
const keywordsRouter = require('./routes/keywords')
const backlinksRouter = require('./routes/backlinks')
const auditRouter = require('./routes/audit')
const aiRouter = require('./routes/ai')
const integrationsRouter = require('./routes/integrations')
const coldEmailsRouter = require('./routes/coldEmails')
const { siteRouter: alertsSiteRouter, globalRouter: alertsGlobalRouter } = require('./routes/alerts')
const emailReportsRouter = require('./routes/emailReports')
const usersRouter = require('./routes/users')
const extractRouter = require('./routes/extract')
const adminEmailRouter = require('./routes/adminEmail')
const reportsRouter = require('./routes/reports')
const settingsRouter = require('./routes/settings')
const publicAuditRouter = require('./routes/publicAudit')

const app = express()
const PORT = process.env.PORT || 4000

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5174', credentials: true }))
app.use(express.json())

app.use('/api/auth', authRouter)
app.use('/api/sites', sitesRouter)
app.use('/api/sites', keywordsRouter)
app.use('/api/sites', backlinksRouter)
app.use('/api/sites', auditRouter)
app.use('/api/sites', aiRouter)
app.use('/api/sites', integrationsRouter)
app.use('/api/sites', coldEmailsRouter)
app.use('/api/sites', alertsSiteRouter)
app.use('/api/alerts', alertsGlobalRouter)
app.use('/api/sites', emailReportsRouter)
app.use('/api/users', usersRouter)
app.use('/api/reports', reportsRouter)
app.use('/api/extract', extractRouter)
app.use('/api/admin-email', adminEmailRouter)
app.use('/api/settings', settingsRouter)
app.use('/api/public', publicAuditRouter)


const cron = require('node-cron')
cron.schedule('0 8 * * *', async () => {
  console.log('Running daily AI visibility tests...')
  try {
    const { pool, anthropic } = require('./clients')
    const { rows: alreadyRan } = await pool.query("SELECT COUNT(*) FROM ai_visibility_tests WHERE created_at > NOW() - INTERVAL '20 hours'")
    if (parseInt(alreadyRan[0].count) > 0) { console.log('Already ran today, skipping'); return }
    const { rows: sites } = await pool.query('SELECT id, url FROM sites WHERE enable_ai_cron = true')
    for (const site of sites) {
      try {
        const domain = (() => { try { return new URL(site.url).hostname.replace('www.', '') } catch { return site.url } })()
        const queries = [domain + ' review', 'best ' + domain + ' software', domain + ' vs alternatives']
        const results = []
        for (const query of queries) {
          try {
            const msg = await anthropic.messages.create({
              model: 'claude-haiku-4-5', max_tokens: 150,
              messages: [{ role: 'user', content: query }],
            })
            const response = msg.content[0]?.text || ''
            const cited = response.toLowerCase().includes(domain.toLowerCase()) && !response.toLowerCase().includes("don't have") && !response.toLowerCase().includes("no information") && !response.toLowerCase().includes("not familiar") && !response.toLowerCase().includes("i don't") && !response.toLowerCase().includes("i cannot")
            results.push({ query, cited })
          } catch { results.push({ query, cited: false }) }
        }
        const citedCount = results.filter(r => r.cited).length
        const score = results.length > 0 ? Math.round((citedCount / results.length) * 100) : 0
        await pool.query('INSERT INTO seo_metrics (site_id, claude_cited) VALUES ($1,$2) ON CONFLICT (site_id) DO UPDATE SET claude_cited=$2', [site.id, score])
        await pool.query('INSERT INTO ai_visibility_tests (site_id, results, created_at) VALUES ($1,$2,NOW())', [site.id, JSON.stringify(results)])
        console.log('AI visibility tested for site', site.id, '- score:', score)
      } catch (e) { console.error('Failed for site', site.id, e.message) }
    }
  } catch (e) { console.error('Cron job failed:', e.message) }
})
initDB().then(() => {
  // Auto-migration
const { pool: _pool } = require('./clients')
_pool.query('ALTER TABLE seo_metrics ADD COLUMN IF NOT EXISTS aeo_score integer').catch(() => {})
_pool.query('ALTER TABLE sites ADD COLUMN IF NOT EXISTS enable_ai_cron boolean DEFAULT false').catch(() => {})

app.listen(PORT, () => console.log(`SEO backend running on port ${PORT}`))
}).catch(err => { console.error('DB init failed:', err); process.exit(1) })
