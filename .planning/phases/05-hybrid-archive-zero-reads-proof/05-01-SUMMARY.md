---
phase: 05-hybrid-archive-zero-reads-proof
plan: 01
subsystem: infra
tags: [astro, archive-tier, tiering, hot-window, build-time-decision, node-test]

# Dependency graph
requires:
  - phase: 04-static-generation-templates-seo
    provides: the article/tag getStaticPaths routes, the render manifest, and the loader's
      ArticleData shape (uuid, publishedAt, category.slug, slug) this plan's tier facts are
      derived from
provides:
  - "src/lib/archive/tiering.ts: pure D-08 tag threshold + article hot-cutoff rules
    (isHotTag, hotCutoffEpoch, isHotArticle, classifyArticles, classifyTags, projectStaticCount)"
  - "src/lib/archive/hot-window.ts: the single validated source of the hot-article cutoff
    (parseHotWindow, loadHotWindow, describeHotWindow), rejecting a malformed or unflagged
    config rather than silently defaulting"
  - "src/lib/archive/hot-window.json: the committed D-07 bootstrap fallback (90 days,
    fallback-provisional), replaced by 05-05's traffic-derived window"
  - "src/lib/archive/tier-facts.ts + .astro/tier-facts-{articles,tags}.json: build-time facts
    emitted by the article/tag routes, re-validated on read, one entry per public article/tag"
  - "tools/tier-report.mjs: CLI classifying the last build's facts under the current or a
    candidate hot window"
affects: [05-02, 05-03, 05-04, 05-05, "the R2 archive-serving Worker branch (REND-08)"]

# Actuals (#2632)
actuals:
  tokens: 11069
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "Build-time tier facts (.astro/*.json, gitignored), re-validated on read — mirrors the
      existing .astro/tag-build-log.json pattern (tag/[slug].astro)"
    - "Every thrown error is module-prefixed (tiering:, hot-window:, tier-facts:) — the
      convention tools/ci-build.mjs's classifyFailure already anchors on"
    - "UTC-day-floored cutoff epoch so every route in one build agrees on the same hot/archive
      split regardless of the exact second it runs"

key-files:
  created:
    - src/lib/archive/tiering.ts
    - src/lib/archive/hot-window.ts
    - src/lib/archive/hot-window.json
    - src/lib/archive/tier-facts.ts
    - tools/tier-report.mjs
    - tests/unit/tiering.test.mjs
    - tests/unit/hot-window.test.mjs
    - tests/unit/tier-facts.test.mjs
  modified:
    - src/pages/[category]/[slug].astro
    - src/pages/tag/[slug].astro

key-decisions:
  - "Task 1's tiering.ts/hot-window.ts were deliberately left minimal (no throwing validation,
    no projectStaticCount, no derived-window field checks) so Task 2's RED/GREEN cycle could be
    genuine — confirmed RED (6 real test failures) before writing any Task 2 implementation."
  - "tier-facts.ts lives under src/lib/archive/, not src/lib/server/ — it has no credentials and
    no D1/KV access, so it does not need (and must not acquire) the FORBIDDEN_TARGET_DIR guard's
    protection; grep confirms zero imports from .../server/ anywhere under src/lib/archive/."

requirements-completed: [REND-09, REND-10]

coverage:
  - id: D1
    description: "D-08 tag tiering: a tag stays static only at 10+ full-count public articles
      (9 archive, 10 hot, 11 hot), computed from the full uncapped per-tag article count, never
      the 30-card page cap"
    requirement: "REND-09"
    verification:
      - kind: unit
        ref: "tests/unit/tiering.test.mjs#isHotTag: exactly 10 articles is hot (true)"
        status: pass
      - kind: unit
        ref: "tests/unit/tiering.test.mjs#isHotTag: 9 articles is archive-tier (false)"
        status: pass
      - kind: integration
        ref: "tests/unit/tier-facts.test.mjs#tier-facts: node tools/tier-report.mjs --json exits 0, classifies tags.hot as the count with count >= 10, flags hotWindow.provisional"
        status: pass
    human_judgment: false
  - id: D2
    description: "Hot window is read from one validated file (hot-window.json); the bootstrap
      D-07 fallback is visibly flagged PROVISIONAL everywhere it is recorded (describeHotWindow,
      tier-report output, the build log)"
    requirement: "REND-10"
    verification:
      - kind: unit
        ref: "tests/unit/hot-window.test.mjs#parseHotWindow: rejects a fallback-provisional window with provisional: false"
        status: pass
      - kind: unit
        ref: "tests/unit/hot-window.test.mjs#describeHotWindow: the fallback window contains PROVISIONAL and 90"
        status: pass
      - kind: integration
        ref: "bash -o pipefail -c 'pnpm run build 2>&1 | grep -c \"PROVISIONAL\"' -> 1"
        status: pass
    human_judgment: false
  - id: D3
    description: "A real build writes tier facts end to end and tools/tier-report.mjs classifies
      them, provably matching the built dist/client pages one to one"
    verification:
      - kind: unit
        ref: "tests/unit/tier-facts.test.mjs#tier-facts: the set of fact uuids equals the set of uuids parsed from built article file names"
        status: pass
      - kind: unit
        ref: "tests/unit/tier-facts.test.mjs#tier-facts: every article fact path maps to an existing dist/client<path>.html file"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-09-30
