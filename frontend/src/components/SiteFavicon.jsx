import { useMemo, useState } from 'react'

function parseHostname(siteUrl) {
  if (!siteUrl) return ''
  try {
    const fixed = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`
    return new URL(fixed).hostname.replace(/^www\./, '')
  } catch {
    return String(siteUrl)
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
  }
}

function firstLetterFrom(name, url) {
  const host = parseHostname(url)
  const fromHost = host.replace(/[^a-zA-Z0-9]/g, '').charAt(0)
  if (fromHost) return fromHost.toUpperCase()
  const fromName = String(name || '').replace(/[^a-zA-Z0-9]/g, '').charAt(0)
  return (fromName || '?').toUpperCase()
}

export function getFaviconUrl(siteUrl, size = 64) {
  const host = parseHostname(siteUrl)
  if (!host) return null
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=${size}`
}

/**
 * Site favicon with letter fallback (same pattern as Projects list).
 */
export default function SiteFavicon({
  name = '',
  url = '',
  size = 28,
  radius = 7,
  className = '',
  style = {},
}) {
  const [failed, setFailed] = useState(false)
  const faviconUrl = useMemo(() => getFaviconUrl(url, Math.max(32, size * 2)), [url, size])
  const letter = useMemo(() => firstLetterFrom(name, url), [name, url])
  const bg = useMemo(
    () => `hsl(${((letter.charCodeAt(0) || 65) * 37) % 360}, 55%, 48%)`,
    [letter]
  )

  if (faviconUrl && !failed) {
    return (
      <img
        className={className}
        src={faviconUrl}
        alt=""
        width={size}
        height={size}
        onError={() => setFailed(true)}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          objectFit: 'contain',
          background: '#fff',
          border: '1px solid #E5E7EB',
          flexShrink: 0,
          padding: Math.max(2, Math.round(size * 0.12)),
          boxSizing: 'border-box',
          ...style,
        }}
      />
    )
  }

  return (
    <div
      className={className}
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        flexShrink: 0,
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      <span
        style={{
          color: '#fff',
          fontWeight: 800,
          fontSize: Math.max(10, Math.round(size * 0.42)),
          lineHeight: 1,
          textTransform: 'uppercase',
        }}
      >
        {letter}
      </span>
    </div>
  )
}

/** Small favicon for brand/competitor names in lists */
export function BrandFavicon({ name = '', size = 16 }) {
  const [failed, setFailed] = useState(false)
  const domainGuess = useMemo(() => {
    const raw = String(name || '').trim()
    if (!raw) return ''
    if (/\./.test(raw)) {
      return raw.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
    }
    const slug = raw.toLowerCase().replace(/[^a-z0-9]+/g, '')
    return slug ? `${slug}.com` : ''
  }, [name])

  const faviconUrl = domainGuess
    ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domainGuess)}&sz=64`
    : null
  const letter = String(name || '?').replace(/[^a-zA-Z0-9]/g, '').charAt(0).toUpperCase() || '?'

  if (faviconUrl && !failed) {
    return (
      <img
        src={faviconUrl}
        alt=""
        width={size}
        height={size}
        onError={() => setFailed(true)}
        style={{
          width: size,
          height: size,
          borderRadius: 4,
          objectFit: 'contain',
          background: '#fff',
          border: '1px solid #E5E7EB',
          flexShrink: 0,
        }}
      />
    )
  }

  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: 4,
        background: '#EEF2FF',
        color: '#4338CA',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.max(8, size * 0.55),
        fontWeight: 800,
        flexShrink: 0,
      }}
    >
      {letter}
    </span>
  )
}
