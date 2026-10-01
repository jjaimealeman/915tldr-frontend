# 2026-09-30 - Manifest schema-stale flag only clears after a cold pass (04-REVIEW WR-02)

**Keywords:** [BACKEND] [BUG_FIX] [TESTING]
**Session:** Evening, Duration (~25 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-30-1816_manifest-schema-stale-flag-wr-02.md`

## What Changed

- File: `src/content/loaders/articles-loader.ts`
  - `meta.set('manifestSchemaVersion', MANIFEST_SCHEMA_VERSION)` now only runs when
    `manifestSchemaStale && mode === 'cold'`, instead of on any stale build regardless of mode.
    The manifest rewrite itself (`articlesForManifest = manifestSchemaStale ? allParsed :
    changedArticles`) is unchanged — a warm build during the stale window still rewrites every
    article it fetches, it just no longer clears the flag early.
- File: `tests/unit/articles-loader.test.mjs`
  - Renamed/retargeted the existing "manifestSchemaVersion mismatch" test to prove a WARM build
    leaves the flag stale (`'1'`) after writing only its own fetched window.
  - Added a new test (using `ARTICLES_FORCE_COLD=1`) proving a COLD build is the one pass that
    both writes the full corpus and clears the flag to `'2'`.

## Why

`04-REVIEW.md` (WR-02): `allParsed` is the full public corpus only when `mode === 'cold'` — in
warm/warm+sweep mode it's just the sync window (plus whatever the daily sweep pulled in). The prior
code cleared `manifestSchemaVersion` on ANY stale build, meaning a future schema bump would look
fully migrated after the very first warm build following the bump, even though only the ~3-day
window's worth of articles actually got rewritten manifest entries. Every older, un-touched article
would keep its previous-schema KV entry until the next cold pass (self-heals within
`COLD_RESYNC_INTERVAL_SECONDS` = 7 days) — and `resolveRedirect` 404s instead of 301-ing an old URL
for any of those articles during that window, violating the project's own nine-months-indexed-URLs
compatibility constraint (`.claude/CLAUDE.md`). This was dormant today (the corpus was already
fully migrated to schema v2 via a cold pass earlier in Phase 4) but a real latent gap for the next
schema bump. Implemented the review's "cheaper" fix option (gate the flag-clear on `mode ===
'cold'`) rather than forcing cold mode on every stale build, since the former requires no change to
fetch behavior or rows-read budgets.

## Issues Encountered

No major issues encountered.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: both the warm-stays-stale and cold-clears-flag paths, directly, via
  `pnpm run test:unit` (390/390 passing) and `pnpm run test:build-gate` (8/8), with all
  04-followups changes applied together. Confirmed the two other existing tests that set
  `manifestSchemaVersion` to the already-current value (`articles-loader.test.mjs` line ~322,
  `articles-loader-window.test.mjs`) are unaffected, since `manifestSchemaStale` is false in both.
- What wasn't tested: an actual 7-day-apart warm-then-cold production cycle (not practical in a
  unit test) — the loader's own mode-selection logic (`mode is cold when meta.lastCold is older
  than COLD_RESYNC_INTERVAL_SECONDS`) is already covered by existing tests.
- Edge cases: confirmed the manifest rewrite itself (which articles get written on a stale build)
  is unchanged by this fix — only the meta flag's clear timing changed.

## Next Steps

- [ ] None — this follow-up task is complete.

---

**Branch:** feature/fix/phase-04-followups
**Issue:** N/A
**Impact:** LOW - dormant-today latent-gap fix; closes a future schema-bump migration-window risk
without changing any current build's observable behavior.
