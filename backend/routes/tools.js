const express = require('express')
const { auth, requireFeature } = require('../middleware')
const { anthropic } = require('../clients')
const router = express.Router()

// Rewrite pasted content to improve likelihood of AI citation (ChatGPT/Claude)
router.post('/rewrite-for-ai', auth, requireFeature('ai_assistant'), async (req, res) => {
  const { content } = req.body
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Missing content' })
  }
  if (content.length > 8000) {
    return res.status(400).json({ error: 'Content too long. Please limit to 8000 characters.' })
  }

  try {
    const prompt = `You are an expert in "AEO" (Answer Engine Optimization) - making web content more likely to be cited by AI assistants like ChatGPT and Claude when they answer user questions.

Analyze the following content and respond ONLY with valid JSON in this exact shape, no markdown fences, no preamble:
{
  "citabilityScore": <integer 0-100>,
  "scoreLabel": "<one of: Poor, Below average, Average, Good, Excellent>",
  "issues": [ "<short issue 1>", "<short issue 2>", "<short issue 3>" ],
  "rewrite": "<the improved version of the content, same topic and length ballpark, but restructured to be more citable: clear direct answers near the top, specific facts/numbers, well-defined headings/structure, authoritative but natural tone>"
}

Content to analyze:
"""
${content}
"""`

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = msg.content[0]?.text || ''
    const cleaned = raw.replace(/```json|```/g, '').trim()
    let parsed
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      return res.status(502).json({ error: 'AI response could not be parsed. Please try again.' })
    }

    res.json(parsed)
  } catch (e) {
    console.error('rewrite-for-ai error:', e.message)
    res.status(500).json({ error: 'Failed to analyze content' })
  }
})

module.exports = router
