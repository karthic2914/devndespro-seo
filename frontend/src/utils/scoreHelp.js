/**
 * Canonical explanations for score labels (ⓘ tooltips).
 * Keep vendor-neutral — no third-party product names in user copy.
 */
export const SCORE_HELP = {
  siteHealth: {
    title: 'Site Health',
    body:
      'Technical SEO score from your latest site audit (0–100). Based on crawl checks like titles, meta, links, and page issues — not Domain Rank or backlinks.',
  },
  domainRank: {
    title: 'Domain Rank',
    body:
      'External domain authority score (0–100). Measures how strong the domain looks overall. Separate from Link Score, which is based on your tracked backlinks in this app.',
  },
  linkScore: {
    title: 'Link Score',
    body:
      'Our composite score from your verified / tracked backlinks (0–100). Reflects link quality in this app — not the same as Domain Rank.',
  },
  aiVisibility: {
    title: 'AI Visibility',
    body:
      'How often AI assistants mention or recommend your brand for your questions (0–100). May also use AI Snippet / AEO audit checks when engine tests are missing.',
  },
  dr: {
    title: 'DR (Domain Rank)',
    body:
      'Domain Rank of the referring site (0–100). Higher means a stronger domain, but it does not guarantee a good or safe link — check Quality too.',
  },
  quality: {
    title: 'Quality',
    body:
      'Our link quality label (Good / OK / Risk / Spam) plus a score. Spam can still appear on high-DR sites if the link pattern looks toxic.',
  },
  googleVisibility: {
    title: 'Google visibility',
    body:
      'Keywords we found where your site already shows up in Google (or Search Console). Good candidates to keep tracking.',
  },
  goodToHave: {
    title: 'Good to have',
    body:
      'Opportunity keywords worth targeting — useful volume and reachable difficulty, but you may not rank for them yet.',
  },
  howToGetThem: {
    title: 'How to get them',
    body:
      'Suggested content or SEO angles to win those opportunity keywords — not live rankings yet.',
  },
}

export function getScoreHelp(key) {
  return SCORE_HELP[key] || null
}
