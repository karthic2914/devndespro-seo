/**
 * Generates crawlable static HTML for marketing routes into the Vite dist folder.
 * Run AFTER `vite build` so local `vite` dev still uses React Router.
 *
 * Usage: node scripts/generate-marketing-static.mjs
 *        node scripts/generate-marketing-static.mjs --out dist
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

function renderPage(page) {
  const moreLinks = ALL_MARKETING_PATHS.filter((p) => p !== page.path)
    .map((p) => `<a href="${p}">${escapeHtml(p.replace(/^\//, ''))}</a>`)
    .join(' · ')

  const sections = page.sections
    .map(
      (s) => `
    <section>
      <h2>${escapeHtml(s.h2)}</h2>
      ${s.body.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n')}
    </section>`
    )
    .join('\n')

  const faqs = page.faqs
    .map(
      (f) => `
      <div>
        <h3>${escapeHtml(f.q)}</h3>
        <p>${escapeHtml(f.a)}</p>
      </div>`
    )
    .join('\n')

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(page.title)}</title>
  <meta name="description" content="${escapeHtml(page.description)}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="https://seo.devndespro.com${page.path}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://seo.devndespro.com${page.path}" />
  <meta property="og:title" content="${escapeHtml(page.title)}" />
  <meta property="og:description" content="${escapeHtml(page.description)}" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <style>
    body { margin: 0; font-family: Inter, system-ui, sans-serif; background: #FBFAF8; color: #171923; line-height: 1.65; }
    a { color: #4338ca; }
    header, main, footer { max-width: 820px; margin: 0 auto; padding: 24px; }
    header { display: flex; flex-wrap: wrap; gap: 12px 18px; align-items: center; border-bottom: 1px solid #E4E1DB; }
    header a { text-decoration: none; color: #5B5E68; font-weight: 600; font-size: 14px; }
    .brand { color: #171923; font-weight: 750; margin-right: auto; }
    .eyebrow { color: #D75F32; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; }
    h1 { font-size: clamp(32px, 5vw, 48px); line-height: 1.08; letter-spacing: -0.04em; margin: 12px 0 18px; }
    h2 { margin-top: 36px; letter-spacing: -0.03em; }
    p { color: #5B5E68; }
    .cta { display: inline-block; margin-top: 8px; background: #EA6A3B; color: #fff !important; text-decoration: none; padding: 12px 18px; border-radius: 10px; font-weight: 650; }
    footer { border-top: 1px solid #E4E1DB; color: #888A91; font-size: 13px; }
  </style>
</head>
<body>
  <header>
    <a class="brand" href="/">DevnDespro SEO</a>
    <a href="/platform">Platform</a>
    <a href="/how-it-works">How it works</a>
    <a href="/features">Features</a>
    <a href="/seo-audit">Site Audit</a>
    <a href="/ai-visibility">AI Visibility</a>
    <a href="/pricing">Pricing</a>
    <a href="/about">About</a>
    <a href="/login">Sign in</a>
  </header>
  <main>
    <p class="eyebrow">${escapeHtml(page.eyebrow)}</p>
    <h1>${escapeHtml(page.h1)}</h1>
    <p>${escapeHtml(page.intro)}</p>
    <p><a class="cta" href="/login">Analyse your website</a></p>
    ${sections}
    <section>
      <h2>Frequently asked questions</h2>
      ${faqs}
    </section>
    <p><strong>Explore more:</strong> ${moreLinks} · <a href="/">home</a></p>
  </main>
  <footer>
    <p>(c) ${new Date().getFullYear()} Devndespro. Built in Stavanger, Norway.</p>
  </footer>
</body>
</html>
`
}

if (!fs.existsSync(outRoot)) {
  fs.mkdirSync(outRoot, { recursive: true })
}

for (const page of Object.values(MARKETING_PAGES)) {
  const slug = page.path.replace(/^\//, '')
  const dir = path.join(outRoot, slug)
  fs.mkdirSync(dir, { recursive: true })
  const out = path.join(dir, 'index.html')
  fs.writeFileSync(out, renderPage(page), 'utf8')
  console.log('Wrote', out)
}

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

// Always keep sitemap in public so Vite copies it even before postbuild pages exist
fs.writeFileSync(path.join(root, 'public', 'sitemap.xml'), sitemap, 'utf8')
fs.writeFileSync(path.join(outRoot, 'sitemap.xml'), sitemap, 'utf8')
console.log('Wrote sitemap.xml')
