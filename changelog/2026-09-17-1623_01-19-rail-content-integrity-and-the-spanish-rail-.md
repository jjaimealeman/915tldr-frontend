# 2026-09-17 - Rail content integrity and the Spanish rail heading (Task 2)

**Keywords:** [FEATURE] [TESTING]
**Session:** Afternoon
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-17-1623_01-19-rail-content-integrity-and-the-spanish-rail-.md`

## What Changed

- File: `design/tests/content.spec.ts`
  - New `describe('content: article rail')` block (5 tests, all `@c1`): exactly two `[data-rail] section[data-grid]`; every rail `[data-card]` is `data-card-variant="compact"` with a non-empty category name and headline and no `[data-frame]`/`[data-summary]`; every rail card's `h3` text equals the fixture row's own title for its uuid, whitespace-normalised; every "More in Community" card carries `data-category="community"`; the "Latest" grid's `time[datetime]` values are non-increasing and its uuids never repeat the article's own uuid or a "More in Community" uuid; and the "Latest" uuids equal the five most recent `cases.feed` rows (after those exclusions) in the exact fixture-derived order, computed from the fixture at test time rather than hardcoded.
- File: `design/fixtures/spanish-stress.json`
  - New component `rail-heading` (page `article`, `fontRole` `headline`, en "Latest", `es_real` "Últimas noticias" — translated in-session, no paid API, per the A-05 precedent). Calibrated via `node design/scripts/calibrate-spanish.mjs --only=rail-heading`: `widthRatio` 1.2883, `hi` 1.5222, both comfortably clearing the 1.24 floor. `git diff` on the fixture shows only this one new entry.

## Why

Proves the rail introduced in Task 1 is provably real content in the correct order (not a stub or a fabricated grid) and survives the project's Spanish-stress regime, closing out the two remaining `must_haves` of 01-19-PLAN.md.

## Issues Encountered

None.

## Dependencies

No new dependencies.

## Testing Notes

- What was tested: `MOCKUP_PAGES=article node design/scripts/pw.mjs --project=all design/tests/content.spec.ts` (25/25 x2, both engines, including the 5 new rail tests); `MOCKUP_PAGES=article node design/scripts/pw.mjs --project=all design/tests/spanish-overflow.spec.ts` (7/7 x2, both engines — injection at 320/768/1280px, 320px and 200% zoom reflow, all now covering the rail's `rail-heading` component via its `data-i18n` hook); the plan's own node fixture check (`rail-heading` present, `page: "article"`, `es_real` exact match, `widthRatio >= 1.24`) — all pass.
- What wasn't tested: nothing deferred — this closes both of the plan's tasks.

## Next Steps

- [ ] Write 01-19-SUMMARY.md, update STATE.md/ROADMAP.md, complete the plan

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** MEDIUM — proves the rail introduced in Task 1 is real, ordered, non-duplicate content that survives the Spanish-stress regime, verified in both engines
