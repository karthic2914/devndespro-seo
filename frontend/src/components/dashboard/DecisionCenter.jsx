import React, { useMemo } from 'react'
import ScoreInfoTip from '../ScoreInfoTip'

function clampScore(value) {
  const number = Number(value)

  if (!Number.isFinite(number)) return null

  return Math.max(0, Math.min(100, Math.round(number)))
}

function getScoreColor(score) {
  if (score >= 85) return '#16A34A'
  if (score >= 70) return '#2563EB'
  if (score >= 50) return '#D97706'
  return '#DC2626'
}

function getScoreLabel(score) {
  if (score >= 90) return 'Excellent'
  if (score >= 80) return 'Strong'
  if (score >= 65) return 'Good'
  if (score >= 50) return 'Needs attention'
  return 'Priority'
}

function MetricCard({ label, value, hint, scoreKey }) {
  const score = clampScore(value)

  return (
    <div style={{
      flex: '1 1 130px',
      minWidth: 120,
      padding: '12px 14px',
      border: '1px solid #E5E7EB',
      borderRadius: 10,
      background: '#fff',
    }}>
      <div style={{
        fontSize: 10,
        fontWeight: 700,
        color: '#9CA3AF',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: 5,
        display: 'flex',
        alignItems: 'center',
        gap: 5,
      }}>
        {label}
        {scoreKey ? <ScoreInfoTip scoreKey={scoreKey} /> : null}
      </div>

      <div style={{
        fontSize: 22,
        fontWeight: 800,
        color: score === null ? '#9CA3AF' : getScoreColor(score),
      }}>
        {score ?? '-'}
        <span style={{
          fontSize: 11,
          fontWeight: 500,
          color: '#9CA3AF',
        }}>
          /100
        </span>
      </div>

      {hint ? (
        <div style={{
          fontSize: 10,
          color: '#9CA3AF',
          marginTop: 4,
          lineHeight: 1.35,
        }}>
          {hint}
        </div>
      ) : null}
    </div>
  )
}

function AuthorityBreakdownRow({ label, value, scoreKey }) {
  const score =
    value === null || value === undefined
      ? null
      : Math.max(0, Math.min(100, Math.round(Number(value))))

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      gap: 10,
      alignItems: 'center',
      padding: '7px 0',
      borderBottom: '1px solid #F3F4F6',
    }}>
      <div style={{
        fontSize: 11,
        color: '#4B5563',
        fontWeight: 600,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
      }}>
        {label}
        {scoreKey ? <ScoreInfoTip scoreKey={scoreKey} /> : null}
      </div>

      <div style={{
        fontSize: 11,
        fontWeight: 800,
        color: score === null ? '#9CA3AF' : getScoreColor(score),
      }}>
        {score === null ? '-' : `${score}/100`}
      </div>
    </div>
  )
}
function categoryPassScore(checks, categoryName) {
  const issues = (Array.isArray(checks) ? checks : []).filter(
    (item) => String(item?.category || '') === categoryName
  )
  if (!issues.length) return null

  return clampScore(
    Math.round(
      issues.reduce(
        (sum, item) =>
          sum +
          (item.status === 'pass'
            ? 100
            : item.status === 'warning'
              ? 55
              : 15),
        0
      ) / issues.length
    )
  )
}

function averageScores(scores) {
  const values = scores.filter((score) => score !== null)
  if (!values.length) return null
  return Math.round(
    values.reduce((sum, score) => sum + score, 0) / values.length
  )
}

