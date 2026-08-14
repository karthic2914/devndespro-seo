const express = require('express')
const { getSetting, setSetting } = require('../utils/settings')
const { auth, requireAdmin } = require('../middleware')
const { pool } = require('../clients')
const {
  ensureUserFeatureSchema,
  featureFlagsFor,
  PLAN_META,
  PLANS,
  resolvePlan,
} = require('../utils/features')

const router = express.Router()

const MODULE_KEYS = [
  'module_backlinks',
  'module_ai_assistant',
  'module_ai_visibility',
  'module_cold_emails',
  'module_competitors',
  'module_email_reports',
]

async function readModules() {
  const out = {}
  for (const key of MODULE_KEYS) {
    // Default ON so existing installs keep current behaviour
    out[key] = await getSetting(key, true)
  }
  return out
}

// Modules visible to any logged-in user (for sidebar filtering)
router.get('/modules', auth, async (req, res) => {
  try {
    const modules = await readModules()
    res.json({
      backlinks: !!modules.module_backlinks,
      ai_assistant: !!modules.module_ai_assistant,
      ai_visibility: !!modules.module_ai_visibility,
      cold_emails: !!modules.module_cold_emails,
      competitors: !!modules.module_competitors,
      email_reports: !!modules.module_email_reports,
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to load modules' })
  }
})

// Current user's personal preferences
router.get('/me', auth, async (req, res) => {
  try {
    await ensureUserFeatureSchema()
    const { rows } = await pool.query(
      `SELECT id, email, name, photo, plan, is_paid, backlinks_enabled, keywords_enabled,
              ai_assistant_enabled, cold_emails_enabled
       FROM users WHERE id=$1`,
      [req.user.id]
    )
    const user = rows[0]
    if (!user) return res.status(404).json({ error: 'Not found' })

    const weeklyRankEmail = await getSetting(`user:${req.user.id}:weekly_rank_email`, true)
    const auditAlertEmail = await getSetting(`user:${req.user.id}:audit_alert_email`, true)
    const flags = featureFlagsFor(user)
    const plan = resolvePlan(user)

    res.json({
      profile: {
        id: user.id,
        email: user.email,
        name: user.name,
        photo: user.photo,
      },
      preferences: {
        weekly_rank_email: !!weeklyRankEmail,
        audit_alert_email: !!auditAlertEmail,
      },
      access: {
        plan,
        is_paid: !!user.is_paid || plan === 'pro' || plan === 'agency',
        backlinks: flags.backlinks,
        ai_assistant: flags.ai_assistant,
        keywords_pro: flags.keywords,
        cold_emails: flags.cold_emails,
      },
      plans: PLANS.map(id => PLAN_META[id]),
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to load user settings' })
  }
})

router.post('/me', auth, async (req, res) => {
  try {
    const { weekly_rank_email, audit_alert_email, name } = req.body || {}

    if (typeof name === 'string' && name.trim()) {
      await pool.query('UPDATE users SET name=$1 WHERE id=$2', [name.trim().slice(0, 120), req.user.id])
    }
    if (typeof weekly_rank_email === 'boolean') {
      await setSetting(`user:${req.user.id}:weekly_rank_email`, weekly_rank_email)
    }
    if (typeof audit_alert_email === 'boolean') {
      await setSetting(`user:${req.user.id}:audit_alert_email`, audit_alert_email)
    }

    res.json({ ok: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to save user settings' })
  }
})

// Admin platform settings
router.get('/', auth, requireAdmin, async (req, res) => {
  try {
    const coldEmailsEnabled = await getSetting('cold_emails_enabled', true)
    const notifyOnNewSite = await getSetting('notify_on_new_site', true)
    const notifyOnPurchase = await getSetting('notify_on_purchase', true)
    const sendWelcomeOnPurchase = await getSetting('send_welcome_on_purchase', true)
    const modules = await readModules()
    res.json({
      cold_emails_enabled: !!coldEmailsEnabled,
      notify_on_new_site: !!notifyOnNewSite,
      notify_on_purchase: !!notifyOnPurchase,
      send_welcome_on_purchase: !!sendWelcomeOnPurchase,
      modules,
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to load settings' })
  }
})

router.post('/', auth, requireAdmin, async (req, res) => {
  try {
    const { key, value } = req.body || {}
    if (!key) return res.status(400).json({ error: 'Missing key' })

    const allowed = new Set([
      'cold_emails_enabled',
      'notify_on_new_site',
      'notify_on_purchase',
      'send_welcome_on_purchase',
      ...MODULE_KEYS,
    ])
    if (!allowed.has(key)) {
      return res.status(400).json({ error: 'Unknown setting key' })
    }

    await setSetting(key, value)
    res.json({ ok: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to update setting' })
  }
})

module.exports = router
