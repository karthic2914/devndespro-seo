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
  const parts = (report.engines || []).map(e => `${e.label}: ${e.inFirstPageCount}/${e.checked} on page 1`)
  return `Weekly rank scan completed for ${report.siteName}. ${parts.join(' | ')}.`
}

function normalizeSchedule(body = {}) {
  const requestedFrequency = String(body.frequency || 'daily').toLowerCase()
  const frequency = ['daily', 'weekly', 'monthly'].includes(requestedFrequency)
    ? requestedFrequency
    : 'daily'
  const sendHour = Math.max(0, Math.min(23, Number.parseInt(body.send_hour ?? 8, 10)))
  const sendWeekday = Math.max(0, Math.min(6, Number.parseInt(body.send_weekday ?? 1, 10)))
  const sendMonthDay = Math.max(1, Math.min(28, Number.parseInt(body.send_month_day ?? 1, 10)))
  return { frequency, sendHour, sendWeekday, sendMonthDay }
}

router.get('/:siteId/email-report', auth, verifySite, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM email_report_settings WHERE site_id=$1 LIMIT 1',
    [req.siteId]
  )

  res.json(rows[0] || {
    site_id: req.siteId,
    enabled: false,
    recipients: [],
    send_hour: 8,
    frequency: 'daily',
    send_weekday: 1,
    send_month_day: 1,
    last_sent_at: null,
  })
})

router.put('/:siteId/email-report', auth, verifySite, async (req, res) => {
  const enabled = !!req.body.enabled
  const recipients = (Array.isArray(req.body.recipients) ? req.body.recipients : [])
    .map(email => String(email).trim().toLowerCase())
    .filter(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    .slice(0, 20)
  const { frequency, sendHour, sendWeekday, sendMonthDay } = normalizeSchedule(req.body)

  const { rows } = await pool.query(
    `INSERT INTO email_report_settings
      (site_id, enabled, recipients, send_hour, frequency, send_weekday, send_month_day, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
     ON CONFLICT (site_id) DO UPDATE SET
       enabled=$2,
       recipients=$3,
       send_hour=$4,
       frequency=$5,
       send_weekday=$6,
       send_month_day=$7,
       updated_at=NOW()
     RETURNING *`,
    [req.siteId, enabled, recipients, sendHour, frequency, sendWeekday, sendMonthDay]
  )

  res.json(rows[0])
})

router.post('/:siteId/email-report/send-now', auth, verifySite, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM email_report_settings WHERE site_id=$1',
      [req.siteId]
    )
    const toList = Array.isArray(req.body.recipients) && req.body.recipients.length
      ? req.body.recipients
      : (rows[0]?.recipients || [])
    if (!toList.length) return res.status(400).json({ error: 'No recipients configured' })

    await sendSiteReport(req.siteId, toList)
    res.json({ ok: true, sent_to: toList })
  } catch (error) {
    console.error('Email send failed:', error)
    res.status(500).json({ error: error.message || 'Failed to send email' })
  }
})

// Runs hourly. UTC is used consistently for the selected day and time.
cron.schedule('0 * * * *', async () => {
  const now = new Date()
  const hour = now.getUTCHours()
  const weekday = now.getUTCDay()
  const monthDay = now.getUTCDate()

  try {
    const { rows } = await pool.query(
      `SELECT site_id, recipients
       FROM email_report_settings
       WHERE enabled=true
         AND array_length(recipients,1) > 0
         AND send_hour=$1
         AND (
           COALESCE(frequency, 'daily')='daily'
           OR (frequency='weekly' AND send_weekday=$2)
           OR (frequency='monthly' AND send_month_day=$3)
         )
         AND (last_sent_at IS NULL OR last_sent_at < NOW() - INTERVAL '20 hours')`,
      [hour, weekday, monthDay]
    )

    for (const row of rows) {
      try {
        await sendSiteReport(row.site_id, row.recipients)
        await pool.query(
          'UPDATE email_report_settings SET last_sent_at=NOW() WHERE site_id=$1',
          [row.site_id]
        )
        console.log(`Report sent: site ${row.site_id} -> ${row.recipients.join(', ')}`)
      } catch (error) {
        console.error(`Report failed site ${row.site_id}:`, error.message)
      }
    }
  } catch (error) {
    console.error('Cron check failed:', error)
  }
})

// Weekly rank scan cron: Sunday 02:20 UTC
cron.schedule('20 2 * * 0', async () => {
  try {
    const { rows: sites } = await pool.query(
      `SELECT s.id FROM sites s
       WHERE EXISTS (SELECT 1 FROM keywords k WHERE k.site_id=s.id)
       ORDER BY s.id ASC`
    )
    let totalChecked = 0
    let totalAlerts = 0

    for (const site of sites) {
      try {
        const scan = await scanSiteKeywordTransitions(site.id, SUPPORTED_ENGINES, 30)
        totalChecked += scan.checked
        totalAlerts += scan.alertsCreated

        if (scan.report) {
          await pool.query(
            'INSERT INTO alerts (site_id, type, message, severity) VALUES ($1,$2,$3,$4)',
            [site.id, 'rank-weekly-report', buildRankSummaryAlertMessage(scan.report), 'info']
          )
          const { rows: emailRows } = await pool.query(
            'SELECT enabled, recipients FROM email_report_settings WHERE site_id=$1 LIMIT 1',
            [site.id]
          )
          const config = emailRows[0]
          const recipients = config?.enabled
            && Array.isArray(config?.recipients)
            && config.recipients.length
            ? config.recipients
            : []

          if (recipients.length) {
            try {
              await sendRankScanReportEmail(recipients, scan.report)
            } catch (error) {
              console.error(`Weekly rank scan email failed for site ${site.id}:`, error.message)
            }
          }
        }
      } catch (error) {
        console.error(`Weekly rank scan failed for site ${site.id}:`, error.message)
      }
    }

    console.log(`Weekly rank scan complete: checks=${totalChecked}, alerts=${totalAlerts}, sites=${sites.length}`)
  } catch (error) {
    console.error('Weekly rank scan cron failed:', error)
  }
})

module.exports = router