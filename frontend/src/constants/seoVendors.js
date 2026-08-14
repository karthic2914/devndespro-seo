/**
 * Industry vendor references for SEO features.
 * Live data today is primarily DataForSEO (+ GSC; optional Ahrefs import).
 * UX / metric design should stay aligned with this full set — not Ahrefs/Semrush only.
 */
export const SEO_VENDOR_REFERENCES = [
  {
    id: 'moz',
    name: 'Moz',
    strengths: ['Domain Authority', 'Page Authority', 'Keyword Difficulty', 'SERP analysis', 'Link Explorer'],
  },
  {
    id: 'majestic',
    name: 'Majestic',
    strengths: ['Trust Flow', 'Citation Flow', 'Topical trust', 'Link context'],
  },
  {
    id: 'ahrefs',
    name: 'Ahrefs',
    strengths: ['Domain Rating', 'Matching terms', 'Related terms', 'Keyword Difficulty', 'Traffic potential', 'SERP overview'],
  },
  {
    id: 'semrush',
    name: 'Semrush',
    strengths: ['Keyword Overview', 'Phrase match', 'Keyword Gap', 'Intent', 'AI Overview', 'Competitive analysis'],
  },
  {
    id: 'se-ranking',
    name: 'SE Ranking',
    strengths: ['Keyword research', 'Competitor research', 'Rank tracking', 'Backlink checker'],
  },
  {
    id: 'serpstat',
    name: 'Serpstat',
    strengths: ['Keyword research', 'URL analysis', 'Competitor keywords', 'Backlink analysis'],
  },
  {
    id: 'dataforseo',
    name: 'DataForSEO',
    strengths: ['Live API engine used in this product', 'Labs keyword metrics', 'SERP live', 'AI Overview'],
  },
]

/** Shared keyword-research metrics expected across major SEO platforms */
export const KEYWORD_INDUSTRY_METRICS = [
  'search_volume',
  'keyword_difficulty',
  'cpc',
  'competition',
  'intent',
  'trend',
  'serp_results_count',
  'organic_serp',
  'related_terms',
  'questions',
  'keyword_gap',
  'rank_tracking',
  'ai_overview',
]

export const ACTIVE_LIVE_PROVIDERS = {
  backlinks: 'dataforseo',
  keywords: 'dataforseo',
  searchConsole: 'google_gsc',
  optionalSummaryImport: 'ahrefs',
  competitorEnrichment: ['site_crawl', 'ai'],
}
