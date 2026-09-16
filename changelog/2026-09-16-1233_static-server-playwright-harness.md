# 2026-09-16 - Static Server, Playwright Config, and Test Harness (TDD)

**Keywords:** [TESTING] [INFRA] [SECURITY] [CONFIG]
**Session:** Afternoon, Duration (~30 minutes)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-16-1233_static-server-playwright-harness.md`

## What Changed

- File: `design/tests/harness.spec.ts`
  - Written first (TDD red): 9 tests covering health check, HTML content-type, literal `/../` traversal (raw `node:http` request, since client URL normalization would hide the bug), percent-encoded traversal (plain and nested under `/mockups/`), 405 on POST, third-party request blocking, fallback-vs-continue route ordering, and theme pre-seeding into localStorage before page scripts run. Confirmed red: run failed because `serve-mockups.mjs` didn't exist.
- File: `design/tests/support/harness.ts`
  - Shared harness exports: `PAGES`, `pagesUnderTest()`, `THEMES`, `WIDTHS`, `ZOOM_200` (with a doc comment on what 200%-zoom emulation means geometrically), `THEME_STORAGE_KEY`, `blockThirdParty(page)` (aborts non-127.0.0.1 requests, `route.fallback()` for local so earlier-registered handlers still run), `openPage(page, name, opts)`
- File: `design/tests/fixtures/harness.html`
  - Minimal fixture referencing an external link/image (to exercise `blockThirdParty`) and an inline script that echoes the seeded theme into `dataset.seen`
- File: `design/scripts/serve-mockups.mjs`
  - Dependency-free `node:http` static server, exports `startServer({port, host})`; GET/HEAD only (405 otherwise); single `decodeURIComponent` with NUL-byte rejection; resolved path must equal or fall inside the `design/` root (percent-encoded and literal traversal both covered); `cache-control: no-store`; binds to loopback only
- File: `playwright.config.ts`
  - `testDir: design/tests`, chromium + webkit projects, `webServer` launching the static server with `reuseExistingServer: false`, JSON reporter path overridable via `PW_JSON_OUT`
- File: `design/scripts/pw.mjs`
  - Engine-aware launcher: chromium always native; webkit reads `design/.webkit-mode.json` and either runs natively or re-invokes itself inside the pinned `mcr.microsoft.com/playwright:v1.63.0-noble` Docker container (`--network none`, `--user uid:gid`, bind mount); `all` runs both and exits with the higher code

## Why

Task 3 of the 01-01 gate plan. TDD-first so the security-relevant behavior (path traversal, method restriction, no third-party leakage) is proven by a red-then-green cycle rather than asserted after the fact. This harness is shared infrastructure every later mockup/visual-regression spec in the phase imports, so getting `blockThirdParty`'s fallback-vs-continue semantics right here (Playwright runs route handlers in reverse registration order) avoids a subtle bug recurring in every downstream spec.

## Issues Encountered

- First acceptance-criteria check caught a literal `0.0.0.0` substring inside a code comment (explaining what the server does *not* bind to) that would have failed the plan's textual grep check even though it wasn't a real behavior — reworded the comment to avoid the literal string.
- No other issues; RED confirmed with a real failing run before implementation, GREEN reached on first implementation attempt in both engines.

## Dependencies

No dependencies added (uses `@playwright/test` and Node built-ins only, both already installed in Task 2).

## Testing Notes

- What was tested: all 9 `@harness` tests pass via `node design/scripts/pw.mjs --project=chromium design/tests/harness.spec.ts` and the same command with `--project=webkit` (routed through the Docker fallback recorded in `design/.webkit-mode.json`). Verified server binds to loopback only, `reuseExistingServer: false` present exactly once, both project names present in the config, and generated report/test-result files are gitignored and owned by the invoking user (not root) even when produced inside the Docker container.
- What wasn't tested: real mockup pages (none exist yet — Task 3 only proves the harness against the `harness.html` fixture); the `serve:mockups` npm script was not run manually (owner-only per plan).
- Edge cases: percent-encoded traversal tested both at the root and nested under `/mockups/`; the literal `/../` case specifically bypasses client-side URL normalization by using a raw `node:http` request so the server's own defense is what's being tested, not the HTTP client's.

## Next Steps

- [ ] 01-02: end-to-end tracer plan builds the first real mockup page and imports this harness
- [ ] Owner may run `npm run serve:mockups` to browse manually if desired

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** MEDIUM - test infrastructure every later phase-1 plan depends on; no production/public-site code
