const express = require('express')
const { pool, anthropic } = require('../clients')
const { auth, verifySite } = require('../middleware')
const { normalizeEngine, extractDomain, engineLabel } = require('../utils/helpers')
const { fetchSerpResults } = require('../utils/serp')

const router = express.Router()

router.post('/:siteId/ai/chat', auth, verifySite, async (req, res) => {
  try {
    const trimText = (value, max = 420) => {
      const s = String(value || '')
      return s.length > max ? `${s.slice(0, max)}...` : s
    }

    const allMessages = Array.isArray(req.body?.messages) ? req.body.messages : []
    const [siteR, metricsR, keywordsR, backlinksR] = await Promise.all([
      pool.query('SELECT name, url FROM sites WHERE id=$1 LIMIT 1', [req.siteId]),
      pool.query('SELECT dr, clicks, impressions FROM seo_metrics WHERE site_id=$1 LIMIT 1', [req.siteId]),
      pool.query('SELECT keyword, volume, position FROM keywords WHERE site_id=$1 ORDER BY COALESCE(volume, 0) DESC, created_at DESC LIMIT 20', [req.siteId]),
      pool.query('SELECT name, dr, status FROM backlinks WHERE site_id=$1 ORDER BY (status=\'Live\') DESC, dr DESC, created_at DESC LIMIT 25', [req.siteId]),
    ])

    const site = siteR.rows[0] || {}
    const metrics = metricsR.rows[0] || {}
    const topKeywords = keywordsR.rows
      .map(k => `${k.keyword}${Number.isFinite(Number(k.position)) ? ` (pos ${k.position})` : ''}`)
      .join(', ')
    const liveBacklinks = backlinksR.rows
      .filter(b => b.status === 'Live')
      .map(b => `${b.name}${b.dr ? ` (DR ${b.dr})` : ''}`)
      .join(', ')

    const systemPrompt = `You are an expert SEO consultant for ${site.name || 'this site'} (${site.url || 'unknown URL'}).
Current data: DR=${metrics.dr || 0}, Clicks=${metrics.clicks || 0}, Impressions=${metrics.impressions || 0}.
Top keywords: ${topKeywords || 'none'}.
Live backlinks: ${liveBacklinks || 'none'}.
Give specific, actionable SEO advice. Be concise and practical.`

    const promptMessages = allMessages
      .slice(-6)
      .map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: trimText(m.content, 420) }))

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514', max_tokens: 500,
      system: trimText(systemPrompt, 1800),
      messages: promptMessages,
    })
    res.json({ reply: response.content[0].text })
  } catch (e) { console.error(e); res.status(500).json({ error: 'AI error' }) }
})

router.post('/:siteId/ai/visibility', auth, verifySite, async (req, res) => {
  const { query: q } = req.body
  if (!q) return res.status(400).json({ error: 'query required' })
  const { rows: s } = await pool.query('SELECT name, url FROM sites WHERE id=$1', [req.siteId])
  const site = s[0]
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514', max_tokens: 700,
      messages: [{ role: 'user', content: q }],
    })
    const answer = response.content[0].text
    const brand = site.name.toLowerCase()
    const domain = site.url.replace(/https?:\/\/(www\.)?/, '').split('/')[0].toLowerCase()
    const mentioned = answer.toLowerCase().includes(brand) || answer.toLowerCase().includes(domain)
    res.json({ query: q, answer, mentioned, brand: site.name, score: mentioned ? 90 : 15 })
  } catch (e) { console.error(e); res.status(500).json({ error: 'AI error' }) }
})

