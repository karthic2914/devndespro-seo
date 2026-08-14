export const PLAN_META = {
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

export function isAdminUser(user) {
  return Number(user?.id) === 1
}

export function resolvePlan(user) {
  if (!user) return 'free'
  if (isAdminUser(user)) return 'agency'
  if (user.features?.plan) return user.features.plan
  if (user.plan) return String(user.plan).toLowerCase()
  if (user.is_paid) return 'pro'
  return 'free'
}

export function canUseBacklinks(user) {
  if (!user) return false
  if (isAdminUser(user)) return true
  if (user.features?.backlinks != null) return Boolean(user.features.backlinks)
  const plan = resolvePlan(user)
  return plan === 'pro' || plan === 'agency' || Boolean(user.backlinks_enabled || user.is_paid)
}

export function canUseKeywords(user) {
  if (!user) return false
  if (isAdminUser(user)) return true
  if (user.features?.keywords != null) return Boolean(user.features.keywords)
  const plan = resolvePlan(user)
  return plan === 'pro' || plan === 'agency' || Boolean(user.keywords_enabled || user.is_paid)
}

export function canUseAiAssistant(user) {
  if (!user) return false
  if (isAdminUser(user)) return true
  if (user.features?.ai_assistant != null) return Boolean(user.features.ai_assistant)
  const plan = resolvePlan(user)
  return plan === 'pro' || plan === 'agency' || Boolean(user.ai_assistant_enabled || user.is_paid)
}

export function canUseColdEmails(user) {
  if (!user) return false
  if (isAdminUser(user)) return true
  if (user.features?.cold_emails != null) return Boolean(user.features.cold_emails)
  const plan = resolvePlan(user)
  return plan === 'agency' || Boolean(user.cold_emails_enabled)
}
