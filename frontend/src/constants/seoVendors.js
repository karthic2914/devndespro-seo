/**
 * Industry vendor references for SEO features.
 * Live data today is primarily DataForSEO (+ GSC; optional Ahrefs import).
 * UX / metric design should stay aligned with this full set — not Ahrefs/Semrush only.
 */
export const SEO_VENDOR_REFERENCES = [
  { id: 'moz', name: 'Moz', strengths: ['Domain Authority', 'Page Authority', 'Link Explorer', 'Spam Score'] },
  { id: 'majestic', name: 'Majestic', strengths: ['Trust Flow', 'Citation Flow', 'Topical trust'] },
  { id: 'ahrefs', name: 'Ahrefs', strengths: ['Domain Rating', 'URL Rating', 'Referring domains', 'Broken backlinks'] },
  { id: 'semrush', name: 'Semrush', strengths: ['Backlink Gap', 'Keyword Gap', 'Competitive analysis'] },
  { id: 'se-ranking', name: 'SE Ranking', strengths: ['Competitor research', 'Backlink checker'] },
  { id: 'serpstat', name: 'Serpstat', strengths: ['Keyword research', 'Backlink analysis'] },
  { id: 'dataforseo', name: 'DataForSEO', strengths: ['Live API engine used in this product'] },
]

export const ACTIVE_LIVE_PROVIDERS = {
  backlinks: 'dataforseo',
  keywords: 'dataforseo',
  searchConsole: 'google_gsc',
  optionalSummaryImport: 'ahrefs',
  competitorEnrichment: ['site_crawl', 'ai'],
}
