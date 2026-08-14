const express = require('express')
const { auth } = require('../middleware')
const { getUsageSummary } = require('../utils/aiUsage')

const router = express.Router()

// Account-level AI spend awareness (estimated from logged token usage).
router.get('/summary', auth, async (req, res) => {
  try {
    const days = Number(req.query.days) || 30
    const summary = await getUsageSummary({
      userId: req.user?.id || null,
      days,
    })
    res.json(summary)
  } catch (err) {
    console.error('usage summary failed:', err.message)
    res.status(500).json({ error: 'Failed to load usage summary' })
  }
})

module.exports = router
