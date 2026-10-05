# 2026-10-01 - REND-11 fully reconciled against wrangler's own asset count; marked Complete

**Keywords:** [DOCUMENTATION] [DEPLOYMENT] [INFRA] [BUG_FIX]
**Session:** Morning, Duration (~40 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-01-1225_05-09-rend-11-wrangler-asset-count-reconciled-complete.md`

## What Changed

- File: `docs/phase-05/evidence/first-prod-deploy/build-241c97e1-wrangler-window.log`
  - New committed evidence: the real production build's unfiltered wrangler-deploy log window
    (orchestrator-fetched), containing the literal lines the plan's must_haves required —
    `✨ Read 29978 files from the assets directory`, `🌀 Found 2 new or modified static assets`,
    `✨ Success! Uploaded 2 files (29960 already uploaded)`.
- File: `docs/phase-05/evidence/first-prod-deploy/rend-11-reconciliation.md`
  - New file documenting this session's own file-by-file reconciliation of the resulting
    three-way mismatch (gate `29,966` vs. wrangler's console line `29,978` vs. wrangler's own
    upload accounting `29,962`), including the local reproduction method
    (`WRANGLER_LOG=debug` against a real `wrangler deploy --dry-run`) and the named directory
    list (12) and control-file list (4) that explain both gaps exactly.
- File: `tools/assert-file-count.mjs`
  - Added a doc comment pointing future readers at the reconciliation evidence. No logic
    change — `countStaticFiles()` was already correct; confirmed by `node --test
    tests/unit/file-count.test.mjs` (14/14 still pass).
- File: `docs/phase-05/archive-architecture.md`
  - Replaced the "partially closed, one piece still missing" REND-11 section with the full
    reconciliation and a Complete verdict.
- File: `.planning/REQUIREMENTS.md`
  - Marked REND-11 Complete (checkbox + traceability table).
- File: `.planning/STATE.md`
  - Updated the 05-09 decision line: REND-07 and REND-11 both Complete, with the reconciliation
    summarized.
- File: `.planning/phases/05-hybrid-archive-zero-reads-proof/05-09-SUMMARY.md`
  - Updated coverage (D6 now `pass`/`human_judgment: false`), key-decisions,
    requirements-completed (now `["REND-07", "REND-11"]`), Accomplishments, Decisions Made,
    Deviations (added item 4: an investigated discrepancy that turned out not to be a bug),
    and Next Phase Readiness.

## Why

The orchestrator's second log pull contained exactly the line this plan's own must_haves
required (wrangler's literal uploaded-plus-already-present split), which exposed a genuine
three-way count mismatch. The responsible move was to investigate and explain it precisely
rather than accept a partial reconciliation — the result confirms the gate was never actually
wrong; the apparent gap was a quirk in wrangler's own console message.

## Issues Encountered

None beyond the mismatch itself, which is now fully explained (see `rend-11-reconciliation.md`).
No code defect existed.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: reproduced wrangler's own file-discovery behavior locally with
  `WRANGLER_LOG=debug` against a real `--dry-run` deploy, classified every printed path against
  the real filesystem (`fs.statSync`), and confirmed the 12-directory gap reproduces with the
  identical size locally. Ran the full existing `file-count` unit suite after the doc-comment
  edit — 14/14 pass, confirming no behavior changed.
- What wasn't tested: a fresh production build to re-confirm the exact same 12 directories and
  4 control files would recur identically — not necessary, since both sets are fixed by source
  code/config, not by data that varies between builds.
- Edge cases: confirmed `.assetsignore`'s own content (`wrangler.json`, `.dev.vars`) and that
  only `wrangler.json` exists in `dist/client` (`.dev.vars` doesn't, so that ignore line is a
  no-op there).

## Next Steps

- [ ] None for this plan. 05-10 (forced full re-upload) and 05-12 (the final zero-D1-reads gate)
      remain the phase's open items.

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** LOW - a doc-comment-only code change and documentation corrections; REND-11 status
changed from Pending to Complete based on a now-fully-explained reconciliation, not a rounding-up.
