/**
 * Shared backlink quality helpers for UI (Good / OK / Risk / Spam).
 */

const SPAM_TLDS = new Set([
  'xyz', 'party', 'icu', 'top', 'click', 'link', 'online', 'site', 'website', 'space',
  'agency', 'club', 'buzz', 'win', 'bid', 'loan', 'review', 'trade', 'stream',
  'gdn', 'gq', 'tk', 'ml', 'cf', 'ga', 'racing', 'date', 'download', 'accountant',
  'faith', 'science', 'work', 'men', 'cricket', 'webcam', 'ninja', 'rest', 'pw',
])

function normalizeUrl(raw) {
  const v = String(raw || '').trim()
  if (!v) return ''
  const w = /^https?:\/\//i.test(v) ? v : `https://${v}`
  try {
    return new URL(w).href
  } catch {
    return v
  }
}

export function getBacklinkHostname(raw) {
  try {
    return new URL(normalizeUrl(raw)).hostname.replace(/^www\./i, '')
  } catch {
    return String(raw || '').trim().replace(/^www\./i, '')
  }
}

export function getDomainRank(b) {
  return Number(b?.provider_rank || b?.dr || 0)
}

export function getQualityScore(b) {
  const raw = Number(b?.quality_score)
  if (Number.isFinite(raw) && raw > 0) return Math.round(raw)

  // Lightweight fallback when quality has not been recalculated yet
  const rank = getDomainRank(b)
  const dofollow = String(b?.type || 'dofollow').toLowerCase() === 'dofollow'
  const spam = Number(b?.provider_spam_score || b?.spam_score || 0)
  const live = String(b?.status || '').toLowerCase() === 'live' || Boolean(b?.is_live)
  let score = Math.min(100, Math.round(rank * 0.7 + (dofollow ? 20 : 5) + (live ? 10 : 0)))
  score = Math.max(0, score - Math.min(40, spam))
  return score
}

export function isSpamHeuristic(b) {
  const host = getBacklinkHostname(b?.url || b?.source_domain || b?.name || '')
  const tld = host.split('.').pop()?.toLowerCase() || ''
  const dr = getDomainRank(b)
  const spamScore = Number(b?.provider_spam_score || b?.spam_score || 0)
  const type = String(b?.type || 'dofollow').toLowerCase()
  return (
    SPAM_TLDS.has(tld) ||
    spamScore >= 40 ||
    (dr > 0 && dr < 10 && type === 'nofollow') ||
    Boolean(b?.source_robots_noindex)
  )
}

/**
 * @returns {'good'|'ok'|'risk'|'spam'}
 */
export function classifyBacklink(b) {
  if (isSpamHeuristic(b)) return 'spam'

  const quality = getQualityScore(b)
  const rank = getDomainRank(b)
  const broken =
    b?.is_broken === true ||
    Number(b?.http_status) >= 400 ||
    String(b?.verification_status || '').toLowerCase() === 'broken'
  const lost = b?.is_lost === true || String(b?.status || '').toLowerCase() === 'lost'

  if (broken || lost) return 'risk'
  if (quality >= 70 && rank >= 20) return 'good'
  if (quality >= 45 || rank >= 15) return 'ok'
  return 'risk'
}

export const QUALITY_META = {
  good: { label: 'Good', color: '#15803d', bg: '#dcfce7', hint: 'Strong DR + solid quality' },
  ok: { label: 'OK', color: '#a16207', bg: '#fef9c3', hint: 'Average / usable link' },
  risk: { label: 'Risk', color: '#c2410c', bg: '#ffedd5', hint: 'Weak, lost, or low quality' },
  spam: { label: 'Spam', color: '#b91c1c', bg: '#fee2e2', hint: 'Likely toxic / spammy' },
}

export function summarizeBacklinkQuality(backlinks = []) {
  const summary = { good: 0, ok: 0, risk: 0, spam: 0, total: backlinks.length }
  for (const b of backlinks) {
    summary[classifyBacklink(b)] += 1
  }
  return summary
}
