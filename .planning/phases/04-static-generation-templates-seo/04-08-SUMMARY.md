---
phase: 04-static-generation-templates-seo
plan: 08
subsystem: frontend
tags: [astro, content-layer, d1, seo, changelog, static-pages, tdd]

# Dependency graph
requires:
  - phase: 04-static-generation-templates-seo
    provides: "04-02's Base layout/ArticleCard/structured-data contract; 04-01/04-03's Content Layer loader + build-state (readLastGood/writePendingBuildState/evaluateShrink) pattern this plan's changelog loader mirrors"
provides:
  - "src/content/loaders/changelog-loader.ts — D-13 dual-source (v1 changelog.json + D1 public_changelogs) changelog Content Layer loader with fail-loud rules (REND-02/REND-03)"
  - "src/content.config.ts's `changelog` collection"
  - "Real routes: /changelog, /contact, /about, /privacy, /terms (D-10, FIX-05)"
  - "tests/regression/changelog-empty-state.test.mjs — REND-03 regression, including a real-build replay"
affects: [04-09, 04-10, 04-11, 04-12, phase-10-identity-and-trust, phase-12-cutover]

# Actuals (#2632)
actuals:
  tokens: 18204
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "changelogLoader() mirrors articles-loader.ts's deps-seam/fail-loud-before-mutation pattern, but has no incremental modes — every build re-fetches both sources in full and rebuilds the store from scratch (store.clear() + set all), since the changelog is small enough that a full rebuild carries no read-budget cost"
    - "fetchJson deps seam mirrors the global fetch signature exactly (returns a Response-shaped object), not pre-parsed JSON — lets the real-build regression replay point V1_CHANGELOG_URL at a data: URL and exercise the loader's real default implementation, not a test-only branch"
    - "[data-contact-column] (design/mockups/style.css) is a standalone narrow-reading-column style independent of the rail layout — reused for about/privacy/terms, distinct from [data-reading-column] which is rail-paired"

key-files:
  created:
    - src/content/loaders/changelog-loader.ts
    - src/pages/changelog.astro
    - src/pages/contact.astro
    - src/pages/about.astro
    - src/pages/privacy.astro
    - src/pages/terms.astro
    - tests/unit/changelog-loader.test.mjs
    - tests/unit/static-pages.test.mjs
    - tests/regression/changelog-empty-state.test.mjs
    - tests/fixtures/v1-changelog.json
    - tests/fixtures/d1-public-changelogs.json
  modified:
    - src/content.config.ts

key-decisions:
  - "Owner decision (2026-09-27, mid-execution): CHANGELOG_MIN_EXPECTED set to 15, not the plan's originally-measured 18 — v1's live changelog.json genuinely serves 9 entries today (not 12), because v1's last production deployment (2026-09-19T17:13Z) predates a repo commit (2026-09-21, e991d56) that added 3 more entries never deployed. This is NOT a stale CDN cache (ruled out directly — Cloudflare cf-cache-status: HIT on a fresh cache-busting query string is ordinary Workers Static Assets behavior for a truly-unchanged origin response, not evidence of staleness). The never-shrink baseline this loader writes to KV ratchets the effective floor back up to 18 automatically the first time a build observes that count, once v1 deploys those 3 entries — no code change needed then."
  - "changelogLoader has no incremental sync modes (unlike articles-loader.ts's cold/warm/warm+sweep) — every build re-fetches both sources in full; the changelog's small size (tens of entries) means this carries no read-budget pressure that would justify the extra complexity."
  - "Exact-duplicate removal (same date+title+items across sources) keeps the v1-json copy, drops the D1 copy — entries differing in any field both survive, per the plan's own spec."
  - "v1's actual /contact page (contact.vue) never publishes a contact address anywhere in its rendered markup — its message recipient (me@915website.com) exists only inside the server-side handler (server/api/contact.post.ts), confirmed by reading that file directly. No address was added to the new contact.astro; the mockup's own links to jjaimealeman.com and 915website.com already give a reader a way to reach the owner while the form is disabled."
  - "[data-contact-column] reused as the narrow reading column for about.astro/privacy.astro/terms.astro (not [data-reading-column], which design/mockups/style.css pairs specifically with the rail layout) — confirmed against the CSS source before reuse, per the plan's own 'a reading column following contact.html's structure' instruction."
  - "One dead internal link omitted from about.astro (v1's 'View our sources →' CTA, which points to /sources — no such route exists in this build, only per-source pages at /source/<slug>) — the surrounding sentence's wording is unchanged; only the dead CTA phrase itself was dropped."

patterns-established:
  - "A count-only never-shrink check (previousCount - allowance vs. current total) is enough when a collection has no per-id explained-removal need — simpler than evaluateShrink's id-diffing shape, appropriate for a small, fully-rebuilt-every-time collection like changelog."

