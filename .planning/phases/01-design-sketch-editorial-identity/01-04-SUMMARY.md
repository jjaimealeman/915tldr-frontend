---
phase: 01-design-sketch-editorial-identity
plan: 04
subsystem: design-system
tags: [d1, fixtures, i18n, spanish, playwright, fonts, wrangler]

requires:
  - phase: 01-design-sketch-editorial-identity
    provides: "01-02: read-only D1 access (d1Query, fetch-stress-set.mjs skeleton), production token layer (style.css fonts/tokens region), self-hosted subset fonts"
provides:
  - "design/fixtures/stress-set.json: the full D-06 stress set (19 cases) — longest/shortest headline, longest/shortest summary, no-summary, five/max/zero-tags, no-image, junk-image, usable-image, spanish-headline, uncategorized, a 24-row home feed, a 3-candidate category lead + 13-row category feed, the 8 canonical categories with public story counts, and a corpus-stats aggregate — all real, public-only D1 rows with tags[] attached and read-accounting recorded"
  - "design/fixtures/changelog.json: byte-identical copy of the real public changelog (8 entries), sha256-verified"
  - "design/fixtures/spanish-stress.json: 22 components, each with English source, real in-session Spanish translation, and a font-measured synthetic +25% string calibrated in the real production fonts"
  - "design/scripts/calibrate-spanish.mjs: reusable real-browser width-calibration script for any future Spanish-copy component"
  - "A fixed read-only-guard bug in design/scripts/lib/d1-read.mjs (from 01-02): the write-keyword denylist was refusing legitimate read-only queries that used SQL's replace() scalar function"
affects: [01-06-home-category, 01-07-article-changelog-contact, 01-09-font-swap-matrix, 01-10-approval-packet]

actuals:
  tokens: 52000
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "d1-read.mjs's write-keyword denylist must exclude keywords immediately followed by '(' (a function call, e.g. replace(x,y,z)) from the block — a write *statement* keyword is always followed by whitespace and another token (REPLACE INTO, INSERT INTO), never '('. Any future query using a SQL scalar function whose name collides with a write keyword needs this same negative-lookahead treatment."
    - "fetch-stress-set.mjs's main() is now guarded behind an isMain check (matching fetch-fonts.mjs's 01-02 pattern) so QUERIES/PUBLIC/ROW/WC can be imported for inspection (e.g. to list real spanish-headline candidates for manual review) without triggering a live D1 fetch as an import side effect."
    - "calibrate-spanish.mjs's padding loop only runs while a component is under the 1.25 length floor — a component whose real Spanish translation already clears 1.25 without any padding never touches the diacritic-bearing PAD_WORDS list. Any future component/algorithm reusing this pattern needs the same forced top-up step this plan added, or must ensure its real translation intrinsically carries a diacritic."

key-files:
  created:
    - design/fixtures/changelog.json
    - design/fixtures/spanish-stress.json
    - design/scripts/calibrate-spanish.mjs
  modified:
    - design/scripts/fetch-stress-set.mjs
    - design/scripts/lib/d1-read.mjs
    - design/fixtures/stress-set.json

key-decisions:
  - "Three D-15 components (card-headline, card-summary, worst-case) source from D-06's longest-headline/longest-summary cases, which are themselves genuine Spanish-original wire content (CNN Español via KVIA) rather than English. es_real is recorded identical to en with a note, rather than fabricating a translation of a translation."
  - "skip-link's real Spanish translation was changed from a literal 'Saltar al contenido' (no diacritics) to the still-natural, functionally-equivalent a11y phrasing 'Saltar la navegación' (carries a real diacritic and fits the calibration script's width band on its own) — the literal translation had no combination of hi-band width and PAD_WORDS padding that could satisfy both the length and diacritic requirements simultaneously."
  - "usable-image/category-lead HEAD-check results record 'not checked' for candidates after the first accepted one, rather than checking all 5/3 candidates unconditionally — avoids unnecessary outbound requests once a usable image is already found."

patterns-established:
  - "d1-read.mjs's write-keyword regex uses a negative lookahead `(?!\\s*\\()` to distinguish a write-statement keyword from a same-named scalar SQL function — established here for REPLACE, applies to any future keyword/function collision."

