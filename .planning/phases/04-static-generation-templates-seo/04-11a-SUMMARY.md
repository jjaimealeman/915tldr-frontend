---
phase: 04-static-generation-templates-seo
plan: 11a
subsystem: frontend
tags: [astro, build-stamp, cloudflare-workers, asset-dedup, performance]

# Dependency graph
requires:
  - phase: 04-static-generation-templates-seo
    provides: "04-10's real-measurement finding that Base.astro's unconditional BUILD_HASH footer defeats Cloudflare's content-hash asset-upload dedup (docs/phase-04/build-measurements.md), and 04-11's owner-approved deferral of the fix to a follow-up quick fix"
provides:
  - "Base.astro's buildStamp boolean prop (default false) — the footer commit-hash/build-stamp line is now opt-in per page instead of unconditional"
  - "The homepage (src/pages/index.astro) as the sole page still showing the build stamp; /version.json unaffected (reads build-info.ts directly)"
  - "Updated cross-surface tests proving the stamp's new presence/absence contract (homepage yes, article/category/tag no) and that this build's real BUILD_HASH never leaks into an article page's bytes"
affects: [04-12]

# Actuals (#2632)
actuals:
  tokens: 5736
  tasks: 5
  commits: 2

tech-stack:
  added: []
  patterns:
    - "An opt-in boolean prop (buildStamp) gates an entire markup element via {prop && (<element/>)}, rather than gating only one of the element's internal values (the prior stamp-date-only gating) — closes the gap where a per-build-varying value could still leak through an otherwise-conditional element."

key-files:
  created:
    - .planning/phases/04-static-generation-templates-seo/04-11a-SUMMARY.md
    - changelog/2026-09-30-1611_footer-build-stamp-opt-in-homepage-only.md
  modified:
    - src/layouts/Base.astro
    - src/pages/index.astro
    - src/pages/[category]/[slug].astro
    - tests/unit/build-stamp.test.mjs
    - tests/unit/chrome.test.mjs
    - docs/phase-04/build-measurements.md
    - changelog/README.md
    - .planning/STATE.md

key-decisions:
  - "buildStamp is a new, separate prop from the existing stamp prop (which only controls the DATE SOURCE inside the element, build vs commit) — keeping them separate avoids overloading one prop with two unrelated meanings (whether to render vs which date to render) and keeps article pages' existing stamp=\"commit\" harmless-but-inert rather than requiring its removal."
  - "Only src/pages/index.astro passes buildStamp={true}. No other page (category index, tag, source, static pages, 404, changelog) opts in — matches the owner's exact approval (\"homepage + /version.json only\")."
  - "The 03-03 build-stamp-provenance intent (\"someone debugging the live site can ask which build is this and get the same answer from a script and from the page\") is satisfied by the homepage + /version.json alone — the owner's 2026-09-30 approval is itself the resolution of that intent for this fix, not a conflict requiring a checkpoint."
  - "Left [category]/[slug].astro's stamp=\"commit\" prop in place (dead-but-harmless) rather than removing it, since it costs nothing and remains the correct value if buildStamp is ever re-enabled for articles; updated its doc comment to state plainly that the footer element currently never renders there."
  - "Found (not fixed, same reasoning as 04-10's original disposition): src/pages/[category]/index.astro derives a `buildYear` from BUILD_TIMESTAMP for its 'showYear' logic, which could theoretically vary an unchanged category page's bytes by one word once a year — NOT fixed because category index pages have no cacheKey and are always fully re-rendered every build regardless (same as the homepage), so this has zero effect on the incremental-build/asset-dedup problem this plan exists to fix. Reported per task instructions, correctly out of scope."

requirements-completed: []

coverage:
  - id: D1
    description: "The footer build-stamp element is opt-in (buildStamp prop, default false) instead of unconditional"
    verification:
      - kind: unit
        ref: "tests/unit/chrome.test.mjs#chrome: article pages do NOT render a [data-build] stamp element (04-11a) — pass"
        status: pass
    human_judgment: false
  - id: D2
    description: "The homepage still carries the stamp, agreeing with /version.json's commit hash and builtAt date"
    verification:
      - kind: unit
        ref: "tests/unit/build-stamp.test.mjs#cross-surface: dist/client/version.json and the built homepage report the exact same commit hash — pass"
        status: pass
      - kind: unit
        ref: "tests/unit/build-stamp.test.mjs#cross-surface: the homepage carries data-stamp=\"build\" and its footer date matches version.json's builtAt — pass"
        status: pass
      - kind: unit
        ref: "tests/unit/build-stamp.test.mjs#cross-surface: exactly one data-build element exists in the built homepage — pass"
        status: pass
    human_judgment: false
  - id: D3
    description: "Article, category, and tag pages carry zero data-build elements, and this build's real BUILD_HASH never appears anywhere in an article page's bytes"
    verification:
      - kind: unit
        ref: "tests/unit/build-stamp.test.mjs#cross-surface: article, category, and tag pages carry NO data-build element (04-11a) — pass"
        status: pass
      - kind: unit
        ref: "tests/unit/build-stamp.test.mjs#article page bytes do not vary with BUILD_HASH — this build's real commit hash is absent from a real built article page — pass"
        status: pass
    human_judgment: false
  - id: D4
    description: "Measured before/after: how many of the built HTML files carry the commit hash"
    verification:
      - kind: other
        ref: "grep -rl \"data-build\" dist/client --include=\"*.html\" | wc -l — 1 (dist/client/index.html) of 60,359 built HTML files, down from all ~60,359 before this fix (04-10's Build 3 measurement)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Full test suite and build gate still pass after the change"
    verification:
      - kind: unit
        ref: "pnpm run test:unit — 385/385 pass, 0 fail"
        status: pass
      - kind: unit
        ref: "pnpm run test:build-gate — 8/8 pass"
        status: pass
    human_judgment: false

