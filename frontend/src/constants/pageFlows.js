/**
 * Shared SEO workflows - vendor-neutral page + app journeys.
 * Used so users see the same process pattern everywhere.
 */
export const APP_SEO_JOURNEY = [
  {
    id: 'audit',
    label: 'Audit site',
    hint: 'Find technical & on-page issues',
    path: 'audit',
  },
  {
    id: 'keywords',
    label: 'Keywords',
    hint: 'Research, gap, track & check ranks',
    path: 'keywords',
  },
  {
    id: 'backlinks',
    label: 'Backlinks',
    hint: 'Discover links & find prospects',
    path: 'backlinks',
  },
  {
    id: 'competitors',
    label: 'Competitors',
    hint: 'Save same-niche rivals',
    path: 'competitors',
  },
  {
    id: 'actions',
    label: 'Actions',
    hint: 'Turn issues into tasks',
    sectionId: 'audit-section-actions-desktop',
  },
]

/** Overview (first page): fix-website first, then grow. */
export const OVERVIEW_PAGE_FLOW = [
  {
    id: 'fix',
    label: 'Fix website',
    hint: 'Highest-impact Action Plan tasks',
    sectionId: 'overview-section-fixes',
  },
  {
    id: 'keywords',
    label: 'Keywords',
    hint: 'Track & improve rankings',
    sectionId: 'overview-section-keywords',
    path: 'keywords',
  },
  {
    id: 'grow',
    label: 'Grow',
    hint: 'Backlinks & AI Visibility',
    sectionId: 'overview-section-grow',
    path: 'backlinks',
  },
]

export const KEYWORDS_PAGE_FLOW = [
  {
    id: 'gap',
    label: 'Keyword gap',
    hint: 'Competitors → Compare → Track missing',
    sectionId: 'kw-section-gap',
  },
  {
    id: 'discover',
    label: 'Discover',
    hint: 'Rediscover from project / GSC',
    sectionId: 'kw-section-discovery',
  },
  {
    id: 'research',
    label: 'Research',
    hint: 'Seed → Search → Overview & ideas',
    sectionId: 'kw-section-research',
  },
  {
    id: 'track',
    label: 'Track list',
    hint: 'Build your tracked keywords',
    sectionId: 'kw-section-tracked',
  },
  {
    id: 'rank',
    label: 'Check ranks',
    hint: 'Check Page 1 / Weekly scan',
    sectionId: 'kw-section-tracked',
  },
]

export const BACKLINKS_PAGE_FLOW = [
  {
    id: 'overview',
    label: 'Overview',
    hint: 'See link profile & quality',
    sectionId: 'bl-section-hub',
    tab: 'overview',
  },
  {
    id: 'discover',
    label: 'Discover links',
    hint: 'Sync / crawl / import backlinks',
    sectionId: 'all-backlinks',
  },
  {
    id: 'review',
    label: 'Review',
    hint: 'Broken links & referring domains',
    sectionId: 'bl-section-hub',
    tab: 'referring',
  },
  {
    id: 'gap',
    label: 'Backlink gap',
    hint: 'Find sites linking to competitors',
    sectionId: 'bl-section-hub',
    tab: 'gap',
  },
]

export const COMPETITORS_PAGE_FLOW = [
  {
    id: 'describe',
    label: 'Your niche',
    hint: 'Business description helps auto-fill',
    sectionId: 'comp-section-setup',
  },
  {
    id: 'add',
    label: 'Add competitors',
    hint: 'Manual domains or Auto-discover',
    sectionId: 'comp-section-list',
  },
  {
    id: 'keywords',
    label: 'Keyword gap',
    hint: 'Compare rankings vs them',
    path: 'keywords',
  },
  {
    id: 'backlinks',
    label: 'Backlink gap',
    hint: 'Find shared link prospects',
    path: 'backlinks',
  },
]

export const AUDIT_PAGE_FLOW = [
  {
    id: 'run',
    label: 'Run audit',
    hint: 'Quick or full site crawl',
    sectionId: 'audit-section-run',
  },
  {
    id: 'review',
    label: 'Review issues',
    hint: 'Sort by impact & fixability',
    sectionId: 'audit-section-issues',
  },
  {
    id: 'actions',
    label: 'Actions',
    hint: 'Turn issues into tasks',
    sectionId: 'audit-section-actions-desktop',
  },
  {
    id: 'recheck',
    label: 'Re-check',
    hint: 'Re-run after fixes',
    sectionId: 'audit-section-run',
  },
]

export const ACTIONS_PAGE_FLOW = [
  {
    id: 'priority',
    label: 'Next best move',
    hint: 'Start with highest impact',
    sectionId: 'actions-section-banner',
  },
  {
    id: 'pending',
    label: 'Pending tasks',
    hint: 'Work the queue top-down',
    sectionId: 'actions-section-list',
  },
  {
    id: 'complete',
    label: 'Mark fixed',
    hint: 'Complete to unlock score bumps',
    sectionId: 'actions-section-list',
  },
]

export const AI_VISIBILITY_PAGE_FLOW = [
  {
    id: 'score',
    label: 'Score Overview',
    hint: 'See if AI mentions you',
    sectionId: 'ai-section-score',
  },
  {
    id: 'test',
    label: 'Test Question',
    hint: 'Check ChatGPT & Claude',
    sectionId: 'ai-section-test',
  },
  {
    id: 'pr',
    label: 'Digital PR',
    hint: 'Earn media that AI trusts',
    sectionId: 'ai-section-pr',
  },
]
