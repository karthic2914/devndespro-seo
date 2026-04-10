const express = require('express')
const { pool } = require('../clients')
const { auth, verifySite } = require('../middleware')
const { firstValueByKey, parseSimpleCsv, toInt } = require('../utils/helpers')

const router = express.Router()

const PUBLISHING_PROVIDERS = {
  wordpress: {
    connectedColumn: 'wordpress_connected',
    fields: ['wordpress_site_url', 'wordpress_username', 'wordpress_app_password'],
  },
  webflow: {
    connectedColumn: 'webflow_connected',
    fields: ['webflow_site_id', 'webflow_collection_id', 'webflow_api_token'],
  },
  shopify: {
    connectedColumn: 'shopify_connected',
    fields: ['shopify_store_domain', 'shopify_api_token'],
  },
  wix: {
    connectedColumn: 'wix_connected',
    fields: ['wix_site_id', 'wix_api_key'],
  },
  framer: {
    connectedColumn: 'framer_connected',
    fields: ['framer_site_id', 'framer_collection_id', 'framer_api_token'],
  },
  webhook: {
    connectedColumn: 'webhook_connected',
    fields: ['webhook_url', 'webhook_secret'],
  },
}

function providerPayload(provider, row) {
  const config = PUBLISHING_PROVIDERS[provider]
  return {
    connected: !!row?.[config.connectedColumn],
    values: Object.fromEntries(config.fields.map((field) => [field, row?.[field] || ''])),
  }
}

router.get('/:siteId/integrations', auth, verifySite, async (req, res) => {
  const [uR, iR, aR] = await Promise.all([
    pool.query('SELECT gsc_refresh_token FROM users WHERE id=$1', [req.user.id]),
    pool.query('SELECT * FROM integration_settings WHERE site_id=$1 LIMIT 1', [req.siteId]),
    pool.query('SELECT * FROM ahrefs_metrics WHERE site_id=$1 ORDER BY imported_at DESC LIMIT 1', [req.siteId]),
  ])
  res.json({
    gsc: { connected: !!uR.rows[0]?.gsc_refresh_token },
    ga4: {
      connected: !!iR.rows[0]?.ga4_connected,
      propertyId: iR.rows[0]?.ga4_property_id || '',
      measurementId: iR.rows[0]?.ga4_measurement_id || '',
    },
    ahrefs: {
      connected: !!iR.rows[0]?.ahrefs_connected,
      source: iR.rows[0]?.ahrefs_source || null,
      lastImportAt: iR.rows[0]?.ahrefs_last_import_at || null,
      latest: aR.rows[0] || null,
    },
    publishing: {
      wordpress: providerPayload('wordpress', iR.rows[0]),
      webflow: providerPayload('webflow', iR.rows[0]),
      shopify: providerPayload('shopify', iR.rows[0]),
      wix: providerPayload('wix', iR.rows[0]),
      framer: providerPayload('framer', iR.rows[0]),
      webhook: providerPayload('webhook', iR.rows[0]),
    },
  })
})

router.put('/:siteId/integrations/publishing/:provider', auth, verifySite, async (req, res) => {
  const provider = String(req.params.provider || '').toLowerCase()
  const config = PUBLISHING_PROVIDERS[provider]
  if (!config) return res.status(400).json({ error: 'Unsupported provider' })

  const values = config.fields.map((field) => String(req.body?.[field] || '').trim() || null)
  const hasRequiredValue = values.some(Boolean)
  if (!hasRequiredValue) {
    return res.status(400).json({ error: 'Add at least one integration value before saving' })
  }

  const insertColumns = ['site_id', config.connectedColumn, ...config.fields, 'updated_at']
  const insertPlaceholders = insertColumns.map((_, index) => `$${index + 1}`)
  const updates = [
    `${config.connectedColumn}=EXCLUDED.${config.connectedColumn}`,
    ...config.fields.map((field) => `${field}=EXCLUDED.${field}`),
    'updated_at=NOW()',
  ]

  await pool.query(
    `INSERT INTO integration_settings (${insertColumns.join(', ')})
     VALUES (${insertPlaceholders.join(', ')})
     ON CONFLICT (site_id) DO UPDATE SET ${updates.join(', ')}`,
    [req.siteId, true, ...values, new Date()]
  )

  res.json({ ok: true })
})

router.delete('/:siteId/integrations/publishing/:provider', auth, verifySite, async (req, res) => {
  const provider = String(req.params.provider || '').toLowerCase()
  const config = PUBLISHING_PROVIDERS[provider]
  if (!config) return res.status(400).json({ error: 'Unsupported provider' })

  const resetColumns = [config.connectedColumn, ...config.fields]
  const updates = [`${config.connectedColumn}=false`, ...config.fields.map((field) => `${field}=NULL`), 'updated_at=NOW()']
  const insertColumns = ['site_id', ...resetColumns, 'updated_at']
  const insertValues = [req.siteId, false, ...config.fields.map(() => null), new Date()]
  const insertPlaceholders = insertColumns.map((_, index) => `$${index + 1}`)

  await pool.query(
    `INSERT INTO integration_settings (${insertColumns.join(', ')})
     VALUES (${insertPlaceholders.join(', ')})
     ON CONFLICT (site_id) DO UPDATE SET ${updates.join(', ')}`,
    insertValues
  )

  res.json({ ok: true })
})

