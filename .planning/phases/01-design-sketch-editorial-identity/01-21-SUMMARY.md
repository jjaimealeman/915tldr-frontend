---
phase: 01-design-sketch-editorial-identity
plan: 21
subsystem: ui
tags: [load-more, static-json, keyboard, accessibility, security, css]

requires:
  - phase: 01-design-sketch-editorial-identity
    provides: "01-18: design/scripts/lib/summary-markdown.mjs (escapeHtml, parseSummary, renderSummaryHtml, validateBlocks) — reused unmodified to render/validate feed-page summary blocks"
  - phase: 01-design-sketch-editorial-identity
    provides: "01-12: the summary-markdown block contract (typed p/list blocks) that build-feed.mjs's DOM extraction reproduces from the already-rendered [data-summary] markup"
provides:
  - "design/scripts/build-feed.mjs: --extract (one-time) and build (idempotent) modes; exports renderCardHtml, validateCard, validateFeedPage, INITIAL_CARDS=6, PAGE_SIZE=6 — the feed-page JSON contract Phase 3/4's real build and island can copy"
  - "design/fixtures/home-feed.json + design/mockups/feed/page-2..6.json: the static, same-origin, zero-D1-read pagination contract for the homepage"
  - "A working load-more island (button + status + client renderer) proven keyboard-operable with a clean focus ring in both engines, and mouse-clickable, with zero native CLS during activation (measured, not assumed)"
affects: [01-22, 01-23]

actuals:
  tokens: 64400
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Static-JSON-page pagination for a zero-D1-read constraint: the same reverse-chronological cards that would otherwise all be server-rendered are split into a first tranche (server-rendered) plus pre-built static JSON pages, walked by a client fetch() restricted by origin+path-pattern check — a pattern Phase 3/4's real build can copy directly (per 01-21-PLAN.md's own intent)."
    - "Client DOM renderer built with createElement/setAttribute/textContent only, never innerHTML, mirroring the server-side renderCardHtml's escaping guarantees without needing a shared runtime — the two implementations are proven equivalent by a dedicated parity test, not by code sharing."
    - "Extraction self-verification: build-feed.mjs's --extract mode renders every extracted card back through renderCardHtml and diffs it against the live DOM before ever writing the fixture, catching a lossy extraction at the source rather than downstream."

key-files:
  created:
    - design/scripts/build-feed.mjs
    - design/fixtures/home-feed.json
    - design/mockups/feed/page-2.json
    - design/mockups/feed/page-3.json
    - design/mockups/feed/page-4.json
    - design/mockups/feed/page-5.json
    - design/mockups/feed/page-6.json
    - design/tests/load-more.spec.ts
  modified:
    - design/mockups/index.html
    - design/mockups/category.html
    - design/mockups/article.html
    - design/mockups/changelog.html
    - design/mockups/contact.html
    - design/mockups/style.css
    - design/scripts/verify-phase-1.mjs
    - design/tests/keyboard-walk.spec.ts
    - package.json
    - .planning/phases/01-design-sketch-editorial-identity/01-CONTEXT.md

key-decisions:
  - "The 33-card feed is split by pure document order (already true reverse-chronological, D-12) into cards 1-6 (server-rendered) and 7-33 (feed/page-2..6.json, 6 per page) -- no reordering was applied to keep specific stress cards visible, since D-12's reverse-chronological order is itself a must-have this plan cannot trade away. Direct, verified consequence: the Spanish/long-content/no-summary stress cards (positions 24-26, 29-33 in the original grid) now sit behind the button on first load. 01-22 (already planned, depends_on: [01-21]) exists specifically to restore full-suite coverage of the paginated feed."
  - "HTML comments in the original hand-authored card markup (documentation notes on 3 stress cards) are stripped before the extraction self-check's whitespace comparison -- they are not part of a card's data model and renderCardHtml never reproduces them; stripping was verified necessary (not assumed) by first running the comparison without it and inspecting the exact 3 mismatches."
  - "The parity test's HTML-string comparison strips inter-tag whitespace (`>\\s+<` -> `><`) before comparing, because the client-built DOM (createElement/appendChild, zero whitespace text nodes) and renderCardHtml's indented multi-line string differ only in insignificant source formatting -- verified by inspecting the raw diff before adding the normalisation, not assumed."
  - "The keyboard-walk 'repeat until hidden' loop waits (page.waitForFunction) for aria-disabled to clear between Enter/Space presses, because firing a second activation while the previous fetch is still in flight is correctly ignored by the button's own double-activation guard (T-01-61) -- without the wait the test loop spun for the full 30s timeout with no further loads ever happening, which is the DoS mitigation working as designed, not a bug."

