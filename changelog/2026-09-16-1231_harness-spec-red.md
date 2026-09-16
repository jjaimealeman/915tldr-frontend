# 2026-09-16 - Harness Spec Written (TDD Red)

**Keywords:** [TESTING] [CONFIG]
**Session:** Afternoon, Duration (~10 minutes)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-16-1231_harness-spec-red.md`

## What Changed

- File: `design/tests/harness.spec.ts`
  - 9 tests for the mockup static server and shared harness (health check, HTML content-type, literal and percent-encoded path traversal, 405 on POST, third-party request blocking, route-fallback ordering, theme localStorage seeding)
- File: `design/tests/support/harness.ts`
  - `openPage`, `blockThirdParty`, `PAGES`, `pagesUnderTest`, `THEMES`, `WIDTHS`, `ZOOM_200`, `THEME_STORAGE_KEY` — implemented ahead of the server since the spec imports them directly
- File: `design/tests/fixtures/harness.html`
  - Fixture page used by the spec
- File: `playwright.config.ts`
  - chromium + webkit projects and `webServer` pointing at the not-yet-created `design/scripts/serve-mockups.mjs`

## Why

TDD red step for Task 3 of the 01-01 gate plan: write the test first, confirm it fails for the right reason, before writing the server it tests.

## Issues Encountered

None — this is the intentional red state.

## Dependencies

No dependencies added (uses `@playwright/test`, already installed).

## Testing Notes

- What was tested: ran `npx playwright test --project=chromium design/tests/harness.spec.ts` and confirmed it failed with `Cannot find module '.../design/scripts/serve-mockups.mjs'` — the expected red failure (missing implementation), not a test-authoring bug.
- What wasn't tested: nothing passes yet by design.
- Edge cases: n/a at this step.

## Next Steps

- [ ] Implement `design/scripts/serve-mockups.mjs` and `design/scripts/pw.mjs` to reach green in both engines (next commit)

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** LOW - test-only change, server not yet implemented
