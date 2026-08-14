const { AsyncLocalStorage } = require('async_hooks')
const { pool } = require('../clients')

const aiUsageContext = new AsyncLocalStorage()

// Rough list prices USD per 1M tokens — good enough for spend awareness.
const PRICE_PER_MTOK = {
  'claude-sonnet-5': { input: 2.0, output: 10.0 },
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  'claude-haiku-4-5': { input: 1.0, output: 5.0 },
  'claude-haiku-4-5-20251001': { input: 1.0, output: 5.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4o': { input: 2.5, output: 10.0 },
}

function runWithAiUsageContext(ctx, fn) {
  return aiUsageContext.run(ctx || {}, fn)
}

function getAiUsageContext() {
  return aiUsageContext.getStore() || {}
}

function estimateCostUsd(model, inputTokens, outputTokens) {
  const key = String(model || '').toLowerCase()
  const rates =
    PRICE_PER_MTOK[key] ||
    (key.includes('haiku')
      ? PRICE_PER_MTOK['claude-haiku-4-5']
      : key.includes('gpt-4o-mini')
        ? PRICE_PER_MTOK['gpt-4o-mini']
        : key.includes('gpt')
          ? PRICE_PER_MTOK['gpt-4o']
          : PRICE_PER_MTOK['claude-sonnet-5'])

  const input = Number(inputTokens) || 0
  const output = Number(outputTokens) || 0
  return (input / 1e6) * rates.input + (output / 1e6) * rates.output
}

async function ensureAiUsageTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_usage_events (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      site_id INTEGER,
      provider VARCHAR(32) NOT NULL,
      model VARCHAR(80),
      feature VARCHAR(80),
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      cost_usd NUMERIC(12, 6) DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON ai_usage_events(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_ai_usage_user_created ON ai_usage_events(user_id, created_at DESC);
  `)
}

async function logAiUsage({
  provider,
  model,
  inputTokens = 0,
  outputTokens = 0,
  feature,
  userId,
  siteId,
} = {}) {
  try {
    const ctx = getAiUsageContext()
    const resolved = {
      provider: String(provider || 'unknown'),
      model: model || null,
      feature: feature || ctx.feature || 'general',
      userId: userId ?? ctx.userId ?? null,
      siteId: siteId ?? ctx.siteId ?? null,
      inputTokens: Number(inputTokens) || 0,
      outputTokens: Number(outputTokens) || 0,
    }
    const costUsd = estimateCostUsd(
      resolved.model,
      resolved.inputTokens,
      resolved.outputTokens
    )

    await pool.query(
      `INSERT INTO ai_usage_events
        (user_id, site_id, provider, model, feature, input_tokens, output_tokens, cost_usd)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        resolved.userId,
        resolved.siteId,
        resolved.provider,
        resolved.model,
        resolved.feature,
        resolved.inputTokens,
        resolved.outputTokens,
        costUsd,
      ]
    )
  } catch (err) {
    console.error('ai usage log failed:', err.message)
  }
}

async function getUsageSummary({ userId, days = 30 } = {}) {
  const windowDays = Math.min(Math.max(Number(days) || 30, 1), 90)
  const { rows } = await pool.query(
    `SELECT
       provider,
       COUNT(*)::int AS calls,
       COALESCE(SUM(input_tokens), 0)::int AS input_tokens,
       COALESCE(SUM(output_tokens), 0)::int AS output_tokens,
       COALESCE(SUM(cost_usd), 0)::float AS cost_usd
     FROM ai_usage_events
     WHERE created_at >= NOW() - make_interval(days => $1)
       AND ($2::int IS NULL OR user_id = $2 OR user_id IS NULL)
     GROUP BY provider
     ORDER BY cost_usd DESC`,
    [windowDays, userId || null]
  )

  const totals = rows.reduce(
    (acc, row) => {
      acc.calls += row.calls
      acc.inputTokens += row.input_tokens
      acc.outputTokens += row.output_tokens
      acc.costUsd += Number(row.cost_usd) || 0
      return acc
    },
    { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 }
  )

  return {
    days: windowDays,
    totals: {
      calls: totals.calls,
      inputTokens: totals.inputTokens,
      outputTokens: totals.outputTokens,
      costUsd: Number(totals.costUsd.toFixed(4)),
    },
    byProvider: rows.map((row) => ({
      provider: row.provider,
      calls: row.calls,
      inputTokens: row.input_tokens,
      outputTokens: row.output_tokens,
      costUsd: Number(Number(row.cost_usd).toFixed(4)),
    })),
  }
}

module.exports = {
  runWithAiUsageContext,
  getAiUsageContext,
  estimateCostUsd,
  ensureAiUsageTable,
  logAiUsage,
  getUsageSummary,
}
