import { useEffect, useMemo, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronLeft, faChevronRight, faCheck } from '@fortawesome/free-solid-svg-icons'
import './MobileAuditResults.css'

const safeNumber = (value) => {
  const number = Number(value)

  return Number.isFinite(number)
    ? Math.round(number)
    : null
}

const scoreTone = (score) => {
  const value = safeNumber(score)

  if (value == null) return 'neutral'
  if (value >= 80) return 'good'
  if (value >= 60) return 'fair'

  return 'poor'
}

const scoreLabel = (score) => {
  const value = safeNumber(score)

  if (value == null) return 'Not available'
  if (value >= 80) return 'Good'
  if (value >= 60) return 'Needs attention'

  return 'Poor'
}

const issueTitle = (issue) =>
  issue?.message ||
  issue?.sampleMessage ||
  issue?.title ||
  issue?.check ||
  'SEO finding'

const issueCategory = (issue) =>
  issue?.category ||
  'SEO'

const issueSeverity = (issue) => {
  if (issue?.status === 'error') {
    return 'critical'
  }

  if (issue?.status === 'warning') {
    return 'warning'
  }

  return 'passed'
}

const categoryScore = (
  categories,
  wantedNames
) => {
  const normalizedWanted =
    wantedNames.map((name) =>
      name.toLowerCase()
    )

  const found =
    (categories || []).find(
      (category) =>
        normalizedWanted.some(
          (wanted) =>
            String(
              category?.name || ''
            )
              .toLowerCase()
              .includes(wanted)
        )
    )

  return safeNumber(found?.score)
}

