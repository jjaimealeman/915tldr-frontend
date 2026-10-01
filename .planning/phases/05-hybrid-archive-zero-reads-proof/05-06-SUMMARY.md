---
phase: 05-hybrid-archive-zero-reads-proof
plan: 06
subsystem: infra
tags: [astro, archive-tier, build-pipeline, file-count-gate, node-test]

# Dependency graph
requires:
  - phase: 05-hybrid-archive-zero-reads-proof
    provides: "05-01's tiering.ts/hot-window.ts/tier-facts.ts (classifyArticles/classifyTags,
      the validated hot-window loader, and build-time article/tag facts this plan's partition
      reads instead of a second D1 read) and 05-05's traffic-derived hot-window.json (202 days,
      derived, not provisional) — the real cutoff this plan's partition classifies against"
provides:
  - "tools/partition-archive.mjs: post-build partition of archive-tier article/tag pages out of
    dist/client into dist/archive, byte-identical, with dist/archive-plan.json as the contract
    05-07 (R2 upload) reads"
  - "tools/assert-file-count.mjs: the REND-11/D-13 file-count gate (fails at 80,000, warns at
    70,000) and dist/client/static-budget.json, published at /static-budget.json"
  - "package.json build script: clean -> astro build -> partition -> file-count gate"
  - "Existing dist-output tests (listing-pages, not-found, tier-facts, seo-surfaces,
    news-sitemap) and the byte-identity regression updated to the 'static or archived' rule"
affects: ["05-07 (reads dist/archive-plan.json to upload archived pages to R2)", "05-08 (wires
  the file-count gate's 70,000 alarm and the daily file-count report)", "05-12 (the real
  zero-reads gate load test runs against this archive-serving build)"]

