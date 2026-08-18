import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowRight, faCheck, faChevronDown } from '@fortawesome/free-solid-svg-icons'
import MarketingLayout, { monoFont } from '../../components/marketing/MarketingLayout'
import useDocumentMeta from '../../hooks/useDocumentMeta'
import {
  PRICING_PLANS,
  PRICING_REGIONS,
  FALLBACK_RATES_FROM_NOK,
  formatMoney,
  convertFromNok,
} from '../../data/pricingPlans'

const container = {
  width: '100%',
  maxWidth: 1180,
  margin: '0 auto',
  padding: '0 24px',
  boxSizing: 'border-box',
}

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
  const [ratesStatus, setRatesStatus] = useState('loading') // loading | live | fallback

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
      <article>
        <section style={{ padding: '56px 0 20px' }}>
          <div style={container}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 20,
                alignItems: 'flex-end',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ maxWidth: 640 }}>
                <p
                  style={{
                    margin: '0 0 14px',
                    fontFamily: monoFont,
                    color: '#D75F32',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                  }}
                >
                  PRICING
                </p>
                <h1
                  style={{
                    margin: '0 0 14px',
                    color: '#171923',
                    fontSize: 'clamp(34px, 5vw, 52px)',
                    fontWeight: 740,
                    lineHeight: 1.05,
                    letterSpacing: '-0.04em',
                  }}
                >
                  Plans that stay affordable as you grow
                </h1>
                <p style={{ margin: 0, color: '#5B5E68', fontSize: 17, lineHeight: 1.7 }}>
                  Three clear packages — Launch, Accelerate and Command — with prices shown in your
                  currency using live exchange rates.
                </p>
              </div>

              <div style={{ minWidth: 220 }}>
                <label
                  htmlFor="pricing-region"
                  style={{
                    display: 'block',
                    marginBottom: 8,
                    fontSize: 12,
                    fontWeight: 650,
                    color: '#5B5E68',
                  }}
                >
                  Show prices in
                </label>
                <div style={{ position: 'relative' }}>
                  <select
                    id="pricing-region"
                    value={regionId}
                    onChange={(e) => setRegionId(e.target.value)}
                    style={{
                      width: '100%',
                      appearance: 'none',
                      WebkitAppearance: 'none',
                      height: 48,
                      padding: '0 40px 0 14px',
                      borderRadius: 10,
                      border: '1.5px solid #DAD8D3',
                      background: '#fff',
                      color: '#171923',
                      fontSize: 14,
                      fontWeight: 650,
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                    }}
                  >
                    {PRICING_REGIONS.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.flag} {r.label} ({r.currency})
                      </option>
                    ))}
                  </select>
                  <FontAwesomeIcon
                    icon={faChevronDown}
                    style={{
                      position: 'absolute',
                      right: 14,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: '#898B92',
                      pointerEvents: 'none',
                      fontSize: 12,
                    }}
                  />
                </div>
                <p style={{ margin: '8px 0 0', fontSize: 11, color: '#898B92' }}>
                  {ratesStatus === 'live' && ratesDate
                    ? `Live ECB rates · updated ${ratesDate}`
                    : ratesStatus === 'loading'
                      ? 'Loading live exchange rates…'
                      : 'Showing fallback rates (live feed unavailable)'}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section style={{ padding: '28px 0 56px' }}>
          <div style={container}>
            <div
              className="pricing-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: 18,
                alignItems: 'stretch',
              }}
            >
              {PRICING_PLANS.map((plan) => {
                const amount = convertFromNok(plan.priceNok, region.currency, rates)
                const priceLabel = formatMoney(amount, region.currency, region.locale)
                return (
                  <div
                    key={plan.id}
                    style={{
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      padding: plan.featured ? 28 : 24,
                      borderRadius: 18,
                      background: plan.featured ? '#171923' : '#fff',
                      color: plan.featured ? '#fff' : '#171923',
                      border: plan.featured ? '1px solid #171923' : '1px solid #E6E3DD',
                      boxShadow: plan.featured
                        ? '0 28px 60px rgba(23,25,35,0.22)'
                        : '0 10px 30px rgba(23,25,35,0.04)',
                      transform: plan.featured ? 'translateY(-6px)' : 'none',
                    }}
                  >
                    {plan.featured && (
                      <span
                        style={{
                          position: 'absolute',
                          top: 14,
                          right: 14,
                          background: '#EA6A3B',
                          color: '#fff',
                          fontSize: 10,
                          fontWeight: 750,
                          letterSpacing: '0.08em',
                          padding: '5px 9px',
                          borderRadius: 999,
                        }}
                      >
                        MOST POPULAR
                      </span>
                    )}

                    <p
                      style={{
                        margin: '0 0 6px',
                        fontFamily: monoFont,
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '0.12em',
                        color: plan.featured ? '#F0A88A' : '#D75F32',
                      }}
                    >
                      {plan.tier.toUpperCase()}
                    </p>
                    <h2
                      style={{
                        margin: '0 0 6px',
                        fontSize: 28,
                        letterSpacing: '-0.03em',
                        fontWeight: 750,
                      }}
                    >
                      {plan.name}
                    </h2>
                    <p
                      style={{
                        margin: '0 0 18px',
                        fontSize: 14,
                        color: plan.featured ? '#C9CBD8' : '#666A73',
                        lineHeight: 1.5,
                      }}
                    >
                      {plan.tagline}
                    </p>

                    <div style={{ marginBottom: 8 }}>
                      <span
                        style={{
                          fontSize: 'clamp(34px, 4vw, 42px)',
                          fontWeight: 760,
                          letterSpacing: '-0.04em',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {priceLabel}
                      </span>
                      <span
                        style={{
                          marginLeft: 6,
                          fontSize: 13,
                          color: plan.featured ? '#A8ABB8' : '#898B92',
                          fontWeight: 600,
                        }}
                      >
                        / month
                      </span>
                    </div>
                    <p
                      style={{
                        margin: '0 0 22px',
                        fontSize: 13,
                        color: plan.featured ? '#A8ABB8' : '#898B92',
                        lineHeight: 1.55,
                      }}
                    >
                      {plan.blurb}
                    </p>

                    <ul style={{ listStyle: 'none', margin: '0 0 28px', padding: 0, flex: 1 }}>
                      {plan.features.map((f) => (
                        <li
                          key={f}
                          style={{
                            display: 'flex',
                            gap: 10,
                            alignItems: 'flex-start',
                            marginBottom: 10,
                            fontSize: 13.5,
                            lineHeight: 1.45,
                            color: plan.featured ? '#E8E9EF' : '#3F434D',
                          }}
                        >
                          <FontAwesomeIcon
                            icon={faCheck}
                            style={{
                              marginTop: 3,
                              color: plan.featured ? '#EA6A3B' : '#37865C',
                              fontSize: 12,
                              flexShrink: 0,
                            }}
                          />
                          {f}
                        </li>
                      ))}
                    </ul>

                    <button
                      type="button"
                      onClick={goLogin}
                      style={{
                        height: 48,
                        border: plan.featured ? 'none' : '1.5px solid #DAD8D3',
                        borderRadius: 10,
                        background: plan.featured ? '#EA6A3B' : '#fff',
                        color: plan.featured ? '#fff' : '#171923',
                        fontSize: 14,
                        fontWeight: 650,
                        fontFamily: 'inherit',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 10,
                        boxShadow: plan.featured ? '0 10px 25px rgba(234,106,59,0.28)' : 'none',
                      }}
                    >
                      {plan.cta}
                      <FontAwesomeIcon icon={faArrowRight} />
                    </button>
                  </div>
                )
              })}
            </div>

            <p
              style={{
                margin: '18px 0 0',
                fontSize: 12,
                color: '#898B92',
                textAlign: 'center',
              }}
            >
              Prices convert from NOK using {ratesStatus === 'live' ? 'live' : 'reference'} rates for{' '}
              {region.label}. Billing currency at checkout may be confirmed with your workspace admin.
              *Fair-use limits apply on Command.
            </p>
          </div>
        </section>

        <section style={{ padding: '10px 0 72px' }}>
          <div style={{ ...container, maxWidth: 780 }}>
            <h2
              style={{
                margin: '0 0 18px',
                fontSize: 26,
                letterSpacing: '-0.03em',
                color: '#171923',
              }}
            >
              Pricing FAQ
            </h2>
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
              <div key={item.q} style={{ marginBottom: 18 }}>
                <h3 style={{ margin: '0 0 6px', fontSize: 16, color: '#171923' }}>{item.q}</h3>
                <p style={{ margin: 0, color: '#5B5E68', fontSize: 14, lineHeight: 1.7 }}>{item.a}</p>
              </div>
            ))}
          </div>
        </section>
      </article>

      <style>{`
        @media (max-width: 960px) {
          .pricing-grid {
            grid-template-columns: 1fr !important;
          }
          .pricing-grid > div {
            transform: none !important;
          }
        }
      `}</style>
    </MarketingLayout>
  )
}
