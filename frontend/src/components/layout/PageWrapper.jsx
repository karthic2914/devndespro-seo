/**
 * PageWrapper — wraps every dashboard page
 * Usage:
 *   <PageWrapper title="Keywords" subtitle="Track your search rankings">
 *     <YourContent />
 *   </PageWrapper>
 *
 *   With actions:
 *   <PageWrapper title="Keywords" actions={<Button onClick={add}>+ Add Keyword</Button>}>
 *     ...
 *   </PageWrapper>
 *
 *   With tabs:
 *   <PageWrapper title="Overview" tabs={[{label:'All'},{label:'Issues'}]} activeTab={tab} onTabChange={setTab}>
 *     ...
 *   </PageWrapper>
 */
import { T } from '../UI'

export default function PageWrapper({ title, subtitle, actions, tabs, activeTab, onTabChange, children, maxWidth = 1100 }) {
  return (
    <div style={{ flex: 1, overflow: 'auto', background: '#F3F4F6', minHeight: '100vh', fontFamily: 'inherit' }}>
      {/* Page header */}
      <div style={{ background: '#fff', borderBottom: `1px solid ${T.border}`, padding: '0 2rem' }}>
        <div style={{ maxWidth, margin: '0 auto' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '1.25rem 0',
            borderBottom: tabs?.length ? `1px solid ${T.border}` : 'none',
          }}>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: T.text, letterSpacing: '-0.03em', marginBottom: subtitle ? 3 : 0 }}>
                {title}
              </h1>
              {subtitle && <p style={{ fontSize: 13, color: T.muted }}>{subtitle}</p>}
            </div>
            {actions && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                {actions}
              </div>
            )}
          </div>

          {/* Tabs */}
          {tabs?.length > 0 && (
            <div style={{ display: 'flex', gap: 0, marginTop: 0 }}>
              {tabs.map(tab => {
                const label = typeof tab === 'string' ? tab : tab.label
                const count = typeof tab === 'object' ? tab.count : null
                const isActive = activeTab === label
                return (
                  <button
                    key={label}
                    onClick={() => onTabChange?.(label)}
                    style={{
                      background: 'none', border: 'none',
                      padding: '10px 16px', fontSize: 13,
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? T.orange : T.text2,
                      borderBottom: `2px solid ${isActive ? T.orange : 'transparent'}`,
                      cursor: 'pointer', fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center', gap: 6,
                      transition: 'all 0.15s', marginBottom: -1,
                    }}
                  >
                    {label}
                    {count !== null && count !== undefined && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99,
                        background: isActive ? T.orangeDim : T.surface2,
                        color: isActive ? T.orange : T.muted,
                      }}>{count}</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Page content */}
      <div style={{ maxWidth, margin: '0 auto', padding: '1.5rem 2rem' }}>
        {children}
      </div>
    </div>
  )
}
