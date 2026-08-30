import PageProcessGuide from './PageProcessGuide'
import UsageBar from './UsageBar'

/**
 * Shared sticky top strip: page process + compact AI usage.
 * Connected stepper style (no title) to match the compact journey bar.
 */
export default function AppProcessTopBar({
  steps = [],
  tip = null,
}) {
  return (
    <div
      className="app-process-topbar"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        background: 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)',
        borderBottom: '1px solid #E5E7EB',
        padding: '8px 16px',
        margin: 0,
        flex: '0 0 auto',
        alignSelf: 'stretch',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        minHeight: 40,
        boxSizing: 'border-box',
        width: '100%',
      }}
    >
      <div
        className="app-process-topbar__steps"
        style={{ flex: '1 1 280px', minWidth: 0 }}
      >
        <PageProcessGuide
          compact
          title={null}
          tip={tip}
          steps={steps}
          style={{ marginBottom: 0 }}
        />
      </div>
      <div style={{ flex: '0 0 auto', marginLeft: 'auto' }}>
        <UsageBar compact />
      </div>
    </div>
  )
}