router.put('/:siteId/integrations/ga4', auth, verifySite, async (req, res) => {
  const { propertyId, measurementId } = req.body
  if (!propertyId) return res.status(400).json({ error: 'propertyId required' })
  await pool.query(
    `INSERT INTO integration_settings (site_id, ga4_connected, ga4_property_id, ga4_measurement_id, updated_at)
     VALUES ($1, true, $2, $3, NOW())
     ON CONFLICT (site_id) DO UPDATE SET ga4_connected=true, ga4_property_id=$2, ga4_measurement_id=$3, updated_at=NOW()`,
    [req.siteId, String(propertyId), measurementId ? String(measurementId) : null]
  )
  res.json({ ok: true })
})

router.delete('/:siteId/integrations/ga4', auth, verifySite, async (req, res) => {
  await pool.query(
    `INSERT INTO integration_settings (site_id, ga4_connected, ga4_property_id, ga4_measurement_id, updated_at)
     VALUES ($1, false, NULL, NULL, NOW())
     ON CONFLICT (site_id) DO UPDATE SET ga4_connected=false, ga4_property_id=NULL, ga4_measurement_id=NULL, updated_at=NOW()`,
    [req.siteId]
  )
  res.json({ ok: true })
})

router.post('/:siteId/integrations/ahrefs/manual', auth, verifySite, async (req, res) => {
  const dr = toInt(req.body.dr)
  const backlinks = toInt(req.body.backlinks)
  const refDomains = toInt(req.body.refDomains)
  const organicTraffic = toInt(req.body.organicTraffic)
  const organicKeywords = toInt(req.body.organicKeywords)

  const { rows } = await pool.query(
    `INSERT INTO ahrefs_metrics (site_id, dr, backlinks, ref_domains, organic_traffic, organic_keywords, source) VALUES ($1,$2,$3,$4,$5,$6,'manual') RETURNING *`,
    [req.siteId, dr, backlinks, refDomains, organicTraffic, organicKeywords]
  )

  await Promise.all([
    pool.query(
      `INSERT INTO integration_settings (site_id, ahrefs_connected, ahrefs_last_import_at, ahrefs_source, updated_at) VALUES ($1, true, NOW(), 'manual', NOW())
       ON CONFLICT (site_id) DO UPDATE SET ahrefs_connected=true, ahrefs_last_import_at=NOW(), ahrefs_source='manual', updated_at=NOW()`,
      [req.siteId]
    ),
    pool.query(
      `INSERT INTO seo_metrics (site_id, dr) VALUES ($1,$2) ON CONFLICT (site_id) DO UPDATE SET dr=$2, updated_at=NOW()`,
      [req.siteId, dr]
    ),
  ])
  res.json(rows[0])
})

router.post('/:siteId/integrations/ahrefs/import-csv', auth, verifySite, async (req, res) => {
  const parsed = parseSimpleCsv(req.body.csvText)
  if (!parsed) return res.status(400).json({ error: 'Invalid CSV. Add a header row and one data row.' })

  const dr = toInt(firstValueByKey(parsed, ['domain rating', 'dr']))
  const backlinks = toInt(firstValueByKey(parsed, ['backlinks']))
  const refDomains = toInt(firstValueByKey(parsed, ['referring domains', 'ref domains']))
  const organicTraffic = toInt(firstValueByKey(parsed, ['organic traffic']))
  const organicKeywords = toInt(firstValueByKey(parsed, ['organic keywords']))

  if ([dr, backlinks, refDomains, organicTraffic, organicKeywords].every(v => v === 0)) {
    return res.status(400).json({
      error: 'No supported metrics found. Include columns like Domain Rating, Backlinks, Referring Domains, Organic Traffic, Organic Keywords.',
    })
  }

  const { rows } = await pool.query(
    `INSERT INTO ahrefs_metrics (site_id, dr, backlinks, ref_domains, organic_traffic, organic_keywords, source) VALUES ($1,$2,$3,$4,$5,$6,'csv') RETURNING *`,
    [req.siteId, dr, backlinks, refDomains, organicTraffic, organicKeywords]
  )

  await Promise.all([
    pool.query(
      `INSERT INTO integration_settings (site_id, ahrefs_connected, ahrefs_last_import_at, ahrefs_source, updated_at) VALUES ($1, true, NOW(), 'csv', NOW())
       ON CONFLICT (site_id) DO UPDATE SET ahrefs_connected=true, ahrefs_last_import_at=NOW(), ahrefs_source='csv', updated_at=NOW()`,
      [req.siteId]
    ),
    pool.query(
      `INSERT INTO seo_metrics (site_id, dr) VALUES ($1,$2) ON CONFLICT (site_id) DO UPDATE SET dr=$2, updated_at=NOW()`,
      [req.siteId, dr]
    ),
  ])
  res.json(rows[0])
})

router.delete('/:siteId/integrations/ahrefs', auth, verifySite, async (req, res) => {
  await pool.query(
    `INSERT INTO integration_settings (site_id, ahrefs_connected, ahrefs_last_import_at, ahrefs_source, updated_at) VALUES ($1, false, NULL, NULL, NOW())
     ON CONFLICT (site_id) DO UPDATE SET ahrefs_connected=false, ahrefs_last_import_at=NULL, ahrefs_source=NULL, updated_at=NOW()`,
    [req.siteId]
  )
  res.json({ ok: true })
})

module.exports = router
