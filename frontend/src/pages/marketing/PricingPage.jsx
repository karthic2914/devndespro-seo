import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowRight, faCheck, faChevronDown } from '@fortawesome/free-solid-svg-icons'
import MarketingLayout from '../../components/marketing/MarketingLayout'
import useDocumentMeta from '../../hooks/useDocumentMeta'
import {
  PRICING_PLANS,
  PRICING_REGIONS,
  FALLBACK_RATES_FROM_NOK,
  formatMoney,
  convertFromNok,
} from '../../data/pricingPlans'
import { PAGE_VISUALS } from '../../data/marketingPages'

async function fetchRatesFromNok() {
  const symbols = 'USD,EUR,GBP,INR'
  const url = `https://api.frankfurter.app/latest?from=NOK&to=${symbols}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Rates HTTP ${res.status}`)
  const data = await res.json()
  return {
    NOK: 1,
    USD: Number(data.rates?.USD),
    EUR: Number(data.rates?.EUR),
    GBP: Number(data.rates?.GBP),
    INR: Number(data.rates?.INR),
    date: data.date || null,
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
  const [regionId, setRegionId] = useState(() => detectDefaultRegion())
  const [rates, setRates] = useState(FALLBACK_RATES_FROM_NOK)
  const [ratesDate, setRatesDate] = useState(null)
  const [ratesStatus, setRatesStatus] = useState('loading')

  useDocumentMeta({
    title: 'Pricing — Launch, Accelerate & Command | DevnDespro SEO',
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
        setRatesStatus('live')
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

  const region = useMemo(
    () => PRICING_REGIONS.find((r) => r.id === regionId) || PRICING_REGIONS[0],
    [regionId]
  )

  const goLogin = () => navigate('/login')

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
                  Launch, Accelerate and Command — switch Norway, Europe, India, USA or UK and see
                  live converted rates.
                </p>
              </div>

              <div className="mkt-select-wrap">
                <label htmlFor="pricing-region">Show prices in</label>
                <div style={{ position: 'relative' }}>
                  <select
                    id="pricing-region"
                    value={regionId}
                    onChange={(e) => setRegionId(e.target.value)}
                  >
                    {PRICING_REGIONS.map((r) => (
                      <option key={r.id} value={r.id} style={{ color: '#171923' }}>
                        {r.flag} {r.label} ({r.currency})
                      </option>
                    ))}
                  </select>
                  <FontAwesomeIcon
                    icon={faChevronDown}
                    className="mkt-select-icon"
                    style={{ top: '50%', bottom: 'auto', transform: 'translateY(-50%)' }}
                  />
                </div>
                <p className="mkt-select-hint">
                  {ratesStatus === 'live' && ratesDate
                    ? `Live ECB rates · updated ${ratesDate}`
                    : ratesStatus === 'loading'
                      ? 'Loading live exchange rates…'
                      : 'Showing fallback rates (live feed unavailable)'}
                </p>
              </div>
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

                    <button type="button" className="mkt-plan__cta" onClick={goLogin}>
                      {plan.cta}
                      <FontAwesomeIcon icon={faArrowRight} />
                    </button>
                  </div>
                )
              })}
            </div>

            <p className="mkt-note">
              Prices convert from NOK using {ratesStatus === 'live' ? 'live' : 'reference'} rates for{' '}
              {region.label}. Billing currency at checkout may be confirmed with your workspace admin.
              *Fair-use limits apply on Command.
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
