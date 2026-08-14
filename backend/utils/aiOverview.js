/**
 * Parse Google AI Overview presence + citations from DataForSEO SERP advanced result.
 */
function extractDomainFromUrl(url) {
  if (!url || typeof url !== 'string') return null
  try {
    const host = new URL(url.startsWith('http') ? url : `https://${url}`).hostname
    return host.replace(/^www\./i, '').toLowerCase() || null
  } catch {
    return null
  }
}

function collectReferences(list, seen, out) {
  for (const r of list || []) {
    const domain = (r.domain || extractDomainFromUrl(r.url) || '').replace(/^www\./i, '').toLowerCase()
    if (!domain || seen.has(domain)) continue
    seen.add(domain)
    out.push({
      domain,
      url: r.url || null,
      title: r.title || r.source || null,
      source: r.source || null,
    })
  }
}

function parseAiOverviewFromSerpResult(result) {
  const itemTypes = Array.isArray(result?.item_types) ? result.item_types : []
  const items = Array.isArray(result?.items) ? result.items : []
  const aio = items.find((i) => i && i.type === 'ai_overview') || null
  const flagged = itemTypes.includes('ai_overview') || Boolean(aio)

  if (!flagged) {
    return {
      hasAiOverview: false,
      citations: [],
      snippet: null,
      asynchronous: false,
    }
  }

  const citations = []
  const seen = new Set()
  if (aio) {
    collectReferences(aio.references, seen, citations)
    for (const el of aio.items || []) {
      collectReferences(el?.references, seen, citations)
    }
  }

  let snippet = null
  for (const el of aio?.items || []) {
    const text = el?.text || el?.markdown || null
    if (text) {
      snippet = String(text).replace(/\s+/g, ' ').trim().slice(0, 280)
      break
    }
  }

  const asyncFlag = Boolean(aio?.asynchronous_ai_overview)
  const emptyBody = !citations.length && !snippet

  return {
    hasAiOverview: true,
    citations: citations.slice(0, 10),
    snippet,
    asynchronous: asyncFlag,
    // Detected but content not returned (rare when async load fails)
    incomplete: emptyBody && asyncFlag,
  }
}

const LANG_NAME_TO_CODE = {
  english: 'en',
  german: 'de',
  norwegian: 'no',
  french: 'fr',
  spanish: 'es',
  dutch: 'nl',
  swedish: 'sv',
  danish: 'da',
}

function languageCodeFromName(name) {
  const key = String(name || 'English').trim().toLowerCase()
  return LANG_NAME_TO_CODE[key] || 'en'
}

module.exports = {
  parseAiOverviewFromSerpResult,
  languageCodeFromName,
  extractDomainFromUrl,
}
