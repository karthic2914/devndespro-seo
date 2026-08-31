import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faChevronDown, faMagnifyingGlass, faXmark } from '@fortawesome/free-solid-svg-icons'
import { COUNTRIES, flagEmoji } from '../utils/countries'
import './CountrySelector.css'

// Same shape as MobileSelect: a controlled `value`/`onChange` component.
// Unlike MobileSelect, both the desktop and mobile UIs here are custom
// (a native <select> can't support search + flags), so instead of a
// native <select> + button pair, we render a popover + a bottom sheet
// and let CSS decide which one is visible, at the same breakpoints
// MobileSelect already uses.
export default function CountrySelector({
  value,
  onChange,
  countries = COUNTRIES,
  label = 'Country',
  className = '',
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const wrapRef = useRef(null)

  const selected = countries.find(c => c.code === value) || countries[0]

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return countries
    return countries.filter(
      c => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    )
  }, [countries, query])

  useEffect(() => {
    if (!open) return undefined
    setQuery('')

    const closeOnEscape = e => { if (e.key === 'Escape') setOpen(false) }
    const closeOnOutside = e => {
      const insideWrap = wrapRef.current && wrapRef.current.contains(e.target)
      const insideSheet = e.target.closest && e.target.closest('.country-selector-sheet')
      if (!insideWrap && !insideSheet) setOpen(false)
    }

    document.addEventListener('keydown', closeOnEscape)
    document.addEventListener('mousedown', closeOnOutside)
    document.body.classList.add('mobile-sheet-open')

    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      document.removeEventListener('mousedown', closeOnOutside)
      document.body.classList.remove('mobile-sheet-open')
    }
  }, [open])

  const choose = c => {
    onChange?.(c.code)
    setOpen(false)
  }

  const renderList = extraClass => (
    <div className={`country-selector-list ${extraClass}`} role="radiogroup">
      {filtered.length === 0 ? (
        <div className="country-selector-empty">No countries match "{query}"</div>
      ) : filtered.map(c => {
        const isSelected = c.code === value
        return (
          <button
            key={c.code}
            type="button"
            role="radio"
            aria-checked={isSelected}
            className={`country-selector-option${isSelected ? ' is-selected' : ''}`}
            onClick={() => choose(c)}
          >
            <span className="country-selector-flag">{flagEmoji(c.code)}</span>
            <span className="country-selector-name">{c.name}</span>
            {isSelected && <FontAwesomeIcon icon={faCheck} className="country-selector-check" />}
          </button>
        )
      })}
    </div>
  )

  return (
    <div className={`country-selector ${className}`.trim()} ref={wrapRef}>
      <button
        type="button"
        className="country-selector-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        <span className="country-selector-flag">{flagEmoji(selected?.code)}</span>
        <span className="country-selector-trigger-name">{selected?.name || label}</span>
        <FontAwesomeIcon icon={faChevronDown} className="country-selector-chevron" />
      </button>

      {/* Desktop: searchable popover, anchored under the trigger */}
      {open && (
        <div className="country-selector-popover" role="dialog" aria-label={label}>
          <div className="country-selector-search">
            <FontAwesomeIcon icon={faMagnifyingGlass} />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search country…"
            />
          </div>
          {renderList('country-selector-list--popover')}
        </div>
      )}

      {/* Mobile: bottom sheet, portaled to body like MobileSelect's sheet */}
      {open &&
        createPortal(
          <div
            className="country-selector-overlay"
            onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false) }}
          >
            <section className="country-selector-sheet" role="dialog" aria-modal="true" aria-label={label}>
              <div className="country-selector-sheet__handle" />
              <header className="country-selector-sheet__header">
                <h2>{label}</h2>
                <button type="button" aria-label="Close" onClick={() => setOpen(false)}>
                  <FontAwesomeIcon icon={faXmark} />
                </button>
              </header>
              <div className="country-selector-search country-selector-search--sheet">
                <FontAwesomeIcon icon={faMagnifyingGlass} />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search country…"
                />
              </div>
              {renderList('country-selector-list--sheet')}
            </section>
          </div>,
          document.body
        )}
    </div>
  )
}
