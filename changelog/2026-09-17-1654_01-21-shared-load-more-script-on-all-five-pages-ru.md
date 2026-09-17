# 2026-09-17 - Shared load-more script on all five pages, runner checks the feed (Task 2)

**Keywords:** [FEATURE] [TESTING]
**Session:** Afternoon
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-17-1654_01-21-shared-load-more-script-on-all-five-pages-ru.md`

## What Changed

- Files: `design/mockups/category.html`, `article.html`, `changelog.html`, `contact.html`
  - Head `<script>` block replaced byte-for-byte with index.html's (Task 1's) load-more-extended script. On these four pages `document.querySelector('[data-load-more]')` finds nothing, so the routine's early `if (!loadMoreBtn) return;` makes it a no-op — closes structure.spec.ts's "head script drift guard" across all five pages.
- File: `design/scripts/verify-phase-1.mjs`
  - `nodeCheckC1`'s allowed `design/mockups` entries now include `feed` (D-05 amendment, 01-21).
  - New `nodeCheckFeed`, imported `validateFeedPage` from `build-feed.mjs`: when `design/mockups/feed` exists, it validates every `page-<n>.json` file's shape against `validateFeedPage`, walks the chain starting at index.html's load-more button's `data-next` to prove every feed file is visited exactly once and the chain terminates at `null`, checks that the cards inside index.html's `feed:start`/`feed:end` markers plus every feed page's cards equal `design/fixtures/home-feed.json`'s cards in order (compared by `uuid`/`stress`), and checks that the shared head script contains exactly one `fetch(` call.

## Why

Closes Task 2 of the revision-request-8 vertical slice: the feed is now guarded by the same runner (`verify-phase-1.mjs`) that gates approval, and the shared script contract holds on every page, not just index.

## Issues Encountered

None — this task's own new checks passed on the first run once the script copy and allow-list update were in place.

## Dependencies

No new dependencies.

## Testing Notes

- What was tested: `node design/scripts/pw.mjs --project=all design/tests/structure.spec.ts` (96/96, both engines, including the previously-failing head-script drift guard); `pnpm run verify:phase-1 --pages=index,category --criteria=1` (criterion 1 PASS across Chromium, WebKit, and Node checks); the validator sanity check from this plan's own acceptance criteria (`validateFeedPage` rejects a page whose `next` points past the last file, and accepts the real `page-2.json`) — exits 0.
- What wasn't tested: criteria 2-5 (out of this scoped run's declared scope; unaffected by this task's changes).

## Next Steps

- [ ] Task 3: full `[data-load-more]`/`[data-load-more-status]` styling, keyboard-walk coverage of the load-more interaction itself, `feed:build` pnpm script, 01-CONTEXT.md D-05/D-12 amendments

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** MEDIUM — closes the cross-page consistency and runner-guard half of the load-more vertical slice