duration: ~35min
completed: 2026-09-30
status: complete
---

# Phase 4 Plan 11a: Footer Build-Stamp Made Opt-In, Homepage Only Summary

**`Base.astro`'s footer commit-hash stamp is now gated by a new `buildStamp` boolean prop (default `false`); only the homepage passes `buildStamp={true}`, so article/category/tag/static pages no longer change bytes on every commit — measured directly: 1 of 60,359 built HTML files now carries the stamp, down from all of them.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-09-30 (owner-approved quick fix, ad hoc plan id 04-11a, no PLAN.md)
- **Completed:** 2026-09-30
- **Tasks:** 5 (find every stamp reference; implement the opt-in prop; update tests; run the full suite and measure before/after; update docs + write this summary)
- **Files modified:** 8 (2 created, 6 modified — see `key-files`)

## Accomplishments

- Added `Base.astro`'s `buildStamp?: boolean` prop (default `false`), wrapping the entire
  `<p data-build data-stamp={stamp}>build {BUILD_HASH} · {stampDate}</p>` footer line in
  `{buildStamp && (...)}` — the whole element is now conditional, not just its internal date
  value (which was already stamp-gated via the pre-existing `stamp` prop).
- Wired `src/pages/index.astro` to pass `buildStamp={true}` — the only page in the entire route
  set that opts in, per the owner's exact 2026-09-30 approval ("homepage + `/version.json` only").
- `/version.json` (`src/pages/version.json.ts`) is completely untouched — it reads
  `src/lib/build-info.ts`'s `BUILD_HASH`/`BUILD_TIMESTAMP`/`BUILD_HASH_SOURCE`/`BUILD_COMMIT_DATE`
  constants directly and was never coupled to `Base.astro`'s rendering decision.
- Rewrote the three existing tests whose assertions assumed the OLD unconditional-stamp behavior
  (`tests/unit/chrome.test.mjs`'s "a `[data-build][data-stamp]` element is present" case, and two
  cross-surface cases in `tests/unit/build-stamp.test.mjs`) to assert the new, opposite contract:
  present on the homepage, absent from articles/categories/tags. Added two new cases: a combined
  article+category+tag absence proof, and a direct proof that this build's real, resolved
  `BUILD_HASH` string never appears anywhere in a built article page's HTML at all (not just
  inside the now-absent footer element) — the strongest single-build proof of byte-independence
  obtainable without running two full builds with different hashes.
- Measured the fix directly against a real build: `grep -rl "data-build" dist/client
  --include="*.html"` returns exactly **1** file (`dist/client/index.html`) out of **60,359**
  built HTML files — down from effectively all of them before this fix (04-10's Build 3
  measurement: 60,355/60,355 files uploaded, only 7 already present).
- Ran `pnpm run test:unit` (which runs a full real `pnpm build` first): **385/385 tests pass, 0
  fail**. Ran `pnpm run test:build-gate`: **8/8 pass**.
- Updated `docs/phase-04/build-measurements.md`'s "Finding: near-total asset re-upload on every
  commit change" section with a `FIXED in 89bbe38` note recording what changed and the measured
  before/after count.

## Task Commits

1. **Task 1: Find every stamp reference (grep sweep)** — no code commit; findings folded into
   Task 2's implementation and reported in this summary's "Other per-build-varying values found"
   section below.
2. **Task 2: Implement the opt-in `buildStamp` prop; Task 3: update tests** —
   `89bbe38` (`fix(04-11a)`, 915tldr.com)
3. **Task 4: run the full suite, measure before/after** — no separate commit (verification only,
   folded into the commit above since it ran before committing).
4. **Task 5: update docs + write this summary** — commit follows this SUMMARY (docs: complete
   plan), per this plan's own required order.

## Files Created/Modified

- `src/layouts/Base.astro` — new `buildStamp?: boolean` prop (default `false`); footer element
  now `{buildStamp && (<p data-build data-stamp={stamp}>build {BUILD_HASH} · {stampDate}</p>)}`
