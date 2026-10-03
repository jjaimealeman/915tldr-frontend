# 2026-10-02 - robots.txt: allow PerplexityBot and Perplexity-User

**Keywords:** [SEO] [CONFIG]
**Session:** Evening, Duration (~5 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-02-1800_robots-allow-perplexity.md`

## What Changed

- File: `public/robots.txt`
  - Removed `PerplexityBot` from the "AI TRAINING BOTS - BLOCKED" section
  - Added `PerplexityBot` and `Perplexity-User` to "AI ASSISTANTS / RAG - ALLOWED"

## Why

Owner decision 2026-10-02: opt out of AI training (`ai-train=no`) but allow AI search and
answer-time citation (`ai-input=yes`). PerplexityBot powers Perplexity's cited search answers
rather than model training, so blocking it contradicted the file's own content signal.

## Issues Encountered

No major issues encountered.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: diff reviewed; file structure (groups, Sitemap lines) unchanged otherwise
- What wasn't tested: not rebuilt or deployed; dev.915tldr.com picks it up on the next deploy
- Edge cases: n/a

## Next Steps

- [ ] At v2 cutover: enable AI Crawl Control managed robots.txt / block-AI-training toggles on the 915tldr.com zone

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** LOW - static robots.txt policy change, owner-approved