router.post('/:siteId/ai/action-plan', auth, verifySite, async (req, res) => {
  try {
    const selectedTasks = Array.isArray(req.body?.selectedTasks)
      ? req.body.selectedTasks.filter(t => t && typeof t.text === 'string' && t.text.trim())
      : []

    if (req.body.save && selectedTasks.length > 0) {
      let savedCount = 0
      for (const t of selectedTasks) {
        const text = String(t.text || '').trim()
        const impact = String(t.impact || 'Medium').trim() || 'Medium'
        const { rowCount } = await pool.query(
          `INSERT INTO actions (site_id, text, impact)
           SELECT $1, $2, $3
           WHERE NOT EXISTS (SELECT 1 FROM actions WHERE site_id=$1 AND LOWER(text)=LOWER($2) AND done=false)`,
          [req.siteId, text, impact]
        )
        savedCount += rowCount
      }
      return res.json({ saved: savedCount, tasks: selectedTasks })
    }

    const [sR, mR, kR, bR, aR] = await Promise.all([
      pool.query('SELECT * FROM sites WHERE id=$1', [req.siteId]),
      pool.query('SELECT * FROM seo_metrics WHERE site_id=$1 LIMIT 1', [req.siteId]),
      pool.query('SELECT keyword, position FROM keywords WHERE site_id=$1 LIMIT 15', [req.siteId]),
      pool.query('SELECT name, dr, status FROM backlinks WHERE site_id=$1 LIMIT 15', [req.siteId]),
      pool.query('SELECT results FROM audit_results WHERE site_id=$1 ORDER BY created_at DESC LIMIT 1', [req.siteId]),
    ])
    const issues = (aR.rows[0]?.results?.checks || [])
      .filter(c => c.status !== 'pass').map(c => `• ${c.message}`).join('\n') || 'No audit run yet'
    const prompt = `You are a senior SEO strategist. Build a prioritized 6-task action plan.\nSite: ${sR.rows[0]?.name} (${sR.rows[0]?.url})\nDR: ${mR.rows[0]?.dr || 0}, Health: ${mR.rows[0]?.health || 0}, Clicks: ${mR.rows[0]?.clicks || 0}\nKeywords: ${kR.rows.map(k => `${k.keyword} pos${k.position || '?'}`).join(', ') || 'none'}\nBacklinks: ${bR.rows.length} total, ${bR.rows.filter(b => b.status === 'Live').length} live\nAudit issues:\n${issues}\n\nReturn ONLY a JSON array:\n[{"text":"...","impact":"High|Medium|Low","category":"On-Page|Technical|Content|Backlinks|Speed"}]`
    const r = await anthropic.messages.create({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] })
    let tasks = []
    try {
      const raw = r.content[0].text.trim()
      const json = raw.startsWith('[') ? raw : raw.slice(raw.indexOf('['), raw.lastIndexOf(']') + 1)
      tasks = JSON.parse(json)
    } catch { tasks = [{ text: 'Run a site audit to get personalized recommendations', impact: 'High', category: 'Technical' }] }

    if (req.body.save) {
      const toSave = selectedTasks.length > 0 ? selectedTasks : tasks
      let savedCount = 0
      for (const t of toSave) {
        const text = String(t.text || '').trim()
        if (!text) continue
        const impact = String(t.impact || 'Medium').trim() || 'Medium'
        const { rowCount } = await pool.query(
          `INSERT INTO actions (site_id, text, impact)
           SELECT $1, $2, $3
           WHERE NOT EXISTS (SELECT 1 FROM actions WHERE site_id=$1 AND LOWER(text)=LOWER($2) AND done=false)`,
          [req.siteId, text, impact]
        )
        savedCount += rowCount
      }
      return res.json({ saved: savedCount, tasks: toSave })
    }
    res.json(tasks)
  } catch (e) { console.error(e); res.status(500).json({ error: 'Action plan failed' }) }
})

