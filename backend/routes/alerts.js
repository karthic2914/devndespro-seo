const express = require('express')
const { pool } = require('../clients')
const { auth, verifySite } = require('../middleware')

// Site-scoped alert routes (mounted at /api/sites)
const siteRouter = express.Router()

siteRouter.get('/:siteId/alerts', auth, verifySite, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM alerts WHERE site_id=$1 ORDER BY created_at DESC LIMIT 50', [req.siteId])
  res.json(rows)
})

siteRouter.put('/:siteId/alerts/read-all', auth, verifySite, async (req, res) => {
  await pool.query('UPDATE alerts SET read=true WHERE site_id=$1', [req.siteId])
  res.json({ ok: true })
})

// Global alert routes (mounted at /api/alerts), e.g. PUT /api/alerts/:id/read
const globalRouter = express.Router()

globalRouter.put('/:id/read', auth, async (req, res) => {
  await pool.query('UPDATE alerts SET read=true WHERE id=$1', [req.params.id])
  res.json({ ok: true })
})

module.exports = { siteRouter, globalRouter }