status: complete
---

# Phase 5 Plan 1: Tag Tiering, Hot Window, and Build-Time Tier Facts Summary

**Pure D-08 tag-threshold and age-cutoff rules, a single validated hot-window config file (D-07
bootstrap, provisional), and build-time tier facts a real build now emits and `tools/tier-report.mjs`
classifies end to end — `tags.hot` measures exactly 2,325, matching 05-CONTEXT.md's own figure.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-30T22:06:31-06:00 (context/research read began immediately after)
- **Completed:** 2026-09-30T22:29:58-06:00
- **Tasks:** 3 (Task 1 tracer + TDD, Task 2 auto + TDD, Task 3 auto)
- **Files modified:** 10 (8 new, 2 modified)

## Accomplishments

- A real `pnpm run build` now writes `.astro/tier-facts-articles.json` (one entry per public
  article: uuid, canonical path, publishedAt) and `.astro/tier-facts-tags.json` (one entry per
  tag: slug, full uncapped article count) — `src/pages/[category]/[slug].astro` and
  `src/pages/tag/[slug].astro` call `writeArticleFacts`/`writeTagFacts` once per build.
- `src/lib/archive/tiering.ts` implements D-08's tag threshold (inclusive at 10) and an inclusive
  article age-cutoff, both with throw-on-invalid-input discipline, plus `projectStaticCount` —
  the shared static-file projection 05-05's file-budget cap will reuse.
- `src/lib/archive/hot-window.ts` is the single validated source of the hot-article cutoff:
  `parseHotWindow` rejects a missing file, an unknown status, a non-integer/non-positive `days`,
  a fallback not flagged provisional, and (new in Task 2) a derived window missing its
  traffic-derivation fields or flagged provisional. The committed `hot-window.json` is the D-07
  bootstrap (90 days, `fallback-provisional`), and `describeHotWindow`'s output — printed once
  per build from `[category]/[slug].astro` — always contains `PROVISIONAL` while it is in effect.
- `tools/tier-report.mjs` classifies the last build's facts: `tags.hot` measures **2,325**,
  exactly matching 05-CONTEXT.md's own measured D-08 figure.
- `tests/unit/tier-facts.test.mjs` proves the facts provably match the built pages: every fact
  path resolves to a real `dist/client` HTML file, the fact-uuid set equals the built-file uuid
  set, and neither facts file has a duplicate key.

## Task Commits

Task 1 ran as a genuine TDD tracer (RED then GREEN), Task 2 ran as a second genuine TDD RED/GREEN
cycle extending the same modules, Task 3 was a single `auto` commit:

1. **Task 1 — RED:** `1ae3549` (test) — `tests/unit/tier-facts.test.mjs`, written against
   not-yet-existing `src/lib/archive/tier-facts.ts`/`tools/tier-report.mjs`
2. **Task 1 — GREEN:** `55d289d` (feat) — minimal `tiering.ts`/`hot-window.ts`/`hot-window.json`/
   `tier-facts.ts`, route instrumentation, `tools/tier-report.mjs`; proved against a real
   60,395-page build
3. **Task 2 — RED:** `c291b30` (test) — `tests/unit/tiering.test.mjs` +
   `tests/unit/hot-window.test.mjs`; confirmed genuinely RED (6 failures) before any
   implementation change
4. **Task 2 — GREEN:** `574024a` (feat) — throwing validation in `tiering.ts`,
   `projectStaticCount`, derived-window validation in `hot-window.ts`
5. **Task 3:** `5f37e86` (feat) — build-time `describeHotWindow(loadHotWindow())` log line,
   `tier-facts.test.mjs` cross-checks against the real build

