/**
 * Numbered process / flow — clickable steps for guided full-page workflows.
 */
export default function ProcessSteps({ steps = [], style, title }) {
  if (!steps.length) return null

  return (
    <div style={style}>
      {title ? (
        <div style={{ fontSize: 12, fontWeight: 800, color: '#0F172A', marginBottom: 8 }}>
          {title}
        </div>
      ) : null}
      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          alignItems: 'stretch',
        }}
      >
        {steps.map((step, i) => {
          const done = Boolean(step.done)
          const active = Boolean(step.active) && !done
          const clickable = typeof step.onClick === 'function'
          const Comp = clickable ? 'button' : 'div'

          return (
            <Comp
              key={step.id || step.label || i}
              type={clickable ? 'button' : undefined}
              onClick={clickable ? step.onClick : undefined}
              style={{
                flex: '1 1 150px',
                minWidth: 130,
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
                padding: '10px 12px',
                borderRadius: 10,
                border: `1px solid ${done ? '#BBF7D0' : active ? '#FED7AA' : '#E2E8F0'}`,
                background: done ? '#F0FDF4' : active ? '#FFF7ED' : '#F8FAFC',
                cursor: clickable ? 'pointer' : 'default',
                textAlign: 'left',
                font: 'inherit',
              }}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 99,
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 800,
                  color: done ? '#15803D' : active ? '#C2410C' : '#64748B',
                  background: done ? '#DCFCE7' : active ? '#FFEDD5' : '#E2E8F0',
                }}
              >
                {done ? '✓' : i + 1}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: done ? '#166534' : active ? '#9A3412' : '#0F172A',
                  lineHeight: 1.3,
                }}>
                  {step.label}
                </div>
                {step.hint ? (
                  <div style={{ fontSize: 11, color: '#64748B', marginTop: 2, lineHeight: 1.35 }}>
                    {step.hint}
                  </div>
                ) : null}
                {clickable ? (
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
