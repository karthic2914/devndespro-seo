const express = require('express')
const { pool } = require('../clients')
const { auth, verifySite } = require('../middleware')

const router = express.Router()

async function verifySiteOwner(req, res, next) {
  const { rows } = await pool.query('SELECT user_id FROM sites WHERE id=$1 LIMIT 1', [req.siteId])
  if (!rows[0] || Number(rows[0].user_id) !== Number(req.user.id)) {
    return res.status(403).json({ error: 'Only the site owner can access cold email prospects' })
  }
  next()
}

router.get('/:siteId/cold-emails', auth, verifySite, verifySiteOwner, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM cold_email_prospects WHERE site_id=$1 ORDER BY created_at DESC',
    [req.siteId]
  )
  res.json(rows)
})

router.post('/:siteId/cold-emails', auth, verifySite, verifySiteOwner, async (req, res) => {
  const { name, email, company, website, status, sentAt, notes } = req.body
  if (!String(name || '').trim()) {
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
      String(name).trim(),
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
  const { rows } = await pool.query(
    `UPDATE cold_email_prospects
     SET name=$1, email=$2, company=$3, website=$4, status=$5, sent_at=$6, notes=$7, updated_at=NOW()
     WHERE id=$8 AND site_id=$9
     RETURNING *`,
    [
      String(name || '').trim(),
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
