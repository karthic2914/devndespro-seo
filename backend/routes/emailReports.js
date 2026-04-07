const express = require('express')
const cron = require('node-cron')
const { pool } = require('../clients')
const { auth, verifySite } = require('../middleware')
const { sendSiteReport, sendRankScanReportEmail } = require('../utils/email')
const { scanSiteKeywordTransitions } = require('../utils/serp')
const { SUPPORTED_ENGINES } = require('../utils/helpers')

const router = express.Router()

function buildRankSummaryAlertMessage(report) {
  if (!report) return 'Weekly rank scan completed.'
  const parts = (report.engines || []).map((e) => `${e.label}: ${e.inFirstPageCount}/${e.checked} on page 1`)
  return `Weekly rank scan completed for ${report.siteName}. ${parts.join(' | ')}.`
}

router.get('/:siteId/email-report', auth, verifySite, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM email_report_settings WHERE site_id=$1 LIMIT 1', [req.siteId])
  res.json(rows[0] || { site_id: req.siteId, enabled: false, recipients: [], send_hour: 8, last_sent_at: null })
})

router.put('/:siteId/email-report', auth, verifySite, async (req, res) => {
  const enabled = !!req.body.enabled
  const recipients = (Array.isArray(req.body.recipients) ? req.body.recipients : [])
    .map(e => String(e).trim().toLowerCase())
    .filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
    .slice(0, 20)
  const sendHour = Math.max(0, Math.min(23, parseInt(req.body.send_hour ?? 8)))
  const { rows } = await pool.query(
    `INSERT INTO email_report_settings (site_id, enabled, recipients, send_hour, updated_at)
     VALUES ($1,$2,$3,$4,NOW())
     ON CONFLICT (site_id) DO UPDATE SET enabled=$2, recipients=$3, send_hour=$4, updated_at=NOW()
     RETURNING *`,
    [req.siteId, enabled, recipients, sendHour]
  )
  res.json(rows[0])
})

router.post('/:siteId/email-report/send-now', auth, verifySite, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM email_report_settings WHERE site_id=$1', [req.siteId])
    const toList = (Array.isArray(req.body.recipients) && req.body.recipients.length)
      ? req.body.recipients
      : (rows[0]?.recipients || [])
    if (!toList.length) return res.status(400).json({ error: 'No recipients configured' })
    await sendSiteReport(req.siteId, toList)
    res.json({ ok: true, sent_to: toList })
  } catch (e) {
    console.error('Email send failed:', e)
    res.status(500).json({ error: e.message || 'Failed to send email' })
  }
})

// Daily cron: runs every hour, sends when send_hour matches UTC hour
cron.schedule('0 * * * *', async () => {
  const hour = new Date().getUTCHours()
  try {
    const { rows } = await pool.query(
      `SELECT site_id, recipients FROM email_report_settings
       WHERE enabled=true
         AND array_length(recipients,1) > 0
         AND send_hour=$1
         AND (last_sent_at IS NULL OR last_sent_at < NOW() - INTERVAL '20 hours')`,
      [hour]
    )
    for (const row of rows) {
      try {
        await sendSiteReport(row.site_id, row.recipients)
        await pool.query('UPDATE email_report_settings SET last_sent_at=NOW() WHERE site_id=$1', [row.site_id])
        console.log(`Report sent: site ${row.site_id} -> ${row.recipients.join(', ')}`)
      } catch (e) {
        console.error(`Report failed site ${row.site_id}:`, e.message)
      }
    }
  } catch (e) {
    console.error('Cron check failed:', e)
  }
})

// Weekly rank scan cron: Sunday 02:20 UTC
cron.schedule('20 2 * * 0', async () => {
  try {
    const { rows: sites } = await pool.query(
      `SELECT s.id FROM sites s WHERE EXISTS (SELECT 1 FROM keywords k WHERE k.site_id=s.id) ORDER BY s.id ASC`
    )

    let totalChecked = 0
    let totalAlerts = 0
    for (const s of sites) {
      try {
        const scan = await scanSiteKeywordTransitions(s.id, SUPPORTED_ENGINES, 30)
        totalChecked += scan.checked
        totalAlerts += scan.alertsCreated

        if (scan.report) {
          await pool.query(
            'INSERT INTO alerts (site_id, type, message, severity) VALUES ($1,$2,$3,$4)',
            [s.id, 'rank-weekly-report', buildRankSummaryAlertMessage(scan.report), 'info']
          )
          const { rows: eRows } = await pool.query('SELECT enabled, recipients FROM email_report_settings WHERE site_id=$1 LIMIT 1', [s.id])
          const cfg = eRows[0]
          const recipients = cfg?.enabled && Array.isArray(cfg?.recipients) && cfg.recipients.length ? cfg.recipients : []
          if (recipients.length) {
            try { await sendRankScanReportEmail(recipients, scan.report) }
            catch (e) { console.error(`Weekly rank scan email failed for site ${s.id}:`, e.message) }
          }
        }
      } catch (e) {
        console.error(`Weekly rank scan failed for site ${s.id}:`, e.message)
      }
    }
    console.log(`Weekly rank scan complete: checks=${totalChecked}, alerts=${totalAlerts}, sites=${sites.length}`)
  } catch (e) {
    console.error('Weekly rank scan cron failed:', e)
  }
})

module.exports = router
