import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faWaveSquare,
  faLink,
  faHeartPulse,
  faBullseye,
  faGlobe,
  faCommentDots,
  faArrowTrendUp,
} from '@fortawesome/free-solid-svg-icons'

export const LINK_DESK_MODES = [
  {
    id: 'pulse',
    label: 'Pulse',
    blurb: 'Snapshot',
    icon: faWaveSquare,
  },
  {
    id: 'tracked',
    label: 'Tracked',
    blurb: 'All links',
    icon: faLink,
  },
  {
    id: 'health',
    label: 'Health',
    blurb: 'Good → Spam',
    icon: faHeartPulse,
  },
  {
    id: 'dead',
    label: 'Dead ends',
    blurb: 'Broken',
    icon: faBullseye,
  },
  {
    id: 'sources',
    label: 'Sources',
    blurb: 'Sites',
    icon: faGlobe,
  },
  {
    id: 'phrases',
    label: 'Phrases',
    blurb: 'Anchors',
    icon: faCommentDots,
  },
  {
    id: 'gaps',
    label: 'Gaps',
    blurb: 'Opportunities',
    icon: faArrowTrendUp,
  },
]

/**
 * In-page mode switcher - not a sidebar tree (avoids Ahrefs-style nav).
 */
export default function LinkDeskModes({ active = 'pulse', counts = {}, onChange }) {
  return (
    <div className="link-desk" role="tablist" aria-label="Link desk modes">
      <div className="link-desk__head">
        <div className="link-desk__eyebrow">Link desk</div>
        <div className="link-desk__hint">Switch focus without leaving the page</div>
      </div>
      <div className="link-desk__rail">
        {LINK_DESK_MODES.map((mode) => {
          const selected = active === mode.id
          const count = counts[mode.id]
          return (
            <button
              key={mode.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`link-desk__card${selected ? ' link-desk__card--on' : ''}`}
              onClick={() => onChange?.(mode.id)}
            >
              <span className="link-desk__icon" aria-hidden>
                <FontAwesomeIcon icon={mode.icon} />
              </span>
              <span className="link-desk__copy">
                <span className="link-desk__label">{mode.label}</span>
                <span className="link-desk__blurb">{mode.blurb}</span>
              </span>
              {count != null && Number.isFinite(Number(count)) ? (
                <span className="link-desk__count">{count}</span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
