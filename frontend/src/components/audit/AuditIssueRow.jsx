import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faCircleCheck, faCircleXmark, faTriangleExclamation,
  faChevronDown, faChevronRight, faRobot, faWandMagicSparkles,
  faArrowTrendUp, faCheck, faRotateRight, faCopy
} from '@fortawesome/free-solid-svg-icons'
import { T } from '../UI'
import api from '../../utils/api'

const IMPACT_POINTS = { High: '+12–18 pts', Medium: '+5–10 pts', Low: '+1–4 pts' }

function issueIcon(status) {
  if (status === 'pass')    return { icon: faCircleCheck,        color: T.green }
  if (status === 'error')   return { icon: faCircleXmark,        color: T.red }
  return                           { icon: faTriangleExclamation, color: T.amber }
}

function statusBadge(status) {
  if (status === 'error') {
    return {
      icon: faCircleXmark,
      label: 'Critical',
      bg: '#FEF2F2',
      border: '#FECACA',
      color: '#DC2626',
    }
  }
  if (status === 'warning') {
    return {
      icon: faTriangleExclamation,
      label: 'Warning',
      bg: '#FFFBEB',
      border: '#FDE68A',
      color: '#D97706',
    }
  }
  return {
    icon: faCircleCheck,
    label: 'Passed',
    bg: '#F0FDF4',
    border: '#BBF7D0',
    color: '#16A34A',
  }
}

async function fetchAIFix(issue, siteUrl, siteId) {
  const { data } = await api.post(`/sites/${siteId}/audit/ai-fix`, { issue, siteUrl })
  return data
}

