/**
 * Numbered process / flow - clickable steps for guided full-page workflows.
 * compact: connected top-bar stepper (Test → Understand → Improve style)
 *
 * Colors:
 * - active (in view): orange highlight (brand)
 * - done (not active): green check
 * - todo: muted gray
 */
export default function ProcessSteps({ steps = [], style, title, compact = false }) {
  if (!steps.length) return null

  if (compact) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          flexWrap: 'nowrap',
          overflowX: 'auto',
          minWidth: 0,
          ...style,
        }}
      >
        {steps.map((step, i) => {
          const done = Boolean(step.done)
          const active = Boolean(step.active)
          const clickable = typeof step.onClick === 'function'
          const Comp = clickable ? 'button' : 'div'

          let badgeBg = '#E2E8F0'
          let badgeColor = '#64748B'
          let labelColor = '#64748B'
          let labelWeight = 650

          if (active) {
            badgeBg = '#EA580C'
            badgeColor = '#fff'
            labelColor = '#C2410C'
            labelWeight = 800
          } else if (done) {
            badgeBg = '#16A34A'
            badgeColor = '#fff'
            labelColor = '#166534'
            labelWeight = 700
          }

          return (
            <div
              key={step.id || step.label || i}
              style={{ display: 'inline-flex', alignItems: 'center', flex: '0 0 auto' }}
            >
              {i > 0 ? (
                <span
                  aria-hidden
                  style={{
                    color: active || done ? '#FDBA74' : '#CBD5E1',
                    fontSize: 14,
                    fontWeight: 700,
                    padding: '0 8px',
                    lineHeight: 1,
                    userSelect: 'none',
                  }}
                >
                  ›
                </span>
              ) : null}
              <Comp
                type={clickable ? 'button' : undefined}
                onClick={clickable ? step.onClick : undefined}
                title={step.hint || step.label}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '4px 2px',
                  border: 'none',
                  background: 'transparent',
                  cursor: clickable ? 'pointer' : 'default',
                  font: 'inherit',
                  whiteSpace: 'nowrap',
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
                    color: badgeColor,
                    background: badgeBg,
                    boxShadow: active ? '0 0 0 3px #FFEDD5' : undefined,
                  }}
                >
                  {done && !active ? '✓' : i + 1}
                </span>
                {step.icon ? (
                  <span style={{ color: active ? '#EA580C' : done ? '#16A34A' : '#94A3B8', fontSize: 12, lineHeight: 1 }}>
                    {step.icon}
                  </span>
                ) : null}
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: labelWeight,
                    color: labelColor,
                    letterSpacing: '-0.01em',
                  }}
                >
                  {step.label}
                </span>
              </Comp>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div style={style}>
      {title ? (
        <div style={{
          fontSize: 12,
          fontWeight: 800,
          color: '#0F172A',
          marginBottom: 8,
          lineHeight: 1.2,
        }}>
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
          const active = Boolean(step.active)
          const clickable = typeof step.onClick === 'function'
          const Comp = clickable ? 'button' : 'div'

          let border = '#E2E8F0'
          let background = '#F8FAFC'
          let badgeBg = '#E2E8F0'
          let badgeColor = '#64748B'
          let labelColor = '#64748B'
          let boxShadow

          if (active) {
            border = '#FDBA74'
            background = '#FFF7ED'
            badgeBg = '#EA580C'
            badgeColor = '#fff'
            labelColor = '#9A3412'
            boxShadow = '0 0 0 2px #FFEDD5'
          } else if (done) {
            border = '#BBF7D0'
            background = '#F0FDF4'
            badgeBg = '#DCFCE7'
            badgeColor = '#15803D'
            labelColor = '#166534'
          }

          return (
            <Comp
              key={step.id || step.label || i}
              type={clickable ? 'button' : undefined}
              onClick={clickable ? step.onClick : undefined}
              title={step.hint || step.label}
              style={{
                flex: '1 1 150px',
                minWidth: 130,
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
                padding: '10px 12px',
                borderRadius: 10,
                border: `1.5px solid ${border}`,
                background,
                cursor: clickable ? 'pointer' : 'default',
                textAlign: 'left',
                font: 'inherit',
                boxShadow,
                transition: 'background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
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
                  color: badgeColor,
                  background: badgeBg,
                }}
              >
                {done ? '✓' : i + 1}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: labelColor,
                  lineHeight: 1.25,
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
                    Go {'>'}
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
