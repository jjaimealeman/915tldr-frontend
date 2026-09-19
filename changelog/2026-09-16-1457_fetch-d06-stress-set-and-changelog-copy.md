# 2026-09-16 - Fetch the Full D-06 Stress Set, Feeds and Category Counts; Copy the Public Changelog

**Keywords:** [FEATURE] [DATABASE] [SECURITY] [BUG_FIX] [DESIGN]
**Session:** Afternoon, Duration (~35 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-16-1457_fetch-d06-stress-set-and-changelog-copy.md`

## What Changed

- File: `design/scripts/fetch-stress-set.mjs`
  - Factored out `PUBLIC`, `ROW` and `WC(col)` SQL constants and expanded `QUERIES` from 1 to 19 case ids: the full D-06 stress set (longest/shortest headline, longest/shortest summary, no-summary, five/max/zero-tags, no-image, junk-image, usable-image, spanish-headline, uncategorized), a 24-row home feed, a 3-candidate category lead + 13-row category feed, the 8 canonical categories with public story counts, and a corpus-stats aggregate. Every query is composed only from `PUBLIC`/`ROW`/`WC()` and SQL literals.
  - Added a chunked (≤50 uuids per query), regex-validated tags lookup that attaches a `tags[]` array to every article row.
  - Added HEAD-request image validation for `usable-image`/`category-lead` — picks the first URL answering 200 with an `image/*` content-type as `chosen`, records the rest as `rejected`.
  - Added `SPANISH_HEADLINE_REVIEW`, a hand-filled lookup recording my own read of all 10 real `spanish-headline` candidates pulled from production D1 — 7 are genuinely Spanish, 3 are English headlines that only matched the `LIKE` filter because they contain the Colombian surname "de la Espriella" or quote a Spanish concert name. The longest genuinely-Spanish row is picked as `chosen`.
  - Copied `915tldr.com2/public/changelog.json` byte-for-byte into `design/fixtures/changelog.json`; recorded its sha256 and asserted its 8-entry count in `_meta.changelog`.
  - Added an `isMain` guard around `main()` (same pattern as `fetch-fonts.mjs` from 01-02) so importing `QUERIES`/`PUBLIC`/`ROW`/`WC` to inspect real candidates doesn't trigger a live D1 fetch as an import side effect.
- File: `design/scripts/lib/d1-read.mjs`
  - Fixed the read-only guard's `REPLACE` write-keyword check, which was also matching the harmless SQL scalar function `replace(x, y, z)` (needed by this task's `WC()` helper) and refusing every query that used it. Added a negative lookahead so a keyword immediately followed by `(` (a function call) isn't blocked, while real write statements (`REPLACE INTO`, `INSERT OR REPLACE INTO`, etc.) are still refused.
- File: `design/fixtures/stress-set.json`
  - Regenerated via `npm run data:stress` against the real, production, read-only D1 database: 1,849,229 total rows read across 19 queries (max single query 438,241 — under the 500,000 per-query cap), $0 cost (included reads on the paid plan). Every row is `status: processed`, non-duplicate, and never carries the `content` column.
- File: `design/fixtures/changelog.json` (new)
  - Byte-identical copy of the real public changelog, 8 entries.

## Why

The mockups (01-06, 01-07) need to be designed against real, pathological corpus data rather than a comfortable recent slice — per D-06, "if the grid holds for the pathological rows, it holds for 41,233 articles." Building this fixture first, before any mockup markup, means layout failures surface now instead of after 41k pages are built in Phase 4.

## Issues Encountered

- The existing read-only D1 guard (`d1-read.mjs`, from 01-02) refused every query using SQL's `replace()` string function — its `REPLACE` write-keyword regex had no way to distinguish `REPLACE INTO` (a write statement) from `replace(...)` (a read-only scalar function). Fixed with a negative lookahead; verified both the fix (function calls now pass) and that real write forms are still refused.
- One D-06 case, `no-summary`, came back genuinely empty (`{ absent: true, reason: "no public row matches" }`) — expected, not a bug: today's summaries are all padded to a 100-200 word floor (PRD §8.2), so no row currently has a null/empty summary. Phase 2 removes that floor, at which point this case will populate.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: the plan's full automated `<verify>` block (case-id presence, no `content` column, canonical category order, 24-row feed, non-zero `rowsReadTotal`, byte-identical changelog copy via `cmp`) plus every `<acceptance_criteria>` check (processed-only rows, `usable-image` grep, live inspection of absent cases and the chosen Spanish headline).
- What wasn't tested: the D-15 Spanish-copy calibration (Task 2, not yet started).
- Edge cases: `no-summary` absence (see above); 3 of 10 `spanish-headline` LIKE-matches were false positives (English headlines containing a Spanish surname/quoted title) and were hand-excluded from `chosen`.

## Next Steps

- [ ] Task 2: author real Spanish copy and calibrate the synthetic +25% width floor in the real fonts (D-15)

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** MEDIUM - Builds the fixture data the phase's mockups will be designed against; also fixes a latent bug in shared D1 read-only infrastructure from 01-02.
