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
    'Generate real questions a potential customer would type into ChatGPT, Claude, Gemini, or Perplexity',
    'when researching this type of product or service.',
    '',
    'For EACH question also classify the search intent.',
    '',
    'Allowed intents:',
    '- commercial: user is evaluating, hiring, buying, choosing, pricing, looking for best providers/tools/services',
    '- informational: user wants to learn, understand, solve, explain, discover, or get guidance',
    '- comparison: user is explicitly comparing alternatives, products, companies, approaches, or X vs Y',
    '',
    'Rules:',
    '- Generate between 2 and 4 genuinely useful questions',
    '- Questions must sound natural and conversational',
    '- Do not force the business brand name into the question',
    '- Use the most accurate intent for each individual question',
    '- If a question explicitly compares alternatives, use comparison',
    '- Questions about cost, best providers, hiring, recommendations, agencies, tools or purchasing should normally be commercial',
    '- Questions asking what, why, how, guides, explanations or processes should normally be informational',
    '',
    'Return ONLY valid JSON with no markdown:',
    '[{"question":"...","intent":"commercial"},{"question":"...","intent":"informational"}]'
  ].join('\n')

  const text = await callAIEngine(engine, prompt, 700)

  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')

  try {
    const parsed = JSON.parse(
      start >= 0 ? text.slice(start, end + 1) : text
    )

    if (!Array.isArray(parsed)) return []

    return parsed
      .map(item => {
        if (typeof item === 'string') {
          return {
            question: item.trim(),
            intent: 'informational'
          }
        }

        const question = String(item?.question || '').trim()

        let intent = String(
          item?.intent || 'informational'
        ).toLowerCase()

        if (!['commercial', 'informational', 'comparison'].includes(intent)) {
          intent = 'informational'
        }

        return {
          question,
          intent
        }
      })
      .filter(item => item.question)

  } catch {
    return []
  }
}

async function generateAllProductQuestions(products, siteName, engine = 'claude') {
  const results = await Promise.all(
    products.map(async (product) => {
      try {
        const generated = await generateQuestionsForProduct(
          product,
          siteName,
          engine
        )

        const questions = generated.map(item => item.question)

        const intents = {}

        generated.forEach(item => {
          intents[item.question] = item.intent
        })

        return {
          product: product.name,
          questions,
          intents
        }

      } catch (error) {
        console.error(
          `Question generation failed for ${product.name}:`,
          error.message
        )

        return {
          product: product.name,
          questions: [],
          intents: {}
        }
      }
    })
  )

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