export default function MobileAuditResults({
  auditData,
  multipageResults,
  categories,
  tabOptions,
  activeTab,
  onTabChange,
  visibleIssues,
  onIssueOpen,
  onViewCrawledPages,
}) {
  const [expandedKey, setExpandedKey] =
    useState(null)

  // DEVNDESPRO_SMART_TAB_STATE_FINAL
  const tabScrollerRef = useRef(null)
  const [canScrollTabsLeft, setCanScrollTabsLeft] = useState(false)
  const [canScrollTabsRight, setCanScrollTabsRight] = useState(false)

  const updateTabScrollState = () => {
    const el = tabScrollerRef.current
    if (!el) return

    const maxScrollLeft = Math.max(0, el.scrollWidth - el.clientWidth)

    setCanScrollTabsLeft(el.scrollLeft > 4)
    setCanScrollTabsRight(el.scrollLeft < maxScrollLeft - 4)
  }

  const scrollTabs = (direction) => {
    const el = tabScrollerRef.current
    if (!el) return

    const amount = Math.max(180, Math.round(el.clientWidth * 0.70))

    el.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    })
  }


  const pagesTotal =
    safeNumber(
      multipageResults?.pagesTotal
    ) ??
    safeNumber(
      multipageResults?.pages?.length
    ) ??
    0

  const health =
    safeNumber(
      multipageResults?.siteHealthPct
    ) ??
    safeNumber(
      multipageResults?.score
    ) ??
    safeNumber(
      auditData?.score
    )

  const issueSummary =
    Array.isArray(
      multipageResults?.issueSummary
    )
      ? multipageResults.issueSummary
      : []

  /*
   * Prefer explicit server counts when available.
   * Fall back to issue-type counts rather than inventing
   * page-level values.
   */
  const criticalCount =
    safeNumber(
      multipageResults?.criticalCount
    ) ??
    safeNumber(
      multipageResults?.errors
    ) ??
    issueSummary.filter(
      (item) =>
        item.status === 'error'
    ).length

  const warningCount =
    safeNumber(
      multipageResults?.warningCount
    ) ??
    safeNumber(
      multipageResults?.warnings
    ) ??
    issueSummary.filter(
      (item) =>
        item.status === 'warning'
    ).length

  const healthyCount =
    safeNumber(
      multipageResults?.healthyCount
    ) ??
    safeNumber(
      multipageResults?.passed
    )

  const onPageScore =
    categoryScore(
      categories,
      ['on-page seo']
    )

  const technicalScore =
    categoryScore(
      categories,
      [
        'technical seo',
        'server & security',
      ]
    )

  const contentScore =
    categoryScore(
      categories,
      ['content quality']
    )

  const summaryScores = [
    {
      label: 'On-Page SEO',
      value: onPageScore,
    },
    {
      label: 'Technical SEO',
      value: technicalScore,
    },
    {
      label: 'Content',
      value: contentScore,
    },
  ]

  const mobileTabs =
    useMemo(() => {
      const preferred = [
        'all',
        'errors',
        'warnings',
        'passed',
      ]

      const sorted = []

      preferred.forEach((id) => {
        const tab =
          (tabOptions || []).find(
            (item) => item.id === id
          )

        if (tab) {
          sorted.push(tab)
        }
      })

      ;(tabOptions || []).forEach(
        (tab) => {
          if (
            !preferred.includes(tab.id)
          ) {
            sorted.push(tab)
          }
        }
      )

      return sorted
    }, [tabOptions])

  // DEVNDESPRO_SMART_TAB_EFFECT_FINAL
  useEffect(() => {
    const el = tabScrollerRef.current
    if (!el) return

    const handleScroll = () => updateTabScrollState()
    const handleResize = () => updateTabScrollState()

    updateTabScrollState()

    el.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleResize)

    const timer = window.setTimeout(updateTabScrollState, 80)

    return () => {
      window.clearTimeout(timer)
      el.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleResize)
    }
  }, [mobileTabs])


  const toggleIssue = (issue) => {
    const key =
      issue?._idx ??
      issue?.check ??
      issueTitle(issue)

    setExpandedKey(
      expandedKey === key
        ? null
        : key
    )

    onIssueOpen?.(issue)
  }

  return (
    <div className="mars-root">

      {/* =============================================
          PHASE 4 - FULL SITE AUDIT
         ============================================= */}

      {multipageResults && (
        <section className="mars-card mars-full-audit">

          <header className="mars-card-heading">

            <div>
              <span className="mars-kicker">
                Full Site Audit
              </span>

              <h2>
                Audit Overview
              </h2>

              <p>
                {pagesTotal > 0
                  ? `${pagesTotal} pages crawled`
                  : 'Latest full-site scan'}
              </p>
            </div>

            <span className="mars-beta">
              BETA
            </span>

          </header>


          <div className="mars-health-area">

            <div
              className={
                `mars-health-ring ${
                  scoreTone(health)
                }`
              }
              style={{
                '--mars-score':
                  health ?? 0,
              }}
            >
              <div className="mars-health-inner">

                <strong>
                  {health ?? '-'}
                </strong>

                <span>
                  /100
                </span>

              </div>
            </div>


            <div className="mars-health-copy">

              <span>
                Site Health
              </span>

              <strong
                className={
                  scoreTone(health)
                }
              >
                {scoreLabel(health)}
              </strong>

              <small>
                Based on the latest audit
              </small>

            </div>

          </div>


          <div className="mars-status-grid">

            <div className="mars-status-card critical">

              <span className="mars-status-dot" />

              <strong>
                {criticalCount ?? 0}
              </strong>

              <small>
                Critical
              </small>

            </div>


            <div className="mars-status-card warning">

              <span className="mars-status-dot" />

              <strong>
                {warningCount ?? 0}
              </strong>

              <small>
                Warnings
              </small>

            </div>


            <div className="mars-status-card healthy">

              <span className="mars-status-dot" />

              <strong>
                {healthyCount ?? '-'}
              </strong>

              <small>
                Healthy
              </small>

            </div>

          </div>


          <div className="mars-category-scores">

            {summaryScores.map(
              ({ label, value }) => (

                <div
                  className="mars-category-score"
                  key={label}
                >

                  <div>
                    <span>
                      {label}
                    </span>

                    <strong>
                      {value ?? '-'}
                    </strong>
                  </div>

                  <div className="mars-score-track">

                    <span
                      className={
                        scoreTone(value)
                      }
                      style={{
                        width:
                          value == null
                            ? '0%'
                            : `${Math.max(
                                0,
                                Math.min(
                                  value,
                                  100
                                )
                              )}%`,
                      }}
                    />

                  </div>

                </div>
              )
            )}

          </div>


          {pagesTotal > 0 && (
            <button
              type="button"
              className="mars-view-pages"
              onClick={
                onViewCrawledPages
              }
            >
              <span>
                View crawled pages
              </span>

              <strong>
                {pagesTotal}
              </strong>

              <FontAwesomeIcon
                className="mars-row-chevron"
                icon={faChevronRight}
                aria-hidden="true"
              />
            </button>
          )}

        </section>
      )}


      {/* =============================================
          PHASE 5 - ALL ISSUES
         ============================================= */}

      <section
        className="mars-card mars-issues"
        id="mobile-audit-issues"
      >

        <header className="mars-card-heading">

          <div>
            <span className="mars-kicker">
              Audit Findings
            </span>

            <h2>
              All Issues
            </h2>

            <p>
              Review findings by severity
            </p>
          </div>

          <span className="mars-total-issues">
            {
              (tabOptions || [])
                .find(
                  (tab) =>
                    tab.id === 'all'
                )
                ?.count ?? 0
            }
          </span>

        </header>


        {/* DEVNDESPRO_SMART_TAB_UI_FINAL */}
        <div className={`mars-tab-shell ${canScrollTabsLeft ? 'can-scroll-left' : ''} ${canScrollTabsRight ? 'can-scroll-right' : ''}`}>

          {canScrollTabsLeft && (
            <button
              type="button"
              className="mars-tab-arrow mars-tab-arrow-left"
              aria-label="Scroll filters left"
              onClick={() => scrollTabs('left')}
            >
              <FontAwesomeIcon icon={faChevronLeft} aria-hidden="true" />
            </button>
          )}

          <div ref={tabScrollerRef} className="mars-tab-scroller">

          {mobileTabs.map((tab) => {

            const selected =
              activeTab === tab.id

            return (
              <button
                type="button"
                key={tab.id}
                className={
                  `mars-filter-chip ${
                    selected
                      ? 'selected'
                      : ''
                  } ${
                    tab.id
                  }`
                }
                onClick={() =>
                  onTabChange?.(tab.id)
                }
              >

                <span>
                  {tab.label}
                </span>

                {tab.count > 0 && (
                  <strong>
                    {tab.count}
                  </strong>
                )}

              </button>
            )
          })}

        </div>

          {canScrollTabsRight && (
            <button
              type="button"
              className="mars-tab-arrow mars-tab-arrow-right"
              aria-label="Scroll filters right"
              onClick={() => scrollTabs('right')}
            >
              <FontAwesomeIcon icon={faChevronRight} aria-hidden="true" />
            </button>
          )}

        </div>


        <div className="mars-issue-list">

          {!visibleIssues?.length ? (

            <div className="mars-no-issues">

              <div>
                OK
              </div>

              <strong>
                Nothing here
              </strong>

              <span>
                No findings in this category.
              </span>

            </div>

          ) : (

            visibleIssues.map(
              (issue, index) => {

                const key =
                  issue?._idx ??
                  issue?.check ??
                  index

                const severity =
                  issueSeverity(issue)

                const expanded =
                  expandedKey === key

                const impact =
                  String(
                    issue?.impact ||
                    ''
                  ).trim()

                return (
                  <article
                    className={
                      `mars-issue-row ${
                        severity
                      }`
                    }
                    key={key}
                  >

                    <button
                      type="button"
                      className="mars-issue-main"
                      onClick={() =>
                        toggleIssue(issue)
                      }
                    >

                      <span
                        className={
                          `mars-severity-icon ${
                            severity
                          }`
                        }
                      >
                        {severity === 'passed' ? 'OK' : '!'}
                      </span>


                      <span className="mars-issue-copy">

                        <strong>
                          {issueTitle(issue)}
                        </strong>

                        <small>
                          {issueCategory(issue)}
                        </small>

                      </span>


                      <span className="mars-issue-right">

                        <em
                          className={
                            severity
                          }
                        >
                          {
                            severity ===
                            'critical'
                              ? 'Critical'
                              : severity ===
                                'warning'
                                ? 'Warning'
                                : 'Passed'
                          }
                        </em>

                        {impact && (
                          <small>
                            {impact} impact
                          </small>
                        )}

                        <b
                          className={
                            expanded
                              ? 'expanded'
                              : ''
                          }
                          aria-hidden="true"
                        >
                          
                        </b>

                      </span>

                    </button>


                    {expanded && (

                      <div className="mars-issue-detail">

                        {issue?.recommendation && (
                          <div>
                            <strong>
                              Recommendation
                            </strong>

                            <p>
                              {
                                issue.recommendation
                              }
                            </p>
                          </div>
                        )}


                        {issue?.details && (
                          <div>
                            <strong>
                              Details
                            </strong>

                            <p>
                              {String(
                                issue.details
                              )}
                            </p>
                          </div>
                        )}


                        {!issue?.recommendation &&
                          !issue?.details && (
                            <p>
                              Tap this issue in the
                              detailed audit view to
                              review the full finding
                              and recommended fix.
                            </p>
                          )}

                      </div>

                    )}

                  </article>
                )
              }
            )

          )}

        </div>

      </section>

    </div>
  )
}
