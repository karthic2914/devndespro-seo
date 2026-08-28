import { useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faBolt,
  faCheck,
  faChevronDown,
  faChevronUp,
  faPlus,
  faRotate,
  faWandMagicSparkles,
} from '@fortawesome/free-solid-svg-icons'
import '../../styles/actions-mobile-native.css'

function bucketFor(impact) {
  const i = String(impact || '').toLowerCase()
  if (i === 'critical' || i === 'high') return 'first'
  if (i === 'low') return 'later'
  return 'then'
}

function priorityLabel(impact) {
  const b = bucketFor(impact)

  if (b === 'first') return { text: 'Do now', cls: 'danger' }
  if (b === 'later') return { text: 'Later', cls: 'later' }

  return { text: 'Soon', cls: 'soon' }
}

function Chips({ action }) {
  const priority = priorityLabel(action.impact)

  return (
    <div className="ma-chips">
      <span className={`ma-chip ${priority.cls}`}>
        {priority.text}
      </span>

      {action.impact && (
        <span className={`ma-chip impact-${String(action.impact).toLowerCase()}`}>
          {action.impact}
        </span>
      )}

      {action.category && (
        <span className="ma-chip category">
          {action.category}
        </span>
      )}
    </div>
  )
}

function TaskCard({
  action,
  rank,
  onToggle,
  onAskAiFix,
}) {
  return (
    <div className="ma-task">
      <div className="ma-rank small">{rank}</div>

      <div className="ma-task-main">
        <div className="ma-task-title">
          {action.text}
        </div>

        <Chips action={action} />

        {action.why && (
          <div className="ma-why">
            {action.why}
          </div>
        )}
      </div>

      <div className="ma-task-actions">
        <button
          type="button"
          className="ma-check"
          onClick={() => onToggle(action.id, action.done)}
          aria-label="Mark fixed"
        />

        <button
          type="button"
          className="ma-ai compact"
          onClick={() => onAskAiFix(action)}
        >
          <FontAwesomeIcon icon={faWandMagicSparkles} />
          <span>AI Fix</span>
        </button>
      </div>
    </div>
  )
}

