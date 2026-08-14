import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons'

/**
 * Expand / collapse block — icon control on the right (up = collapse, down = expand).
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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          width: '100%',
          flexWrap: 'wrap',
          ...headerStyle,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
            {icon}
            {title}
          </div>
          {subtitle ? (
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 2, lineHeight: 1.4 }}>{subtitle}</div>
          ) : null}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
          {right || null}
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-label={open ? 'Collapse' : 'Expand'}
            title={open ? 'Collapse' : 'Expand'}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              border: '1px solid #E2E8F0',
              background: '#F8FAFC',
              color: '#475569',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <FontAwesomeIcon icon={open ? faChevronUp : faChevronDown} style={{ fontSize: 12 }} />
          </button>
        </div>
      </div>
      {open ? <div style={{ marginTop: 12 }}>{children}</div> : null}
    </div>
  )
}
