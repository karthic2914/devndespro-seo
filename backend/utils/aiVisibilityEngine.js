// backend/utils/aiVisibilityEngine.js
// Powers sections 3-7 of AI Visibility: comparison table, summary, reasoning, recommendations, history.
// Reuses callAIEngine() pattern from productDetect.js  -  same engine-agnostic wrapper.

const { callAIEngine } = require('./productDetect');
const pool = require('../db'); // adjust to your actual pg pool import

const ENGINES = ['chatgpt', 'claude']; // gemini, perplexity stay "coming soon" until integrated

// ---------- Section 3: multi-engine comparison ----------

// Prompts each engine with the question and asks for a ranked top-10 list.
// We ask for strict JSON to avoid fragile regex parsing of prose answers.
function buildRankingPrompt(question) {
  return `Answer this question as you normally would, then extract your answer into a ranked list.
Question: "${question}"

Respond with ONLY valid JSON, no markdown fences, no preamble:
{"top10": [{"rank": 1, "name": "Brand Name"}, ...up to 10 entries]}

If fewer than 10 distinct brands/tools are genuinely relevant, return fewer entries. Do not pad with irrelevant names.`;
}

function findBrandRank(top10, siteName) {
  const needle = siteName.toLowerCase();
  const hit = top10.find(r => r.name && r.name.toLowerCase().includes(needle));
  return hit ? hit.rank : null; // null = not mentioned at all
}

async function testQuestionOnEngine(question, engine, siteName) {
  const raw = await callAIEngine(engine, buildRankingPrompt(question));
  let top10 = [];
  try {
    const cleaned = raw.replace(/```json|```/g, '').trim();
    top10 = JSON.parse(cleaned).top10 || [];
  } catch (e) {
    // Engine didn't return clean JSON  -  treat as "not mentioned" rather than crashing the scan
    top10 = [];
  }
  return {
    engine,
    top10,
    brand_rank: findBrandRank(top10, siteName),
    raw_response: raw,
  };
}

