# 2026-10-02 - CR-01 proven live on the real CLI; pipeline doc states the dry-run contract

**Keywords:** [DOCUMENTATION] [TESTING] [DEPLOYMENT] [SECURITY]
**Session:** Evening, Duration (~15 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-02-2052_05-13-task2-cr01-live-dry-run-proof-and-doc.md`

## What Changed

- File: `docs/phase-04/build-pipeline.md`
  - DEPLOY diagram steps 4 (`commitLastGood`) and 5 (`archive-sync post`) each annotated: "(skipped entirely in a dry run — CI_BUILD_DEPLOY_DRY_RUN=1 deploys nothing, so nothing may be committed or deleted; CR-01, 05-13)"

## Why

Task 1 fixed and unit-tested the CR-01 behavior (dry runs can no longer reach `archive-sync post`). This task proves the fix on the real CLI path, safely, and updates the pipeline doc so the dry-run contract is documented where an operator would look.

Ran the real deploy CLI once in dry-run mode with R2 and ntfy variables removed from the environment (`env -u R2_ACCESS_KEY_ID -u R2_SECRET_ACCESS_KEY -u NTFY_TOPIC -u NTFY_TOKEN CI_BUILD_DEPLOY_DRY_RUN=1 node tools/ci-build.mjs deploy`), so the run was structurally incapable of touching production R2 or sending a push even if a guard were wrong. Result, captured in `.wrangler/ci-dry-run-05-13.log` (gitignored):

- `ARCHIVE_SYNC_RESULT {"phase":"pre",...,"disabled":true,...}` — pre correctly reported the archive tier disabled (no R2 credentials) and moved all 30,504 planned archive pages back into `dist/client` (local-only side effect)
- File-count gate passed (60,486 / 100,000, ok)
- `wrangler deploy --dry-run` ran and exited with `--dry-run: exiting now.` — uploaded nothing
- Log line `[ci-build] dry run: skipping archive-sync post — it mutates the production bucket and this run deployed nothing` appeared exactly once
- Zero lines starting `ARCHIVE_SYNC_RESULT {"phase":"post"` — post-sync never ran

`CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` were left set (already present in the shell) since `wrangler deploy --dry-run` needs them for auth and they carry no R2/ntfy write power.

After the dry run, the disabled pre-sync had moved every archive-tier page back into `dist/client` (`dist/archive` had 0 files). Ran `pnpm run build` to restore the partitioned output: `dist/archive-plan.json` present again, `find dist/archive -type f | wc -l` = 30,713.

## Issues Encountered

No major issues encountered. This matched the expected path exactly (pre reports `disabled: true`, no R2 touched, skip line logged, no post result line).

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: the real `tools/ci-build.mjs deploy` CLI path, credential-free for R2/ntfy, in dry-run mode
- What wasn't tested: a real (non-dry-run) production deploy through this fixed code — out of scope for this plan, and would spend real wrangler/R2 operations
- Edge cases: archive tier disabled (no R2 credentials) during a dry run — confirmed pre still reports it correctly and post is still never reached

## Next Steps

- [ ] 05-14: add the independent archive-sync-side refusal (live-deployment match before any deletion) — second wall for CR-01
- [ ] This plan's 05-13 is now closed; proceed to the next gap-closure plan in the 05-13..05-21 sequence

---

**Branch:** feature/phase-05
**Issue:** CR-01 (05-REVIEW.md)
**Impact:** MEDIUM - documentation + live proof of an already-shipped safety fix; no behavior change in this commit
