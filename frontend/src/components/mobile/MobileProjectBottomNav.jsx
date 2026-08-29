import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faChartColumn,
  faShieldHalved,
  faMagnifyingGlass,
  faListCheck,
  faEllipsisVertical,
  faChevronRight,
  faLink,
  faRobot,
  faUsers,
  faRankingStar,
  faBell,
  faChartLine,
  faPlug,
  faEnvelope,
  faPaperPlane,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import './MobileProjectBottomNav.css'

const ACTIONS_ITEM = {
  id: 'actions',
  label: 'Actions',
  description: 'Work through the SEO action plan',
  icon: faListCheck,
  path: 'actions',
}

const TOOL_ROUTES = [
  {
    group: 'Analyze',
    items: [
      {
        id: 'backlinks',
        label: 'Backlinks',
        description: 'Review backlink performance',
        icon: faLink,
        path: 'backlinks',
      },
      {
        id: 'ai-visibility',
        label: 'AI Visibility',
        description: 'Track visibility in AI search',
        icon: faRobot,
        path: 'ai-visibility',
      },
      {
        id: 'competitors',
        label: 'Competitors',
        description: 'Compare competing websites',
        icon: faUsers,
        path: 'competitors',
      },
      {
        id: 'rank',
        label: 'Rank #1',
        description: 'SEO ranking opportunities',
        icon: faRankingStar,
        path: 'rank',
      },
    ],
  },
  {
    group: 'Monitor',
    items: [
      {
        id: 'alerts',
        label: 'Alerts',
        description: 'Important SEO changes',
        icon: faBell,
        path: 'alerts',
      },
      {
        id: 'reports',
        label: 'Reports',
        description: 'Review project reports',
        icon: faChartLine,
        path: 'reports',
      },
    ],
  },
  {
    group: 'Automate',
    items: [
      {
        id: 'integrations',
        label: 'Integrations',
        description: 'Connect your SEO tools',
        icon: faPlug,
        path: 'integrations',
      },
      {
        id: 'email-reports',
        label: 'Email Reports',
        description: 'Schedule SEO reports',
        icon: faEnvelope,
        path: 'email-reports',
      },
      {
        id: 'cold-emails',
        label: 'Cold Email',
        description: 'SEO outreach campaigns',
        icon: faPaperPlane,
        path: 'cold-emails',
      },
    ],
  },
]

const SECONDARY_ITEMS = TOOL_ROUTES.flatMap(group => group.items)

export default function MobileProjectBottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const { siteId } = useParams()
  const [moreOpen, setMoreOpen] = useState(false)
  const projectBase = `/site/${siteId}`

  const active = useMemo(() => {
    const pathname = location.pathname

    if (pathname === projectBase || pathname === `${projectBase}/`) {
      return 'overview'
    }
    if (pathname.startsWith(`${projectBase}/audit`)) return 'audit'
    if (pathname.startsWith(`${projectBase}/keywords`)) return 'keywords'
    if (pathname.startsWith(`${projectBase}/actions`)) return 'actions'

    const match = SECONDARY_ITEMS.find(item =>
      pathname.startsWith(`${projectBase}/${item.path}`)
    )

    return match?.id || 'more'
  }, [location.pathname, projectBase])

  const currentTool = useMemo(
    () => SECONDARY_ITEMS.find(item => item.id === active),
    [active]
  )

  // The fourth tab always represents the current project tool.
  // Actions is the default when Overview, Audit or Keywords is active.
  const contextTab = currentTool || ACTIONS_ITEM

  const moreGroups = useMemo(() => {
    const groups = TOOL_ROUTES.map(group => ({
      ...group,
      items: group.items.filter(item => item.id !== contextTab.id),
    })).filter(group => group.items.length)

    if (contextTab.id !== 'actions') {
      return [
        {
          group: 'Plan',
          items: [ACTIONS_ITEM],
        },
        ...groups,
      ]
    }

    return groups
  }, [contextTab.id])

  useEffect(() => {
    document.body.classList.add('shared-mobile-project-nav-active')
    return () => {
      document.body.classList.remove('shared-mobile-project-nav-active')
    }
  }, [])

  useEffect(() => {
    if (!moreOpen) return undefined

    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const closeOnEscape = event => {
      if (event.key === 'Escape') setMoreOpen(false)
    }

    document.addEventListener('keydown', closeOnEscape)

    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [moreOpen])

  const go = (path = '') => {
    setMoreOpen(false)
    navigate(path ? `${projectBase}/${path}` : projectBase)
  }

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      icon: faChartColumn,
      action: () => go(),
    },
    {
      id: 'audit',
      label: 'Audit',
      icon: faShieldHalved,
      action: () => go('audit'),
    },
    {
      id: 'keywords',
      label: 'Keywords',
      icon: faMagnifyingGlass,
      action: () => go('keywords'),
    },
    {
      id: contextTab.id,
      label: contextTab.label,
      icon: contextTab.icon,
      action: () => go(contextTab.path),
    },
    {
      id: 'more',
      label: 'More',
      icon: faEllipsisVertical,
      action: () => setMoreOpen(true),
    },
  ]

  const sheet = moreOpen
    ? createPortal(
        <div
          className="smpn-layer"
          role="presentation"
          onClick={() => setMoreOpen(false)}
        >
          <section
            className="smpn-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="More project options"
            onClick={event => event.stopPropagation()}
          >
            <div className="smpn-handle" />

            <header className="smpn-sheet-header">
              <div>
                <strong>More</strong>
                <span>Project tools</span>
              </div>

              <button
                type="button"
                className="smpn-close"
                aria-label="Close"
                onClick={() => setMoreOpen(false)}
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </header>

            <div className="smpn-sheet-scroll">
              {moreGroups.map(group => (
                <section className="smpn-group" key={group.group}>
                  <h3>{group.group}</h3>

                  <div className="smpn-links">
                    {group.items.map(item => (
                      <button
                        type="button"
                        key={item.path}
                        onClick={() => go(item.path)}
                      >
                        <span className="smpn-link-icon">
                          <FontAwesomeIcon icon={item.icon} />
                        </span>

                        <span className="smpn-link-copy">
                          <strong>{item.label}</strong>
                          <small>{item.description}</small>
                        </span>

                        <FontAwesomeIcon
                          className="smpn-chevron"
                          icon={faChevronRight}
                        />
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </section>
        </div>,
        document.body
      )
    : null

  return (
    <>
      <nav className="smpn-bottom-nav" aria-label="Project navigation">
        {tabs.map(tab => (
          <button
            type="button"
            key={tab.id}
            className={active === tab.id ? 'is-active' : ''}
            onClick={tab.action}
          >
            <FontAwesomeIcon icon={tab.icon} />
            <span>{tab.label}</span>
          </button>
        ))}
      </nav>

      {sheet}
    </>
  )
}