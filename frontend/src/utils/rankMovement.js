/** Valid SERP rank only: integer >= 1. */
export function toRankPosition(value) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  const rounded = Math.round(n)
  return rounded >= 1 ? rounded : null
}

/**
 * Canonical ranking-change status (Phase 3.3).
 * LOST only when previous rank was a real position (>= 1).
 *
 * Statuses: new | up | down | same | lost | not-ranked
 */
export function computeRankMovement(previousPosition, currentPosition, options = {}) {
  const prev = toRankPosition(previousPosition)
  const curr = toRankPosition(currentPosition)
  const hasPreviousObservation = options.hasPreviousObservation === true

  if (!hasPreviousObservation) {
    if (curr != null) {
      return { status: 'new', change: null, previousPosition: null, position: curr }
    }
    return { status: 'not-ranked', change: null, previousPosition: null, position: null }
  }

  if (prev != null && curr == null) {
    return { status: 'lost', change: null, previousPosition: prev, position: null }
  }

  if (prev == null && curr != null) {
    return { status: 'new', change: null, previousPosition: null, position: curr }
  }

  if (prev == null && curr == null) {
    return { status: 'not-ranked', change: null, previousPosition: null, position: null }
  }

  const change = prev - curr
  if (change > 0) {
    return { status: 'up', change, previousPosition: prev, position: curr }
  }
  if (change < 0) {
    return { status: 'down', change, previousPosition: prev, position: curr }
  }
  return { status: 'same', change: 0, previousPosition: prev, position: curr }
}

/**
 * Resolve display movement from persisted rank_state.
 * Prefers Local Pack when present (real Google visibility users see).
 */
export function resolveRankMovement(rankState = {}) {
  const organicPosition = toRankPosition(rankState.position ?? rankState.organic_position)
  const localPosition = toRankPosition(rankState.local_position)
  const previousOrganic = toRankPosition(rankState.previous_position)
  const previousLocal = toRankPosition(rankState.previous_local_position)
  const checkedAt = rankState.checked_at || null
  const rawStatus = String(rankState.status || '').toLowerCase()
  const visibility =
    rankState.visibility ||
    (localPosition != null && organicPosition != null
      ? 'both'
      : localPosition != null
        ? 'local'
        : organicPosition != null
          ? 'organic'
          : 'none')

  const checked =
    Boolean(checkedAt) ||
    ['new', 'up', 'down', 'same', 'lost', 'not-ranked'].includes(rawStatus) ||
    localPosition != null ||
    organicPosition != null

  if (!checked) {
    return {
      status: 'not-ranked',
      change: null,
      previousPosition: null,
      position: null,
      organicPosition: null,
      localPosition: null,
      visibility: 'none',
      inFirstPage: false,
      checkedAt: null,
      checked: false,
    }
  }

  // Prefer Local Pack for change/status when currently visible there
  const useLocal = localPosition != null || (visibility === 'local' && previousLocal != null)
  const movement = computeRankMovement(
    useLocal ? previousLocal : previousOrganic,
    useLocal ? localPosition : organicPosition,
    { hasPreviousObservation: true }
  )

  let status = movement.status
  if (status === 'lost' && toRankPosition(movement.previousPosition) == null) {
    status = 'not-ranked'
  }
  // If organic is not ranked but Local Pack is present, never show NOT RANKED
  if (localPosition != null && status === 'not-ranked') {
    status = 'new'
  }

  const inFirstPage =
    rankState.in_first_page === true ||
    localPosition != null ||
    (organicPosition != null && organicPosition <= 10)

  return {
    status,
    change: movement.change,
    previousPosition: movement.previousPosition,
    position: useLocal ? localPosition : organicPosition,
    organicPosition,
    localPosition,
    visibility,
    inFirstPage,
    checkedAt,
    checked: true,
    source: useLocal ? 'local' : organicPosition != null ? 'organic' : 'none',
  }
}

export function formatRankPositionLabel(rank) {
  if (rank?.localPosition) {
    return {
      label: `Local #${rank.localPosition}`,
      sub:
        rank.organicPosition != null
          ? `Organic #${rank.organicPosition}`
          : 'Google Map Pack',
      colorKey: 'local',
    }
  }
  if (rank?.organicPosition || rank?.position) {
    const pos = rank.organicPosition || rank.position
    return { label: `#${pos}`, sub: 'Organic', colorKey: 'organic' }
  }
  return { label: '-', sub: 'Not in SERP', colorKey: 'none' }
}

export function formatRankMovementDisplay(movement, colors = {}) {
  const muted = colors.muted || '#6b7280'
  const green = colors.green || '#16a34a'
  const red = colors.red || '#dc2626'
  const orange = colors.orange || '#ea580c'

  switch (movement?.status) {
    case 'new':
      return {
        label: movement.source === 'local' || movement.localPosition ? 'NEW (Local)' : 'NEW',
        color: green,
      }
    case 'up':
      return {
        label: movement.change != null ? `\u2191 GAINED +${movement.change}` : '\u2191 GAINED',
        color: green,
      }
    case 'down':
      return {
        label: movement.change != null ? `\u2193 DROPPED ${Math.abs(movement.change)}` : '\u2193 DROPPED',
        color: red,
      }
    case 'same':
      return { label: 'SAME', color: muted }
    case 'lost':
      if (toRankPosition(movement.previousPosition) == null) {
        return { label: 'NOT RANKED', color: muted }
      }
      return { label: 'LOST', color: red }
    case 'not-ranked':
    default:
      return { label: 'NOT RANKED', color: muted }
  }
}
