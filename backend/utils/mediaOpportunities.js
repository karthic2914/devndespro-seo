const axios = require('axios')
const { pool } = require('../clients')

const STATUSES = [
  'discovered',
  'shortlisted',
  'contacted',
  'in_discussion',
  'published',
  'ai_cited',
]

const MARKETS = [
  { id: 'nordic', label: 'Norway / Nordic', hint: 'Prefer NO/SE/DK/FI press' },
  { id: 'europe', label: 'Europe', hint: 'Nordic + EU industry press' },
  { id: 'global', label: 'Global', hint: 'International tech/business media' },
]

function nameKey(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160)
}

function extractHost(url) {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    return u.hostname.replace(/^www\./, '')
  } catch {
    return String(url || '')
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
  }
}

async function ensureMediaOpportunitiesTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS media_opportunities (
      id SERIAL PRIMARY KEY,
      site_id INTEGER NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      name_key TEXT NOT NULL,
      url TEXT,
      country TEXT,
      topic TEXT,
      ai_authority TEXT DEFAULT 'Medium',
      why TEXT,
      pitch TEXT,
      contact_hint TEXT,
      status TEXT DEFAULT 'discovered',
      notes TEXT,
      mention_found BOOLEAN DEFAULT FALSE,
      mention_url TEXT,
      mention_title TEXT,
      mention_checked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (site_id, name_key)
    )
  `)
  await pool.query(`ALTER TABLE media_opportunities ADD COLUMN IF NOT EXISTS name_key TEXT`)
  await pool.query(`ALTER TABLE media_opportunities ADD COLUMN IF NOT EXISTS mention_found BOOLEAN DEFAULT FALSE`)
  await pool.query(`ALTER TABLE media_opportunities ADD COLUMN IF NOT EXISTS mention_url TEXT`)
  await pool.query(`ALTER TABLE media_opportunities ADD COLUMN IF NOT EXISTS mention_title TEXT`)
  await pool.query(`ALTER TABLE media_opportunities ADD COLUMN IF NOT EXISTS mention_checked_at TIMESTAMPTZ`)
  await pool.query(`
    UPDATE media_opportunities
    SET name_key = lower(btrim(name))
    WHERE name_key IS NULL OR name_key = ''
  `)
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS media_opportunities_site_name_key_uidx
    ON media_opportunities (site_id, name_key)
  `)
}

function authorityRank(level) {
  const v = String(level || '').toLowerCase()
  if (v === 'high') return 0
  if (v === 'medium') return 1
  return 2
}

function normalizeStatus(status) {
  const s = String(status || 'discovered').toLowerCase().replace(/\s+/g, '_')
  return STATUSES.includes(s) ? s : 'discovered'
}

