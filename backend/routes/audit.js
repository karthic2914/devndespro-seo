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
    else if (title.length < 30) add('title', 'warning', `Title too short: "${title.substring(0,50)}" - ${title.length} chars (aim 50-60)`, 'Medium', 'On-Page SEO')
    else if (title.length > 60) add('title', 'warning', `Title too long: ${title.length} chars - may be truncated in SERPs`, 'Medium', 'On-Page SEO')
    else add('title', 'pass', `Title OK: "${title.substring(0,55)}"`, 'High', 'On-Page SEO')

    const metaDesc = $('meta[name="description"]').attr('content') || ''
    if (!metaDesc) add('meta_desc', 'error', 'Missing meta description', 'High', 'On-Page SEO')
    else if (metaDesc.length < 100) add('meta_desc', 'warning', `Meta description too short: ${metaDesc.length} chars (aim 150-160)`, 'Medium', 'On-Page SEO')
    else if (metaDesc.length > 160) add('meta_desc', 'warning', `Meta description too long: ${metaDesc.length} chars (trim to 160)`, 'Low', 'On-Page SEO')
    else add('meta_desc', 'pass', 'Meta description: good length', 'High', 'On-Page SEO')

    const h1s = $('h1')
    if (h1s.length === 0) add('h1', 'error', 'No H1 heading found on page', 'High', 'On-Page SEO')
    else if (h1s.length > 1) add('h1', 'warning', `${h1s.length} H1 tags found - keep only one`, 'Medium', 'On-Page SEO')
    else add('h1', 'pass', `H1: "${h1s.first().text().trim().substring(0,55)}"`, 'High', 'On-Page SEO')

    const ogTitle = $('meta[property="og:title"]').attr('content') || ''
    if (!ogTitle) add('og', 'warning', 'Missing og:title - poor social media preview', 'Low', 'On-Page SEO')
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
    if (h2Count === 0) add('structure', 'warning', 'No H2 subheadings - poor content hierarchy', 'Low', 'Content Quality')
    else add('structure', 'pass', `${h2Count} H2 subheadings - good structure`, 'Low', 'Content Quality')

    // Technical
    const canonical = $('link[rel="canonical"]').attr('href') || ''
    if (!canonical) add('canonical', 'warning', 'No canonical URL - risk of duplicate content', 'Medium', 'Technical SEO')
    else add('canonical', 'pass', `Canonical: ${canonical.substring(0,60)}`, 'High', 'Technical SEO')

    const viewport = $('meta[name="viewport"]').attr('content') || ''
    if (!viewport) add('viewport', 'error', 'Missing viewport meta - fails mobile-friendly test', 'High', 'Technical SEO')
    else add('viewport', 'pass', 'Viewport meta present (mobile-ready)', 'High', 'Technical SEO')

    const robotsContent = $('meta[name="robots"]').attr('content') || ''
    if (robotsContent.toLowerCase().includes('noindex'))
      add('robots', 'error', `Page set to noindex: "${robotsContent}" - Google won't index this`, 'High', 'Technical SEO')
    else add('robots', 'pass', 'Page is indexable', 'High', 'Technical SEO')

    const hasSchema = html.includes('"@context"') || html.includes("'@context'")
    if (!hasSchema) add('schema', 'warning', 'No JSON-LD structured data - missing rich result eligibility', 'Medium', 'Technical SEO')
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


    // -- AEO (Answer Engine Optimization) -------------------------------------
    // 1. FAQ Schema
    const faqSchema = html.includes('"FAQPage"') || html.includes("'FAQPage'")
    if (!faqSchema) add('snippet_faq_schema', 'warning', 'No FAQPage schema - add FAQ JSON-LD to appear in AI answer boxes', 'High', 'AI Snippet')
    else add('snippet_faq_schema', 'pass', 'FAQPage schema found - eligible for AI answer features', 'High', 'AI Snippet')

    // 2. HowTo Schema
    const howtoSchema = html.includes('"HowTo"') || html.includes("'HowTo'")
    if (!howtoSchema) add('snippet_howto_schema', 'warning', 'No HowTo schema - add HowTo JSON-LD for step-by-step AI answers', 'Medium', 'AI Snippet')
    else add('snippet_howto_schema', 'pass', 'HowTo schema found - eligible for step-by-step rich results', 'Medium', 'AI Snippet')

    // 3. Article / BlogPosting Schema
    const articleSchema = html.includes('"Article"') || html.includes('"BlogPosting"') || html.includes('"NewsArticle"')
    if (!articleSchema) add('snippet_article_schema', 'warning', 'No Article/BlogPosting schema - AI engines prefer structured content', 'Medium', 'AI Snippet')
    else add('snippet_article_schema', 'pass', 'Article schema found - content is well-structured for AI engines', 'Medium', 'AI Snippet')

    // 4. Speakable Schema
    const speakableSchema = html.includes('"speakable"') || html.includes("'speakable'")
    if (!speakableSchema) add('snippet_speakable', 'warning', 'No Speakable schema - add speakable property for voice search & AI assistants', 'Low', 'AI Snippet')
    else add('snippet_speakable', 'pass', 'Speakable schema found - content is voice search ready', 'Low', 'AI Snippet')

    // 5. Question-based headings
    const questionWords = /^(what|how|why|when|which|can|is|are|does|who|where)\b/i
    const h2h3texts = []
    $('h2, h3').each((_, el) => h2h3texts.push($(el).text().trim()))
    const questionHeadings = h2h3texts.filter(t => questionWords.test(t))
    if (questionHeadings.length === 0) add('snippet_question_headings', 'warning', 'No question-based H2/H3 headings - AI engines extract Q&A from structured headings', 'High', 'AI Snippet')
    else if (questionHeadings.length < 2) add('snippet_question_headings', 'warning', `Only ${questionHeadings.length} question-based heading found - aim for 2+ to improve AI answer coverage`, 'Medium', 'AI Snippet')
    else add('snippet_question_headings', 'pass', `${questionHeadings.length} question-based headings found - good for AI answer extraction`, 'High', 'AI Snippet')

    // 6. Featured snippet readiness
    let snippetReady = false
    $('h2, h3').each((_, el) => {
      const next = $(el).next('p')
      if (next.length) {
        const words = next.text().trim().split(/\s+/).filter(Boolean).length
        if (words >= 40 && words <= 80) { snippetReady = true; return false }
      }
    })
    if (!snippetReady) add('snippet_ready', 'warning', 'No concise answer paragraphs (40-80 words) after headings - add direct answers for featured snippets', 'High', 'AI Snippet')
    else add('snippet_ready', 'pass', 'Concise answer paragraphs found after headings - featured snippet ready', 'High', 'AI Snippet')

    // 7. Entity clarity
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim()
    const first100Words = bodyText.split(/\s+/).slice(0, 100).join(' ').toLowerCase()
    const hasEntitySignals = ['service', 'solution', 'company', 'agency', 'studio', 'platform', 'tool', 'software', 'app', 'consulting'].some(w => first100Words.includes(w))
    if (!hasEntitySignals) add('snippet_entity_clarity', 'warning', 'Entity type not clear in first 100 words - state what your business does early for AI comprehension', 'High', 'AI Snippet')
    else add('snippet_entity_clarity', 'pass', 'Entity type is clear in first 100 words - good for AI brand understanding', 'High', 'AI Snippet')

    // 8. Concise answer density
    let shortAnswerCount = 0
    $('p').each((_, el) => {
      const words = $(el).text().trim().split(/\s+/).filter(Boolean).length
      if (words >= 20 && words <= 60) shortAnswerCount++
    })
    if (shortAnswerCount < 2) add('snippet_answer_density', 'warning', `Only ${shortAnswerCount} concise answer paragraphs (20-60 words) found - add more direct answer blocks`, 'Medium', 'AI Snippet')
    else add('snippet_answer_density', 'pass', `${shortAnswerCount} concise answer paragraphs found - good answer density for AI engines`, 'Medium', 'AI Snippet')


    // -- AEO (True Answer Engine Optimization) --------------------------------

    // 1. Author Entity
    const hasAuthorSchema = html.includes('"author"') || html.includes("'author'")
    const hasAuthorByline = /\b(by|written by|author:)\s+[A-Z][a-z]+/i.test($('body').text())
    if (hasAuthorSchema) add('aeo_author_entity', 'pass', 'Author entity found in schema - AI engines can attribute content correctly', 'High', 'AEO')
    else if (hasAuthorByline) add('aeo_author_entity', 'warning', 'Author byline found but no author schema - add author JSON-LD for better AI attribution', 'High', 'AEO')
    else add('aeo_author_entity', 'error', 'No author entity found - AI engines cannot attribute this content, reducing citation likelihood', 'High', 'AEO')

    // 2. E-E-A-T Signals
    const pageText = $('body').text().toLowerCase()
    const allLinks = []
    $('a[href]').each((_, el) => allLinks.push($(el).attr('href') || ''))
    const eatSignals = [
      allLinks.some(h => /\/(about|about-us|our-story|who-we-are)/.test(h)),
      allLinks.some(h => /\/(team|our-team|people|staff|founders)/.test(h)),
      allLinks.some(h => /\/(contact|contact-us)/.test(h)),
      /certif|accredit|award|recogni|member of|associat/i.test(pageText),
      /\d+\s*\+?\s*years?\s*(of\s*)?(experience|expertise)/i.test(pageText),
    ]
    const eatCount = eatSignals.filter(Boolean).length
    if (eatCount >= 3) add('aeo_eeat', 'pass', eatCount + ' E-E-A-T signals found - strong authority for AI citation', 'High', 'AEO')
    else if (eatCount >= 1) add('aeo_eeat', 'warning', 'Only ' + eatCount + ' E-E-A-T signal(s) found - add About, Team pages and credentials', 'High', 'AEO')
    else add('aeo_eeat', 'error', 'No E-E-A-T signals found - AI engines will not trust or cite this content', 'High', 'AEO')

    // 3. Bing Indexing
    try {
      const bingDomain = new URL(url).hostname
      const bingUrl = 'https://www.bing.com/search?q=site:' + bingDomain + '&count=1'
      const bingRes = await axios.get(bingUrl, { timeout: 8000, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DevndeSproBot/1.0)' } })
      const bingHtml = bingRes.data
      const noResults = /no results|There are no results/i.test(bingHtml)
      const countMatch = bingHtml.match(/[\d,]+ results/)
      const resultCount = countMatch ? parseInt(countMatch[0].replace(/[^0-9]/g, '')) : 0
      if (noResults || resultCount === 0) add('aeo_bing_index', 'error', 'Site not indexed on Bing - ChatGPT uses Bing; fix this to improve AI citation chances', 'High', 'AEO')
      else if (resultCount < 10) add('aeo_bing_index', 'warning', 'Only ' + resultCount + ' page(s) indexed on Bing - submit sitemap to Bing Webmaster Tools', 'Medium', 'AEO')
      else add('aeo_bing_index', 'pass', resultCount + '+ pages indexed on Bing - good coverage for ChatGPT and AI search engines', 'High', 'AEO')
    } catch (e) {
      add('aeo_bing_index', 'warning', 'Could not check Bing indexing - verify manually at bing.com/webmaster', 'Medium', 'AEO')
    }

    // 4. Reddit Presence
    try {
      const redditDomain = new URL(url).hostname
      const redditUrl = 'https://www.reddit.com/search.json?q=site:' + redditDomain + '&limit=10'
      const redditRes = await axios.get(redditUrl, { timeout: 8000, headers: { 'User-Agent': 'DevndeSproBot/1.0' } })
      const redditCount = redditRes.data?.data?.dist || 0
      if (redditCount >= 3) add('aeo_reddit', 'pass', redditCount + ' Reddit mentions found - strong community signal for AI citation', 'High', 'AEO')
      else if (redditCount >= 1) add('aeo_reddit', 'warning', 'Only ' + redditCount + ' Reddit mention(s) found - more community discussion improves AI citation chances', 'Medium', 'AEO')
      else add('aeo_reddit', 'error', 'No Reddit mentions found - AI engines like Perplexity heavily use Reddit as a citation source', 'High', 'AEO')
    } catch (e) {
      add('aeo_reddit', 'warning', 'Could not check Reddit presence - verify manually at reddit.com/search', 'Medium', 'AEO')
    }

    // 5. External Citations (outbound links to authoritative domains)
    const authDomains = ['wikipedia.org', 'gov', 'edu', 'forbes.com', 'bbc.com', 'reuters.com', 'techcrunch.com', 'wired.com', 'medium.com', 'linkedin.com', 'web.dev', 'google.com', 'w3.org', 'mdn.web.docs', 'developer.mozilla.org']
    const extLinks = []
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || ''
      if (href.startsWith('http') && !href.includes(new URL(url).hostname)) extLinks.push(href)
    })
    const authLinks = extLinks.filter(h => authDomains.some(d => h.includes(d)))
    if (authLinks.length >= 3) add('aeo_citations', 'pass', authLinks.length + ' authoritative outbound links found - good citation signals for AI engines', 'Medium', 'AEO')
    else if (authLinks.length >= 1) add('aeo_citations', 'warning', 'Only ' + authLinks.length + ' authoritative outbound link(s) - link to more trusted sources to improve AI credibility', 'Medium', 'AEO')
    else add('aeo_citations', 'error', 'No authoritative outbound links found - linking to trusted sources signals credibility to AI engines', 'Medium', 'AEO')

    // 6. Review Platform Presence
    try {
      const reviewDomain = new URL(url).hostname.replace('www.', '')
      const reviewPlatforms = [
        'https://www.trustpilot.com/review/' + reviewDomain,
        'https://www.g2.com/products/' + reviewDomain,
      ]
      const reviewResults = await Promise.allSettled(
        reviewPlatforms.map(u => axios.get(u, { timeout: 5000, headers: { 'User-Agent': 'Mozilla/5.0' }, maxRedirects: 3 }))
      )
      const found = reviewResults.filter(r => r.status === 'fulfilled' && r.value.status === 200).length
      if (found >= 2) add('aeo_reviews', 'pass', 'Listed on ' + found + ' review platforms - strong trust signal for AI citation', 'High', 'AEO')
      else if (found === 1) add('aeo_reviews', 'warning', 'Listed on 1 review platform - get listed on Trustpilot and G2 to improve AI trust signals', 'High', 'AEO')
      else add('aeo_reviews', 'error', 'Not found on major review platforms (Trustpilot, G2) - AI engines use reviews as trust signals', 'High', 'AEO')
    } catch (e) {
      add('aeo_reviews', 'warning', 'Could not check review platform listings - verify manually on Trustpilot and G2', 'Medium', 'AEO')
    }
    const seoChecks = checks.filter(c => c.category !== 'AI Snippet' && c.category !== 'AEO')
    const errors = seoChecks.filter(c => c.status === 'error').length
    const warnings = seoChecks.filter(c => c.status === 'warning').length
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
    const aeoChecksAll = checks.filter(c => c.category === 'AI Snippet')
    const trueAeoChecks = checks.filter(c => c.category === 'AEO')
    const aeoScore = trueAeoChecks.length ? Math.round(trueAeoChecks.reduce((s, i) => s + (i.status === 'pass' ? 100 : i.status === 'warning' ? 55 : 15), 0) / trueAeoChecks.length) : 100
    const aiSnippetScore = aeoChecksAll.length ? Math.round(aeoChecksAll.reduce((s, i) => s + (i.status === 'pass' ? 100 : i.status === 'warning' ? 55 : 15), 0) / aeoChecksAll.length) : 100
    await pool.query('INSERT INTO seo_metrics (site_id, health, ai_snippet_score, aeo_score) VALUES ($1,$2,$3,$4) ON CONFLICT (site_id) DO UPDATE SET health=$2, ai_snippet_score=$3, aeo_score=$4, updated_at=NOW()', [req.siteId, score, aiSnippetScore, aeoScore])
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
  const { rows } = await pool.query(
    'SELECT ar.results, ar.score, ar.created_at, sm.chatgpt_cited, sm.claude_cited FROM audit_results ar LEFT JOIN seo_metrics sm ON sm.site_id = ar.site_id WHERE ar.site_id=$1 ORDER BY ar.created_at DESC LIMIT 1',
    [req.siteId]
  )
  if (!rows[0]) return res.json(null)
  res.json({ ...rows[0].results, score: rows[0].score, scannedAt: rows[0].created_at, chatgptScore: rows[0].chatgpt_cited, claudeScore: rows[0].claude_cited })
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
2. The EXACT fix - specific code, copy, or action steps
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


