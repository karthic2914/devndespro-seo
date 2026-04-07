const nodemailer = require('nodemailer')
const { pool } = require('../clients')
const { engineLabel } = require('./helpers')

function createTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })
}

function buildRankScanEmailHtml(report) {
  const generatedAt = new Date(report.generatedAt || Date.now()).toLocaleString('en-GB')
  const engineRows = (report.engines || []).map(e => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#1e293b">${e.label}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center;color:#1e293b">${e.inFirstPageCount}/${e.checked}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center;color:#16a34a">+${e.enteredCount}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center;color:#dc2626">-${e.droppedCount}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center;color:#64748b">${e.avgPosition ?? '&mdash;'}</td>
    </tr>
  `).join('')

  const transitionRows = (report.transitions || []).slice(0, 14).map(t => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#1e293b">${t.keyword}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center;color:#475569">${engineLabel(t.engine)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center;color:${t.action === 'entered' ? '#16a34a' : '#dc2626'};font-weight:700">${t.action === 'entered' ? 'Entered' : 'Dropped'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center;color:#64748b">${t.prevPosition ?? '&mdash;'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center;color:#1e293b">${t.currentPosition ?? '&mdash;'}</td>
    </tr>
  `).join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:700px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
  <div style="background:linear-gradient(135deg,#1e3a8a,#1d4ed8);padding:26px 30px;color:#fff">
    <h1 style="margin:0 0 6px;font-size:22px;font-weight:700">Weekly Rank Scan Report</h1>
    <p style="margin:0;opacity:.9;font-size:14px">${report.siteName} &middot; ${report.siteDomain}</p>
    <p style="margin:8px 0 0;opacity:.75;font-size:12px">Generated ${generatedAt}</p>
  </div>
  <div style="padding:24px 30px">
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px">
      <div style="flex:1;min-width:130px;background:#f8fafc;border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:24px;font-weight:700;color:#1e293b">${report.checkedKeywords}</div>
        <div style="font-size:12px;color:#64748b">Keywords Checked</div>
      </div>
      <div style="flex:1;min-width:130px;background:#f8fafc;border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:24px;font-weight:700;color:#16a34a">${(report.transitions || []).filter(t => t.action === 'entered').length}</div>
        <div style="font-size:12px;color:#64748b">Entered Page 1</div>
      </div>
      <div style="flex:1;min-width:130px;background:#f8fafc;border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:24px;font-weight:700;color:#dc2626">${(report.transitions || []).filter(t => t.action === 'dropped').length}</div>
        <div style="font-size:12px;color:#64748b">Dropped from Page 1</div>
      </div>
      <div style="flex:1;min-width:130px;background:#f8fafc;border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:24px;font-weight:700;color:#2563eb">${report.alertsCreated || 0}</div>
        <div style="font-size:12px;color:#64748b">Alerts Created</div>
      </div>
    </div>
    <h2 style="margin:0 0 12px;font-size:16px;color:#1e293b">Coverage by Search Engine</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:22px">
      <thead><tr style="background:#f8fafc">
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase">Engine</th>
        <th style="padding:8px 12px;text-align:center;font-size:12px;color:#64748b;text-transform:uppercase">Page 1 Coverage</th>
        <th style="padding:8px 12px;text-align:center;font-size:12px;color:#64748b;text-transform:uppercase">Entered</th>
        <th style="padding:8px 12px;text-align:center;font-size:12px;color:#64748b;text-transform:uppercase">Dropped</th>
        <th style="padding:8px 12px;text-align:center;font-size:12px;color:#64748b;text-transform:uppercase">Avg Pos</th>
      </tr></thead>
      <tbody>${engineRows}</tbody>
    </table>
    <h2 style="margin:0 0 12px;font-size:16px;color:#1e293b">Transitions</h2>
    ${(report.transitions || []).length ? `
      <table style="width:100%;border-collapse:collapse;margin-bottom:10px">
        <thead><tr style="background:#f8fafc">
          <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase">Keyword</th>
          <th style="padding:8px 12px;text-align:center;font-size:12px;color:#64748b;text-transform:uppercase">Engine</th>
          <th style="padding:8px 12px;text-align:center;font-size:12px;color:#64748b;text-transform:uppercase">Action</th>
          <th style="padding:8px 12px;text-align:center;font-size:12px;color:#64748b;text-transform:uppercase">Prev</th>
          <th style="padding:8px 12px;text-align:center;font-size:12px;color:#64748b;text-transform:uppercase">Now</th>
        </tr></thead>
        <tbody>${transitionRows}</tbody>
      </table>
    ` : `<p style="margin:0;color:#64748b;font-size:14px">No page-1 transitions this week. Rankings were stable.</p>`}
  </div>
</div>
</body>
</html>`
}

async function sendRankScanReportEmail(recipients, report) {
  const transporter = createTransporter()
  if (!transporter) throw new Error('SMTP not configured. Add SMTP_HOST, SMTP_USER, SMTP_PASS to .env')
  await transporter.sendMail({
    from: process.env.SMTP_FROM || `"SEO Reports" <${process.env.SMTP_USER}>`,
    to: recipients.join(', '),
    subject: `Weekly Rank Scan — ${report.siteName} (${new Date().toLocaleDateString('en-GB')})`,
    html: buildRankScanEmailHtml(report),
  })
}

function buildEmailHtml({ siteName, siteUrl, date, metrics, keywords, backlinks, actions, competitors, alerts }) {
  const dr = metrics?.dr ?? 0
  const health = metrics?.health ?? 0
  const clicks = metrics?.clicks ?? 0
  const impressions = metrics?.impressions ?? 0
  const topKeywords = (keywords || []).slice(0, 10)
  const liveBacklinks = (backlinks || []).filter(b => b.status === 'Live')
  const pendingActions = (actions || []).filter(a => !a.done)
  const doneActions = (actions || []).filter(a => a.done)
  const recentAlerts = (alerts || []).filter(a => !a.read).slice(0, 5)
  const healthColor = health >= 80 ? '#22c55e' : health >= 60 ? '#f97316' : '#ef4444'
  const drColor = dr >= 40 ? '#22c55e' : dr >= 20 ? '#f97316' : '#ef4444'

  const kRows = topKeywords.map(k => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#1e293b">${k.keyword}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center;font-weight:600;color:${k.position <= 10 ? '#22c55e' : k.position <= 30 ? '#f97316' : '#94a3b8'}">${k.position != null ? '#' + k.position : '&mdash;'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center;color:#64748b">${k.volume ? Number(k.volume).toLocaleString() : '&mdash;'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center"><span style="background:${k.difficulty === 'Easy' ? '#dcfce7' : k.difficulty === 'Medium' ? '#fef3c7' : '#fee2e2'};color:${k.difficulty === 'Easy' ? '#166534' : k.difficulty === 'Medium' ? '#92400e' : '#991b1b'};padding:2px 8px;border-radius:99px;font-size:12px">${k.difficulty || '&mdash;'}</span></td>
    </tr>`).join('')

  const blRows = liveBacklinks.slice(0, 10).map(b => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#1e293b">${b.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center;font-weight:600;color:#f97316">DR ${b.dr || 0}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center"><span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:99px;font-size:12px">${b.type === 'dofollow' ? 'Dofollow' : 'Nofollow'}</span></td>
    </tr>`).join('')

  const actionRows = pendingActions.slice(0, 8).map(a => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#1e293b"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${a.impact === 'High' || a.impact === 'Critical' ? '#f97316' : a.impact === 'Medium' ? '#eab308' : '#94a3b8'};margin-right:8px;vertical-align:middle"></span>${a.text}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center"><span style="background:${a.impact === 'High' || a.impact === 'Critical' ? '#fff7ed' : a.impact === 'Medium' ? '#fefce8' : '#f8fafc'};color:${a.impact === 'High' || a.impact === 'Critical' ? '#c2410c' : a.impact === 'Medium' ? '#a16207' : '#64748b'};padding:2px 8px;border-radius:99px;font-size:12px">${a.impact || 'Medium'}</span></td>
    </tr>`).join('')

  const competitorRows = (competitors || []).slice(0, 6).map(c => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#1e293b">${c.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center;font-weight:600;color:#f97316">DR ${c.dr || 0}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:13px">${c.notes || '&mdash;'}</td>
    </tr>`).join('')

  const alertRows = recentAlerts.map(a => `
    <div style="padding:10px 14px;border-left:3px solid ${a.severity === 'danger' ? '#ef4444' : a.severity === 'warning' ? '#f97316' : '#3b82f6'};background:${a.severity === 'danger' ? '#fef2f2' : a.severity === 'warning' ? '#fff7ed' : '#eff6ff'};margin-bottom:8px;border-radius:0 6px 6px 0">
      <p style="margin:0;color:${a.severity === 'danger' ? '#991b1b' : a.severity === 'warning' ? '#9a3412' : '#1d4ed8'};font-size:14px">${a.message}</p>
    </div>`).join('')

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:660px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
  <div style="background:linear-gradient(135deg,#1e1b2e,#2d1b69);padding:28px 32px;color:#fff">
    <h1 style="margin:0 0 4px;font-size:22px;font-weight:700">Daily SEO Report</h1>
    <p style="margin:0;opacity:.8;font-size:14px">${siteName} &middot; ${siteUrl}</p>
    <p style="margin:8px 0 0;opacity:.6;font-size:13px">${date}</p>
  </div>
  <div style="padding:28px 32px">
    <div style="display:flex;gap:12px;margin-bottom:28px;flex-wrap:wrap">
      <div style="flex:1;min-width:110px;background:#f8fafc;border-radius:10px;padding:16px 14px;text-align:center">
        <div style="font-size:26px;font-weight:700;color:${drColor}">${dr}</div>
        <div style="font-size:12px;color:#64748b;margin-top:4px">Domain Rating</div>
      </div>
      <div style="flex:1;min-width:110px;background:#f8fafc;border-radius:10px;padding:16px 14px;text-align:center">
        <div style="font-size:26px;font-weight:700;color:${healthColor}">${health}%</div>
        <div style="font-size:12px;color:#64748b;margin-top:4px">Site Health</div>
      </div>
      <div style="flex:1;min-width:110px;background:#f8fafc;border-radius:10px;padding:16px 14px;text-align:center">
        <div style="font-size:26px;font-weight:700;color:#3b82f6">${Number(clicks).toLocaleString()}</div>
        <div style="font-size:12px;color:#64748b;margin-top:4px">Clicks</div>
      </div>
      <div style="flex:1;min-width:110px;background:#f8fafc;border-radius:10px;padding:16px 14px;text-align:center">
        <div style="font-size:26px;font-weight:700;color:#8b5cf6">${Number(impressions).toLocaleString()}</div>
        <div style="font-size:12px;color:#64748b;margin-top:4px">Impressions</div>
      </div>
      <div style="flex:1;min-width:110px;background:#f8fafc;border-radius:10px;padding:16px 14px;text-align:center">
        <div style="font-size:26px;font-weight:700;color:#22c55e">${doneActions.length}</div>
        <div style="font-size:12px;color:#64748b;margin-top:4px">Actions Done</div>
      </div>
      <div style="flex:1;min-width:110px;background:#f8fafc;border-radius:10px;padding:16px 14px;text-align:center">
        <div style="font-size:26px;font-weight:700;color:#f97316">${pendingActions.length}</div>
        <div style="font-size:12px;color:#64748b;margin-top:4px">Pending Actions</div>
      </div>
    </div>

    ${topKeywords.length ? `
    <h2 style="margin:0 0 12px;font-size:16px;color:#1e293b;border-bottom:2px solid #f1f5f9;padding-bottom:8px">Keywords (${topKeywords.length})</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:28px">
      <thead><tr style="background:#f8fafc">
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase">Keyword</th>
        <th style="padding:8px 12px;text-align:center;font-size:12px;color:#64748b;text-transform:uppercase">Position</th>
        <th style="padding:8px 12px;text-align:center;font-size:12px;color:#64748b;text-transform:uppercase">Volume</th>
        <th style="padding:8px 12px;text-align:center;font-size:12px;color:#64748b;text-transform:uppercase">Difficulty</th>
      </tr></thead>
      <tbody>${kRows}</tbody>
    </table>` : ''}

    ${liveBacklinks.length ? `
    <h2 style="margin:0 0 12px;font-size:16px;color:#1e293b;border-bottom:2px solid #f1f5f9;padding-bottom:8px">Live Backlinks (${liveBacklinks.length})</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:28px">
      <thead><tr style="background:#f8fafc">
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase">Domain</th>
        <th style="padding:8px 12px;text-align:center;font-size:12px;color:#64748b;text-transform:uppercase">DR</th>
        <th style="padding:8px 12px;text-align:center;font-size:12px;color:#64748b;text-transform:uppercase">Type</th>
      </tr></thead>
      <tbody>${blRows}</tbody>
    </table>` : ''}

    ${pendingActions.length ? `
    <h2 style="margin:0 0 12px;font-size:16px;color:#1e293b;border-bottom:2px solid #f1f5f9;padding-bottom:8px">Open SEO Actions (${pendingActions.length})</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:28px">
      <thead><tr style="background:#f8fafc">
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase">Action</th>
        <th style="padding:8px 12px;text-align:center;font-size:12px;color:#64748b;text-transform:uppercase">Impact</th>
      </tr></thead>
      <tbody>${actionRows}</tbody>
    </table>` : ''}

    ${competitors && competitors.length ? `
    <h2 style="margin:0 0 12px;font-size:16px;color:#1e293b;border-bottom:2px solid #f1f5f9;padding-bottom:8px">Competitors (${competitors.length})</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:28px">
      <thead><tr style="background:#f8fafc">
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase">Name</th>
        <th style="padding:8px 12px;text-align:center;font-size:12px;color:#64748b;text-transform:uppercase">DR</th>
        <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;text-transform:uppercase">Notes</th>
      </tr></thead>
      <tbody>${competitorRows}</tbody>
    </table>` : ''}

    ${recentAlerts.length ? `
    <h2 style="margin:0 0 12px;font-size:16px;color:#1e293b;border-bottom:2px solid #f1f5f9;padding-bottom:8px">Unread Alerts</h2>
    <div style="margin-bottom:28px">${alertRows}</div>` : ''}

  </div>
  <div style="background:#f1f5f9;padding:18px 32px;text-align:center">
    <p style="margin:0;font-size:13px;color:#64748b">Daily SEO Report for <strong>${siteName}</strong></p>
    <p style="margin:6px 0 0;font-size:12px;color:#94a3b8">Manage email settings in your SEO tool &rarr; Email Reports</p>
  </div>
</div>
</body>
</html>`
}