# Actuals (#2632)
actuals:
  tokens: 18343
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Post-build partition: astro build renders every public page the same way (hot or archive
      — the templates don't know the difference); a separate script then relocates the
      archive-tier subset of that SAME output, so archived pages are byte-identical by
      construction rather than separately re-rendered."
    - "Path-safety discipline (T-05-22): every source/destination path resolved and asserted to
      stay inside its owning directory (dist/client or dist/archive) before any filesystem
      mutation — mirrors tools/assert-no-d1.mjs's fail-loud, never-silent-coerce convention."
    - "staticFileCount includes the file that records it (dist/client/static-budget.json) — the
      published number matches `find dist/client -type f | wc -l` to the file, not off by one."
    - "'Static or archived' test rule: every pre-existing dist-output test that assumed a page
      lives under dist/client now also accepts dist/archive-plan.json's entry for that page —
      applied project-wide, including one file (news-sitemap.test.mjs) outside this plan's
      original file list, found by running the full suite rather than assumed clean."

key-files:
  created:
    - tools/partition-archive.mjs
    - tools/assert-file-count.mjs
    - tests/unit/partition-archive.test.mjs
    - tests/unit/file-count.test.mjs
  modified:
    - package.json
    - tests/unit/listing-pages.test.mjs
    - tests/unit/not-found.test.mjs
    - tests/unit/tier-facts.test.mjs
    - tests/unit/seo-surfaces.test.mjs
    - tests/unit/news-sitemap.test.mjs
    - tools/compare-builds.mjs
    - tests/regression/byte-identity.test.mjs

key-decisions:
  - "assertFileCount's staticFileCount counts dist/client BEFORE writing static-budget.json,
    then publishes preCount+1 (itself included) and recounts AFTER writing to confirm the
    directory now holds exactly that many files — the must-have's literal 'including itself'
    wording, verified against a live build (find dist/client -type f | wc -l == staticFileCount)."
  - "news-sitemap.test.mjs's full-URL-count test broke immediately after partitioning even
    though it wasn't in this plan's <files> list — fixed under deviation Rule 1 (a bug directly
    caused by this plan's own change): the sitemap plugin runs during astro build, BEFORE
    partition moves pages out of dist/client, so every sitemap URL still names a real page in
    one tier or the other; expected count is now static + archived, not static alone."
  - "A dedicated afterWriteForTest seam was added to assertFileCount (never used by the CLI/build
    path) so the 'forced mismatch throws' behavior bullet could be tested deterministically
    instead of depending on real filesystem race timing."

requirements-completed: []

coverage:
  - id: D1
    description: "A real build partitions its own output: archive-tier article pages move
      byte-identically from dist/client to dist/archive/articles/<uuid>.html and archive-tier
      tag pages to dist/archive/tags/<slug>.html, and dist/archive-plan.json lists each with
      kind, key, canonical path, sha256 and bytes"
    requirement: "REND-07"
    verification:
      - kind: integration
        ref: "pnpm run build (live, 2026-10-01): 12,912 articles and 17,566 tags archived;
          dist/archive-plan.json entries carry sha256/bytes computed from the moved file"
        status: pass
      - kind: unit
        ref: "tests/unit/partition-archive.test.mjs#applyPartition: moves files byte-identically
          (sha256 before == after), writes a plan whose entries match the moved files"
        status: pass
    human_judgment: false
  - id: D2
    description: "D-08/REND-09 precision after a build: dist/client/tag holds exactly the tags
      with 10+ full-count public articles, dist/archive/tags holds every other tag, and together
      they equal the build's authoritative tag count"
    requirement: "REND-09"
    verification:
      - kind: unit
        ref: "tests/unit/listing-pages.test.mjs#listing-pages: dist/client/tag + dist/archive/tags
          together equal the build-time authoritative tag count; dist/client/tag holds exactly
          the >=10-article tags"
        status: pass
      - kind: integration
        ref: "live build: ls dist/client/tag | wc -l == 2325; ls dist/archive/tags | wc -l ==
          17566; .astro/tag-build-log.json tagCount == 19891 == 2325+17566"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-13/REND-11 boundary: the build fails at 80,000 dist/client files (79,999
      passes, 80,000 fails), warns at 70,000+, and a zero count fails as a broken check"
    requirement: "REND-11"
    verification:
      - kind: unit
        ref: "tests/unit/file-count.test.mjs#evaluateFileCount: 69999 is ok; 70000/79999 is warn;
          80000 is fail; 0 is fail with reason 'zero files counted — broken check'"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every build writes dist/client/static-budget.json with staticFileCount
      (including itself), ceiling, failAt, warnAt, status, archivedPages and the hot window in
      force; the published count matches a live recount exactly"
    verification:
      - kind: integration
        ref: "live build: dist/client/static-budget.json staticFileCount=29937 == find
          dist/client -type f | wc -l == 29937"
        status: pass
      - kind: unit
        ref: "tests/unit/file-count.test.mjs#assertFileCount: staticFileCount includes
          static-budget.json itself and matches the post-write recount; throws on a forced
          concurrent-write mismatch"
        status: pass
    human_judgment: false
  - id: D5
    description: "Stale inputs cannot drive a partition: old tier facts/dist/archive/plan are
      deleted before astro build; partition fails loud on a missing source file, missing facts,
      or any path escaping dist/client/dist/archive (T-05-22)"
    verification:
      - kind: unit
        ref: "tests/unit/partition-archive.test.mjs#cleanPartitionInputs and #applyPartition
          (missing source / path-traversal escape cases)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Astro's incremental page reuse still works after partitioning: a second
      consecutive build restores at least 95% of pages"
    verification:
      - kind: integration
        ref: "two live consecutive pnpm run build runs, 2026-10-01: 60,378/60,397 pages restored
          (99.97%)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Existing build-output guarantees (listing pages, 404 index, rss/robots,
      sitemap, tier facts) and the byte-identity regression hold across both the static and
      archive tiers, not just dist/client"
    verification:
      - kind: unit
        ref: "pnpm run test:unit (608/608), pnpm run test:build-gate (9/9)"
        status: pass
      - kind: other
        ref: "pnpm run test:regression — two real consecutive builds, ~112s, byte-identity holds
          (tools/compare-builds.mjs now snapshots dist/archive under an archive/ prefix)"
        status: pass
    human_judgment: false