requirements-completed: [DSGN-06, DSGN-02, DSGN-01, A11Y-01]

coverage:
  - id: D1
    description: "Homepage first load: lead + exactly 6 cards (2 rows @1280px, 3 rows @768px, 6 stacked @320px); Load more button visible"
    requirement: "DSGN-01"
    verification:
      - kind: automated_ui
        ref: "design/tests/load-more.spec.ts#initial load: exactly 6 cards... @c1 (both engines)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Load more walks feed/page-<n>.json, appends cards structurally identical to server-rendered cards (parity), keeps loading until the chain ends, then hides with a final status"
    requirement: "DSGN-06"
    verification:
      - kind: automated_ui
        ref: "design/tests/load-more.spec.ts#parity...@c1 (both engines); design/tests/keyboard-walk.spec.ts#load more is keyboard-operable... (repeat-until-hidden step, both engines)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Load more reads only same-origin feed/page-<n>.json (zero D1 reads, core value); a malformed response or routed failure leaves the grid unchanged with an error status and focus on the button"
    requirement: "DSGN-06"
    verification:
      - kind: automated_ui
        ref: "design/tests/load-more.spec.ts#network...@c1, #failure path...@c1 @c3 (both engines)"
        status: pass
    human_judgment: false
  - id: D4
    description: "After a load, focus moves to the first new card's headline link with a visible, unclipped, unobscured >=3:1-contrast ring; a polite status announces the count; the footer stays reachable by Tab in both engines and both themes"
    requirement: "A11Y-01"
    verification:
      - kind: automated_ui
        ref: "design/tests/keyboard-walk.spec.ts#load more is keyboard-operable and keeps the footer reachable: <theme> @<width>px @c3 (index x light/dark x 320/1280px, both engines, 8/8)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The server-rendered grid stays pure HTML: identical with JavaScript disabled (6 cards, button hidden), no script/inline handler inside any grid, one identical head script on all five pages"
    requirement: "DSGN-06"
    verification:
      - kind: automated_ui
        ref: "design/tests/structure.spec.ts (96/96, both engines, including the JS-disabled parity test and the head-script drift guard across all five pages)"
        status: pass
    human_judgment: false
  - id: D6
    description: "verify-phase-1.mjs's C1 node check validates the feed directory: allow-listed, every page schema/shape-valid, the data-next chain visits every file exactly once and ends at null, card parity against home-feed.json, and exactly one fetch( in the shared script"
    requirement: "DSGN-06"
    verification:
      - kind: automated
        ref: "pnpm run verify:phase-1 --pages=index,category --criteria=1 (criterion 1 PASS, chromium+webkit+node); node -e \"...validateFeedPage...\" sanity check exits 0"
        status: pass
    human_judgment: false
  - id: D7
    description: "The Load more controls take their colours only from tokens and pass the contrast gate"
    requirement: "DSGN-02"
    verification:
      - kind: automated
        ref: "pnpm run check:contrast (PASS, no new literal-colour findings)"
        status: pass
    human_judgment: false
  - id: D8
    description: "Loading more cards causes zero real layout shift (native CLS) — the apparent rect movement of the first 6 cards is a uniform scroll offset (focus moving to the newly-loaded, off-screen 7th card), not a reflow"
    requirement: "A11Y-01"
    verification:
      - kind: automated
        ref: "ad hoc PerformanceObserver({type:'layout-shift'}) script (design/.cache/, not committed): native CLS = 0, zero shift entries during a real click-driven load; first-6-card width/height/left unchanged before vs. after, only a uniform top delta consistent with scroll"
        status: pass
    human_judgment: false
  - id: D9
    description: "A real browser click (not a synthetic .click() call) triggers the load-more sequence identically to keyboard activation"
    requirement: "A11Y-01"
    verification:
      - kind: automated_ui
        ref: "design/tests/load-more.spec.ts#parity...@c1 uses locator.click() (Playwright's real input pipeline), both engines"
        status: pass
    human_judgment: false

