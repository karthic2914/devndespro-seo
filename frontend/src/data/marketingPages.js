/** Shared copy for public marketing routes (React + static crawl shells). */

import {
  faCube,
  faLayerGroup,
  faRobot,
  faRoute,
  faTags,
} from '@fortawesome/free-solid-svg-icons'

/** Top nav: dedicated marketing routes (same URLs on landing and inner pages). */
export const PRIMARY_MARKETING_NAV = [
  { label: 'Platform', to: '/platform', icon: faCube },
  { label: 'Features', to: '/features', icon: faLayerGroup },
  { label: 'AI Visibility', to: '/ai-visibility', icon: faRobot },
  { label: 'How it works', to: '/how-it-works', icon: faRoute },
  { label: 'Pricing', to: '/pricing', icon: faTags },
]

/** Paths that should also light up a primary nav item. */
const PRIMARY_NAV_ALIASES = {
  '/features': ['/features', '/seo-audit', '/keyword-tracking', '/backlink-monitoring'],
  '/ai-visibility': ['/ai-visibility'],
  '/platform': ['/platform'],
  '/how-it-works': ['/how-it-works'],
  '/pricing': ['/pricing'],
}

export function isPrimaryNavActive(to, pathname) {
  const path = (pathname || '/').replace(/\/$/, '') || '/'
  const aliases = PRIMARY_NAV_ALIASES[to] || [to]
  return aliases.includes(path)
}

export const MARKETING_NAV = [
  { path: '/platform', label: 'Platform' },
  { path: '/how-it-works', label: 'How it works' },
  { path: '/features', label: 'Features' },
  { path: '/seo-audit', label: 'Site Audit' },
  { path: '/ai-visibility', label: 'AI Visibility' },
  { path: '/pricing', label: 'Pricing' },
  { path: '/about', label: 'About' },
]

/**
 * Per-page hero panel data. `variant` drives distinct layouts
 * (signals | steps | modules | citations | score | ranks | links | about).
 */
