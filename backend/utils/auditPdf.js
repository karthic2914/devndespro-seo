const PDFDocument = require('pdfkit')

function buildAuditPdfBuffer(report) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 46,
        info: {
          Title: 'Technical SEO Audit Report',
          Author: 'Devndespro',
        },
      })

      const chunks = []

      doc.on('data', chunk => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      const checks = Array.isArray(report?.checks) ? report.checks : []
      const crawl = report?.crawl || {}
      const score = Number(report?.score || 0)

      const critical = checks.filter(
        x => String(x?.status || '').toLowerCase() === 'error'
      )

      const warnings = checks.filter(
        x => String(x?.status || '').toLowerCase() === 'warning'
      )

      const passed = checks.filter(
        x => String(x?.status || '').toLowerCase() === 'pass'
      )

      let hostname = 'website'

      try {
        hostname = new URL(
          report?.url || crawl?.finalUrl || ''
        ).hostname.replace(/^www\./, '')
      } catch {}

      function ensureSpace(height = 70) {
        if (doc.y + height > doc.page.height - 55) {
          doc.addPage()
        }
      }

      function section(title) {
        ensureSpace(45)

        doc
          .moveDown(0.6)
          .font('Helvetica-Bold')
          .fontSize(15)
          .fillColor('#111827')
          .text(title)

        doc
          .moveDown(0.25)
          .strokeColor('#E5E7EB')
          .moveTo(46, doc.y)
          .lineTo(doc.page.width - 46, doc.y)
          .stroke()

        doc.moveDown(0.6)
      }

      function drawCheck(item) {
        ensureSpace(70)

        const status = String(item?.status || 'unknown').toLowerCase()

        let statusLabel = status.toUpperCase()
        let statusColor = '#475569'

        if (status === 'pass') {
          statusLabel = 'PASS'
          statusColor = '#15803D'
        } else if (status === 'warning') {
          statusLabel = 'WARNING'
          statusColor = '#B45309'
        } else if (status === 'error') {
          statusLabel = 'CRITICAL'
          statusColor = '#DC2626'
        }

        doc
          .font('Helvetica-Bold')
          .fontSize(10)
          .fillColor(statusColor)
          .text(statusLabel + '   ' + String(item?.check || 'Check').replace(/_/g, ' '))

        if (item?.category) {
          doc
            .font('Helvetica')
            .fontSize(9)
            .fillColor('#64748B')
            .text(
              String(item.category) +
              ' | Impact: ' +
              String(item?.impact || 'N/A')
            )
        }

        if (item?.message) {
          doc
            .font('Helvetica')
            .fontSize(9.5)
            .fillColor('#334155')
            .text(String(item.message))
        }

        doc.moveDown(0.7)
      }

      doc
        .font('Helvetica-Bold')
        .fontSize(22)
        .fillColor('#111827')
        .text('Technical SEO Audit Report')

      doc
        .moveDown(0.25)
        .font('Helvetica')
        .fontSize(11)
        .fillColor('#64748B')
        .text('Website: ' + hostname)

      if (report?.url) {
        doc
          .fontSize(9)
          .fillColor('#2563EB')
          .text(String(report.url))
      }

      doc
        .moveDown(0.4)
        .fontSize(9)
        .fillColor('#64748B')
        .text(
          'Scanned: ' +
          (
            report?.scannedAt
              ? new Date(report.scannedAt).toLocaleString('en-GB')
              : new Date().toLocaleString('en-GB')
          )
        )

      doc.moveDown(1)

      doc
        .font('Helvetica-Bold')
        .fontSize(32)
        .fillColor(
          score >= 80
            ? '#16A34A'
            : score >= 60
              ? '#EA580C'
              : '#DC2626'
        )
        .text(String(score) + '/100')

      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#64748B')
        .text('Overall Site Health Score')

      section('Audit Summary')

      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#334155')
        .text('Checks performed: ' + checks.length)
        .text('Critical issues: ' + critical.length)
        .text('Warnings: ' + warnings.length)
        .text('Passed checks: ' + passed.length)

      section('Crawl Snapshot')

      const crawlRows = [
        ['Status code', crawl.statusCode],
        ['Response time', crawl.responseTimeMs != null ? crawl.responseTimeMs + ' ms' : null],
        ['Word count', crawl.wordCount],
        ['Internal links', crawl.internalLinks],
        ['External links', crawl.externalLinks],
        ['Language', crawl.language],
        ['File size', crawl.fileSizeBytes != null ? crawl.fileSizeBytes + ' bytes' : null],
        ['Final URL', crawl.finalUrl],
      ]

      for (const row of crawlRows) {
        const label = row[0]
        const value = row[1]

        if (value === null || value === undefined || value === '') continue

        ensureSpace(25)

        doc
          .font('Helvetica-Bold')
          .fontSize(9.5)
          .fillColor('#475569')
          .text(label + ': ', { continued: true })

        doc
          .font('Helvetica')
          .fillColor('#111827')
          .text(String(value))
      }

      if (critical.length) {
        section('Critical Issues (' + critical.length + ')')
        critical.forEach(drawCheck)
      }

      if (warnings.length) {
        section('Warnings (' + warnings.length + ')')
        warnings.forEach(drawCheck)
      }

      if (passed.length) {
        section('Passed Checks (' + passed.length + ')')
        passed.forEach(drawCheck)
      }

      ensureSpace(80)

      doc.moveDown(1)

      doc
        .strokeColor('#E5E7EB')
        .moveTo(46, doc.y)
        .lineTo(doc.page.width - 46, doc.y)
        .stroke()

      doc.moveDown(0.7)

      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#111827')
        .text('Devndespro - Web Development & SEO')

      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#64748B')
        .text('www.devndespro.com')
        .text('seo.devndespro.com')

      doc.end()

    } catch (error) {
      reject(error)
    }
  })
}

module.exports = {
  buildAuditPdfBuffer,
}
