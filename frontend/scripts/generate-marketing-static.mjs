/**
 * After Vite build: clone dist/index.html for each marketing route so hard refresh
 * still boots the SPA (dark theme) instead of a plain white static page.
 * Injects route-specific meta + a hidden crawler shell for SEO.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const outArgIdx = process.argv.indexOf('--out')
const outRoot = path.join(root, outArgIdx >= 0 ? process.argv[outArgIdx + 1] || 'dist' : 'dist')

const dataUrl = pathToFileURL(path.join(root, 'src/data/marketingPages.js')).href
const { MARKETING_PAGES, ALL_MARKETING_PATHS } = await import(dataUrl)

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function replaceMeta(html, { title, description, canonical }) {
  let next = html
  next = next.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(title)}</title>`)
  next = next.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
    `<meta name="description" content="${escapeHtml(description)}" />`
  )
  next = next.replace(
    /<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/i,
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`
  )
  next = next.replace(
    /<meta\s+property="og:url"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:url" content="${escapeHtml(canonical)}" />`
  )
  next = next.replace(
    /<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:title" content="${escapeHtml(title)}" />`
  )
  next = next.replace(
    /<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/i,
    `<meta property="og:description" content="${escapeHtml(description)}" />`
  )
  return next
}

function buildShell(page) {
  const sections = page.sections
    .map(
      (s) =>
        `<h2>${escapeHtml(s.h2)}</h2>${s.body.map((p) => `<p>${escapeHtml(p)}</p>`).join('')}`
    )
    .join('')
  const faqs = page.faqs
    .map((f) => `<h3>${escapeHtml(f.q)}</h3><p>${escapeHtml(f.a)}</p>`)
    .join('')
  const nav = ALL_MARKETING_PATHS.map(
    (p) => `<a href="${p}">${escapeHtml(p.replace(/^\//, '').replace(/-/g, ' '))}</a>`
  ).join('\n')

  return `<main id="seo-shell" aria-hidden="true">
  <h1>${escapeHtml(page.h1)}</h1>
  <nav>${nav}</nav>
  <p>${escapeHtml(page.intro)}</p>
  ${sections}
  <h2>Frequently asked questions</h2>
  ${faqs}
</main>`
}

const indexPath = path.join(outRoot, 'index.html')
if (!fs.existsSync(indexPath)) {
  console.error('Missing dist/index.html — run vite build first.')
  process.exit(1)
}

const spaHtml = fs.readFileSync(indexPath, 'utf8')

for (const page of Object.values(MARKETING_PAGES)) {
  const slug = page.path.replace(/^\//, '')
  const dir = path.join(outRoot, slug)
  fs.mkdirSync(dir, { recursive: true })

  let html = replaceMeta(spaHtml, {
    title: page.title,
    description: page.description,
    canonical: `https://seo.devndespro.com${page.path}`,
  })

  // Swap home shell for page-specific crawl content (still visually hidden by CSS in head)
  if (/<main id="seo-shell"[\s\S]*?<\/main>/i.test(html)) {
    html = html.replace(/<main id="seo-shell"[\s\S]*?<\/main>/i, buildShell(page))
  } else {
    html = html.replace(/<div id="root"><\/div>/i, `${buildShell(page)}\n    <div id="root"></div>`)
  }

  const out = path.join(dir, 'index.html')
  fs.writeFileSync(out, html, 'utf8')
  console.log('Wrote SPA shell', out)
}

// Dedicated pricing route (React PricingPage) — not in MARKETING_PAGES slug map the same way
// MARKETING_PAGES already includes pricing — good.

const sitemapUrls = [
  { loc: 'https://seo.devndespro.com/', priority: '1.0' },
  ...Object.values(MARKETING_PAGES).map((p) => ({
    loc: `https://seo.devndespro.com${p.path}`,
    priority: '0.8',
  })),
]

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls
  .map(
    (u) => `  <url>
    <loc>${u.loc}</loc>
    <changefreq>weekly</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>
`

fs.writeFileSync(path.join(root, 'public', 'sitemap.xml'), sitemap, 'utf8')
fs.writeFileSync(path.join(outRoot, 'sitemap.xml'), sitemap, 'utf8')
console.log('Wrote sitemap.xml')
