// routes/publicAudit.js
// Add this file to your SEO tool backend routes folder
// Then in server.js add: import publicAuditRouter from './routes/publicAudit.js'
//                         app.use('/api/public', publicAuditRouter)

import express from 'express'

const router = express.Router()

// Simple API key middleware for public endpoint
function checkApiKey(req, res, next) {
  const key = req.headers['x-api-key'] || ''
  const validKey = process.env.PUBLIC_AUDIT_API_KEY || ''
  // If no key configured, allow all (open) — set PUBLIC_AUDIT_API_KEY in Railway to secure
  if (validKey && key !== validKey) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

router.post('/audit', checkApiKey, async (req, res) => {
  const { url } = req.body || {}
  if (!url) return res.status(400).json({ error: 'URL required' })

  try {
    // Import your existing audit function
    const { runAudit } = await import('../utils/audit.js')
    const result = await runAudit(url)
    return res.json(result)
  } catch (err) {
    console.error('Public audit error:', err.message)
    return res.status(500).json({ error: 'Audit failed', message: err.message })
  }
})

export default router
