const express = require('express')
const axios = require('axios')
const cheerio = require('cheerio')

const router = express.Router()

router.post('/audit', async (req, res) => {
  const { url } = req.body || {}
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ ok: false, error: 'URL is required' })
  }
  let auditUrl = url.trim()
  if (!auditUrl.startsWith('http')) auditUrl = `https://${auditUrl}`

  try {
    const crawlStartedAt = Date.now()
    const crawlRes = await axios.get(auditUrl, {
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SEOAuditBot/1.0; +https://devndespro.com)' },
      maxRedirects: 5,
    })
    const html = typeof crawlRes.data === 'string' ? crawlRes.data : String(crawlRes.data || '')
    const $ = cheerio.load(html)
    const checks = []
    const add = (check, status, message, impact, category) =>
      checks.push({ check, status, message, impact, category })

    const finalUrl = crawlRes?.request?.res?.responseUrl || auditUrl
    const responseTimeMs = Date.now() - crawlStartedAt
    const isHttps = /^https:\/\//i.test(finalUrl)

    const title = $('title').text().trim()
    if (!title) add('title', 'error', 'Missing <title> tag', 'High', 'On-Page SEO')
    else if (title.length < 30) add('title', 'warning', `Title too short: ${title.length} chars (aim 50-60)`, 'Medium', 'On-Page SEO')
    else if (title.length > 60) add('title', 'warning', `Title too long: ${title.length} chars`, 'Medium', 'On-Page SEO')
    else add('title', 'pass', `Title OK: "${title.substring(0, 55)}"`, 'High', 'On-Page SEO')

    const metaDesc = $('meta[name="description"]').attr('content') || ''
    if (!metaDesc) add('meta_desc', 'error', 'Missing meta description', 'High', 'On-Page SEO')
    else if (metaDesc.length < 100) add('meta_desc', 'warning', `Meta description too short: ${metaDesc.length} chars`, 'Medium', 'On-Page SEO')
    else if (metaDesc.length > 160) add('meta_desc', 'warning', `Meta description too long: ${metaDesc.length} chars`, 'Low', 'On-Page SEO')
    else add('meta_desc', 'pass', 'Meta description: good length', 'High', 'On-Page SEO')

    const h1s = $('h1')
    if (h1s.length === 0) add('h1', 'error', 'No H1 heading found', 'High', 'On-Page SEO')
    else if (h1s.length > 1) add('h1', 'warning', `${h1s.length} H1 tags found — keep only one`, 'Medium', 'On-Page SEO')
    else add('h1', 'pass', `H1: "${h1s.first().text().trim().substring(0, 55)}"`, 'High', 'On-Page SEO')

    const ogTitle = $('meta[property="og:title"]').attr('content') || ''
    if (!ogTitle) add('og', 'warning', 'Missing og:title — poor social media preview', 'Low', 'On-Page SEO')
    else add('og', 'pass', 'Open Graph (og:title) present', 'Low', 'On-Page SEO')

    const imgCount = $('img').length
    const imgNoAlt = $('img').filter((_, el) => { const a = $(el).attr('alt'); return a === undefined || a === '' }).length
    if (imgNoAlt > 0) add('img_alt', 'warning', `${imgNoAlt}/${imgCount} images missing alt text`, 'Medium', 'On-Page SEO')
    else if (imgCount > 0) add('img_alt', 'pass', `All ${imgCount} images have alt text`, 'Medium', 'On-Page SEO')

    const wordCount = $('body').text().replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).length
    if (wordCount < 300) add('content', 'error', `Very low word count: ~${wordCount} words (aim 500+)`, 'High', 'Content Quality')
    else if (wordCount < 700) add('content', 'warning', `Low word count: ~${wordCount} words`, 'Medium', 'Content Quality')
    else add('content', 'pass', `Good content volume: ~${wordCount} words`, 'Medium', 'Content Quality')

    const h2Count = $('h2').length
    if (h2Count === 0) add('structure', 'warning', 'No H2 subheadings — poor content hierarchy', 'Low', 'Content Quality')
    else add('structure', 'pass', `${h2Count} H2 subheadings — good structure`, 'Low', 'Content Quality')

    const canonical = $('link[rel="canonical"]').attr('href') || ''
    if (!canonical) add('canonical', 'warning', 'No canonical URL — risk of duplicate content', 'Medium', 'Technical SEO')
    else add('canonical', 'pass', `Canonical set`, 'High', 'Technical SEO')

    const viewport = $('meta[name="viewport"]').attr('content') || ''
    if (!viewport) add('viewport', 'error', 'Missing viewport meta — fails mobile-friendly test', 'High', 'Technical SEO')
    else add('viewport', 'pass', 'Viewport meta present (mobile-ready)', 'High', 'Technical SEO')

    const robotsContent = $('meta[name="robots"]').attr('content') || ''
    if (robotsContent.toLowerCase().includes('noindex'))
      add('robots', 'error', `Page set to noindex — Google won't index this`, 'High', 'Technical SEO')
    else add('robots', 'pass', 'Page is indexable', 'High', 'Technical SEO')

    const hasSchema = html.includes('"@context"') || html.includes("'@context'")
    if (!hasSchema) add('schema', 'warning', 'No JSON-LD structured data found', 'Medium', 'Technical SEO')
    else add('schema', 'pass', 'Structured data (JSON-LD) found', 'Medium', 'Technical SEO')

    if (!isHttps) add('https', 'error', 'Site is not served over HTTPS', 'High', 'Server & Security')
    else add('https', 'pass', 'Site served securely over HTTPS', 'High', 'Server & Security')

    if (responseTimeMs > 1800) add('ttfb', 'warning', `Slow server response: ${responseTimeMs}ms`, 'Medium', 'Server & Security')
    else add('ttfb', 'pass', `Server response time: ${responseTimeMs}ms`, 'Low', 'Server & Security')

    const errors = checks.filter(c => c.status === 'error').length
    const warnings = checks.filter(c => c.status === 'warning').length
    const score = Math.max(0, 100 - errors * 13 - warnings * 5)

    return res.status(200).json({ ok: true, url: auditUrl, score, checks, speed: null })

  } catch (err) {
    console.error('Public audit error:', err.message)
    return res.status(500).json({ ok: false, error: `Failed to audit: ${err.message}` })
  }
})

module.exports = router