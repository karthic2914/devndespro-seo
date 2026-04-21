const express = require('express')
const { pool } = require('../clients')
const { auth } = require('../middleware')
const { getSetting } = require('../utils/settings')
const { sendSummaryEmail } = require('../utils/email')

const router = express.Router()

// Send summary email to project contact (admin only)
router.post('/send-summary', auth, async (req, res) => {
  if (req.user.id !== 1) return res.status(403).json({ error: 'Admin only' })
  const { siteId, subject, message, includeFullReport, overrideEmail } = req.body
  if (!siteId || !subject || !message) return res.status(400).json({ error: 'Missing required fields' })
  const { rows: siteRows } = await pool.query('SELECT * FROM sites WHERE id=$1', [Number(siteId)])
  if (!siteRows[0]) return res.status(404).json({ error: 'Site not found' })
  let to = null
  if (overrideEmail && String(overrideEmail).trim()) {
    to = String(overrideEmail).trim()
  } else {
    const { rows: prospectRows } = await pool.query("SELECT * FROM cold_email_prospects WHERE site_id=$1 AND email IS NOT NULL AND email <> '' LIMIT 1", [Number(siteId)])
    if (!prospectRows[0]) return res.status(404).json({ error: 'No contact email found for this site' })
    to = prospectRows[0].email
  }
  let fullReport = null
  if (includeFullReport) {
    const { rows: auditRows } = await pool.query('SELECT results FROM audit_results WHERE site_id=$1 ORDER BY created_at DESC LIMIT 1', [Number(siteId)])
    fullReport = auditRows[0]?.results || null
  }
  try {
    await sendSummaryEmail({ to, subject, message, fullReport })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: 'Failed to send email', details: e.message })
  }
})

module.exports = router