function Group({
  title,
  tone,
  items,
  pending,
  onToggle,
  onAskAiFix,
}) {
  const [open, setOpen] = useState(true)

  if (!items.length) return null

  return (
    <section className="ma-group">
      <button
        type="button"
        className={`ma-group-header ${tone}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="ma-group-name">
          <span className="ma-dot" />
          {title} ({items.length})
        </span>

        <FontAwesomeIcon
          icon={open ? faChevronUp : faChevronDown}
        />
      </button>

      {open && (
        <div className="ma-group-list">
          {items.map((action) => (
            <TaskCard
              key={action.id}
              action={action}
              rank={pending.findIndex((p) => p.id === action.id) + 1}
              onToggle={onToggle}
              onAskAiFix={onAskAiFix}
            />
          ))}
        </div>
      )}
    </section>
  )
}

export default function MobileActionPlan({
  actions,
  pending,
  completed,
  next,
  doFirst,
  doThen,
  doLater,
  loading,
  syncing,
  form,
  setForm,
  adding,
  onAdd,
  onRefresh,
  onToggle,
  onAskAiFix,
}) {
  const [showAdd, setShowAdd] = useState(false)
  const [showAllCompleted, setShowAllCompleted] = useState(false)

  const done = completed.length
  const total = actions.length
  const pct = total ? Math.round((done / total) * 100) : 0

  const first = useMemo(
    () => doFirst.filter((a) => a.id !== next?.id),
    [doFirst, next]
  )

  const soon = useMemo(
    () => doThen.filter((a) => a.id !== next?.id),
    [doThen, next]
  )

  const later = useMemo(
    () => doLater.filter((a) => a.id !== next?.id),
    [doLater, next]
  )

  const completedVisible = showAllCompleted
    ? completed
    : completed.slice(0, 3)

  const go = (id) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

  return (
    <div className="mobile-action-plan">
      <div className="ma-header">
        <div>
          <h1>Action Plan</h1>
          <p>Start at #1 and work down</p>
        </div>

        <button
          className="ma-refresh"
          type="button"
          disabled={syncing || loading}
          onClick={onRefresh}
        >
          <FontAwesomeIcon icon={faRotate} spin={syncing} />
          {syncing ? 'Refreshing' : 'Refresh'}
        </button>
      </div>

      <section className="ma-progress-card">
        <div
          className="ma-progress-ring"
          style={{ '--ma-progress': `${pct * 3.6}deg` }}
        >
          <div className="ma-progress-center">
            <strong>{done}</strong>
            <span>of {total}</span>
          </div>
        </div>

        <div className="ma-progress-copy">
          <strong>{pct}% completed</strong>
          <span>Numbered by ranking impact</span>
          <span>Start at #1 and work down</span>
        </div>

        <div className="ma-progress-icon">
          <FontAwesomeIcon icon={faCheck} />
        </div>
      </section>

      <nav className="ma-tabs">
        <button
          type="button"
          className="active"
          onClick={() => go('ma-start')}
        >
          <FontAwesomeIcon icon={faBolt} />
          Next best
        </button>

        <button
          type="button"
          onClick={() => go('ma-pending')}
        >
          Pending
          <b>{pending.length}</b>
        </button>

        <button
          type="button"
          onClick={() => go('ma-completed')}
        >
          Completed
          <b>{done}</b>
        </button>
      </nav>

      {loading ? (
        <div className="ma-empty">
          Loading action plan...
        </div>
      ) : (
        <>
          {next && (
            <section id="ma-start">
              <div className="ma-start-title">
                <FontAwesomeIcon icon={faBolt} />
                START HERE
              </div>

              <div className="ma-hero">
                <div className="ma-hero-top">
                  <div className="ma-rank">1</div>

                  <div className="ma-hero-main">
                    <h2>{next.text}</h2>

                    <Chips action={next} />

                    {next.why && (
                      <p>{next.why}</p>
                    )}
                  </div>

                  <button
                    className="ma-check large"
                    type="button"
                    onClick={() => onToggle(next.id, next.done)}
                  />
                </div>

                <div className="ma-hero-actions">
                  <button
                    className="ma-fixed"
                    type="button"
                    onClick={() => onToggle(next.id, next.done)}
                  >
                    <FontAwesomeIcon icon={faCheck} />
                    Mark as fixed
                  </button>

                  <button
                    className="ma-ai"
                    type="button"
                    onClick={() => onAskAiFix(next)}
                  >
                    <FontAwesomeIcon icon={faWandMagicSparkles} />
                    AI Fix
                  </button>
                </div>
              </div>
            </section>
          )}

          <div id="ma-pending">
            <Group
              title="DO NOW"
              tone="danger"
              items={first}
              pending={pending}
              onToggle={onToggle}
              onAskAiFix={onAskAiFix}
            />

            <Group
              title="SOON"
              tone="soon"
              items={soon}
              pending={pending}
              onToggle={onToggle}
              onAskAiFix={onAskAiFix}
            />

            <Group
              title="LATER"
              tone="later"
              items={later}
              pending={pending}
              onToggle={onToggle}
              onAskAiFix={onAskAiFix}
            />
          </div>

          <section className="ma-add-section">
            {!showAdd ? (
              <button
                type="button"
                className="ma-add-trigger"
                onClick={() => setShowAdd(true)}
              >
                <FontAwesomeIcon icon={faPlus} />
                Add action
              </button>
            ) : (
              <div className="ma-add-card">
                <strong>Add action</strong>

                <input
                  value={form.text}
                  placeholder="New action item..."
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      text: e.target.value,
                    }))
                  }
                />

                <select
                  value={form.impact}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      impact: e.target.value,
                    }))
                  }
                >
                  <option value="Critical">Do now - Critical</option>
                  <option value="High">Do now - High</option>
                  <option value="Medium">Soon - Medium</option>
                  <option value="Low">Later - Low</option>
                </select>

                <div className="ma-add-buttons">
                  <button
                    type="button"
                    onClick={() => setShowAdd(false)}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="primary"
                    disabled={adding}
                    onClick={onAdd}
                  >
                    {adding ? 'Adding...' : 'Add action'}
                  </button>
                </div>
              </div>
            )}
          </section>

          {completed.length > 0 && (
            <section id="ma-completed" className="ma-completed">
              <button
                type="button"
                className="ma-group-header completed"
                onClick={() =>
                  setShowAllCompleted((v) => !v)
                }
              >
                <span className="ma-group-name">
                  <span className="ma-dot" />
                  COMPLETED ({completed.length})
                </span>

                <FontAwesomeIcon
                  icon={
                    showAllCompleted
                      ? faChevronUp
                      : faChevronDown
                  }
                />
              </button>

              <div className="ma-completed-card">
                {completedVisible.map((action) => (
                  <button
                    type="button"
                    className="ma-completed-row"
                    key={action.id}
                    onClick={() =>
                      onToggle(action.id, action.done)
                    }
                  >
                    <span className="ma-done-check">
                      <FontAwesomeIcon icon={faCheck} />
                    </span>

                    <span className="ma-done-text">
                      {action.text}
                    </span>

                    {action.category && (
                      <span className="ma-done-category">
                        {action.category}
                      </span>
                    )}
                  </button>
                ))}

                {completed.length > 3 && (
                  <button
                    type="button"
                    className="ma-view-completed"
                    onClick={() =>
                      setShowAllCompleted((v) => !v)
                    }
                  >
                    {showAllCompleted
                      ? 'Show fewer completed'
                      : `View all completed (${completed.length})`}

                    <FontAwesomeIcon
                      icon={
                        showAllCompleted
                          ? faChevronUp
                          : faChevronDown
                      }
                    />
                  </button>
                )}
              </div>
            </section>
          )}

          {!actions.length && (
            <div className="ma-empty">
              No open tasks. Run a site audit or refresh priorities.
            </div>
          )}
        </>
      )}
    </div>
  )
}
