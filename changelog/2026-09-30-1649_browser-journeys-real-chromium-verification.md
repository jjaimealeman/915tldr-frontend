# 2026-09-30 - Real-Browser Reader Journeys Verified Against Deployed dev.915tldr.com

**Keywords:** [TESTING] [FRONTEND] [SEO]
**Session:** Afternoon, Duration (~20 minutes)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-30-1649_browser-journeys-real-chromium-verification.md`

## What Changed

- File: `tests/integration/browser-journeys.test.mjs` (new)
  - Drives the deployed `dev.915tldr.com` with a real Chromium browser (`node:test` + the
    `chromium` launcher exported directly by `@playwright/test`, launched with the same
    fontconfig isolation `design/scripts/pw.mjs` uses for native runs).
  - Six journeys: (1) home -> real mouse click on the Crime nav link -> real mouse click on the
    first article card, asserting each navigation's own response status and that
    `response.request().redirectedFrom()` is null; (2) a non-canonical `/article/<uuid>` URL for
    a real, currently-live article ends on the canonical path after exactly one 301 hop, walked
    via the browser's own redirect chain (`request.redirectedFrom()`), not a second `fetch`;
    (3) an unknown-uuid path built from a real article's own category+slug shows
    `[data-404-suggestions]` visible with at least one link within 5 seconds; (4) `/categories`
    ends on the homepage; (5) `/crime/` ends on `/crime`; (6) captures article-page screenshots
    at 320px and 1280px into the session scratchpad (not committed) for the owner's prominence
    check.

## Why

CLAUDE.md's verification standard: "drive the path the user takes, not just a path." A `fetch`
with `redirect: 'manual'` (this plan's `tests/integration/url-shapes.test.mjs`) proves the HTTP
contract, but a real click, a real redirect-chain record, and real client-side JavaScript
(the 404 page's suggestion script) are a different code path — this file proves those hold too.

## Issues Encountered

None. All 6 journeys passed on the first real run against the deployment from this plan's Task 1.

## Dependencies

No dependencies added — `@playwright/test` (already a devDependency, Chromium already installed
locally) supplies the `chromium` launcher used here.

## Testing Notes

- What was tested: all 6 journeys, real Chromium, against the real deployed `dev.915tldr.com`.
- What wasn't tested: WebKit/Safari (out of scope for this plan — this is a live-site contract
  check, not the Phase 1 cross-engine design-fidelity suite); the owner's own visual prominence
  judgment on the captured screenshots (explicitly a human-only check, Task 3).
- Edge cases: the redirect-chain assertion specifically checks for exactly one hop (not "at least
  one"), and the 404-suggestions check uses a real article's own title/slug words so the
  client-side matching script has a genuine match to find, not a synthetic one.

## Next Steps

- [ ] Task 3: fill `04-VALIDATION.md`'s per-task verification map and hand off the owner's
      human-only checklist (Rich Results, prominence, production activation)

---

**Branch:** feature/phase-04
**Issue:** N/A
**Impact:** LOW - new test file only; no production code path changed