duration: ~40min
completed: 2026-10-01
status: complete
---

# Phase 5 Plan 6: Post-Build Archive Partition and the 80,000-File Gate Summary

**A real build now moves 30,478 archive-tier article/tag pages out of dist/client into
dist/archive (byte-identical, path-safety-checked, 99.97% incremental-reuse intact), and gates
the remaining static-file count at 80,000 — measured live at 29,937 — publishing the count at
`/static-budget.json` on every build.**

## Performance

- **Duration:** ~40 min
- **Started:** 2026-10-01T00:20 (context/research read began immediately after 05-05 completed)
- **Completed:** 2026-10-01T01:00
- **Tasks:** 3 (Task 1 tracer, Task 2 auto + TDD, Task 3 auto)
- **Files modified:** 12 (4 new, 8 modified) plus changelog bookkeeping

## Accomplishments

- `tools/partition-archive.mjs` classifies a real build's own tier facts (05-01) against the
  real traffic-derived hot window (05-05, 202 days) and moves every archive-tier article/tag
  page from `dist/client` into `dist/archive/<articles|tags>/`, byte-identical (sha256 verified),
  writing `dist/archive-plan.json` — the contract 05-07's R2 upload will read.
- `tools/assert-file-count.mjs` counts `dist/client` on every build, fails at 80,000 files, warns
  at 70,000, and writes `dist/client/static-budget.json` (published at `/static-budget.json`) —
  a live build measured **29,937 static files**, well under the fail threshold, down from the
  pre-partition baseline (~60,414 files once corpus growth since 05-01's 60,387 measurement is
  accounted for — see Issues Encountered).
- A real build's partition counts: **12,912 articles and 17,566 tags archived; 27,575 articles
  and 2,325 tags static** — `dist/client/tag` holds exactly the 2,325 tags with 10+ full-count
  articles (D-08), cross-checked against `.astro/tier-facts-tags.json`.
- `tests/unit/partition-archive.test.mjs` (10 tests) and `tests/unit/file-count.test.mjs`
  (13 tests) pin the D-08/cutoff classification math, byte-identical moves, path-safety
  rejections (T-05-22), and the gate's exact threshold boundaries (69999/70000/79999/80000/0).
- Every pre-existing dist-output test (`listing-pages`, `not-found`, `tier-facts`,
  `seo-surfaces`) and `tools/compare-builds.mjs`/`tests/regression/byte-identity.test.mjs` now
  apply a "static or archived" rule — a page is valid if it lives under `dist/client` OR is
  named by `dist/archive-plan.json`. `tests/unit/news-sitemap.test.mjs`, outside this plan's
  original file list, needed the identical fix (Rule 1, see Deviations).
- Two real consecutive `pnpm run build` runs (no code change between them) restored
  **60,378/60,397 pages (99.97%)** — partitioning does not defeat Astro's incremental page
  reuse (WB_REUSE_PROVEN precedent, docs/phase-04/build-pipeline-decision.md).

## Task Commits

1. **Task 1 (tracer):** `81b727b` (feat) — `tools/partition-archive.mjs`,
   `tools/assert-file-count.mjs`, `package.json` build script. Proved against a real
   60,397-page build.
2. **Task 2 (auto + TDD):** `bdfc1ff` (test) — `tests/unit/partition-archive.test.mjs`,
   `tests/unit/file-count.test.mjs`. See TDD Gate Compliance below — not a genuine separately-
   sequenced RED/GREEN cycle.
3. **Task 3 (auto):** `a42b271` (test) — `listing-pages`/`not-found`/`tier-facts`/
   `seo-surfaces`/`news-sitemap`.test.mjs, `tools/compare-builds.mjs`,
   `tests/regression/byte-identity.test.mjs`.

