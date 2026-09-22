---
phase: 03-foundation-read-budget-guardrails
plan: 04
subsystem: infra
tags: [cloudflare-kv, kv-bulk-write, astro, typescript, node-test, hreflang, i18n]

requires:
  - phase: 03-foundation-read-budget-guardrails
    provides: "src/lib/kv-manifest.ts tracer implementation and 915tldr-render-manifest KV namespace (03-01); BUILD_HASH single source of truth (03-03)"
provides:
  - "Validated, versioned, bulk-capable render-manifest writer (src/lib/kv-manifest.ts) — translationGroupId + language replace the placeholder spanishCounterpartId field"
  - "MANIFEST_SCHEMA_VERSION exported constant, recorded on every entry automatically"
  - "putManifestEntriesBulk() batching against the KV bulk-write REST endpoint (10,000-pair ceiling)"
  - "validateManifestEntry() rejecting malformed entries before any network call"
  - "docs/phase-03/render-manifest.md — the documented schema phase success criterion 3 requires"
affects: [04, 05, 06]

actuals:
  tokens: 11390
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Translation-group identity (translationGroupId + language) instead of a derived or nullable counterpart pointer — pairing is 'same group id', reusing the same shape as the existing duplicate_groups/duplicate_group_members pattern already live in production D1"
    - "Validate-before-write on every KV write path (single and bulk), throwing with the offending field name, so an untrustworthy manifest entry can never reach storage"
    - "fetchImpl dependency injection on putManifestEntry/putManifestEntriesBulk/getManifestEntry — production call sites never pass it, tests stub the whole HTTP layer without touching the real KV namespace"
    - "Order-independent, null-safe content hashing: tags sorted before hashing, SQL NULL and '' normalized identically, so hash stability doesn't depend on GROUP_CONCAT's null-vs-empty-string quirk"

key-files:
  created:
    - tests/unit/manifest-schema.test.mjs
    - docs/phase-03/render-manifest.md
  modified:
    - src/lib/kv-manifest.ts
    - "src/pages/[category]/[slug].astro"
    - tests/tracer/tracer.test.mjs

key-decisions:
  - "Task 1 checkpoint resolved by the human as Option C (translation-group id + language field) before this continuation began — see docs/phase-03/render-manifest.md § Translation identity for the full recorded reasoning."
  - "renderVersion (ManifestEntry field) renamed to schemaVersion, matching the exported MANIFEST_SCHEMA_VERSION constant name — flagged per 03-04-PLAN.md's instruction to note any rename away from 03-RESEARCH.md's reference field names."
  - "buildManifestEntry no longer accepts a renderVersion/schemaVersion parameter at all — every entry gets MANIFEST_SCHEMA_VERSION automatically, removing the possibility of a call site drifting from the exported constant (which is exactly what happened with the 03-01 tracer's hand-written renderVersion: '0')."
  - "BUILD_HASH imported from src/lib/build-info.ts (03-03 landed before this plan ran) rather than [slug].astro resolving its own commit hash from process.env — the plan's 'if 03-03 has landed it' branch applied."
  - "KV_BULK_WRITE_MAX_PAIRS (10,000) sourced from 03-RESEARCH.md's already-directly-fetched citation of developers.cloudflare.com/kv/api/write-key-value-pairs/, not re-fetched live this session — the cloudflare-docs MCP tool named in this plan's <mcp_tools> block was not present in this execution's available tool surface. Documented explicitly in docs/phase-03/render-manifest.md rather than silently assumed or carried over from D1's unrelated 100-bound-parameter limit."
  - "The one live manifest entry (manifest:201187fa-6484-4516-99d5-7e41da203323) was migrated to the new shape via the ordinary pnpm build/pnpm test:tracer run, not a separate migration script — Task 2's own acceptance criteria required a real build+tracer pass, which necessarily rewrites the tracer's single manifest entry through the new buildManifestEntry() path. Verified directly by reading the entry back from the real KV namespace after the build."

patterns-established:
  - "Translation-group identity pattern: pair two records by a shared group id rather than a direct pointer field, when the target's own row shape is not yet decided. Reuse this shape if any future cross-record grouping need arises before its own data model is settled."
  - "fetchImpl injection point on every KV-facing exported function, defaulting to global fetch, so future writers/readers in this module stay testable without a live network dependency."

