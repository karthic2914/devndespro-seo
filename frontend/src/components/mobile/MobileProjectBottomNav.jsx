import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import {
  createPortal,
} from 'react-dom'

import {
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom'

import {
  FontAwesomeIcon,
} from '@fortawesome/react-fontawesome'

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


const MORE_ROUTES = [
  {
    group: 'Analyze',
    items: [
      {
        label: 'Backlinks',
        description: 'Review backlink performance',
        icon: faLink,
        path: 'backlinks',
      },

      {
        label: 'AI Visibility',
        description: 'Track visibility in AI search',
        icon: faRobot,
        path: 'ai-visibility',
      },

      {
        label: 'Competitors',
        description: 'Compare competing websites',
        icon: faUsers,
        path: 'competitors',
      },

      {
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
        label: 'Alerts',
        description: 'Important SEO changes',
        icon: faBell,
        path: 'alerts',
      },

      {
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
        label: 'Integrations',
        description: 'Connect your SEO tools',
        icon: faPlug,
        path: 'integrations',
      },

      {
        label: 'Email Reports',
        description: 'Schedule SEO reports',
        icon: faEnvelope,
        path: 'email-reports',
      },

      {
        label: 'Cold Email',
        description: 'SEO outreach campaigns',
        icon: faPaperPlane,
        path: 'cold-emails',
      },
    ],
  },
]


export default function MobileProjectBottomNav() {
  const navigate =
    useNavigate()

  const location =
    useLocation()

  const { siteId } =
    useParams()

  const [moreOpen, setMoreOpen] =
    useState(false)


  /*
   * Shared nav only belongs to project routes.
   */
  const projectBase =
    `/site/${siteId}`


  const active =
    useMemo(() => {
      const pathname =
        location.pathname

      if (
        pathname === projectBase ||
        pathname === `${projectBase}/`
      ) {
        return 'overview'
      }

      if (
        pathname.startsWith(
          `${projectBase}/audit`
        )
      ) {
        return 'audit'
      }

      if (
        pathname.startsWith(
          `${projectBase}/keywords`
        )
      ) {
        return 'keywords'
      }

      if (
        pathname.startsWith(
          `${projectBase}/actions`
        )
      ) {
        return 'actions'
      }

      /*
       * All secondary project tools
       * are represented by More.
       */
      return 'more'
    }, [
      location.pathname,
      projectBase,
    ])


  /*
   * Tell the app shell that the shared
   * project navigation is active.
   */
  useEffect(() => {
    document.body.classList.add(
      'shared-mobile-project-nav-active'
    )

    return () => {
      document.body.classList.remove(
        'shared-mobile-project-nav-active'
      )
    }
  }, [])


  /*
   * Lock body scrolling while native sheet
   * is open.
   */
  useEffect(() => {
    if (!moreOpen) {
      return undefined
    }

    const previous =
      document.body.style.overflow

    document.body.style.overflow =
      'hidden'

    return () => {
      document.body.style.overflow =
        previous
    }
  }, [moreOpen])


  const go = (path = '') => {
    setMoreOpen(false)

    if (!path) {
      navigate(projectBase)
      return
    }

    navigate(
      `${projectBase}/${path}`
    )
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
      id: 'actions',
      label: 'Actions',
      icon: faListCheck,
      action: () => go('actions'),
    },

    {
      id: 'more',
      label: 'More',
      icon: faEllipsisVertical,
      action: () =>
        setMoreOpen(true),
    },
  ]


  const sheet =
    moreOpen
      ? createPortal(
          <div
            className="smpn-layer"
            role="presentation"
            onClick={() =>
              setMoreOpen(false)
            }
          >

            <section
              className="smpn-sheet"
              role="dialog"
              aria-modal="true"
              aria-label="More project options"
              onClick={(event) =>
                event.stopPropagation()
              }
            >

              <div className="smpn-handle" />


              <header className="smpn-sheet-header">

                <div>

                  <strong>
                    More
                  </strong>

                  <span>
                    Project tools
                  </span>

                </div>


                <button
                  type="button"
                  className="smpn-close"
                  aria-label="Close"
                  onClick={() =>
                    setMoreOpen(false)
                  }
                >
                  <FontAwesomeIcon
                    icon={faXmark}
                  />
                </button>

              </header>


              <div className="smpn-sheet-scroll">

                {MORE_ROUTES.map(
                  (group) => (

                    <section
                      className="smpn-group"
                      key={group.group}
                    >

                      <h3>
                        {group.group}
                      </h3>


                      <div className="smpn-links">

                        {group.items.map(
                          (item) => (

                            <button
                              type="button"
                              key={item.path}
                              onClick={() =>
                                go(item.path)
                              }
                            >

                              <span className="smpn-link-icon">
                                <FontAwesomeIcon
                                  icon={item.icon}
                                />
                              </span>


                              <span className="smpn-link-copy">

                                <strong>
                                  {item.label}
                                </strong>

                                <small>
                                  {
                                    item.description
                                  }
                                </small>

                              </span>


                              <FontAwesomeIcon
                                className="smpn-chevron"
                                icon={
                                  faChevronRight
                                }
                              />

                            </button>

                          )
                        )}

                      </div>

                    </section>

                  )
                )}

              </div>

            </section>

          </div>,
          document.body
        )
      : null


  return (
    <>

      <nav
        className="smpn-bottom-nav"
        aria-label="Project navigation"
      >

        {tabs.map((tab) => (

          <button
            type="button"
            key={tab.id}
            className={
              active === tab.id
                ? 'is-active'
                : ''
            }
            onClick={tab.action}
          >

            <FontAwesomeIcon
              icon={tab.icon}
            />

            <span>
              {tab.label}
            </span>

          </button>

        ))}

      </nav>


      {sheet}

    </>
  )
}