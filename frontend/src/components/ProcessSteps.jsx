/**
 * Numbered process / flow — clickable steps for guided full-page workflows.
 * compact: denser chips for sticky page headers
 */
export default function ProcessSteps({ steps = [], style, title, compact = false }) {
  if (!steps.length) return null

  return (
    <div style={style}>
      {title ? (
        <div style={{
          fontSize: compact ? 10 : 12,
          fontWeight: 800,
          color: '#0F172A',
          marginBottom: compact ? 6 : 8,
          letterSpacing: compact ? '0.02em' : undefined,
          textTransform: compact ? 'uppercase' : undefined,
        }}>
          {title}
        </div>
      ) : null}
      <div
        style={{
          display: 'flex',
          gap: compact ? 6 : 8,
          flexWrap: compact ? 'nowrap' : 'wrap',
          alignItems: 'stretch',
          overflowX: compact ? 'auto' : undefined,
          paddingBottom: compact ? 2 : 0,
        }}
      >
        {steps.map((step, i) => {
          const done = Boolean(step.done)
          const active = Boolean(step.active)
          const clickable = typeof step.onClick === 'function'
          const Comp = clickable ? 'button' : 'div'

          return (
            <Comp
              key={step.id || step.label || i}
              type={clickable ? 'button' : undefined}
              onClick={clickable ? step.onClick : undefined}
              title={step.hint || step.label}
              style={{
                flex: compact ? '0 0 auto' : '1 1 150px',
                minWidth: compact ? 0 : 130,
                display: 'flex',
                gap: compact ? 6 : 8,
                alignItems: compact ? 'center' : 'flex-start',
                padding: compact ? '6px 10px' : '10px 12px',
                borderRadius: compact ? 8 : 10,
                border: `1px solid ${active && !done ? '#FED7AA' : done ? '#BBF7D0' : '#E2E8F0'}`,
                background: active && !done ? '#FFF7ED' : done ? '#F0FDF4' : '#F8FAFC',
                cursor: clickable ? 'pointer' : 'default',
                textAlign: 'left',
                font: 'inherit',
                boxShadow: active ? (done ? '0 0 0 2px #BBF7D0' : '0 0 0 2px #FFEDD5') : undefined,
              }}
            >
              <span
                style={{
                  width: compact ? 18 : 22,
                  height: compact ? 18 : 22,
                  borderRadius: 99,
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: compact ? 10 : 11,
                  fontWeight: 800,
                  color: done ? '#15803D' : active ? '#C2410C' : '#64748B',
                  background: done ? '#DCFCE7' : active ? '#FFEDD5' : '#E2E8F0',
                }}
              >
                {done ? '✓' : i + 1}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: compact ? 11 : 12,
                  fontWeight: 800,
                  color: done ? '#166534' : active ? '#9A3412' : '#0F172A',
                  lineHeight: 1.25,
                  whiteSpace: compact ? 'nowrap' : undefined,
                }}>
                  {step.label}
                </div>
                {!compact && step.hint ? (
                  <div style={{ fontSize: 11, color: '#64748B', marginTop: 2, lineHeight: 1.35 }}>
                    {step.hint}
                  </div>
                ) : null}
                {!compact && clickable ? (
                  <div style={{ fontSize: 10, fontWeight: 700, color: active ? '#EA580C' : '#94A3B8', marginTop: 4 }}>
                    Go →
                  </div>
                ) : null}
              </div>
            </Comp>
          )
        })}
      </div>
    </div>
  )
}
