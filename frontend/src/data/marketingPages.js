/** Shared copy for public marketing routes (React + static crawl shells). */

export const MARKETING_NAV = [
  { path: '/features', label: 'Features' },
  { path: '/seo-audit', label: 'Site Audit' },
  { path: '/ai-visibility', label: 'AI Visibility' },
  { path: '/pricing', label: 'Pricing' },
  { path: '/about', label: 'About' },
]

export const MARKETING_PAGES = {
  features: {
    path: '/features',
    title: 'SEO Features — Site Audit, Keywords, Backlinks & AI | DevnDespro',
    description:
      'Explore DevnDespro SEO features: technical site audits, keyword tracking, backlink monitoring, and AI citation visibility for Nordic teams.',
    h1: 'Everything you need to improve search and AI visibility',
    eyebrow: 'PLATFORM FEATURES',
    intro:
      'DevnDespro SEO brings technical SEO, ranking intelligence, link monitoring and AI visibility into one private workspace. Stop jumping between tools — see what blocks growth and what to fix next.',
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
          'Use clear recommendations ordered by visibility impact — not generic SEO checklists that ignore how discovery is changing.',
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
    title: 'AI Visibility Tracking — ChatGPT & Claude Citations | DevnDespro',
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
          'Answer engines summarise the web and often cite a short list of trusted sources. If your site is thin, unclear or poorly structured, you are less likely to be mentioned — even if you rank for a few classic keywords.',
          'AI visibility monitoring shows whether your brand appears in assistant answers for prompts that matter to your market, and highlights gaps competitors already fill.',
        ],
      },
      {
        h2: 'How DevnDespro measures AI signals',
        body: [
          'Run structured AI visibility checks for your domain, review citation outcomes, and track score history over time. Results live next to Site Audit and Action Plan so technical fixes and content improvements support both Google and AI discovery.',
          'Combine AI findings with Nordic search context — language, local intent and regional competitors — instead of treating AI SEO as a separate science experiment.',
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
    title: 'SEO Site Audit Tool — Technical & Content Health | DevnDespro',
    description:
      'Run technical SEO site audits: crawl issues, titles, H1s, content quality and Site Health scoring. Built for teams who need clear fix priorities.',
    h1: 'Site audits that turn crawl issues into an action plan',
    eyebrow: 'SEO SITE AUDIT',
    intro:
      'DevnDespro Site Audit crawls your pages, scores Site Health, and lists critical issues and warnings by impact. Fix what blocks indexing and rankings first — then re-check to prove improvement.',
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
          'Many marketing sites are React or Vite SPAs. Our crawler can use static HTML when present and optional headless rendering when the shell is empty — so H1 and word-count checks better match what users see.',
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
        a: 'Aim to clear critical errors first. Scores climb as duplicates, thin pages and technical blockers disappear — progress matters more than a single number.',
      },
    ],
  },

  'keyword-tracking': {
    path: '/keyword-tracking',
    title: 'Keyword Tracking Software — Rank Monitoring | DevnDespro',
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
          'When rankings slip, pair keyword evidence with Site Audit findings — thin content, weak titles or technical issues often explain the drop.',
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
    title: 'Backlink Monitoring Tool — Links, Spam & Disavow | DevnDespro',
    description:
      'Monitor backlinks, referring domains and spam risk. Export disavow files and track cleanup with DevnDespro backlink monitoring.',
    h1: 'Backlink monitoring with spam controls that teams actually use',
    eyebrow: 'BACKLINK MONITORING',
    intro:
      'Links still influence trust and discovery — but toxic profiles create risk. DevnDespro helps you monitor referring domains, spot spam patterns, export disavow candidates and verify cleanup over time.',
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
          'Flag suspicious links, export CSV or disavow text files, and follow Google’s disavow process with a simple status tracker — submitted, waiting, ready to re-check.',
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
    title: 'Pricing — DevnDespro SEO Plans',
    description:
      'Simple pricing for DevnDespro SEO. Private beta access for authorised teams — site audits, keywords, backlinks and AI visibility in one workspace.',
    h1: 'Pricing built for focused SEO teams',
    eyebrow: 'PRICING',
    intro:
      'DevnDespro SEO is currently offered through private beta and plan-based workspace access. Get Site Audit, project workspaces and optional modules for keywords, backlinks and AI visibility — without enterprise bloat.',
    sections: [
      {
        h2: 'What you get in the workspace',
        body: [
          'Core Site Audit and Site Health scoring, project-based hostname tracking, Action Plan sync and integrations such as Google Search Console when connected.',
          'Optional modules unlock keyword tracking, backlink monitoring and AI visibility depending on your plan and admin feature flags.',
        ],
      },
      {
        h2: 'Private beta access',
        body: [
          'Access is restricted to authorised users during private beta. Request access from the DevnDespro team, then sign in with your approved email or Google account.',
          'We keep the product opinionated and calm — fewer vanity charts, more signals you can act on this week.',
        ],
      },
      {
        h2: 'Talk to us about your team',
        body: [
          'Agencies and in-house teams often need multiple projects, controlled user invites and clear reporting. Tell us how many domains you manage and which modules you need first.',
          'Start with a free audit mindset: prove Site Health value, then expand into keywords, links and AI citations.',
        ],
      },
    ],
    faqs: [
      {
        q: 'Is there a free trial?',
        a: 'Private beta seats are granted by invitation. Contact DevnDespro to see if your team qualifies for early access.',
      },
      {
        q: 'Can I change modules later?',
        a: 'Yes. Admins can adjust feature access as your workflow matures — start lean, add depth when it pays off.',
      },
    ],
  },

  about: {
    path: '/about',
    title: 'About DevnDespro SEO — Built in Stavanger, Norway',
    description:
      'DevnDespro SEO is built in Stavanger, Norway for Nordic teams who need practical SEO, site audits and AI visibility in one workspace.',
    h1: 'Built in Stavanger for teams who need practical SEO clarity',
    eyebrow: 'ABOUT',
    intro:
      'DevnDespro builds digital products with a bias toward clarity. Our SEO platform helps Nordic businesses understand site health, rankings, links and AI visibility — then act in priority order.',
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
