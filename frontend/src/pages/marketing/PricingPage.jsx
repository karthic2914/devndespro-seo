import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowRight, faCheck, faChevronDown } from '@fortawesome/free-solid-svg-icons'
import MarketingLayout from '../../components/marketing/MarketingLayout'
import useDocumentMeta from '../../hooks/useDocumentMeta'
import { useAuth } from '../../hooks/useAuth'
import api from '../../utils/api'
import {
  PRICING_PLANS,
  PRICING_REGIONS,
  FALLBACK_RATES_FROM_NOK,
  formatMoney,
  convertFromNok,
} from '../../data/pricingPlans'
import { PAGE_VISUALS } from '../../data/marketingPages'

async function fetchRatesFromNok() {
  // Same-origin proxy avoids browser CORS (Frankfurter blocks direct frontend calls).
  const res = await fetch('/api/public/fx?from=NOK', {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Rates HTTP ${res.status}`)
  const data = await res.json()
  const rates = data.rates || {}
  if (![rates.USD, rates.EUR, rates.GBP, rates.INR].every((n) => Number.isFinite(Number(n)) && Number(n) > 0)) {
    throw new Error('Incomplete rates')
  }
  return {
    NOK: 1,
    USD: Number(rates.USD),
    EUR: Number(rates.EUR),
    GBP: Number(rates.GBP),
    INR: Number(rates.INR),
    date: data.date || null,
    source: data.source || 'live',
  }
}

function detectDefaultRegion() {
  const lang = (typeof navigator !== 'undefined' ? navigator.language : 'en') || 'en'
  if (lang.startsWith('nb') || lang.startsWith('nn') || lang.startsWith('no')) return 'NO'
  if (lang.startsWith('en-IN') || lang.startsWith('hi')) return 'IN'
  if (lang.startsWith('en-GB')) return 'UK'
  if (lang.startsWith('en-US')) return 'US'
  if (
    lang.startsWith('de') ||
    lang.startsWith('fr') ||
    lang.startsWith('nl') ||
    lang.startsWith('es') ||
    lang.startsWith('it') ||
    lang.startsWith('sv') ||
    lang.startsWith('da') ||
    lang.startsWith('fi')
  ) {
    return 'EU'
  }
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
    if (tz.includes('Oslo')) return 'NO'
    if (tz.includes('Kolkata') || tz.includes('Calcutta')) return 'IN'
    if (tz.includes('London')) return 'UK'
    if (tz.includes('New_York') || tz.includes('Los_Angeles') || tz.includes('Chicago')) return 'US'
    if (tz.startsWith('Europe/')) return 'EU'
  } catch {
    /* ignore */
  }
  return 'NO'
}

export default function PricingPage() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [regionId, setRegionId] = useState(() => detectDefaultRegion())
  const [rates, setRates] = useState(FALLBACK_RATES_FROM_NOK)
  const [ratesDate, setRatesDate] = useState(null)
  const [ratesStatus, setRatesStatus] = useState('loading')
  const [regionOpen, setRegionOpen] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 240 })
  const [checkoutPlan, setCheckoutPlan] = useState(null)
  const [checkoutError, setCheckoutError] = useState('')
  const regionMenuRef = useRef(null)
  const triggerRef = useRef(null)

  useDocumentMeta({
    title: 'Pricing | Launch, Accelerate & Command | DevnDespro SEO',
    description:
      'Simple DevnDespro SEO plans: Launch, Accelerate and Command. Switch currency for Norway, Europe, India, USA and UK with live exchange rates.',
    canonical: 'https://seo.devndespro.com/pricing',
  })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const next = await fetchRatesFromNok()
        if (cancelled) return
        if (![next.USD, next.EUR, next.GBP, next.INR].every((n) => Number.isFinite(n) && n > 0)) {
          throw new Error('Incomplete rates')
        }
        setRates(next)
        setRatesDate(next.date)
        setRatesStatus(next.source === 'fallback' ? 'fallback' : 'live')
      } catch {
        if (cancelled) return
        setRates(FALLBACK_RATES_FROM_NOK)
        setRatesDate(null)
        setRatesStatus('fallback')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useLayoutEffect(() => {
    if (!regionOpen || !triggerRef.current) return undefined
    const updatePos = () => {
      const rect = triggerRef.current.getBoundingClientRect()
      const width = Math.max(rect.width, 240)
      const estimatedHeight = 260
      const spaceBelow = window.innerHeight - rect.bottom - 12
      const openUp = spaceBelow < estimatedHeight && rect.top > spaceBelow
      setMenuPos({
        top: openUp ? Math.max(8, rect.top - estimatedHeight - 8) : rect.bottom + 8,
        left: Math.min(rect.left, window.innerWidth - width - 12),
        width,
      })
    }
    updatePos()
    window.addEventListener('resize', updatePos)
    window.addEventListener('scroll', updatePos, true)
    return () => {
      window.removeEventListener('resize', updatePos)
      window.removeEventListener('scroll', updatePos, true)
    }
  }, [regionOpen])

  useEffect(() => {
    if (!regionOpen) return undefined
    const onPointer = (e) => {
      const inTrigger = regionMenuRef.current?.contains(e.target)
      const inMenu = e.target?.closest?.('.mkt-select-menu')
      if (!inTrigger && !inMenu) setRegionOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setRegionOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [regionOpen])

  const region = useMemo(
    () => PRICING_REGIONS.find((r) => r.id === regionId) || PRICING_REGIONS[0],
    [regionId]
  )

  const goLogin = () => navigate('/login')

  const startPlan = async (plan) => {
    setCheckoutError('')
    const stripePlan = plan.stripePlan

    // Launch / free path: sign in (or go to app if already signed in)
    if (!stripePlan) {
      navigate(user ? '/' : '/login')
      return
    }

    if (authLoading) return

    if (!user) {
      navigate(`/login?checkout=${stripePlan}`)
      return
    }

    setCheckoutPlan(plan.id)
    try {
      const { data } = await api.post('/billing/checkout', { plan: stripePlan })
      if (data?.url) {
        window.location.href = data.url
        return
      }
      setCheckoutError(data?.error || 'Checkout unavailable. Try again from Settings.')
    } catch (e) {
      setCheckoutError(
        e.response?.data?.error || 'Checkout failed. Sign in and try again from Settings.'
      )
    }
    setCheckoutPlan(null)
  }

  return (
    <MarketingLayout activePath="/pricing">
      <article className="mkt-page">
        <section className="mkt-hero" style={{ minHeight: 'auto' }}>
          <div className="mkt-container">
            <div
              className="mkt-hero__content"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 28,
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                maxWidth: 'none',
                paddingBottom: 40,
              }}
            >
              <div style={{ maxWidth: 640 }}>
                <p className="mkt-eyebrow">PRICING</p>
                <h1>
                  Plans that stay affordable{' '}
                  <span className="mkt-accent">as you grow</span>
                </h1>
                <p className="mkt-hero__lede" style={{ marginBottom: 0 }}>
                  Launch, Accelerate and Command. Switch Norway, Europe, India, USA or UK and see
                  live converted rates.
                </p>
              </div>

              <div className="mkt-select-wrap" ref={regionMenuRef}>
                <span className="mkt-select-label" id="pricing-region-label">
                  Show prices in
                </span>
                <div className="mkt-select-field">
                  <button
                    type="button"
                    id="pricing-region"
                    ref={triggerRef}
                    className={`mkt-select-trigger${regionOpen ? ' is-open' : ''}`}
                    aria-haspopup="listbox"
                    aria-expanded={regionOpen}
                    aria-labelledby="pricing-region-label"
                    onClick={() => setRegionOpen((v) => !v)}
                  >
                    <span>
                      {region.flag} {region.label} ({region.currency})
                    </span>
                    <FontAwesomeIcon icon={faChevronDown} className="mkt-select-icon" />
                  </button>
                </div>
                <p className="mkt-select-hint">
                  {ratesStatus === 'live' && ratesDate
                    ? `Live ECB rates · updated ${ratesDate}`
                    : ratesStatus === 'loading'
                      ? 'Loading live exchange rates…'
                      : 'Showing fallback rates (live feed unavailable)'}
                </p>
              </div>

              {regionOpen &&
                createPortal(
                  <ul
                    className="mkt-select-menu mkt-select-menu--portal"
                    role="listbox"
                    aria-labelledby="pricing-region-label"
                    style={{
                      top: menuPos.top,
                      left: menuPos.left,
                      width: menuPos.width,
                    }}
                  >
                    {PRICING_REGIONS.map((r) => (
                      <li key={r.id} role="option" aria-selected={r.id === regionId}>
                        <button
                          type="button"
                          className={`mkt-select-option${r.id === regionId ? ' is-selected' : ''}`}
                          onClick={() => {
                            setRegionId(r.id)
                            setRegionOpen(false)
                          }}
                        >
                          {r.flag} {r.label} ({r.currency})
                        </button>
                      </li>
                    ))}
                  </ul>,
                  document.body
                )}
            </div>
          </div>

          <div className="mkt-rail">
            <div className="mkt-container">
              <div className="mkt-rail__grid">
                {(PAGE_VISUALS.pricing?.chips || []).slice(0, 4).map((chip, i) => (
                  <div key={chip} className={`mkt-rail__item ${i === 0 ? 'is-active' : ''}`}>
                    <span className="mkt-rail__label">{chip}</span>
                    <p className="mkt-rail__text">
                      {PAGE_VISUALS.pricing?.stats?.[i]
                        ? `${PAGE_VISUALS.pricing.stats[i].value} · ${PAGE_VISUALS.pricing.stats[i].label}`
                        : 'Transparent monthly pricing'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mkt-band" style={{ paddingTop: 40 }}>
          <div className="mkt-container">
            <div className="mkt-pricing-grid">
              {PRICING_PLANS.map((plan) => {
                const amount = convertFromNok(plan.priceNok, region.currency, rates)
                const priceLabel = formatMoney(amount, region.currency, region.locale)
                return (
                  <div
                    key={plan.id}
                    className={`mkt-plan${plan.featured ? ' is-featured' : ''}`}
                  >
                    {plan.featured ? <span className="mkt-plan__badge">MOST POPULAR</span> : null}

                    <p className="mkt-plan__tier">{plan.tier.toUpperCase()}</p>
                    <h2>{plan.name}</h2>
                    <p className="mkt-plan__tagline">{plan.tagline}</p>

                    <div className="mkt-plan__price">
                      <strong>{priceLabel}</strong>
                      <span>/ month</span>
                    </div>
                    <p className="mkt-plan__blurb">{plan.blurb}</p>

                    <ul>
                      {plan.features.map((f) => (
                        <li key={f}>
                          <FontAwesomeIcon icon={faCheck} />
                          {f}
                        </li>
                      ))}
                    </ul>

                    <button
                      type="button"
                      className="mkt-plan__cta"
                      disabled={!!checkoutPlan || authLoading}
                      onClick={() => startPlan(plan)}
                    >
                      {checkoutPlan === plan.id ? 'Redirecting to Stripe…' : plan.cta}
                      {checkoutPlan === plan.id ? null : <FontAwesomeIcon icon={faArrowRight} />}
                    </button>
                  </div>
                )
              })}
            </div>

            {checkoutError ? (
              <p className="mkt-note" style={{ color: '#FF8A7A', marginTop: 14 }}>
                {checkoutError}
              </p>
            ) : null}

            <p className="mkt-note">
              Accelerate and Command open Stripe Checkout when you are signed in. Launch takes you
              into the workspace. Prices convert from NOK using{' '}
              {ratesStatus === 'live' ? 'live' : 'reference'} rates for {region.label}. Billing is in
              NOK at checkout. *Fair-use limits apply on Command.
            </p>
          </div>
        </section>

        <section className="mkt-band">
          <div className="mkt-container">
            <div className="mkt-section-head">
              <p className="mkt-eyebrow">FAQ</p>
              <h2>Pricing FAQ</h2>
              <p>Currency, upgrades, and how names map to product access.</p>
            </div>
            <div className="mkt-faq">
              {[
                {
                  q: 'Why do prices change when I switch country?',
                  a: 'Plan prices are set in Norwegian kroner (NOK), then converted with live exchange rates so you can compare Launch, Accelerate and Command in NOK, EUR, INR, USD or GBP.',
                },
                {
                  q: 'Can I upgrade later?',
                  a: 'Yes. Start on Launch, move to Accelerate when you need backlinks and full AI scans, then Command for team and cold email workflows.',
                },
                {
                  q: 'Is this the same as Free / Pro / Agency in the app?',
                  a: 'Marketing names map to product access levels: Launch (starter), Accelerate (growth / Pro-class), Command (business / Agency-class). Your admin still controls seat access during private beta.',
                },
              ].map((item) => (
                <details key={item.q}>
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="mkt-band" style={{ paddingTop: 0, paddingBottom: 80 }}>
          <div className="mkt-container">
            <div className="mkt-cta-row">
              <div>
                <div className="mkt-eyebrow">START WITH YOUR DOMAIN</div>
                <h2>Ready to see your discovery signal?</h2>
                <p>Run a free audit, then pick the plan that matches how hard you want to push.</p>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                <button type="button" className="mkt-btn-primary" onClick={goLogin}>
                  Start free audit →
                </button>
                <Link to="/platform" className="mkt-btn-ghost">
                  Explore platform
                </Link>
              </div>
            </div>
          </div>
        </section>
      </article>
    </MarketingLayout>
  )
}
