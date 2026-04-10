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

initDB().then(() => {
  app.listen(PORT, () => console.log(`SEO backend running on port ${PORT}`))
}).catch(err => { console.error('DB init failed:', err); process.exit(1) })
