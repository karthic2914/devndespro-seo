const PDFDocument = require('pdfkit')

const AUDIT_PDF_VERSION = 'premium-v2'

const CHECK_GUIDANCE = {
  content: {
    title: 'Content depth could be improved',
    why: 'Thin pages may struggle to demonstrate relevance, expertise and enough value for visitors.',
    fix: 'Expand the page with original, useful content that directly answers the visitor’s main questions.',
    effort: 'Medium',
  },

  canonical: {
    title: 'Canonical URL missing',
    why: 'Canonical tags help search engines identify the preferred version of a page.',
    fix: 'Add a self-referencing canonical link tag to the preferred URL.',
    effort: 'Low',
  },

  img_alt: {
    title: 'Image alternative text missing',
    why: 'Alt text improves accessibility and helps search engines understand meaningful images.',
    fix: 'Add concise descriptive alt text to meaningful images.',
    effort: 'Low',
  },

  schema: {
    title: 'Structured data missing',
    why: 'Structured data helps search systems understand page entities and content type.',
    fix: 'Add relevant JSON-LD structured data that accurately represents the page.',
    effort: 'Medium',
  },

  render_blocking: {
    title: 'Render-blocking resources detected',
    why: 'Blocking CSS or JavaScript can delay the initial rendering of the page.',
    fix: 'Defer non-critical JavaScript, review critical CSS and optimise asset loading.',
    effort: 'Medium',
  },

  modern_images: {
    title: 'Modern image formats opportunity',
    why: 'Legacy image formats can increase page weight and slow loading.',
    fix: 'Use suitable WebP or AVIF versions and compress images appropriately.',
    effort: 'Low',
  },

  robots_txt: {
    title: 'robots.txt configuration issue',
    why: 'Invalid crawler instructions can make crawling and indexing less reliable.',
    fix: 'Ensure /robots.txt returns valid plain text with appropriate crawler directives.',
    effort: 'Low',
  },

  custom_404: {
    title: 'Incorrect 404 handling',
    why: 'Returning HTTP 200 for missing URLs can confuse search engines and waste crawl resources.',
    fix: 'Return HTTP 404 or 410 for URLs that do not exist.',
    effort: 'Low',
  },

  aeo_author_entity: {
    title: 'Author and entity signals could be clearer',
    why: 'Clear authorship and organisation information can strengthen attribution and trust signals.',
    fix: 'Add visible author or organisation details and relevant structured data.',
    effort: 'Medium',
  },

  aeo_eeat: {
    title: 'Trust and expertise signals could be stronger',
    why: 'Clear experience, expertise and credibility signals help users and search systems assess content quality.',
    fix: 'Strengthen author bios, company details, credentials, references and trust signals.',
    effort: 'Medium',
  },

  aeo_bing_index: {
    title: 'Bing visibility should be reviewed',
    why: 'Visibility across major search engines increases discovery opportunities.',
    fix: 'Verify indexing in Bing Webmaster Tools and investigate missing important pages.',
    effort: 'Low',
  },

  aeo_citations: {
    title: 'Authoritative references could be improved',
    why: 'Relevant references can strengthen factual credibility.',
    fix: 'Reference trustworthy and directly relevant external sources where appropriate.',
    effort: 'Low',
  },

  aeo_reviews: {
    title: 'External reputation signals could be stronger',
    why: 'Independent reviews and third-party mentions can support brand credibility.',
    fix: 'Build a legitimate review strategy on platforms relevant to the business.',
    effort: 'Medium',
  },

  snippet_faq_schema: {
    title: 'FAQ content opportunity',
    why: 'Clear question-and-answer content can make important information easier to understand.',
    fix: 'Where appropriate, add useful FAQ content and valid FAQ structured data.',
    effort: 'Medium',
  },

  snippet_howto_schema: {
    title: 'How-to content opportunity',
    why: 'Step-by-step content can improve clarity for instructional searches.',
    fix: 'Structure relevant instructional content into clear sequential steps.',
    effort: 'Medium',
  },

  snippet_article_schema: {
    title: 'Article structured data opportunity',
    why: 'Article metadata can clarify authorship, publishing details and content type.',
    fix: 'For editorial content, add valid Article or BlogPosting structured data.',
    effort: 'Low',
  },

  snippet_question_headings: {
    title: 'Question-based headings opportunity',
    why: 'Question-led sections make answers easier to scan and interpret.',
    fix: 'Use natural question-based H2/H3 headings followed by direct answers.',
    effort: 'Low',
  },

  snippet_ready: {
    title: 'Direct-answer content could be improved',
    why: 'Concise answers near headings make important information easier to consume.',
    fix: 'Add short, accurate answer paragraphs below important informational headings.',
    effort: 'Low',
  },

  snippet_answer_density: {
    title: 'More concise answer blocks may help',
    why: 'Direct explanatory paragraphs can improve clarity and answer coverage.',
    fix: 'Add concise answer blocks where they improve the reader experience.',
    effort: 'Low',
  },
}