requirements-completed: [REND-06]

coverage:
  - id: D1
    description: "translationGroupId + language replace spanishCounterpartId in ManifestEntry; translationGroupId is never null and equals the article's own uuid for every English-only entry, per the human-decided Option C"
    requirement: "REND-06"
    verification:
      - kind: unit
        ref: "tests/unit/manifest-schema.test.mjs#buildManifestEntry returns all required fields, non-empty, with translationGroupId equal to articleId and language \"en\""
        status: pass
      - kind: e2e
        ref: "tests/tracer/tracer.test.mjs#tracer: one real article renders and is recorded > the KV manifest entry agrees with the D1 row"
        status: pass
    human_judgment: false
  - id: D2
    description: "validateManifestEntry rejects a missing field, a malformed contentHash, a non-numeric publishedAt, and a bad language value, before any network call, on both the single and bulk write paths"
    requirement: "REND-06"
    verification:
      - kind: unit
        ref: "tests/unit/manifest-schema.test.mjs#putManifestEntry rejects an entry missing a required field, before any network call"
        status: pass
      - kind: unit
        ref: "tests/unit/manifest-schema.test.mjs#putManifestEntry rejects an entry whose contentHash is not 64 hex characters"
        status: pass
      - kind: unit
        ref: "tests/unit/manifest-schema.test.mjs#putManifestEntry rejects an entry whose publishedAt is not a number"
        status: pass
      - kind: unit
        ref: "tests/unit/manifest-schema.test.mjs#putManifestEntriesBulk validates every entry before issuing any request"
        status: pass
    human_judgment: false
  - id: D3
    description: "MANIFEST_SCHEMA_VERSION is an exported constant recorded automatically on every built entry"
    requirement: "REND-06"
    verification:
      - kind: unit
        ref: "tests/unit/manifest-schema.test.mjs#MANIFEST_SCHEMA_VERSION is exported and every built entry records it"
        status: pass
    human_judgment: false
  - id: D4
    description: "putManifestEntriesBulk batches at the KV bulk-write endpoint's 10,000-pair ceiling — 25,000 entries produce exactly 3 requests, not 25,000"
    requirement: "REND-06"
    verification:
      - kind: unit
        ref: "tests/unit/manifest-schema.test.mjs#putManifestEntriesBulk splits 25,000 entries into exactly 3 requests"
        status: pass
    human_judgment: false
  - id: D5
    description: "The one existing live manifest entry was migrated to the new shape (no vestigial spanishCounterpartId, translationGroupId/language present) via the normal pnpm build/pnpm test:tracer run against the real production D1 row and the real KV namespace"
    requirement: "REND-06"
    verification:
      - kind: e2e
        ref: "tests/tracer/tracer.test.mjs#tracer: one real article renders and is recorded > the KV manifest entry agrees with the D1 row"
        status: pass
      - kind: other
        ref: "getManifestEntry('201187fa-6484-4516-99d5-7e41da203323') read directly against the real KV namespace after pnpm build, confirming translationGroupId/language present and spanishCounterpartId absent"
        status: pass
    human_judgment: false
  - id: D6
    description: "docs/phase-03/render-manifest.md documents the schema field-by-field, the translation-identity pairing rule with the Option A/B/C reasoning, versioning, validation, bulk-write contract, and what the manifest does not guarantee — satisfying phase success criterion 3's requirement for a documented (not only correct) schema"
    requirement: "REND-06"
    verification:
      - kind: other
        ref: "docs/phase-03/render-manifest.md verification script from 03-04-PLAN.md Task 3 (string-presence + field-count check against ManifestEntry) — exits 0, all 9 fields match in order"
        status: pass
    human_judgment: false
  - id: D7
    description: "10,000-pair KV bulk-write ceiling verified against the real Cloudflare documentation"
    verification: []
    human_judgment: true
    rationale: "The cloudflare-docs MCP tool named in this plan's <mcp_tools> block was not present in this execution's available tool surface, so the constant carries forward 03-RESEARCH.md's already-directly-fetched citation (developers.cloudflare.com/kv/api/write-key-value-pairs/) rather than a fresh live lookup this session. Flagging this honestly rather than claiming a live re-verification that did not happen — a human (or a future session with the MCP tool available) should confirm the figure is still current before this is exercised at real corpus scale."