export const PAGE_VISUALS = {
  platform: {
    variant: 'signals',
    panelTitle: 'Three signals. One workspace.',
    chips: ['Technical SEO', 'AI citations', 'Nordic intent'],
    stats: [
      { value: '3', label: 'core signals' },
      { value: '1', label: 'shared Action Plan' },
      { value: '100%', label: 'hostname-aware' },
    ],
    signals: [
      { label: 'Technical SEO', detail: 'Crawl · meta · speed', tone: 'amber' },
      { label: 'AI citations', detail: 'ChatGPT · Claude', tone: 'blue' },
      { label: 'Nordic intent', detail: 'NO · SE · DK markets', tone: 'teal' },
    ],
  },
  'how-it-works': {
    variant: 'steps',
    panelTitle: 'Domain → decisions → lift',
    chips: ['Add site', 'Run analysis', 'Improve'],
    stats: [
      { value: '01', label: 'add domain' },
      { value: '02', label: 'audit signals' },
      { value: '03', label: 'act by impact' },
    ],
    steps: [
      { n: '01', title: 'Add your website', detail: 'Hostname + market' },
      { n: '02', title: 'Run the analysis', detail: 'SEO + AI signals' },
      { n: '03', title: 'Improve by impact', detail: 'Shared Action Plan' },
    ],
  },
  features: {
    variant: 'modules',
    panelTitle: 'Modules that stay connected',
    chips: ['Site Audit', 'Keywords', 'Backlinks', 'AI Visibility'],
    stats: [
      { value: '4', label: 'growth modules' },
      { value: '∞', label: 're-run audits' },
      { value: '1', label: 'private workspace' },
    ],
    modules: [
      { label: 'Site Audit', meta: 'Health score' },
      { label: 'Keywords', meta: 'Rank tracking' },
      { label: 'Backlinks', meta: 'Spam filter' },
      { label: 'AI Visibility', meta: 'Citations' },
    ],
  },
  'ai-visibility': {
    variant: 'citations',
    panelTitle: 'Show up where answers happen',
    chips: ['ChatGPT', 'Claude', 'Citations'],
    stats: [
      { value: 'AI', label: 'answer engines' },
      { value: 'SEO', label: 'classic SERPs' },
      { value: '1', label: 'unified view' },
    ],
    citations: [
      { engine: 'ChatGPT', status: 'Mentioned', tone: 'good' },
      { engine: 'Claude', status: 'Cited', tone: 'good' },
      { engine: 'Perplexity', status: 'Watch', tone: 'warn' },
    ],
  },
  'seo-audit': {
    variant: 'score',
    panelTitle: 'Crawl → score → fix',
    chips: ['Site Health', 'Critical issues', 'Re-check'],
    stats: [
      { value: 'H1', label: 'on-page checks' },
      { value: '100', label: 'page crawl cap*' },
      { value: 'PDF', label: 'shareable proof' },
    ],
    score: 78,
    issues: [
      { label: 'Missing meta descriptions', sev: 'Critical' },
      { label: 'Slow LCP on product pages', sev: 'Warning' },
      { label: 'Orphan URLs in crawl', sev: 'Info' },
    ],
  },
  'keyword-tracking': {
    variant: 'ranks',
    panelTitle: 'Ranks tied to revenue intent',
    chips: ['Positions', 'GSC', 'Competitors'],
    stats: [
      { value: 'Δ', label: 'rank change' },
      { value: 'URL', label: 'ranking pages' },
      { value: 'NO', label: 'Nordic markets' },
    ],
    ranks: [
      { kw: 'seo audit norway', pos: '4', delta: '+2' },
      { kw: 'ai visibility tool', pos: '7', delta: '+1' },
      { kw: 'backlink monitor', pos: '12', delta: '−1' },
    ],
  },
  'backlink-monitoring': {
    variant: 'links',
    panelTitle: 'Links with spam controls',
    chips: ['Ref domains', 'Spam filter', 'Disavow'],
    stats: [
      { value: 'DR', label: 'domain signals' },
      { value: 'CSV', label: 'exports' },
      { value: '21d', label: 'disavow wait' },
    ],
    links: [
      { host: 'tech.no', dr: '62', flag: 'ok' },
      { host: 'news.se', dr: '48', flag: 'ok' },
      { host: 'spam.biz', dr: '12', flag: 'spam' },
    ],
  },
  about: {
    variant: 'about',
    panelTitle: 'Built in Stavanger',
    chips: ['Nordic focus', 'Private beta', 'Impact-first'],
    stats: [
      { value: 'SVG', label: 'Stavanger' },
      { value: 'SEO', label: 'product lab' },
      { value: 'AI', label: 'discovery era' },
    ],
    values: [
      { label: 'Nordic-first', detail: 'Local intent, not global noise' },
      { label: 'Private by default', detail: 'Authorised workspaces only' },
      { label: 'Impact over vanity', detail: 'Fix what moves discovery' },
    ],
  },
  pricing: {
    variant: 'plans',
    panelTitle: 'Launch · Accelerate · Command',
    chips: ['NOK base', 'Live FX', '5 regions'],
    stats: [
      { value: '3', label: 'clear packages' },
      { value: '5', label: 'currencies' },
      { value: 'live', label: 'ECB rates' },
    ],
  },
}

