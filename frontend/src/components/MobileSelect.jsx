import { Children, isValidElement, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faChevronDown, faXmark } from '@fortawesome/free-solid-svg-icons'

export default function MobileSelect({
  children,
  value,
  onChange,
  label = 'Choose an option',
  className = '',
  ...selectProps
}) {
  const [open, setOpen] = useState(false)

  const options = useMemo(
    () =>
      Children.toArray(children)
        .filter(isValidElement)
        .map(child => ({
          value: child.props.value,
          label: child.props.children,
          disabled: child.props.disabled,
        })),
    [children]
  )

  const selected =
    options.find(option => String(option.value) === String(value)) || options[0]

  useEffect(() => {
    if (!open) return undefined

    const closeOnEscape = event => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('keydown', closeOnEscape)
    document.body.classList.add('mobile-sheet-open')

    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      document.body.classList.remove('mobile-sheet-open')
    }
  }, [open])

  const choose = option => {
    if (option.disabled) return
    onChange?.({ target: { value: option.value } })
    setOpen(false)
  }

  return (
    <div className={`responsive-select ${className}`.trim()}>
      <select
        {...selectProps}
        className="responsive-select__desktop"
        value={value}
        onChange={onChange}
      >
        {children}
      </select>

      <button
        type="button"
        className="responsive-select__mobile"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span>{selected?.label || label}</span>
        <FontAwesomeIcon icon={faChevronDown} />
      </button>

      {open &&
        createPortal(
          <div
            className="mobile-select-overlay"
            onMouseDown={event => {
              if (event.target === event.currentTarget) setOpen(false)
            }}
          >
            <section
              className="mobile-select-sheet"
              role="dialog"
              aria-modal="true"
              aria-label={label}
            >
              <div className="mobile-select-sheet__handle" />

              <header className="mobile-select-sheet__header">
                <h2>{label}</h2>
                <button
                  type="button"
                  className="mobile-select-sheet__close"
                  aria-label="Close"
                  onClick={() => setOpen(false)}
                >
                  <FontAwesomeIcon icon={faXmark} />
                </button>
              </header>

              <div className="mobile-select-sheet__options" role="radiogroup">
                {options.map(option => {
                  const isSelected = String(option.value) === String(value)

                  return (
                    <button
                      key={String(option.value)}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      disabled={option.disabled}
                      className={`mobile-select-sheet__option${
                        isSelected ? ' is-selected' : ''
                      }`}
                      onClick={() => choose(option)}
                    >
                      <span>{option.label}</span>
                      <span className="mobile-select-sheet__radio">
                        {isSelected ? <FontAwesomeIcon icon={faCheck} /> : null}
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
          </div>,
          document.body
        )}
    </div>
  )
}