# 2026-09-22 - Translation identity, validation, versioning and bulk writes for the render manifest

**Keywords:** [BACKEND] [TESTING] [SECURITY] [CONFIG]
**Session:** Afternoon, Duration (~1 hour, continuation)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-22-1415_03-04-translation-identity-validated-bulk-manifest-writer.md`

## What Changed

- File: `src/lib/kv-manifest.ts`
  - Removed `spanishCounterpartId: string | null` entirely — replaced with `translationGroupId: string` (equal to the article's own `articleId` for every entry written today) and `language: 'en' | 'es'` (Option C, human-decided at this plan's Task 1 checkpoint: a translation-group identity, not a derived pointer or a nullable backfill field)
  - Added `validateManifestEntry()` — rejects a missing/empty required field, a malformed `language`, a `contentHash` that isn't 64 hex characters, or a non-numeric `publishedAt`, before any network call; called from both `putManifestEntry` and `putManifestEntriesBulk`
  - Added `MANIFEST_SCHEMA_VERSION` (exported constant) — every built entry records it automatically via `schemaVersion`, replacing the tracer's hand-written `renderVersion: '0'` literal
  - Added `putManifestEntriesBulk()` — batches at `KV_BULK_WRITE_MAX_PAIRS` (10,000 pairs) against the KV bulk-write REST endpoint; validates every entry before issuing any request; empty input issues zero requests
  - `computeContentHash()` (renamed from the inline hash in `buildManifestEntry`) now hashes a stable, order-independent serialisation of exactly `title`/`summary`/`tags` — tags are sorted and `null`/`''` normalize identically, so a hash no longer flips on tag order or on GROUP_CONCAT's null-vs-empty-string behavior
  - `putManifestEntry`, `putManifestEntriesBulk`, `getManifestEntry` all accept an optional `fetchImpl` for test injection (production call sites never pass it)
- File: `tests/unit/manifest-schema.test.mjs` (new)
  - 23 `node:test` cases covering schema completeness, translation-identity value (not just key presence), hash stability/order-independence, writer rejection (missing field, bad hash, bad publishedAt, bad language — each asserted to make zero network calls), bulk batching (25,000 entries → exactly 3 requests, sized 10000/10000/5000), bulk all-or-nothing validation, no-TTL assertions on both single and bulk write bodies, and `getManifestEntry`'s three-way absent/present/malformed distinction
- File: `tests/tracer/tracer.test.mjs`
  - Updated the manifest-entry key/value assertions to the new schema (`translationGroupId`, `language`, `schemaVersion` in place of `spanishCounterpartId`/`renderVersion`); added value assertions for `translationGroupId === row.id` and `language === 'en'`
- File: `src/pages/[category]/[slug].astro`
  - Call site updated: imports `BUILD_HASH` from `src/lib/build-info.ts` (03-03) instead of resolving its own commit hash from `process.env.WORKERS_CI_COMMIT_SHA`; no longer passes a `renderVersion` literal

## Why

Phase 3 success criterion 3 requires the render manifest to *already carry* a Spanish counterpart identity, populated by a rule that never forces a full-corpus re-render in Phase 6. The prior tracer (03-01) wrote a structurally-always-null `spanishCounterpartId` as a deliberate placeholder — correct not to invent a shape prematurely, but not yet satisfying the criterion's intent. This plan's Task 1 checkpoint asked a human to resolve the genuine open question underneath it (nothing in Phase 6's requirements yet says whether Spanish content will be new D1 rows or new columns), and the human chose Option C — a translation-group id plus a language field — because it is never null and never wrong about a record that does not exist, and it reuses a pattern (`duplicate_groups`) already live in this project's own D1 schema. Task 2 then hardened the writer around that decision: validation before every write (an untrustworthy manifest is worse than none, and Phase 4 acts on it), an exported schema-version constant (so a future template change can invalidate entries selectively instead of globally), and a real bulk-write path (so populating ~41k entries doesn't mean 41k individual HTTP round trips).

## Issues Encountered

None requiring a fix-attempt escalation. The one adjustment beyond the plan's own file list: `tests/tracer/tracer.test.mjs` needed its field assertions updated in the same commit, since it asserts against the live KV entry's exact key set and would otherwise fail the moment `kv-manifest.ts`'s schema changed — the plan's own Task 2 action explicitly calls for "verify the tracer still passes afterwards," so this was in scope.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `node --test tests/unit/manifest-schema.test.mjs` (23/23 pass, first run, no red/green TDD cycle needed since this is a hardening/refactor task rather than net-new untested behavior); `pnpm build && pnpm test:tracer` (real production D1 row + real KV namespace, end-to-end, confirms the one live `manifest:201187fa-...` entry was migrated to the new shape by the ordinary build path); `pnpm test:unit` (87/87, up from the 64/64 baseline); `pnpm test:build-gate` (4/4, unaffected)
- What wasn't tested: the KV bulk-write endpoint was exercised only against a stubbed transport (25,000 synthetic entries, request-count and batch-size assertions) — no real bulk write was issued against the live namespace, per this plan's explicit budget constraint against bulk-writing the real corpus
- Edge cases: tag order-independence, `null` vs `''` tags, an entry invalid partway through a 2-entry bulk batch (zero requests issued), a malformed stored JSON value distinguished from an absent key (404) and a present key

## Next Steps

- [ ] Phase 4's incremental build reads `contentHash`/`schemaVersion` to decide what to re-render — no code changes needed here, but it's the first real consumer of this contract
- [ ] Phase 6 writes the first `language: 'es'` entries and pairs them by `translationGroupId` — the exact rule is documented in `docs/phase-03/render-manifest.md`

---

**Branch:** feature/phase-03
**Issue:** N/A
**Impact:** MEDIUM - hardens an existing build-time-only module; no production request-path code touched, no schema change visible to end users
