import { useId, useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleInfo } from '@fortawesome/free-solid-svg-icons'
import { getScoreHelp } from '../utils/scoreHelp'

/**
 * ⓘ tooltip for score / metric labels.
 * Portaled + fixed so it isn’t clipped by overflow (sidebar, cards, tables).
 * Use asSpan when nested inside another <button>.
 */
export default function ScoreInfoTip({ scoreKey, text, title, className = '', asSpan = false }) {
  const help = getScoreHelp(scoreKey)
  const tipTitle = title || help?.title
  const tipBody = text || help?.body
  const tipId = useId()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, placeAbove: true })
  const wrapRef = useRef(null)
  const popRef = useRef(null)

  const place = () => {
    const btn = wrapRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const popW = Math.min(280, window.innerWidth - 16)
    const popH = popRef.current?.offsetHeight || 110
    const gap = 8
    let left = rect.left + rect.width / 2 - popW / 2
    left = Math.max(8, Math.min(left, window.innerWidth - popW - 8))
    let placeAbove = true
    let top = rect.top - popH - gap
    if (top < 8) {
      placeAbove = false
      top = rect.bottom + gap
    }
    if (top + popH > window.innerHeight - 8) {
      top = Math.max(8, window.innerHeight - popH - 8)
    }
    setPos({ top, left, placeAbove, width: popW })
  }

  useLayoutEffect(() => {
    if (!open) return
    place()
    const id = requestAnimationFrame(() => place())
    return () => cancelAnimationFrame(id)
  }, [open, tipBody])

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (wrapRef.current?.contains(e.target)) return
      if (popRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const onClose = () => setOpen(false)
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onClose, true)
    window.addEventListener('resize', onClose)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onClose, true)
      window.removeEventListener('resize', onClose)
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
        <FontAwesomeIcon icon={faCircleInfo} aria-hidden />
      </Trigger>
      {open && createPortal(
        <span
          ref={popRef}
          id={tipId}
          role="tooltip"
          className={`score-info-tip__pop${pos.placeAbove ? ' score-info-tip__pop--above' : ' score-info-tip__pop--below'}`}
          style={{ top: pos.top, left: pos.left, width: pos.width }}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
        >
          {tipTitle ? <span className="score-info-tip__title">{tipTitle}</span> : null}
          <span className="score-info-tip__body">{tipBody}</span>
        </span>,
        document.body
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
