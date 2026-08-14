const jwt = require('jsonwebtoken')
const { pool } = require('./clients')
const {
  ensureUserFeatureSchema,
  canUseBacklinks,
  canUseKeywords,
  canUseAiAssistant,
  isAdminUser,
} = require('./utils/features')

const auth = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'No token' })
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const { rows } = await pool.query('SELECT id, email FROM users WHERE id=$1 LIMIT 1', [decoded.id])
    if (!rows[0]) return res.status(401).json({ error: 'Session expired. Please login again.' })
    req.user = decoded
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}

const verifySite = async (req, res, next) => {
  const siteId = req.params.siteId
  if (!siteId) return res.status(400).json({ error: 'siteId required' })

  const { rows } = await pool.query(
    `SELECT s.id
     FROM sites s
     LEFT JOIN site_access sa ON sa.site_id = s.id AND sa.user_id = $2
     WHERE s.id = $1
       AND (s.user_id = $2 OR sa.user_id = $2)
     LIMIT 1`,
    [siteId, req.user.id]
  )

  if (!rows[0]) return res.status(403).json({ error: 'Site not found or access denied' })
  req.siteId = parseInt(siteId)
  next()
}

const requireAdmin = (req, res, next) => {
  if (!isAdminUser(req.user)) {
    return res.status(403).json({ error: 'Admin only' })
  }
  next()
}

/** Gate a feature: admin always allowed; others need is_paid or explicit enable. */
const requireFeature = (feature) => async (req, res, next) => {
  try {
    await ensureUserFeatureSchema()
    if (isAdminUser(req.user)) return next()

    const { rows } = await pool.query(
      `SELECT id, is_paid, backlinks_enabled, keywords_enabled, ai_assistant_enabled
       FROM users WHERE id = $1 LIMIT 1`,
      [req.user.id]
    )
    const user = rows[0]
    if (!user) return res.status(401).json({ error: 'User not found' })

    const allowed =
      feature === 'backlinks' ? canUseBacklinks(user)
      : feature === 'keywords' ? canUseKeywords(user)
      : feature === 'ai_assistant' ? canUseAiAssistant(user)
      : false

    if (!allowed) {
      return res.status(403).json({
        error: `${feature} is locked. Upgrade or ask admin to enable it.`,
        feature,
        locked: true,
      })
    }
    next()
  } catch (err) {
    console.error('requireFeature error:', err)
    res.status(500).json({ error: 'Feature check failed' })
  }
}

module.exports = { auth, verifySite, requireAdmin, requireFeature }