**Plan metadata:** this commit (next).

## Files Created/Modified

- `tools/partition-archive.mjs` - `ARCHIVE_DIR`, `PARTITION_PLAN_PATH`, `planPartition`,
  `applyPartition`, `cleanPartitionInputs`; CLI `--clean` flag
- `tools/assert-file-count.mjs` - `FILE_COUNT_FAIL_THRESHOLD` (80,000), `FILE_COUNT_WARN_THRESHOLD`
  (70,000), `STATIC_ASSET_CEILING` (100,000), `STATIC_BUDGET_FILE`, `countStaticFiles`,
  `evaluateFileCount`, `assertFileCount`
- `package.json` - `build` script: clean → astro build → partition → file-count gate
- `tests/unit/partition-archive.test.mjs` - classification, byte-identical moves, path safety
- `tests/unit/file-count.test.mjs` - threshold boundaries, superset counting, recount/mismatch
- `tests/unit/listing-pages.test.mjs` - tag-count test now sums static + archived
- `tests/unit/not-found.test.mjs` - 404-index same-build check accepts static or archived
- `tests/unit/tier-facts.test.mjs` - every 05-01 cross-check sums static + archived
- `tests/unit/seo-surfaces.test.mjs` - rss.xml link check accepts static or archived
- `tests/unit/news-sitemap.test.mjs` - full sitemap URL count expects static + archived (Rule 1)
- `tools/compare-builds.mjs` - `snapshot()` also walks `dist/archive` (`archive/` prefix);
  `isArticleFile()` counts archived article files
- `tests/regression/byte-identity.test.mjs` - header comment: now covers both tiers

## Decisions Made

- `staticFileCount` is computed as `preWriteCount + 1` (counting itself) and written, then the
  directory is recounted after the write to confirm it now holds exactly that many files — proven
  against a live build (`find dist/client -type f | wc -l` == the published number, no off-by-one).
- `applyPartition`/`planPartition` reuse 05-01's `classifyArticles`/`classifyTags` directly
  rather than re-implementing the D-08/cutoff rules — the partition's classification is
  guaranteed to agree with whatever `tools/tier-report.mjs` already reports for the same build.
- `tools/compare-builds.mjs`'s archive snapshot uses an `archive/` key prefix (not a separate
  file) so one snapshot covers both trees and `diff()`'s existing added/removed/changed logic
  works unmodified.

## Deviations from Plan

### TDD Gate Compliance

Task 2 is marked `tdd="true"` with the standard RED-then-GREEN instruction. **That discipline was
not followed as a genuinely separately-sequenced cycle**, matching 05-02/05-04/05-05's own
disclosed precedent: Task 1's tracer already required a complete, build-proved implementation of
both tools before Task 2 could even be scoped (the tracer's own acceptance criteria demand a real
build pass). Task 2's 23 tests were written against that already-complete implementation and
passed on first run with zero implementation changes. No `test(...)`-only commit precedes a
`feat(...)`/`fix(...)` commit for these two tools' core logic in this plan's git history — the
one addition Task 2 did make to the implementation (the `afterWriteForTest` test seam) was
already present in Task 1's own commit, written anticipating the test Task 2 would need.

### Auto-fixed Issues

**1. [Rule 1 - Bug] `tests/unit/news-sitemap.test.mjs` broke immediately after partitioning,
outside this plan's listed files**
- **Found during:** Task 3, the full `pnpm run test:fast` pass after Tasks 1-2's commits
- **Issue:** the full-sitemap-URL-count test asserted `sitemap URL count == dist/client HTML
  file count - 1 (404.html)` — true before partitioning (sitemap and dist/client always agreed
  on what existed), false after: Astro's sitemap plugin runs during `astro build`, BEFORE
  `tools/partition-archive.mjs` moves archive-tier pages out of `dist/client`, so the sitemap
  still lists every archived URL that `dist/client` no longer physically contains.
