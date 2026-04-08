const express = require('express')
const axios = require('axios')
const cheerio = require('cheerio')
const { pool, anthropic } = require('../clients')
const { auth, verifySite } = require('../middleware')

const router = express.Router()

router.post('/:siteId/audit/run', auth, verifySite, async (req, res) => {
  const { rows: s } = await pool.query('SELECT url FROM sites WHERE id=$1', [req.siteId])
  const url = s[0].url
  try {
    const crawlStartedAt = Date.now()
    const crawlRes = await axios.get(url, {
      timeout: 15000,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SEOAuditBot/1.0; +https://devndespro.com)' },
      maxRedirects: 5,
    })
    const html = typeof crawlRes.data === 'string' ? crawlRes.data : String(crawlRes.data || '')
    const $ = cheerio.load(html)
    const checks = []
    const add = (check, status, message, impact, category) =>
      checks.push({ check, status, message, impact, category })

    const finalUrl = crawlRes?.request?.res?.responseUrl || url
    const responseTimeMs = Date.now() - crawlStartedAt
    const statusCode = Number(crawlRes.status || 0)
    const headerLength = Number(crawlRes.headers?.['content-length'])
    const fileSizeBytes = Number.isFinite(headerLength) && headerLength > 0 ? headerLength : Buffer.byteLength(html, 'utf8')
    const language = ($('html').attr('lang') || '').trim() || null

    const rootHost = (() => {
      try { return new URL(finalUrl).hostname.toLowerCase().replace(/^www\./, '') } catch { return '' }
    })()
    const internalLinkSet = new Set()
    const externalLinkSet = new Set()

    $('a[href]').each((_, el) => {
      const href = String($(el).attr('href') || '').trim()
      if (!href) return
      if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return

      if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//')) {
        try {
          const absolute = href.startsWith('//') ? `https:${href}` : href
          const linkHost = new URL(absolute).hostname.toLowerCase().replace(/^www\./, '')
          if (rootHost && linkHost === rootHost) internalLinkSet.add(absolute)
          else externalLinkSet.add(absolute)
        } catch {
          // ignore malformed URLs
        }
        return
      }

      internalLinkSet.add(href)
    })
    const internalLinks = internalLinkSet.size
    const externalLinks = externalLinkSet.size

    const cssLinkCount = $('link[rel="stylesheet"]').length
    const blockingScriptCount = $('head script[src]:not([defer]):not([async])').length
    const renderBlockingCount = cssLinkCount + blockingScriptCount

    const imageEls = $('img')
    let legacyImageCount = 0
    imageEls.each((_, el) => {
      const src = String($(el).attr('src') || '').toLowerCase()
      const modernInPicture = $(el).closest('picture').find('source[type*="image/avif"], source[type*="image/webp"]').length > 0
      const isLegacy = /\.(png|jpe?g|gif)(\?|#|$)/.test(src)
      if (isLegacy && !modernInPicture) legacyImageCount += 1
    })

    const isHttps = /^https:\/\//i.test(finalUrl)

    const robots = { status: null, valid: null, issues: [], url: null }
    try {
      const origin = new URL(finalUrl).origin
      const robotsUrl = `${origin}/robots.txt`
      robots.url = robotsUrl
      const robotsRes = await axios.get(robotsUrl, {
        timeout: 12000,
        validateStatus: () => true,
      })
      robots.status = Number(robotsRes.status || 0)

      if (robotsRes.status >= 200 && robotsRes.status < 300) {
        const txt = typeof robotsRes.data === 'string' ? robotsRes.data : String(robotsRes.data || '')
        const knownDirectives = new Set([
          'user-agent', 'allow', 'disallow', 'sitemap', 'crawl-delay', 'host', 'clean-param', 'noindex',
        ])
        const lines = txt.split(/\r?\n/)

        lines.forEach((raw, idx) => {
          const line = String(raw || '').trim()
          if (!line || line.startsWith('#')) return
          const sep = line.indexOf(':')
          if (sep < 0) {
            robots.issues.push({ line: idx + 1, message: 'Line must use directive: value format', value: line })
            return
          }
          const directive = line.slice(0, sep).trim().toLowerCase()
          const value = line.slice(sep + 1).trim()
          if (!knownDirectives.has(directive)) {
            robots.issues.push({ line: idx + 1, message: `Unknown directive: ${directive}`, value })
          }
        })

        robots.valid = robots.issues.length === 0
      } else {
        robots.valid = false
        robots.issues.push({ line: 0, message: `robots.txt returned HTTP ${robotsRes.status}` })
      }
    } catch (e) {
      robots.valid = false
      robots.issues.push({ line: 0, message: `Unable to fetch robots.txt: ${e.message}` })
    }

    // On-Page
    const title = $('title').text().trim()
    if (!title) add('title', 'error', 'Missing <title> tag', 'High', 'On-Page SEO')
    else if (title.length < 30) add('title', 'warning', `Title too short: "${title.substring(0,50)}" — ${title.length} chars (aim 50-60)`, 'Medium', 'On-Page SEO')
    else if (title.length > 60) add('title', 'warning', `Title too long: ${title.length} chars — may be truncated in SERPs`, 'Medium', 'On-Page SEO')
    else add('title', 'pass', `Title OK: "${title.substring(0,55)}"`, 'High', 'On-Page SEO')

    const metaDesc = $('meta[name="description"]').attr('content') || ''
    if (!metaDesc) add('meta_desc', 'error', 'Missing meta description', 'High', 'On-Page SEO')
    else if (metaDesc.length < 100) add('meta_desc', 'warning', `Meta description too short: ${metaDesc.length} chars (aim 150-160)`, 'Medium', 'On-Page SEO')
    else if (metaDesc.length > 160) add('meta_desc', 'warning', `Meta description too long: ${metaDesc.length} chars (trim to 160)`, 'Low', 'On-Page SEO')
    else add('meta_desc', 'pass', 'Meta description: good length', 'High', 'On-Page SEO')

    const h1s = $('h1')
    if (h1s.length === 0) add('h1', 'error', 'No H1 heading found on page', 'High', 'On-Page SEO')
    else if (h1s.length > 1) add('h1', 'warning', `${h1s.length} H1 tags found — keep only one`, 'Medium', 'On-Page SEO')
    else add('h1', 'pass', `H1: "${h1s.first().text().trim().substring(0,55)}"`, 'High', 'On-Page SEO')

    const ogTitle = $('meta[property="og:title"]').attr('content') || ''
    if (!ogTitle) add('og', 'warning', 'Missing og:title — poor social media preview', 'Low', 'On-Page SEO')
    else add('og', 'pass', 'Open Graph (og:title) present', 'Low', 'On-Page SEO')

    const imgCount = $('img').length
    const imgNoAlt = $('img').filter((_, el) => { const a = $(el).attr('alt'); return a === undefined || a === '' }).length
    if (imgNoAlt > 0) add('img_alt', 'warning', `${imgNoAlt}/${imgCount} images missing alt text`, 'Medium', 'On-Page SEO')
    else if (imgCount > 0) add('img_alt', 'pass', `All ${imgCount} images have alt text`, 'Medium', 'On-Page SEO')

    // Content
    const wordCount = $('body').text().replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).length
    if (wordCount < 300) add('content', 'error', `Very low word count: ~${wordCount} words (aim 500+)`, 'High', 'Content Quality')
    else if (wordCount < 700) add('content', 'warning', `Low word count: ~${wordCount} words (aim 800+ for ranking)`, 'Medium', 'Content Quality')
    else add('content', 'pass', `Good content volume: ~${wordCount} words`, 'Medium', 'Content Quality')

    const h2Count = $('h2').length
    if (h2Count === 0) add('structure', 'warning', 'No H2 subheadings — poor content hierarchy', 'Low', 'Content Quality')
    else add('structure', 'pass', `${h2Count} H2 subheadings — good structure`, 'Low', 'Content Quality')

    // Technical
    const canonical = $('link[rel="canonical"]').attr('href') || ''
    if (!canonical) add('canonical', 'warning', 'No canonical URL — risk of duplicate content', 'Medium', 'Technical SEO')
    else add('canonical', 'pass', `Canonical: ${canonical.substring(0,60)}`, 'High', 'Technical SEO')

    const viewport = $('meta[name="viewport"]').attr('content') || ''
    if (!viewport) add('viewport', 'error', 'Missing viewport meta — fails mobile-friendly test', 'High', 'Technical SEO')
    else add('viewport', 'pass', 'Viewport meta present (mobile-ready)', 'High', 'Technical SEO')

    const robotsContent = $('meta[name="robots"]').attr('content') || ''
    if (robotsContent.toLowerCase().includes('noindex'))
      add('robots', 'error', `Page set to noindex: "${robotsContent}" — Google won't index this`, 'High', 'Technical SEO')
    else add('robots', 'pass', 'Page is indexable', 'High', 'Technical SEO')

    const hasSchema = html.includes('"@context"') || html.includes("'@context'")
    if (!hasSchema) add('schema', 'warning', 'No JSON-LD structured data — missing rich result eligibility', 'Medium', 'Technical SEO')
    else add('schema', 'pass', 'Structured data (JSON-LD) found', 'Medium', 'Technical SEO')

    if (!isHttps) add('https', 'error', 'Site is not served over HTTPS', 'High', 'Server & Security')
    else add('https', 'pass', 'Site is served securely over HTTPS', 'High', 'Server & Security')

    if (renderBlockingCount >= 5) add('render_blocking', 'error', `High render-blocking resources in critical path: ${renderBlockingCount}`, 'High', 'Page Speed')
    else if (renderBlockingCount >= 3) add('render_blocking', 'warning', `Some render-blocking resources found: ${renderBlockingCount}`, 'Medium', 'Page Speed')
    else add('render_blocking', 'pass', `Render-blocking resources are under control: ${renderBlockingCount}`, 'Medium', 'Page Speed')

    if (legacyImageCount > 0) add('modern_images', 'warning', `${legacyImageCount} images appear to use legacy formats without modern alternatives (WebP/AVIF)`, 'Medium', 'Page Speed')
    else add('modern_images', 'pass', 'Images use modern formats or provide modern fallbacks', 'Low', 'Page Speed')

    if (responseTimeMs > 1800) add('ttfb_proxy', 'warning', `Slow server response observed: ${responseTimeMs}ms`, 'Medium', 'Server & Security')
    else add('ttfb_proxy', 'pass', `Server response time looks healthy: ${responseTimeMs}ms`, 'Low', 'Server & Security')

    if (internalLinks < 3) add('internal_links', 'warning', `Very few internal links found: ${internalLinks} (aim 5+)`, 'Medium', 'On-Page SEO')
    else add('internal_links', 'pass', `Internal link structure looks good: ${internalLinks} links`, 'Low', 'On-Page SEO')

    if (externalLinks === 0) add('external_links', 'warning', 'No external links found on this page', 'Low', 'On-Page SEO')
    else add('external_links', 'pass', `External links found: ${externalLinks}`, 'Low', 'On-Page SEO')

    if (robots.valid === true) {
      add('robots_txt', 'pass', 'robots.txt is valid and crawl directives look well-formed', 'Medium', 'Advanced SEO')
    } else {
      const first = robots.issues[0]
      const detail = first ? ` (line ${first.line || 'n/a'}: ${first.message})` : ''
      add('robots_txt', 'warning', `robots.txt has formatting issues${detail}`, 'Medium', 'Advanced SEO')
    }

    try {
      const missingPath = `${url.replace(/\/$/, '')}/this-page-should-not-exist-seo-audit-${Date.now()}`
      const notFoundRes = await axios.get(missingPath, {
        timeout: 12000,
        maxRedirects: 5,
        validateStatus: () => true,
      })
      if (notFoundRes.status === 404) add('custom_404', 'pass', '404 handling works (missing pages return HTTP 404)', 'Medium', 'Advanced SEO')
      else add('custom_404', 'warning', `Missing pages returned HTTP ${notFoundRes.status} instead of 404`, 'Medium', 'Advanced SEO')
    } catch {
      add('custom_404', 'warning', 'Unable to validate custom 404 behavior', 'Low', 'Advanced SEO')
    }

    const errors = checks.filter(c => c.status === 'error').length
    const warnings = checks.filter(c => c.status === 'warning').length
    const score = Math.max(0, 100 - errors * 13 - warnings * 5)

    let speed = null
    if (process.env.PAGESPEED_API_KEY) {
      try {
        const { data: ps } = await axios.get(
          `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&key=${process.env.PAGESPEED_API_KEY}&strategy=mobile`,
          { timeout: 30000 }
        )
        const lh = ps.lighthouseResult
        speed = {
          performance: Math.round((lh?.categories?.performance?.score || 0) * 100),
          lcp: lh?.audits?.['largest-contentful-paint']?.displayValue || null,
          cls: lh?.audits?.['cumulative-layout-shift']?.displayValue || null,
          tbt: lh?.audits?.['total-blocking-time']?.displayValue || null,
        }
        const p = speed.performance
        if (p < 50) checks.push({ check: 'perf', status: 'error', message: `Mobile PageSpeed very low: ${p}/100`, impact: 'High', category: 'Page Speed' })
        else if (p < 80) checks.push({ check: 'perf', status: 'warning', message: `Mobile PageSpeed needs work: ${p}/100`, impact: 'Medium', category: 'Page Speed' })
        else checks.push({ check: 'perf', status: 'pass', message: `Mobile PageSpeed good: ${p}/100`, impact: 'Medium', category: 'Page Speed' })
      } catch (e) { console.log('PageSpeed API failed:', e.message) }
    }

    const result = {
      checks,
      score,
      speed,
      scannedAt: new Date().toISOString(),
      url,
      crawl: {
        finalUrl,
        statusCode,
        responseTimeMs,
        fileSizeBytes,
        language,
        wordCount,
        internalLinks,
        externalLinks,
        robots,
      },
    }
    await pool.query('INSERT INTO audit_results (site_id, results, score) VALUES ($1,$2,$3)', [req.siteId, JSON.stringify(result), score])
    await pool.query('INSERT INTO seo_metrics (site_id, health) VALUES ($1,$2) ON CONFLICT (site_id) DO UPDATE SET health=$2, updated_at=NOW()', [req.siteId, score])
    for (const c of checks.filter(x => x.status === 'error')) {
      await pool.query('INSERT INTO alerts (site_id, type, message, severity) VALUES ($1,$2,$3,$4)', [req.siteId, 'audit', c.message, 'error'])
    }
    res.json(result)
  } catch (e) {
    console.error('Audit error:', e.message)
    res.status(500).json({ error: `Failed to crawl ${url}: ${e.message}` })
  }
})

