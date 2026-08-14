import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChartPie } from '@fortawesome/free-solid-svg-icons'
import api from '../utils/api'

function formatUsd(value) {
  const n = Number(value) || 0
  if (n < 0.01 && n > 0) return '<$0.01'
  return `$${n.toFixed(n < 10 ? 2 : 2)}`
}

export default function UsageBar({ compact = false }) {
  const [summary, setSummary] = useState(null)

  useEffect(() => {
    let cancelled = false
    api.get('/usage/summary', { params: { days: 30 } })
      .then((res) => {
        if (!cancelled) setSummary(res.data)
      })
      .catch(() => {
        if (!cancelled) setSummary(null)
      })
    return () => { cancelled = true }
  }, [])

  if (!summary) return null

  const { totals, byProvider, days } = summary
  const providerHint = (byProvider || [])
    .map((p) => `${p.provider}: ${formatUsd(p.costUsd)}`)
    .join(' · ')

  return (
    <div
      className={'app-usage-bar' + (compact ? ' app-usage-bar--compact' : '')}
      title={providerHint || 'Estimated AI API usage'}
      style={{ maxWidth: '100%', overflowX: 'hidden', boxSizing: 'border-box' }}
    >
      <FontAwesomeIcon icon={faChartPie} className="app-usage-bar__icon" />
      <span className="app-usage-bar__label">AI usage · last {days}d</span>
      <strong className="app-usage-bar__cost">{formatUsd(totals?.costUsd)}</strong>
      <span className="app-usage-bar__meta">
        {totals?.calls || 0} calls
        {(totals?.inputTokens || 0) + (totals?.outputTokens || 0) > 0
          ? ` · ${(((totals.inputTokens || 0) + (totals.outputTokens || 0)) / 1000).toFixed(1)}k tokens`
          : ''}
      </span>
      <style>{`
        .app-usage-bar {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
          min-height: 36px;
          padding: 6px 14px;
          border-bottom: 1px solid #E5E7EB;
          background: linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%);
          color: #475569;
          font-size: 11.5px;
          font-weight: 600;
        }
        .app-usage-bar--compact {
          border: 1px solid #E5E7EB;
          border-radius: 999px;
          padding: 5px 12px;
          min-height: 0;
          background: #fff;
        }
        .app-usage-bar__icon {
          color: #F97316;
          font-size: 12px;
        }
        .app-usage-bar__label {
          color: #64748B;
          font-weight: 650;
        }
        .app-usage-bar__cost {
          color: #0F172A;
          font-size: 12px;
          font-weight: 800;
        }
        .app-usage-bar__meta {
          color: #94A3B8;
          font-weight: 600;
        }
      `}</style>
    </div>
  )
}