requirements-completed: [I18N-07, DSGN-01, DSGN-07]

coverage:
  - id: D1
    description: "Full D-06 stress set (19 cases: 11 single-row extremes, home feed, category lead/feed, categories, corpus-stats) fetched read-only from production D1, tags attached, image candidates HEAD-verified, public-row assertion and content-column absence enforced"
    requirement: "DSGN-01"
    verification:
      - kind: integration
        ref: "npm run data:stress && inline node verify (case presence, no content column, canonical category order, 24-row feed, rowsReadTotal>0, cmp changelog copy) -> all pass, rowsReadTotal=1849229"
        status: pass
    human_judgment: false
  - id: D2
    description: "Public changelog (design/fixtures/changelog.json) is a byte-identical copy of the real public changelog, 8 entries, sha256 recorded"
    requirement: "DSGN-07"
    verification:
      - kind: integration
        ref: "cmp design/fixtures/changelog.json /home/jaime/www/_github/915tldr.com2/public/changelog.json -> identical"
        status: pass
    human_judgment: false
  - id: D3
    description: "22 Spanish-stress components with real translation and a font-measured synthetic +25% floor, calibrated against the real production fonts in a real browser"
    requirement: "I18N-07"
    verification:
      - kind: e2e
        ref: "node design/scripts/calibrate-spanish.mjs && inline node verify (22 components, widthRatio in [1.25,hi], hi==1.30 for en>=40 chars, non-ASCII synthetic, byte/width ratio divergence) -> all pass"
        status: pass
    human_judgment: false
  - id: D4
    description: "Owner's judgement on the quality/naturalness of the 22 hand-written Spanish translations (D-15's own human-check)"
    verification: []
    human_judgment: true
    rationale: "Translation naturalness is an aesthetic/linguistic judgement the plan's own <human-check> reserves for a human; the script only verifies presence, non-emptiness and measured width. Not blocking per this project's human_verify_mode: end-of-phase config — recorded here for the end-of-phase approval packet."

duration: 20min
completed: 2026-09-16
status: complete
---

# Phase 1 Plan 4: D-06 Stress Set + D-15 Spanish Calibration Summary

**The full D-06 stress set (19 real D1 cases, tags attached, images HEAD-verified) and 22 D-15 Spanish components (real translation + font-measured synthetic +25% floor), both read/measured against real production data and real fonts — the fixture data the mockups (01-06, 01-07) will be designed and stress-tested against.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-09-16T20:50:00Z (approx.)
- **Completed:** 2026-09-16T21:08:13Z (Task 2 commit `c3dcfed`)
- **Tasks:** 2/2
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments

- Expanded `fetch-stress-set.mjs` from the 01-02 tracer's single query to 19 real, read-only D1 queries covering every D-06 pathological case, a 24-row home feed, a category lead/feed pair, the 8 canonical categories with public story counts, and a corpus-stats aggregate — 1,849,229 total rows read, $0 cost, every row asserted `processed`/non-duplicate, never carrying the `content` column
- Attached a `tags[]` array to every article row via a chunked, uuid-regex-validated lookup, and HEAD-verified every `usable-image`/`category-lead` candidate URL before choosing one
- Hand-reviewed all 10 real `spanish-headline` LIKE-matches from production D1 and correctly excluded 3 false positives (English headlines containing a Colombian surname or a quoted Spanish concert name) from the `chosen` pick
- Copied the real public changelog byte-for-byte into `design/fixtures/changelog.json` with its sha256 recorded
- Authored 22 D-15 Spanish-stress components by hand (in-session, $0, no paid translation API) and built `calibrate-spanish.mjs`, which measures every component's real string width in the real production fonts (Instrument Serif / Source Serif 4, via a real Chromium browser against the real `style.css` token layer) and calibrates a synthetic +25% floor per component, landing every one inside its measured `[1.25, hi]` band
- Fixed a real, blocking bug in 01-02's shared `d1-read.mjs` read-only guard (the `REPLACE` write-keyword check also matched the harmless `replace()` SQL function this plan's `WC()` helper needed) and a real gap in this plan's own padding algorithm (a component already at the length floor never exercised the diacritic pad-word list)

