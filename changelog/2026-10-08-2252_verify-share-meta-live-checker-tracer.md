# 2026-10-08 - Share-meta tracer: a live checker that fails on the tagless dev host and passes on correct output

**Keywords:** [FEATURE] [TESTING] [TOOLING] [SECURITY]
**Session:** Night, Duration (~25 minutes)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-08-2252_verify-share-meta-live-checker-tracer.md`

## What Changed

- File: `tools/verify-share-meta.mjs`
  - New. `checkSharePage()` checks one page's full share tag set (og:*, twitter:*, the three icon links, forbidden X tags, no empty content, no duplicates, the article:* group against the body `<time datetime>` or its absence on a page)
  - `pngDimensions()` reads IHDR and throws without the PNG signature
  - `runShareChecks()` fetches version.json, EN/ES home, a live article and its /es twin (discovered from the homepage), a noindex page, both cards and the three icons, and records status, content type, size, PNG dimensions and x-robots-tag
  - CLI with `--host`, `--noindex-path`, `--expect-stylesheet`, `--json` and a single-file `--html/--lang/--kind` mode; PASS/FAIL/SKIP lines, exit 1 on any FAIL
- File: `tests/unit/verify-share-meta.test.mjs`
  - New. 16 tests: a correct page passes, each broken variant fails exactly the expected checks, D-22 locale alternate, PNG parsing, and `runShareChecks` over an injected fetch (404 icon, wrong card size, non-noindex path, tagless host)
- File: `package.json`
  - Added the `verify:share` script
- File: `changelog/README.md`
  - Index row for this entry

## Why

Plan 07-05 (SOC-07/SOC-08). A tag in the HTML is not a working preview. Before deploying the share work to the dev host there has to be an instrument that proves what the host really serves, and that has itself been seen to fail.

## Issues Encountered

No major issues encountered.

## Dependencies

No dependencies added

## Testing Notes

- What was tested: 16 unit tests pass; the checker exits 0 on the head-harness en-listing, en-article and es-article pages; a live read-only run against dev.915tldr.com exits 1 (no og/twitter tags, icons and cards 404), which is the expected pre-deploy baseline
- What wasn't tested: crawler User-Agent probes and robots.txt resolution (next commit), and any run against a deployed host that carries the tags
- Edge cases: empty content values, self-only hreflang pages, tags on a non-article page, wrong published_time

## Next Steps

- [ ] Add the crawler User-Agent probes and robots.txt group resolution (D-20, edge half)
- [ ] Add the zone-analytics measurement tool

---

**Branch:** feature/phase-07
**Issue:** N/A
**Impact:** LOW - tooling and tests only, nothing user-facing
