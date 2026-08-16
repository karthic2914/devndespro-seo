const axios = require('axios')

const BOT_UA =
  'Mozilla/5.0 (compatible; SEOAuditBot/1.0; +https://devndespro.com)'

function textWordCount(html) {
  try {
    const cheerio = require('cheerio')
    const $ = cheerio.load(html || '')
    $('script, style, noscript').remove()
    return $('body')
      .text()
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean).length
  } catch {
    return 0
  }
}

/**
 * Heuristic: empty/near-empty body + SPA root + script bundles.
 * Common for React/Vite/Next client shells.
 */
function detectSpaShell(html, wordCount) {
  const raw = String(html || '')
  const hasRoot =
    /id=["']root["']/i.test(raw) ||
    /id=["']app["']/i.test(raw) ||
    /id=["']__next["']/i.test(raw) ||
    /data-reactroot/i.test(raw)
  const hasModuleScripts =
    /type=["']module["']/i.test(raw) ||
    /\/assets\/index-.*\.js/i.test(raw) ||
    /src=["'][^"']+\.js["']/i.test(raw)
  return wordCount < 80 && hasRoot && hasModuleScripts
}

async function fetchStaticHtml(url, { timeout = 15000 } = {}) {
  const startedAt = Date.now()
  const res = await axios.get(url, {
    timeout,
    headers: { 'User-Agent': BOT_UA },
    maxRedirects: 5,
    validateStatus: () => true,
    responseType: 'text',
    transformResponse: [(d) => d],
  })
  const html = typeof res.data === 'string' ? res.data : String(res.data || '')
  const finalUrl =
    res.request?.res?.responseUrl ||
    res.request?.responseURL ||
    url
  return {
    html,
    statusCode: Number(res.status || 0),
    responseTimeMs: Date.now() - startedAt,
    finalUrl,
    headers: res.headers || {},
  }
}

/**
 * Optional headless Chrome render for JS SPAs.
 * Requires `puppeteer` (or PUPPETEER_EXECUTABLE_PATH + puppeteer-core).
 */
async function renderWithBrowser(url, { timeout = 45000 } = {}) {
  let puppeteer
  try {
    puppeteer = require('puppeteer')
  } catch {
    try {
      puppeteer = require('puppeteer-core')
    } catch {
      return null
    }
  }

  const executablePath =
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    process.env.CHROME_PATH ||
    undefined

  const browser = await puppeteer.launch({
    headless: 'new',
    executablePath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  })

  try {
    const page = await browser.newPage()
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )
    await page.setViewport({ width: 1365, height: 900 })
    const response = await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout,
    })
    // Let client routers / data fetches settle
    await page
      .waitForFunction(
        () => {
          const text = (document.body && document.body.innerText) || ''
          return text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean).length > 40
        },
        { timeout: 12000 }
      )
      .catch(() => null)
    await new Promise((r) => setTimeout(r, 800))
    const html = await page.content()
    const finalUrl = page.url()
    return {
      html,
      statusCode: response ? response.status() : 200,
      finalUrl,
    }
  } finally {
    await browser.close().catch(() => {})
  }
}

/**
 * Fetch page HTML. If the static response looks like an empty React/SPA shell,
 * try headless Chrome so word count / H1 / links match what users see.
 */
async function fetchPageHtml(url, options = {}) {
  const staticFetch = await fetchStaticHtml(url, options)
  const staticWords = textWordCount(staticFetch.html)
  const spaShell = detectSpaShell(staticFetch.html, staticWords)

  if (!spaShell || options.forceStatic) {
    return {
      ...staticFetch,
      wordCountHint: staticWords,
      spaShell: false,
      jsRendered: false,
      renderError: null,
    }
  }

  try {
    const rendered = await renderWithBrowser(url, options)
    if (!rendered?.html) {
      return {
        ...staticFetch,
        wordCountHint: staticWords,
        spaShell: true,
        jsRendered: false,
        renderError: 'Headless browser not available (install puppeteer)',
      }
    }
    const renderedWords = textWordCount(rendered.html)
    // Prefer rendered HTML when it actually has content
    if (renderedWords > staticWords) {
      return {
        html: rendered.html,
        statusCode: rendered.statusCode || staticFetch.statusCode,
        responseTimeMs: staticFetch.responseTimeMs,
        finalUrl: rendered.finalUrl || staticFetch.finalUrl,
        headers: staticFetch.headers,
        wordCountHint: renderedWords,
        spaShell: true,
        jsRendered: true,
        renderError: null,
      }
    }
    return {
      ...staticFetch,
      wordCountHint: staticWords,
      spaShell: true,
      jsRendered: false,
      renderError: 'Browser render returned little content',
    }
  } catch (err) {
    return {
      ...staticFetch,
      wordCountHint: staticWords,
      spaShell: true,
      jsRendered: false,
      renderError: err.message || 'Browser render failed',
    }
  }
}

module.exports = {
  fetchPageHtml,
  fetchStaticHtml,
  detectSpaShell,
  textWordCount,
  BOT_UA,
}
