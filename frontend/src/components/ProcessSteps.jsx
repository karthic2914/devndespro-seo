/**
 * Simple numbered process / flow for guided actions.
 */
export default function ProcessSteps({ steps = [], style }) {
  if (!steps.length) return null

  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        flexWrap: 'wrap',
        alignItems: 'stretch',
        marginBottom: 14,
        ...style,
      }}
    >
      {steps.map((step, i) => {
        const done = Boolean(step.done)
        const active = Boolean(step.active) && !done
        return (
          <div
            key={step.id || step.label || i}
            style={{
              flex: '1 1 140px',
              minWidth: 120,
              display: 'flex',
              gap: 8,
              alignItems: 'flex-start',
              padding: '10px 12px',
              borderRadius: 10,
              border: `1px solid ${done ? '#BBF7D0' : active ? '#FED7AA' : '#E2E8F0'}`,
              background: done ? '#F0FDF4' : active ? '#FFF7ED' : '#F8FAFC',
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
            </div>
          </div>
        )
      })}
    </div>
  )
}
