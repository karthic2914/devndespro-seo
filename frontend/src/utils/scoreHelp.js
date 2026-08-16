/**
 * Canonical explanations for the four main SEO scores.
 * Keep copy short — shown in ⓘ tooltips.
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
      'External authority score from DataForSEO (0–100, DA-style). It can look similar to Ahrefs DR but is not Moz DA or Ahrefs. Separate from our in-app Link Score.',
  },
  linkScore: {
    title: 'Link Score',
    body:
      'Our composite score from your verified / tracked backlinks (0–100). Reflects link quality in this app — not the same as Domain Rank.',
  },
  aiVisibility: {
    title: 'AI Visibility',
    body:
      'How often AI engines (e.g. ChatGPT / Claude) mention or recommend your brand for your questions (0–100). May also use AI Snippet / AEO audit checks when engine tests are missing.',
  },
}

export function getScoreHelp(key) {
  return SCORE_HELP[key] || null
}
