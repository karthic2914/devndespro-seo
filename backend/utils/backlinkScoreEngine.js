const clamp = (value, min = 0, max = 100) =>
  Math.max(min, Math.min(max, Number(value || 0)))

const normalizeText = (value) =>
  String(value || '').trim().toLowerCase()

const ageDays = (value) => {
  if (!value) return null
  const time = new Date(value).getTime()
  if (!Number.isFinite(time)) return null
  return Math.max(0, (Date.now() - time) / 86400000)
}

const freshnessScore = (verifiedAt) => {
  const days = ageDays(verifiedAt)
  if (days === null) return 0
  if (days <= 14) return 100
  if (days <= 30) return 90
  if (days <= 60) return 75
  if (days <= 90) return 60
  if (days <= 180) return 35
  return 15
}

const httpHealthScore = (status) => {
  const code = Number(status || 0)
  if (code >= 200 && code < 300) return 100
  if (code >= 300 && code < 400) return 65
  if (code >= 400 && code < 500) return 10
  if (code >= 500) return 5
  return 25
}

const placementScore = (position) => {
  switch (normalizeText(position)) {
    case 'article':
      return 100
    case 'main-content':
      return 95
    case 'body':
      return 80
    case 'sidebar':
      return 50
    case 'navigation':
      return 35
    case 'footer':
      return 30
    case 'header':
      return 30
    default:
      return 55
  }
}

const attributeScore = (row) => {
  const nofollow = Boolean(row.rel_nofollow)
  const sponsored = Boolean(row.rel_sponsored)
  const ugc = Boolean(row.rel_ugc)

  if (sponsored) return 30
  if (ugc && nofollow) return 45
  if (ugc) return 55
  if (nofollow) return 60
  return 100
}

const contentEvidenceScore = (row) => {
  let score = 0

  if (String(row.anchor || '').trim()) score += 40
  if (String(row.link_context || '').trim().length >= 30) score += 35
  if (String(row.source_page_title || '').trim()) score += 15
  if (String(row.source_canonical || '').trim()) score += 10

  return clamp(score)
}

const verificationScore = (row) => {
  const status = normalizeText(row.verification_status)

  if (row.is_live && status === 'live') return 100
  if (row.is_live && status === 'redirected') return 90
  if (status === 'redirected') return 80
  if (status === 'lost') return 10
  if (status === 'broken') return 0

  return 25
}

const calculateSpamPenalty = (row) => {
  let penalty = 0

  if (row.source_robots_noindex) penalty += 25
  if (row.rel_sponsored) penalty += 15
  if (row.is_broken) penalty += 30
  if (row.is_lost) penalty += 30

  const position = normalizeText(row.link_position)
  if (position === 'footer' || position === 'navigation') penalty += 8

  const anchor = normalizeText(row.anchor)
  if (anchor && anchor.length > 140) penalty += 8

  return clamp(penalty)
}

const calculateBacklinkQuality = (row) => {
  const verification = verificationScore(row)
  const indexability = row.source_robots_noindex ? 0 : 100
  const attributes = attributeScore(row)
  const placement = placementScore(row.link_position)
  const contentEvidence = contentEvidenceScore(row)
  const technical = httpHealthScore(row.http_status)
  const freshness = freshnessScore(row.verified_at || row.last_checked)

  const weighted =
    (verification * 0.25) +
    (indexability * 0.15) +
    (attributes * 0.15) +
    (placement * 0.15) +
    (contentEvidence * 0.10) +
    (technical * 0.10) +
    (freshness * 0.10)

  const spamPenalty = calculateSpamPenalty(row)
  const score = clamp(Math.round(weighted - spamPenalty))

  return {
    score,
    spamScore: spamPenalty,
    breakdown: {
      verification: Math.round(verification),
      indexability: Math.round(indexability),
      attributes: Math.round(attributes),
      placement: Math.round(placement),
      contentEvidence: Math.round(contentEvidence),
      technical: Math.round(technical),
      freshness: Math.round(freshness),
      spamPenalty: Math.round(spamPenalty),
    },
  }
}

