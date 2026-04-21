const express = require('express')
const axios = require('axios')
const cheerio = require('cheerio')
const { auth } = require('../middleware')

const router = express.Router()

// Extract email addresses from a website homepage (admin only)
router.post('/extract-email', auth, async (req, res) => {
  if (req.user.id !== 1) return res.status(403).json({ error: 'Admin only' })
  const { url } = req.body
  if (!url) return res.status(400).json({ error: 'Missing url' })
  try {
    const { data: html } = await axios.get(url, { timeout: 10000 })
    const $ = cheerio.load(html)
    const emails = new Set()
    // Find mailto links
    $('a[href^="mailto:"]').each((_, el) => {
      const href = $(el).attr('href')
      const match = href.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
      if (match) emails.add(match[0])
    })
    // Find visible text emails
    const text = $('body').text()
    const textMatches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g)
    if (textMatches) textMatches.forEach(e => emails.add(e))
    res.json({ emails: Array.from(emails) })
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch or parse site', details: e.message })
  }
})

module.exports = router
