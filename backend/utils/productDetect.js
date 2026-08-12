const axios = require('axios')
const cheerio = require('cheerio')
const { pool, anthropic } = require('../clients')

const CACHE_DAYS = 90

async function callAIEngine(engine, prompt, maxTokens = 900) {
  const normalizedEngine = String(engine || 'claude').toLowerCase()

  if (normalizedEngine === 'chatgpt' || normalizedEngine === 'openai') {
    const { OpenAI } = require('openai')
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
    })
    return completion.choices[0]?.message?.content || ''
  }

  const r = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  })
  const textBlock = Array.isArray(r.content) ? r.content.find((b) => b?.type === 'text') : null
  if (!textBlock?.text) {
    throw new Error('AI engine returned no text content (possible rate limit or empty response)')
  }
  return textBlock.text
}

async function crawlSiteContent(siteUrl) {
  const headers = { 'User-Agent': 'Mozilla/5.0 (compatible; SEOAuditBot/1.0)' }
  const origin = (() => {
    try { return new URL(siteUrl).origin } catch { return siteUrl }
  })()

  const candidatePaths = ['', '/services', '/products', '/pricing', '/about']
  let combined = ''

  for (const path of candidatePaths) {
    try {
      const url = `${origin}${path}`
      const { data } = await axios.get(url, { timeout: 8000, headers })
      const html = typeof data === 'string' ? data : String(data || '')
      const $ = cheerio.load(html)
      const text = $('body').text().replace(/\s+/g, ' ').trim()
      combined += `\n\n--- Page: ${path || '/'} ---\n${text.slice(0, 1500)}`
      if (combined.length > 6000) break
    } catch (e) {
      // page doesn't exist or failed to load - skip it, not fatal
    }
  }

  return combined.slice(0, 6000)
}

function buildProductPrompt(siteName, siteUrl, siteContent) {
  return [
    'You are analysing a business website to identify its actual products and services.',
    `Business: ${siteName} (${siteUrl})`,
    '',
    'Website content (from homepage and key pages):',
    siteContent || '(no content available)',
    '',
    'Task: identify the distinct products or services this business offers.',
    'Rules:',
    '- Only list things this business genuinely sells or offers, not generic industry terms',
    '- Each product/service should be something a customer could specifically search for or ask an AI about',
    '- Include a short description and who the target customer is',
    '- If the site is unclear or has very little content, make a reasonable best-guess based on what is available',
    '',
    'Return ONLY valid JSON, no markdown:',
    '{"products":[{"name":"...","description":"...","targetCustomer":"..."}]}',
  ].join('\n')
}

async function detectSiteProducts(siteUrl, siteName, engine = 'claude') {
  const siteContent = await crawlSiteContent(siteUrl)
  const prompt = buildProductPrompt(siteName, siteUrl, siteContent)
  const text = await callAIEngine(engine, prompt, 900)

  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  let parsed = { products: [] }
  try {
    parsed = JSON.parse(start >= 0 ? text.slice(start, end + 1) : text)
  } catch {
    parsed = { products: [] }
  }

  return Array.isArray(parsed.products) ? parsed.products : []
}

async function getCachedProducts(siteId) {
  const { rows } = await pool.query(
    'SELECT products, engine, detected_at FROM site_products WHERE site_id=$1 LIMIT 1',
    [siteId]
  )
  if (!rows.length) return null

  const ageMs = Date.now() - new Date(rows[0].detected_at).getTime()
  const isStale = ageMs > CACHE_DAYS * 24 * 60 * 60 * 1000

  return {
    products: rows[0].products || [],
    engine: rows[0].engine,
    detectedAt: rows[0].detected_at,
    isStale,
  }
}

async function saveProducts(siteId, products, engine) {
  await pool.query(
    `INSERT INTO site_products (site_id, products, engine, detected_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (site_id) DO UPDATE SET products=$2, engine=$3, detected_at=NOW()`,
    [siteId, JSON.stringify(products), engine]
  )
}

/**
 * Generate real-world customer questions for a single detected product.
 * Question count is not fixed -- the AI decides 2-4 based on how broad
 * or narrow the product/service is.
 */
async function generateQuestionsForProduct(product, siteName, engine = 'claude') {
  const prompt = [
    'A business offers this specific product/service:',
    `Name: ${product.name}`,
    `Description: ${product.description}`,
    `Target customer: ${product.targetCustomer || 'not specified'}`,
    `Business: ${siteName}`,
    '',
    'Generate the real questions a potential customer would type into ChatGPT or Claude',
    'when looking for exactly this kind of product/service.',
    'Rules:',
    '- Generate between 2 and 4 questions -- however many genuinely make sense for this product, not a fixed count',
    '- Questions should be natural, conversational, the way real people ask AI assistants',
    '- Do not force the brand name into every question -- most real searches are generic',
    '- Vary intent: some commercial ("best X for Y"), some comparison ("X vs Y"), some direct',
    '',
    'Return ONLY a JSON array of strings, no markdown: ["question1","question2",...]',
  ].join('\n')

  const text = await callAIEngine(engine, prompt, 400)
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  try {
    const parsed = JSON.parse(start >= 0 ? text.slice(start, end + 1) : text)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Generate questions for ALL products of a site. Total question count
 * scales naturally with how many products the site has.
 */
async function generateAllProductQuestions(products, siteName, engine = 'claude') {
  const results = []
  for (const product of products) {
    const questions = await generateQuestionsForProduct(product, siteName, engine)
    results.push({ product: product.name, questions })
  }
  return results
}

module.exports = {
  callAIEngine,
  detectSiteProducts,
  getCachedProducts,
  saveProducts,
  generateQuestionsForProduct,
  generateAllProductQuestions,
}
