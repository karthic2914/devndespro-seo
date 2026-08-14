const { pool } = require('../clients')

let schemaReady = false

async function ensureUserFeatureSchema() {
  if (schemaReady) return
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS backlinks_enabled BOOLEAN DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS keywords_enabled BOOLEAN DEFAULT FALSE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS features_updated_at TIMESTAMPTZ
  `)
  schemaReady = true
}

function isAdminUser(user) {
  return Number(user?.id) === 1
}

function canUseBacklinks(user) {
  return isAdminUser(user) || Boolean(user?.backlinks_enabled) || Boolean(user?.is_paid)
}

function canUseKeywords(user) {
  return isAdminUser(user) || Boolean(user?.keywords_enabled) || Boolean(user?.is_paid)
}

function featureFlagsFor(user) {
  return {
    backlinks: canUseBacklinks(user),
    keywords: canUseKeywords(user),
    isAdmin: isAdminUser(user),
  }
}

/** Mark paid → auto-enable Backlinks + Keywords. Unpaid clears is_paid only (manual toggles stay). */
async function setUserPaid(userId, paid = true) {
  await ensureUserFeatureSchema()
  if (paid) {
    await pool.query(
      `UPDATE users
       SET is_paid = TRUE,
           backlinks_enabled = TRUE,
           keywords_enabled = TRUE,
           features_updated_at = NOW()
       WHERE id = $1`,
      [userId]
    )
  } else {
    await pool.query(
      `UPDATE users
       SET is_paid = FALSE,
           backlinks_enabled = FALSE,
           keywords_enabled = FALSE,
           features_updated_at = NOW()
       WHERE id = $1`,
      [userId]
    )
  }
}

async function setUserFeatures(userId, patch = {}) {
  await ensureUserFeatureSchema()
  const fields = []
  const values = []
  let i = 1

  if (typeof patch.is_paid === 'boolean') {
    fields.push(`is_paid = $${i++}`)
    values.push(patch.is_paid)
  }
  if (typeof patch.backlinks_enabled === 'boolean') {
    fields.push(`backlinks_enabled = $${i++}`)
    values.push(patch.backlinks_enabled)
  }
  if (typeof patch.keywords_enabled === 'boolean') {
    fields.push(`keywords_enabled = $${i++}`)
    values.push(patch.keywords_enabled)
  }

  if (!fields.length) return null

  // Paying on → unlock both features automatically
  if (patch.is_paid === true) {
    if (typeof patch.backlinks_enabled !== 'boolean') {
      fields.push(`backlinks_enabled = TRUE`)
    }
    if (typeof patch.keywords_enabled !== 'boolean') {
      fields.push(`keywords_enabled = TRUE`)
    }
  }

  // Unpay → lock both (admin can re-enable manually after)
  if (patch.is_paid === false) {
    if (typeof patch.backlinks_enabled !== 'boolean') {
      fields.push(`backlinks_enabled = FALSE`)
    }
    if (typeof patch.keywords_enabled !== 'boolean') {
      fields.push(`keywords_enabled = FALSE`)
    }
  }

  fields.push('features_updated_at = NOW()')
  values.push(userId)

  const { rows } = await pool.query(
    `UPDATE users
     SET ${fields.join(', ')}
     WHERE id = $${i}
     RETURNING id, email, name, photo, is_paid, backlinks_enabled, keywords_enabled, features_updated_at, created_at`,
    values
  )
  return rows[0] || null
}

module.exports = {
  ensureUserFeatureSchema,
  isAdminUser,
  canUseBacklinks,
  canUseKeywords,
  featureFlagsFor,
  setUserPaid,
  setUserFeatures,
}