- `src/pages/index.astro` — passes `buildStamp={true}` to `<Base>`
- `src/pages/[category]/[slug].astro` — doc comment updated to state the footer never renders on
  article pages now; `stamp="commit"` prop left in place (inert but correct if re-enabled)
- `tests/unit/build-stamp.test.mjs` — cross-surface tests moved from article page to homepage;
  added absence proof (article/category/tag) and a real-hash-leak proof
- `tests/unit/chrome.test.mjs` — the `[data-build]` presence assertion inverted to an absence
  assertion for article pages
- `docs/phase-04/build-measurements.md` — finding section amended with `FIXED in 89bbe38`
- `changelog/2026-09-30-1611_footer-build-stamp-opt-in-homepage-only.md` (new)
- `changelog/README.md` — index entry prepended
- `.planning/STATE.md` — decision line added

## Decisions Made

See `key-decisions` in frontmatter above — summarized: `buildStamp` is a separate, new prop from
the pre-existing `stamp` prop (render-gate vs. date-source, kept distinct); only the homepage
opts in, exactly matching the owner's approval; 03-03's original build-stamp-provenance intent is
satisfied by homepage + `/version.json` (the owner's approval IS the resolution, not a conflict);
`[category]/[slug].astro`'s `stamp="commit"` prop was left in place as harmless dead weight rather
than removed.

## Deviations from Plan

None. This is a quick fix executed exactly as scoped by the owner-approved objective — no Rule
1-4 deviations encountered. The one "found but not fixed" item (category index pages' `buildYear`
derived from `BUILD_TIMESTAMP`) is documented below, not a deviation, since it was explicitly
scoped as "report what you find; fix only the stamp unless another item is trivially the same
class" and this item is NOT the same class (see next section).

## Other per-build-varying values found (reported per Task 1, not fixed)

`src/pages/[category]/index.astro` imports `BUILD_TIMESTAMP` to compute a `buildYear` constant,
used only to decide whether an article's byline should show its year (`showYearFor()` — true only
when an article's year differs from the current build's year). This is a per-build-varying value
on a non-home page. **Not fixed**, because it is not the same class of problem the stamp was:
category index pages have **no `cacheKey`** in their `getStaticPaths()` (confirmed by grep — only
`[category]/[slug].astro` and `tag/[slug].astro` declare one), meaning Astro's
`experimental.incrementalBuild` never attempts to reuse them — they are fully re-rendered on
every single build regardless of content, exactly like the homepage. A category page's bytes were
never eligible for the asset-upload dedup this plan exists to restore, so gating `buildYear` would
add complexity with zero measurable benefit. No other `BUILD_HASH`/`BUILD_TIMESTAMP`/
`BUILD_COMMIT_DATE` reference exists anywhere else in `src/pages`, `src/layouts`, or
`src/components` beyond `Base.astro`, `index.astro`, `[category]/index.astro`, and
`version.json.ts` (confirmed via `grep -rln` across all three directories).

## Issues Encountered

None. No auto-fixes, no blockers, no auth gates.

## Known Stubs

None. The fix is real, complete markup logic — no placeholder values, no deferred wiring.

## Threat Flags

None. No new trust boundary, network endpoint, or auth path introduced — this is a pure
build-time conditional-rendering change to already-public, non-sensitive markup
(`/version.json`'s T-03-08 disposition — "accept," commit hash is not secret — is unaffected).

## User Setup Required

None.

## Next Phase Readiness

- 04-12 (end-of-phase review) can now close out the "BUILD_HASH footer-stamp fix" item that
  `04-11-SUMMARY.md`'s "Next Phase Readiness" listed as a pending quick fix — it is done.
- `tests/regression/byte-identity.test.mjs` was not re-run in this session (not required by this
  plan's own verification steps, and its own top comment already explains it does not need to
  account for the footer-stamp field, since both its builds check out the same commit and
  therefore the same `BUILD_HASH` regardless of this fix). A future full regression run will
  continue to pass unaffected.

---
*Phase: 04-static-generation-templates-seo*
*Completed: 2026-09-30*

## Self-Check: PASSED

Verified `src/layouts/Base.astro` contains `buildStamp` (grep: 4 occurrences). Verified
`src/pages/index.astro` contains `buildStamp={true}` (grep: 1 occurrence). Verified commit
`89bbe38` exists via `git log --oneline -3` (present, message matches: "fix(04-11a): make footer
build-stamp opt-in, homepage only"). Verified `docs/phase-04/build-measurements.md` contains the
`FIXED in \`89bbe38\`` note (grep confirmed, present at line 541). Verified `pnpm run test:unit`
(385/385 pass) and `pnpm run test:build-gate` (8/8 pass) both ran successfully against the code in
this summary. Verified the measured claim directly:
`grep -rl "data-build" dist/client --include="*.html" | wc -l` returned `1`.
