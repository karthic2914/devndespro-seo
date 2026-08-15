import { useEffect, useState } from 'react'

/**
 * Highlight the process step whose section is currently in view while scrolling.
 * Uses .app-main as the scroll root (app shell).
 *
 * @param {Array<{ id: string, sectionId?: string }>} steps
 * @param {unknown[]} [deps] - rebind when layout-changing state updates
 */
export default function useProcessScrollSpy(steps = [], deps = []) {
  const [activeId, setActiveId] = useState(() => steps[0]?.id || null)

  useEffect(() => {
    const root = document.querySelector('.app-main')
    if (!root) return undefined

    // One step per section (first wins if multiple steps share a sectionId)
    const sectionSteps = []
    const seen = new Set()
    for (const s of steps) {
      if (!s?.sectionId || !s?.id || seen.has(s.sectionId)) continue
      seen.add(s.sectionId)
      sectionSteps.push({ stepId: s.id, sectionId: s.sectionId })
    }
    if (!sectionSteps.length) return undefined

    const update = () => {
      // Activate when a section header reaches the upper reading zone
      // (under the sticky process bar), not only when it hits the bar itself.
      const activateLine = 160
      let current = sectionSteps[0].stepId

      for (const item of sectionSteps) {
        const el = document.getElementById(item.sectionId)
        if (!el) continue
        const top = el.getBoundingClientRect().top
        if (top <= activateLine) current = item.stepId
      }

      // Near page bottom → last section (Digital PR / final step)
      const remaining = root.scrollHeight - root.scrollTop - root.clientHeight
      if (remaining < 160) {
        current = sectionSteps[sectionSteps.length - 1].stepId
      }

      setActiveId((prev) => (prev === current ? prev : current))
    }

    update()
    root.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    // Sections expand/collapse after paint — re-check once
    const raf = requestAnimationFrame(update)

    return () => {
      cancelAnimationFrame(raf)
      root.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps, ...deps])

  return [activeId, setActiveId]
}
