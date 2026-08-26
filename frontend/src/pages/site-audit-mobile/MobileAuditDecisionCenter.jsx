import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronRight } from '@fortawesome/free-solid-svg-icons'
import './MobileAuditDecisionCenter.css'

const safeNumber = (value) => {
  const number = Number(value)

  return Number.isFinite(number)
    ? Math.round(number)
    : null
}

const scoreTone = (value) => {
  const number = safeNumber(value)

  if (number == null) {
    return 'neutral'
  }

  if (number >= 80) {
    return 'good'
  }

  if (number >= 60) {
    return 'fair'
  }

  return 'poor'
}

const scoreLabel = (value) => {
  const number = safeNumber(value)

  if (number == null) {
    return 'Not available'
  }

  if (number >= 80) {
    return 'Good'
  }

  if (number >= 60) {
    return 'Fair'
  }

  return 'Needs attention'
}

const metricValue = (value) => {
  const number = safeNumber(value)

  return number == null
    ? 'â€“'
    : number
}

const getAiVisibilityScore = (
  auditData,
  categories
) => {
  const directCandidates = [
    auditData?.aiVisibilityScore,
    auditData?.ai_visibility_score,
    auditData?.aiScore,
    auditData?.ai_score,
  ]

  for (const candidate of directCandidates) {
    const value = safeNumber(candidate)

    if (value != null) {
      return value
    }
  }

  const aiCategories = (categories || []).filter(
    (category) => {
      const name =
        String(category?.name || '')
          .toLowerCase()

      return (
        name.includes('ai snippet') ||
        name === 'aeo'
      )
    }
  )

  if (!aiCategories.length) {
    return null
  }

  const values = aiCategories
    .map((category) =>
      safeNumber(category.score)
    )
    .filter((value) => value != null)

  if (!values.length) {
    return null
  }

  return Math.round(
    values.reduce(
      (sum, value) => sum + value,
      0
    ) / values.length
  )
}

const getGrowthScore = ({
  auditData,
  multipageResults,
}) => {
  const candidates = [
    auditData?.digitalGrowthScore,
    auditData?.digital_growth_score,
    multipageResults?.digitalGrowthScore,
    multipageResults?.digital_growth_score,
  ]

  for (const candidate of candidates) {
    const value = safeNumber(candidate)

    if (value != null) {
      return value
    }
  }

  return null
}

export default function MobileAuditDecisionCenter({
  auditData,
  multipageResults,
  authorityScore,
  domainRank,
  categories,
  allIssues,
  onIssueOpen,
}) {
  const siteHealth =
    safeNumber(
      multipageResults?.siteHealthPct
    ) ??
    safeNumber(
      multipageResults?.score
    ) ??
    safeNumber(
      auditData?.score
    )

  const linkScore =
    safeNumber(authorityScore)

  const externalRank =
    safeNumber(domainRank)

  const aiVisibility =
    getAiVisibilityScore(
      auditData,
      categories
    )

  const growthScore =
    getGrowthScore({
      auditData,
      multipageResults,
    })

  const priorityIssues =
    (allIssues || [])
      .filter(
        (issue) =>
          issue.status === 'error' ||
          issue.status === 'warning'
      )
      .slice(0, 3)

  const metrics = [
    {
      label: 'Site Health',
      value: siteHealth,
      hint: 'Latest audit',
    },
    {
      label: 'Domain Rank',
      value: externalRank,
      hint: 'External authority',
    },
    {
      label: 'Link Score',
      value: linkScore,
      hint: 'Verified backlinks',
    },
    {
      label: 'AI Visibility',
      value: aiVisibility,
      hint: 'AI audit signals',
    },
  ]

  return (
    <div className="msadc-root">

      {/* ===============================================
          DECISION CENTER
         =============================================== */}

      <section className="msadc-card msadc-decision">

        <header className="msadc-section-header">

          <div>
            <h2>
              Decision Center
            </h2>

            <p>
              Your website at a glance
            </p>
          </div>

          {growthScore != null && (
            <div
              className={
                `msadc-growth-score ${
                  scoreTone(growthScore)
                }`
              }
            >
              <span>
                Digital Growth
              </span>

              <strong>
                {growthScore}
                <small>/100</small>
              </strong>

              <em>
                {scoreLabel(growthScore)}
              </em>
            </div>
          )}

        </header>


        <div className="msadc-metric-grid">

          {metrics.map((metric) => {

            const tone =
              scoreTone(metric.value)

            return (
              <div
                className={
                  `msadc-metric-card ${tone}`
                }
                key={metric.label}
              >

                <div className="msadc-metric-label">
                  {metric.label}
                </div>

                <div className="msadc-metric-number">
                  {metricValue(metric.value)}

                  {safeNumber(metric.value) != null && (
                    <small>
                      /100
                    </small>
                  )}
                </div>

                <div className="msadc-metric-status">
                  {scoreLabel(metric.value)}
                </div>

                <div className="msadc-metric-hint">
                  {metric.hint}
                </div>

              </div>
            )
          })}

        </div>

      </section>


      {/* ===============================================
          TODAY'S MISSION
         =============================================== */}

      <section className="msadc-card msadc-mission">

        <header className="msadc-mission-header">

          <div>
            <h2>
              Today's Mission
            </h2>

            <p>
              Fix the highest-impact issues first
            </p>
          </div>

          <span className="msadc-priority-count">
            {priorityIssues.length} priorities
          </span>

        </header>


        {priorityIssues.length > 0 ? (

          <div className="msadc-mission-list">

            {priorityIssues.map(
              (issue, index) => {

                const critical =
                  issue.status === 'error'

                const pages =
                  Number(
                    issue.count ||
                    issue.pageCount ||
                    issue.pagesAffected ||
                    0
                  )

                return (
                  <button
                    type="button"
                    className="msadc-mission-row"
                    key={
                      issue._idx ??
                      issue.check ??
                      index
                    }
                    onClick={() =>
                      onIssueOpen?.(issue)
                    }
                  >

                    <span
                      className={
                        `msadc-mission-number ${
                          critical
                            ? 'critical'
                            : 'warning'
                        }`
                      }
                    >
                      {index + 1}
                    </span>


                    <span className="msadc-mission-copy">

                      <strong>
                        {
                          issue.message ||
                          issue.sampleMessage ||
                          issue.title ||
                          issue.check ||
                          'SEO issue'
                        }
                      </strong>

                      <small>
                        {
                          issue.category ||
                          'SEO'
                        }
                      </small>

                    </span>


                    <span className="msadc-mission-meta">

                      <em
                        className={
                          critical
                            ? 'critical'
                            : 'warning'
                        }
                      >
                        {
                          critical
                            ? 'Critical'
                            : 'Warning'
                        }
                      </em>

                      {pages > 0 && (
                        <small>
                          {pages}{' '}
                          {pages === 1
                            ? 'page'
                            : 'pages'}
                        </small>
                      )}

                      <FontAwesomeIcon
                        className="msadc-row-chevron"
                        icon={faChevronRight}
                        aria-hidden="true"
                      />

                    </span>

                  </button>
                )
              }
            )}

          </div>

        ) : (

          <div className="msadc-empty">

            <div className="msadc-empty-icon">
              âœ“
            </div>

            <strong>
              No urgent issues
            </strong>

            <span>
              Nothing critical needs your attention right now.
            </span>

          </div>

        )}

      </section>

    </div>
  )
}