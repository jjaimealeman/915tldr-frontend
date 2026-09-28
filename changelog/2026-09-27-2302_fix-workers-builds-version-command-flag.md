# 2026-09-27 - Fix Workers Builds non-production deploy command missing --config flag

**Keywords:** [DOCUMENTATION] [DEPLOYMENT] [INFRA] [CONFIG]
**Session:** Late evening, Duration (~10 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-27-2302_fix-workers-builds-version-command-flag.md`

## What Changed

- File: `docs/phase-04/workers-builds-setup.md`
  - Corrected the non-production branch deploy command from `pnpm exec wrangler versions upload`
    to `pnpm exec wrangler versions upload --config wrangler.jsonc`
  - Added a note that the Cloudflare dashboard now labels this field "Version command" (and the
    production deploy command "Preview command" in some dashboard revisions) — same setting,
    updated label

## Why

While setting up Workers Builds on the real `915tldr-v2` Worker dashboard (04-10 Task 1, owner
setup), the owner's screenshot showed the dashboard's non-production build field labeled
"Version (non-production) command." The runbook's originally-documented command omitted
`--config wrangler.jsonc`, which 04-06 already found and fixed for the production `deploy`
script: `@astrojs/cloudflare` marks the entry-Worker build environment `devOnly` whenever the
Astro app has zero on-demand routes, so a bare `wrangler` invocation reads the adapter-generated
`dist/client/wrangler.json` (via `.wrangler/deploy/config.json`'s redirect), which carries no
`main` field and would silently omit this project's Worker. The same risk applies to
`wrangler versions upload` on non-production branches — the orchestrator added the flag when
setting up the real dashboard connection, and this commit corrects the runbook doc to match so
future readers don't copy the unflagged command.

## Issues Encountered

No major issues encountered.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: Documentation-only change; no code path exercised. Cross-checked against
  04-06-SUMMARY.md's Deviation 1 (the original finding this doc now correctly reflects).
- What wasn't tested: The actual non-production build invocation itself — that runs for real in
  04-10 Task 2's Workers Builds spike.
- Edge cases: N/A (doc fix).

## Next Steps

- [ ] Confirm the real non-production Workers Builds build (04-10 Task 2) actually uses this
      corrected command and successfully bundles the Worker.

---

**Branch:** feature/phase-04
**Issue:** N/A
**Impact:** LOW - documentation correction, no code or production behavior change