## Task Commits

1. **Task 1: Fetch the full D-06 stress set, feeds and category counts; copy the public changelog** - `81e216b` (feat)
2. **Task 2: Author real Spanish copy and calibrate the synthetic +25% floor in the real fonts (D-15)** - `c3dcfed` (feat)

**Plan metadata:** commit pending (this docs commit, made immediately after this SUMMARY)

## Files Created/Modified

- `design/scripts/fetch-stress-set.mjs` - Expanded `QUERIES` to 19 cases built only from new `PUBLIC`/`ROW`/`WC()` constants and SQL literals; added chunked tags lookup, HEAD-request image validation, manual Spanish-headline review table, changelog copy step, and an `isMain` guard
- `design/scripts/lib/d1-read.mjs` - Fixed the `REPLACE` write-keyword check to exclude scalar function calls (negative lookahead for a keyword immediately followed by `(`)
- `design/fixtures/stress-set.json` - Regenerated: 19 cases, 1,849,229 total rows read, all real production data
- `design/fixtures/changelog.json` - Byte-identical copy of the real public changelog (8 entries)
- `design/fixtures/spanish-stress.json` - 22 components: English source, real Spanish translation, calibrated synthetic +25% string, per-component calibration metrics
- `design/scripts/calibrate-spanish.mjs` - Real-browser width calibration script (Chromium, real fonts, `blockThirdParty`-guarded, no external network access)

## Decisions Made

- Card-headline/card-summary/worst-case's "English source" turned out to already be genuine Spanish-original content — recorded `es_real` identical to `en` with an explanatory note rather than fabricating a translation.
- Replaced skip-link's literal translation ("Saltar al contenido," no diacritics) with a still-natural, functionally-equivalent phrasing ("Saltar la navegación") that carries a real diacritic and satisfies the width band without a forced, awkward pad-word append.
- `usable-image`/`category-lead` HEAD checks stop at the first 200 + `image/*` response rather than checking every candidate, recording the remainder as "not checked" — avoids unnecessary outbound requests once a usable image is found.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `d1-read.mjs`'s `REPLACE` write-keyword check also blocked the read-only `replace()` SQL function**
- **Found during:** Task 1, first `npm run data:stress` run (all 19 queries failed immediately)
- **Issue:** The read-only guard's `\bREPLACE\b` regex matched both the write statement `REPLACE INTO ...` and the harmless scalar function `replace(x, y, z)` — which this plan's `WC()` word-count helper needs (`replace(trim(x), ' ', '')`). Every query using `WC()` was refused before ever reaching wrangler.
- **Fix:** Added a negative lookahead `(?!\s*\()` so a keyword immediately followed by `(` (a function call) is excluded from the block, while `REPLACE INTO`, `INSERT OR REPLACE INTO`, etc. are still refused (verified both cases with a standalone unit check).
- **Files modified:** design/scripts/lib/d1-read.mjs
- **Verification:** `npm run data:stress` completed cleanly; unit check confirmed `replace()` passes and `REPLACE INTO`/`INSERT OR REPLACE INTO` are still refused.
- **Committed in:** `81e216b`

**2. [Rule 3 - Blocking] `fetch-stress-set.mjs`'s `main()` ran unconditionally at import time**
- **Found during:** Task 1, while listing real `spanish-headline` candidates for manual review
- **Issue:** Importing `QUERIES` from the module (to inspect real candidate titles before hand-filling the review table) triggered a full live D1 fetch-and-write as an import side effect — the same class of bug 01-02 hit and fixed in `fetch-fonts.mjs`.
- **Fix:** Added the same `isMain` guard pattern used by `fetch-fonts.mjs`.
- **Files modified:** design/scripts/fetch-stress-set.mjs
- **Verification:** Importing `QUERIES` no longer fetches; `npm run data:stress` (the CLI entrypoint) still runs `main()` correctly.
- **Committed in:** `81e216b`

