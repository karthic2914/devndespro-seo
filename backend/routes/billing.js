const express = require('express')
const { auth } = require('../middleware')
const { PLAN_META, normalizePlan, setUserPlan, featureFlagsFor } = require('../utils/features')

const router = express.Router()

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  // eslint-disable-next-line global-require
  return require('stripe')(key)
}

function appUrl() {
  return (process.env.FRONTEND_URL || 'https://seo.devndespro.com').replace(/\/$/, '')
}

function amountForPlan(plan) {
  const p = normalizePlan(plan)
  const meta = PLAN_META[p]
  const envOverride =
    p === 'launch'
      ? process.env.STRIPE_PRICE_LAUNCH_NOK
      : p === 'pro'
      ? process.env.STRIPE_PRICE_PRO_NOK
      : p === 'agency'
      ? process.env.STRIPE_PRICE_AGENCY_NOK
      : null
  if (envOverride && Number(envOverride) > 0) return Math.round(Number(envOverride))
  return Math.round(Number(meta?.priceNok) || 0)
}

function priceLabelFor(plan, amount) {
  const n = amount != null ? amount : amountForPlan(plan)
  if (!n) return '0 kr'
  return `${n} kr/mo`
}

function planPayload(id) {
  const amount = amountForPlan(id)
  return {
    ...PLAN_META[id],
    priceNok: amount,
    priceLabel: priceLabelFor(id, amount),
  }
}

/** GET /api/billing/plans */
router.get('/plans', auth, async (req, res) => {
  res.json({
    currency: 'nok',
    checkoutEnabled: Boolean(process.env.STRIPE_SECRET_KEY),
    plans: ['free', 'launch', 'pro', 'agency'].map(planPayload),
  })
})

/**
 * POST /api/billing/checkout { plan: 'launch'|'pro'|'agency' }
 */
router.post('/checkout', auth, async (req, res) => {
  try {
    const stripe = getStripe()
    if (!stripe) {
      return res.status(503).json({
        error: 'Checkout is not configured yet. Ask admin to enable Stripe, or they can assign your plan manually.',
        checkoutEnabled: false,
      })
    }

    const plan = normalizePlan(req.body?.plan)
    if (!['launch', 'pro', 'agency'].includes(plan)) {
      return res.status(400).json({ error: 'Choose Launch, Accelerate or Command' })
    }

    // Use Stripe catalog prices rather than creating a new product on every checkout.
    const priceIds = {
      launch: process.env.STRIPE_PRICE_LAUNCH_ID,
      pro: process.env.STRIPE_PRICE_PRO_ID,
      agency: process.env.STRIPE_PRICE_AGENCY_ID,
    }
    const priceId = priceIds[plan]
    if (!priceId || !priceId.startsWith('price_')) {
      return res.status(503).json({ error: 'Stripe price is not configured for this plan' })
    }

    const userId = String(req.user.id)
    const email = req.user.email || undefined
    const meta = { userId, plan }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: email,
      client_reference_id: userId,
      metadata: meta,
      subscription_data: {
        metadata: meta,
      },
      line_items: [{ quantity: 1, price: priceId }],
      success_url: `${appUrl()}/settings?upgraded=1&plan=${plan}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl()}/settings?checkout=cancel`,
      allow_promotion_codes: true,
    })

    res.json({ url: session.url, sessionId: session.id })
  } catch (e) {
    console.error('checkout error:', e)
    res.status(500).json({ error: e.message || 'Checkout failed' })
  }
})

/**
 * POST /api/billing/confirm-session { sessionId }
 * Unlocks plan right after Stripe redirect (works even if webhook is delayed).
 */
router.post('/confirm-session', auth, async (req, res) => {
  try {
    const stripe = getStripe()
    if (!stripe) return res.status(503).json({ error: 'Stripe not configured' })

    const sessionId = String(req.body?.sessionId || '').trim()
    if (!sessionId) return res.status(400).json({ error: 'sessionId required' })

    const session = await stripe.checkout.sessions.retrieve(sessionId)
    if (!session) return res.status(404).json({ error: 'Session not found' })

    const paid =
      session.payment_status === 'paid'

    if (!paid) {
      return res.status(402).json({ error: 'Payment not completed yet', status: session.payment_status })
    }

    const metaUserId = Number(session.metadata?.userId || session.client_reference_id || 0)
    if (!metaUserId || metaUserId !== Number(req.user.id)) {
      return res.status(403).json({ error: 'Session does not belong to this user' })
    }

    const plan = normalizePlan(session.metadata?.plan || 'pro')
    if (!['launch', 'pro', 'agency'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan on session' })
    }

    const updated = await setUserPlan(metaUserId, plan, {
      source: 'billing',
      notifyAdmin: true,
      sendWelcome: true,
    })

    res.json({
      ok: true,
      plan,
      user: updated,
      features: featureFlagsFor(updated),
    })
  } catch (e) {
    console.error('confirm-session error:', e)
    res.status(500).json({ error: e.message || 'Confirm failed' })
  }
})

async function applyCheckoutSession(session) {
  const userId = Number(session.metadata?.userId || session.client_reference_id || 0)
  const plan = normalizePlan(session.metadata?.plan || 'pro')
  if (!userId || !['launch', 'pro', 'agency'].includes(plan) || session.payment_status !== 'paid') return null
  return setUserPlan(userId, plan, {
    source: 'billing',
    notifyAdmin: true,
    sendWelcome: true,
  })
}

/**
 * Stripe webhook — mount with express.raw in server.js
 */
async function handleStripeWebhook(req, res) {
  const stripe = getStripe()
  if (!stripe) return res.status(503).send('Stripe not configured')

  const sig = req.headers['stripe-signature']
  const secret = process.env.STRIPE_WEBHOOK_SECRET || ''
  let event

  if (!secret) {
    console.error('STRIPE_WEBHOOK_SECRET is required for signed Stripe events')
    return res.status(503).send('Webhook not configured')
  }
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, secret)
  } catch (err) {
    console.error('Stripe webhook signature error:', err.message)
    return res.status(400).send(`Webhook Error: ${err.message}`)
  }

  try {
    if (event.type === 'checkout.session.completed') {
      await applyCheckoutSession(event.data.object)
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object
      const userId = Number(sub.metadata?.userId || 0)
      if (userId) {
        await setUserPlan(userId, 'free', {
          source: 'billing',
          notifyAdmin: true,
          sendWelcome: false,
        })
      }
    }

    res.json({ received: true })
  } catch (e) {
    console.error('Stripe webhook handler error:', e)
    res.status(500).json({ error: 'Webhook handler failed' })
  }
}

module.exports = { router, handleStripeWebhook }
