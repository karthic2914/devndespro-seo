/**
 * Numbered process / flow — clickable steps for guided full-page workflows.
 * compact: denser chips for sticky page headers
 *
 * Colors:
 * - active (in view): orange highlight (brand)
 * - done (not active): green check
 * - todo: muted gray
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
                flex: compact ? '0 0 auto' : '1 1 150px',
                minWidth: compact ? 0 : 130,
                display: 'flex',
                gap: compact ? 6 : 8,
                alignItems: compact ? 'center' : 'flex-start',
                padding: compact ? '6px 10px' : '10px 12px',
                borderRadius: compact ? 8 : 10,
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
                  width: compact ? 18 : 22,
                  height: compact ? 18 : 22,
                  borderRadius: 99,
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: compact ? 10 : 11,
                  fontWeight: 800,
                  color: badgeColor,
                  background: badgeBg,
                }}
              >
                {done ? '✓' : i + 1}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  fontSize: compact ? 11 : 12,
                  fontWeight: 800,
                  color: labelColor,
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
