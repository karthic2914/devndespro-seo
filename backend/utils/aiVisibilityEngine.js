// backend/utils/aiVisibilityEngine.js
// Powers sections 3-7 of AI Visibility: comparison table, summary, reasoning, recommendations, history.
// Reuses callAIEngine() pattern from productDetect.js - same engine-agnostic wrapper.

const { callAIEngine } = require('./productDetect');
const { pool } = require('../clients');

const ENGINES = ['chatgpt', 'claude']; // gemini, perplexity stay "coming soon" until integrated
const TOTAL_ENGINE_COLUMNS = 4; // chatgpt, claude, gemini, perplexity - matches the 4 columns shown everywhere in the UI

// ---------- Section 3: multi-engine comparison ----------

// Prompts each engine with the question and asks for a ranked top-10 list.
// We ask for strict JSON to avoid fragile regex parsing of prose answers.
function buildRankingPrompt(question) {
  return `
You are measuring brand visibility in an AI assistant response.

User question:
"${question}"

First, determine how you would naturally answer this question as a helpful AI assistant.

Then identify ONLY the real named commercial entities that would naturally
appear in that answer, such as:

- companies
- brands
- agencies
- products
- software tools
- platforms
- vendors
- service providers

IMPORTANT:

- Do NOT force brand recommendations if the question does not naturally call for them.
- Do NOT convert generic criteria into brands.
- Do NOT return concepts such as:
  "Portfolio Quality",
  "Experience",
  "Pricing",
  "Customer Support",
  "Design Skills",
  "User Research",
  etc.
- Do NOT invent companies or products.
- Include an entity only if you would genuinely mention or recommend it
  while naturally answering the user's question.
- Rank entities according to the order/prominence in which they would appear.
- Return a maximum of 10 entities.
- If no named commercial entities would naturally appear, return an empty array.

Respond ONLY with valid JSON:

{
  "top10": [
    {
      "rank": 1,
      "name": "Actual Brand or Company"
    }
  ]
}
`.trim()
}

function findBrandRank(top10, siteName) {
  const needle = siteName.toLowerCase();
  const hit = top10.find(r => r.name && r.name.toLowerCase().includes(needle));
  return hit ? hit.rank : null; // null = not mentioned at all
}

function extractEngineError(err) {
  const apiMsg =
    err?.error?.error?.message ||
    err?.error?.message ||
    err?.response?.data?.error?.message ||
    err?.message ||
    String(err)
  return String(apiMsg).slice(0, 300)
}

async function testQuestionOnEngine(question, engine, siteName) {
  try {
    const raw = await callAIEngine(engine, buildRankingPrompt(question));
    let top10 = [];
    try {
      const cleaned = raw.replace(/```json|```/g, '').trim();
      top10 = JSON.parse(cleaned).top10 || [];
    } catch (e) {
      top10 = [];
    }
    return {
      engine,
      top10,
      brand_rank: findBrandRank(top10, siteName),
      raw_response: raw,
      ok: true,
    };
  } catch (err) {
    return {
      engine,
      top10: [],
      brand_rank: null,
      raw_response: '',
      ok: false,
      error: extractEngineError(err),
    };
  }
}

