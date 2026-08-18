/** Marketing pricing — base amounts in NOK (company home currency). */

export const PRICING_REGIONS = [
  { id: 'NO', label: 'Norway', currency: 'NOK', locale: 'nb-NO', flag: '🇳🇴' },
  { id: 'EU', label: 'Europe', currency: 'EUR', locale: 'de-DE', flag: '🇪🇺' },
  { id: 'IN', label: 'India', currency: 'INR', locale: 'en-IN', flag: '🇮🇳' },
  { id: 'US', label: 'USA', currency: 'USD', locale: 'en-US', flag: '🇺🇸' },
  { id: 'UK', label: 'UK', currency: 'GBP', locale: 'en-GB', flag: '🇬🇧' },
]

/** Fallback rates vs 1 NOK if the live API is unavailable */
export const FALLBACK_RATES_FROM_NOK = {
  NOK: 1,
  EUR: 0.086,
  USD: 0.094,
  GBP: 0.074,
  INR: 7.85,
}

/**
 * Basic → Launch
 * Advanced → Accelerate (Stripe: pro)
 * Business → Command (Stripe: agency)
 */
export const PRICING_PLANS = [
  {
    id: 'launch',
    tier: 'Basic',
    name: 'Launch',
    tagline: 'Clarity to get moving',
    blurb: 'Core site health and visibility basics for founders and small teams.',
    priceNok: 99,
    stripePlan: null,
    accent: '#171923',
    featured: false,
    cta: 'Start with Launch',
    features: [
      '1 website project',
      'Site Audit & Site Health',
      'Keywords (core tracking)',
      'AI Visibility overall score',
      'Alerts & integrations',
      'Email support',
    ],
  },
  {
    id: 'accelerate',
    tier: 'Advanced',
    name: 'Accelerate',
    tagline: 'Grow search & AI reach',
    blurb: 'Full visibility toolkit for teams serious about rankings and citations.',
    priceNok: 199,
    stripePlan: 'pro',
    accent: '#EA6A3B',
    featured: true,
    cta: 'Choose Accelerate',
    features: [
      'Everything in Launch',
      'Up to 5 website projects',
      'Full AI Visibility scans',
      'Backlink monitoring',
      'AI Assistant',
      'Keyword Pro tools',
      'Priority email support',
    ],
  },
  {
    id: 'command',
    tier: 'Business',
    name: 'Command',
    tagline: 'Run the full stack',
    blurb: 'Agency-ready control for portfolios, outreach and client delivery.',
    priceNok: 399,
    stripePlan: 'agency',
    accent: '#5246D9',
    featured: false,
    cta: 'Go with Command',
    features: [
      'Everything in Accelerate',
      'Unlimited projects*',
      'Cold Email outreach',
      'Team invites & roles',
      'Disavow workflows',
      'Shared Action Plans',
      'Onboarding call',
    ],
  },
]

export function formatMoney(amount, currency, locale) {
  const value = Number(amount)
  if (!Number.isFinite(value)) return '—'
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'INR' || currency === 'NOK' ? 0 : value >= 100 ? 0 : 2,
      minimumFractionDigits: 0,
    }).format(value)
  } catch {
    return `${value.toFixed(0)} ${currency}`
  }
}

export function convertFromNok(priceNok, currency, ratesFromNok) {
  const rate = Number(ratesFromNok?.[currency] ?? FALLBACK_RATES_FROM_NOK[currency] ?? 1)
  return Number(priceNok) * rate
}