export const MARKETING_PAGES = {
  platform: {
    path: '/platform',
    title: 'SEO Platform · Technical, AI & Nordic Search | DevnDespro',
    description:
      'One SEO platform for technical site health, AI visibility and Nordic search intelligence. Understand how your business is discovered.',
    h1: 'Understand exactly how your business is discovered',
    eyebrow: 'ONE PLATFORM. THREE SIGNALS.',
    intro:
      'DevnDespro SEO combines technical SEO, AI visibility and Nordic search intelligence in one clear view, so teams stop juggling disconnected tools and start fixing what limits growth.',
    sections: [
      {
        h2: 'Technical SEO that unblocks growth',
        body: [
          'Find crawl errors, broken links, weak metadata and performance issues that limit search visibility. Site Audit scores on-page, technical and content quality so you know what to fix first.',
          'Homepage and multi-page crawls keep Site Health honest after every release, with issues ordered by impact instead of buried in generic checklists.',
        ],
      },
      {
        h2: 'AI visibility alongside classic search',
        body: [
          'Check whether ChatGPT and Claude mention, understand or recommend your business. Mentions, citations and trust signals sit next to your SEO work, not in a separate experiment.',
          'Prepare content for Google rankings and answer engines at the same time, with recommendations that respect both channels.',
        ],
      },
      {
        h2: 'Nordic search intelligence',
        body: [
          'Analyse Norwegian and regional search intent, local keywords and discovery opportunities that generic global tools often miss.',
          'Keep each hostname as its own project so parent marketing sites and product subdomains never share a confused health score.',
        ],
      },
    ],
    faqs: [
      {
        q: 'What makes this one platform instead of three tools?',
        a: 'Site Audit, keywords, backlinks and AI visibility share the same projects, Action Plan and reporting, so priorities stay aligned.',
      },
      {
        q: 'Who is the platform for?',
        a: 'Nordic marketing teams, founders and agencies who want practical signals and authorised private workspaces.',
      },
    ],
  },

  'how-it-works': {
    path: '/how-it-works',
    title: 'How It Works · Domain to Decisions in Three Steps | DevnDespro',
    description:
      'Add your website, run the analysis, improve visibility. See how DevnDespro SEO turns audits and AI signals into a prioritised action plan.',
    h1: 'From domain to decisions in three steps',
    eyebrow: 'SIMPLE WORKFLOW',
    intro:
      'Run the analysis, understand the signals and follow a prioritised plan for improvement. DevnDespro keeps the path short: add a site, audit what matters, then act in impact order.',
    sections: [
      {
        h2: '01 · Add your website',
        body: [
          'Enter your domain and select the market you want to analyse. Each project is tied to a hostname so product and marketing sites stay separate.',
          'Invite authorised teammates into a private workspace. Access stays limited to people you approve.',
        ],
      },
      {
        h2: '02 · Run the analysis',
        body: [
          'We audit your website, keywords and AI visibility signals. Site Health summarises critical issues and warnings you can explain to stakeholders.',
          'Multi-page crawls and homepage checks surface duplicates, thin content, technical blockers and AI-readiness gaps in one place.',
        ],
      },
      {
        h2: '03 · Improve your visibility',
        body: [
          'Follow clear recommendations ordered by business impact. Action Plan stays synced with audit findings so work does not die in a PDF.',
          'Re-run audits after fixes to confirm Site Health improved, then expand into keywords, backlinks and AI citations as you need them.',
        ],
      },
    ],
    faqs: [
      {
        q: 'How long does the first analysis take?',
        a: 'Homepage audits complete quickly; full-site crawls scale with page count. You can review issues as soon as the homepage pass finishes.',
      },
      {
        q: 'Do I need all modules on day one?',
        a: 'No. Start with Site Audit and Site Health, then enable keywords, backlinks or AI visibility when your workflow needs them.',
      },
    ],
  },

  features: {
    path: '/features',
    title: 'SEO Features · Site Audit, Keywords, Backlinks & AI | DevnDespro',
    description:
      'Explore DevnDespro SEO features: technical site audits, keyword tracking, backlink monitoring, and AI citation visibility for Nordic teams.',
    h1: 'Everything you need to improve search and AI visibility',
    eyebrow: 'PLATFORM FEATURES',
    intro:
      'DevnDespro SEO brings technical SEO, ranking intelligence, link monitoring and AI visibility into one private workspace. Stop jumping between tools. See what blocks growth and what to fix next.',
    sections: [
      {
        h2: 'Technical site audits that prioritise impact',
        body: [
          'Run homepage and multi-page crawls to surface missing titles, thin content, broken links, robots issues and performance risks. Site Health combines on-page, technical and content quality signals so your team knows which critical issues move the needle first.',
          'Re-run audits after releases to confirm fixes landed. Export summaries for stakeholders and keep Action Plan tasks synced with the latest crawl findings.',
        ],
      },
      {
        h2: 'Keyword tracking for Nordic search intent',
        body: [
          'Track the keywords that matter for your market, watch position changes over time, and spot opportunities where competitors already rank. Pair Search Console data with third-party signals for a clearer picture of organic demand.',
          'Prioritise pages and queries by business impact instead of vanity metrics. Keyword workflows stay tied to each project hostname so product and marketing sites stay separate.',
        ],
      },
      {
        h2: 'Backlink monitoring and spam control',
        body: [
          'See referring domains, link quality patterns and spam risk in one place. Export disavow candidates, track submission status, and re-scan after Google processes your file.',
          'Domain Rank and link score help you decide when outreach, cleanup or competitive gap analysis deserves attention this week.',
        ],
      },
      {
        h2: 'AI visibility beyond classic SERPs',
        body: [
          'Measure whether assistants like ChatGPT and Claude mention or recommend your brand. AI citation checks sit alongside technical SEO so you prepare content for both rankings and answer engines.',
          'Use clear recommendations ordered by visibility impact, not generic SEO checklists that ignore how discovery is changing.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Who are these features built for?',
        a: 'Marketing and growth teams at Nordic companies, plus agencies that manage multiple domains and need clear, shareable priorities per project.',
      },
      {
        q: 'Can I use only Site Audit without other modules?',
        a: 'Yes. Start with audits and Site Health, then enable keywords, backlinks or AI visibility when your plan and workflow need them.',
      },
    ],
  },

  'ai-visibility': {
    path: '/ai-visibility',
    title: 'AI Visibility Tracking · ChatGPT & Claude Citations | DevnDespro',
    description:
      'Track whether ChatGPT and Claude mention or recommend your business. Improve AI visibility alongside classic SEO with DevnDespro.',
    h1: 'See whether AI assistants recommend your business',
    eyebrow: 'AI VISIBILITY',
    intro:
      'Search is no longer only ten blue links. Buyers ask ChatGPT, Claude and other assistants for recommendations. DevnDespro helps you measure AI mentions and pair them with technical SEO so your brand is discoverable in both worlds.',
    sections: [
      {
        h2: 'Why AI visibility matters now',
        body: [
          'Answer engines summarise the web and often cite a short list of trusted sources. If your site is thin, unclear or poorly structured, you are less likely to be mentioned, even if you rank for a few classic keywords.',
          'AI visibility monitoring shows whether your brand appears in assistant answers for prompts that matter to your market, and highlights gaps competitors already fill.',
        ],
      },
      {
        h2: 'How DevnDespro measures AI signals',
        body: [
          'Run structured AI visibility checks for your domain, review citation outcomes, and track score history over time. Results live next to Site Audit and Action Plan so technical fixes and content improvements support both Google and AI discovery.',
          'Combine AI findings with Nordic search context (language, local intent and regional competitors) instead of treating AI SEO as a separate science experiment.',
        ],
      },
      {
        h2: 'Improve the foundations assistants trust',
        body: [
          'Clear entities, FAQ structure, authoritative outbound references, crawlable content and consistent branding help both search engines and AI systems understand who you are.',
          'Use Site Audit warnings for schema, question headings and E-E-A-T style signals as a practical checklist while you grow AI citation share.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Does AI visibility replace SEO?',
        a: 'No. Strong technical SEO and content still matter. AI visibility adds another discovery channel you can measure and improve alongside rankings.',
      },
      {
        q: 'Which assistants are covered?',
        a: 'Checks focus on major assistants such as ChatGPT and Claude, with workflows designed to expand as AI search evolves.',
      },
    ],
  },

  'seo-audit': {
    path: '/seo-audit',
    title: 'SEO Site Audit Tool · Technical & Content Health | DevnDespro',
    description:
      'Run technical SEO site audits: crawl issues, titles, H1s, content quality and Site Health scoring. Built for teams who need clear fix priorities.',
    h1: 'Site audits that turn crawl issues into an action plan',
    eyebrow: 'SEO SITE AUDIT',
    intro:
      'DevnDespro Site Audit crawls your pages, scores Site Health, and lists critical issues and warnings by impact. Fix what blocks indexing and rankings first, then re-check to prove improvement.',
    sections: [
      {
        h2: 'Homepage and multi-page crawls',
        body: [
          'Start with a deep homepage audit covering on-page SEO, technical checks, content volume, robots.txt and performance signals. Expand to a multi-page crawl using sitemap and internal links to find duplicate titles, thin pages and sitewide patterns.',
          'Auth and app routes can be excluded so login shells do not pollute marketing site scores. Each hostname stays its own project for clean reporting.',
        ],
      },
      {
        h2: 'Site Health you can explain to stakeholders',
        body: [
          'Site Health summarises errors and warnings into a score stakeholders understand. Category views for on-page, technical SEO and content quality show where the real debt sits.',
          'Decision Center and Action Plan stay aligned with audit findings so work does not die in a PDF.',
        ],
      },
      {
        h2: 'Built for modern JavaScript sites',
        body: [
          'Many marketing sites are React or Vite SPAs. Our crawler can use static HTML when present and optional headless rendering when the shell is empty, so H1 and word-count checks better match what users see.',
          'Still, we recommend crawlable HTML for critical landing pages so search bots and audits do not depend on JavaScript alone.',
        ],
      },
    ],
    faqs: [
      {
        q: 'How often should we re-run Site Audit?',
        a: 'After major releases, content launches or technical changes. Regular re-checks confirm fixes and catch regressions early.',
      },
      {
        q: 'What is a good Site Health score?',
        a: 'Aim to clear critical errors first. Scores climb as duplicates, thin pages and technical blockers disappear. Progress matters more than a single number.',
      },
    ],
  },

  'keyword-tracking': {
    path: '/keyword-tracking',
    title: 'Keyword Tracking Software · Rank Monitoring | DevnDespro',
    description:
      'Track keyword rankings, organic opportunity and competitor overlap. Keyword tracking built for Nordic SEO teams inside DevnDespro.',
    h1: 'Keyword tracking tied to real business priorities',
    eyebrow: 'KEYWORD TRACKING',
    intro:
      'Know which queries move, which pages win, and where competitors outrank you. DevnDespro keyword tracking keeps rankings next to audits and actions so SEO work stays grounded in outcomes.',
    sections: [
      {
        h2: 'Monitor the terms that matter',
        body: [
          'Add strategic keywords per project, track position changes, and review ranking URLs over time. Focus lists beat bloated trackers that drown teams in noise.',
          'Connect Search Console when available for verified query and page performance alongside third-party rank checks.',
        ],
      },
      {
        h2: 'From ranks to actions',
        body: [
          'When rankings slip, pair keyword evidence with Site Audit findings. Thin content, weak titles or technical issues often explain the drop.',
          'Action Plan items can reflect ranking priorities so content and engineering share one queue.',
        ],
      },
      {
        h2: 'Nordic and multi-market workflows',
        body: [
          'Configure country and language context for the markets you care about. Keep product subdomains and parent marketing sites as separate projects so keyword sets never blur together.',
          'Competitive views help you see shared keyword space and decide where new content or better on-page SEO is worth the effort.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Is keyword tracking included for every plan?',
        a: 'Availability depends on your workspace plan and feature flags. Start with Site Audit, then enable keyword tracking when your team is ready.',
      },
      {
        q: 'How is this different from Search Console alone?',
        a: 'Search Console is essential verified data. Keyword tracking adds competitive and historical rank context and keeps it beside audits and backlinks.',
      },
    ],
  },

  'backlink-monitoring': {
    path: '/backlink-monitoring',
    title: 'Backlink Monitoring Tool · Links, Spam & Disavow | DevnDespro',
    description:
      'Monitor backlinks, referring domains and spam risk. Export disavow files and track cleanup with DevnDespro backlink monitoring.',
    h1: 'Backlink monitoring with spam controls that teams actually use',
    eyebrow: 'BACKLINK MONITORING',
    intro:
      'Links still influence trust and discovery, but toxic profiles create risk. DevnDespro helps you monitor referring domains, spot spam patterns, export disavow candidates and verify cleanup over time.',
    sections: [
      {
        h2: 'See the links pointing to your site',
        body: [
          'Review backlink tables, referring domains and quality signals in one workspace. Filter noise, focus on high-impact links, and compare against competitors when you plan outreach.',
          'Domain Rank and link score summarise authority trends without forcing you into another disconnected dashboard.',
        ],
      },
      {
        h2: 'Spam filter, export and disavow tracking',
        body: [
          'Flag suspicious links, export CSV or disavow text files, and follow Google’s disavow process with a simple status tracker: submitted, waiting, ready to re-check.',
          'Re-scan after processing windows so you know whether risky links still appear in your profile.',
        ],
      },
      {
        h2: 'Connect link work to Site Health',
        body: [
          'Backlink insights sit beside Site Audit and Action Plan. When spam or lost links threaten visibility, tasks stay visible to the people who can fix outreach, content or technical issues.',
          'Keep each hostname as its own project so parent brand links and product subdomain links do not get mixed.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Do I always need to disavow?',
        a: 'No. Disavow is for clear, manipulative or harmful patterns. Monitoring first helps you avoid over-disavowing healthy links.',
      },
      {
        q: 'Can agencies manage multiple client link profiles?',
        a: 'Yes. Projects are per site URL, so each client domain keeps its own backlink workspace and scores.',
      },
    ],
  },

  pricing: {
    path: '/pricing',
    title: 'Pricing · Launch, Accelerate & Command | DevnDespro SEO',
    description:
      'Simple DevnDespro SEO plans: Launch, Accelerate and Command. Switch currency for Norway, Europe, India, USA and UK with live exchange rates.',
    h1: 'Plans that stay affordable as you grow',
    eyebrow: 'PRICING',
    intro:
      'Three clear packages: Launch (Basic), Accelerate (Advanced) and Command (Business), with prices shown in your currency using live exchange rates.',
    sections: [
      {
        h2: 'Launch, Accelerate and Command',
        body: [
          'Launch covers core Site Audit and visibility basics. Accelerate adds full AI scans, backlinks and keyword pro tools. Command unlocks team workflows and cold email for business and agency use.',
          'Open /pricing in the product site to switch Norway, Europe, India, USA or UK and see converted monthly rates.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Which currency is the source price?',
        a: 'Plans are priced in NOK and converted live for EUR, INR, USD and GBP.',
      },
    ],
  },

  about: {
    path: '/about',
    title: 'About DevnDespro SEO · Built in Stavanger, Norway',
    description:
      'DevnDespro SEO is built in Stavanger, Norway for Nordic teams who need practical SEO, site audits and AI visibility in one workspace.',
    h1: 'Built in Stavanger for teams who need practical SEO clarity',
    eyebrow: 'ABOUT',
    intro:
      'DevnDespro builds digital products with a bias toward clarity. Our SEO platform helps Nordic businesses understand site health, rankings, links and AI visibility, then act in priority order.',
    sections: [
      {
        h2: 'Our point of view',
        body: [
          'Most SEO stacks drown teams in charts. We focus on explainable scores, crawl issues you can fix, and discovery channels that now include AI assistants as well as Google.',
          'Projects are hostname-aware so a parent marketing site and a product subdomain never share a confused health score.',
        ],
      },
      {
        h2: 'Who we serve',
        body: [
          'In-house marketers, founders and agencies across the Nordics who want a private workspace, authorised access and recommendations ordered by impact.',
          'Whether you run one brand or a portfolio, the goal is the same: be easier to find, understand and recommend.',
        ],
      },
      {
        h2: 'From Stavanger to the open web',
        body: [
          'We design and engineer from Stavanger, Norway, with production systems built for real crawl data, integrations and secure login for invited users only.',
          'Follow product updates on seo.devndespro.com and the main DevnDespro presence at www.devndespro.com.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Is DevnDespro SEO the same as www.devndespro.com?',
        a: 'www.devndespro.com is the company site. seo.devndespro.com is the SEO product workspace and marketing pages for the platform.',
      },
      {
        q: 'How do I get access?',
        a: 'Request authorised access from the DevnDespro team, then sign in on the login page with your approved account.',
      },
    ],
  },
}

export function getMarketingPage(slug) {
  return MARKETING_PAGES[slug] || null
}

export const ALL_MARKETING_PATHS = Object.values(MARKETING_PAGES).map((p) => p.path)
