# 2026-09-23 - `pnpm verify:edge` Hardened: Discover the Live Article, Not the Local Build

**Keywords:** [TESTING] [BACKEND] [BUG_FIX] [DOCUMENTATION]
**Session:** Evening, Duration (~1.5 hours, part of a larger Phase 3 UAT follow-up session)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-23-1840_harden-verify-edge-live-article-discovery.md`

## What Changed

- File: `tools/verify-edge-headers.mjs`
  - Removed the `findArticlePath()` filesystem walk over local `dist/client/` that check 4 used
    to discover an article URL — that build output drifts from what is actually deployed, since
    `[slug].astro` always renders the newest D1 article and D1 ingests ~15 new articles every 2
    hours
  - Added `discoverLiveArticlePath()`: lists the render-manifest KV article ids (newest
    `renderedAt` first), resolves each candidate to a full D1 row via `fetchArticleById()`,
    reconstructs the URL `[slug].astro` would build, and issues a real live GET against the dev
    host — the first candidate that responds 200 is the answer. A live 200 is verified fact, not
    an inference from stored metadata
  - An earlier version of this fix matched manifest entries by `buildHash` against the deployed
    commit reported by `/version.json`. Measured against the real 62-entry manifest and found
    unreliable: manifest keys are one per article, and repeated local builds without a deploy
    after each one can overwrite an earlier build's `buildHash` at the same key when both builds
    happen to pick the same "latest" article. The live-probe approach doesn't depend on that
    history surviving
  - Added `--max-candidates` (default 50, exported as `DEFAULT_MAX_DISCOVERY_CANDIDATES`) to
    bound how many manifest entries get live-probed before giving up
  - `--article-path` still available as an explicit override, unchanged
- File: `src/lib/kv-manifest.ts`
  - Added `listManifestArticleIds()`: paginates the KV List Keys REST endpoint (`prefix:
    manifest:`, cursor-following) to enumerate every written article id. Documented as a
    dev-tooling function only — fine at Phase 3's ~62-entry scale, explicitly flagged as not a
    Phase 4 full-corpus pattern (list + read-every-value doesn't scale to ~41,000 entries; a
    future caller at that scale should use KV list `metadata`, not currently written by the
    manifest's write paths)

## Why

03-UAT.md item 2 flagged `pnpm verify:edge` as failing 1 of 4 checks with a false negative: check
4 requested an article path that existed in a fresh local build but 404'd on the live deployment,
because the "latest article" query returns a different row every time D1 ingests something new.
The underlying OPS-02 requirement (edge noindex header) was independently confirmed live via
direct `curl` throughout — this was a tooling bug, not a requirement violation. Left unfixed, a
check that cries wolf gets ignored on principle, which is the same failure mode as Phase 2's
CONT-06 defect (248 passing tests next to 253 violating production rows) by a different road: the
day the noindex rule is genuinely removed, nobody notices because nobody trusts the check anymore.

## Issues Encountered

The first fix attempt (matching KV manifest `buildHash` against the live `/version.json` commit)
looked correct on paper but failed empirically: none of the 62 real manifest entries carried the
currently-deployed commit's `buildHash`, because later local test builds overwrote it at the same
KV key. Caught by actually running the fix against production data before considering it done,
not by code review — switched to a live-probe strategy that verifies against the deployment
directly instead of trusting manifest history.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `pnpm verify:edge` run against the real live deployment — all 4 checks now
  pass with real captured output, discovering `/education/canutillo-isd-approves-reduced-tax-rate-for-upcoming-school-year-c80a97f8-6981-4a23-9c3e-5416d8fe2754/`
  as the actual live article with no redeploy required. Inversion proof: `node
  tools/verify-edge-headers.mjs --dev-host=915tldr.com --admin-host=915tldr.com` against production
  (which legitimately lacks the noindex rule) correctly FAILS checks 1, 2 and 4 with exit code 1,
  while check 3 (production negative control) still correctly passes. `pnpm test:unit` (87/87) and
  `pnpm test:build-gate` (4/4) both green, confirming the manifest addition didn't regress
  anything
- What wasn't tested: `listManifestArticleIds()` has no dedicated unit test (no test file exists
  for `tools/verify-edge-headers.mjs` or exercises this new function in isolation) — covered only
  by the live end-to-end run above
- Edge cases: an empty manifest, a manifest where the deployed article isn't among the most
  recent 50 entries, and a KV/D1 network failure mid-discovery are all handled (return a `{
  error }` object with a specific reason, never throw) but not exercised by an automated test

## Next Steps

- [ ] Consider a unit test for `discoverLiveArticlePath()`/`listManifestArticleIds()` using a
      stubbed `fetchImpl`, matching the pattern `tests/unit/manifest-schema.test.mjs` already uses
- [ ] Phase 4 should revisit `listManifestArticleIds()`'s scaling note before the manifest grows
      toward full-corpus size

---

**Branch:** feature/phase-03
**Issue:** N/A
**Impact:** MEDIUM - Standing deploy-verification tool fixed from a false-negative state; no
production/application code path changed, but this is the guard that catches a real noindex
regression