// AI Visibility - ChatGPT Citation Check
router.post('/:siteId/ai-visibility/test', auth, verifySite, async (req, res) => {
  const { queries } = req.body
  if (!Array.isArray(queries) || queries.length === 0) return res.status(400).json({ error: 'queries required' })
  const { rows: s } = await pool.query('SELECT url FROM sites WHERE id=$1', [req.siteId])
  const siteUrl = s[0]?.url || ''
  const domain = (() => { try { return new URL(siteUrl).hostname.replace('www.', '') } catch { return siteUrl } })()
  const { OpenAI } = require('openai')
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const results = []
  for (const query of queries.slice(0, 5)) {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: query }],
        max_tokens: 500,
      })
      const response = completion.choices[0]?.message?.content || ''
      const cited = response.toLowerCase().includes(domain.toLowerCase())
      const lines = response.split('\n').filter(l => l.toLowerCase().includes(domain.toLowerCase()))
      const excerpt = lines[0] || response.slice(0, 200)
      results.push({ query, response, cited, excerpt, domain })
    } catch (e) {
      results.push({ query, response: '', cited: false, excerpt: '', error: e.message, domain })
    }
  }
  await pool.query('INSERT INTO ai_visibility_tests (site_id, results, created_at) VALUES ($1,$2,NOW())', [req.siteId, JSON.stringify(results)]).catch(() => {})
  const citedCount = results.filter(r => r.cited).length
  const chatgptScore = results.length > 0 ? Math.round((citedCount / results.length) * 100) : 0
  await pool.query('INSERT INTO seo_metrics (site_id, chatgpt_cited) VALUES ($1,$2) ON CONFLICT (site_id) DO UPDATE SET chatgpt_cited=$2', [req.siteId, chatgptScore]).catch(() => {})
  res.json({ results, domain })
})

