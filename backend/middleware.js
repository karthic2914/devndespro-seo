const jwt = require('jsonwebtoken')
const { pool } = require('./clients')

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
  const { rows } = await pool.query('SELECT id FROM sites WHERE id=$1 AND user_id=$2', [siteId, req.user.id])
  if (!rows[0]) return res.status(403).json({ error: 'Site not found or access denied' })
  req.siteId = parseInt(siteId)
  next()
}

module.exports = { auth, verifySite }
