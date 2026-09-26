# 2026-09-26 - Close T-03-02a: widen the D1-import guard from one filename to the whole server directory

**Keywords:** [SECURITY] [CRITICAL] [TESTING] [BACKEND] [DOCUMENTATION]
**Session:** Afternoon, Duration (~1.5 hours)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-26-1250_close-t-03-02a-kv-manifest-directory-guard.md`

## What Changed

- File: `tools/assert-no-d1.mjs`
  - `FORBIDDEN_TARGET_SUFFIX` (a single filename, `src/lib/server/d1-client.ts`) replaced with `FORBIDDEN_TARGET_DIR` (`src/lib/server/`) — `isForbidden()` now checks directory containment, not an exact-file suffix match
  - Error message now names the actual forbidden module reached (via the discovery chain) instead of a hardcoded filename, so it reports correctly for any module under the directory
  - Header comment documents the T-03-02a finding and records a known limitation the same audit flagged (the page-exemption check fails open on any `prerender = false` spelling other than the literal string) for Phase 4 to revisit
- File: `src/lib/kv-manifest.ts` -> `src/lib/server/kv-manifest.ts` (moved)
  - No internal changes; the file had no relative imports, so the move required no import-path fixes inside it
- File: `src/pages/[category]/[slug].astro`
  - Import path updated to `../../lib/server/kv-manifest`
- File: `tools/verify-edge-headers.mjs`
  - Import path and prose comments updated to the new `src/lib/server/kv-manifest.ts` location
- File: `tests/tracer/tracer.test.mjs`, `tests/unit/manifest-schema.test.mjs`
  - Import paths updated to the new location
- File: `tests/ci-fixtures/assert-no-d1.test.mjs`
  - Added Cases 5 and 6: a page-shaped and an island-shaped synthetic fixture that reach `src/lib/server/kv-manifest.ts` transitively, both asserted REJECTED
- File: `tests/ci-fixtures/helper-reaching-kv.ts`, `page-with-kv-import.astro`, `island-with-kv-import.vue`, `island-wrapper-kv.astro` (new)
  - New fixtures mirroring the existing D1 fixtures, reaching the KV module instead
- File: `docs/phase-03/render-manifest.md`
  - Path references corrected to `src/lib/server/kv-manifest.ts`; new "Guard enforcement (T-03-02a correction)" section explains the original gap and the fix
- File: `.planning/phases/03-foundation-read-budget-guardrails/03-01-SUMMARY.md`
  - Appended a correction note (did not rewrite the original summary) clarifying that the "single D1 chokepoint" claim covered D1 access specifically, not every credential-reading module this plan created

## Why

An external security audit (owner-authorized remediation of threat T-03-02a) ran the real
`assertNoD1Plugin` against synthetic on-demand page/island fixtures importing
`src/lib/kv-manifest.ts` and found them accepted, while the guard's own control case (an
entrypoint importing `d1-client.ts`) was correctly rejected — proving the gap was the forbidden
set's scope (one filename), not a broken module-graph walk. `kv-manifest.ts` reads
`CLOUDFLARE_API_TOKEN` directly at four call sites and sat outside the one directory the guard
protected. No production exposure existed at audit time (no real on-demand route or island
exists yet in Phase 3), but it would have opened silently the moment Phase 4 introduces one.
Fixing the forbidden set to be a directory rather than a filename means any future
credential-holding module placed under `src/lib/server/` inherits the same structural protection
without a guard edit — the same shape of fix this project's Phase 2 CONT-06 precedent argues for
(a check that exists must actually keep gating as the codebase grows around it).

## Issues Encountered

The unit-test fixture suite is a synthetic module-graph simulation, not a real `astro build` — so
proving the fix against the REAL build (not just the simulation) required a temporary on-demand
page. The first attempt used a filename starting with `__` (`__temp-t03-02a-proof.astro`) and the
build silently succeeded with zero entrypoints matched — Astro's own routing convention excludes
any file/directory under `src/pages/` whose name starts with an underscore from routing entirely,
so the file was never compiled or walked. Renamed to a non-underscore-prefixed name
(`zz-temp-t03-02a-proof.astro`) and the real build then failed exactly as expected, with a clear
message naming `src/lib/server/kv-manifest.ts` as the forbidden module reached. Temp file removed
immediately after capturing the failing build output; `pnpm build` confirmed clean afterward.

Separately, `pnpm test:tracer` (not part of this task's required green suite) failed on an
unrelated, pre-existing issue: the live "latest article" at test time has an apostrophe in its
title, and `astro`'s `<title>` escaping renders it as `&#39;`, while the test does a literal
`html.includes(row.title)` substring match against the un-escaped D1 value. Confirmed unrelated
to this change (the KV/D1 module relocation and guard widening play no part in that comparison)
and left unfixed — out of this task's scope, logged here for whoever next investigates
`test:tracer` flakiness at the escaping boundary.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `pnpm test:unit` (92/92 pass, up from 87 — new `astro-config.test.mjs` cases
  belong to the companion T-03-02a task 2 commit), `pnpm test:build-gate` (6/6 pass, up from 4 —
  Cases 5-6 added here), `pnpm verify:edge` (4/4 pass, unaffected)
- Inversion proof: temporarily reverted `isForbidden`/`FORBIDDEN_TARGET_DIR` to the original
  single-file form and re-ran `test:build-gate` — Cases 5 and 6 FAILED (2 failing, 4 passing),
  proving the new fixtures actually exercise the fixed gap rather than passing unconditionally.
  Restored the fix and confirmed all 6 pass again.
- Real-build proof: `pnpm build` against a temporary on-demand page importing
  `src/lib/server/kv-manifest.ts` directly failed with exit code 1 and the expected violation
  message; removed the temp file and confirmed a clean `pnpm build` (exit 0) afterward.
- What wasn't tested: `pnpm test:tracer` was run but is not part of this task's gate (see Issues
  Encountered) — its one failure is pre-existing and unrelated.

## Next Steps

- [ ] Phase 4: re-examine the page-exemption's fail-open literal-string check
      (`export const prerender = false`) before relying on it for real on-demand routes
- [ ] Investigate the `tests/tracer/tracer.test.mjs` title-escaping mismatch
      (`html.includes(row.title)` vs `&#39;`-escaped `<title>` output) independent of this task

---

**Branch:** feature/phase-03
**Issue:** T-03-02a (security remediation, owner-authorized)
**Impact:** HIGH - closes a structural security gap in the D1/KV credential-access guard before Phase 4 introduces the on-demand routes that would have exposed it