_Note: both TDD tasks produced genuinely confirmed RED states — Task 2's RED run reported 6 real
failures against Task 1's deliberately-minimal implementation before any GREEN code was written._

## Files Created/Modified

- `src/lib/archive/tiering.ts` - pure D-08 tag threshold, UTC-day-floored article cutoff,
  classification, `projectStaticCount`
- `src/lib/archive/hot-window.ts` - hot-window config parser/loader/describer, fail-loud on any
  malformed or unflagged input
- `src/lib/archive/hot-window.json` - the committed D-07 bootstrap (90 days, provisional)
- `src/lib/archive/tier-facts.ts` - build-time facts writer/reader, re-validates every entry on
  read
- `tools/tier-report.mjs` - CLI classifying the last build's facts under the current/candidate
  hot window
- `tests/unit/tiering.test.mjs` - D-08/cutoff boundary + throw-on-invalid-input tests
- `tests/unit/hot-window.test.mjs` - parseHotWindow accept/reject + describeHotWindow tests
- `tests/unit/tier-facts.test.mjs` - dist-based facts-match-build tests
- `src/pages/[category]/[slug].astro` - calls `writeArticleFacts` and logs the hot window once
  per build
- `src/pages/tag/[slug].astro` - calls `writeTagFacts` with the full uncapped per-tag count

## Decisions Made

- Kept Task 1's `tiering.ts`/`hot-window.ts` deliberately minimal (plain booleans, no throwing,
  no derived-window validation) so Task 2's own RED/GREEN cycle would be genuine rather than
  vacuous — verified by actually running the new test files against the Task 1 implementation
  and observing 6 real failures before writing any Task 2 code.
- Placed `tier-facts.ts` under `src/lib/archive/`, not `src/lib/server/` — it holds no
  credentials and makes no D1/KV call, so it does not need `tools/assert-no-d1.mjs`'s
  `FORBIDDEN_TARGET_DIR` protection (confirmed: `grep -rEc "from ['\"][^'\"]*/server/" src/lib/archive/`
  reports 0 for every file).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a wrong relative import path in tier-facts.ts**
- **Found during:** Task 1, first `pnpm run build` attempt
- **Issue:** `tier-facts.ts` (at `src/lib/archive/tier-facts.ts`) imported `./article-url.ts`,
  which resolves to the non-existent `src/lib/archive/article-url.ts` — the real module is one
  directory up at `src/lib/article-url.ts`. The build failed immediately with a clear
  `UNRESOLVED_IMPORT` error.
- **Fix:** Changed the import to `../article-url.ts`.
- **Files modified:** `src/lib/archive/tier-facts.ts`
- **Verification:** `pnpm run build` completed cleanly (60,395 pages) on the next attempt.
- **Committed in:** `55d289d` (Task 1 GREEN commit — caught before that commit was made, so no
  separate fix commit was needed)

---

**Total deviations:** 1 auto-fixed (1 bug, caught immediately by the build itself)
**Impact on plan:** No scope creep — a pure path-typo, fixed before any commit was made.

## Issues Encountered

None beyond the auto-fixed import path above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `src/lib/archive/{tiering,hot-window,tier-facts}.ts` and `hot-window.json` are the stable
  decision layer the rest of Phase 5 builds on: 05-02/05-03 (the R2 archive-serving Worker
  branch, REND-07/08) can call `classifyArticles`/`classifyTags` against the same facts; 05-05
  (traffic-derived hot window) replaces `hot-window.json`'s bootstrap content and must satisfy
  the same `parseHotWindow` derived-window validation this plan already pins with tests.
- The plan's two `prohibitions` entries (tag tiering must never be influenced by anything but
  the D-08 count; a missing/malformed hot-window file must never silently default) are both
  test-covered here (`tiering.test.mjs`'s 9/10/11 boundary pins, `hot-window.test.mjs`'s full
  reject-shape list) but remain flagged `status: unresolved` in the plan frontmatter pending a
  wired check descriptor at verify time — this is a verifier-side wiring task, not unfinished
  implementation.
- No blockers. `pnpm run test:fast` (428/428), `pnpm run test:regression` (5/5), and
  `pnpm run test:tracer` (4/4 pass, 1 pre-existing unrelated skip) all pass clean after this
  plan's changes.

---
*Phase: 05-hybrid-archive-zero-reads-proof*
*Completed: 2026-09-30*

## Self-Check: PASSED

All 10 key files confirmed present on disk; all 5 cited task commit hashes (`1ae3549`,
`55d289d`, `c291b30`, `574024a`, `5f37e86`) confirmed present in `git log --oneline --all`.