const logScale = (value, target) => {
  const v = Math.max(0, Number(value || 0))
  const t = Math.max(1, Number(target || 1))

  if (v <= 0) return 0

  return clamp(
    Math.round(
      100 *
      Math.log10(v + 1) /
      Math.log10(t + 1)
    )
  )
}

const naturalFollowScore = (ratio) => {
  const r = clamp(ratio)

  if (r >= 45 && r <= 85) return 100
  if (r >= 30 && r < 45) return 75
  if (r > 85 && r <= 95) return 75
  if (r >= 15 && r < 30) return 50
  if (r > 95) return 45
  return 30
}

const concentrationScore = (domainCounts, totalLinks) => {
  const total = Math.max(0, Number(totalLinks || 0))
  if (!total) return 0

  let maxShare = 0

  for (const count of Object.values(domainCounts || {})) {
    maxShare = Math.max(maxShare, Number(count || 0) / total)
  }

  if (maxShare <= 0.20) return 100
  if (maxShare <= 0.35) return 85
  if (maxShare <= 0.50) return 65
  if (maxShare <= 0.70) return 40
  return 20
}

const stabilityScore = ({ live, lost, broken }) => {
  const total = live + lost + broken
  if (!total) return 0

  const badRate = (lost + broken) / total
  return clamp(Math.round((1 - badRate) * 100))
}

const verifiedFreshnessScore = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) return 0

  const scores = rows
    .map((row) => freshnessScore(row.verified_at || row.last_checked))
    .filter((value) => Number.isFinite(value))

  if (!scores.length) return 0

  return clamp(
    Math.round(
      scores.reduce((sum, value) => sum + value, 0) /
      scores.length
    )
  )
}

const calculateAuthority = ({ rows }) => {
  const allRows = Array.isArray(rows) ? rows : []

  const liveRows = allRows.filter(
    (row) =>
      Boolean(row.is_live) &&
      ['live', 'redirected'].includes(
        normalizeText(row.verification_status)
      )
  )

  const live = liveRows.length
  const lost = allRows.filter((row) => Boolean(row.is_lost)).length
  const broken = allRows.filter((row) => Boolean(row.is_broken)).length

  const domainCounts = {}
  let dofollow = 0
  let qualityTotal = 0

  for (const row of liveRows) {
    const domain = normalizeText(row.source_domain || row.name)
    if (domain) {
      domainCounts[domain] = (domainCounts[domain] || 0) + 1
    }

    if (!row.rel_nofollow && !row.rel_sponsored) {
      dofollow += 1
    }

    qualityTotal += clamp(row.quality_score)
  }

  const referringDomains = Object.keys(domainCounts).length
  const dofollowRatio = live > 0 ? (dofollow / live) * 100 : 0
  const avgQuality = live > 0 ? qualityTotal / live : 0

  const diversity = logScale(referringDomains, 250)
  const quality = clamp(Math.round(avgQuality))
  const naturality = naturalFollowScore(dofollowRatio)
  const stability = stabilityScore({ live, lost, broken })
  const freshness = verifiedFreshnessScore(liveRows)
  const concentration = concentrationScore(domainCounts, live)

  const score = live === 0
    ? 0
    : clamp(
        Math.round(
          (diversity * 0.30) +
          (quality * 0.25) +
          (naturality * 0.15) +
          (stability * 0.10) +
          (freshness * 0.10) +
          (concentration * 0.10)
        )
      )

  return {
    score,
    version: '3.0',
    counts: {
      live,
      lost,
      broken,
      referringDomains,
      dofollow,
      dofollowRatio: Math.round(dofollowRatio * 10) / 10,
    },
    breakdown: {
      domainDiversity: {
        value: referringDomains,
        score: diversity,
        weight: 30,
      },
      verifiedLinkQuality: {
        value: Math.round(avgQuality * 10) / 10,
        score: quality,
        weight: 25,
      },
      followNaturality: {
        value: Math.round(dofollowRatio * 10) / 10,
        score: naturality,
        weight: 15,
      },
      linkStability: {
        score: stability,
        weight: 10,
      },
      verificationFreshness: {
        score: freshness,
        weight: 10,
      },
      domainConcentration: {
        score: concentration,
        weight: 10,
      },
    },
  }
}

module.exports = {
  calculateBacklinkQuality,
  calculateAuthority,
}
