import { useEffect, useMemo, useRef, useState } from 'react'

const clampScore = (value) => Math.max(0, Math.min(100, Number(value) || 0))

const scoreColor = (score) => {
  if (score >= 70) return '#16A34A'
  if (score >= 40) return '#F59E0B'
  return '#DC2626'
}

const scoreStatus = (score) => {
  if (score >= 85) return 'Excellent'
  if (score >= 70) return 'Healthy'
  if (score >= 40) return 'Needs work'
  return 'Priority'
}

function useAnimatedScore(value, duration = 1500) {
  const target = clampScore(value)
  const [displayed, setDisplayed] = useState(0)
  const previousRef = useRef(0)

  useEffect(() => {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    if (reduceMotion) {
      previousRef.current = target
      setDisplayed(target)
      return undefined
    }

    const startValue = previousRef.current
    const difference = target - startValue
    let frameId = 0
    let startTime = 0

    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp

      const progress = Math.min((timestamp - startTime) / duration, 1)
      const eased = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2
      const nextValue = startValue + difference * eased

      previousRef.current = nextValue
      setDisplayed(nextValue)

      if (progress < 1) {
        frameId = window.requestAnimationFrame(animate)
      } else {
        previousRef.current = target
        setDisplayed(target)
      }
    }

    frameId = window.requestAnimationFrame(animate)
    return () => window.cancelAnimationFrame(frameId)
  }, [target, duration])

  return displayed
}

export default function SiteHealthGauge({ value, className = '', compact = false }) {
  const target = clampScore(value)
  const animated = useAnimatedScore(target)
  const rounded = Math.round(animated)
  const activeColor = scoreColor(animated)
  const targetColor = scoreColor(target)
  const needleAngle = -90 + animated * 1.8
  const digitClass = rounded >= 100
    ? 'dd-gauge-number--three-digits'
    : rounded >= 10
      ? 'dd-gauge-number--two-digits'
      : 'dd-gauge-number--one-digit'

  const segments = useMemo(() => ({
    red: Math.min(animated, 40),
    amber: Math.max(0, Math.min(animated - 40, 30)),
    green: Math.max(0, Math.min(animated - 70, 30)),
  }), [animated])

  return (
    <div
      className={`dd-site-health-gauge ${compact ? 'dd-site-health-gauge--compact' : ''} ${className}`.trim()}
      role="img"
      aria-label={`Site health ${Math.round(target)} out of 100`}
    >
      <svg viewBox="0 0 240 145" aria-hidden="true">
        <path className="dd-gauge-zone dd-gauge-zone--red" d="M 30 112 A 90 90 0 0 1 210 112" pathLength="100" strokeDasharray="39 61" />
        <path className="dd-gauge-zone dd-gauge-zone--amber" d="M 30 112 A 90 90 0 0 1 210 112" pathLength="100" strokeDasharray="29 71" strokeDashoffset="-40" />
        <path className="dd-gauge-zone dd-gauge-zone--green" d="M 30 112 A 90 90 0 0 1 210 112" pathLength="100" strokeDasharray="29 71" strokeDashoffset="-70" />

        {segments.red > 0 && (
          <path className="dd-gauge-active dd-gauge-active--red" d="M 30 112 A 90 90 0 0 1 210 112" pathLength="100" strokeDasharray={`${segments.red} 100`} />
        )}
        {segments.amber > 0 && (
          <path className="dd-gauge-active dd-gauge-active--amber" d="M 30 112 A 90 90 0 0 1 210 112" pathLength="100" strokeDasharray={`${segments.amber} 100`} strokeDashoffset="-40" />
        )}
        {segments.green > 0 && (
          <path className="dd-gauge-active dd-gauge-active--green" d="M 30 112 A 90 90 0 0 1 210 112" pathLength="100" strokeDasharray={`${segments.green} 100`} strokeDashoffset="-70" />
        )}

        <g
          className="dd-gauge-needle"
          style={{
            transform: `rotate(${needleAngle}deg)`,
            transformOrigin: '120px 112px',
          }}
        >
          <line x1="120" y1="112" x2="120" y2="46" />
        </g>

        <circle className="dd-gauge-hub-ring" cx="120" cy="112" r="8" />
        <circle className="dd-gauge-hub" cx="120" cy="112" r="5" style={{ fill: activeColor }} />
      </svg>

      <div className="dd-gauge-reading">
        <span className={`dd-gauge-number ${digitClass}`} style={{ color: activeColor }}>
          {rounded}
        </span>
        <span className="dd-gauge-total">/100</span>
      </div>

      <span
        className="dd-gauge-status"
        style={{
          color: targetColor,
          backgroundColor: `${targetColor}14`,
        }}
      >
        {scoreStatus(target)}
      </span>
    </div>
  )
}