router.get('/:siteId/ai-visibility/history', auth, verifySite, async (req, res) => {
  const { rows } = await pool.query('SELECT id, results, created_at FROM ai_visibility_tests WHERE site_id=$1 ORDER BY created_at DESC LIMIT 10', [req.siteId])
  res.json(rows)
})


// AI Visibility Share
router.get('/:siteId/ai-visibility/share', auth, verifySite, async (req, res) => {
  const crypto = require('crypto')
  const { rows } = await pool.query('SELECT token FROM ai_visibility_shares WHERE site_id=$1', [req.siteId])
  if (rows.length > 0) return res.json({ token: rows[0].token })
  const token = crypto.randomBytes(32).toString('hex')
  await pool.query('INSERT INTO ai_visibility_shares (site_id, token) VALUES ($1,$2)', [req.siteId, token])
  res.json({ token })
})

router.get('/public/ai-visibility/:token', async (req, res) => {
  const { token } = req.params
  const { rows } = await pool.query(
    'SELECT s.url, s.name, avt.results, avt.created_at, sm.chatgpt_cited FROM ai_visibility_shares sh JOIN sites s ON s.id = sh.site_id LEFT JOIN ai_visibility_tests avt ON avt.site_id = sh.site_id LEFT JOIN seo_metrics sm ON sm.site_id = sh.site_id WHERE sh.token=$1 ORDER BY avt.created_at DESC LIMIT 1',
    [token]
  )
  if (!rows.length) return res.status(404).json({ error: 'Not found' })
  res.json(rows[0])
})


