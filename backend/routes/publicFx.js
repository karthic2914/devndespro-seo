const express = require('express')
const router = express.Router()

const FALLBACK = {
  NOK: 1,
  USD: 0.094,
  EUR: 0.086,
  GBP: 0.074,
  INR: 7.85,
}

/**
 * Public FX rates from NOK — proxied server-side to avoid browser CORS.
 * GET /api/public/fx?from=NOK
 */
router.get('/fx', async (req, res) => {
  const from = String(req.query.from || 'NOK').toUpperCase()
  const symbols = 'USD,EUR,GBP,INR'

  const sources = [
    `https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(from)}&symbols=${symbols}`,
    `https://api.frankfurter.app/v1/latest?base=${encodeURIComponent(from)}&symbols=${symbols}`,
  ]

  for (const url of sources) {
    try {
      const upstream = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      })
      if (!upstream.ok) continue
      const data = await upstream.json()
      const rates = data.rates || {}
      if (![rates.USD, rates.EUR, rates.GBP, rates.INR].every((n) => Number.isFinite(Number(n)) && Number(n) > 0)) {
        continue
      }
      return res.json({
        source: 'live',
        base: from,
        date: data.date || null,
        rates: {
          NOK: from === 'NOK' ? 1 : Number(rates.NOK) || FALLBACK.NOK,
          USD: Number(rates.USD),
          EUR: Number(rates.EUR),
          GBP: Number(rates.GBP),
          INR: Number(rates.INR),
        },
      })
    } catch {
      /* try next */
    }
  }

  return res.json({
    source: 'fallback',
    base: 'NOK',
    date: null,
    rates: FALLBACK,
  })
})

module.exports = router