export default function DecisionCenter({
  auditData,
  multipageResults,
  authorityScore,
  domainRank,
  authorityDetails,
}) {
  const data = useMemo(() => {
    const siteHealth = clampScore(
      multipageResults?.siteHealthPct ?? auditData?.score
    )

    const linkScore = clampScore(authorityScore)
    const industryRank = clampScore(
      domainRank ??
      authorityDetails?.domain_rank ??
      authorityDetails?.breakdown?.domainRank
    )
    // Prefer industry Domain Rank for growth score when available
    const authority = industryRank ?? linkScore

    const homepageAudit = clampScore(auditData?.score)

    // ChatGPT / Claude = citation rates from AI Visibility tests (seo_metrics).
    // AI Snippet / AEO = on-page readiness from the latest audit checks.
    const chatgpt = clampScore(auditData?.chatgptScore)
    const claude = clampScore(auditData?.claudeScore)
    const aiSnippet = categoryPassScore(auditData?.checks, 'AI Snippet')
    const aeo = categoryPassScore(auditData?.checks, 'AEO')

    const engineScores = [chatgpt, claude].filter((score) => score !== null)
    const readinessScores = [aiSnippet, aeo].filter((score) => score !== null)
    const enginesAllZero =
      engineScores.length > 0 && engineScores.every((score) => score === 0)

    // If engines are missing or all 0 (usually "not tested yet"), use audit
    // AI Snippet/AEO readiness so the card is not stuck at a misleading 0.
    let aiVisibility = null
    let aiVisibilitySource = null
    if (readinessScores.length && (!engineScores.length || enginesAllZero)) {
      aiVisibility = averageScores(readinessScores)
      aiVisibilitySource = 'audit'
    } else if (engineScores.length && readinessScores.length) {
      aiVisibility = averageScores([...engineScores, ...readinessScores])
      aiVisibilitySource = 'mixed'
    } else if (engineScores.length) {
      aiVisibility = averageScores(engineScores)
      aiVisibilitySource = 'engines'
    } else if (readinessScores.length) {
      aiVisibility = averageScores(readinessScores)
      aiVisibilitySource = 'audit'
    }

    /*
      Digital Growth Score v1

      Site Health       45%
      Authority         25%
      AI Visibility     20%
      Homepage Audit    10%

      Missing metrics are ignored and remaining
      weights are automatically normalized.
    */

    const metrics = [
      { value: siteHealth, weight: 45 },
      { value: authority, weight: 25 },
      { value: aiVisibility, weight: 20 },
      { value: homepageAudit, weight: 10 },
    ].filter((item) => item.value !== null)

    const totalWeight = metrics.reduce(
      (sum, item) => sum + item.weight,
      0
    )

    const overallScore = totalWeight
      ? Math.round(
          metrics.reduce(
            (sum, item) => sum + item.value * item.weight,
            0
          ) / totalWeight
        )
      : 0

    const issues = Array.isArray(multipageResults?.issueSummary)
      ? [...multipageResults.issueSummary]
      : []

    issues.sort((a, b) => {
      const statusWeight = {
        error: 3,
        warning: 2,
        pass: 1,
      }

      const statusDifference =
        (statusWeight[b.status] || 0) -
        (statusWeight[a.status] || 0)

      if (statusDifference !== 0) {
        return statusDifference
      }

      return Number(b.count || 0) - Number(a.count || 0)
    })

    const priorities = issues
      .filter((issue) => issue.status !== 'pass')
      .slice(0, 3)

    const authorityBreakdown =
      authorityDetails?.breakdown ||
      multipageResults?.authorityBreakdown ||
      auditData?.authorityBreakdown ||
      null

    const pickScore = (...candidates) => {
      for (const candidate of candidates) {
        if (candidate === null || candidate === undefined) continue
        if (typeof candidate === 'object') {
          if (candidate.score !== null && candidate.score !== undefined) {
            return clampScore(candidate.score)
          }
          continue
        }
        return clampScore(candidate)
      }
      return null
    }

    // Prefer server Link Score keys (calibrated). Client keys are fallback only -
    // the old client dofollow formula capped at 100 once ratio ≥ 70%.
    const breakdown = authorityBreakdown
      ? {
          referringDomains: pickScore(
            authorityBreakdown.domainDiversity,
            authorityBreakdown.referringDomains
          ),
          averageDR: pickScore(
            industryRank,
            authorityBreakdown.domainRank,
            authorityBreakdown.averageDR
          ),
          dofollow: pickScore(
            authorityBreakdown.followNaturality,
            authorityBreakdown.dofollow
          ),
          backlinks: pickScore(
            authorityBreakdown.verifiedLinkQuality,
            authorityBreakdown.backlinks
          ),
        }
      : null

    const opportunities = []

    if (breakdown) {
      if (
        breakdown.referringDomains !== null &&
        breakdown.referringDomains < 70
      ) {
        opportunities.push({
          title: 'Increase referring domain diversity',
          detail: 'Earn links from more unique, relevant websites',
          gain: 5,
          priority: 'High',
        })
      }

      if (
        breakdown.averageDR !== null &&
        breakdown.averageDR < 60
      ) {
        opportunities.push({
          title: 'Earn higher-authority backlinks',
          detail: 'Prioritize links from stronger domains',
          gain: 4,
          priority: 'High',
        })
      }

      if (
        breakdown.dofollow !== null &&
        breakdown.dofollow < 75
      ) {
        opportunities.push({
          title: 'Balance dofollow vs nofollow mix',
          detail: 'A profile that is almost all dofollow can look unnatural',
          gain: 2,
          priority: 'Medium',
        })
      }

      if (
        breakdown.backlinks !== null &&
        breakdown.backlinks < 70
      ) {
        opportunities.push({
          title: 'Grow your live backlink profile',
          detail: 'Build more relevant, sustainable backlinks',
          gain: 3,
          priority: 'Medium',
        })
      }
    }

    const topAuthorityOpportunities =
      opportunities.slice(0, 3)

    const projectedAuthority =
      authority === null
        ? null
        : Math.min(
            100,
            authority +
              topAuthorityOpportunities.reduce(
                (sum, item) => sum + item.gain,
                0
              )
          )

    return {
      siteHealth,
      authority,
      domainRank: industryRank,
      linkScore,
      aiVisibility,
      aiVisibilitySource,
      overallScore,
      priorities,
      breakdown,
      topAuthorityOpportunities,
      projectedAuthority,
    }
  }, [auditData, multipageResults, authorityScore, domainRank, authorityDetails])

  const scoreColor = getScoreColor(data.overallScore)

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #E5E7EB',
      borderRadius: 14,
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      padding: '18px',
      marginBottom: '1rem',
    }}>

      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 16,
        flexWrap: 'wrap',
        marginBottom: 16,
      }}>
        <div>
          <div style={{
            fontSize: 11,
            fontWeight: 800,
            color: '#6B7280',
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
          }}>
            Decision Center
          </div>

          <div style={{
            fontSize: 12,
            color: '#9CA3AF',
            marginTop: 3,
          }}>
            What should you work on next?
          </div>
        </div>

        <div style={{
          textAlign: 'right',
        }}>
          <div style={{
            fontSize: 10,
            fontWeight: 700,
            color: '#9CA3AF',
            textTransform: 'uppercase',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            justifyContent: 'flex-end',
          }}>
            Digital Growth Score
            <ScoreInfoTip scoreKey="growthScore" />
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'flex-end',
            gap: 5,
          }}>
            <span style={{
              fontSize: 34,
              lineHeight: 1,
              fontWeight: 900,
              color: scoreColor,
            }}>
              {data.overallScore}
            </span>

            <span style={{
              fontSize: 13,
              color: '#9CA3AF',
            }}>
              /100
            </span>
          </div>

          <div style={{
            fontSize: 11,
            fontWeight: 700,
            color: scoreColor,
            marginTop: 3,
          }}>
            {getScoreLabel(data.overallScore)}
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div style={{
        display: 'flex',
        gap: 10,
        flexWrap: 'wrap',
        marginBottom: 18,
      }}>
        <MetricCard
          label="Site Health"
          value={data.siteHealth}
          scoreKey="siteHealth"
          hint="From latest site audit"
        />

        <MetricCard
          label="Domain Rank"
          value={data.domainRank}
          scoreKey="domainRank"
          hint="External domain authority · separate from Link Score"
        />

        <MetricCard
          label="Link Score"
          value={data.linkScore}
          scoreKey="linkScore"
          hint="In-app · verified backlinks"
        />

        <MetricCard
          label="AI Visibility"
          value={data.aiVisibility}
          scoreKey="aiVisibility"
          hint={
            data.aiVisibilitySource === 'engines'
              ? 'From AI engine citation tests'
              : data.aiVisibilitySource === 'mixed'
                ? 'Engines + AI Snippet / AEO'
                : data.aiVisibilitySource === 'audit'
                  ? 'From AI Snippet / AEO audit checks'
                  : 'Run audit or AI Visibility tests'
          }
        />
      </div>

      {/* Authority Intelligence */}
      <div style={{
        borderTop: '1px solid #F3F4F6',
        paddingTop: 16,
        marginTop: 4,
        marginBottom: 18,
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 12,
        }}>
          <div>
            <div style={{
              fontSize: 12,
              fontWeight: 800,
              color: '#374151',
            }}>
              Authority Intelligence
            </div>

            <div style={{
              fontSize: 11,
              color: '#9CA3AF',
              marginTop: 2,
            }}>
              External Domain Rank vs in-app Link Score - kept separate on purpose
            </div>
          </div>

          {data.linkScore !== null &&
           data.projectedAuthority !== null && (
            <div style={{
              textAlign: 'right',
              padding: '7px 11px',
              borderRadius: 9,
              background: '#F9FAFB',
              border: '1px solid #E5E7EB',
            }}>
              <div style={{
                fontSize: 9,
                color: '#9CA3AF',
                fontWeight: 700,
                textTransform: 'uppercase',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}>
                Link Score potential
                <ScoreInfoTip scoreKey="linkScorePotential" />
              </div>

              <div style={{
                fontSize: 14,
                fontWeight: 800,
                color: '#16A34A',
              }}>
                {data.linkScore} → {Math.min(
                  100,
                  data.linkScore +
                    data.topAuthorityOpportunities.reduce(
                      (sum, item) => sum + item.gain,
                      0
                    )
                )}
              </div>
            </div>
          )}
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.25fr)',
          gap: 12,
        }}>
          {/* Breakdown */}
          <div style={{
            border: '1px solid #E5E7EB',
            borderRadius: 10,
            padding: '12px 14px',
            background: '#fff',
          }}>
            {data.domainRank !== null && (
              <div style={{
                marginBottom: 12,
                padding: '10px 12px',
                borderRadius: 9,
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
              }}>
                <div style={{
                  fontSize: 9,
                  fontWeight: 800,
                  color: '#64748B',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: 6,
                }}>
                  External score
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  gap: 8,
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      Domain Rank
                      <ScoreInfoTip scoreKey="domainRank" />
                    </div>
                    <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>
                      External · not part of Link Score
                    </div>
                  </div>
                  <div style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: getScoreColor(data.domainRank),
                  }}>
                    {data.domainRank}
                    <span style={{ fontSize: 11, fontWeight: 500, color: '#94A3B8' }}>/100</span>
                  </div>
                </div>
              </div>
            )}

            <div style={{
              fontSize: 10,
              fontWeight: 800,
              color: '#6B7280',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 4,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}>
              Link Score breakdown
              <ScoreInfoTip scoreKey="linkScore" />
            </div>
            <div style={{
              fontSize: 10,
              color: '#9CA3AF',
              marginBottom: 6,
            }}>
              In-app composite from your verified backlinks
            </div>

            {data.breakdown ? (
              <>
                <AuthorityBreakdownRow
                  label="Referring Domains"
                  value={data.breakdown.referringDomains}
                  scoreKey="referringDomains"
                />

                <AuthorityBreakdownRow
                  label="Follow Naturality"
                  value={data.breakdown.dofollow}
                  scoreKey="followNaturality"
                />

                <AuthorityBreakdownRow
                  label="Link Quality"
                  value={data.breakdown.backlinks}
                  scoreKey="linkQualityBreakdown"
                />
              </>
            ) : (
              <div style={{
                fontSize: 11,
                color: '#9CA3AF',
                padding: '14px 0',
              }}>
                Link Score breakdown will appear after the latest authority refresh.
              </div>
            )}
          </div>

          {/* Opportunities */}
          <div style={{
            border: '1px solid #E5E7EB',
            borderRadius: 10,
            padding: '12px 14px',
            background: '#fff',
          }}>
            <div style={{
              fontSize: 10,
              fontWeight: 800,
              color: '#6B7280',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 8,
            }}>
              Top Opportunities
            </div>

            {data.topAuthorityOpportunities.length > 0 ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}>
                {data.topAuthorityOpportunities.map((item, index) => (
                  <div
                    key={`${item.title}-${index}`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '24px 1fr auto',
                      gap: 9,
                      alignItems: 'center',
                      padding: '8px 9px',
                      borderRadius: 8,
                      background: '#FAFAFA',
                    }}
                  >
                    <div style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: item.priority === 'High'
                        ? '#FEF2F2'
                        : '#FFFBEB',
                      color: item.priority === 'High'
                        ? '#DC2626'
                        : '#D97706',
                      fontSize: 10,
                      fontWeight: 800,
                    }}>
                      {index + 1}
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#374151',
                      }}>
                        {item.title}
                      </div>

                      <div style={{
                        fontSize: 10,
                        color: '#9CA3AF',
                        marginTop: 2,
                      }}>
                        {item.detail}
                      </div>
                    </div>

                    <div style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: '#16A34A',
                      whiteSpace: 'nowrap',
                    }}>
                      +{item.gain} pts
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{
                padding: '12px',
                borderRadius: 8,
                background: '#F0FDF4',
                color: '#15803D',
                fontSize: 11,
                fontWeight: 600,
              }}>
                Your current authority signals are already well balanced.
              </div>
            )}

            <div style={{
              marginTop: 10,
              padding: '9px 10px',
              borderRadius: 8,
              background: '#EFF6FF',
              color: '#1D4ED8',
              fontSize: 10,
              lineHeight: 1.5,
            }}>
              <strong>Recommended next move:</strong>{' '}
              {data.topAuthorityOpportunities[0]?.detail ||
               'Keep growing relevant, high-quality referring domains.'}
            </div>
          </div>
        </div>
      </div>
      {/* Mission */}
      <div style={{
        borderTop: '1px solid #F3F4F6',
        paddingTop: 15,
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          marginBottom: 10,
        }}>
          <div>
            <div style={{
              fontSize: 12,
              fontWeight: 800,
              color: '#374151',
            }}>
              Today's Mission
            </div>

            <div style={{
              fontSize: 11,
              color: '#9CA3AF',
              marginTop: 2,
            }}>
              Focus on the highest-impact issues first
            </div>
          </div>

          <div style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#2563EB',
            background: '#EFF6FF',
            padding: '4px 9px',
            borderRadius: 20,
          }}>
            {data.priorities.length} priorities
          </div>
        </div>

        {data.priorities.length === 0 ? (
          <div style={{
            padding: '14px',
            borderRadius: 9,
            background: '#F0FDF4',
            color: '#15803D',
            fontSize: 12,
            fontWeight: 600,
          }}>
            No critical priorities detected in the latest full-site audit.
          </div>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 7,
          }}>
            {data.priorities.map((issue, index) => {
              const isCritical = issue.status === 'error'

              return (
                <div
                  key={`${issue.check || 'issue'}-${index}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    border: '1px solid #F3F4F6',
                    borderRadius: 9,
                    background: '#FAFAFA',
                  }}
                >
                  <div style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isCritical
                      ? '#FEF2F2'
                      : '#FFFBEB',
                    color: isCritical
                      ? '#DC2626'
                      : '#D97706',
                    fontSize: 10,
                    fontWeight: 800,
                    flexShrink: 0,
                  }}>
                    {index + 1}
                  </div>

                  <div style={{
                    minWidth: 0,
                    flex: 1,
                  }}>
                    <div style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#374151',
                    }}>
                      {issue.title ||
                       issue.sampleMessage ||
                       issue.check ||
                       'SEO issue'}
                    </div>

                    <div style={{
                      fontSize: 10,
                      color: '#9CA3AF',
                      marginTop: 2,
                    }}>
                      {issue.category || 'SEO'}
                    </div>
                  </div>

                  <div style={{
                    textAlign: 'right',
                    flexShrink: 0,
                  }}>
                    <div style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: isCritical
                        ? '#DC2626'
                        : '#D97706',
                    }}>
                      {isCritical ? 'Critical' : 'Warning'}
                    </div>

                    <div style={{
                      fontSize: 10,
                      color: '#9CA3AF',
                      marginTop: 2,
                    }}>
                      {Number(issue.count || 0)} page
                      {Number(issue.count || 0) === 1 ? '' : 's'}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}