router.post('/:siteId/seo/rank-forecast', auth, verifySite, async (req, res) => {
  try {
    const selectedTasks = Array.isArray(req.body?.selectedTasks)
      ? req.body.selectedTasks.filter(t => t && typeof t.text === 'string')
      : []

    const [metricsR, keywordsR, backlinksR, actionsR] = await Promise.all([
      pool.query('SELECT dr, clicks, impressions, health FROM seo_metrics WHERE site_id=$1 LIMIT 1', [req.siteId]),
      pool.query('SELECT keyword, position, volume FROM keywords WHERE site_id=$1 ORDER BY COALESCE(volume, 0) DESC NULLS LAST LIMIT 40', [req.siteId]),
      pool.query('SELECT name, dr, status, type FROM backlinks WHERE site_id=$1', [req.siteId]),
      pool.query('SELECT done, impact FROM actions WHERE site_id=$1', [req.siteId]),
    ])

    const metrics = metricsR.rows[0] || {}
    const keywords = keywordsR.rows || []
    const backlinks = backlinksR.rows || []
    const actions = actionsR.rows || []

    const dr = Number(metrics.dr || 0)
    const health = Number(metrics.health || 0)
    const positions = keywords.map(k => Number(k.position)).filter(n => Number.isFinite(n) && n > 0)
    const bestPos = positions.length ? Math.min(...positions) : null
    const avgPos = positions.length ? positions.reduce((s, n) => s + n, 0) / positions.length : null

    const liveBacklinks = backlinks.filter(b => b.status === 'Live')
    const liveRefDomains = new Set(liveBacklinks.map(b => String(b.name || '').trim().toLowerCase()).filter(Boolean)).size
    const dofollowCount = liveBacklinks.filter(b => String(b.type || '').toLowerCase() === 'dofollow').length
    const dofollowPct = liveBacklinks.length ? Math.round((dofollowCount / liveBacklinks.length) * 100) : 0
    const completedActions = actions.filter(a => !!a.done).length
    const actionCompletionRatio = actions.length ? (completedActions / actions.length) : 0

    let baseDays = 420
    if (bestPos !== null) {
      if (bestPos <= 3) baseDays = 45
      else if (bestPos <= 10) baseDays = 90
      else if (bestPos <= 20) baseDays = 150
      else if (bestPos <= 50) baseDays = 240
      else baseDays = 365
    }

    let adjustments = 0
    if (dr >= 50) adjustments -= 45
    else if (dr >= 30) adjustments -= 25
    else if (dr >= 15) adjustments -= 10
    else adjustments += 35

    if (health >= 85) adjustments -= 35
    else if (health >= 70) adjustments -= 15
    else if (health < 50) adjustments += 35

    if (liveRefDomains >= 50) adjustments -= 30
    else if (liveRefDomains >= 20) adjustments -= 15
    else if (liveRefDomains < 5) adjustments += 25

    if (dofollowPct >= 60) adjustments -= 20
    else if (dofollowPct < 30) adjustments += 15

    if (actionCompletionRatio >= 0.6) adjustments -= 20
    else if (actionCompletionRatio < 0.2) adjustments += 20

    const selectedBoostRaw = selectedTasks.reduce((sum, t) => {
      const impact = String(t.impact || '').toLowerCase()
      if (impact === 'high' || impact === 'critical') return sum + 12
      if (impact === 'medium') return sum + 7
      return sum + 4
    }, 0)
    const selectedBoost = Math.min(60, selectedBoostRaw)

    const currentDays = Math.max(30, Math.min(720, Math.round(baseDays + adjustments)))
    const estimatedDays = Math.max(30, Math.min(720, Math.round(baseDays + adjustments - selectedBoost)))

    let confidence = 35
    if (bestPos !== null) confidence += 15
    if (keywords.length >= 5) confidence += 10
    if (liveRefDomains >= 10) confidence += 10
    if (health >= 70) confidence += 10
    if (actions.length >= 5) confidence += 5
    confidence = Math.max(10, Math.min(92, confidence))

    const rangeFrom = Math.max(20, Math.round(estimatedDays * 0.8))
    const rangeTo = Math.max(rangeFrom + 5, Math.round(estimatedDays * 1.35))

    res.json({
      estimatedDays, currentDays,
      estimatedRange: { from: rangeFrom, to: rangeTo },
      confidence,
      snapshot: {
        dr, health, bestPosition: bestPos,
        avgPosition: avgPos ? Number(avgPos.toFixed(1)) : null,
        trackedKeywords: keywords.length, liveRefDomains, dofollowPct,
        completedActions, totalActions: actions.length,
      },
      assumptions: [
        'Forecast assumes consistent execution every week.',
        'Google rankings depend on competition and algorithm changes.',
        'This is an estimate, not a guaranteed ranking date.',
      ],
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Forecast failed' })
  }
})

router.post('/:siteId/serp-analysis', auth, verifySite, async (req, res) => {
  const { keyword } = req.body
  const engine = normalizeEngine(req.body?.engine)
  if (!keyword || typeof keyword !== 'string' || keyword.trim().length === 0)
    return res.status(400).json({ error: 'keyword required' })
  const kw = keyword.trim().slice(0, 200)

  const { rows: s } = await pool.query('SELECT name, url FROM sites WHERE id=$1', [req.siteId])
  const site = s[0]
  const serpResults = await fetchSerpResults(kw, engine)

  let plan = null
  try {
    const competitorList = serpResults.length
      ? serpResults.map(r => `${r.position}. ${r.domain} — "${r.title}"`).join('\n')
      : '(SERP data unavailable — generate plan based on keyword only)'
    const engLabel = engine === 'duckduckgo' ? 'DuckDuckGo' : engine[0].toUpperCase() + engine.slice(1)
    const prompt = `You are a world-class SEO strategist. A site owner wants to rank #1 on ${engLabel} for: "${kw}"\n\nTheir site: ${site.name} (${site.url})\n\nCurrent ${engLabel} Page 1 results:\n${competitorList}\n\nCreate a concrete ranking plan. Return ONLY valid JSON, no markdown, no explanation:\n{"difficulty":"Easy|Medium|Hard|Very Hard","timeEstimate":"e.g. 2–4 months","whyItMatters":"one sentence on why this keyword drives business value","contentAngle":"the specific content angle / unique spin to beat the #1 result","backlinkTarget":"rough number of backlinks needed","quickWin":"one action they can do this week","steps":[{"step":1,"title":"...","description":"2–3 sentence action description","timeframe":"e.g. Week 1","priority":"High|Medium|Low"}]}`
    const r = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514', max_tokens: 1800,
      messages: [{ role: 'user', content: prompt }]
    })
    const text = r.content[0].text.trim()
    const jsonStart = text.indexOf('{')
    const jsonEnd = text.lastIndexOf('}')
    try { plan = JSON.parse(jsonStart >= 0 ? text.slice(jsonStart, jsonEnd + 1) : text) }
    catch { plan = { quickWin: text, steps: [] } }
  } catch (e) { console.error('AI plan error:', e) }

  res.json({ keyword: kw, engine, results: serpResults, plan })
})

