import { useNavigate, useParams } from 'react-router-dom'
import { Card, T } from './UI'
import ProcessSteps from './ProcessSteps'

function scrollToId(id) {
  if (!id) return
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/**
 * Consistent process guide for every major page.
 * Steps can scroll in-page (sectionId) or navigate (path).
 */
export default function PageProcessGuide({
  title = 'How this page works',
  tip = 'Click a step to go there. Follow the order the first time.',
  steps = [],
  style,
}) {
  const navigate = useNavigate()
  const { siteId } = useParams()

  const mapped = steps.map((step) => ({
    ...step,
    onClick: () => {
      if (typeof step.onClick === 'function') {
        step.onClick()
        return
      }
      if (step.path && siteId) {
        navigate(`/site/${siteId}/${step.path}`)
        return
      }
      if (step.sectionId) {
        scrollToId(step.sectionId)
      }
    },
  }))

  return (
    <Card
      padding="1rem 1.25rem"
      style={{
        border: `1px solid ${T.orange}33`,
        background: 'linear-gradient(180deg, #FFF7ED 0%, #FFFFFF 55%)',
        marginBottom: 14,
        ...style,
      }}
    >
      <ProcessSteps title={title} steps={mapped} style={{ marginBottom: 0 }} />
      {tip ? (
        <div style={{ fontSize: 11, color: T.muted, marginTop: 10, lineHeight: 1.45 }}>
          {tip}
        </div>
      ) : null}
    </Card>
  )
}