duration: ~35min
completed: 2026-09-17
status: complete
---

# Phase 01 Plan 21: Homepage Load More — Static Feed, First 6 Cards, Keyboard-Sound Summary

**Built the vertical slice for revision request 8: the homepage now server-renders the lead plus 6 cards (2 rows @1280px, 3 rows @768px), and a Load more button walks a chain of pre-built static `feed/page-<n>.json` files (zero D1 reads) to reveal the rest, proven keyboard- and mouse-operable with a clean focus ring and zero measured layout shift in both engines.**

## What shows on first load vs. what's behind the button

- **On load (server-rendered, unchanged if JavaScript is disabled):** the lead story + the first 6 cards in true reverse-chronological order — `326af4d4` (usable-image), `5deacd9f`, `a90c2be1`, `93b39255`, `746de4d5`, `3b53a85d`.
- **Behind the button, in pages of 6 (`feed/page-2.json` through `page-6.json`, 27 cards, last page holds 3):** every other card from the original 33-card grid, including all of the D-06/D-07 stress cases that previously sat mid-grid or late-grid — `junk-image` (24th), `longest-summary` (25th), `shortest-summary` (26th), `shortest-headline`/`no-summary` (27th/28th, same uuid), `uncategorized` (29th), `longest-headline`/`spanish-real`/`spanish-synthetic`/`worst-case` (30th-33rd, all uuid `f63b5753`). The chain is `page-2 → page-3 → page-4 → page-5 → page-6 → null`.

## Accomplishments