router.get('/:siteId/audit/latest', auth, verifySite, async (req, res) => {
  const { rows } = await pool.query('SELECT results, score, created_at FROM audit_results WHERE site_id=$1 ORDER BY created_at DESC LIMIT 1', [req.siteId])
  if (!rows[0]) return res.json(null)
  res.json({ ...rows[0].results, score: rows[0].score, scannedAt: rows[0].created_at })
})

router.post('/:siteId/audit/ai-fix', auth, verifySite, async (req, res) => {
  const { issue, siteUrl } = req.body
  if (!issue || !siteUrl) return res.status(400).json({ error: 'issue and siteUrl required' })
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: `You are an expert SEO engineer. Given an SEO issue, provide:
1. A 1-sentence plain-English explanation of WHY it matters for rankings
2. The EXACT fix — specific code, copy, or action steps
3. A "Before" and "After" example if applicable
4. Estimated time to fix

Respond in JSON only, no markdown:
{
  "why": "...",
  "fix": "...",
  "before": "...",
  "after": "...",
  "timeToFix": "...",
  "priorityNote": "..."
}`,
      messages: [{
        role: 'user',
        content: `Site: ${siteUrl}\nIssue: ${issue.message}\nCategory: ${issue.category}\nImpact: ${issue.impact}\nStatus: ${issue.status}`
      }]
    })
    const text = response.content?.[0]?.text || '{}'
    try { res.json(JSON.parse(text)) } catch { res.json({ fix: text }) }
  } catch (e) { console.error(e); res.status(500).json({ error: 'AI error' }) }
})

module.exports = router