requirements-completed: [REND-02, REND-03, FIX-05, REND-04]

coverage:
  - id: D1
    description: "/changelog renders the full preserved history on every build: every entry of v1's changelog.json merged with every public row of D1 public_changelogs, newest first"
    requirement: "FIX-05"
    verification:
      - kind: unit
        ref: "tests/unit/changelog-loader.test.mjs#happy path: merges both sources, sorted newest first, D1 epoch dates become YYYY-MM-DD, items preserved verbatim"
        status: pass
      - kind: unit
        ref: "tests/unit/static-pages.test.mjs#static-pages: every v1-json and D1 changelog fixture entry appears verbatim (date, title, every item) on the built changelog page"
        status: pass
    human_judgment: false
  - id: D2
    description: "A build whose changelog source returns zero entries, fails to fetch, returns invalid JSON, returns zero D1 rows, or shrinks below the last-good baseline exits non-zero — proven by a regression test that replays the /changelog empty-state failure through a real astro build"
    requirement: "REND-03"
    verification:
      - kind: unit
        ref: "tests/regression/changelog-empty-state.test.mjs#REND-03 real-build replay: a real `pnpm run build` against an empty v1 changelog.json exits non-zero and names the failure"
        status: pass
      - kind: unit
        ref: "tests/unit/changelog-loader.test.mjs (12 fail-loud cases: zero entries, zero D1 rows, fetch failure, invalid JSON, malformed shapes, never-shrink, ratchet-up)"
        status: pass
    human_judgment: false
  - id: D3
    description: "/contact, /about, /privacy and /terms render in the approved chrome at no-slash URLs; about, privacy and terms carry v1's current text verbatim"
    requirement: "REND-04"
    verification:
      - kind: unit
        ref: "tests/unit/static-pages.test.mjs (canonical + first-two-headings checks for about.html/privacy.html/terms.html; canonical + fieldset checks for contact.html)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The contact form does not pretend to send: its fields are disabled and the page says so plainly until Phase 10 wires submission"
    verification:
      - kind: unit
        ref: "tests/unit/static-pages.test.mjs#static-pages: contact.html exists with canonical https://915tldr.com/contact, form fields inside a disabled fieldset; #static-pages: contact.html plainly states the form is not accepting messages yet"
        status: pass
    human_judgment: false
  - id: D5
    description: "No preserved changelog entry is dropped, invented, reworded or reordered-by-invention — every v1 JSON entry and every public D1 row appears with its original date, title and item text"
    requirement: "REND-02"
    verification:
      - kind: unit
        ref: "tests/unit/static-pages.test.mjs#static-pages: every v1-json and D1 changelog fixture entry appears verbatim (date, title, every item) on the built changelog page"
        status: pass
    human_judgment: false

duration: ~90min
completed: 2026-09-27
status: complete
---

# Phase 4 Plan 08: Changelog Loader & Static Pages Summary

**A dual-source (v1 changelog.json + D1 public_changelogs) changelog Content Layer loader with a fail-loud never-shrink check that ratchets its own floor upward as production catches up, plus five static pages (/changelog, /contact, /about, /privacy, /terms) — the fix for the exact `/changelog` empty-state bug this project already shipped once in v1.**

## Performance

- **Duration:** ~90 min (includes a mid-execution premise-verification checkpoint)
- **Started:** 2026-09-27T15:56:51Z (STATE.md, plan start)
- **Completed:** 2026-09-27T~17:30Z
- **Tasks:** 3
- **Files modified:** 12 (11 created, 1 modified)

## Accomplishments

- Built `src/content/loaders/changelog-loader.ts`, a genuine TDD RED/GREEN pair: merges v1's live
  `changelog.json` with D1's `public_changelogs` (public rows only), converts D1 epoch dates to
  `YYYY-MM-DD` in America/Denver, removes exact cross-source duplicates (keeping the v1-json copy),
  sorts newest-first, and refuses to build on zero entries/rows, a fetch failure, invalid JSON, a
  malformed row, or a shrink below the last-good baseline — proven with a real `pnpm run build`
  replay of the exact input shape that caused v1's historical empty-state bug.
- Wired the loader into `src/content.config.ts` as a new `changelog` collection alongside
  `articles`.
- Built `/changelog` (full preserved history, dispatch layout, Latest Stories rail) and `/contact`
  (mockup's real bio copy, a genuinely disabled `<fieldset>`, an honest "not accepting messages yet"
  notice — no fake-working form).