function mapRow(row) {
  return {
    id: row.id,
    name: row.name,
    url: row.url || '',
    country: row.country || '',
    topic: row.topic || '',
    aiAuthority: row.ai_authority || 'Medium',
    why: row.why || '',
    pitch: row.pitch || '',
    contactHint: row.contact_hint || '',
    status: row.status || 'discovered',
    notes: row.notes || '',
    mentionFound: Boolean(row.mention_found),
    mentionUrl: row.mention_url || '',
    mentionTitle: row.mention_title || '',
    mentionCheckedAt: row.mention_checked_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

async function listMediaOpportunities(siteId) {
  await ensureMediaOpportunitiesTable()
  const { rows } = await pool.query(
    `SELECT * FROM media_opportunities WHERE site_id=$1`,
    [siteId]
  )
  return rows
    .map(mapRow)
    .sort((a, b) => {
      if (Boolean(b.mentionFound) !== Boolean(a.mentionFound)) return b.mentionFound ? 1 : -1
      const ar = authorityRank(a.aiAuthority) - authorityRank(b.aiAuthority)
      if (ar) return ar
      return String(a.name).localeCompare(String(b.name))
    })
}

async function upsertMediaOutlets(siteId, outlets = []) {
  await ensureMediaOpportunitiesTable()
  let upserted = 0
  for (const o of outlets) {
    if (!o?.name) continue
    const key = nameKey(o.name)
    if (!key) continue
    const authority = ['High', 'Medium', 'Low'].includes(o.aiAuthority) ? o.aiAuthority : 'Medium'
    await pool.query(
      `INSERT INTO media_opportunities
         (site_id, name, name_key, url, country, topic, ai_authority, why, pitch, contact_hint, status, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'discovered',NOW())
       ON CONFLICT (site_id, name_key)
       DO UPDATE SET
         name=EXCLUDED.name,
         url=COALESCE(NULLIF(EXCLUDED.url,''), media_opportunities.url),
         country=COALESCE(NULLIF(EXCLUDED.country,''), media_opportunities.country),
         topic=COALESCE(NULLIF(EXCLUDED.topic,''), media_opportunities.topic),
         ai_authority=EXCLUDED.ai_authority,
         why=COALESCE(NULLIF(EXCLUDED.why,''), media_opportunities.why),
         pitch=COALESCE(NULLIF(EXCLUDED.pitch,''), media_opportunities.pitch),
         contact_hint=COALESCE(NULLIF(EXCLUDED.contact_hint,''), media_opportunities.contact_hint),
         updated_at=NOW()`,
      [
        siteId,
        String(o.name).slice(0, 120),
        key,
        String(o.url || '').slice(0, 240),
        String(o.country || '').slice(0, 60),
        String(o.topic || '').slice(0, 200),
        authority,
        String(o.why || '').slice(0, 280),
        String(o.pitch || '').slice(0, 320),
        String(o.contactHint || '').slice(0, 120),
      ]
    )
    upserted += 1
  }
  return upserted
}

async function updateMediaOpportunity(siteId, id, patch = {}) {
  await ensureMediaOpportunitiesTable()
  const fields = []
  const values = []
  let i = 1

  if (patch.status != null) {
    fields.push(`status=$${i++}`)
    values.push(normalizeStatus(patch.status))
  }
  if (patch.notes != null) {
    fields.push(`notes=$${i++}`)
    values.push(String(patch.notes).slice(0, 500))
  }
  if (patch.aiAuthority != null && ['High', 'Medium', 'Low'].includes(patch.aiAuthority)) {
    fields.push(`ai_authority=$${i++}`)
    values.push(patch.aiAuthority)
  }
  if (typeof patch.mentionFound === 'boolean') {
    fields.push(`mention_found=$${i++}`)
    values.push(patch.mentionFound)
  }
  if (patch.mentionUrl != null) {
    fields.push(`mention_url=$${i++}`)
    values.push(String(patch.mentionUrl).slice(0, 500))
  }
  if (patch.mentionTitle != null) {
    fields.push(`mention_title=$${i++}`)
    values.push(String(patch.mentionTitle).slice(0, 280))
  }
  if (patch.mentionCheckedAt != null) {
    fields.push(`mention_checked_at=$${i++}`)
    values.push(patch.mentionCheckedAt)
  }
  if (!fields.length) {
    const { rows } = await pool.query(
      'SELECT * FROM media_opportunities WHERE id=$1 AND site_id=$2',
      [id, siteId]
    )
    return rows[0] ? mapRow(rows[0]) : null
  }

  fields.push('updated_at=NOW()')
  values.push(id, siteId)
  const { rows } = await pool.query(
    `UPDATE media_opportunities SET ${fields.join(', ')}
     WHERE id=$${i++} AND site_id=$${i}
     RETURNING *`,
    values
  )
  return rows[0] ? mapRow(rows[0]) : null
}

async function seedMediaActions(siteId) {
  await ensureMediaOpportunitiesTable()
  const { ensureActionColumns } = require('./actionSync')
  await ensureActionColumns()

  const { rows } = await pool.query(
    `SELECT name, pitch, ai_authority, status
     FROM media_opportunities
     WHERE site_id=$1
       AND lower(ai_authority)='high'
       AND status IN ('discovered','shortlisted')
     ORDER BY updated_at DESC
     LIMIT 5`,
    [siteId]
  )

  let seeded = 0
  for (const row of rows) {
    const text = `Digital PR: pitch ${row.name} (high AI-trust media) for a citation-worthy story`
    const why = row.pitch
      ? String(row.pitch).slice(0, 240)
      : 'Coverage on high AI-trust media increases chance LLMs mention your brand.'
    const ins = await pool.query(
      `INSERT INTO actions (site_id, text, impact, source, category, why, priority_score)
       SELECT $1, $2, 'High', 'growth', 'Digital PR', $3, 83
       WHERE NOT EXISTS (
         SELECT 1 FROM actions
         WHERE site_id=$1 AND lower(btrim(text))=lower(btrim($2)) AND done=FALSE
       )
       RETURNING id`,
      [siteId, text, why]
    )
    if (ins.rowCount > 0) seeded += 1
  }
  return seeded
}

async function dfsSerpMention(query, locationCode = 2578) {
  const login = process.env.DATAFORSEO_LOGIN || process.env.DATAFORSEO_API_LOGIN
  const password = process.env.DATAFORSEO_PASSWORD || process.env.DATAFORSEO_API_PASSWORD
  if (!login || !password) return null
  const auth = Buffer.from(`${login}:${password}`).toString('base64')
  const { data } = await axios.post(
    'https://api.dataforseo.com/v3/serp/google/organic/live/advanced',
    [
      {
        keyword: query,
        location_code: locationCode,
        language_code: 'en',
        depth: 10,
      },
    ],
    {
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      timeout: 25000,
    }
  )
  const items = data?.tasks?.[0]?.result?.[0]?.items || []
  const organic = items.filter((it) => it?.type === 'organic' && it?.url)
  if (!organic.length) return { found: false }
  return {
    found: true,
    url: organic[0].url,
    title: organic[0].title || '',
  }
}

/**
 * Check whether the brand/domain appears on shortlisted/contacted/published outlets.
 */
async function checkMediaMentions(siteId, options = {}) {
  await ensureMediaOpportunitiesTable()
  const { rows: siteRows } = await pool.query(
    'SELECT name, url FROM sites WHERE id=$1',
    [siteId]
  )
  const site = siteRows[0]
  if (!site) return { checked: 0, found: 0, outlets: [] }

  const brand = String(site.name || '').trim()
  const domain = extractHost(site.url || '')
  const { rows } = await pool.query(
    `SELECT * FROM media_opportunities
     WHERE site_id=$1
       AND (
         status IN ('shortlisted','contacted','in_discussion','published','ai_cited')
         OR lower(ai_authority)='high'
       )
     ORDER BY updated_at DESC
     LIMIT $2`,
    [siteId, Number(options.limit) || 12]
  )

  let found = 0
  const updates = []
  for (const row of rows) {
    const host = extractHost(row.url || '')
    if (!host) continue
    const terms = [brand, domain].filter(Boolean).map((t) => `"${t}"`).join(' OR ')
    const query = `site:${host} (${terms})`
    let hit = null
    try {
      hit = await dfsSerpMention(query, options.locationCode || 2578)
    } catch (e) {
      console.warn('mention check DFS failed:', host, e.message)
    }
    if (!hit) {
      try {
        const { fetchSerpResults } = require('./serp')
        const serp = await fetchSerpResults(query, 'google')
        const match = (serp || []).find((r) => {
          const h = String(r.domain || extractHost(r.url || '')).toLowerCase()
          return h === host || h.endsWith(`.${host}`) || String(r.url || '').includes(host)
        })
        hit = match
          ? { found: true, url: match.url, title: match.title || '' }
          : { found: false }
      } catch (e2) {
        console.warn('mention check SERP fallback failed:', host, e2.message)
        hit = { found: false }
      }
    }

    const mentionFound = Boolean(hit?.found)
    if (mentionFound) found += 1
    let nextStatus = row.status
    if (mentionFound && ['discovered', 'shortlisted', 'contacted', 'in_discussion'].includes(row.status)) {
      nextStatus = 'published'
    }

    const updated = await updateMediaOpportunity(siteId, row.id, {
      mentionFound,
      mentionUrl: hit?.url || '',
      mentionTitle: hit?.title || '',
      mentionCheckedAt: new Date().toISOString(),
      status: nextStatus,
    })
    updates.push(updated)
  }

  return {
    checked: rows.length,
    found,
    brand,
    domain,
    outlets: await listMediaOpportunities(siteId),
    updated: updates.filter(Boolean),
  }
}

module.exports = {
  STATUSES,
  MARKETS,
  ensureMediaOpportunitiesTable,
  listMediaOpportunities,
  upsertMediaOutlets,
  updateMediaOpportunity,
  seedMediaActions,
  checkMediaMentions,
  mapRow,
  extractHost,
}
