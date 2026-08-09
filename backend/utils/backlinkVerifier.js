const { URL } = require('url')

const DEFAULT_TIMEOUT_MS = 12000
const MAX_HTML_BYTES = 2 * 1024 * 1024

const normalizeHost = (value) => {
  try {
    const u = value instanceof URL ? value : new URL(value)
    return u.hostname.replace(/^www\./i, '').toLowerCase()
  } catch {
    return ''
  }
}

const normalizeTarget = (targetUrl) => {
  try {
    const withProtocol = /^https?:\/\//i.test(String(targetUrl || ''))
      ? String(targetUrl)
      : `https://${targetUrl}`

    return new URL(withProtocol)
  } catch {
    return null
  }
}

const stripTags = (value) =>
  String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()

const attr = (tag, name) => {
  const re = new RegExp(
    `${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    'i'
  )

  const m = tag.match(re)
  return m ? (m[1] ?? m[2] ?? m[3] ?? '') : ''
}

const findTitle = (html) => {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return m ? stripTags(m[1]).slice(0, 300) : ''
}

const findLanguage = (html) => {
  const m = html.match(/<html[^>]*\blang\s*=\s*["']?([^"' >]+)/i)
  return m ? String(m[1] || '').trim().slice(0, 32) : ''
}

const findCanonical = (html, baseUrl) => {
  const tags = html.match(/<link\b[^>]*>/gi) || []

  for (const tag of tags) {
    const rel = attr(tag, 'rel').toLowerCase()
    if (!rel.split(/\s+/).includes('canonical')) continue

    const href = attr(tag, 'href')
    if (!href) continue

    try {
      return new URL(href, baseUrl).href
    } catch {
      return href
    }
  }

  return ''
}

const hasNoindex = (html) => {
  const tags = html.match(/<meta\b[^>]*>/gi) || []

  for (const tag of tags) {
    const name = attr(tag, 'name').toLowerCase()
    if (name !== 'robots' && name !== 'googlebot') continue

    const content = attr(tag, 'content').toLowerCase()
    if (content.includes('noindex')) return true
  }

  return false
}

const detectPosition = (html, anchorIndex) => {
  const before = html.slice(0, anchorIndex).toLowerCase()

  const openTag = (tag) => before.lastIndexOf(`<${tag}`)
  const closeTag = (tag) => before.lastIndexOf(`</${tag}>`)

  if (openTag('footer') > closeTag('footer')) return 'footer'
  if (openTag('nav') > closeTag('nav')) return 'navigation'
  if (openTag('aside') > closeTag('aside')) return 'sidebar'
  if (openTag('header') > closeTag('header')) return 'header'
  if (openTag('main') > closeTag('main')) return 'main-content'
  if (openTag('article') > closeTag('article')) return 'article'

  return 'body'
}

const extractContext = (html, anchorIndex, anchorLength) => {
  const start = Math.max(0, anchorIndex - 240)
  const end = Math.min(html.length, anchorIndex + anchorLength + 240)
  return stripTags(html.slice(start, end)).slice(0, 500)
}

const fetchWithTimeout = async (url, timeoutMs = DEFAULT_TIMEOUT_MS) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'user-agent':
          'Mozilla/5.0 (compatible; DevnDesproBacklinkVerifier/1.0; +https://www.devndespro.com)',
        accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      },
    })
  } finally {
    clearTimeout(timer)
  }
}

const readHtmlLimited = async (response) => {
  const contentType = String(response.headers.get('content-type') || '').toLowerCase()

  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
    return {
      html: '',
      supported: false,
      contentType,
    }
  }

  const text = await response.text()
  const html = text.length > MAX_HTML_BYTES
    ? text.slice(0, MAX_HTML_BYTES)
    : text

  return {
    html,
    supported: true,
    contentType,
  }
}

const verifyBacklink = async ({
  sourceUrl,
  targetUrl,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) => {
  const source = normalizeTarget(sourceUrl)
  const target = normalizeTarget(targetUrl)

  if (!source) {
    return {
      verificationStatus: 'Unverified',
      reason: 'Invalid source URL',
      isLive: false,
      isLost: false,
      isBroken: false,
      httpStatus: null,
      evidence: {},
    }
  }

  if (!target) {
    return {
      verificationStatus: 'Unverified',
      reason: 'Invalid target URL',
      isLive: false,
      isLost: false,
      isBroken: false,
      httpStatus: null,
      evidence: {},
    }
  }

  const targetHost = normalizeHost(target)

  try {
    const response = await fetchWithTimeout(source.href, timeoutMs)
    const httpStatus = response.status
    const finalUrl = response.url || source.href

    if (httpStatus >= 400) {
      return {
        verificationStatus: 'Broken',
        reason: `Source page returned HTTP ${httpStatus}`,
        isLive: false,
        isLost: true,
        isBroken: true,
        httpStatus,
        sourceFinalUrl: finalUrl,
        evidence: {
          targetHost,
          sourceRequestedUrl: source.href,
          sourceFinalUrl: finalUrl,
        },
      }
    }

    const { html, supported, contentType } = await readHtmlLimited(response)

    if (!supported) {
      return {
        verificationStatus: 'Unverified',
        reason: `Unsupported source content type: ${contentType || 'unknown'}`,
        isLive: false,
        isLost: false,
        isBroken: false,
        httpStatus,
        sourceFinalUrl: finalUrl,
        evidence: {
          targetHost,
          contentType,
        },
      }
    }

    const anchorTags = html.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) || []
    let matched = null

    for (const tag of anchorTags) {
      const openTag = tag.match(/^<a\b[^>]*>/i)?.[0] || ''
      const hrefRaw = attr(openTag, 'href')
      if (!hrefRaw) continue

      let resolved
      try {
        resolved = new URL(hrefRaw, finalUrl)
      } catch {
        continue
      }

      const host = normalizeHost(resolved)
      if (!host || host !== targetHost) continue

      const relRaw = attr(openTag, 'rel')
      const relTokens = relRaw
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)

      const anchorText = stripTags(
        tag
          .replace(/^<a\b[^>]*>/i, '')
          .replace(/<\/a>$/i, '')
      )

      const anchorIndex = html.indexOf(tag)

      matched = {
        resolvedUrl: resolved.href,
        anchorText,
        relTokens,
        relNofollow: relTokens.includes('nofollow'),
        relSponsored: relTokens.includes('sponsored'),
        relUgc: relTokens.includes('ugc'),
        linkPosition: detectPosition(html, anchorIndex),
        linkContext: extractContext(html, anchorIndex, tag.length),
      }

      break
    }

    const pageTitle = findTitle(html)
    const sourceLanguage = findLanguage(html)
    const sourceCanonical = findCanonical(html, finalUrl)
    const sourceRobotsNoindex = hasNoindex(html)

    if (!matched) {
      return {
        verificationStatus: 'Lost',
        reason: `No link to ${targetHost} was found on the source page`,
        isLive: false,
        isLost: true,
        isBroken: false,
        httpStatus,
        sourceFinalUrl: finalUrl,
        sourcePageTitle: pageTitle,
        sourceLanguage,
        sourceCanonical,
        sourceRobotsNoindex,
        evidence: {
          targetHost,
          scannedAnchors: anchorTags.length,
          sourceFinalUrl: finalUrl,
          sourcePageTitle: pageTitle,
        },
      }
    }

    const redirected =
      source.href.replace(/\/$/, '') !== finalUrl.replace(/\/$/, '')

    return {
      verificationStatus: redirected ? 'Redirected' : 'Live',
      reason: redirected
        ? 'Backlink verified after source-page redirect'
        : 'Backlink verified',
      isLive: true,
      isLost: false,
      isBroken: false,
      httpStatus,
      sourceFinalUrl: finalUrl,
      sourcePageTitle: pageTitle,
      sourceLanguage,
      sourceCanonical,
      sourceRobotsNoindex,
      anchorText: matched.anchorText,
      targetResolvedUrl: matched.resolvedUrl,
      relNofollow: matched.relNofollow,
      relSponsored: matched.relSponsored,
      relUgc: matched.relUgc,
      type: matched.relNofollow ? 'nofollow' : 'dofollow',
      linkPosition: matched.linkPosition,
      linkContext: matched.linkContext,
      evidence: {
        targetHost,
        matchedTargetUrl: matched.resolvedUrl,
        rel: matched.relTokens,
        sourceFinalUrl: finalUrl,
        sourcePageTitle: pageTitle,
        sourceCanonical,
        sourceRobotsNoindex,
        linkPosition: matched.linkPosition,
      },
    }
  } catch (error) {
    const aborted = error?.name === 'AbortError'

    return {
      verificationStatus: 'Unverified',
      reason: aborted
        ? `Verification timed out after ${timeoutMs}ms`
        : String(error?.message || 'Verification request failed'),
      isLive: false,
      isLost: false,
      isBroken: false,
      httpStatus: null,
      evidence: {
        errorName: error?.name || '',
      },
    }
  }
}

module.exports = {
  verifyBacklink,
  normalizeHost,
}