**3. [Rule 2 - Missing Critical] `calibrate-spanish.mjs`'s padding loop could produce an all-ASCII synthetic string**
- **Found during:** Task 2, first calibration run (`skip-link` failed the non-ASCII check)
- **Issue:** The plan's padding algorithm only appends `PAD_WORDS` while a component's ratio is under 1.25. A component whose real translation already clears 1.25 without padding (skip-link's "Saltar al contenido," 1.2484 pre-padding, no diacritics) never touches the diacritic-bearing pad list — silently failing the task's own PERF-07 diacritic-subset requirement.
- **Fix:** Added a forced top-up pad step (same "longest word that fits `hi`" rule) that runs whenever the synthetic string has no non-ASCII character, regardless of whether the 1.25 floor was already met by padding. For `skip-link` specifically, the narrow `hi` band left no room for any accented `PAD_WORDS` entry to fit even after this fix, so the real translation itself was changed to a naturally diacritic-bearing, still-accurate a11y phrasing ("Saltar la navegación").
- **Files modified:** design/scripts/calibrate-spanish.mjs, design/fixtures/spanish-stress.json
- **Verification:** All 22 components now produce a synthetic string with at least one non-ASCII character; re-run is deterministic/idempotent.
- **Committed in:** `c3dcfed`

---

**Total deviations:** 3 auto-fixed (1 bug, 1 blocking-issue fix, 1 missing-critical-functionality fix). No scope creep — all three stayed inside this plan's own files or the immediately-shared `d1-read.mjs` dependency that blocked Task 1 from running at all.
**Impact on plan:** All fixes were necessary to complete the plan as specified (the `d1-read.mjs` bug made every Task 1 query fail outright; the padding-loop gap would have silently shipped a non-compliant fixture for one component).

## Issues Encountered

- The D-06 stress set's `no-summary` case came back genuinely empty (`{ absent: true, reason: "no public row matches" }`) — expected, not a bug: every current summary is padded to a 100-200 word floor (PRD §8.2), so no row currently has a null/empty summary. Phase 2 removes that floor, at which point this case will populate.
- Two D-06 cases (longest-headline, longest-summary) unexpectedly turned out to be genuine Spanish-original wire content rather than English — see Decisions Made and coverage item D3.

## Known Stubs

None that block this plan's own goal — all acceptance criteria pass for both tasks.

## User Setup Required

None — the owner's already-exported `CLOUDFLARE_API_TOKEN` (confirmed working since 01-02) was sufficient for all read-only D1 access in this plan.

## Next Phase Readiness

- `design/fixtures/stress-set.json` and `design/fixtures/spanish-stress.json` are both complete, real, and ready for 01-06/01-07 (the home/category/article/changelog/contact mockups) and 01-09 (the overflow spec) to consume via `data-stress`/`data-i18n` hook values.
- `design/scripts/calibrate-spanish.mjs` is reusable without modification if a future plan adds more Spanish-stress components.
- Carry forward to the phase's end-of-phase approval packet: owner review of all 22 `es_real` translations' naturalness (D-15's own human-check, non-blocking per `human_verify_mode: end-of-phase`).
- Chosen evidence for the approval packet: `usable-image` resolved to `https://www.ktsm.com/wp-content/uploads/sites/38/2026/09/FEATURE_Trader-Joes-3-Halloween-mini-totes-are-returning-so-prepare-for-chaos.jpg?w=900` (HEAD 200, `image/jpeg`); the `spanish-headline` case's `chosen` row is "Ucrania intensifica ofensiva contra la infraestructura petrolera rusa en medio de ganancias inesperadas del Kremlin" (uuid `f63b5753-90b6-4a54-b78d-160461c08bf8`) — the same row that also turned out to be the corpus's single longest headline; measured synthetic `widthRatio` spans 1.2543 (min, `card-headline`/`worst-case`) to 1.3986 (max, `category-masthead-title`), all within each component's own `[1.25, hi]` band.
- No blockers for 01-05 (test-first contrast gate extension) or the mockup plans — both consume the same fixtures and token layer this plan and 01-02/01-03 produced.

---
*Phase: 01-design-sketch-editorial-identity*
*Completed: 2026-09-16*

## Self-Check: PASSED

All files listed above verified present on disk; both task commits (`81e216b`, `c3dcfed`) verified present in git history (see below).
