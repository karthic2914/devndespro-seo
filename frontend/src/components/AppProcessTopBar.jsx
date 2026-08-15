import PageProcessGuide from './PageProcessGuide'
import UsageBar from './UsageBar'

/**
 * Shared sticky top strip: page process + compact AI usage.
 * Replaces the full-width UsageBar on process pages to save vertical space.
 */
export default function AppProcessTopBar({
  title = 'Process',
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
        padding: '6px 14px',
        margin: 0,
        flex: '0 0 auto',
        alignSelf: 'stretch',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
        minHeight: 36,
        boxSizing: 'border-box',
        width: '100%',
      }}
    >
      <div style={{ flex: '1 1 280px', minWidth: 0 }}>
        <PageProcessGuide
          compact
          title={title}
          tip={tip}
          steps={steps}
          style={{ marginBottom: 0, maxWidth: '100%' }}
        />
      </div>
      <div style={{ flex: '0 0 auto', marginLeft: 'auto' }}>
        <UsageBar compact />
      </div>
    </div>
  )
}
