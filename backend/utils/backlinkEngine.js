const axios = require('axios')
const cheerio = require('cheerio')
const { extractDomain } = require('./helpers')

const REQUEST_TIMEOUT = 12000
const SEARCH_ENDPOINT = 'https://html.duckduckgo.com/html/'

const SERVICE_DIRECTORY_PROSPECTS = {
  agency: [
    { site: 'Clutch', siteUrl: 'https://clutch.co/', estimatedDR: 86, strategy: 'Create or improve the agency profile and collect at least 2 client reviews so the listing can rank and send referral traffic.' },
    { site: 'DesignRush', siteUrl: 'https://www.designrush.com/', estimatedDR: 82, strategy: 'Complete the agency profile with portfolio pieces, services, and location signals to strengthen branded and category visibility.' },
    { site: 'GoodFirms', siteUrl: 'https://www.goodfirms.co/', estimatedDR: 78, strategy: 'Submit the business with service categories, reviews, and case studies so the backlink comes from a qualified buyer directory.' },
    { site: 'The Manifest', siteUrl: 'https://themanifest.com/', estimatedDR: 79, strategy: 'Add a profile and client proof so the backlink is tied to category trust rather than a thin directory mention.' },
    { site: 'Sortlist', siteUrl: 'https://www.sortlist.com/', estimatedDR: 74, strategy: 'Publish a full service profile and project examples to turn the listing into a lead source, not just a citation.' },
  ],
  software: [
    { site: 'Product Hunt', siteUrl: 'https://www.producthunt.com/', estimatedDR: 90, strategy: 'Launch the product or a focused free tool with screenshots, onboarding copy, and a backlink to the core landing page.' },
    { site: 'G2', siteUrl: 'https://www.g2.com/', estimatedDR: 89, strategy: 'Create a software listing only if the site represents a real product, then support it with reviews and comparison content.' },
    { site: 'Capterra', siteUrl: 'https://www.capterra.com/', estimatedDR: 88, strategy: 'List the product in the closest category and collect real customer reviews to make the backlink commercially useful.' },
    { site: 'AlternativeTo', siteUrl: 'https://alternativeto.net/', estimatedDR: 82, strategy: 'Add the product if it solves a clear software use case and position it against known alternatives.' },
  ],
  content: [
    { site: 'DEV Community', siteUrl: 'https://dev.to/', estimatedDR: 92, strategy: 'Repurpose one strong technical or growth article and link back to the canonical resource on your own site.' },
    { site: 'Hashnode', siteUrl: 'https://hashnode.com/', estimatedDR: 88, strategy: 'Publish engineering-led articles tied to your niche and reference the deeper case study or service page on your site.' },
    { site: 'Medium', siteUrl: 'https://medium.com/', estimatedDR: 95, strategy: 'Syndicate top-of-funnel content with a clear canonical or contextual backlink back to your site.' },
  ],
  local: [
    { site: 'Google Business Profile', siteUrl: 'https://www.google.com/business/', estimatedDR: 0, strategy: 'Complete the local business profile and make sure the website URL points to the highest-converting local landing page.' },
    { site: 'Bing Places', siteUrl: 'https://www.bingplaces.com/', estimatedDR: 0, strategy: 'Claim the business listing to secure a trusted citation and improve local discoverability.' },
  ],
}

const HIGH_TRUST_DOMAINS = new Map([
  ['github.com', 96],
  ['medium.com', 95],
  ['linkedin.com', 98],
  ['dev.to', 92],
  ['hashnode.com', 88],
  ['producthunt.com', 90],
  ['g2.com', 89],
  ['capterra.com', 88],
  ['clutch.co', 86],
  ['designrush.com', 82],
  ['goodfirms.co', 78],
  ['themanifest.com', 79],
  ['sortlist.com', 74],
  ['techbehemoths.com', 70],
  ['coderlegion.com', 58],
  ['fiverr.com', 90],
  ['facebook.com', 98],
])

function trimText(value, max = 220) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (text.length <= max) return text
  return `${text.slice(0, max - 1).trim()}...`
}