async function sendSiteReport(siteId, recipients) {
  const transporter = createTransporter()
  if (!transporter) throw new Error('SMTP not configured. Add SMTP_HOST, SMTP_USER, SMTP_PASS to .env')
  const [siteR, metricsR, keywordsR, backlinksR, actionsR, competitorsR, alertsR] = await Promise.all([
    pool.query('SELECT name, url FROM sites WHERE id=$1', [siteId]),
    pool.query('SELECT dr, clicks, impressions, health FROM seo_metrics WHERE site_id=$1 LIMIT 1', [siteId]),
    pool.query('SELECT keyword, volume, difficulty, position FROM keywords WHERE site_id=$1 ORDER BY COALESCE(volume,0) DESC LIMIT 20', [siteId]),
    pool.query('SELECT name, dr, status, type FROM backlinks WHERE site_id=$1', [siteId]),
    pool.query('SELECT text, impact, done FROM actions WHERE site_id=$1 ORDER BY done ASC, created_at DESC', [siteId]),
    pool.query('SELECT name, dr, notes FROM competitors WHERE site_id=$1 ORDER BY dr DESC LIMIT 10', [siteId]),
    pool.query('SELECT * FROM alerts WHERE site_id=$1 AND read=false ORDER BY created_at DESC LIMIT 10', [siteId]),
  ])
  const site = siteR.rows[0]
  if (!site) throw new Error('Site not found')
  const html = buildEmailHtml({
    siteName: site.name, siteUrl: site.url,
    date: new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    metrics: metricsR.rows[0],
    keywords: keywordsR.rows,
    backlinks: backlinksR.rows,
    actions: actionsR.rows,
    competitors: competitorsR.rows,
    alerts: alertsR.rows,
  })
  await transporter.sendMail({
    from: process.env.SMTP_FROM || `"SEO Reports" <${process.env.SMTP_USER}>`,
    to: recipients.join(', '),
    subject: `Daily SEO Report — ${site.name} (${new Date().toLocaleDateString('en-GB')})`,
    html,
  })
}

module.exports = { createTransporter, buildRankScanEmailHtml, sendRankScanReportEmail, buildEmailHtml, sendSiteReport }
