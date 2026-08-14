import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronDown, faChevronRight } from '@fortawesome/free-solid-svg-icons'

/**
 * Expand / collapse block with arrow control.
 */
export default function CollapsibleSection({
  title,
  subtitle,
  icon,
  defaultOpen = true,
  open: controlledOpen,
  onToggle,
  right,
  children,
  style,
  headerStyle,
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const isControlled = controlledOpen != null
  const open = isControlled ? controlledOpen : internalOpen

  const toggle = () => {
    if (isControlled) onToggle?.(!controlledOpen)
    else setInternalOpen((v) => !v)
  }

  return (
    <div style={style}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          width: '100%',
          border: 0,
          background: 'transparent',
          padding: 0,
          cursor: 'pointer',
          textAlign: 'left',
          ...headerStyle,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0, flex: 1 }}>
          <span style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            border: '1px solid #E2E8F0',
            background: '#fff',
            color: '#64748B',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginTop: 1,
          }}>
            <FontAwesomeIcon icon={open ? faChevronDown : faChevronRight} style={{ fontSize: 11 }} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
              {icon}
              {title}
            </div>
            {subtitle ? (
              <div style={{ fontSize: 12, color: '#64748B', marginTop: 2, lineHeight: 1.4 }}>{subtitle}</div>
            ) : null}
          </div>
        </div>
        {right ? (
          <div
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            style={{ flexShrink: 0 }}
          >
            {right}
          </div>
        ) : null}
      </button>
      {open ? <div style={{ marginTop: 12 }}>{children}</div> : null}
    </div>
  )
}