export default function AuditIssueRow({ issue, siteId, siteUrl, expanded, onToggle }) {
  const [aiFix, setAiFix] = useState(null)
  const [loadingFix, setLoadingFix] = useState(false)
  const [marked, setMarked] = useState(false)
  const [copied, setCopied] = useState(false)
  const { icon, color } = issueIcon(issue.status)
  const statusStyle = statusBadge(issue.status)

  async function getAIFix() {
    if (aiFix) return
    setLoadingFix(true)
    try {
      const result = await fetchAIFix(issue, siteUrl, siteId)
      setAiFix(result)
    } catch (e) {
      setAiFix({ fix: 'Could not generate fix. Please try again.' })
    }
    setLoadingFix(false)
  }

  function handleExpand() {
    onToggle()
    if (!expanded) getAIFix()
  }

  function copyFix() {
    navigator.clipboard.writeText(aiFix?.fix || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const severityStyle = {
    High:   { bg: '#FEE2E2', color: '#DC2626', border: '#FECACA' },
    Medium: { bg: '#FEF3C7', color: '#D97706', border: '#FDE68A' },
    Low:    { bg: '#F0FDF4', color: '#16A34A', border: '#BBF7D0' },
  }[issue.impact] || { bg: '#F3F4F6', color: '#6B7280', border: '#E5E7EB' }

  return (
    <div style={{
      borderBottom: '1px solid #F3F4F6',
      background: expanded ? '#FAFAFA' : '#fff',
      transition: 'background 0.15s',
    }}>
      {/* Row header */}
      <div
        onClick={handleExpand}
        style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
          cursor: 'pointer',
        }}
      >
        <FontAwesomeIcon icon={icon} style={{ color, flexShrink: 0, fontSize: 15 }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', lineHeight: 1.4 }}>
            {issue.message}
          </div>
          {issue.detail && (
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {issue.detail}
            </div>
          )}
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
          background: statusStyle.bg, border: `1px solid ${statusStyle.border}`,
          borderRadius: 6, padding: '3px 8px',
        }}>
          <FontAwesomeIcon icon={statusStyle.icon} style={{ color: statusStyle.color, fontSize: 10 }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: statusStyle.color }}>
            {statusStyle.label}
          </span>
        </div>

        {/* Impact badge */}
        {issue.status !== 'pass' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
            background: severityStyle.bg, border: `1px solid ${severityStyle.border}`,
            borderRadius: 6, padding: '3px 8px',
          }}>
            <FontAwesomeIcon icon={faArrowTrendUp} style={{ color: severityStyle.color, fontSize: 10 }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: severityStyle.color }}>
              {issue.impact}
            </span>
          </div>
        )}

        {/* Ranking points */}
        {issue.status !== 'pass' && IMPACT_POINTS[issue.impact] && (
          <span style={{ fontSize: 11, color: '#6B7280', flexShrink: 0, display: 'none' }}>
            {IMPACT_POINTS[issue.impact]}
          </span>
        )}

        <FontAwesomeIcon
          icon={expanded ? faChevronDown : faChevronRight}
          style={{ color: '#D1D5DB', fontSize: 11, flexShrink: 0 }}
        />
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div style={{ padding: '0 16px 16px 43px', borderTop: '1px solid #F3F4F6' }}>

          {/* Ranking impact pill */}
          {issue.status !== 'pass' && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: '#FFF7ED', border: '1px solid #FED7AA',
              borderRadius: 20, padding: '4px 12px', marginTop: 12, marginBottom: 12,
            }}>
              <FontAwesomeIcon icon={faArrowTrendUp} style={{ color: '#EA580C', fontSize: 11 }} />
              <span style={{ fontSize: 12, color: '#EA580C', fontWeight: 600 }}>
                Fixing this could improve your score {IMPACT_POINTS[issue.impact]}
              </span>
            </div>
          )}

          {/* AI Fix section */}
          <div style={{
            background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10,
            overflow: 'hidden', marginTop: issue.status === 'pass' ? 12 : 0,
          }}>
            {/* AI Fix header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 14px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB',
            }}>
              <FontAwesomeIcon icon={faRobot} style={{ color: '#7C3AED', fontSize: 13 }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>AI-Generated Fix</span>
              {loadingFix && (
                <span style={{ fontSize: 11, color: '#9CA3AF', marginLeft: 4 }}>
                  <FontAwesomeIcon icon={faWandMagicSparkles} style={{ marginRight: 4, animation: 'pulse 1s infinite' }} />
                  Generating...
                </span>
              )}
            </div>

            {loadingFix && (
              <div style={{ padding: '20px 14px' }}>
                {[80, 60, 90].map((w, i) => (
                  <div key={i} style={{
                    height: 12, background: '#F3F4F6', borderRadius: 6,
                    width: `${w}%`, marginBottom: 8,
                    animation: 'shimmer 1.5s infinite',
                  }} />
                ))}
              </div>
            )}

            {aiFix && !loadingFix && (
              <div style={{ padding: '14px' }}>

                {/* Why it matters */}
                {aiFix.why && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                      Why it matters
                    </div>
                    <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, margin: 0 }}>{aiFix.why}</p>
                  </div>
                )}

                {/* Before / After */}
                {(aiFix.before || aiFix.after) && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
                    {aiFix.before && (
                      <div style={{ background: '#FEF2F2', borderRadius: 8, padding: '10px 12px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#EF4444', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Before</div>
                        <code style={{ fontSize: 11, color: '#991B1B', lineHeight: 1.5, display: 'block', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{aiFix.before}</code>
                      </div>
                    )}
                    {aiFix.after && (
                      <div style={{ background: '#F0FDF4', borderRadius: 8, padding: '10px 12px' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#16A34A', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>After</div>
                        <code style={{ fontSize: 11, color: '#166534', lineHeight: 1.5, display: 'block', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{aiFix.after}</code>
                      </div>
                    )}
                  </div>
                )}

                {/* The fix */}
                {aiFix.fix && (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Exact Fix
                      </div>
                      <button onClick={copyFix} style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        background: copied ? '#F0FDF4' : '#F9FAFB',
                        border: `1px solid ${copied ? '#BBF7D0' : '#E5E7EB'}`,
                        borderRadius: 5, padding: '3px 8px', cursor: 'pointer',
                        fontSize: 11, color: copied ? '#16A34A' : '#6B7280', fontFamily: 'inherit',
                      }}>
                        <FontAwesomeIcon icon={copied ? faCheck : faCopy} style={{ fontSize: 10 }} />
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <div style={{
                      background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8,
                      padding: '10px 12px', fontSize: 12, color: '#1E293B',
                      lineHeight: 1.7, fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    }}>
                      {aiFix.fix}
                    </div>
                  </div>
                )}

                {/* Footer row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  {aiFix.timeToFix && (
                    <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                      ⏱ Estimated fix time: <strong style={{ color: '#6B7280' }}>{aiFix.timeToFix}</strong>
                    </span>
                  )}
                  {aiFix.priorityNote && (
                    <span style={{ fontSize: 11, color: '#7C3AED' }}>💡 {aiFix.priorityNote}</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          {issue.status !== 'pass' && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                onClick={() => setMarked(!marked)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: marked ? '#F0FDF4' : '#fff',
                  border: `1px solid ${marked ? '#86EFAC' : '#E5E7EB'}`,
                  borderRadius: 7, padding: '7px 14px', cursor: 'pointer',
                  fontSize: 12, fontWeight: 500,
                  color: marked ? '#16A34A' : '#374151', fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
              >
                <FontAwesomeIcon icon={marked ? faCheck : faRotateRight} style={{ fontSize: 11 }} />
                {marked ? 'Marked as Fixed' : 'Mark as Fixed'}
              </button>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes shimmer {
          0% { opacity: 1 } 50% { opacity: 0.4 } 100% { opacity: 1 }
        }
        @keyframes pulse {
          0% { opacity: 1 } 50% { opacity: 0.4 } 100% { opacity: 1 }
        }
      `}</style>
    </div>
  )
}