duration: ~35min (this continuation; Task 1's decision was resolved by the human before this continuation began)
completed: 2026-09-22
status: complete
---

# Phase 3 Plan 4: Translation-Identity Manifest Writer Summary

**translationGroupId + language replace a null-forever spanishCounterpartId in the render manifest, backed by pre-write validation, an exported schema-version constant, KV bulk-write batching, and a documented contract — resolving the human-decided Option C checkpoint from Task 1.**

## Performance

- **Duration:** ~35 min (this continuation; picks up after a prior run resolved the Task 1 decision checkpoint and made no file changes)
- **Completed:** 2026-09-22T20:20:00Z (approx.)
- **Tasks:** 2 (Task 1's decision was already resolved when this continuation started; Task 2 and Task 3 executed here)
- **Files modified:** 5 (3 modified, 2 created)

## Accomplishments
- Replaced `spanishCounterpartId: string | null` with `translationGroupId: string` + `language: 'en' | 'es'` in `ManifestEntry` — implements the human's Option C decision: a translation-group identity computable today (equal to the article's own uuid), never null, never wrong about a record that doesn't exist yet
- Added `validateManifestEntry()`, called from both `putManifestEntry` and `putManifestEntriesBulk` before any network call, rejecting missing/empty required fields, a malformed 64-hex `contentHash`, a non-numeric `publishedAt`, or a `language` outside `'en'`/`'es'`
- Exported `MANIFEST_SCHEMA_VERSION` and made every built entry record it automatically via `schemaVersion` — no call site passes a version literal anymore, closing the exact drift that produced the 03-01 tracer's hand-written `renderVersion: '0'`
- Added `putManifestEntriesBulk()` batching at `KV_BULK_WRITE_MAX_PAIRS` (10,000 pairs) against the KV bulk-write REST endpoint; proved via a stubbed transport that 25,000 entries produce exactly 3 requests (10,000/10,000/5,000), and that a single invalid entry anywhere in a call blocks the whole call from issuing any request
- Made `computeContentHash()` order-independent over `tags` and null-safe (SQL `GROUP_CONCAT`'s `null`-for-zero-tags case normalizes identically to `''`), and confirmed it is scoped to exactly `title`/`summary`/`tags` (a `status` change does not move the hash)
- Migrated the one live production manifest entry (`manifest:201187fa-6484-4516-99d5-7e41da203323`) to the new shape by running the ordinary `pnpm build`/`pnpm test:tracer` path against the real D1 row and the real KV namespace, then read it back directly to confirm `translationGroupId`/`language` present and no vestigial `spanishCounterpartId`
- Wrote `docs/phase-03/render-manifest.md` — the field-by-field contract, the translation-identity pairing rule with the full Option A/B/C reasoning carried over from the checkpoint, versioning semantics, the validation and bulk-write contracts, and an explicit "what this does not guarantee" section covering the manifest-write/asset-deploy divergence (T-03-12)
- 23 new `node:test` cases in `tests/unit/manifest-schema.test.mjs`, all stubbing the HTTP layer via dependency-injected `fetchImpl` — no test touches the real KV namespace

## Task Commits

Each task was committed atomically via `/jja-commit`:

1. **Task 2: Validated, versioned, bulk-capable manifest writer** - `4d74647` (feat)
2. **Task 3: The documented schema criterion 3 requires** - `9677fd0` (docs)

**Plan metadata:** pending (this SUMMARY's own commit)

_Note: Task 1 (the decision checkpoint) was resolved by the human in the prior session with no code commit — see `<resume_state>` in this continuation's own instructions for the full recorded reasoning, reproduced in `docs/phase-03/render-manifest.md`._

## Files Created/Modified
- `src/lib/kv-manifest.ts` - Full rewrite of the field set, validation, versioning, and bulk-write capability (see Accomplishments); `SourceArticleRow.tags` retyped `string | null` to match the real GROUP_CONCAT runtime behavior
- `src/pages/[category]/[slug].astro` - Call site updated: imports `BUILD_HASH` from `src/lib/build-info.ts` instead of resolving its own commit hash; no longer passes a `renderVersion` literal
- `tests/tracer/tracer.test.mjs` - Field assertions updated to the new schema (`translationGroupId`, `language`, `schemaVersion`), with value assertions added (not just key-presence) for `translationGroupId === row.id` and `language === 'en'`
- `tests/unit/manifest-schema.test.mjs` - New, 23 cases: schema completeness, translation-identity value assertions, hash stability/order-independence/null-safety, writer rejection (4 distinct invalid-input cases, each asserted to make zero network calls), bulk batching and all-or-nothing validation, no-TTL assertions, and `getManifestEntry`'s three-way absent/present/malformed distinction
- `docs/phase-03/render-manifest.md` - New, the documented manifest contract for Phase 4/5/6

## Decisions Made
See `key-decisions` in the frontmatter above for the full list. The most consequential: Task 1's Option C (translation-group id + language field) was already decided by the human before this continuation began; everything in Task 2/3 implements that decision rather than revisiting it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `tests/tracer/tracer.test.mjs` was not in this plan's `files_modified` but had to change**
- **Found during:** Task 2, verifying `pnpm test:tracer` still passes after the schema change
- **Issue:** The tracer test asserted an exact key list (`spanishCounterpartId`, `renderVersion`, ...) against the live KV entry — those keys no longer exist once `ManifestEntry`'s shape changed, so the tracer would fail the moment the writer changed, even though the plan's own frontmatter didn't list this file.
- **Fix:** Updated the key list to `translationGroupId`/`language`/`schemaVersion`, and added value assertions for `translationGroupId === row.id` and `language === 'en'` (not just key presence — the plan's own prohibition is specifically against a test that would pass a null/pointer-shaped field just by checking the key exists).
- **Files modified:** `tests/tracer/tracer.test.mjs`
- **Verification:** `pnpm test:tracer` passes end-to-end against the real D1 row and real KV namespace.
- **Committed in:** `4d74647` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — a necessary test update directly caused by this task's own schema change, explicitly anticipated by the plan's own Task 2 action text: "Verify the tracer still passes afterwards").
**Impact on plan:** No scope creep — the change was required for `pnpm test:tracer` to pass at all, which is both this task's own acceptance criterion and Task 2's stated verification command.

## Issues Encountered
None beyond the deviation documented above. The KV bulk-write endpoint's documented ceiling (10,000 pairs) could not be independently re-verified against live Cloudflare documentation this session — the cloudflare-docs MCP tool named in the plan's `<mcp_tools>` block was not present in this execution's tool surface. Rather than silently assuming or re-fetching via an unavailable channel, the module and the documentation both carry forward 03-RESEARCH.md's own already-directly-fetched citation of the same endpoint, and this limitation is stated explicitly in both `docs/phase-03/render-manifest.md` and this Summary's `coverage` block (D7, flagged `human_judgment: true`) rather than presented as independently confirmed.

## User Setup Required
None. No new environment variables, credentials, or external service configuration were introduced — this plan reuses the `CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_API_TOKEN`/`RENDER_MANIFEST_KV_NAMESPACE_ID` already established in 03-01.

## Next Phase Readiness
- Phase 4 (incremental static generation) can build its re-render decision directly against `contentHash`/`schemaVersion` as documented in `docs/phase-03/render-manifest.md` — no known blockers.
- Phase 5 (hybrid archive/tiering) can read `category`/`publishedAt` off the manifest without a second D1 read, as designed.
- Phase 6 (bilingual) has a written pairing rule (`translationGroupId`) to implement against, plus the full Option A/B/C reasoning so the "why not a derived id" question doesn't need re-litigating.
- Coverage item **D7** (the KV bulk-write 10,000-pair ceiling) should be independently re-confirmed against live Cloudflare documentation — via the cloudflare-docs MCP tool once available, or a direct fetch — before `putManifestEntriesBulk` is ever run against the real ~41,233-article corpus at scale. This plan explicitly did not run it at corpus scale, per its own budget constraint.
- No other blockers remain from this plan.

---
*Phase: 03-foundation-read-budget-guardrails*
*Completed: 2026-09-22*

## Self-Check: PASSED

All 6 created/modified files verified present on disk (`src/lib/kv-manifest.ts`,
`src/pages/[category]/[slug].astro`, `tests/tracer/tracer.test.mjs`,
`tests/unit/manifest-schema.test.mjs`, `docs/phase-03/render-manifest.md`, this SUMMARY).
Both task commit hashes (`4d74647`, `9677fd0`) verified present in `git log --oneline --all`.
No missing items.