function cleanAuditMessage(message = '') {
  let text = String(message || '')

  text = text.replace(/<script[\s\S]*?<\/script>/gi, ' ')
  text = text.replace(/<style[\s\S]*?<\/style>/gi, ' ')
  text = text.replace(/<[^>]+>/g, ' ')
  text = text.replace(/<!doctype[^>]*>/gi, ' ')
  text = text.replace(/__next[^ ]*/gi, ' ')
  text = text.replace(/\s+/g, ' ').trim()

  const max = 280

  if (text.length > max) {
    text = text.slice(0, max - 3).trimEnd() + '...'
  }

  return text || 'The audit detected a finding that should be reviewed.'
}

function humanizeCheckName(check = '') {
  const guidance = CHECK_GUIDANCE[check]

  if (guidance?.title) return guidance.title

  return String(check || 'Audit finding')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase())
}

function getGuidance(item = {}) {
  const guidance = CHECK_GUIDANCE[item.check] || {}

  return {
    title: guidance.title || humanizeCheckName(item.check),
    why:
      guidance.why ||
      'This finding may affect search visibility, usability or how search systems interpret the page.',
    fix:
      guidance.fix ||
      'Review the finding and apply the appropriate technical or content improvement.',
    effort: guidance.effort || 'Medium',
  }
}

function severityWeight(item = {}) {
  const status = String(item.status || '').toLowerCase()
  const impact = String(item.impact || '').toLowerCase()

  let score = 0

  if (status === 'error') score += 100
  else if (status === 'warning') score += 50

  if (impact === 'critical') score += 40
  else if (impact === 'high') score += 30
  else if (impact === 'medium') score += 20
  else if (impact === 'low') score += 10

  return score
}

function categoryScore(checks, category) {
  const rows = checks.filter(
    item => String(item?.category || '').toLowerCase() === String(category).toLowerCase()
  )

  if (!rows.length) return null

  const passCount = rows.filter(
    item => String(item?.status || '').toLowerCase() === 'pass'
  ).length

  return Math.round((passCount / rows.length) * 100)
}