router.post('/:siteId/ai/link-opportunities', auth, verifySite, async (req, res) => {
  try {
    const [sR, cR, kR, bR] = await Promise.all([
      pool.query('SELECT name, url FROM sites WHERE id=$1', [req.siteId]),
      pool.query('SELECT name FROM competitors WHERE site_id=$1 LIMIT 10', [req.siteId]),
      pool.query('SELECT keyword FROM keywords WHERE site_id=$1 LIMIT 10', [req.siteId]),
      pool.query('SELECT name FROM backlinks WHERE site_id=$1', [req.siteId]),
    ])
    const site = sR.rows[0]
    const prompt = `You are a link building expert. Suggest 8 specific, realistic link opportunities.\nSite: ${site?.name} (${site?.url})\nKeywords: ${kR.rows.map(k => k.keyword).join(', ') || 'web design, digital agency'}\nCompetitors: ${cR.rows.map(c => c.name).join(', ') || 'none tracked'}\nAlready linked from: ${bR.rows.map(b => b.name).join(', ') || 'none yet'}\n\nReturn ONLY a JSON array:\n[{"site":"Clutch.co","type":"Directory|Guest post|Resource page|Unlinked mention|Partnership","relevance":"High|Medium","strategy":"specific action","estimatedDR":75}]`
    const r = await anthropic.messages.create({ model: 'claude-sonnet-4-20250514', max_tokens: 1200, messages: [{ role: 'user', content: prompt }] })
    let opps = []
    try {
      const raw = r.content[0].text.trim()
      const json = raw.startsWith('[') ? raw : raw.slice(raw.indexOf('['), raw.lastIndexOf(']') + 1)
      opps = JSON.parse(json)
    } catch { opps = [] }
    res.json(opps)
  } catch (e) { console.error(e); res.status(500).json({ error: 'Link opportunities failed' }) }
})

module.exports = router
