const express = require('express')
const { getSetting, setSetting } = require('../utils/settings')
const { auth } = require('../middleware')

const router = express.Router()

// Get all settings (admin only)
router.get('/', auth, async (req, res) => {
  // Only allow admin (first user for now)
  if (req.user.id !== 1) return res.status(403).json({ error: 'Admin only' })
  const coldEmailsEnabled = await getSetting('cold_emails_enabled', true)
  res.json({ cold_emails_enabled: coldEmailsEnabled })
})

// Update a setting (admin only)
router.post('/', auth, async (req, res) => {
  if (req.user.id !== 1) return res.status(403).json({ error: 'Admin only' })
  const { key, value } = req.body
  if (!key) return res.status(400).json({ error: 'Missing key' })
  await setSetting(key, value)
  res.json({ ok: true })
})

module.exports = router
