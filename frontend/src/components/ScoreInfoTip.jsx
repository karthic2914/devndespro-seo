import { useId, useState, useRef, useEffect } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleInfo } from '@fortawesome/free-solid-svg-icons'
import { getScoreHelp } from '../utils/scoreHelp'

/**
 * ⓘ tooltip for score labels (Site Health, Domain Rank, Link Score, AI Visibility).
 * Use asSpan when nested inside another <button> (invalid HTML otherwise).
 */
export default function ScoreInfoTip({ scoreKey, text, title, className = '', asSpan = false }) {
  const help = getScoreHelp(scoreKey)
  const tipTitle = title || help?.title
  const tipBody = text || help?.body
  const tipId = useId()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (wrapRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!tipBody) return null

  const Trigger = asSpan ? 'span' : 'button'
  const triggerProps = asSpan
    ? {
        role: 'button',
        tabIndex: 0,
        onKeyDown: (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            e.stopPropagation()
            setOpen((v) => !v)
          }
        },
      }
    : { type: 'button' }

  return (
    <span
      ref={wrapRef}
      className={`score-info-tip${open ? ' score-info-tip--open' : ''} ${className}`.trim()}
    >
      <Trigger
        {...triggerProps}
        className="score-info-tip__btn"
        aria-label={tipTitle ? `About ${tipTitle}` : 'About this score'}
        aria-expanded={open}
        aria-controls={tipId}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <FontAwesomeIcon icon={faCircleInfo} />
      </Trigger>
      {open && (
        <span id={tipId} role="tooltip" className="score-info-tip__pop">
          {tipTitle ? <span className="score-info-tip__title">{tipTitle}</span> : null}
          <span className="score-info-tip__body">{tipBody}</span>
        </span>
      )}
    </span>
  )
}

/** Label + ⓘ in one line */
export function ScoreLabelWithTip({ scoreKey, children, className = '', style }) {
  return (
    <span className={`score-label-with-tip ${className}`.trim()} style={style}>
      {children}
      <ScoreInfoTip scoreKey={scoreKey} />
    </span>
  )
}
