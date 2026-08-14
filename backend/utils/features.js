const { pool } = require('../clients')

let schemaReady = false

const PLANS = ['free', 'pro', 'agency']

const PLAN_META = {
  free: {
    id: 'free',
    label: 'Free',
    blurb: 'Core SEO basics for getting started.',
    bullets: [
      'Keywords basic (view & track)',
      'Overview & Site Audit',
      'AI Visibility',
      'Alerts & Integrations',
    ],
  },
  pro: {
    id: 'pro',
    label: 'Pro',
    blurb: 'Growth tools for link building and AI.',
    bullets: [
      'Everything in Free',
      'Backlinks',
      'AI Assistant',
      'Keyword Pro tools',
    ],
  },
  agency: {
    id: 'agency',
    label: 'Agency',
    blurb: 'Full suite for client and outreach work.',
    bullets: [
      'Everything in Pro',
      'Cold Email',
      'Team-ready access',
    ],
  },
}

async function ensureUserFeatureSchema() {
  if (schemaReady) return
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS backlinks_enabled BOOLEAN DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS keywords_enabled BOOLEAN DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_assistant_enabled BOOLEAN DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS cold_emails_enabled BOOLEAN DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';
    ALTER TABLE users ADD COLUMN IF NOT EXISTS features_updated_at TIMESTAMPTZ
  `)
  // Backfill plan from legacy is_paid when plan missing/empty
  await pool.query(`
    UPDATE users
    SET plan = CASE WHEN COALESCE(is_paid, FALSE) THEN 'pro' ELSE 'free' END
    WHERE plan IS NULL OR plan = ''
  `)
  schemaReady = true
}

function normalizePlan(plan) {
  const p = String(plan || 'free').toLowerCase().trim()
  return PLANS.includes(p) ? p : 'free'
}

function resolvePlan(user) {
  if (isAdminUser(user)) return 'agency'
  if (user?.plan) return normalizePlan(user.plan)
  if (user?.is_paid) return 'pro'
  return 'free'
}

function isAdminUser(user) {
  return Number(user?.id) === 1
}

function canUseBacklinks(user) {
  if (isAdminUser(user)) return true
  const plan = resolvePlan(user)
  return plan === 'pro' || plan === 'agency' || Boolean(user?.backlinks_enabled) || Boolean(user?.is_paid)
}

function canUseKeywords(user) {
  if (isAdminUser(user)) return true
  const plan = resolvePlan(user)
  return plan === 'pro' || plan === 'agency' || Boolean(user?.keywords_enabled) || Boolean(user?.is_paid)
}

function canUseAiAssistant(user) {
  if (isAdminUser(user)) return true
  const plan = resolvePlan(user)
  return plan === 'pro' || plan === 'agency' || Boolean(user?.ai_assistant_enabled) || Boolean(user?.is_paid)
}

function canUseColdEmails(user) {
  if (isAdminUser(user)) return true
  const plan = resolvePlan(user)
  return plan === 'agency' || Boolean(user?.cold_emails_enabled)
}

function featureFlagsFor(user) {
  const plan = resolvePlan(user)
  return {
    plan,
    planMeta: PLAN_META[plan],
    backlinks: canUseBacklinks(user),
    keywords: canUseKeywords(user),
    ai_assistant: canUseAiAssistant(user),
    cold_emails: canUseColdEmails(user),
    isAdmin: isAdminUser(user),
  }
}

function flagsForPlan(plan) {
  const p = normalizePlan(plan)
  if (p === 'agency') {
    return {
      plan: 'agency',
      is_paid: true,
      backlinks_enabled: true,
      keywords_enabled: true,
      ai_assistant_enabled: true,
      cold_emails_enabled: true,
    }
  }
  if (p === 'pro') {
    return {
      plan: 'pro',
      is_paid: true,
      backlinks_enabled: true,
      keywords_enabled: true,
      ai_assistant_enabled: true,
      cold_emails_enabled: false,
    }
  }
  return {
    plan: 'free',
    is_paid: false,
    backlinks_enabled: false,
    keywords_enabled: false,
    ai_assistant_enabled: false,
    cold_emails_enabled: false,
  }
}

/** Set plan (free|pro|agency) and sync feature flags.
 *  options.source: 'billing' | 'admin' | 'system' — controls purchase emails
 */
async function setUserPlan(userId, plan, options = {}) {
  await ensureUserFeatureSchema()
  const flags = flagsForPlan(plan)

  const { rows: beforeRows } = await pool.query(
    `SELECT id, email, name, plan, is_paid FROM users WHERE id = $1`,
    [userId]
  )
  const before = beforeRows[0]
  if (!before) return null

  const previousPlan = before.plan || (before.is_paid ? 'pro' : 'free')

  const { rows } = await pool.query(
    `UPDATE users
     SET plan = $2,
         is_paid = $3,
         backlinks_enabled = $4,
         keywords_enabled = $5,
         ai_assistant_enabled = $6,
         cold_emails_enabled = $7,
         features_updated_at = NOW()
     WHERE id = $1
     RETURNING id, email, name, photo, plan, is_paid, backlinks_enabled, keywords_enabled,
               ai_assistant_enabled, cold_emails_enabled, features_updated_at, created_at`,
    [
      userId,
      flags.plan,
      flags.is_paid,
      flags.backlinks_enabled,
      flags.keywords_enabled,
      flags.ai_assistant_enabled,
      flags.cold_emails_enabled,
    ]
  )
  const updated = rows[0] || null

  if (updated && options.skipEmails !== true) {
    try {
      const { notifyPlanChange } = require('./planEmails')
      await notifyPlanChange({
        user: updated,
        previousPlan,
        newPlan: flags.plan,
        source: options.source || 'system',
        notifyAdmin: options.notifyAdmin !== false,
        sendWelcome: options.sendWelcome !== false,
      })
    } catch (e) {
      console.error('setUserPlan email hook failed:', e.message)
    }
  }

  return updated
}

/** Legacy helper — maps to free/pro. */
async function setUserPaid(userId, paid = true, options = {}) {
  return setUserPlan(userId, paid ? 'pro' : 'free', options)
}

async function setUserFeatures(userId, patch = {}) {
  await ensureUserFeatureSchema()

  // Prefer explicit plan updates
  if (patch.plan != null) {
    return setUserPlan(userId, patch.plan, { source: 'admin', notifyAdmin: false })
  }

  // Legacy is_paid checkbox → plan
  if (typeof patch.is_paid === 'boolean' && patch.backlinks_enabled == null
    && patch.keywords_enabled == null && patch.ai_assistant_enabled == null
    && patch.cold_emails_enabled == null) {
    return setUserPlan(userId, patch.is_paid ? 'pro' : 'free', { source: 'admin', notifyAdmin: false })
  }

  const fields = []
  const values = []
  let i = 1

  if (typeof patch.is_paid === 'boolean') {
    fields.push(`is_paid = $${i++}`)
    values.push(patch.is_paid)
  }
  if (typeof patch.backlinks_enabled === 'boolean') {
    fields.push(`backlinks_enabled = $${i++}`)
    values.push(patch.backlinks_enabled)
  }
  if (typeof patch.keywords_enabled === 'boolean') {
    fields.push(`keywords_enabled = $${i++}`)
    values.push(patch.keywords_enabled)
  }
  if (typeof patch.ai_assistant_enabled === 'boolean') {
    fields.push(`ai_assistant_enabled = $${i++}`)
    values.push(patch.ai_assistant_enabled)
  }
  if (typeof patch.cold_emails_enabled === 'boolean') {
    fields.push(`cold_emails_enabled = $${i++}`)
    values.push(patch.cold_emails_enabled)
  }

  if (!fields.length) return null

  fields.push('features_updated_at = NOW()')
  values.push(userId)

  const { rows } = await pool.query(
    `UPDATE users
     SET ${fields.join(', ')}
     WHERE id = $${i}
     RETURNING id, email, name, photo, plan, is_paid, backlinks_enabled, keywords_enabled,
               ai_assistant_enabled, cold_emails_enabled, features_updated_at, created_at`,
    values
  )
  return rows[0] || null
}

module.exports = {
  PLANS,
  PLAN_META,
  ensureUserFeatureSchema,
  normalizePlan,
  resolvePlan,
  isAdminUser,
  canUseBacklinks,
  canUseKeywords,
  canUseAiAssistant,
  canUseColdEmails,
  featureFlagsFor,
  flagsForPlan,
  setUserPlan,
  setUserPaid,
  setUserFeatures,
}
