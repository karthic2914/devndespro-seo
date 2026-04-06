/**
 * SEO Components
 * import { HealthScore, SiteCard, RankBadge, DifficultyBar, KeywordRow, BacklinkRow, ActionItem, ScoreGauge } from '../components/seo/SeoComponents'
 */

import { useState } from 'react'
import { Badge, Button, ProgressBar, T } from '../UI'

// ─────────────────────────────────────────────
// HEALTH SCORE — circular gauge 0-100
// Usage: <HealthScore score={74} size="lg" />
// ─────────────────────────────────────────────
export function HealthScore({ score = 0, size = 'md', showLabel = true }) {
  const isLg = size === 'lg'
  const dim = isLg ? 120 : 80
  const stroke = isLg ? 10 : 7
  const r = (dim / 2) - stroke
  const circ = 2 * Math.PI * r
  const pct = Math.min(100, Math.max(0, score))
  const offset = circ - (pct / 100) * circ

  const color = pct >= 80 ? T.green : pct >= 50 ? T.amber : T.red
  const label = pct >= 80 ? 'Good' : pct >= 50 ? 'Needs Work' : 'Poor'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ position: 'relative', width: dim, height: dim }}>
        <svg width={dim} height={dim} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={dim/2} cy={dim/2} r={r} fill="none" stroke={T.border} strokeWidth={stroke} />
          <circle
            cx={dim/2} cy={dim/2} r={r} fill="none"
            stroke={color} strokeWidth={stroke}
            strokeDasharray={circ} strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ fontSize: isLg ? 26 : 18, fontWeight: 800, color: T.text, lineHeight: 1, fontFamily: 'DM Mono, monospace' }}>{score}</div>
          {isLg && <div style={{ fontSize: 10, color: T.muted, fontWeight: 600 }}>/100</div>}
        </div>
      </div>
      {showLabel && (
        <Badge variant={pct >= 80 ? 'success' : pct >= 50 ? 'warning' : 'danger'} dot>{label}</Badge>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// SITE CARD — project card on sites listing
// Usage: <SiteCard site={site} onClick={() => enter(site)} onDelete={() => remove(site.id)} />
// ─────────────────────────────────────────────
export function SiteCard({ site, onClick, onDelete, healthScore, keywords, backlinks }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#fff',
        border: `1px solid ${hovered ? T.orange : T.border}`,
        borderRadius: T.radiusMd,
        padding: '1.1rem 1.25rem',
        display: 'flex', alignItems: 'center', gap: 16,
        cursor: 'pointer',
        boxShadow: hovered ? `0 4px 16px rgba(255,107,43,0.1)` : T.shadow,
        transition: 'all 0.18s ease',
      }}
    >
      {/* Site initial */}
      <div style={{
        width: 44, height: 44, background: T.orangeDim, borderRadius: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 800, fontSize: 18, color: T.orange, flexShrink: 0,
      }}>
        {site.name?.[0]?.toUpperCase()}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 2 }}>{site.name}</div>
        <div style={{ fontSize: 12, color: T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{site.url}</div>
      </div>

      {/* Metrics */}
      {[
        { label: 'Health', value: healthScore !== undefined ? `${healthScore}/100` : '—' },
        { label: 'Keywords', value: keywords ?? '—' },
        { label: 'Backlinks', value: backlinks ?? '—' },
      ].map(m => (
        <div key={m.label} style={{ textAlign: 'center', minWidth: 70 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text, fontFamily: 'DM Mono, monospace' }}>{m.value}</div>
          <div style={{ fontSize: 11, color: T.muted }}>{m.label}</div>
        </div>
      ))}

      {/* Added date */}
      <div style={{ fontSize: 11, color: T.muted, minWidth: 80, textAlign: 'right' }}>
        {site.created_at ? new Date(site.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
        <button
          onClick={e => { e.stopPropagation(); onDelete?.() }}
          style={{
            background: 'none', border: 'none', color: T.muted,
            fontSize: 16, cursor: 'pointer', padding: '4px 6px',
            borderRadius: 4, lineHeight: 1, transition: 'color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = T.red}
          onMouseLeave={e => e.currentTarget.style.color = T.muted}
        >✕</button>
        <span style={{ color: hovered ? T.orange : T.muted, fontSize: 18, transition: 'color 0.18s' }}>›</span>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// RANK BADGE — position display
// Usage: <RankBadge position={1} /> <RankBadge position={14} prev={18} />
// ─────────────────────────────────────────────
export function RankBadge({ position, prev }) {
  if (!position) return <span style={{ color: T.muted, fontSize: 13 }}>—</span>

  const improved = prev && position < prev
  const dropped  = prev && position > prev
  const diff     = prev ? Math.abs(position - prev) : null

  const top3  = position <= 3
  const top10 = position <= 10

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        fontSize: 14, fontWeight: 800, fontFamily: 'DM Mono, monospace',
        color: top3 ? T.green : top10 ? T.orange : T.text,
      }}>
        #{position}
      </span>
      {diff && (
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 99,
          background: improved ? T.greenDim : T.redDim,
          color: improved ? T.green : T.red,
        }}>
          {improved ? '▲' : '▼'}{diff}
        </span>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// DIFFICULTY BAR — keyword difficulty 0-100
// Usage: <DifficultyBar value={42} />
// ─────────────────────────────────────────────
export function DifficultyBar({ value = 0 }) {
  const color = value <= 30 ? T.green : value <= 60 ? T.amber : T.red
  const label = value <= 30 ? 'Easy' : value <= 60 ? 'Medium' : 'Hard'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 100 }}>
      <div style={{ flex: 1, background: T.border, borderRadius: 99, height: 5, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.4s ease' }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color, minWidth: 38 }}>{label}</span>
    </div>
  )
}

// ─────────────────────────────────────────────
// KEYWORD ROW — single keyword in table
// Usage: inside <Table /> or standalone
// ─────────────────────────────────────────────
export function KeywordRow({ keyword, position, prevPosition, volume, difficulty, url, onClick }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '2.5fr 100px 100px 140px 1fr',
        alignItems: 'center',
        padding: '12px 20px',
        cursor: onClick ? 'pointer' : 'default',
        background: hovered ? T.surface2 : 'transparent',
        transition: 'background 0.12s',
        gap: 12,
      }}
    >
      {/* Keyword */}
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{keyword}</div>
        {url && <div style={{ fontSize: 11, color: T.muted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url}</div>}
      </div>

      {/* Position */}
      <RankBadge position={position} prev={prevPosition} />

      {/* Volume */}
      <div style={{ fontSize: 13, fontWeight: 600, color: T.text, fontFamily: 'DM Mono, monospace' }}>
        {volume ? volume.toLocaleString() : '—'}
      </div>

      {/* Difficulty */}
      <DifficultyBar value={difficulty ?? 0} />

      {/* Opportunity badge */}
      <div>
        {position > 10 && volume > 100 && difficulty < 40 && (
          <Badge variant="orange" dot>Quick Win</Badge>
        )}
        {position <= 3 && (
          <Badge variant="success" dot>Top 3 🏆</Badge>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// BACKLINK ROW — single backlink in table
// Usage: inside <Table /> or standalone
// ─────────────────────────────────────────────
export function BacklinkRow({ domain, dr, type = 'dofollow', anchor, date, status = 'active', onClick }) {
  const [hovered, setHovered] = useState(false)
  const isDofollow = type === 'dofollow'

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '2fr 80px 100px 1.5fr 120px 80px',
        alignItems: 'center',
        padding: '12px 20px',
        cursor: onClick ? 'pointer' : 'default',
        background: hovered ? T.surface2 : 'transparent',
        transition: 'background 0.12s',
        gap: 12,
      }}
    >
      {/* Domain */}
      <div style={{ fontSize: 14, fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {domain}
      </div>

      {/* DR score */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: dr >= 60 ? T.greenDim : dr >= 30 ? T.amberDim : T.surface2,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 800, color: dr >= 60 ? T.green : dr >= 30 ? T.amber : T.muted,
          fontFamily: 'DM Mono, monospace',
        }}>
          {dr ?? '?'}
        </div>
      </div>

      {/* Type */}
      <Badge variant={isDofollow ? 'success' : 'default'} dot>
        {isDofollow ? 'Dofollow' : 'Nofollow'}
      </Badge>

      {/* Anchor text */}
      <div style={{ fontSize: 13, color: T.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {anchor || '—'}
      </div>

      {/* Date */}
      <div style={{ fontSize: 12, color: T.muted }}>
        {date ? new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
      </div>

      {/* Status */}
      <Badge variant={status === 'active' ? 'success' : status === 'lost' ? 'danger' : 'warning'} dot>
        {status}
      </Badge>
    </div>
  )
}

// ─────────────────────────────────────────────
// ACTION ITEM — single SEO task card
// Usage: <ActionItem action={action} onComplete={handleComplete} />
// ─────────────────────────────────────────────
const IMPACT_CONFIG = {
  critical: { color: T.red,    bg: T.redDim,    label: 'Critical Impact' },
  high:   { color: T.red,    bg: T.redDim,    label: 'High Impact' },
  medium: { color: T.amber,  bg: T.amberDim,  label: 'Medium Impact' },
  low:    { color: T.blue,   bg: T.blueDim,   label: 'Low Impact' },
}

export function ActionItem({ action, onComplete, onDismiss }) {
  const [done, setDone] = useState(action.done || false)
  const impactKey = String(action.impact || '').toLowerCase()
  const impact = IMPACT_CONFIG[impactKey] || IMPACT_CONFIG.medium

  const handleComplete = () => {
    setDone(true)
    onComplete?.(action)
  }

  return (
    <div style={{
      background: done ? T.surface2 : '#fff',
      border: `1px solid ${T.border}`,
      borderRadius: T.radiusMd,
      padding: '1rem 1.25rem',
      display: 'flex', gap: 14, alignItems: 'flex-start',
      opacity: done ? 0.6 : 1,
      transition: 'all 0.2s',
    }}>
      {/* Checkbox */}
      <button
        onClick={handleComplete}
        disabled={done}
        style={{
          width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 1,
          border: `2px solid ${done ? T.green : T.border}`,
          background: done ? T.green : '#fff',
          cursor: done ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.18s',
        }}
      >
        {done && <span style={{ color: '#fff', fontSize: 12, fontWeight: 800 }}>✓</span>}
      </button>

      {/* Content */}
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: done ? T.muted : T.text, textDecoration: done ? 'line-through' : 'none' }}>
            {action.text || action.title}
          </div>
          <Badge style={{ background: impact.bg, color: impact.color, flexShrink: 0 }}>
            {impact.label}
          </Badge>
        </div>
        {action.desc && (
          <div style={{ fontSize: 12, color: T.text2, lineHeight: 1.6, marginBottom: action.category ? 8 : 0 }}>
            {action.desc}
          </div>
        )}
        {action.category && (
          <Badge variant="default" style={{ fontSize: 10 }}>{action.category}</Badge>
        )}
      </div>

      {/* Dismiss */}
      {onDismiss && !done && (
        <button onClick={() => onDismiss?.(action)} style={{
          background: 'none', border: 'none', color: T.muted,
          fontSize: 16, cursor: 'pointer', padding: 2, flexShrink: 0,
          lineHeight: 1,
        }}
          onMouseEnter={e => e.currentTarget.style.color = T.red}
          onMouseLeave={e => e.currentTarget.style.color = T.muted}
        >✕</button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// SCORE GAUGE — horizontal gauge with label
// Usage: <ScoreGauge label="SEO Score" value={68} max={100} />
// ─────────────────────────────────────────────
export function ScoreGauge({ label, value, max = 100, color }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  const c = color || (pct >= 70 ? T.green : pct >= 40 ? T.amber : T.red)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: T.text2 }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: c, fontFamily: 'DM Mono, monospace' }}>{value}/{max}</span>
      </div>
      <ProgressBar value={value} max={max} color={c} height={6} />
    </div>
  )
}

// ─────────────────────────────────────────────
// NEXT BEST ACTION CARD — homepage priority banner
// Usage: <NextBestAction action="Submit sitemap to GSC" impact="high" />
// ─────────────────────────────────────────────
export function NextBestAction({ action, impact = 'high', onDone, onSkip }) {
  return (
    <div style={{
      background: `linear-gradient(135deg, ${T.orange}, #FF4500)`,
      borderRadius: T.radiusMd,
      padding: '1.1rem 1.5rem',
      display: 'flex', alignItems: 'center', gap: 16,
      boxShadow: `0 4px 20px ${T.orangeGlow}`,
      color: '#fff',
    }}>
      <div style={{ fontSize: 28, flexShrink: 0 }}>🎯</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
          Next Best Action
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.4 }}>{action}</div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        {onSkip && (
          <button onClick={onSkip} style={{
            background: 'rgba(255,255,255,0.2)', border: 'none',
            color: '#fff', padding: '7px 14px', borderRadius: 7,
            fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}>Skip</button>
        )}
        {onDone && (
          <button onClick={onDone} style={{
            background: '#fff', border: 'none',
            color: T.orange, padding: '7px 16px', borderRadius: 7,
            fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}>Done ✓</button>
        )}
      </div>
    </div>
  )
}
