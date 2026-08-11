const PDFDocument = require('pdfkit')

const AUDIT_PDF_VERSION = 'premium-v4'

const CHECK_GUIDANCE = {
  content: {
    title: 'Content depth could be improved',
    why: 'Thin pages may struggle to demonstrate relevance, expertise and enough value for visitors.',
    fix: 'Expand the page with original, useful content that directly answers the visitorâ€™s main questions.',
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

const CHECK_GUIDANCE_NO = {
  content: {
    title: 'Innholdsdybden kan forbedres',
    why: 'Sider med lite innhold kan ha problemer med å vise relevans, ekspertise og tilstrekkelig verdi for besøkende.',
    fix: 'Utvid siden med originalt og nyttig innhold som svarer direkte på de viktigste spørsmålene til besøkende.',
    effort: 'Middels',
  },
  canonical: {
    title: 'Kanonisk URL mangler',
    why: 'Kanoniske tagger hjelper søkemotorer med å identifisere den foretrukne versjonen av en side.',
    fix: 'Legg til en selvrefererende canonical-tag som peker til den foretrukne URL-en.',
    effort: 'Lav',
  },
  img_alt: {
    title: 'Alternativ tekst for bilder mangler',
    why: 'Alt-tekst forbedrer tilgjengeligheten og hjelper søkemotorer med å forstå relevante bilder.',
    fix: 'Legg til korte og beskrivende alt-tekster på relevante bilder.',
    effort: 'Lav',
  },
  schema: {
    title: 'Strukturerte data mangler',
    why: 'Strukturerte data hjelper søkesystemer med å forstå sideinnhold, enheter og innholdstype.',
    fix: 'Legg til relevante JSON-LD-strukturerte data som beskriver siden korrekt.',
    effort: 'Middels',
  },
  render_blocking: {
    title: 'Render-blokkerende ressurser oppdaget',
    why: 'Blokkerende CSS eller JavaScript kan forsinke den første visningen av siden.',
    fix: 'Utsett ikke-kritisk JavaScript, gjennomgå kritisk CSS og optimaliser innlasting av ressurser.',
    effort: 'Middels',
  },
  modern_images: {
    title: 'Mulighet for moderne bildeformater',
    why: 'Eldre bildeformater kan øke sidestørrelsen og gjøre innlastingen tregere.',
    fix: 'Bruk egnede WebP- eller AVIF-versjoner og komprimer bildene på en passende måte.',
    effort: 'Lav',
  },
  robots_txt: {
    title: 'Problem med robots.txt-konfigurasjon',
    why: 'Ugyldige crawler-instruksjoner kan gjøre gjennomsøking og indeksering mindre pålitelig.',
    fix: 'Sørg for at /robots.txt returnerer gyldig ren tekst med riktige crawler-direktiver.',
    effort: 'Lav',
  },
  custom_404: {
    title: 'Feil håndtering av 404-sider',
    why: 'HTTP 200 for manglende URL-er kan forvirre søkemotorer og sløse med crawl-ressurser.',
    fix: 'Returner HTTP 404 eller 410 for URL-er som ikke finnes.',
    effort: 'Lav',
  },
  aeo_author_entity: {
    title: 'Forfatter- og enhetssignaler kan være tydeligere',
    why: 'Tydelig informasjon om forfatter og organisasjon kan styrke attribusjon og tillit.',
    fix: 'Legg til synlige opplysninger om forfatter eller organisasjon og relevante strukturerte data.',
    effort: 'Middels',
  },
  aeo_eeat: {
    title: 'Tillit og ekspertisesignaler kan styrkes',
    why: 'Tydelige signaler om erfaring, ekspertise og troverdighet hjelper brukere og søkesystemer med å vurdere innholdskvaliteten.',
    fix: 'Styrk forfatterprofiler, selskapsinformasjon, kvalifikasjoner, referanser og tillitssignaler.',
    effort: 'Middels',
  },
  aeo_bing_index: {
    title: 'Bing-synlighet bør gjennomgås',
    why: 'Synlighet i flere store søkemotorer øker muligheten for at nettstedet blir oppdaget.',
    fix: 'Kontroller indeksering i Bing Webmaster Tools og undersøk viktige sider som eventuelt mangler.',
    effort: 'Lav',
  },
  aeo_citations: {
    title: 'Autoritative referanser kan forbedres',
    why: 'Relevante referanser kan styrke faktabasert troverdighet.',
    fix: 'Referer til troverdige og direkte relevante eksterne kilder der det er passende.',
    effort: 'Lav',
  },
  aeo_reviews: {
    title: 'Eksterne omdømmesignaler kan styrkes',
    why: 'Uavhengige anmeldelser og omtale fra tredjeparter kan styrke merkevarens troverdighet.',
    fix: 'Bygg en legitim strategi for anmeldelser på plattformer som er relevante for virksomheten.',
    effort: 'Middels',
  },
  snippet_faq_schema: {
    title: 'Mulighet for FAQ-innhold',
    why: 'Tydelig spørsmål-og-svar-innhold kan gjøre viktig informasjon enklere å forstå.',
    fix: 'Legg til nyttig FAQ-innhold og gyldige FAQ-strukturerte data der det er relevant.',
    effort: 'Middels',
  },
  snippet_howto_schema: {
    title: 'Mulighet for fremgangsmåte-innhold',
    why: 'Trinnvis innhold kan gjøre instruksjoner tydeligere for relevante søk.',
    fix: 'Strukturer relevant instruksjonsinnhold i tydelige sekvensielle steg.',
    effort: 'Middels',
  },
  snippet_article_schema: {
    title: 'Mulighet for strukturerte artikkeldata',
    why: 'Artikkelmetadata kan tydeliggjøre forfatterskap, publiseringsinformasjon og innholdstype.',
    fix: 'Legg til gyldige Article- eller BlogPosting-strukturerte data for redaksjonelt innhold.',
    effort: 'Lav',
  },
  snippet_question_headings: {
    title: 'Mulighet for spørsmålsbaserte overskrifter',
    why: 'Spørsmålsbaserte seksjoner gjør svar enklere å skanne og tolke.',
    fix: 'Bruk naturlige H2/H3-overskrifter formulert som spørsmål, etterfulgt av direkte svar.',
    effort: 'Lav',
  },
  snippet_ready: {
    title: 'Direkte svarinnhold kan forbedres',
    why: 'Korte svar nær overskrifter gjør viktig informasjon enklere å forstå.',
    fix: 'Legg til korte og presise svaravsnitt under viktige informative overskrifter.',
    effort: 'Lav',
  },
  snippet_answer_density: {
    title: 'Flere korte svarblokker kan hjelpe',
    why: 'Direkte forklarende avsnitt kan forbedre tydelighet og dekning av spørsmål.',
    fix: 'Legg til korte svarblokker der de forbedrer leseopplevelsen.',
    effort: 'Lav',
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

function getGuidance(item = {}, language = 'en') {
  const isNorwegian = language === 'no'
  const guidance =
    (isNorwegian ? CHECK_GUIDANCE_NO[item.check] : null) ||
    CHECK_GUIDANCE[item.check] ||
    {}

  return {
    title:
      guidance.title ||
      (isNorwegian ? 'Funn fra SEO-analysen' : humanizeCheckName(item.check)),
    why:
      guidance.why ||
      (isNorwegian
        ? 'Dette funnet kan påvirke synlighet i søk, brukervennlighet eller hvordan søkesystemer tolker siden.'
        : 'This finding may affect search visibility, usability or how search systems interpret the page.'),
    fix:
      guidance.fix ||
      (isNorwegian
        ? 'Gjennomgå funnet og gjennomfør passende tekniske eller innholdsmessige forbedringer.'
        : 'Review the finding and apply the appropriate technical or content improvement.'),
    effort: guidance.effort || (isNorwegian ? 'Middels' : 'Medium'),
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

function buildAuditPdfBuffer(report, options = {}) {
  const language = options?.language === 'no' ? 'no' : 'en'
  const isNorwegian = language === 'no'
  const t = (en, no) => (isNorwegian ? no : en)
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
        bufferPages: true,
        info: {
          Title: t('SEO Audit Report', 'SEO-rapport'),
          Author: 'Devndespro',
          Subject: t('SEO, technical and AI visibility audit', 'SEO-, teknisk og AI-synlighetsanalyse'),
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
        .filter(item => ['Low', 'Lav'].includes(getGuidance(item, language).effort))
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

      function pageBottom() {
        return doc.page.height - doc.page.margins.bottom
      }

      function contentWidth() {
        return doc.page.width - doc.page.margins.left - doc.page.margins.right
      }

      function usablePageHeight() {
        return pageBottom() - doc.page.margins.top
      }

      function ensureSpace(height = 70) {
        // Keep whole blocks on one page when they fit; avoid drawing past the bottom.
        const needed = Math.min(height, usablePageHeight())
        if (doc.y + needed > pageBottom()) {
          doc.addPage()
        }
      }

      function measureTextHeight(text, font = 'Helvetica', size = 9, width = contentWidth()) {
        doc.font(font).fontSize(size)
        return doc.heightOfString(String(text || ''), { width })
      }

      function finishBlock(startY, minHeight = 0, gap = 10) {
        // If text flowed onto a new page, doc.y resets near the top â€” never jump back.
        if (doc.y < startY) {
          doc.y += gap
          return
        }
        doc.y = Math.max(doc.y, startY + minHeight) + gap
      }

      function divider() {
        doc
          .strokeColor('#E5E7EB')
          .lineWidth(1)
          .moveTo(doc.page.margins.left, doc.y)
          .lineTo(doc.page.width - doc.page.margins.right, doc.y)
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

        doc.x = doc.page.margins.left
      }

      function progressBar(label, value) {
        ensureSpace(32)

        const x = doc.page.margins.left
        const y = doc.y
        const width = Math.min(250, contentWidth() - 60)

        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor('#334155')
          .text(label, x, y, { width: width - 10 })

        doc
          .font('Helvetica')
          .fillColor('#64748B')
          .text(String(value) + '%', x + width + 10, y)

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

        doc.x = x
        doc.y = y + 30
      }

      function drawPriority(item, index) {
        const guidance = getGuidance(item, language)
        const width = contentWidth()
        const textWidth = width - 24
        const title = String(index + 1) + '. ' + guidance.title
        const metaText =
          'Impact: ' +
          String(item?.impact || 'Medium') +
          '   |   Effort: ' +
          guidance.effort +
          '   |   ' +
          String(item?.category || 'SEO')

        const titleH = measureTextHeight(title, 'Helvetica-Bold', 10, textWidth)
        const metaH = measureTextHeight(metaText, 'Helvetica', 8.5, textWidth)
        const fixLabelH = measureTextHeight(t('Recommended action', 'Anbefalt tiltak'), 'Helvetica-Bold', 9, textWidth)
        const fixH = measureTextHeight(guidance.fix, 'Helvetica', 9, textWidth)
        const boxHeight = 12 + titleH + 6 + metaH + 8 + fixLabelH + 2 + fixH + 14

        ensureSpace(boxHeight + 10)

        const x = doc.page.margins.left
        const y = doc.y
        const useCard = boxHeight <= usablePageHeight() - 4

        if (useCard) {
          doc.roundedRect(x, y, width, boxHeight, 8).fill('#F8FAFC')
        }

        doc
          .font('Helvetica-Bold')
          .fontSize(10)
          .fillColor('#111827')
          .text(title, x + 12, y + 10, { width: textWidth })

        doc
          .font('Helvetica')
          .fontSize(8.5)
          .fillColor('#64748B')
          .text(metaText, x + 12, doc.y + 4, { width: textWidth })

        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor('#166534')
          .text(t('Recommended action', 'Anbefalt tiltak'), x + 12, doc.y + 6, { width: textWidth })

        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor('#334155')
          .text(guidance.fix, x + 12, doc.y + 2, { width: textWidth })

        doc.x = x
        finishBlock(y, useCard ? boxHeight : 0, 10)
      }

      function drawQuickWin(item, index) {
        const guidance = getGuidance(item, language)
        const width = contentWidth()
        const title = 'QUICK WIN ' + String(index + 1) + '   ' + guidance.title
        const titleH = measureTextHeight(title, 'Helvetica-Bold', 10, width)
        const fixH = measureTextHeight(guidance.fix, 'Helvetica', 8.8, width)

        ensureSpace(titleH + fixH + 18)

        doc
          .font('Helvetica-Bold')
          .fontSize(10)
          .fillColor('#166534')
          .text('QUICK WIN ' + String(index + 1), { continued: true })

        doc
          .fillColor('#111827')
          .text('   ' + guidance.title, { width })

        doc
          .font('Helvetica')
          .fontSize(8.8)
          .fillColor('#475569')
          .text(guidance.fix, { width })

        doc.moveDown(0.5)
      }

      function drawIssue(item) {
        const guidance = getGuidance(item, language)
        const status = String(item?.status || 'unknown').toLowerCase()

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

        const foundText = cleanAuditMessage(item?.message)
        const width = contentWidth()
        const textWidth = width - 24
        const metaText =
          String(item?.category || 'SEO') +
          ' | Impact: ' +
          String(item?.impact || 'N/A') +
          ' | Effort: ' +
          guidance.effort

        // Measure with the fonts used when drawing (no continued:true mismatch).
        const titleH = measureTextHeight(guidance.title, 'Helvetica-Bold', 11, textWidth)
        const metaH = measureTextHeight(metaText, 'Helvetica', 8, textWidth)
        const foundLabelH = measureTextHeight(t('What we found', 'Hva vi fant'), 'Helvetica-Bold', 8.7, textWidth)
        const foundH = measureTextHeight(foundText, 'Helvetica', 8.7, textWidth)
        const whyLabelH = measureTextHeight(t('Why it matters', 'Hvorfor det er viktig'), 'Helvetica-Bold', 8.7, textWidth)
        const whyH = measureTextHeight(guidance.why, 'Helvetica', 8.7, textWidth)
        const fixLabelH = measureTextHeight(t('Recommended action', 'Anbefalt tiltak'), 'Helvetica-Bold', 8.7, textWidth)
        const fixH = measureTextHeight(guidance.fix, 'Helvetica', 8.7, textWidth)

        const boxHeight =
          10 +
          11 +
          4 +
          titleH +
          4 +
          metaH +
          8 +
          foundLabelH +
          2 +
          foundH +
          6 +
          whyLabelH +
          2 +
          whyH +
          6 +
          fixLabelH +
          2 +
          fixH +
          14

        ensureSpace(Math.min(boxHeight + 12, usablePageHeight()))

        const x = doc.page.margins.left
        const startY = doc.y
        const useCard = boxHeight <= usablePageHeight() - 4

        if (useCard) {
          doc.roundedRect(x, startY, width, boxHeight, 8).fill('#FAFAFA')
        }

        doc
          .fillColor(statusColor)
          .font('Helvetica-Bold')
          .fontSize(8)
          .text(statusLabel, x + 12, startY + 10, { width: textWidth })

        doc
          .font('Helvetica-Bold')
          .fontSize(11)
          .fillColor('#111827')
          .text(guidance.title, x + 12, doc.y + 4, { width: textWidth })

        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor('#64748B')
          .text(metaText, x + 12, doc.y + 4, { width: textWidth })

        let cursorY = doc.y + 8

        doc
          .font('Helvetica-Bold')
          .fontSize(8.7)
          .fillColor('#334155')
          .text(t('What we found', 'Hva vi fant'), x + 12, cursorY, { width: textWidth })
        doc
          .font('Helvetica')
          .fillColor('#334155')
          .text(foundText, x + 12, doc.y + 2, { width: textWidth })

        cursorY = doc.y + 6
        doc
          .font('Helvetica-Bold')
          .fontSize(8.7)
          .fillColor('#334155')
          .text(t('Why it matters', 'Hvorfor det er viktig'), x + 12, cursorY, { width: textWidth })
        doc
          .font('Helvetica')
          .fillColor('#334155')
          .text(guidance.why, x + 12, doc.y + 2, { width: textWidth })

        cursorY = doc.y + 6
        doc
          .font('Helvetica-Bold')
          .fontSize(8.7)
          .fillColor('#166534')
          .text(t('Recommended action', 'Anbefalt tiltak'), x + 12, cursorY, { width: textWidth })
        doc
          .font('Helvetica')
          .fillColor('#334155')
          .text(guidance.fix, x + 12, doc.y + 2, { width: textWidth })

        doc.x = x
        finishBlock(startY, useCard ? boxHeight : 0, 12)
      }

      function drawPassedCheck(item) {
        const guidance = getGuidance(item, language)
        const width = contentWidth()
        const titleH = measureTextHeight(guidance.title, 'Helvetica-Bold', 9.5, width)
        const message = cleanAuditMessage(item?.message)
        const messageH = measureTextHeight(message, 'Helvetica', 8.5, width)

        ensureSpace(titleH + messageH + 16)

        doc
          .font('Helvetica-Bold')
          .fontSize(9.5)
          .fillColor('#15803D')
          .text('PASS  ', { continued: true })

        doc
          .fillColor('#111827')
          .text(guidance.title, { width })

        doc
          .font('Helvetica')
          .fontSize(8.5)
          .fillColor('#64748B')
          .text(message, { width })

        doc.moveDown(0.35)
      }


      // ======================================================
      // PAGE 1 - EXECUTIVE DASHBOARD
      // ======================================================

      const pageLeft = doc.page.margins.left
      const pageInnerWidth = contentWidth()

      doc
        .roundedRect(pageLeft, 42, pageInnerWidth, 92, 12)
        .fill('#111827')

      doc
        .font('Helvetica-Bold')
        .fontSize(24)
        .fillColor('#FFFFFF')
        .text(t('SEO AUDIT REPORT', 'SEO-RAPPORT'), pageLeft + 20, 64, {
          width: pageInnerWidth - 40,
        })

      doc
        .font('Helvetica')
        .fontSize(7)
        .fillColor('#64748B')
        .text(
          'Report engine: ' + AUDIT_PDF_VERSION,
          pageLeft + pageInnerWidth - 125,
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
        .text(hostname, pageLeft + 20, 96, {
          width: pageInnerWidth - 40,
        })

      if (reportUrl) {
        doc
          .fontSize(8)
          .fillColor('#94A3B8')
          .text(reportUrl, pageLeft + 20, 114, {
            width: pageInnerWidth - 150,
            ellipsis: true,
          })
      }

      doc.y = 154
      doc.x = pageLeft

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
        .text(String(score) + '/100', pageLeft, doc.y, {
          align: 'center',
          width: pageInnerWidth,
        })

      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#64748B')
        .text(t('OVERALL SITE HEALTH', 'SAMLET NETTSTEDHELSE'), pageLeft, doc.y, {
          align: 'center',
          width: pageInnerWidth,
        })

      const cardY = doc.y + 18
      const cardGap = 10
      const cardWidth = (pageInnerWidth - cardGap * 3) / 4

      metricCard(pageLeft, cardY, cardWidth, t('Critical Issues', 'Kritiske problemer'), critical.length, '#DC2626')
      metricCard(pageLeft + cardWidth + cardGap, cardY, cardWidth, t('Warnings', 'Advarsler'), warnings.length, '#D97706')
      metricCard(pageLeft + (cardWidth + cardGap) * 2, cardY, cardWidth, t('Passed Checks', 'Godkjente kontroller'), passed.length, '#16A34A')
      metricCard(
        pageLeft + (cardWidth + cardGap) * 3,
        cardY,
        cardWidth,
        'Checks Performed',
        checks.length,
        '#2563EB'
      )

      // Absolute-positioned metric cards leave doc.x near the right edge.
      // Reset before flowing text so Executive Summary is not clipped.
      doc.x = pageLeft
      doc.y = cardY + 84

      let summaryText

      if (score >= 80) {
        summaryText =
          t('The website has a strong technical foundation. The remaining findings are primarily optimisation opportunities that can help strengthen organic visibility, content quality and AI-search readiness.', 'Nettstedet har et solid teknisk fundament. De gjenvÃ¦rende funnene er hovedsakelig forbedringsmuligheter som kan styrke organisk synlighet, innholdskvalitet og synlighet i AI-sÃ¸k.')
      } else if (score >= 60) {
        summaryText =
          'The website has a reasonable foundation, but several important improvements should be prioritised. Addressing the highest-impact findings can strengthen technical quality and organic search performance.'
      } else {
        summaryText =
          t('The audit identified several important areas that deserve attention. Addressing critical issues first, followed by high-impact warnings, can significantly improve the websiteâ€™s technical SEO foundation and search readiness.', 'Analysen identifiserte flere viktige omrÃ¥der som bÃ¸r fÃ¸lges opp. Ved Ã¥ lÃ¸se kritiske problemer fÃ¸rst og deretter prioritere viktige advarsler, kan nettstedets tekniske SEO-grunnlag og synlighet i sÃ¸k forbedres betydelig.')
      }

      const auditDateText =
        'Audit date: ' +
        (
          report?.scannedAt
            ? new Date(report.scannedAt).toLocaleString('en-GB')
            : new Date().toLocaleString('en-GB')
        )

      const summaryTitleH = measureTextHeight(t('Executive Summary', 'Sammendrag'), 'Helvetica-Bold', 13, pageInnerWidth)
      const summaryBodyH = measureTextHeight(summaryText, 'Helvetica', 10, pageInnerWidth)
      const summaryDateH = measureTextHeight(auditDateText, 'Helvetica', 8.5, pageInnerWidth)
      const summaryBlockH = summaryTitleH + 8 + summaryBodyH + 14 + summaryDateH + 8

      ensureSpace(summaryBlockH)

      doc.x = pageLeft
      doc
        .font('Helvetica-Bold')
        .fontSize(13)
        .fillColor('#111827')
        .text(t('Executive Summary', 'Sammendrag'), pageLeft, doc.y, {
          width: pageInnerWidth,
        })

      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#334155')
        .text(summaryText, pageLeft, doc.y + 8, {
          width: pageInnerWidth,
          lineGap: 3,
        })

      doc
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor('#64748B')
        .text(auditDateText, pageLeft, doc.y + 12, {
          width: pageInnerWidth,
        })

      doc.x = pageLeft
      doc.moveDown(0.4)


      // ======================================================
      // TOP PRIORITIES
      // ======================================================

      if (topPriorities.length) {
        section(
          t('Top 5 Priorities', '5 viktigste prioriteringer'),
          'The highest-impact findings to address first.'
        )

        topPriorities.forEach(drawPriority)
      }


      // ======================================================
      // QUICK WINS
      // ======================================================

      if (quickWins.length) {
        section(
          t('Quick Wins', 'Raske forbedringer'),
          'High-value improvements that are relatively straightforward to implement.'
        )

        quickWins.forEach(drawQuickWin)
      }


      // ======================================================
      // CATEGORY SCORECARDS
      // ======================================================

      section(
        t('SEO Health by Category', 'SEO-status etter kategori'),
        t('Percentage of checks currently passing in each audited area.', 'Andel kontroller som er godkjent innen hvert analysert omrÃ¥de.')
      )

      const categories = [
        t('Technical SEO', 'Teknisk SEO'),
        t('On-Page SEO', 'On-page SEO'),
        t('Content Quality', 'Innholdskvalitet'),
        t('Page Speed', 'Sidehastighet'),
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

        const snapWidth = contentWidth()

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
          .text(String(row[1]), {
            width: snapWidth,
          })
      }


      // ======================================================
      // CRITICAL ISSUES
      // ======================================================

      if (critical.length) {
        section(
          t('Critical Issues', 'Kritiske problemer') + ' (' + critical.length + ')',
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
          t('Important Warnings', 'Viktige advarsler') + ' (' + warnings.length + ')',
          t('Optimisation opportunities to review after critical issues.', 'Forbedringsmuligheter som bÃ¸r gjennomgÃ¥s etter de kritiske problemene.')
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
        t('90-Day SEO Improvement Roadmap', '90-dagers SEO-forbedringsplan'),
        'A practical sequence for implementing the recommendations.'
      )

      const roadmap = [
        {
          title: t('FIRST 7 DAYS', 'FÃ˜RSTE 7 DAGER'),
          text: 'Resolve critical crawl, indexing, canonical, status-code and high-impact technical issues.',
        },
        {
          title: 'NEXT 30 DAYS',
          text: t('Improve on-page content, structured data, accessibility, internal optimisation and quick-win opportunities.', 'Forbedre innhold pÃ¥ siden, strukturerte data, tilgjengelighet, intern optimalisering og raske forbedringsmuligheter.'),
        },
        {
          title: '30-90 DAYS',
          text: 'Strengthen authority, reputation, AI-search readiness, content depth and ongoing technical monitoring.',
        },
      ]

      for (const item of roadmap) {
        ensureSpace(70)

        const x = doc.page.margins.left
        const width = contentWidth()
        const y = doc.y
        const textWidth = width - 24
        const textH = measureTextHeight(item.text, 'Helvetica', 9, textWidth)
        const boxHeight = Math.max(58, 27 + textH + 12)

        doc
          .roundedRect(x, y, width, boxHeight, 8)
          .fill('#F8FAFC')

        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor('#2563EB')
          .text(item.title, x + 12, y + 10, { width: textWidth })

        doc
          .font('Helvetica')
          .fontSize(9)
          .fillColor('#334155')
          .text(item.text, x + 12, y + 27, {
            width: textWidth,
          })

        doc.x = x
        doc.y = y + boxHeight + 10
      }


      // ======================================================
      // CTA
      // ======================================================

      ensureSpace(130)

      doc.moveDown(0.8)

      const ctaX = doc.page.margins.left
      const ctaWidth = contentWidth()
      const ctaY = doc.y

      doc
        .roundedRect(ctaX, ctaY, ctaWidth, 100, 10)
        .fill('#111827')

      doc
        .font('Helvetica-Bold')
        .fontSize(14)
        .fillColor('#FFFFFF')
        .text(
          t('Need help implementing these improvements?', 'Trenger du hjelp med Ã¥ gjennomfÃ¸re disse forbedringene?'),
          ctaX + 16,
          ctaY + 16,
          {
            width: ctaWidth - 32,
            align: 'center',
          }
        )

      doc
        .font('Helvetica')
        .fontSize(9.5)
        .fillColor('#CBD5E1')
        .text(
          t('Devndespro helps businesses with technical SEO, web development and AI-search optimisation.', 'Devndespro hjelper bedrifter med teknisk SEO, webutvikling og optimalisering for AI-sÃ¸k.'),
          ctaX + 26,
          ctaY + 42,
          {
            width: ctaWidth - 52,
            align: 'center',
          }
        )

      doc
        .font('Helvetica-Bold')
        .fontSize(9.5)
        .fillColor('#F97316')
        .text(
          'www.devndespro.com   |   seo.devndespro.com',
          ctaX + 26,
          ctaY + 72,
          {
            width: ctaWidth - 52,
            align: 'center',
          }
        )

      doc.x = ctaX
      doc.y = ctaY + 112

      // Stamp footers onto existing pages.
      // PDFKit auto-paginates if you write inside the bottom margin, so
      // temporarily clear margins while drawing page numbers.
      const pageRange = doc.bufferedPageRange()
      const totalPages = pageRange.count

      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(pageRange.start + i)

        const { width: pageWidth, height: pageHeight, margins } = doc.page
        const left = margins.left
        const usableWidth = pageWidth - margins.left - margins.right
        const footerY = pageHeight - 28

        const savedBottom = margins.bottom
        const savedTop = margins.top
        doc.page.margins.bottom = 0
        doc.page.margins.top = 0

        doc
          .strokeColor('#E5E7EB')
          .lineWidth(0.6)
          .moveTo(left, footerY - 8)
          .lineTo(left + usableWidth, footerY - 8)
          .stroke()

        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor('#94A3B8')
          .text(
            hostname + '  Â·  ' + t('SEO Audit Report', 'SEO-rapport'),
            left,
            footerY,
            {
              width: usableWidth * 0.62,
              align: 'left',
              lineBreak: false,
            }
          )

        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor('#64748B')
          .text(
            (isNorwegian ? 'Side ' + (i + 1) + ' av ' + totalPages : 'Page ' + (i + 1) + ' of ' + totalPages),
            left + usableWidth * 0.62,
            footerY,
            {
              width: usableWidth * 0.38,
              align: 'right',
              lineBreak: false,
            }
          )

        doc.page.margins.bottom = savedBottom
        doc.page.margins.top = savedTop
      }

      doc.end()

    } catch (error) {
      reject(error)
    }
  })
}

module.exports = {
  buildAuditPdfBuffer,
}