- **Fix:** expected count is now `staticHtmlCount + archivedPageCount` (reading
  `dist/archive-plan.json`), matching every other dist-output test's "static or archived" rule.
- **Files modified:** `tests/unit/news-sitemap.test.mjs`
- **Verification:** `node --test tests/unit/news-sitemap.test.mjs` passes; full
  `pnpm run test:unit` (608/608) passes.
- **Committed in:** `a42b271` (Task 3 commit).

---

**Total deviations:** 1 auto-fixed (Rule 1, caught by the full regression pass, not in this
plan's original `<files>` list) + 1 disclosed TDD-process deviation (documented above).
**Impact on plan:** No scope creep — the fix is a direct, correct consequence of partitioning
working as designed; the TDD deviation matches this phase's own established precedent.

## Issues Encountered

- The plan's acceptance criterion "the static file count is lower than the 60,387 baseline by at
  least the number of archived pages" does not hold literally against this build's real numbers:
  60,387 (the 05-01-era baseline, measured 2026-09-30 before any archive tiering existed) minus
  29,937 (this build) = 30,450, while the archived-page count is 30,478 — a 28-page shortfall.
  This is **not a partition bug**: the corpus genuinely grew between the baseline measurement and
  this build (today's build counts 40,487 total articles and 19,891 total tags, versus the
  baseline's implied ~40,050/~19,882 — ~2.5 hours and several ingest cycles apart). Recomputing
  the "no-partition" total from this build's own tier facts (27,575 hot articles + 2,325 hot
  tags + 36 other static files = 29,936, plus 12,912 + 17,566 archived = 60,414) shows the
  arithmetic is internally exact; the discrepancy is entirely attributable to the stale baseline
  figure, not to this plan's code. Recorded here rather than silently rounded to agree.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `dist/archive-plan.json` is the stable contract 05-07 (R2 upload: pre-deploy upload with
  move-back, post-deploy re-upload/orphans/backlog) reads next — its `entries[]` shape (kind,
  key, path, sha256, bytes) and top-level `counts`/`hotWindow`/`cutoffEpoch` fields are exactly
  what this plan's objective specified, unchanged by implementation.
- `tools/assert-file-count.mjs`'s 70,000 warn threshold is wired into this build's console
  output (`WARN:` line) but not yet into an alert/daily-report delivery mechanism — that is
  05-08's explicit job ("Wire archive sync and the count gate into the Workers Builds wrapper;
  alerts, 70,000 alarm, daily file-count report").
- **REND-07 and REND-11 are deliberately left Pending in REQUIREMENTS.md** despite being listed
  in this plan's frontmatter `requirements` field, matching this phase's own established
  precedent (05-02/05-04/05-05 leaving ARCH-01/REND-07/REND-10 Pending when only partially
  satisfied). REND-07 ("rendered once to R2 and served from there") is only half done — this
  plan proves the render-once half (archived pages are this build's own output, relocated); the
  R2 upload and serving half is 05-07's job (the Worker-serving branch itself already exists
  from 05-03, but nothing has uploaded a real archived page to R2 yet). REND-11 ("reported
  daily... and alarms") has its per-build measurement and build-time gate now, but "daily"
  delivery is explicitly 05-08's job per ROADMAP.md's own Wave 4 description. REND-09 was
  already marked Complete by 05-01 and needed no change here.
- `pnpm run test:unit` (608/608), `pnpm run test:build-gate` (9/9), `pnpm run test:regression`
  (byte-identity across both tiers, ~112s), `pnpm run test:tracer` (4/4 + 1 unrelated pre-existing
  skip), and `pnpm run guard:config` all pass clean after this plan's changes. No blockers.

---
*Phase: 05-hybrid-archive-zero-reads-proof*
*Completed: 2026-10-01*

## Self-Check: PASSED

All 13 key files confirmed present on disk; all 3 cited task commit hashes (`81b727b`,
`bdfc1ff`, `a42b271`) confirmed present in `git log --oneline --all`.