// AI Visibility - Claude Citation Check
router.post('/:siteId/ai-visibility/test-claude', auth, verifySite, async (req, res) => {
  const { queries } = req.body
  if (!Array.isArray(queries) || queries.length === 0) return res.status(400).json({ error: 'queries required' })
  const { rows: s } = await pool.query('SELECT url FROM sites WHERE id=$1', [req.siteId])
  const siteUrl = s[0]?.url || ''
  const domain = (() => { try { return new URL(siteUrl).hostname.replace('www.', '') } catch { return siteUrl } })()
  const results = []
  for (const query of queries.slice(0, 5)) {
    try {
      const msg = await anthropic.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 500,
        messages: [{ role: 'user', content: query }],
      })
      const response = msg.content[0]?.text || ''
      const brandName = domain.split('.')[0].toLowerCase()
      const cited = response.toLowerCase().includes(domain.toLowerCase()) || response.toLowerCase().includes(brandName)
      const lines = response.split('\n').filter(l => l.toLowerCase().includes(domain.toLowerCase()) || l.toLowerCase().includes(brandName))
      const excerpt = lines[0] || response.slice(0, 200)
      results.push({ query, response, cited, excerpt, domain })
    } catch (e) {
      results.push({ query, response: '', cited: false, excerpt: '', error: e.message, domain })
    }
  }
  const citedCount = results.filter(r => r.cited).length
  const claudeScore = results.length > 0 ? Math.round((citedCount / results.length) * 100) : 0
  await pool.query('INSERT INTO seo_metrics (site_id, claude_cited) VALUES ($1,$2) ON CONFLICT (site_id) DO UPDATE SET claude_cited=$2', [req.siteId, claudeScore]).catch(() => {})
  await pool.query('INSERT INTO ai_visibility_tests (site_id, results, created_at) VALUES ($1,$2,NOW())', [req.siteId, JSON.stringify(results)]).catch(() => {})
  res.json({ results, domain, score: claudeScore })
})


