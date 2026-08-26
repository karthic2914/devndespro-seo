import './MobileAuditInsights.css'

const safeNumber = (value) => {
  const number = Number(value)

  return Number.isFinite(number)
    ? Math.round(number)
    : null
}

const scoreTone = (value) => {
  const score = safeNumber(value)

  if (score == null) return 'neutral'
  if (score >= 80) return 'good'
  if (score >= 60) return 'fair'

  return 'poor'
}

const getCategoryScore = (
  categories,
  names
) => {
  const wanted =
    names.map((name) =>
      name.toLowerCase()
    )

  const category =
    (categories || []).find(
      (item) => {
        const name =
          String(
            item?.name || ''
          ).toLowerCase()

        return wanted.some(
          (search) =>
            name.includes(search)
        )
      }
    )

  return safeNumber(
    category?.score
  )
}

export default function MobileAuditInsights({
  auditData,
  categories,
  cronEnabled,
  onCronToggle,

  domainRank,
  authorityScore,
  authorityUpdatedAt,
  refreshingAuthority,
  onRefreshAuthority,

  crawl,
  fmtMs,
  fmtBytes,
}) {
  const aiSnippetScore =
    getCategoryScore(
      categories,
      ['ai snippet']
    )

  const aeoScore =
    getCategoryScore(
      categories,
      ['aeo']
    )

  const chatgptScore =
    safeNumber(
      auditData?.chatgptScore
    )

  const claudeScore =
    safeNumber(
      auditData?.claudeScore
    )

  const engines = [
    {
      name: 'ChatGPT',
      value: chatgptScore,
      status:
        chatgptScore == null
          ? 'Not tested'
          : 'Measured',
    },
    {
      name: 'Claude',
      value: claudeScore,
      status:
        claudeScore == null
          ? 'Not tested'
          : 'Measured',
    },
    {
      name: 'Perplexity',
      value: null,
      status: 'Coming soon',
    },
    {
      name: 'Gemini',
      value: null,
      status: 'Coming soon',
    },
  ]

  const crawlItems =
    crawl
      ? [
          {
            label: 'Status',
            value:
              crawl.statusCode ||
              '-',
          },
          {
            label: 'Response',
            value:
              fmtMs(
                crawl.responseTimeMs
              ),
          },
          {
            label: 'File size',
            value:
              fmtBytes(
                crawl.fileSizeBytes
              ),
          },
          {
            label: 'Language',
            value:
              crawl.language ||
              '-',
          },
          {
            label: 'Words',
            value:
              Number(
                crawl.wordCount || 0
              ).toLocaleString(),
          },
          {
            label: 'Internal links',
            value:
              Number(
                crawl.internalLinks ||
                0
              ).toLocaleString(),
          },
          {
            label: 'External links',
            value:
              Number(
                crawl.externalLinks ||
                0
              ).toLocaleString(),
          },
        ]
      : []

  return (
    <div className="mais-root">

      {/* ================================================
          PHASE 6 â€” AI VISIBILITY
         ================================================ */}

      <section className="mais-card">

        <header className="mais-heading">

          <div>
            <span className="mais-kicker">
              AI Search
            </span>

            <h2>
              AI Visibility
            </h2>

            <p>
              How well your site is prepared for AI-driven discovery
            </p>
          </div>

          <label className="mais-toggle">

            <input
              type="checkbox"
              checked={Boolean(
                cronEnabled
              )}
              onChange={(event) =>
                onCronToggle?.(
                  event.target.checked
                )
              }
            />

            <span />

          </label>

        </header>


        <div className="mais-ai-score-grid">

          <div
            className={
              `mais-primary-score ${
                scoreTone(
                  aiSnippetScore
                )
              }`
            }
          >

            <span>
              AI Snippet
            </span>

            <strong>
              {
                aiSnippetScore ??
                'â€“'
              }

              {aiSnippetScore != null && (
                <small>
                  /100
                </small>
              )}
            </strong>

            <em>
              Search answer readiness
            </em>

          </div>


          <div
            className={
              `mais-primary-score ${
                scoreTone(
                  aeoScore
                )
              }`
            }
          >

            <span>
              AEO
            </span>

            <strong>
              {aeoScore ?? 'â€“'}

              {aeoScore != null && (
                <small>
                  /100
                </small>
              )}
            </strong>

            <em>
              Answer engine optimization
            </em>

          </div>

        </div>


        <div className="mais-engine-list">

          {engines.map(
            (engine) => (

              <div
                className="mais-engine-row"
                key={engine.name}
              >

                <div>

                  <strong>
                    {engine.name}
                  </strong>

                  <small>
                    {engine.status}
                  </small>

                </div>


                {engine.value != null ? (

                  <span
                    className={
                      scoreTone(
                        engine.value
                      )
                    }
                  >
                    {engine.value}
                    <small>/100</small>
                  </span>

                ) : (

                  <em>
                    {
                      engine.status
                    }
                  </em>

                )}

              </div>

            )
          )}

        </div>


        <div className="mais-tracking-note">

          <span>
            Daily tracking
          </span>

          <strong>
            {
              cronEnabled
                ? 'On'
                : 'Off'
            }
          </strong>

        </div>

      </section>


      {/* ================================================
          PHASE 7 â€” AUTHORITY
         ================================================ */}

      <section className="mais-card">

        <header className="mais-heading">

          <div>
            <span className="mais-kicker">
              Authority
            </span>

            <h2>
              Domain Authority
            </h2>

            <p>
              External authority and verified backlink strength
            </p>
          </div>


          <button
            type="button"
            className="mais-refresh"
            onClick={
              onRefreshAuthority
            }
            disabled={
              refreshingAuthority
            }
          >
            <span
              className={
                refreshingAuthority
                  ? 'spinning'
                  : ''
              }
            >
              â†»
            </span>

            {
              refreshingAuthority
                ? 'Updating'
                : 'Refresh'
            }
          </button>

        </header>


        <div className="mais-authority-grid">

          <div
            className={
              `mais-authority-score ${
                scoreTone(
                  domainRank
                )
              }`
            }
          >

            <span>
              Domain Rank
            </span>

            <strong>
              {
                domainRank ??
                'â€“'
              }

              {domainRank != null && (
                <small>
                  /100
                </small>
              )}
            </strong>

            <em>
              External authority
            </em>

          </div>


          <div
            className={
              `mais-authority-score ${
                scoreTone(
                  authorityScore
                )
              }`
            }
          >

            <span>
              Link Score
            </span>

            <strong>
              {
                authorityScore ??
                'â€“'
              }

              {authorityScore != null && (
                <small>
                  /100
                </small>
              )}
            </strong>

            <em>
              Verified backlink composite
            </em>

          </div>

        </div>


        {authorityUpdatedAt && (

          <div className="mais-updated">

            Updated{' '}
            {
              new Date(
                authorityUpdatedAt
              ).toLocaleDateString(
                'en-GB',
                {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                }
              )
            }

          </div>

        )}

      </section>


      {/* ================================================
          PHASE 7 â€” CRAWL SNAPSHOT
         ================================================ */}

      {crawl && (

        <section className="mais-card">

          <header className="mais-heading">

            <div>
              <span className="mais-kicker">
                Technical
              </span>

              <h2>
                Crawl Snapshot
              </h2>

              <p>
                Key technical data from the latest crawl
              </p>
            </div>

          </header>


          <div className="mais-crawl-grid">

            {crawlItems.map(
              (item) => (

                <div
                  className="mais-crawl-item"
                  key={item.label}
                >

                  <span>
                    {item.label}
                  </span>

                  <strong>
                    {item.value}
                  </strong>

                </div>

              )
            )}

          </div>


          <div className="mais-crawl-wide">

            <div>

              <span>
                robots.txt
              </span>

              <strong
                className={
                  crawl.robots?.valid
                    ? 'good'
                    : 'warning'
                }
              >
                {
                  crawl.robots?.valid
                    ? 'Valid'
                    : 'Needs Fix'
                }
              </strong>

            </div>


            <div>

              <span>
                Final URL
              </span>

              <strong
                className="mais-final-url"
                title={
                  crawl.finalUrl ||
                  ''
                }
              >
                {
                  crawl.finalUrl ||
                  '-'
                }
              </strong>

            </div>

          </div>


          {!crawl.robots?.valid &&
            Array.isArray(
              crawl.robots?.issues
            ) &&
            crawl.robots.issues.length >
              0 && (

              <div className="mais-robots-warning">

                <strong>
                  robots.txt issue
                </strong>

                <span>
                  {
                    crawl
                      .robots
                      .issues[0]
                      .message
                  }

                  {
                    Number(
                      crawl
                        .robots
                        .issues[0]
                        .line
                    ) > 0
                      ? ` (line ${
                          crawl
                            .robots
                            .issues[0]
                            .line
                        })`
                      : ''
                  }
                </span>

              </div>

            )}

        </section>

      )}

    </div>
  )
}