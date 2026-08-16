/**
 * Canonical explanations for score / metric labels (ⓘ tooltips).
 * Keep vendor-neutral - no third-party product names in user copy.
 */
export const SCORE_HELP = {
  siteHealth: {
    title: 'Site Health',
    body:
      'Technical SEO score from your latest site audit (0-100). Based on crawl checks like titles, meta, links, and page issues - not Domain Rank or backlinks.',
  },
  homepageHealth: {
    title: 'Homepage Health',
    body:
      'Audit score for your homepage only (0-100). Full Site Health may include more pages from a multipage crawl.',
  },
  growthScore: {
    title: 'Digital Growth Score',
    body:
      'Overall priority score (0-100) combining Site Health, Domain Rank or Link Score, and AI Visibility. Higher means you are in better shape across SEO and AI.',
  },
  domainRank: {
    title: 'Domain Rank',
    body:
      'External domain authority score (0-100). Measures how strong the domain looks overall. Separate from Link Score, which is based on your tracked backlinks in this app.',
  },
  linkScore: {
    title: 'Link Score',
    body:
      'Our composite score from your verified / tracked backlinks (0-100). Reflects link quality in this app - not the same as Domain Rank.',
  },
  linkScorePotential: {
    title: 'Link Score potential',
    body:
      'Estimated Link Score if you complete the top link opportunities shown. It is a planning guide, not a live web score.',
  },
  referringDomains: {
    title: 'Referring Domains',
    body:
      'Part of Link Score: how strong your set of unique linking websites looks.',
  },
  followNaturality: {
    title: 'Follow Naturality',
    body:
      'Part of Link Score: balance of dofollow vs nofollow links. Natural profiles are usually healthier than all-dofollow spam.',
  },
  linkQualityBreakdown: {
    title: 'Link Quality',
    body:
      'Part of Link Score: quality of individual tracked backlinks (anchors, spam risk, verification).',
  },
  aiVisibility: {
    title: 'AI Visibility',
    body:
      'How often AI assistants mention or recommend your brand for your questions (0-100). May also use AI Snippet / AEO audit checks when engine tests are missing.',
  },
  overallScore: {
    title: 'Visibility Score',
    body:
      'Your overall AI visibility score across tested questions. Higher means AI engines mention or recommend you more often.',
  },
  mentionRate: {
    title: 'Mention Rate',
    body:
      'Share of tested questions where your brand was mentioned in AI answers.',
  },
  averageRank: {
    title: 'Average Position',
    body:
      'Average rank when your brand appears in AI answers (within the top 10). Lower is better.',
  },
  enginesInTop10: {
    title: 'Engines in Top 10',
    body:
      'How many AI engines place your brand in their top 10 answers for your questions.',
  },
  questionsTested: {
    title: 'Questions Tested',
    body:
      'How many of your AI Visibility questions have been scanned at least once.',
  },
  chatgpt: {
    title: 'ChatGPT',
    body:
      'How visible your brand is in ChatGPT answers for your tested questions (0-100).',
  },
  claude: {
    title: 'Claude',
    body:
      'How visible your brand is in Claude answers for your tested questions (0-100).',
  },
  aiSnippet: {
    title: 'AI Snippet',
    body:
      'On-page readiness for AI snippets from your site audit checks (0-100).',
  },
  aeo: {
    title: 'AEO',
    body:
      'Answer Engine Optimization readiness from your site audit checks (0-100).',
  },
  onPageSeo: {
    title: 'On-Page SEO',
    body: 'Audit score for titles, meta, headings, and on-page content checks (0-100).',
  },
  technicalSeo: {
    title: 'Technical SEO',
    body: 'Audit score for crawlability, indexation, and technical site checks (0-100).',
  },
  contentQuality: {
    title: 'Content Quality',
    body: 'Audit score for content depth, uniqueness, and related content checks (0-100).',
  },
  pageSpeed: {
    title: 'Page Speed',
    body: 'Performance score for how fast pages load (0-100).',
  },
  serverSecurity: {
    title: 'Server & Security',
    body: 'Audit score for HTTPS, headers, and server/security checks (0-100).',
  },
  advancedSeo: {
    title: 'Advanced SEO',
    body: 'Audit score for advanced SEO signals and structured checks (0-100).',
  },
  dr: {
    title: 'DR (Domain Rank)',
    body:
      'Domain Rank of the referring site (0-100). Higher means a stronger domain, but it does not guarantee a good or safe link - check Quality too.',
  },
  quality: {
    title: 'Quality',
    body:
      'Our link quality label (Good / OK / Risk / Spam) plus a score. Spam can still appear on high-DR sites if the link pattern looks toxic.',
  },
  good: {
    title: 'Good links',
    body: 'Tracked backlinks that look strong - solid quality and useful Domain Rank.',
  },
  ok: {
    title: 'OK links',
    body: 'Average / usable backlinks - worth keeping, not top-tier.',
  },
  risk: {
    title: 'Risk links',
    body: 'Weak, lost, broken, or low-quality links that need review.',
  },
  spam: {
    title: 'Spam links',
    body: 'Links flagged as likely toxic. Review and remove/disavow on the web - removing here only clears your tracking list.',
  },
  dofollow: {
    title: 'Dofollow',
    body: 'Links that can pass ranking value (no nofollow). Count of dofollow links in your tracked set.',
  },
  live: {
    title: 'Live',
    body: 'Backlinks currently marked Live in your tracking list.',
  },
  googleVisibility: {
    title: 'Google visibility',
    body:
      'Keywords we found where your site already shows up in Google (or Search Console). Good candidates to keep tracking.',
  },
  goodToHave: {
    title: 'Good to have',
    body:
      'Opportunity keywords worth targeting - useful volume and reachable difficulty, but you may not rank for them yet.',
  },
  howToGetThem: {
    title: 'How to get them',
    body:
      'Suggested content or SEO angles to win those opportunity keywords - not live rankings yet.',
  },
  keywordGap: {
    title: 'Keyword gap',
    body:
      'Keywords competitors rank for that you don’t - use this to find content and SEO opportunities.',
  },
  keywordResearch: {
    title: 'Keyword Research',
    body:
      'Search seed keywords for volume, difficulty, intent, trends, and related ideas, then add the best ones to your track list.',
  },
  gscClicks: {
    title: 'GSC Clicks',
    body: 'Clicks from Google Search to your site in the selected Search Console period.',
  },
  impressions: {
    title: 'Impressions',
    body: 'How often your site appeared in Google Search results in the selected period.',
  },
  avgPosition: {
    title: 'Avg. Position',
    body: 'Average ranking position in Google Search for queries in the selected period. Lower is better.',
  },
  trackedKeywords: {
    title: 'Tracked Keywords',
    body: 'Number of keywords you are actively tracking in this project.',
  },
  auditWarnings: {
    title: 'Warnings',
    body: 'Audit issues that are not critical but should be fixed to improve Site Health.',
  },
  healthyPages: {
    title: 'Healthy pages',
    body: 'Pages that passed audit checks without major errors in the latest crawl.',
  },
}

export function getScoreHelp(key) {
  return SCORE_HELP[key] || null
}

/** Map audit category display names to tip keys */
export function auditCategoryScoreKey(name) {
  const map = {
    'On-Page SEO': 'onPageSeo',
    'Technical SEO': 'technicalSeo',
    'Content Quality': 'contentQuality',
    'Page Speed': 'pageSpeed',
    'Server & Security': 'serverSecurity',
    'Advanced SEO': 'advancedSeo',
    'AI Snippet': 'aiSnippet',
    AEO: 'aeo',
  }
  return map[name] || null
}