// AI Visibility - Get site-specific improvement tips from last audit
router.get('/:siteId/ai-visibility/improvements', auth, verifySite, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT results FROM audit_results WHERE site_id=$1 ORDER BY id DESC LIMIT 1',
    [req.siteId]
  )
  if (!rows.length) return res.json({ tips: [] })
  const rawChecks = rows[0].results || []
  const checks = Array.isArray(rawChecks) ? rawChecks : (typeof rawChecks === 'string' ? JSON.parse(rawChecks) : [])
  const failing = checks.filter(c =>
    (c.category === 'AEO' || c.category === 'AI Snippet') &&
    (c.status === 'error' || c.status === 'warning')
  ).sort((a, b) => {
    const order = { error: 0, warning: 1 }
    const pri = { High: 0, Medium: 1, Low: 2 }
    return (order[a.status] - order[b.status]) || (pri[a.impact] - pri[b.impact])
  }).slice(0, 6)
  const tips = failing.map(c => ({
    title: c.check.replace(/_/g, ' ').replace(/aeo |snippet /, ''),
    message: c.message,
    priority: c.impact || 'Medium',
    status: c.status,
    category: c.category,
  }))
  res.json({ tips })
})


// AI Visibility - Claude site analysis for specific recommendations
router.post('/:siteId/ai-visibility/analyse', auth, verifySite, async (req, res) => {
  try {
    const { engine = 'Claude' } = req.body
  const { rows: s } = await pool.query('SELECT url, name FROM sites WHERE id=$1', [req.siteId])
    if (!s.length) return res.status(404).json({ error: 'Site not found' })
    const siteUrl = s[0].url
    const siteName = s[0].name || siteUrl

    // Get last audit checks
    const { rows: ar } = await pool.query(
      'SELECT results FROM audit_results WHERE site_id=$1 ORDER BY id DESC LIMIT 1',
      [req.siteId]
    )
    const rawResults = ar[0]?.results || {}

    let checks = []
    if (Array.isArray(rawResults)) {
      checks = rawResults
    } else if (typeof rawResults === 'string') {
      const parsed = JSON.parse(rawResults)
      checks = Array.isArray(parsed) ? parsed : (parsed?.checks || [])
    } else {
      checks = rawResults?.checks || []
    }

    const failingChecks = checks
      .filter(c =>
        c &&
        typeof c === 'object' &&
        (c.status === 'error' || c.status === 'warning')
      )
      .map(c => `${String(c.status || '').toUpperCase()} [${c.category || 'General'}] ${c.check || 'check'}: ${c.message || ''}`)
      .join('\n')

    // Crawl the site
    let html = ''
    try {
      const crawlRes = await axios.get(siteUrl, {
        timeout: 10000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DevndeSproBot/1.0)' },
        maxRedirects: 5,
      })
      html = crawlRes.data || ''
    } catch (crawlErr) {
      html = ''
    }
    const $ = require('cheerio').load(html)
    const title = $('title').text().trim().slice(0, 100)
    const metaDesc = $('meta[name="description"]').attr('content') || ''
    const h1 = $('h1').first().text().trim().slice(0, 200)
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 2000)

    const prompt = `You are an AI visibility expert. Analyze this website and give 5 SPECIFIC, ACTIONABLE recommendations to help it get cited by ChatGPT, Claude, Perplexity and other AI engines.

Website: ${siteName} (${siteUrl})
Title: ${title}
Meta description: ${metaDesc}
H1: ${h1}
Page content excerpt: ${bodyText}

Current audit issues found:
${failingChecks || 'No issues found'}

Give exactly 5 recommendations. For each:
- Be specific to THIS website (mention their actual content, services, or industry)
- Explain exactly what to do and why it helps AI citation
- Keep each recommendation under 60 words

Format as JSON array: [{"title": "...", "action": "...", "priority": "High|Medium|Low"}]
Return ONLY the JSON array, no other text.`

        let recommendations = [], gptRecommendations = []

    if (engine === 'Claude' || engine === 'Both') {
      const msg = await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      })
      const text = msg.content[0]?.text || '[]'
      const clean = text.split('`').filter(s => !s.startsWith('json')).join('').trim()
      try {
        const start = clean.indexOf('[')
        const end = clean.lastIndexOf(']')
        recommendations = JSON.parse(start >= 0 ? clean.slice(start, end + 1) : clean)
      } catch {
        recommendations = [{
          title: 'Improve AI visibility basics',
          action: 'Add clear service pages, FAQ schema, author details, and trusted external references so AI engines can understand and cite this website.',
          priority: 'High'
        }]
      }
    }

    if (engine === 'ChatGPT' || engine === 'Both') {
      const { OpenAI } = require('openai')
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      })
      const gptText = completion.choices[0]?.message?.content || '[]'
      const gptClean = gptText.split('`').filter(s => !s.startsWith('json')).join('').trim()
      gptRecommendations = JSON.parse(gptClean)
    }

    res.json({ recommendations, gptRecommendations, engine, site: siteName, url: siteUrl })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

router.get('/:siteId/ai-visibility/score-history', auth, verifySite, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT results, created_at FROM ai_visibility_tests WHERE site_id=$1 ORDER BY created_at DESC LIMIT 30',
      [req.siteId]
    )
    const history = rows.map(r => {
      const results = Array.isArray(r.results) ? r.results : []
      const cited = results.filter(x => x && x.cited).length
      const score = results.length > 0 ? Math.round((cited / results.length) * 100) : 0
      return { date: r.created_at, score }
    }).reverse()
    res.json({ history })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router





