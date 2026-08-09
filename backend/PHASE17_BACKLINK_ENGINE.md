# Phase 17 â€” Backlink Intelligence Engine

Pipeline:
Discovery -> Candidate dedupe -> Verification -> Persistence -> Quality -> Authority -> Monitoring -> UI

Completed foundations:
17.2 Verification
17.3 Discovery
17.4 Quality + Authority V3

Production completion requirements:
- Discovery must query an external web/index provider; crawling the target site cannot discover inbound links.
- Never count search results as backlinks.
- Verify the source HTML contains a link to the target domain.
- Canonicalize target/source URLs and deduplicate by source URL + target URL.
- Persist first_seen_at, last_seen_at, last_verified_at and verification evidence.
- Reverification determines New/Live/Lost/Broken/Redirected.
- Dashboard metrics must be derived from verified persisted rows only.
- Authority Score is DevnDespro's proprietary metric; do not label it Ahrefs DR or Semrush Authority Score.
- Keep provider/index coverage separate from scoring quality.
