const axios = require('axios')
const { getSetting } = require('./settings')
const { PLAN_META, normalizePlan } = require('./features')

const PLAN_RANK = { free: 0, pro: 1, agency: 2 }

function planRank(plan) {
  return PLAN_RANK[normalizePlan(plan)] ?? 0
}

function adminNotifyEmail() {
  return (
    process.env.ADMIN_NOTIFY_EMAIL ||
    process.env.ADMIN_EMAIL ||
    'karthic2914@gmail.com'
  )
}

function appUrl() {
  return (process.env.FRONTEND_URL || 'https://seo.devndespro.com').replace(/\/$/, '')
}

async function sendZeptoMail({ to, subject, html }) {
  const token = process.env.ZEPTOMAIL_TOKEN || process.env.ZEPTO_API_KEY
  if (!token) {
    console.warn('planEmails: missing ZEPTOMAIL_TOKEN — skip email')
    return false
  }
  await axios.post(
    'https://api.zeptomail.com/v1.1/email',
    {
      from: { address: 'noreply@devndespro.com', name: 'DevNdesPro SEO' },
      to: [{ email_address: { address: to } }],
      subject,
      htmlbody: html,
    },
    {
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    }
  )
  return true
}

function shell(title, bodyHtml) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <div style="background:linear-gradient(135deg,#E66A39,#c24e24);padding:24px 28px;color:#fff">
      <div style="font-size:12px;opacity:.9;letter-spacing:.04em;text-transform:uppercase;margin-bottom:6px">DevnDespro SEO</div>
      <h1 style="margin:0;font-size:22px;font-weight:700">${title}</h1>
    </div>
    <div style="padding:28px">${bodyHtml}</div>
    <div style="padding:16px 28px 24px;font-size:12px;color:#94a3b8;text-align:center">
      <a href="https://seo.devndespro.com" style="color:#E66A39;text-decoration:none">seo.devndespro.com</a>
    </div>
  </div>
</body>
</html>`
}

async function notifyAdminOfPurchase({ user, previousPlan, newPlan, source }) {
  const enabled = await getSetting('notify_on_purchase', true)
  if (!enabled) return false

  const to = adminNotifyEmail()
  const label = PLAN_META[normalizePlan(newPlan)]?.label || newPlan
  const fromLabel = PLAN_META[normalizePlan(previousPlan)]?.label || previousPlan
  const name = user.name || user.email
  const when = new Date().toLocaleString('en-GB', { timeZone: 'Europe/Oslo' })

  const html = shell('New plan purchase', `
    <p style="margin:0 0 12px;color:#334155;font-size:15px;line-height:1.55">
      <strong>${name}</strong> (${user.email}) upgraded from <strong>${fromLabel}</strong> to <strong>${label}</strong>.
    </p>
    <p style="margin:0 0 8px;color:#64748b;font-size:13px">Source: ${source || 'billing'}</p>
    <p style="margin:0;color:#64748b;font-size:13px">Time: ${when}</p>
    <p style="margin:20px 0 0">
      <a href="${appUrl()}/users" style="display:inline-block;background:#E66A39;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:700;font-size:14px">
        Open Users
      </a>
    </p>
  `)

  await sendZeptoMail({
    to,
    subject: `[SEO] ${name} purchased ${label}`,
    html,
  })
  return true
}

async function sendWelcomeOnboardingEmail({ user, newPlan }) {
  const enabled = await getSetting('send_welcome_on_purchase', true)
  if (!enabled) return false
  if (!user?.email) return false

  const plan = normalizePlan(newPlan)
  const label = PLAN_META[plan]?.label || plan
  const first = (user.name || '').split(' ')[0] || 'there'
  const login = `${appUrl()}/login`

  const proBits = plan === 'pro' || plan === 'agency'
    ? `
      <li style="margin:0 0 8px"><strong>Backlinks</strong> — review your profile and find opportunities</li>
      <li style="margin:0 0 8px"><strong>AI Assistant</strong> — ask for action plans and SEO help</li>
      <li style="margin:0 0 8px"><strong>Keyword Pro</strong> — discover &amp; enrich keywords</li>`
    : ''
  const agencyBits = plan === 'agency'
    ? `<li style="margin:0 0 8px"><strong>Cold Email</strong> — outreach for link building</li>`
    : ''

  const html = shell('Welcome — you\'re in', `
    <p style="margin:0 0 14px;color:#334155;font-size:15px;line-height:1.6">
      Hi ${first}, welcome to <strong>DevnDespro SEO</strong> — your <strong>${label}</strong> plan is active. Onboarding is done on our side; here is how to get rolling.
    </p>
    <p style="margin:0 0 10px;color:#334155;font-size:14px;font-weight:700">Quick start:</p>
    <ol style="margin:0 0 18px;padding-left:20px;color:#475569;font-size:14px;line-height:1.55">
      <li style="margin:0 0 8px">Log in and <strong>add your website</strong> (Projects)</li>
      <li style="margin:0 0 8px"><strong>Connect Google Search Console</strong> under Integrations</li>
      <li style="margin:0 0 8px">Run a <strong>Site Audit</strong> to see what to fix first</li>
      <li style="margin:0 0 8px">Add or import <strong>Keywords</strong> to track rankings</li>
      ${proBits}
      ${agencyBits}
    </ol>
    <p style="margin:0 0 18px;color:#64748b;font-size:13px;line-height:1.5">
      Need a hand? Reply to this email or write to hello@devndespro.com.
    </p>
    <p style="margin:0">
      <a href="${login}" style="display:inline-block;background:#E66A39;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700;font-size:15px">
        Open DevnDespro SEO
      </a>
    </p>
  `)

  await sendZeptoMail({
    to: user.email,
    subject: `Welcome to DevnDespro SEO — you're on ${label}`,
    html,
  })
  return true
}

/**
 * Called from setUserPlan after a successful plan update.
 * Only fires on upgrade to Pro/Agency (not downgrades / same plan).
 *
 * Billing/webhook → admin purchase email + buyer welcome
 * Admin set-plan → buyer welcome only (admin already knows)
 */
async function notifyPlanChange({
  user,
  previousPlan,
  newPlan,
  source = 'system',
  notifyAdmin = true,
  sendWelcome = true,
}) {
  if (!user) return { admin: false, welcome: false }

  const from = normalizePlan(previousPlan)
  const to = normalizePlan(newPlan)
  if (from === to) return { admin: false, welcome: false, skipped: 'unchanged' }
  if (planRank(to) <= planRank(from)) {
    return { admin: false, welcome: false, skipped: 'not_an_upgrade' }
  }
  if (planRank(to) < 1) {
    return { admin: false, welcome: false, skipped: 'not_paid' }
  }

  const result = { admin: false, welcome: false }
  const isPurchaseSource = source === 'billing' || source === 'webhook'

  if (notifyAdmin && isPurchaseSource) {
    try {
      result.admin = await notifyAdminOfPurchase({
        user,
        previousPlan: from,
        newPlan: to,
        source,
      })
    } catch (e) {
      console.error('Admin purchase notify failed:', e.message)
    }
  }

  if (sendWelcome) {
    try {
      result.welcome = await sendWelcomeOnboardingEmail({ user, newPlan: to })
    } catch (e) {
      console.error('Welcome onboarding email failed:', e.message)
    }
  }

  return result
}

module.exports = {
  planRank,
  notifyPlanChange,
  notifyAdminOfPurchase,
  sendWelcomeOnboardingEmail,
}
