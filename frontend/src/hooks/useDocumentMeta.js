import { useEffect } from 'react'

function upsertMeta(attr, key, content) {
  if (!content) return
  let el = document.head.querySelector(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertLink(rel, href) {
  if (!href) return
  let el = document.head.querySelector(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

/**
 * Sets document title and common meta tags for the current route.
 * Restores previous title on unmount so SPA navigations stay consistent.
 */
export default function useDocumentMeta({
  title,
  description,
  canonical,
  robots = 'index, follow',
  ogTitle,
  ogDescription,
}) {
  useEffect(() => {
    const prevTitle = document.title
    if (title) document.title = title
    if (description) upsertMeta('name', 'description', description)
    if (robots) upsertMeta('name', 'robots', robots)
    if (canonical) upsertLink('canonical', canonical)
    upsertMeta('property', 'og:title', ogTitle || title)
    upsertMeta('property', 'og:description', ogDescription || description)
    if (canonical) upsertMeta('property', 'og:url', canonical)

    return () => {
      document.title = prevTitle
    }
  }, [title, description, canonical, robots, ogTitle, ogDescription])
}
