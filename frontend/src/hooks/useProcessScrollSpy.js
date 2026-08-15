import { useEffect, useState } from 'react'

/**
 * Highlight the process step whose section is currently in view while scrolling.
 * Uses .app-main as the scroll root (app shell).
 *
 * Rule: last section whose top has crossed under the sticky process bar wins.
 * Near-bottom only activates the last step if that section is actually on screen.
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
      // Sticky process bar + small buffer — do NOT use a deep "reading zone"
      // or mid-page markers (e.g. sidebar) will jump the active step early.
      const stickyLine = 96
      let current = sectionSteps[0].stepId

      for (const item of sectionSteps) {
        const el = document.getElementById(item.sectionId)
        if (!el) continue
        const rect = el.getBoundingClientRect()
        // Ignore zero-size placeholders (empty markers break scroll-spy)
        if (rect.height < 8 && rect.width < 8) continue
        if (rect.top <= stickyLine) current = item.stepId
      }

      // Near page end: only force last step if that section is visible
      const last = sectionSteps[sectionSteps.length - 1]
      const lastEl = last ? document.getElementById(last.sectionId) : null
      if (lastEl) {
        const lastRect = lastEl.getBoundingClientRect()
        const remaining = root.scrollHeight - root.scrollTop - root.clientHeight
        const lastVisible =
          lastRect.height >= 8 &&
          lastRect.top < root.clientHeight * 0.7 &&
          lastRect.bottom > stickyLine
        if (remaining < 64 && lastVisible) {
          current = last.stepId
        }
      }

      setActiveId((prev) => (prev === current ? prev : current))
    }

    update()
    root.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
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