- **Task 1 (tracer):** `design/scripts/build-feed.mjs` in two modes — one-time `--extract` (reads the live 33-card grid, self-verifies its own `renderCardHtml` against every live card before writing the fixture) and idempotent build (trims `index.html`'s grid to 6 cards, writes the feed pages, keeps the button's `data-next` in sync). `design/mockups/index.html`'s shared head script gained a load-more routine built entirely with `createElement`/`setAttribute`/`textContent` (no `innerHTML`, matching the threat model's T-01-58 mitigation); `href` is always the literal `"article.html"`, an image `src` is only set after an `https://` prefix check. `design/tests/load-more.spec.ts` (5 tests) proved rows/columns, DOM parity against `renderCardHtml`, keyboard activation with focus/status, the same-origin-only network allow-list, and the routed-500 failure path — all pass in both Chromium and WebKit.
- **Task 2:** copied the updated head script byte-for-byte to `category.html`/`article.html`/`changelog.html`/`contact.html` (closing structure.spec.ts's head-script drift guard across all five pages); extended `verify-phase-1.mjs`'s C1 node check to allow-list `feed/` and validate the feed directory's schema, chain integrity, card parity against `home-feed.json`, and the single-`fetch(` guard on the shared script.
- **Task 3:** full `[data-feed-controls]`/`[data-load-more]`/`[data-load-more-status]` styling (44px minimum target, token colours only, matching the theme toggle's visual language); four new keyboard tests (index × light/dark × 320/1280px, both engines) proving Tab reaches the button then the footer, Enter/Space both trigger a load with a clean `inspectFocus` ring on the newly-focused card, Shift+Tab returns correctly, and repeated activation to exhaustion ends with the "That's everything for now." status and the footer still reachable; `feed:build` pnpm script; `01-CONTEXT.md` amended with D-05 (mockups directory gains `feed/`), D-12 (home grid: lead + 6 + load-more pages, same order), and a DSGN-06/criterion-5 wording flag for the phase transition.
- **Empirically measured, not assumed, zero layout shift:** a `PerformanceObserver({type:'layout-shift'})` script driving a real click reported native CLS = 0 and zero shift entries during a load-more activation; the raw before/after card rects showed only a uniform scroll-offset delta (from focus moving to the off-screen 7th card), with identical width/height/left — confirmed this is scroll, not reflow, before reporting it as CLS-safe.

## Task Commits

1. **Task 1 (tracer): Extract → static pages → button and client renderer on index, proven in both engines** - `419b7cc` (feat)
2. **Task 2: Shared head script on all five pages, runner checks the feed** - `e206d1a` (feat)
3. **Task 3: Styling, keyboard coverage, `feed:build`, D-05/D-12 amendments** - `96c4bae` (feat)

## Files Created/Modified

- `design/scripts/build-feed.mjs` — extraction + build script; exports `renderCardHtml`, `validateCard`, `validateFeedPage`, `INITIAL_CARDS`, `PAGE_SIZE`
- `design/fixtures/home-feed.json` — 33-card ordered source of truth
- `design/mockups/feed/page-2.json` … `page-6.json` — the static pagination pages
- `design/mockups/index.html` — grid trimmed to 6 cards + markers; `[data-feed-controls]` button/status; head script extended
- `design/mockups/category.html`, `article.html`, `changelog.html`, `contact.html` — head script synced (no button on these pages, so it's a no-op there)
- `design/mockups/style.css` — `[data-feed-controls]`/`[data-load-more]`/`[data-load-more-status]` rules
- `design/scripts/verify-phase-1.mjs` — `feed` allow-listed; new feed schema/chain/parity/single-fetch checks
- `design/tests/load-more.spec.ts` (new) — 5 tests, `@c1 @c3`
- `design/tests/keyboard-walk.spec.ts` — 4 new load-more keyboard tests
- `package.json` — `feed:build` script
- `.planning/phases/01-design-sketch-editorial-identity/01-CONTEXT.md` — D-05, D-12, DSGN-06 amendments

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Extraction self-check false positives from HTML comments**
- **Found during:** Task 1, first `--extract` run
- **Issue:** 3 of 33 cards (`junk-image`, `no-summary`, `spanish-real`) carry hand-written HTML documentation comments in the original markup; the whitespace-normalised outerHTML comparison flagged all 3 as mismatches since `renderCardHtml` never reproduces comments.
- **Fix:** strip `<!--...-->` before the comparison (comments are not part of a card's data model).
- **Files modified:** `design/scripts/build-feed.mjs`
- **Commit:** `419b7cc`

**2. [Rule 1 - Bug] Parity test false positive from insignificant inter-tag whitespace**
- **Found during:** Task 1, first `load-more.spec.ts` run
- **Issue:** the client-built DOM (`createElement`/`appendChild`) has zero whitespace text nodes between elements; `renderCardHtml`'s indented multi-line string does (pure source formatting), so a literal string diff after `\s+` collapse still showed a single-space mismatch at every tag boundary.
- **Fix:** also collapse `>\s+<` to `><` before comparing.
- **Files modified:** `design/tests/load-more.spec.ts`
- **Commit:** `419b7cc`

**3. [Rule 3 - Blocking] New button broke the line-height structural guard**
- **Found during:** Task 1, running `structure.spec.ts` per the task's own verify step
- **Issue:** the new `[data-load-more]` button had no CSS, so its computed `line-height` was the UA default `normal`, failing structure.spec.ts's pre-existing "every element with a direct text node has a computed line-height that is not 'normal'" guard.
- **Fix:** added a minimal `[data-load-more] { font: inherit; }` rule in Task 1 (matching the theme toggle's own pattern) so Task 2's own `structure.spec.ts` verify step would pass; Task 3 replaced it in place with the full button design (the first property is still `font: inherit;`, so no rule was duplicated or later undone).
- **Files modified:** `design/mockups/style.css`
- **Commits:** `419b7cc` (minimal fix), `96c4bae` (full styling)

**4. [Rule 1 - Bug] Keyboard-walk step (d) assumed a stale card count**
- **Found during:** Task 3, writing the new keyboard tests
- **Issue:** step (d)'s "Tab forward to the button" was coded as one hard-coded Tab press, correct only when the grid still held 6 cards; by that point in the test 12 cards are loaded, so a single Tab landed on the 7th card's link, not the button.
- **Fix:** focus the button directly (`locator.focus()`) instead of counting Tab presses; the pre-existing exhaustive Tab-order walk test already covers every literal hop.
- **Files modified:** `design/tests/keyboard-walk.spec.ts`
- **Commit:** `96c4bae`

**5. [Rule 1 - Bug] "Repeat until hidden" loop spun for the full test timeout**
- **Found during:** Task 3, first run of the new keyboard tests
- **Issue:** the loop fired a fresh Enter press on every iteration with no wait; a second Enter pressed while the previous page's `fetch` was still in flight was silently ignored by the button's own `aria-disabled` double-activation guard (T-01-61, working as designed) — so the loop spun until the 30s test timeout with no further loads.
- **Fix:** `page.waitForFunction` waits for `aria-disabled` to clear (or the button to hide) after each press before the next iteration.
- **Files modified:** `design/tests/keyboard-walk.spec.ts`
- **Commit:** `96c4bae`

**Total deviations:** 5 auto-fixed (2 Rule 1 test/tooling bugs found during extraction, 1 Rule 3 blocking styling fix pulled forward from Task 3, 2 Rule 1 test-authoring bugs in the new keyboard tests). None were architectural; none weakened a threshold or a check.

## Known Coverage Gap (documented, not fixed here — deferred to 01-22 by design)

Preserving D-12's true reverse-chronological order (a must-have this plan cannot trade away) means 4 of `spanish-overflow.spec.ts`'s existing index checks no longer find their target element on first load, because the 4 target elements now sit behind the load-more button:

- `injected real+synthetic Spanish causes no overflow/clip/loss at 320/768/1280px @c4` — 3 test failures, all from the same root cause: the `card-headline` component's fixture-injection hook (`[data-i18n="card-headline"]`, on the `longest-headline` stress card, 30th of 33 in document order) is no longer present in the initial DOM, so `injectText()` throws `no element found for "card-headline"` before the test can reach the `card-summary`/`card-summary-thin` components later in the same loop.
- `no-summary card has no [data-summary] and reserves no blank space @c4` — the `no-summary` stress card (28th of 33) is also behind the button.

Verified, not guessed: reproduced with `MOCKUP_PAGES=index node design/scripts/pw.mjs --project=all design/tests/spanish-overflow.spec.ts` — exactly 4 failures per engine (28/32 pass), identical failure set in both Chromium and WebKit, deterministic across repeated runs. `01-22-PLAN.md` (already written, `depends_on: [01-21]`, `files_modified` includes `design/tests/spanish-overflow.spec.ts`, `design/tests/support/feed.ts`) exists specifically to restore this coverage against the now-paginated feed. This plan's own `<verification>` block never required `spanish-overflow.spec.ts` to pass (only `load-more.spec.ts`, `structure.spec.ts`, and `verify:phase-1 --pages=index,category --criteria=1`), so no plan-level gate is broken — this is a known, bounded, pre-announced gap, not a silent regression.

Everything else regression-tested was unaffected: `content.spec.ts` 49/49 (both engines — its own checks are all subset-safe against a smaller initial grid), `structure.spec.ts` 96/96 (both engines, all five pages), `chrome.spec.ts` + `lead-fallback.spec.ts` 69/69 combined (both engines), `font-cls.spec.ts` 16/16 (both engines), `keyboard-walk.spec.ts` 11/11 on index (both engines, including the pre-existing exhaustive Tab-order walk unchanged).

## Issues Encountered

None beyond the deviations documented above.

## Known Stubs

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `design/scripts/build-feed.mjs`'s `--extract`/build contract and the `feed/page-<n>.json` shape are ready for 01-22 to build coverage against, and for Phase 3/4's real Astro build to copy directly (per this plan's own reversibility note on the feed-page shape).
- 01-22 (already planned) restores `spanish-overflow.spec.ts`/`content.spec.ts`/`font-cls.spec.ts` coverage of the full 33-card feed via the new `feed.ts` test support and an updated Spanish fixture — the exact, pre-identified gap this plan's own objective named up front.
- 01-23 (approval-packet regeneration) will need a fresh `pnpm run verify:phase-1` unscoped run once 01-22 lands, since a scoped `--pages=index,category --criteria=1` run (this plan's own verify step) is explicitly not valid for approval.

---
*Phase: 01-design-sketch-editorial-identity*
*Completed: 2026-09-17*

## Self-Check: PASSED
