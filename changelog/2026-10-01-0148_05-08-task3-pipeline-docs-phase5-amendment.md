# 2026-10-01 - Phase 3/4 Pipeline Docs Brought In Line With the Archive Tier

**Keywords:** [DOCUMENTATION] [ARCHITECTURE] [INFRA]
**Session:** Early morning, Duration (~10 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-01-0148_05-08-task3-pipeline-docs-phase5-amendment.md`

## What Changed

- File: `docs/phase-04/build-pipeline.md`
  - Added a "Phase 5 amendment (05-08)" section: the updated build-step pipeline (marker ->
    clean -> `astro build` -> partition -> file-count gate) and deploy-step pipeline (hot-window
    guard -> archive-sync pre -> file-count gate re-run -> `wrangler deploy` -> `commitLastGood`
    -> archive-sync post -> alerts/daily report), the 840s/1020s deadlines, what non-production
    branches do (partition + the file-count gate run on every branch; the archive-sync phases
    never run on a preview build at all — they only spawn from `tools/ci-build.mjs deploy`, which
    preview branches never call), and a pointer to `docs/phase-05/archive-architecture.md`.
  - Extended the existing forced-full-rebuild runbook with an archive-tier addendum: a
    template/redesign change needs no extra step (the `post` phase's own changed-key diff
    re-uploads automatically); `node tools/archive-sync.mjs request-full --reason "..."` forces a
    full re-upload of every already-archived page when needed.
- File: `docs/phase-04/workers-builds-setup.md`
  - Added a "Phase 5 build variables (05-08)" section: `R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`
    as Secrets, production-branch-only, bucket-scoped Object Read & Write (never account-wide);
    `ALLOW_FALLBACK_HOT_WINDOW` as the deliberate, remove-after-use D-07b override; an explicit
    statement that the Workers Builds build token's own permissions (D1 read, KV edit, Workers
    deploy) are unchanged by Phase 5 (T-04-41) — the archive tier uses its own separate,
    narrower, bucket-scoped secrets instead of widening that token.
- File: `docs/phase-03/render-step-location.md`
  - Added a dated "Phase 5 note, 2026-10-01 (05-08)" resolving the open question Phase 4's own
    amendment left standing: the archive tier's rendering runs on Workers Builds (the same
    build's output, relocated by `partition-archive.mjs` and uploaded by `archive-sync.mjs`), not
    inside the 2-hour cron Worker, which only triggers builds. Also records that the chained-cron
    full-rebuild mechanism was explicitly considered for the archive tier and not adopted
    (~2.7 days measured vs. D-10's 24-hour SLA). No existing decision text was edited — the new
    note is appended as its own blockquote.

## Why

05-08's own code changes (Tasks 1-2) moved the archive tier's render/upload sequence into the
real `tools/ci-build.mjs` deploy path; these three documents were the last place still disagreeing
(or silent) about where that actually happens. 04-CONTEXT.md's D-05 explicitly flagged "Phase 5's
R2 archive re-render may still live in the cron Worker" as an open question for Phase 5's own
planner to resolve — this task is that resolution.

## Issues Encountered

None — all three grep-based acceptance checks (`Phase 5 amendment`, `R2_SECRET_ACCESS_KEY`,
`Phase 5 note`) passed on the first attempt, and `git diff --stat` for all three files shows
insertions only (113 insertions, 0 deletions across all three).

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `grep -c "Phase 5 amendment" docs/phase-04/build-pipeline.md` (1),
  `grep -c "R2_SECRET_ACCESS_KEY" docs/phase-04/workers-builds-setup.md` (1),
  `grep -c "Phase 5 note" docs/phase-03/render-step-location.md` (1); `git diff --stat` confirms
  insertions-only for all three files.
- What wasn't tested: documentation changes are not independently executable; this task's
  "testing" is the grep/diff verification above, matching the plan's own `<verify>` block.

## Next Steps

- [ ] Plan 05-08 complete — write 05-08-SUMMARY.md and update STATE.md/ROADMAP.md.

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** MEDIUM - documentation-only, closes an open design question Phase 4 deliberately left
for Phase 5