function buildAuditPdfBuffer(report) {
  console.log(
    'AUDIT PDF GENERATOR:',
    AUDIT_PDF_VERSION,
    '| URL:',
    report?.url || report?.crawl?.finalUrl || 'unknown'
  )
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 42,
        info: {
          Title: 'SEO Audit Report',
          Author: 'Devndespro',
          Subject: 'SEO, technical and AI visibility audit',
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
        item => String(item?.status || '').toLowerCase() === 'error'
      )

      const warnings = checks.filter(
        item => String(item?.status || '').toLowerCase() === 'warning'
      )

      const passed = checks.filter(
        item => String(item?.status || '').toLowerCase() === 'pass'
      )

      const actionable = checks
        .filter(item => {
          const status = String(item?.status || '').toLowerCase()
          return status === 'error' || status === 'warning'
        })
        .sort((a, b) => severityWeight(b) - severityWeight(a))

      const topPriorities = actionable.slice(0, 5)

      const quickWins = actionable
        .filter(item => getGuidance(item).effort === 'Low')
        .slice(0, 4)

      const reportUrl = String(
        report?.url ||
        crawl?.finalUrl ||
        ''
      )

      let hostname = 'Website'

      try {
        hostname = new URL(reportUrl)
          .hostname
          .replace(/^www\./, '')
      } catch {}

      function ensureSpace(height = 70) {
        if (doc.y + height > doc.page.height - 55) {
          doc.addPage()
        }
      }

      function divider() {
        doc
          .strokeColor('#E5E7EB')
          .lineWidth(1)
          .moveTo(42, doc.y)
          .lineTo(doc.page.width - 42, doc.y)
          .stroke()
      }

      function section(title, subtitle = null) {
        ensureSpace(55)

        doc.moveDown(0.7)

        doc
          .font('Helvetica-Bold')
          .fontSize(15)
          .fillColor('#111827')
          .text(title)

        if (subtitle) {
          doc
            .moveDown(0.15)
            .font('Helvetica')
            .fontSize(9)
            .fillColor('#64748B')
            .text(subtitle)
        }

        doc.moveDown(0.35)
        divider()
        doc.moveDown(0.65)
      }

      function badge(text, fill, textColor = '#FFFFFF', width = 78) {
        const x = doc.x
        const y = doc.y

        doc
          .roundedRect(x, y, width, 18, 5)
          .fill(fill)

        doc
          .fillColor(textColor)
          .font('Helvetica-Bold')
          .fontSize(8)
          .text(text, x, y + 5, {
            width,
            align: 'center',
          })

        doc.y = y + 23
      }

      function metricCard(x, y, width, label, value, accent) {
        doc
          .roundedRect(x, y, width, 65, 8)
          .fill('#F8FAFC')

        doc
          .fillColor(accent)
          .font('Helvetica-Bold')
          .fontSize(20)
          .text(String(value), x + 10, y + 12, {
            width: width - 20,
            align: 'center',
          })

        doc
          .fillColor('#64748B')
          .font('Helvetica')
          .fontSize(8.5)
          .text(label, x + 8, y + 40, {
            width: width - 16,
            align: 'center',
          })
      }

      function progressBar(label, value) {
        ensureSpace(32)

        const x = doc.x
        const y = doc.y
        const width = 250

        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor('#334155')
          .text(label, x, y)

        doc
          .font('Helvetica')
          .fillColor('#64748B')
          .text(String(value) + '%', x + 260, y)

        doc
          .roundedRect(x, y + 14, width, 7, 4)
          .fill('#E5E7EB')

        doc
          .roundedRect(
            x,
            y + 14,
            Math.max(4, width * Math.max(0, Math.min(100, value)) / 100),
            7,
            4
          )
          .fill(
            value >= 80
              ? '#16A34A'
              : value >= 60
                ? '#F97316'
                : '#DC2626'
          )

        doc.y = y + 30
      }

      function drawPriority(item, index) {
        ensureSpace(92)

        const guidance = getGuidance(item)

        const x = doc.x
        const y = doc.y
        const width = 505

        doc
          .roundedRect(x, y, width, 82, 8)
          .fill('#F8FAFC')

        doc
          .font('Helvetica-Bold')
          .fontSize(10)
          .fillColor('#111827')
          .text(
            String(index + 1) + '. ' + guidance.title,
            x + 12,
            y + 10,
            { width: width - 24 }
          )

        doc
          .font('Helvetica')
          .fontSize(8.5)
          .fillColor('#64748B')
          .text(
            'Impact: ' + String(item?.impact || 'Medium') +
            '   |   Effort: ' + guidance.effort +
            '   |   ' + String(item?.category || 'SEO'),
            x + 12,
            y + 28,
            { width: width - 24 }
          )

        doc
          .font('Helvetica-Bold')
          .fillColor('#166534')
          .text('Recommended action: ', x + 12, y + 46, {
            continued: true,
          })

        doc
          .font('Helvetica')
          .fillColor('#334155')
          .text(guidance.fix, {
            width: width - 24,
          })

        doc.y = y + 91
      }

      function drawQuickWin(item, index) {
        ensureSpace(52)

        const guidance = getGuidance(item)

        doc
          .font('Helvetica-Bold')
          .fontSize(10)
          .fillColor('#166534')
          .text('QUICK WIN ' + String(index + 1), {
            continued: true,
          })

        doc
          .fillColor('#111827')
          .text('   ' + guidance.title)

        doc
          .font('Helvetica')
          .fontSize(8.8)
          .fillColor('#475569')
          .text(guidance.fix)

        doc.moveDown(0.5)
      }

      function drawIssue(item) {
        ensureSpace(142)

        const status = String(item?.status || 'unknown').toLowerCase()
        const guidance = getGuidance(item)

        let statusLabel = 'REVIEW'
        let statusColor = '#475569'

        if (status === 'error') {
          statusLabel = 'CRITICAL'
          statusColor = '#DC2626'
        } else if (status === 'warning') {
          statusLabel = 'WARNING'
          statusColor = '#B45309'
        } else if (status === 'pass') {
          statusLabel = 'PASS'
          statusColor = '#15803D'
        }

        const startY = doc.y

        doc
          .roundedRect(doc.x, startY, 505, 128, 8)
          .fill('#FAFAFA')

        doc
          .fillColor(statusColor)
          .font('Helvetica-Bold')
          .fontSize(8)
          .text(statusLabel, doc.x + 12, startY + 10)

        doc
          .font('Helvetica-Bold')
          .fontSize(11)
          .fillColor('#111827')
          .text(
            guidance.title,
            doc.x + 12,
            startY + 26,
            { width: 470 }
          )

        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor('#64748B')
          .text(
            String(item?.category || 'SEO') +
            ' | Impact: ' +
            String(item?.impact || 'N/A') +
            ' | Effort: ' +
            guidance.effort,
            doc.x + 12,
            startY + 43
          )

        doc
          .font('Helvetica-Bold')
          .fontSize(8.7)
          .fillColor('#334155')
          .text('What we found: ', doc.x + 12, startY + 59, {
            continued: true,
          })

        doc
          .font('Helvetica')
          .text(cleanAuditMessage(item?.message), {
            width: 470,
          })

        doc
          .font('Helvetica-Bold')
          .fillColor('#334155')
          .text('Why it matters: ', doc.x + 12, startY + 83, {
            continued: true,
          })

        doc
          .font('Helvetica')
          .text(guidance.why, {
            width: 470,
          })

        doc
          .font('Helvetica-Bold')
          .fillColor('#166534')
          .text('Recommended action: ', doc.x + 12, startY + 106, {
            continued: true,
          })

        doc
          .font('Helvetica')
          .fillColor('#334155')
          .text(guidance.fix, {
            width: 470,
          })

        doc.y = startY + 140
      }

      function drawPassedCheck(item) {
        ensureSpace(42)

        const guidance = getGuidance(item)

        doc
          .font('Helvetica-Bold')
          .fontSize(9.5)
          .fillColor('#15803D')
          .text('PASS  ', { continued: true })

        doc
          .fillColor('#111827')
          .text(guidance.title)

        doc
          .font('Helvetica')
          .fontSize(8.5)
          .fillColor('#64748B')
          .text(cleanAuditMessage(item?.message))

        doc.moveDown(0.35)
      }


      // ======================================================
      // PAGE 1 - EXECUTIVE DASHBOARD
      // ======================================================

      doc
        .roundedRect(42, 42, 511, 92, 12)
        .fill('#111827')

      doc
        .font('Helvetica-Bold')
        .fontSize(24)
        .fillColor('#FFFFFF')
        .text('SEO AUDIT REPORT', 62, 64)

      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor('#64748B')
        .text(
          'Report engine: ' + AUDIT_PDF_VERSION,
          430,
          116,
          {
            width: 105,
            align: 'right',
          }
        )

      doc
        .font('Helvetica')
        .fontSize(11)
        .fillColor('#CBD5E1')
        .text(hostname, 62, 96)

      if (reportUrl) {
        doc
          .fontSize(8)
          .fillColor('#94A3B8')
          .text(reportUrl, 62, 114)
      }

      doc.y = 154

      doc
        .font('Helvetica-Bold')
        .fontSize(42)
        .fillColor(
          score >= 80
            ? '#16A34A'
            : score >= 60
              ? '#F97316'
              : '#DC2626'
        )
        .text(String(score) + '/100', {
          align: 'center',
        })

      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#64748B')
        .text('OVERALL SITE HEALTH', {
          align: 'center',
        })

      const cardY = doc.y + 18
      const cardWidth = 115

      metricCard(42, cardY, cardWidth, 'Critical Issues', critical.length, '#DC2626')
      metricCard(172, cardY, cardWidth, 'Warnings', warnings.length, '#D97706')
      metricCard(302, cardY, cardWidth, 'Passed Checks', passed.length, '#16A34A')
      metricCard(
        432,
        cardY,
        121,
        'Checks Performed',
        checks.length,
        '#2563EB'
      )

      doc.y = cardY + 84

      doc
        .font('Helvetica-Bold')
        .fontSize(13)
        .fillColor('#111827')
        .text('Executive Summary')

      doc.moveDown(0.4)

      let summaryText

      if (score >= 80) {
        summaryText =
          'The website has a strong technical foundation. The remaining findings are primarily optimisation opportunities that can help strengthen organic visibility, content quality and AI-search readiness.'
      } else if (score >= 60) {
        summaryText =
          'The website has a reasonable foundation, but several important improvements should be prioritised. Addressing the highest-impact findings can strengthen technical quality and organic search performance.'
      } else {
        summaryText =
          'The audit identified several important areas that deserve attention. Addressing critical issues first, followed by high-impact warnings, can significantly improve the website’s technical SEO foundation and search readiness.'
      }

      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#334155')
        .text(summaryText, {
          width: 505,
          lineGap: 3,
        })

      doc.moveDown(1)

      doc
        .fontSize(8.5)
        .fillColor('#64748B')
        .text(
          'Audit date: ' +
          (
            report?.scannedAt
              ? new Date(report.scannedAt).toLocaleString('en-GB')
              : new Date().toLocaleString('en-GB')
          )
        )


      // ======================================================
      // TOP PRIORITIES
      // ======================================================

      if (topPriorities.length) {
        section(
          'Top 5 Priorities',
          'The highest-impact findings to address first.'
        )

        topPriorities.forEach(drawPriority)
      }


      // ======================================================
      // QUICK WINS
      // ======================================================

      if (quickWins.length) {
        section(
          'Quick Wins',
          'High-value improvements that are relatively straightforward to implement.'
        )

        quickWins.forEach(drawQuickWin)
      }


      // ======================================================
      // CATEGORY SCORECARDS
      // ======================================================

      section(
        'SEO Health by Category',
        'Percentage of checks currently passing in each audited area.'
      )

      const categories = [
        'Technical SEO',
        'On-Page SEO',
        'Content Quality',
        'Page Speed',
        'Advanced SEO',
        'AEO',
        'AI Snippet',
        'Server & Security',
      ]

      let renderedCategory = false

      for (const category of categories) {
        const value = categoryScore(checks, category)

        if (value === null) continue

        renderedCategory = true
        progressBar(category, value)
      }

      if (!renderedCategory) {
        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor('#64748B')
          .text('No category score data available for this audit.')
      }


      // ======================================================
      // CRAWL SNAPSHOT
      // ======================================================

      section('Crawl Snapshot')

      const snapshotRows = [
        ['Status code', crawl.statusCode],
        [
          'Response time',
          crawl.responseTimeMs != null
            ? crawl.responseTimeMs + ' ms'
            : null
        ],
        ['Word count', crawl.wordCount],
        ['Internal links', crawl.internalLinks],
        ['External links', crawl.externalLinks],
        ['Language', crawl.language],
        [
          'File size',
          crawl.fileSizeBytes != null
            ? Math.round(crawl.fileSizeBytes / 1024) + ' KB'
            : null
        ],
        ['Final URL', crawl.finalUrl],
      ]

      for (const row of snapshotRows) {
        if (
          row[1] === null ||
          row[1] === undefined ||
          row[1] === ''
        ) {
          continue
        }

        ensureSpace(22)

        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor('#475569')
          .text(row[0] + ': ', {
            continued: true,
          })

        doc
          .font('Helvetica')
          .fillColor('#111827')
          .text(String(row[1]))
      }


      // ======================================================
      // CRITICAL ISSUES
      // ======================================================

      if (critical.length) {
        section(
          'Critical Issues (' + critical.length + ')',
          'These findings should receive the highest attention.'
        )

        critical
          .sort((a, b) => severityWeight(b) - severityWeight(a))
          .forEach(drawIssue)
      }


      // ======================================================
      // WARNINGS
      // ======================================================

      if (warnings.length) {
        section(
          'Important Warnings (' + warnings.length + ')',
          'Optimisation opportunities to review after critical issues.'
        )

        warnings
          .sort((a, b) => severityWeight(b) - severityWeight(a))
          .forEach(drawIssue)
      }


      // ======================================================
      // PASSED CHECKS
      // ======================================================

      if (passed.length) {
        section(
          'What Is Already Working (' + passed.length + ')',
          'Areas where the website currently meets the audit criteria.'
        )

        passed.forEach(drawPassedCheck)
      }


      // ======================================================
      // ROADMAP
      // ======================================================

      section(
        '90-Day SEO Improvement Roadmap',
        'A practical sequence for implementing the recommendations.'
      )

      const roadmap = [
        {
          title: 'FIRST 7 DAYS',
          text: 'Resolve critical crawl, indexing, canonical, status-code and high-impact technical issues.',
        },
        {
          title: 'NEXT 30 DAYS',
          text: 'Improve on-page content, structured data, accessibility, internal optimisation and quick-win opportunities.',
        },
        {
          title: '30-90 DAYS',
          text: 'Strengthen authority, reputation, AI-search readiness, content depth and ongoing technical monitoring.',
        },
      ]

      for (const item of roadmap) {
        ensureSpace(70)

        const y = doc.y

        doc
          .roundedRect(doc.x, y, 505, 58, 8)
          .fill('#F8FAFC')

        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor('#2563EB')
          .text(item.title, doc.x + 12, y + 10)

        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor('#334155')
          .text(item.text, doc.x + 12, y + 27, {
            width: 470,
          })

        doc.y = y + 68
      }


      // ======================================================
      // CTA
      // ======================================================

      ensureSpace(130)

      doc.moveDown(0.8)

      const ctaY = doc.y

      doc
        .roundedRect(doc.x, ctaY, 505, 100, 10)
        .fill('#111827')

      doc
        .font('Helvetica-Bold')
        .fontSize(14)
        .fillColor('#FFFFFF')
        .text(
          'Need help implementing these improvements?',
          doc.x + 16,
          ctaY + 16,
          {
            width: 470,
            align: 'center',
          }
        )

      doc
        .font('Helvetica')
        .fontSize(9.5)
        .fillColor('#CBD5E1')
        .text(
          'Devndespro helps businesses with technical SEO, web development and AI-search optimisation.',
          doc.x + 26,
          ctaY + 42,
          {
            width: 450,
            align: 'center',
          }
        )

      doc
        .font('Helvetica-Bold')
        .fontSize(9.5)
        .fillColor('#F97316')
        .text(
          'www.devndespro.com   |   seo.devndespro.com',
          doc.x + 26,
          ctaY + 72,
          {
            width: 450,
            align: 'center',
          }
        )

      doc.y = ctaY + 112

      doc.end()

    } catch (error) {
      reject(error)
    }
  })
}

module.exports = {
  buildAuditPdfBuffer,
}