async function testQuestionAcrossEngines(siteId, question, siteName, sessionId = null) {
  const results = await Promise.all(
    ENGINES.map(engine => testQuestionOnEngine(question, engine, siteName))
  );

  const okResults = results.filter(r => r.ok);
  if (!okResults.length) {
    const details = results
      .map(r => `${r.engine}: ${r.error || 'unknown error'}`)
      .join(' | ');
    const err = new Error(`All AI engines failed. ${details}`);
    err.code = 'ALL_ENGINES_FAILED';
    throw err;
  }

  for (const r of okResults) {
    await pool.query(
      `INSERT INTO ai_visibility_results (site_id, question, engine, rankings, brand_rank, raw_response, session_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [siteId, question, r.engine, JSON.stringify(r.top10), r.brand_rank, r.raw_response, sessionId]
    );
  }
  return results;
}

async function runFullVisibilityScan(siteId, siteName, questions, sessionId = null) {
  const allResults = [];
  for (const q of questions) {
    const r = await testQuestionAcrossEngines(siteId, q, siteName, sessionId);
    allResults.push({ question: q, results: r });
  }
  return allResults;
}

// ---------- Sessions: named, saved scan runs ----------

async function createSession(siteId, name) {
  const { rows } = await pool.query(
    `INSERT INTO ai_visibility_sessions (site_id, name) VALUES ($1, $2) RETURNING id, name, created_at`,
    [siteId, name]
  );
  return rows[0];
}

// Lists sessions newest-first, each with its stats computed live from
// ai_visibility_results (questions tested, score, average rank) rather
// than stored redundantly - so the numbers are always accurate even if
// results get added to a session after it was created.
async function listSessions(siteId) {
  const { rows: sessions } = await pool.query(
    `SELECT id, name, created_at FROM ai_visibility_sessions
     WHERE site_id = $1 ORDER BY created_at DESC`,
    [siteId]
  );

  const withStats = [];
  for (const session of sessions) {
    const { rows } = await pool.query(
      `SELECT engine, brand_rank FROM ai_visibility_results WHERE session_id = $1`,
      [session.id]
    );
    const questionsTested = new Set();
    const { rows: qRows } = await pool.query(
      `SELECT DISTINCT question FROM ai_visibility_results WHERE session_id = $1`,
      [session.id]
    );
    qRows.forEach(r => questionsTested.add(r.question));

    const mentioned = rows.filter(r => r.brand_rank !== null);
    const inTop10 = mentioned.filter(r => r.brand_rank <= 10);
    const avgRank = mentioned.length
      ? mentioned.reduce((sum, r) => sum + r.brand_rank, 0) / mentioned.length
      : null;
    const score = rows.length ? Math.round((inTop10.length / rows.length) * 100) : 0;

    // Per-engine: was this engine tested in this session, and did the
    // brand land in its Top 10? Drives the check/cross icon columns.
    const engineStatus = {};
    ENGINES.forEach(engine => {
      const engineRows = rows.filter(r => r.engine === engine);
      engineStatus[engine] = engineRows.length
        ? { tested: true, inTop10: engineRows.some(r => r.brand_rank !== null && r.brand_rank <= 10) }
        : { tested: false, inTop10: false };
    });
    const engineList = Object.keys(engineStatus);
    const topEnginesCount = engineList.filter(e => engineStatus[e].inTop10).length;

    withStats.push({
      ...session,
      questionsTested: questionsTested.size,
      score,
      averageRank: avgRank ? Number(avgRank.toFixed(1)) : null,
      engineStatus,
      topEnginesCount,
      totalEngines: engineList.length,
    });
  }

  return withStats;
}

// ---------- Section 4: summary score card ----------

// Computes summary metrics for one date window - shared by getSummary()
// for both the current 30-day period and the prior 30-day period, so the
// deltas shown on the KPI cards are real comparisons, not guesses.
async function computeSummaryWindow(siteId, start, end) {
  const { rows } = await pool.query(
    `SELECT engine, brand_rank FROM ai_visibility_results
     WHERE site_id = $1 AND tested_at >= $2 AND tested_at < $3`,
    [siteId, start, end]
  );

  const { rows: qRows } = await pool.query(
    `SELECT DISTINCT question FROM ai_visibility_results
     WHERE site_id = $1 AND tested_at >= $2 AND tested_at < $3`,
    [siteId, start, end]
  );

  const mentioned = rows.filter(r => r.brand_rank !== null);
  const inTop10 = mentioned.filter(r => r.brand_rank <= 10);
  const avgRank = mentioned.length
    ? mentioned.reduce((sum, r) => sum + r.brand_rank, 0) / mentioned.length
    : null;

  const overallScore = rows.length ? Math.round((inTop10.length / rows.length) * 100) : 0;
  const mentionRate = rows.length ? Math.round((mentioned.length / rows.length) * 100) : 0;

  const enginesTracked = new Set(rows.map(r => r.engine));
  const enginesWithTop10 = new Set(inTop10.map(r => r.engine));

  return {
    totalTests: rows.length,
    questionsTested: qRows.length,
    totalMentions: mentioned.length,
    overallScore,
    mentionRate,
    averageRank: avgRank,
    enginesInTop10Count: enginesWithTop10.size,
    enginesTrackedCount: enginesTracked.size,
    top10Count: inTop10.length,
  };
}

function fmtDate(d) {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

async function getSummary(siteId) {
  const now = new Date();
  const periodStart = new Date(now); periodStart.setDate(periodStart.getDate() - 30);
  const prevStart = new Date(now); prevStart.setDate(prevStart.getDate() - 60);
  const prevEnd = periodStart;

  const current = await computeSummaryWindow(siteId, periodStart, now);
  const previous = await computeSummaryWindow(siteId, prevStart, prevEnd);

  // null delta (not 0) when there's no prior-period data to compare against -
  // the frontend treats null as "no comparison available" rather than "no change".
  const hasPrevious = previous.totalTests > 0;
  const delta = (curr, prev) => hasPrevious ? Number((curr - prev).toFixed(1)) : null;

  return {
    top10Presence: `${current.top10Count} / ${current.totalTests}`,
    averageRank: current.averageRank ? Number(current.averageRank.toFixed(1)) : 'N/A',
    questionsTested: current.questionsTested,
    totalMentions: current.totalMentions,
    overallScore: current.overallScore,
    mentionRate: current.mentionRate,
    enginesInTop10: `${current.enginesInTop10Count} / ${TOTAL_ENGINE_COLUMNS}`,
    label: current.overallScore >= 70 ? 'Strong' : current.overallScore >= 40 ? 'Moderate' : 'Low',
    deltas: {
      overallScore: delta(current.overallScore, previous.overallScore),
      mentionRate: delta(current.mentionRate, previous.mentionRate),
      averageRank: (current.averageRank !== null && previous.averageRank !== null)
        ? Number((current.averageRank - previous.averageRank).toFixed(1))
        : null,
      enginesInTop10: hasPrevious ? (current.enginesInTop10Count - previous.enginesInTop10Count) : null,
    },
    periodLabel: `${fmtDate(periodStart)} - ${fmtDate(now)}`,
    comparisonLabel: hasPrevious ? `vs ${fmtDate(prevStart)} - ${fmtDate(prevEnd)}` : 'No prior period to compare',
  };
}

// ---------- Overview: per-engine breakdown table ----------

// One row per engine: mention rate, best current Top 10 rank (or null),
// average position, and a short trend array (most recent history buckets)
// for a sparkline. Real data only - no engine appears here until it has
// at least one scanned result.
async function getEngineBreakdown(siteId) {
  const { rows } = await pool.query(
    `SELECT engine, brand_rank FROM ai_visibility_results
     WHERE site_id = $1 AND tested_at > NOW() - INTERVAL '30 days'`,
    [siteId]
  );

  const byEngine = {};
  rows.forEach(r => {
    byEngine[r.engine] = byEngine[r.engine] || [];
    byEngine[r.engine].push(r.brand_rank);
  });

  const { rows: historyRows } = await pool.query(
    `SELECT engine, snapshot_date, avg_rank, bucket FROM ai_visibility_history
     WHERE site_id = $1 ORDER BY snapshot_date ASC`,
    [siteId]
  );
  const historyByEngine = {};
  historyRows.forEach(r => {
    historyByEngine[r.engine] = historyByEngine[r.engine] || [];
    historyByEngine[r.engine].push(r);
  });

  const bucketScore = { top3: 90, top10: 60, top20: 25, not_in_top20: 5 };

  return ENGINES.map(engine => {
    const ranks = byEngine[engine] || [];
    const mentioned = ranks.filter(r => r !== null);
    const inTop10 = mentioned.filter(r => r <= 10);
    const mentionRate = ranks.length ? Math.round((mentioned.length / ranks.length) * 100) : 0;
    const bestRank = inTop10.length ? Math.min(...inTop10) : null;
    const avgRank = mentioned.length
      ? Number((mentioned.reduce((s, r) => s + r, 0) / mentioned.length).toFixed(1))
      : null;

    const trend = (historyByEngine[engine] || [])
      .slice(-8)
      .map(h => bucketScore[h.bucket] ?? 5);

    return {
      engine,
      mentionRate,
      inTop10: bestRank !== null,
      bestRank,
      averagePosition: avgRank,
      trend,
      hasData: ranks.length > 0,
    };
  });
}

// ---------- Questions: tested/ready status per question ----------

// For each question that has ever been scanned, the latest result per
// engine (rank + when it was tested). Questions with no scan history yet
// aren't included here - the frontend already knows the full question
// list and treats anything missing from this map as "Ready" (not tested).
async function getQuestionStatus(siteId) {
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (question, engine) question, engine, brand_rank, tested_at
     FROM ai_visibility_results
     WHERE site_id = $1
     ORDER BY question, engine, tested_at DESC`,
    [siteId]
  );

  const byQuestion = {};
  rows.forEach(r => {
    if (!byQuestion[r.question]) {
      byQuestion[r.question] = { question: r.question, lastTested: r.tested_at, engines: {} };
    }
    byQuestion[r.question].engines[r.engine] = r.brand_rank;
    if (new Date(r.tested_at) > new Date(byQuestion[r.question].lastTested)) {
      byQuestion[r.question].lastTested = r.tested_at;
    }
  });

  return Object.values(byQuestion);
}


// ---------- Selected question: latest real AI responses ----------
//
// Returns the latest stored result for each engine for one exact question.
// This powers the compact AI Responses panel in the Questions tab.
async function getQuestionResponses(siteId, question) {
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (engine)
       engine,
       question,
       rankings,
       brand_rank,
       raw_response,
       tested_at
     FROM ai_visibility_results
     WHERE site_id = $1
       AND question = $2
     ORDER BY engine, tested_at DESC`,
    [siteId, question]
  );

  return rows.map(row => ({
    engine: row.engine,
    question: row.question,
    rankings: Array.isArray(row.rankings) ? row.rankings : [],
    brandRank: row.brand_rank,
    rawResponse: row.raw_response || '',
    testedAt: row.tested_at,
  }));
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

// Saves the recommendations array as-is (e.g. after the user marks one as
// "done") without re-calling Claude. Used by the PATCH route so toggling
// "done" is instant and free, not a new AI generation.
async function saveRecommendations(siteId, recommendations) {
  await pool.query(
    `UPDATE ai_visibility_insights SET recommendations = $2, generated_at = NOW() WHERE site_id = $1`,
    [siteId, JSON.stringify(recommendations)]
  );
}

// ---------- Section 7: history / trend ----------

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
  getEngineBreakdown,
  getQuestionStatus,
  getQuestionResponses,
  generateReasoning,
  generateRecommendations,
  saveRecommendations,
  snapshotHistory,
  getHistory,
  createSession,
  listSessions,
};

