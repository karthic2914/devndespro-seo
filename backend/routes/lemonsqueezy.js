const crypto = require('node:crypto')
const { pool } = require('../clients')

/**
 * Lemon Squeezy sends an HMAC-SHA256 signature of the unmodified JSON body.
 * This route must be mounted with express.raw before express.json.
 */
function verifySignature(rawBody, supplied, secret) {
  if (!Buffer.isBuffer(rawBody) || !secret || typeof supplied !== 'string' || !/^[a-f0-9]{64}$/i.test(supplied)) return false
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest()
  const actual = Buffer.from(supplied, 'hex')
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
}

async function ensureLemonOrdersTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS lemonsqueezy_orders (
      order_id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      user_id INTEGER,
      payment_status TEXT NOT NULL,
      refunded BOOLEAN NOT NULL DEFAULT FALSE,
      test_mode BOOLEAN NOT NULL DEFAULT TRUE,
      last_event TEXT NOT NULL,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
}

/**
 * Record verified orders for reconciliation. This intentionally does not
 * grant paid features until the one-time license duration and account
 * matching rules have been configured and tested.
 */
async function handleLemonWebhook(req, res) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET
  if (!secret) return res.status(503).send('Webhook not configured')
  if (!verifySignature(req.body, req.get('x-signature'), secret)) {
    return res.status(401).send('Invalid webhook signature')
  }

  let event
  try {
    event = JSON.parse(req.body.toString('utf8'))
  } catch {
    return res.status(400).send('Invalid JSON')
  }

  const eventName = event?.meta?.event_name
  if (!['order_created', 'order_refunded'].includes(eventName)) {
    return res.status(200).json({ received: true, ignored: true })
  }

  const orderId = String(event?.data?.id || '')
  const attributes = event?.data?.attributes || {}
  const storeId = String(attributes.store_id || '')
  const productId = String(attributes.first_order_item?.product_id || '')
  const expectedStore = String(process.env.LEMONSQUEEZY_STORE_ID || '')
  const expectedProduct = String(process.env.LEMONSQUEEZY_PRODUCT_ID || '')
  if (!expectedStore || !expectedProduct) return res.status(503).send('Store/product not configured')
  if (!orderId || storeId !== expectedStore || productId !== expectedProduct) {
    return res.status(200).json({ received: true, ignored: true })
  }

  const email = String(attributes.user_email || '').trim().toLowerCase()
  const status = String(attributes.status || '').toLowerCase()
  const refunded = eventName === 'order_refunded' || attributes.refunded === true || status === 'refunded'
  if (!email || (eventName === 'order_created' && status !== 'paid')) {
    return res.status(200).json({ received: true, ignored: true })
  }

  const userIdRaw = event?.meta?.custom_data?.user_id
  const userId = /^\d+$/.test(String(userIdRaw || '')) ? Number(userIdRaw) : null

  try {
    await ensureLemonOrdersTable()
    await pool.query(
      `INSERT INTO lemonsqueezy_orders
        (order_id, store_id, product_id, customer_email, user_id, payment_status, refunded, test_mode, last_event, payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (order_id) DO UPDATE SET
         payment_status = EXCLUDED.payment_status,
         refunded = lemonsqueezy_orders.refunded OR EXCLUDED.refunded,
         last_event = EXCLUDED.last_event,
         payload = EXCLUDED.payload,
         updated_at = NOW()`,
      [orderId, storeId, productId, email, userId, status, refunded,
        attributes.first_order_item?.test_mode === true || attributes.test_mode === true,
        eventName, JSON.stringify(event)]
    )
    return res.status(200).json({ received: true })
  } catch (error) {
    console.error('Lemon Squeezy webhook persistence failed:', error)
    return res.status(500).send('Webhook processing failed')
  }
}

module.exports = { verifySignature, handleLemonWebhook }
