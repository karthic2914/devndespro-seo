import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  FontAwesomeIcon,
} from '@fortawesome/react-fontawesome'

import {
  faChartPie,
  faMagnifyingGlassChart,
  faKey,
  faLink,
  faRobot,
  faEllipsis,
  faListCheck,
  faUsers,
  faBell,
  faPlug,
  faEnvelope,
  faPaperPlane,
  faRankingStar,
  faChartLine,
  faXmark,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons'

import './MobileProjectNav.css'

export default function MobileProjectNav({
  siteId,
}) {
  const navigate = useNavigate()

  const [showMore, setShowMore] =
    useState(false)

  useEffect(() => {
    if (!showMore) {
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
  }, [showMore])


  const go = (path) => {
    setShowMore(false)

    navigate(
      path
        ? `/site/${siteId}/${path}`
        : `/site/${siteId}`
    )
  }


  const primary = [
    {
      id: 'overview',
      label: 'Overview',
      icon: faChartPie,
      path: '',
    },

    {
      id: 'audit',
      label: 'Audit',
      icon: faMagnifyingGlassChart,
      path: 'audit',
      active: true,
    },

    {
      id: 'keywords',
      label: 'Keywords',
      icon: faKey,
      path: 'keywords',
    },

    {
      id: 'backlinks',
      label: 'Backlinks',
      icon: faLink,
      path: 'backlinks',
    },

    {
      id: 'ai',
      label: 'AI',
      icon: faRobot,
      path: 'ai-visibility',
    },
  ]


  const moreGroups = [
    {
      title: 'Grow',
      items: [
        {
          label: 'Action Plan',
          description:
            'Turn audit findings into tasks',
          icon: faListCheck,
          path: 'actions',
        },

        {
          label: 'Competitors',
          description:
            'Compare competing websites',
          icon: faUsers,
          path: 'competitors',
        },

        {
          label: 'Rank #1',
          description:
            'SEO ranking opportunities',
          icon: faRankingStar,
          path: 'rank',
        },
      ],
    },

    {
      title: 'Monitor',
      items: [
        {
          label: 'Alerts',
          description:
            'Important SEO changes',
          icon: faBell,
          path: 'alerts',
        },

        {
          label: 'Reports',
          description:
            'Review project reports',
          icon: faChartLine,
          path: 'reports',
        },
      ],
    },

    {
      title: 'Automate',
      items: [
        {
          label: 'Integrations',
          description:
            'Connect your SEO tools',
          icon: faPlug,
          path: 'integrations',
        },

        {
          label: 'Email Reports',
          description:
            'Schedule SEO reports',
          icon: faEnvelope,
          path: 'email-reports',
        },

        {
          label: 'Cold Email',
          description:
            'SEO outreach campaigns',
          icon: faPaperPlane,
          path: 'cold-emails',
        },
      ],
    },
  ]


  return (
    <>
      <nav
        className="mpnav-root"
        aria-label="Project features"
      >

        <div className="mpnav-scroll">

          {primary.map((item) => (

            <button
              type="button"
              key={item.id}
              className={
                `mpnav-item ${
                  item.active
                    ? 'active'
                    : ''
                }`
              }
              onClick={() =>
                go(item.path)
              }
            >

              <span className="mpnav-icon">
                <FontAwesomeIcon
                  icon={item.icon}
                />
              </span>

              <span>
                {item.label}
              </span>

            </button>

          ))}


          <button
            type="button"
            className="mpnav-item"
            onClick={() =>
              setShowMore(true)
            }
          >

            <span className="mpnav-icon">
              <FontAwesomeIcon
                icon={faEllipsis}
              />
            </span>

            <span>
              More
            </span>

          </button>

        </div>

      </nav>


      {showMore && (

        <div
          className="mpnav-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setShowMore(false)
            }
          }}
        >

          <section
            className="mpnav-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="More project tools"
          >

            <div className="mpnav-sheet-handle" />


            <header className="mpnav-sheet-header">

              <div>
                <strong>
                  Project Tools
                </strong>

                <span>
                  More ways to improve this site
                </span>
              </div>


              <button
                type="button"
                className="mpnav-close"
                aria-label="Close project tools"
                onClick={() =>
                  setShowMore(false)
                }
              >
                <FontAwesomeIcon
                  icon={faXmark}
                />
              </button>

            </header>


            <div className="mpnav-sheet-content">

              {moreGroups.map(
                (group) => (

                  <div
                    className="mpnav-group"
                    key={group.title}
                  >

                    <h3>
                      {group.title}
                    </h3>


                    <div className="mpnav-tool-list">

                      {group.items.map(
                        (item) => (

                          <button
                            type="button"
                            className="mpnav-tool"
                            key={item.path}
                            onClick={() =>
                              go(item.path)
                            }
                          >

                            <span className="mpnav-tool-icon">
                              <FontAwesomeIcon
                                icon={
                                  item.icon
                                }
                              />
                            </span>


                            <span className="mpnav-tool-copy">

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
                              className="mpnav-chevron"
                              icon={
                                faChevronRight
                              }
                            />

                          </button>

                        )
                      )}

                    </div>

                  </div>

                )
              )}

            </div>

          </section>

        </div>

      )}

    </>
  )
}