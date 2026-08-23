const express = require('express')
const axios = require('axios')
const cheerio = require('cheerio')
const { auth, requireFeature } = require('../middleware')
const { anthropic, pool } = require('../clients')
const router = express.Router()

async function ensureAiRewritesTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_rewrites (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      site_id INTEGER,
      source_url TEXT,
      target_keyword VARCHAR(200),
      audience VARCHAR(80),
      content_type VARCHAR(80),
      original_content TEXT,
      original_score INTEGER,
      optimized_score INTEGER,
      sub_scores JSONB,
      improvements JSONB,
      rewrite TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_ai_rewrites_user_created ON ai_rewrites(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_ai_rewrites_site ON ai_rewrites(site_id);
  `)
}

// Extract readable text content from a URL (reuses the same fetch style as extract-email)
async function extractTextFromUrl(url) {
  const { data: html } = await axios.get(url, { timeout: 12000, headers: { 'User-Agent': 'Mozilla/5.0' } })
  const $ = cheerio.load(html)
  $('script, style, nav, footer, header, noscript').remove()
  const text = $('body').text().replace(/\s+/g, ' ').trim()
  return text.slice(0, 8000)
}

router.post('/rewrite-for-ai', auth, requireFeature('ai_assistant'), async (req, res) => {
  try {
    await ensureAiRewritesTable()
  } catch (e) {
    console.error('ensureAiRewritesTable failed:', e.message)
  }

  const { content, url, siteId, targetKeyword, audience, contentType } = req.body

  let sourceText = content
  let sourceUrl = url || null

  try {
    if (!sourceText && url) {
      sourceText = await extractTextFromUrl(url.startsWith('http') ? url : `https://${url}`)
    } else if (!sourceText && siteId) {
      const { rows } = await pool.query('SELECT url FROM sites WHERE id=$1', [siteId])
      if (!rows[0]) return res.status(404).json({ error: 'Project not found' })
      sourceUrl = rows[0].url
      sourceText = await extractTextFromUrl(sourceUrl.startsWith('http') ? sourceUrl : `https://${sourceUrl}`)
    }
  } catch (e) {
    return res.status(400).json({ error: 'Could not fetch or read that URL. Try pasting the content directly instead.' })
  }

  if (!sourceText || !sourceText.trim()) {
    return res.status(400).json({ error: 'Missing content. Paste text, enter a URL, or choose a project.' })
  }
  if (sourceText.length > 8000) sourceText = sourceText.slice(0, 8000)

  try {
    const prompt = `You are an expert in "AEO" (Answer Engine Optimization) - making web content more likely to be cited by AI assistants like ChatGPT and Claude when they answer user questions.

${targetKeyword ? `Target question/keyword: "${targetKeyword}"` : ''}
${audience ? `Target audience: ${audience}` : ''}
${contentType ? `Content type: ${contentType}` : ''}

Analyze the content below and respond ONLY with valid JSON in this exact shape, no markdown fences, no preamble:
{
  "originalSubScores": {
    "clearAnswer": <integer 0-100>,
    "structure": <integer 0-100>,
    "authority": <integer 0-100>,
    "specificity": <integer 0-100>,
    "freshness": <integer 0-100>
  },
  "optimizedSubScores": {
    "clearAnswer": <integer 0-100>,
    "structure": <integer 0-100>,
    "authority": <integer 0-100>,
    "specificity": <integer 0-100>,
    "freshness": <integer 0-100>
  },
  "improvements": [
    { "title": "<short action title>", "detail": "<one sentence what to do and why>", "done": <true if original content already does this well, else false> }
  ],
  "rewrite": "<the improved version: same topic, similar length, restructured with a direct answer near the top, and a natural authoritative tone. IMPORTANT: plain prose only, NO markdown syntax whatsoever - no ## headings, no ** bold, no bullet dashes. Use plain paragraph breaks only. Wrap the 2-4 MOST IMPORTANT improved phrases/sentences in <mark></mark> tags to highlight what changed and why it helps citation.>"
}

Definitions for each sub-score dimension:
- clearAnswer: does it directly answer the likely question early on
- structure: is it scannable and logically organized (via prose flow, not markdown headings)
- authority: credibility signals, sources, expertise
- specificity: concrete facts/numbers vs vague claims
- freshness: signals of being current/up to date

Score both originalSubScores and optimizedSubScores using the SAME scale and criteria, so they are directly comparable. Provide 3-5 items in "improvements", ordered by impact, highest impact first.

Content to analyze:
"""
${sourceText}
"""`

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 6000,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = msg.content[0]?.text || ''
    let cleaned = raw.replace(/```json|```/g, '').trim()
    cleaned = cleaned.replace(/"(?:[^"\\]|\\.)*"/gs, (match) =>
      match.replace(/\n/g, '\\n').replace(/\r/g, '').replace(/\t/g, '\\t')
    )
    let parsed
    try {
      parsed = JSON.parse(cleaned)
    } catch (parseErr) {
      console.error('rewrite-for-ai JSON parse failed:', parseErr.message)
      console.error('Raw response (first 2000 chars):', raw.slice(0, 2000))
      console.error('Response length:', raw.length, 'stop_reason:', msg.stop_reason)
      return res.status(502).json({ error: 'AI response could not be parsed. Please try again.' })
    }

    // Strip any markdown that slipped through despite instructions
    if (typeof parsed.rewrite === 'string') {
      parsed.rewrite = parsed.rewrite
        .replace(/^#{1,6}\s*/gm, '')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/^[-*]\s+/gm, '')
    }

    // Compute overall scores as the average of sub-scores, so numbers always add up
    const avg = (obj) => {
      const vals = Object.values(obj || {}).map(Number).filter(Number.isFinite)
      return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0
    }
    const originalScore = avg(parsed.originalSubScores)
    const optimizedScore = avg(parsed.optimizedSubScores)
    parsed = {
      originalScore,
      optimizedScore,
      subScores: parsed.optimizedSubScores,
      originalSubScores: parsed.originalSubScores,
      improvements: parsed.improvements,
      rewrite: parsed.rewrite,
    }

    try {
      await pool.query(
        `INSERT INTO ai_rewrites
          (user_id, site_id, source_url, target_keyword, audience, content_type, original_content, original_score, optimized_score, sub_scores, improvements, rewrite)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING id`,
        [
          req.user.id, siteId || null, sourceUrl, targetKeyword || null, audience || null, contentType || null,
          sourceText, originalScore, optimizedScore,
          JSON.stringify(parsed.subScores || {}), JSON.stringify(parsed.improvements || []), parsed.rewrite,
        ]
      )
    } catch (e) {
      console.error('Failed to save ai_rewrite (non-fatal):', e.message)
    }

    res.json(parsed)
  } catch (e) {
    console.error('rewrite-for-ai error:', e.message)
    res.status(500).json({ error: 'Failed to analyze content' })
  }
})

// Save/pin an already-generated analysis explicitly to a project (from the "Save to Project" button)
router.post('/rewrite-for-ai/save', auth, requireFeature('ai_assistant'), async (req, res) => {
  const { siteId, sourceUrl, targetKeyword, audience, contentType, originalContent, originalScore, optimizedScore, subScores, improvements, rewrite } = req.body
  if (!siteId) return res.status(400).json({ error: 'siteId required' })
  try {
    await ensureAiRewritesTable()
    const { rows } = await pool.query(
      `INSERT INTO ai_rewrites
        (user_id, site_id, source_url, target_keyword, audience, content_type, original_content, original_score, optimized_score, sub_scores, improvements, rewrite)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id`,
      [
        req.user.id, siteId, sourceUrl || null, targetKeyword || null, audience || null, contentType || null,
        originalContent || null, originalScore || null, optimizedScore || null,
        JSON.stringify(subScores || {}), JSON.stringify(improvements || []), rewrite || null,
      ]
    )
    res.json({ id: rows[0].id, saved: true })
  } catch (e) {
    console.error('save rewrite error:', e.message)
    res.status(500).json({ error: 'Failed to save to project' })
  }
})

module.exports = router






