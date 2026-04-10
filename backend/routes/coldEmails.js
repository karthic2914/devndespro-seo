const express = require('express')
const { pool } = require('../clients')
const { auth, verifySite } = require('../middleware')

const router = express.Router()

function toCapitalizedName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/(^|[\s'-])([a-z])/g, (_, prefix, char) => `${prefix}${char.toUpperCase()}`)
    .trim()
}

async function verifySiteOwner(req, res, next) {
  const { rows } = await pool.query('SELECT user_id FROM sites WHERE id=$1 LIMIT 1', [req.siteId])
  if (!rows[0] || Number(rows[0].user_id) !== Number(req.user.id)) {
    return res.status(403).json({ error: 'Only the site owner can access cold email prospects' })
  }
  next()
}

async function siteOwnedByUser(siteId, userId) {
  const { rows } = await pool.query('SELECT id FROM sites WHERE id=$1 AND user_id=$2 LIMIT 1', [siteId, userId])
  return Boolean(rows[0])
}

async function fetchProspectForUser(id, userId) {
  const { rows } = await pool.query(
    `SELECT c.*, s.name AS site_name, s.url AS site_url
     FROM cold_email_prospects c
     INNER JOIN sites s ON s.id = c.site_id
     WHERE c.id=$1 AND s.user_id=$2
     LIMIT 1`,
    [id, userId]
  )
  return rows[0] || null
}

router.get('/cold-emails', auth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT c.*, s.name AS site_name, s.url AS site_url
     FROM cold_email_prospects c
     INNER JOIN sites s ON s.id = c.site_id
     WHERE s.user_id=$1
     ORDER BY c.updated_at DESC, c.created_at DESC`,
    [req.user.id]
  )
  res.json(rows)
})

router.post('/cold-emails', auth, async (req, res) => {
  const { siteId, name, email, company, website, status, sentAt, notes } = req.body
  const numericSiteId = Number(siteId)
  if (!numericSiteId) return res.status(400).json({ error: 'siteId is required' })
  const allowed = await siteOwnedByUser(numericSiteId, req.user.id)
  if (!allowed) return res.status(403).json({ error: 'Site not found or access denied' })

  const normalizedName = toCapitalizedName(name)
  if (!normalizedName) {
    return res.status(400).json({ error: 'Name is required' })
  }

  const normalizedStatus = String(status || 'sent').toLowerCase()
  const { rows } = await pool.query(
    `INSERT INTO cold_email_prospects
      (site_id, name, email, company, website, status, sent_at, notes, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
     RETURNING id`,
    [
      numericSiteId,
      normalizedName,
      String(email || '').trim() || null,
      String(company || '').trim() || null,
      String(website || '').trim() || null,
      normalizedStatus,
      sentAt || null,
      String(notes || '').trim() || null,
    ]
  )
  const prospect = await fetchProspectForUser(rows[0].id, req.user.id)
  res.json(prospect)
})

router.put('/cold-emails/:id', auth, async (req, res) => {
  const { name, email, company, website, status, sentAt, notes } = req.body
  const normalizedName = toCapitalizedName(name)
  if (!normalizedName) {
    return res.status(400).json({ error: 'Name is required' })
  }

  const { rows } = await pool.query(
    `UPDATE cold_email_prospects c
     SET name=$1, email=$2, company=$3, website=$4, status=$5, sent_at=$6, notes=$7, updated_at=NOW()
     FROM sites s
     WHERE c.id=$8
       AND c.site_id=s.id
       AND s.user_id=$9
     RETURNING c.id`,
    [
      normalizedName,
      String(email || '').trim() || null,
      String(company || '').trim() || null,
      String(website || '').trim() || null,
      String(status || 'sent').toLowerCase(),
      sentAt || null,
      String(notes || '').trim() || null,
      req.params.id,
      req.user.id,
    ]
  )
  if (!rows[0]) return res.status(404).json({ error: 'Prospect not found' })
  const prospect = await fetchProspectForUser(rows[0].id, req.user.id)
  res.json(prospect)
})

router.delete('/cold-emails/:id', auth, async (req, res) => {
  await pool.query(
    `DELETE FROM cold_email_prospects c
     USING sites s
     WHERE c.id=$1
       AND c.site_id=s.id
       AND s.user_id=$2`,
    [req.params.id, req.user.id]
  )
  res.json({ ok: true })
})

router.get('/:siteId/cold-emails', auth, verifySite, verifySiteOwner, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM cold_email_prospects WHERE site_id=$1 ORDER BY created_at DESC',
    [req.siteId]
  )
  res.json(rows)
})

router.post('/:siteId/cold-emails', auth, verifySite, verifySiteOwner, async (req, res) => {
  const { name, email, company, website, status, sentAt, notes } = req.body
  const normalizedName = toCapitalizedName(name)
  if (!normalizedName) {
    return res.status(400).json({ error: 'Name is required' })
  }

  const normalizedStatus = String(status || 'sent').toLowerCase()
  const { rows } = await pool.query(
    `INSERT INTO cold_email_prospects
      (site_id, name, email, company, website, status, sent_at, notes, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
     RETURNING *`,
    [
      req.siteId,
      normalizedName,
      String(email || '').trim() || null,
      String(company || '').trim() || null,
      String(website || '').trim() || null,
      normalizedStatus,
      sentAt || null,
      String(notes || '').trim() || null,
    ]
  )
  res.json(rows[0])
})

router.put('/:siteId/cold-emails/:id', auth, verifySite, verifySiteOwner, async (req, res) => {
  const { name, email, company, website, status, sentAt, notes } = req.body
  const normalizedName = toCapitalizedName(name)
  if (!normalizedName) {
    return res.status(400).json({ error: 'Name is required' })
  }
  const { rows } = await pool.query(
    `UPDATE cold_email_prospects
     SET name=$1, email=$2, company=$3, website=$4, status=$5, sent_at=$6, notes=$7, updated_at=NOW()
     WHERE id=$8 AND site_id=$9
     RETURNING *`,
    [
      normalizedName,
      String(email || '').trim() || null,
      String(company || '').trim() || null,
      String(website || '').trim() || null,
      String(status || 'sent').toLowerCase(),
      sentAt || null,
      String(notes || '').trim() || null,
      req.params.id,
      req.siteId,
    ]
  )
  if (!rows[0]) return res.status(404).json({ error: 'Prospect not found' })
  res.json(rows[0])
})

router.delete('/:siteId/cold-emails/:id', auth, verifySite, verifySiteOwner, async (req, res) => {
  await pool.query('DELETE FROM cold_email_prospects WHERE id=$1 AND site_id=$2', [req.params.id, req.siteId])
  res.json({ ok: true })
})

module.exports = router