- Ported `/about`, `/privacy` and `/terms` from v1's current text verbatim, in a shared narrow
  reading column, with one dead internal link (`/sources`, which doesn't exist in this build)
  omitted rather than left broken.
- Mid-execution: caught and corrected a real premise mismatch — v1's live changelog.json currently
  serves fewer entries than this phase's own planning research recorded two days earlier, traced to
  a genuine cause (an undeployed v1 commit), not a caching artifact. Surfaced as a checkpoint, owner
  decided the resolution; see Deviations.

## Task Commits

1. **Task 1: Changelog loader with D-13 merge and fail-loud rules, plus the REND-03 regression
   replay** (`tdd="true"`) — `ab56007` (test, RED — confirmed both new test files failed with
   `ERR_MODULE_NOT_FOUND` before the loader existed) → `b19b232` (feat, GREEN — 19/19 unit tests
   passing)
2. **Task 2: /changelog and /contact pages ported from the approved mockups** — `57999d5` (feat)
3. **Task 3: Port /about, /privacy and /terms with v1's current text** — `6a4d68a` (feat)

**Plan metadata:** commit follows this SUMMARY (docs: complete plan)

## Files Created/Modified

- `src/content/loaders/changelog-loader.ts` (new) — `changelogLoader()`, `changelogSchema`,
  `DEFAULT_V1_CHANGELOG_URL`, `CHANGELOG_MIN_EXPECTED`
- `src/content.config.ts` — added the `changelog` collection
- `src/pages/changelog.astro` (new) — full preserved history + Latest Stories rail
- `src/pages/contact.astro` (new) — disabled contact form, honest notice, Latest Stories grid
- `src/pages/about.astro`, `privacy.astro`, `terms.astro` (new) — v1's text verbatim
- `tests/unit/changelog-loader.test.mjs` (new) — 19 tests (merge/dedupe/sort/fail-loud/ratchet-up)
- `tests/unit/static-pages.test.mjs` (new) — 9 dist-output tests across all 5 pages
- `tests/regression/changelog-empty-state.test.mjs` (new) — REND-03 replay (unit + real-build)
- `tests/fixtures/v1-changelog.json`, `tests/fixtures/d1-public-changelogs.json` (new) — live
  snapshots captured 2026-09-27

## Decisions Made

See `key-decisions` in frontmatter above — summarized: the owner-adjusted `CHANGELOG_MIN_EXPECTED`
floor (15, ratcheting to 18 once v1 deploys), no incremental sync modes for the changelog loader,
exact-duplicate-keeps-v1-json dedup rule, no fabricated contact address, `[data-contact-column]`
reuse for the three legal/about pages, and the one omitted dead internal link.

## Deviations from Plan

### Checkpoint: Premise Verification (owner-resolved, not a Rule 1-4 auto-fix)

**1. v1's live changelog.json serves fewer entries than this phase's planning research recorded**
- **Found during:** Task 1, mandatory premise check before implementing against a named live
  source (this project's own rule, after a prior plan this phase found production differing from a
  plan's assumption).
- **Issue:** The plan's `CHANGELOG_MIN_EXPECTED = 18` was measured 2026-09-26 (12 JSON entries + 6
  D1 rows). Re-verified live 2026-09-27: the live URL serves only 9 entries (missing the 3 newest,
  all dated 2026-09-21). My first hypothesis (a stale Cloudflare edge cache) was wrong — the
  orchestrator corrected it with direct evidence: `wrangler deployments list` in the v1 repo shows
  the last production deploy at 2026-09-19T17:13Z, while the 3 missing entries were committed to
  v1's repo on 2026-09-21 (`e991d56`) and never deployed. Production genuinely publishes only 9
  entries today; this is not a caching artifact.
- **Action:** Surfaced as a `checkpoint:decision` before writing any implementation code (this
  plan's own project rule requires a checkpoint, not a guess, when a named source's real content
  differs from the plan's assumption in a way that changes build behavior). Owner decision: floor
  at what production actually publishes today (15 = 9 JSON + 6 D1), not at a count that assumes 3
  entries this loader cannot see and must not fetch out-of-band (v1's repo file is never read at
  build time; v1's Cloudflare zone is never touched).
- **Fix:** `CHANGELOG_MIN_EXPECTED = 15`, with a code comment citing the date, the real cause, and
  that 18 assumed the 3 undeployed entries. The never-shrink baseline mechanism (already part of the
  plan's design — `lastGood.changelog.count`) is unchanged and requires no further work to ratchet
  the floor to 18 automatically: proven by a dedicated test
  (`tests/unit/changelog-loader.test.mjs#ratchet-up`) that a recorded baseline of 18 requires >=18
  even though 18 exceeds `CHANGELOG_MIN_EXPECTED`.
- **Files modified:** `src/content/loaders/changelog-loader.ts` (constant + comment),
  `tests/unit/changelog-loader.test.mjs` (tests reference the constant, not a hardcoded 18),
  `tests/unit/static-pages.test.mjs` (dispatch-count assertion checks against the fixtures' own
  combined length, not a hardcoded 18)
- **Verification:** A real `pnpm run build` against live production data succeeds; a real build
  against a `data:` URL serving zero entries fails loud; the ratchet-up test passes.
- **Committed in:** `b19b232` (Task 1 GREEN commit)

### Auto-fixed Issues

**2. [Rule 1 - Bug] Test regex mismatch: "isn't accepting" vs. "not accepting"**
- **Found during:** Task 2, first `static-pages.test.mjs` run against real dist output
- **Issue:** The test asserted `/not accepting messages/i` but contact.astro's actual copy reads
  "isn't accepting messages" — a test bug (wrong regex), not an implementation bug.
- **Fix:** Corrected the regex to `/isn't accepting messages/i`.
- **Files modified:** `tests/unit/static-pages.test.mjs`
- **Verification:** Test passes against the real built page.
- **Committed in:** `57999d5` (Task 2 commit)

**3. [Rule 1 - Bug] Plan's acceptance-grep count was wrong for `content.config.ts`**
- **Found during:** Task 1 acceptance-criteria check
- **Issue:** The plan's `grep -c "changelogLoader" src/content.config.ts` acceptance check expects
  1, but the file legitimately contains 2 occurrences (the import line and the `defineCollection`
  usage line) — the same pattern the pre-existing `articlesLoader` import already uses in the same
  file (also 2 occurrences), confirming this is an acceptance-check estimate error, not a code
  defect, matching the acceptance-grep false-positive class documented in 04-02-SUMMARY.md and
  04-05-SUMMARY.md.
- **Fix:** No code change — the existing 2-occurrence pattern matches this file's own established
  convention. Documented here rather than contorting the import to avoid a literal grep count.
- **Files modified:** None.
- **Verification:** `grep -c "articlesLoader" src/content.config.ts` also returns 2, confirming the
  acceptance check's expected count (not this plan's code) was the estimate.
- **Committed in:** N/A (no code change)

---

**Total deviations:** 1 owner-resolved checkpoint (premise verification) + 2 auto-fixed (Rule 1 —
one test-file bug, one acceptance-check estimate error).
**Impact on plan:** The premise-verification checkpoint changed one constant's value and its
justification comment; the loader's design (fetch, merge, dedupe, fail-loud, never-shrink) is
exactly as planned. No scope creep.

## Issues Encountered

None beyond the items documented above.

## Known Stubs

None. Every page renders real, complete data from a real build (production D1 + v1's live
changelog.json). The contact form's disabled state is a deliberate, documented, honestly-labeled
placeholder (Phase 10 wires submission) — not a stub standing in for missing behavior the page
pretends to have.

## Threat Flags

None beyond what the plan's own `<threat_model>` already registered (T-04-31 fetch-outage
mitigation, T-04-32 schema validation/escaping, T-04-33 env-var override trust, T-04-34 disabled
contact form) — no new security-relevant surface was introduced beyond those four already-tracked
items.

## User Setup Required

None — no external service configuration required. `V1_CHANGELOG_URL` and
`ALLOWED_CHANGELOG_SHRINK` are optional build-time env var overrides with working defaults.

## Next Phase Readiness

- FIX-05, REND-02, REND-03 are structurally complete: `/changelog` cannot ship empty or shrunken,
  proven by a real-build regression replay, not just a unit test.
- **Phase 12 dependency (repeated from the plan's own planner_findings):** `V1_CHANGELOG_URL`
  defaults to v1's live URL (`https://915tldr.com/changelog.json`). At cutover, this project's own
  domain starts serving v2, so this URL must be repointed then (to wherever v1's changelog.json is
  archived/relocated) — a build against a URL that no longer serves the file will fail loud and
  notify, by design, rather than silently shipping an empty page.
- **Owner review candidate:** once v1 deploys its pending 3 changelog entries (commit `e991d56`),
  the very next `pnpm run build` here will observe `total=18` for the first time and record that as
  the new last-good baseline automatically — no action needed on this project's side, but worth
  confirming when v1's next deploy happens.
- `/contact`'s disabled form is Phase 10's explicit next consumer (SUB/trust requirements wire real
  submission there).
- `/about` is Phase 10's explicit next consumer for a content rewrite (IDNT-01/02) — this plan
  deliberately preserved v1's wording unchanged.

---
*Phase: 04-static-generation-templates-seo*
*Completed: 2026-09-27*

## Self-Check: PASSED

All claimed created/modified files verified present on disk (11 created files, 1 modified file,
this SUMMARY). All claimed commit hashes verified present in `git log --oneline --all` (`ab56007`,
`b19b232`, `57999d5`, `6a4d68a`).
