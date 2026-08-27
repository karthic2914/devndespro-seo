import { useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faChartLine,
  faMagnifyingGlass,
  faPlus,
  faRotate,
  faWandMagicSparkles,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import api from '../../utils/api'
import toast from '../../utils/toast'
import MobileBottomSelect from './MobileBottomSelect'

const LOCATIONS = [
  { code: 2578, name: 'Norway' },
  { code: 2840, name: 'United States' },
  { code: 2826, name: 'United Kingdom' },
  { code: 2036, name: 'Australia' },
  { code: 2124, name: 'Canada' },
  { code: 2276, name: 'Germany' },
  { code: 2356, name: 'India' },
]

function OppPill({ label }) {
  if (!label) return null

  const styles = {
    'Quick Win': ['#dcfce7', '#15803d'],
    'High Value': ['#e0f2fe', '#0369a1'],
    'Long Tail': ['#ede9fe', '#6d28d9'],
    'High Competition': ['#fef3c7', '#b45309'],
    'Low Priority': ['#f1f5f9', '#64748b'],
    Standard: ['#f8fafc', '#475569'],
  }

  const [background, color] = styles[label] || styles.Standard

  return (
    <span
      className="kwm-gap-opportunity"
      style={{ background, color }}
    >
      {label}
    </span>
  )
}

export default function MobileKeywordGap({ siteId, onAdded }) {
  const [youDomain, setYouDomain] = useState('')
  const [inputs, setInputs] = useState([''])
  const [locationCode, setLocationCode] = useState(2578)
  const [running, setRunning] = useState(false)
  const [discovering, setDiscovering] = useState(false)
  const [result, setResult] = useState(null)
  const [view, setView] = useState('missing')
  const [addingKey, setAddingKey] = useState(null)
  const [trackedKeywordKeys, setTrackedKeywordKeys] = useState(() => new Set())

  useEffect(() => {
    if (!siteId) return

    Promise.all([
      api.get(`/sites/${siteId}`).catch(() => ({ data: null })),
      api.get(`/sites/${siteId}/competitors`).catch(() => ({ data: [] })),
    ]).then(([siteRes, compRes]) => {
      const url = siteRes.data?.url || ''

      try {
        const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`
        setYouDomain(new URL(normalized).hostname.replace(/^www\./i, ''))
      } catch {
        setYouDomain(url)
      }

      const list = Array.isArray(compRes.data) ? compRes.data : []

      if (list.length) {
        const values = list
          .slice(0, 4)
          .map((item) => item.url || item.name || '')
          .filter(Boolean)

        setInputs(values.length ? values : [''])
      }
    })
  }, [siteId])

  const normalizeDomain = (raw) => {
    const value = String(raw || '').trim()
    if (!value) return ''

    const normalized = /^https?:\/\//i.test(value)
      ? value
      : `https://${value}`

    return new URL(normalized)
      .hostname
      .replace(/^www\./i, '')
      .toLowerCase()
  }

  const filledCompetitors = useMemo(
    () => inputs.map((value) => String(value || '').trim()).filter(Boolean).length,
    [inputs]
  )

  const autoDiscover = async () => {
    setDiscovering(true)

    try {
      const { data } = await api.post(
        `/sites/${siteId}/competitors/auto-discover`,
        { prune: true }
      )

      const list = Array.isArray(data?.competitors) ? data.competitors : []

      const values = list
        .slice(0, 4)
        .map((item) => item.url || item.name || '')
        .filter(Boolean)

      setInputs(values.length ? values : [''])

      toast.success(
        data?.inserted || data?.pruned
          ? 'Competitors refreshed'
          : 'Competitors ready'
      )
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Auto-discover failed')
    }

    setDiscovering(false)
  }


  useEffect(() => {
    let cancelled = false

    async function loadTrackedKeywordKeys() {
      try {
        const { data } = await api.get(`/sites/${siteId}/keywords`)

        if (cancelled) return

        setTrackedKeywordKeys(
          new Set(
            (Array.isArray(data) ? data : [])
              .map((item) =>
                String(item?.keyword || '')
                  .toLowerCase()
                  .trim()
              )
              .filter(Boolean)
          )
        )
      } catch {
        // Existing page behaviour remains available even if refresh fails.
      }
    }

    loadTrackedKeywordKeys()

    return () => {
      cancelled = true
    }
  }, [siteId])
  const compare = async () => {
    const domains = []

    for (const raw of inputs) {
      try {
        const domain = normalizeDomain(raw)
        if (domain && domain !== youDomain) domains.push(domain)
      } catch {
        // Ignore invalid rows.
      }
    }

    const unique = [...new Set(domains)].slice(0, 4)

    if (!unique.length) {
      toast.error('Add at least one competitor domain')
      return
    }

    setRunning(true)

    try {
      for (const domain of unique) {
        await api
          .post(`/sites/${siteId}/competitors`, {
            name: domain,
            url: `https://${domain}`,
          })
          .catch(() => {})
      }

      const { data } = await api.post(`/sites/${siteId}/keywords/gap`, {
        domains: unique,
        locationCode,
        limit: 100,
      })

      setResult(data)
      setView('missing')

      if (data?.warning) toast(data.warning)
      else toast.success(`Gap ready: ${data?.counts?.missing || 0} missing keywords`)
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Keyword gap failed')
    }

    setRunning(false)
  }

  const addKeyword = async (row) => {
    setAddingKey(row.keyword)

    try {
      await api.post(`/sites/${siteId}/keywords`, {
        keyword: row.keyword,
        volume: row.volume || 0,
        difficulty: row.difficulty || 'Medium',
        position: row.yourPosition || null,
      })
      setTrackedKeywordKeys((previous) => {
        const next = new Set(previous)
        next.add(String(row.keyword || '').toLowerCase().trim())
        return next
      })

      toast.success(`Tracked: ${row.keyword}`)
      onAdded?.()
    } catch (error) {
      const message = error?.response?.data?.error || ''

      if (
        message.toLowerCase().includes('already') ||
        message.toLowerCase().includes('duplicate')
      ) {
        toast('Already tracked')
      } else {
        toast.error(message || 'Could not add keyword')
      }
    }

    setAddingKey(null)
  }

  const rows =
    view === 'shared'
      ? result?.shared || []
      : view === 'unique'
        ? result?.uniqueToYou || []
        : result?.missing || []

  return (
    <div className="kwm-gap">
      <div className="kwm-gap-setup">
        <div className="kwm-gap-field">
          <span className="kwm-gap-field-label">Your site</span>
          <div className="kwm-gap-domain readonly">{youDomain || 'Loading...'}</div>
        </div>

        <div className="kwm-gap-field">
          <span className="kwm-gap-field-label">Market</span>
          <MobileBottomSelect
            label="Market"
            kind="market"
            value={locationCode}
            options={LOCATIONS.map((location) => ({
              value: location.code,
              label: location.name,
              description: 'Keyword gap market',
            }))}
            onChange={(value) =>
              setLocationCode(
                Number(value)
              )
            }
          />
        </div>

        <div className="kwm-gap-competitor-heading">
          <div>
            <span className="kwm-gap-field-label">Competitors</span>
            <small>{filledCompetitors}/4 ready</small>
          </div>

          <button
            type="button"
            className="kwm-gap-autofill"
            onClick={autoDiscover}
            disabled={discovering}
          >
            <FontAwesomeIcon
              icon={discovering ? faRotate : faWandMagicSparkles}
              spin={discovering}
            />
            {discovering ? 'Finding' : 'Auto-fill'}
          </button>
        </div>

        <div className="kwm-gap-competitor-list">
          {inputs.map((value, index) => (
            <div className="kwm-gap-competitor" key={index}>
              <span className="kwm-gap-index">C{index + 1}</span>

              <input
                value={value}
                onChange={(event) =>
                  setInputs((previous) =>
                    previous.map((item, itemIndex) =>
                      itemIndex === index ? event.target.value : item
                    )
                  )
                }
                placeholder="competitor.com"
                inputMode="url"
              />

              {inputs.length > 1 ? (
                <button
                  type="button"
                  className="kwm-gap-remove"
                  onClick={() =>
                    setInputs((previous) =>
                      previous.filter((_, itemIndex) => itemIndex !== index)
                    )
                  }
                  aria-label={`Remove competitor ${index + 1}`}
                >
                  <FontAwesomeIcon icon={faXmark} />
                </button>
              ) : (
                <span className="kwm-gap-remove-placeholder" />
              )}
            </div>
          ))}
        </div>

        {inputs.length < 4 ? (
          <button
            type="button"
            className="kwm-gap-add-competitor"
            onClick={() => setInputs((previous) => [...previous, ''])}
          >
            <FontAwesomeIcon icon={faPlus} />
            Add competitor
          </button>
        ) : null}

        <button
          type="button"
          className="kwm-primary-button kwm-gap-compare"
          onClick={compare}
          disabled={running}
        >
          <FontAwesomeIcon
            icon={running ? faRotate : faChartLine}
            spin={running}
          />
          {running ? 'Comparing...' : 'Compare keywords'}
        </button>
      </div>

      {result ? (
        <div className="kwm-gap-results">
          <div className="kwm-segmented kwm-gap-tabs">
            {[
              ['missing', 'Missing', result.counts?.missing || 0],
              ['shared', 'Shared', result.counts?.shared || 0],
              ['unique', 'Yours', result.counts?.uniqueToYou || 0],
            ].map(([id, label, count]) => (
              <button
                key={id}
                type="button"
                className={view === id ? 'active' : ''}
                onClick={() => setView(id)}
              >
                {label} {count}
              </button>
            ))}
          </div>

          {!rows.length ? (
            <div className="kwm-empty-small">No keywords in this group.</div>
          ) : (
            <div className="kwm-card-list">
              {rows.slice(0, 50).map((row) => (
                <article className="kwm-gap-result-card" key={row.keyword}>
                  <div className="kwm-gap-result-head">
                    <div>
                      <strong>{row.keyword}</strong>
                      {row.bestCompetitor && view !== 'unique' ? (
                        <span>via {row.bestCompetitor}</span>
                      ) : null}
                    </div>

                    <OppPill label={row.opportunity} />
                  </div>

                  <div className="kwm-gap-metrics">
                    <div>
                      <span>Volume</span>
                      <strong>{Number(row.volume || 0).toLocaleString()}</strong>
                    </div>

                    <div>
                      <span>You</span>
                      <strong>{row.yourPosition ? `#${row.yourPosition}` : 'Not ranked'}</strong>
                    </div>

                    <div>
                      <span>Best comp.</span>
                      <strong>
                        {row.bestCompetitorPosition
                          ? `#${row.bestCompetitorPosition}`
                          : '-'}
                      </strong>
                    </div>
                  </div>

                  {view !== 'unique' ? (
                    <button
                      type="button"
                      className={`kwm-gap-track ${trackedKeywordKeys.has(String(row.keyword || '').toLowerCase().trim()) ? 'is-tracked' : addingKey === row.keyword ? 'is-tracking' : ''}`}
                      disabled={addingKey === row.keyword || trackedKeywordKeys.has(String(row.keyword || '').toLowerCase().trim())}
                      onClick={() => addKeyword(row)}
                    >
                      <FontAwesomeIcon
                        icon={
                          addingKey === row.keyword
                            ? faRotate
                            : faPlus
                        }
                        spin={addingKey === row.keyword}
                      />
                      {trackedKeywordKeys.has(String(row.keyword || '').toLowerCase().trim())
  ? '✓ Tracked'
  : addingKey === row.keyword
    ? 'Tracking...'
    : 'Track keyword'}
                    </button>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="kwm-gap-hint">
          <FontAwesomeIcon icon={faMagnifyingGlass} />
          <span>Compare competitors to reveal missing keyword opportunities.</span>
        </div>
      )}
    </div>
  )
}