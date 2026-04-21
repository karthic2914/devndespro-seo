const { pool } = require('../clients')

async function getSetting(key, fallback = null) {
  const { rows } = await pool.query('SELECT value FROM settings WHERE key=$1 LIMIT 1', [key])
  if (!rows[0]) return fallback
  const v = rows[0].value
  if (v === 'true') return true
  if (v === 'false') return false
  return v
}

async function setSetting(key, value) {
  await pool.query(
    'INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW()) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()',
    [key, String(value)]
  )
}

module.exports = { getSetting, setSetting }
