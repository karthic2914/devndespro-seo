/**
 * Canonical explanations for score / metric labels (ⓘ tooltips).
 * Keep vendor-neutral - no third-party product names in user copy.
 */
export const SCORE_HELP = {
  siteHealth: {
    title: 'Site Health',
    body:
      'Technical SEO score from your latest site audit (0-100). Based on crawl checks like titles, meta, links, and page issues - not Domain Rank or backlinks. Click the card to open Site Audit.',
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
  aiVisibility: {
    title: 'AI Visibility',
    body:
      'How often AI assistants mention or recommend your brand for your questions (0-100). May also use AI Snippet / AEO audit checks when engine tests are missing.',
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
}

export function getScoreHelp(key) {
  return SCORE_HELP[key] || null
}
