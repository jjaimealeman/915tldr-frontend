# 2026-09-30 - Footer Build Stamp Made Opt-In, Homepage Only (04-11a, Fixes 04-10 Asset-Dedup Finding)

**Keywords:** [FRONTEND] [PERFORMANCE] [BUG_FIX] [TESTING]
**Session:** Afternoon, Duration (~30min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-30-1611_footer-build-stamp-opt-in-homepage-only.md`

## What Changed

- File: `src/layouts/Base.astro`
  - Added a new `buildStamp?: boolean` prop, default `false`, gating whether the footer's
    `<p data-build data-stamp={stamp}>build {BUILD_HASH} · {stampDate}</p>` line renders at all
  - The element is now wrapped `{buildStamp && (...)}` instead of rendering unconditionally on
    every page
- File: `src/pages/index.astro`
  - Homepage passes `buildStamp={true}` to `<Base>` — the only page that still shows the stamp
- File: `src/pages/[category]/[slug].astro`
  - Updated the top-of-file doc comment: the footer no longer renders on article pages at all;
    the existing `stamp="commit"` prop is kept (harmless, correct if `buildStamp` is ever turned
    back on for articles) but currently has no visible effect
- File: `tests/unit/chrome.test.mjs`
  - Replaced the "a `[data-build][data-stamp]` element is present" assertion (previously checked
    against a sample ARTICLE page) with the inverse: article pages must NOT render `data-build`
- File: `tests/unit/build-stamp.test.mjs`
  - Moved the two cross-surface "commit hash agrees" / "stamp date agrees" assertions from an
    article page to the homepage (the only page the stamp still appears on)
  - Added a new cross-surface case proving article, category, and tag pages ALL carry zero
    `data-build` occurrences
  - Added a direct proof that this build's real, resolved `BUILD_HASH` does not appear anywhere
    in a built article page's HTML (stronger than "the element is gone" — proves the actual hash
    string never leaks into article bytes at all)

## Why

04-10's real Workers Builds measurement (`docs/phase-04/build-measurements.md`, "Finding:
near-total asset re-upload on every commit change") found that Build 3's deploy re-uploaded
60,355 of 60,355 files — essentially the whole site — even though only ~370 pages had genuinely
new content. Root cause: `Base.astro` printed the build's commit hash (`BUILD_HASH`) in the
footer of every single page unconditionally, so any commit changed every page's raw bytes,
defeating Cloudflare's content-hash asset-upload deduplication. The owner approved keeping the
stamp on the homepage + `/version.json` only (2026-09-30) — the homepage already regenerates in
full on every build regardless (its feed reflects "now"), so the stamp costs nothing there, while
every other page (article/category/tag/static) now stays byte-identical across commits when its
own content hasn't changed. Recorded as a deferred follow-up in `04-11-SUMMARY.md`'s "Next Phase
Readiness" and `docs/phase-03/render-step-location.md`'s history did not require the stamp on
every page (03-03's own success criterion is "a script and the page agree on which build is
live," satisfied by the homepage + `/version.json` alone).

Measured before/after: before this fix, all ~60,359 built HTML files carried the commit hash;
after, only 1 (`dist/client/index.html`) does. `/version.json` is untouched — it reads
`src/lib/build-info.ts`'s constants directly and always reports full provenance.

## Issues Encountered

No major issues encountered. The fix is a single conditional wrap; the only care needed was
updating three existing tests (`chrome.test.mjs`, `build-stamp.test.mjs`) whose assertions
depended on the OLD unconditional-stamp behavior against a sample article page — each was
rewritten to assert the new, opposite expectation rather than deleted.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `pnpm run test:unit` (which runs a full real `pnpm run build` first) — 385/385
  tests pass, 0 failures. `pnpm run test:build-gate` — 8/8 pass. Verified directly against the
  real build output: `grep -rl "data-build" dist/client --include="*.html"` returns exactly one
  file (`dist/client/index.html`) out of 60,359 built HTML files.
- What wasn't tested: `tests/regression/byte-identity.test.mjs` (two full real builds against
  live production D1, ~2-4 minutes) was not re-run in this session — it was not required by this
  plan's own verification steps and its own top-comment already notes it doesn't need to account
  for the footer-stamp field since both its builds check out the same commit. The homepage's own
  the-stamp-is-present assertions were verified against one real build only (not two consecutive
  builds), since proving presence needs just one build.
- Edge cases: the new "article page bytes do not vary with BUILD_HASH" test proves the CURRENT
  build's real hash string is absent from article HTML — a direct, single-build proof of
  byte-independence, rather than requiring two full builds with different hashes.

## Next Steps

- [ ] None required by this fix — it closes out the "Not fixed in this plan" item from 04-10's
      finding and the deferred follow-up noted in `04-11-SUMMARY.md`.

---

**Branch:** feature/phase-04
**Issue:** N/A
**Impact:** MEDIUM - fixes a real per-deploy cost multiplier (near-total asset re-upload on every
commit) with a small, contained code change; no behavior change to page content, only to the
footer's build-provenance line's visibility.