// Runs one question across all live engines, saves each result row.
async function testQuestionAcrossEngines(siteId, question, siteName) {
  const results = await Promise.all(
    ENGINES.map(engine => testQuestionOnEngine(question, engine, siteName))
  );

  for (const r of results) {
    await pool.query(
      `INSERT INTO ai_visibility_results (site_id, question, engine, rankings, brand_rank, raw_response)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [siteId, question, r.engine, JSON.stringify(r.top10), r.brand_rank, r.raw_response]
    );
  }
  return results;
}

// Runs every cached auto-generated question (from site_products flow) across all engines.
// Call this from a "Run AI Visibility Scan" button  -  it's the expensive multi-call operation.
async function runFullVisibilityScan(siteId, siteName, questions) {
  const allResults = [];
  for (const q of questions) {
    const r = await testQuestionAcrossEngines(siteId, q, siteName);
    allResults.push({ question: q, results: r });
  }
  return allResults;
}

// ---------- Section 4: summary score card ----------

async function getSummary(siteId) {
  const { rows } = await pool.query(
    `SELECT engine, brand_rank FROM ai_visibility_results
     WHERE site_id = $1 AND tested_at > NOW() - INTERVAL '30 days'`,
    [siteId]
  );

  const questionsTested = new Set();
  const { rows: qRows } = await pool.query(
    `SELECT DISTINCT question FROM ai_visibility_results
     WHERE site_id = $1 AND tested_at > NOW() - INTERVAL '30 days'`,
    [siteId]
  );
  qRows.forEach(r => questionsTested.add(r.question));

  const mentioned = rows.filter(r => r.brand_rank !== null);
  const inTop10 = mentioned.filter(r => r.brand_rank <= 10);

  const avgRank = mentioned.length
    ? mentioned.reduce((sum, r) => sum + r.brand_rank, 0) / mentioned.length
    : null;

  const overallScore = rows.length ? Math.round((inTop10.length / rows.length) * 100) : 0;

  return {
    top10Presence: `${inTop10.length} / ${rows.length}`,
    averageRank: avgRank ? Number(avgRank.toFixed(1)) : 'N/A',
    questionsTested: questionsTested.size,
    totalMentions: mentioned.length,
    overallScore,
    label: overallScore >= 70 ? 'Strong' : overallScore >= 40 ? 'Moderate' : 'Low',
  };
}

// ---------- Section 5: reasoning ("why not in Top 10") ----------

async function generateReasoning(siteId, siteName) {
  const { rows } = await pool.query(
    `SELECT question, engine, rankings, brand_rank FROM ai_visibility_results
     WHERE site_id = $1 ORDER BY tested_at DESC LIMIT 40`,
    [siteId]
  );
  if (!rows.length) return [];

  const notInTop10 = rows.filter(r => r.brand_rank === null || r.brand_rank > 10);
  const competitorNames = new Set();
  rows.forEach(r => (r.rankings || []).forEach(x => x.name && competitorNames.add(x.name)));

  const prompt = `Brand: "${siteName}"
It appeared in the Top 10 for ${rows.length - notInTop10.length}/${rows.length} tested AI questions.
Competitors that DO appear consistently: ${[...competitorNames].slice(0, 15).join(', ')}

Based on this, give 3-5 concrete reasons the brand is likely missing from AI engine answers
(e.g. brand authority, citation count, review volume, structured data, topical depth).
Respond ONLY as JSON: {"reasons": [{"issue": "...", "severity": "High|Medium|Low", "detail": "one sentence"}]}`;

  const raw = await callAIEngine('claude', prompt);
  let reasons = [];
  try {
    reasons = JSON.parse(raw.replace(/```json|```/g, '').trim()).reasons || [];
  } catch (e) {
    reasons = [];
  }

  await pool.query(
    `INSERT INTO ai_visibility_insights (site_id, reasoning, generated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (site_id) DO UPDATE SET reasoning = $2, generated_at = NOW()`,
    [siteId, JSON.stringify(reasons)]
  );

  return reasons;
}

// ---------- Section 6: recommendations ----------

async function generateRecommendations(siteId, siteName, reasoning) {
  const prompt = `Brand: "${siteName}"
Known visibility issues: ${JSON.stringify(reasoning)}

Give 5-8 prioritized, actionable recommendations to improve AI engine visibility
(content, backlinks, schema, reviews, etc). Respond ONLY as JSON:
{"recommendations": [{"title": "...", "priority": "High|Medium|Low", "detail": "1-2 sentences", "plan": ["step 1", "step 2", "step 3"]}]}`;

  const raw = await callAIEngine('claude', prompt);
  let recommendations = [];
  try {
    recommendations = JSON.parse(raw.replace(/```json|```/g, '').trim()).recommendations || [];
  } catch (e) {
    recommendations = [];
  }

  await pool.query(
    `UPDATE ai_visibility_insights SET recommendations = $2, generated_at = NOW() WHERE site_id = $1`,
    [siteId, JSON.stringify(recommendations)]
  );

  return recommendations;
}

// ---------- Section 7: history / trend ----------

// Call this once per week (cron or scan-completion hook) to snapshot current state per engine.
async function snapshotHistory(siteId) {
  const { rows } = await pool.query(
    `SELECT engine, brand_rank FROM ai_visibility_results
     WHERE site_id = $1 AND tested_at > NOW() - INTERVAL '7 days'`,
    [siteId]
  );

  const byEngine = {};
  rows.forEach(r => {
    byEngine[r.engine] = byEngine[r.engine] || [];
    byEngine[r.engine].push(r.brand_rank);
  });

  for (const engine of Object.keys(byEngine)) {
    const ranks = byEngine[engine].filter(r => r !== null);
    const avg = ranks.length ? ranks.reduce((a, b) => a + b, 0) / ranks.length : null;
    const bucket = avg === null ? 'not_in_top20' : avg <= 3 ? 'top3' : avg <= 10 ? 'top10' : avg <= 20 ? 'top20' : 'not_in_top20';

    await pool.query(
      `INSERT INTO ai_visibility_history (site_id, engine, snapshot_date, bucket, avg_rank)
       VALUES ($1, $2, CURRENT_DATE, $3, $4)
       ON CONFLICT (site_id, engine, snapshot_date) DO UPDATE SET bucket = $3, avg_rank = $4`,
      [siteId, engine, bucket, avg]
    );
  }
}

async function getHistory(siteId) {
  const { rows } = await pool.query(
    `SELECT engine, snapshot_date, bucket, avg_rank FROM ai_visibility_history
     WHERE site_id = $1 ORDER BY snapshot_date ASC`,
    [siteId]
  );
  return rows;
}

module.exports = {
  testQuestionAcrossEngines,
  runFullVisibilityScan,
  getSummary,
  generateReasoning,
  generateRecommendations,
  snapshotHistory,
  getHistory,
};