function normalizeUrl(raw) {
  const value = String(raw || '').trim()
  if (!value) return ''
  try {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`
    return new URL(withProtocol).href
  } catch {
    return ''
  }
}

function sameOrSubdomain(candidateDomain, targetDomain) {
  const candidate = String(candidateDomain || '').toLowerCase().replace(/^www\./, '')
  const target = String(targetDomain || '').toLowerCase().replace(/^www\./, '')
  return !!candidate && !!target && (candidate === target || candidate.endsWith(`.${target}`) || target.endsWith(`.${candidate}`))
}

function labelFromDomain(domain) {
  return String(domain || '')
    .replace(/^www\./, '')
    .split('.')
    .slice(0, -1)
    .join(' ')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim() || domain
}

function absoluteUrl(baseUrl, href) {
  try {
    return new URL(href, baseUrl).href
  } catch {
    return ''
  }
}

function domainAuthorityHint(domain) {
  const cleanDomain = String(domain || '').toLowerCase().replace(/^www\./, '')
  if (HIGH_TRUST_DOMAINS.has(cleanDomain)) return HIGH_TRUST_DOMAINS.get(cleanDomain)
  if (cleanDomain.endsWith('.gov')) return 88
  if (cleanDomain.endsWith('.edu')) return 84
  if (cleanDomain.endsWith('.org')) return 62
  return 0
}

async function fetchHtml(url) {
  try {
    const response = await axios.get(url, {
      timeout: REQUEST_TIMEOUT,
      maxRedirects: 5,
      validateStatus: (status) => status >= 200 && status < 400,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BacklinkDiscoveryBot/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
    })
    if (typeof response.data !== 'string') return null
    return response.data
  } catch {
    return null
  }
}

function parseDuckDuckGoHref(href) {
  const raw = String(href || '').trim()
  if (!raw) return ''
  try {
    const url = new URL(raw, 'https://duckduckgo.com')
    const redirectTarget = url.searchParams.get('uddg')
    if (redirectTarget) return decodeURIComponent(redirectTarget)
    if (/^https?:\/\//i.test(raw)) return raw
    if (/^\/l\/\?/.test(raw) || /^\/l\//.test(raw)) return ''
    return url.href
  } catch {
    return raw
  }
}

async function searchDuckDuckGo(query, limit = 8) {
  const html = await fetchHtml(`${SEARCH_ENDPOINT}?q=${encodeURIComponent(query)}`)
  if (!html) return []

  const $ = cheerio.load(html)
  const seen = new Set()
  const results = []

  $('a.result__a, .result a[href]').each((_, element) => {
    if (results.length >= limit) return false
    const href = parseDuckDuckGoHref($(element).attr('href'))
    if (!href || !/^https?:\/\//i.test(href)) return undefined
    const domain = extractDomain(href)
    if (!domain || domain.includes('duckduckgo.com') || seen.has(href)) return undefined
    seen.add(href)
    const title = trimText($(element).text(), 160)
    const snippet = trimText($(element).closest('.result').find('.result__snippet').text(), 240)
    results.push({ title, url: href, domain, snippet })
    return undefined
  })

  return results
}

function extractPageSignals(html, pageUrl, targetDomain) {
  const $ = cheerio.load(html)
  const pageTitle = trimText($('title').first().text(), 140) || labelFromDomain(extractDomain(pageUrl))
  const pageText = trimText($('body').text(), 4000)
  const internalLinks = []
  const outboundLinks = []
  const targetLinks = []
  const seen = new Set()

  $('a[href]').each((_, element) => {
    const href = absoluteUrl(pageUrl, $(element).attr('href'))
    if (!href || seen.has(href)) return
    seen.add(href)

    const anchor = trimText($(element).text(), 140)
    const domain = extractDomain(href)
    const rel = String($(element).attr('rel') || '').toLowerCase()
    const item = { href, domain, anchor, rel }

    if (sameOrSubdomain(domain, targetDomain)) {
      targetLinks.push(item)
      return
    }

    if (sameOrSubdomain(domain, extractDomain(pageUrl))) {
      internalLinks.push(item)
      return
    }

    outboundLinks.push(item)
  })

  return { pageTitle, pageText, internalLinks, outboundLinks, targetLinks }
}

function detectSiteModes(text) {
  const hay = String(text || '').toLowerCase()
  const modes = new Set()
  if (/(agency|services|consulting|consultant|studio|freelance|client|portfolio|case study)/.test(hay)) modes.add('agency')
  if (/(software|saas|platform|dashboard|product|app|application)/.test(hay)) modes.add('software')
  if (/(blog|insights|article|guide|resources|newsletter|tutorial)/.test(hay)) modes.add('content')
  if (/( norway | stavanger | based in | address | headquarters | local )/.test(` ${hay} `)) modes.add('local')
  if (!modes.size) modes.add('content')
  return Array.from(modes)
}

function collectKeywordHints(text) {
  const hay = String(text || '').toLowerCase()
  const phrases = [
    'web development', 'web design', 'ui/ux', 'ux', 'seo', 'devops', 'fullstack', 'react', 'next.js', 'node.js',
    'api', 'azure', 'cloud', 'figma', 'e-commerce', 'saas', 'product design', 'mobile app', 'norway', 'stavanger',
  ]
  return phrases.filter((phrase) => hay.includes(phrase)).slice(0, 10)
}

async function collectSiteContext(siteUrl) {
  const homepageUrl = normalizeUrl(siteUrl)
  const targetDomain = extractDomain(homepageUrl)
  const homepageHtml = await fetchHtml(homepageUrl)
  if (!homepageHtml) {
    return {
      siteText: '',
      modes: ['content'],
      keywordHints: [],
      portfolioLinks: [],
      externalReferences: [],
      keyPages: [],
    }
  }

  const homepageSignals = extractPageSignals(homepageHtml, homepageUrl, targetDomain)
  const keyPages = []
  const portfolioLinks = []
  const externalReferences = homepageSignals.outboundLinks
    .filter((item) => !/linkedin\.com|facebook\.com|instagram\.com|x\.com|twitter\.com|youtube\.com/i.test(item.domain))
    .map((item) => ({
      domain: item.domain,
      site: labelFromDomain(item.domain),
      siteUrl: item.href,
      anchor: item.anchor,
      evidenceUrl: homepageUrl,
      evidence: `External reference found on ${homepageUrl}`,
    }))

  const keyPageCandidates = homepageSignals.internalLinks
    .filter((link) => /\/(work|portfolio|project|projects|case|case-study|case-studies|client|clients|blog|insights|article|articles|seo)\b/i.test(link.href))
    .slice(0, 5)

  for (const candidate of keyPageCandidates) {
    const html = await fetchHtml(candidate.href)
    if (!html) continue
    const signals = extractPageSignals(html, candidate.href, targetDomain)
    keyPages.push({ url: candidate.href, title: signals.pageTitle, text: signals.pageText })
    signals.outboundLinks
      .filter((item) => !/linkedin\.com|facebook\.com|instagram\.com|x\.com|twitter\.com|youtube\.com/i.test(item.domain))
      .forEach((item) => {
        const reference = {
          domain: item.domain,
          site: labelFromDomain(item.domain),
          siteUrl: item.href,
          anchor: item.anchor,
          evidenceUrl: candidate.href,
          evidence: `External project/client link found on ${candidate.href}`,
        }
        externalReferences.push(reference)
        portfolioLinks.push(reference)
      })
  }

  const siteText = [
    homepageSignals.pageTitle,
    homepageSignals.pageText,
    ...keyPages.map((page) => `${page.title} ${page.text}`),
  ].join(' ')

  return {
    siteText,
    modes: detectSiteModes(siteText),
    keywordHints: collectKeywordHints(siteText),
    portfolioLinks,
    externalReferences: dedupeBy(externalReferences, (item) => item.siteUrl),
    keyPages,
  }
}

async function inspectCandidatePage(pageUrl, targetDomain, siteName) {
  const html = await fetchHtml(pageUrl)
  if (!html) return null
  const signals = extractPageSignals(html, pageUrl, targetDomain)
  const siteNameLower = String(siteName || '').toLowerCase().trim()
  const mentionsBrand = siteNameLower && signals.pageText.toLowerCase().includes(siteNameLower)
  const mentionsDomain = signals.pageText.toLowerCase().includes(targetDomain)
  const firstLink = signals.targetLinks[0]

  if (firstLink) {
    return {
      verified: true,
      pageTitle: signals.pageTitle,
      pageUrl,
      referringDomain: extractDomain(pageUrl),
      anchor: firstLink.anchor,
      targetUrl: firstLink.href,
      type: firstLink.rel.includes('nofollow') ? 'nofollow' : 'dofollow',
    }
  }

  if (mentionsBrand || mentionsDomain) {
    return {
      verified: false,
      mention: true,
      pageTitle: signals.pageTitle,
      pageUrl,
      referringDomain: extractDomain(pageUrl),
      evidence: mentionsDomain
        ? `Brand/domain is mentioned on ${pageUrl} but no clickable backlink was found.`
        : `Brand mention found on ${pageUrl} without a clickable backlink.`,
    }
  }

  return null
}

function dedupeBy(items, keyFn) {
  const seen = new Set()
  const out = []
  for (const item of items) {
    const key = keyFn(item)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

function buildCatalogOpportunities({ siteName, siteUrl, siteContext, existingDomains }) {
  const catalog = []
  for (const mode of siteContext.modes) {
    for (const prospect of SERVICE_DIRECTORY_PROSPECTS[mode] || []) {
      const domain = extractDomain(prospect.siteUrl)
      if (existingDomains.has(domain)) continue
      catalog.push({
        site: prospect.site,
        siteUrl: prospect.siteUrl,
        type: mode === 'content' ? 'Content distribution' : mode === 'local' ? 'Citation' : 'Directory',
        relevance: mode === 'local' ? 'Medium' : 'High',
        strategy: prospect.strategy,
        estimatedDR: prospect.estimatedDR,
        evidence: `${siteName || siteUrl} looks like a ${mode}-fit based on the live site content${siteContext.keywordHints.length ? `: ${siteContext.keywordHints.join(', ')}` : ''}.`,
        evidenceUrl: normalizeUrl(siteUrl),
        source: 'catalog',
      })
    }
  }
  return dedupeBy(catalog, (item) => extractDomain(item.siteUrl))
}

function sortOpportunities(opportunities) {
  const relevanceScore = { High: 3, Medium: 2, Low: 1 }
  return [...opportunities].sort((left, right) => {
    const a = relevanceScore[left.relevance] || 0
    const b = relevanceScore[right.relevance] || 0
    if (a !== b) return b - a
    return Number(right.estimatedDR || 0) - Number(left.estimatedDR || 0)
  })
}

async function analyzeBacklinkLandscape({ siteName, siteUrl, existingBacklinks = [], seedUrls = [] }) {
  const targetUrl = normalizeUrl(siteUrl)
  const targetDomain = extractDomain(targetUrl)
  const siteContext = await collectSiteContext(targetUrl)
  const brand = trimText(siteName, 120)
  const primaryHint = siteContext.keywordHints[0] || ''
  const searchQueries = dedupeBy([
    `"${targetDomain}" -site:${targetDomain}`,
    `${targetDomain} -site:${targetDomain}`,
    brand ? `"${brand}" -site:${targetDomain}` : '',
    brand || '',
    brand && primaryHint ? `${brand} ${primaryHint}` : '',
  ].filter(Boolean), (query) => query.toLowerCase())

  const errors = []
  const candidates = []

  for (const query of searchQueries) {
    const results = await searchDuckDuckGo(query, 10)
    results.forEach((result) => {
      if (!sameOrSubdomain(result.domain, targetDomain)) candidates.push({ ...result, discoveredVia: 'search' })
    })
  }

  for (const reference of siteContext.externalReferences.slice(0, 12)) {
    const normalizedReference = normalizeUrl(reference.siteUrl)
    if (!normalizedReference || sameOrSubdomain(extractDomain(normalizedReference), targetDomain)) continue
    candidates.push({
      url: normalizedReference,
      title: reference.site,
      domain: extractDomain(normalizedReference),
      snippet: reference.evidence,
      discoveredVia: 'site-reference',
    })
  }

  for (const seedUrl of seedUrls.slice(0, 10)) {
    const normalizedSeed = normalizeUrl(seedUrl)
    if (!normalizedSeed || sameOrSubdomain(extractDomain(normalizedSeed), targetDomain)) continue
    candidates.push({ url: normalizedSeed, title: labelFromDomain(extractDomain(normalizedSeed)), domain: extractDomain(normalizedSeed), snippet: '', discoveredVia: 'seed' })
  }

  const existingKeys = new Set(existingBacklinks.map((item) => {
    const url = normalizeUrl(item.url)
    return url || `${String(item.name || '').toLowerCase()}|${String(item.anchor || '').toLowerCase()}`
  }).filter(Boolean))

  const verifiedBacklinks = []
  const unlinkedMentions = []
  const inspectedCandidates = dedupeBy(candidates, (item) => normalizeUrl(item.url)).slice(0, 18)

  for (const candidate of inspectedCandidates) {
    try {
      const inspected = await inspectCandidatePage(candidate.url, targetDomain, siteName)
      if (!inspected) continue

      if (inspected.verified) {
        const key = normalizeUrl(inspected.pageUrl)
        if (existingKeys.has(key)) continue
        verifiedBacklinks.push({
          name: inspected.pageTitle || labelFromDomain(inspected.referringDomain),
          dr: 0,
          status: 'Live',
          anchor: inspected.anchor,
          url: inspected.pageUrl,
          type: inspected.type,
          source: 'crawled',
          targetUrl: inspected.targetUrl,
          discoveredVia: candidate.discoveredVia,
        })
        existingKeys.add(key)
      } else if (inspected.mention) {
        unlinkedMentions.push({
          site: inspected.pageTitle || labelFromDomain(inspected.referringDomain),
          siteUrl: inspected.pageUrl,
          type: 'Unlinked mention',
          relevance: 'High',
          strategy: `Ask the editor or site owner to convert the existing mention into a clickable backlink to ${targetDomain}.`,
          estimatedDR: domainAuthorityHint(inspected.referringDomain),
          evidence: inspected.evidence,
          evidenceUrl: inspected.pageUrl,
          source: 'search',
        })
      }
    } catch (error) {
      errors.push(`${candidate.url}: ${error.message}`)
    }
  }

  const existingDomains = new Set([
    ...existingBacklinks.map((item) => extractDomain(item.url || item.name)),
    ...verifiedBacklinks.map((item) => extractDomain(item.url)),
  ].filter(Boolean))

  const portfolioOpportunities = dedupeBy(siteContext.portfolioLinks, (item) => item.domain)
    .filter((item) => !existingDomains.has(item.domain))
    .map((item) => ({
      site: item.site,
      siteUrl: item.siteUrl,
      type: 'Partnership',
      relevance: 'High',
      strategy: `Ask ${item.site} for a credited case-study, footer, or project attribution link back to the most relevant page on your site.`,
      estimatedDR: domainAuthorityHint(item.domain),
      evidence: item.evidence,
      evidenceUrl: item.evidenceUrl,
      source: 'portfolio',
    }))

  const catalogOpportunities = buildCatalogOpportunities({
    siteName,
    siteUrl: targetUrl,
    siteContext,
    existingDomains,
  })

  const opportunities = sortOpportunities(dedupeBy([
    ...unlinkedMentions,
    ...portfolioOpportunities,
    ...catalogOpportunities,
  ], (item) => `${extractDomain(item.siteUrl)}|${item.type}`)).slice(0, 12)

  return {
    verifiedBacklinks,
    opportunities,
    stats: {
      inspected: inspectedCandidates.length,
      verified: verifiedBacklinks.length,
      unlinkedMentions: unlinkedMentions.length,
      opportunities: opportunities.length,
    },
    errors,
  }
}

module.exports = {
  analyzeBacklinkLandscape,
}