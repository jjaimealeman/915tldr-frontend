# 2026-09-30 - Phase 4 security verified: 50 threats closed, build-token scope guidance added

**Keywords:** [SECURITY] [DOCUMENTATION] [PLANNING]
**Session:** Evening, Duration (~15 minutes)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-30-1932_phase-4-security-verification.md`

## What Changed

- File: `.planning/phases/04-static-generation-templates-seo/04-SECURITY.md`
  - New per-phase security contract built from the 12 plans' threat models (State B, `/gsd-secure-phase 4`)
  - 50 threats registered: 45 mitigated with file:line or test evidence, 5 accepted (4 from plan time, plus T-04-42)
  - `threats_open: 0`, ASVS L1, block threshold `high`; all 19 high-severity threats closed with evidence
  - 04-07's robots.txt `policy-change` threat flag folded into T-04-29 (owner decision 2026-09-27)
  - Accepted risk AR-04-05 (T-04-42, fork PRs triggering builds), with a reminder to test a throwaway fork PR before `main` goes live
- File: `docs/phase-04/workers-builds-setup.md`
  - Added step 4 to the token-scope section: do not broaden the build token beyond Workers deploy, D1 Read and KV Edit (closes the gap noted on T-04-41)

## Why

Phase 4 needed a security sign-off before it can advance. The L1 evidence pass found every mitigation in code or tests except two dashboard-side items. T-04-42's planned mitigation ("leave fork builds disabled") refers to a control that doesn't exist: the owner's screenshot of Settings → Build → Branch control shows only the production branch and the non-production builds checkbox. The owner accepted the risk with a written rationale instead. T-04-41's setup doc listed the scopes the build token needs but never said not to add more, which matters because the repo is public and every build runs with that token.

## Issues Encountered

- T-04-42's mitigation was written against an assumed dashboard toggle. Cloudflare's docs say builds trigger on pushes to the connected repo, so fork PRs very likely don't build, but the docs never say so outright. That's why it was accepted with a test-later reminder rather than marked mitigated.
- Branch was created as `feature/phage-04-security` (typo for "phase"); left as-is.

## Dependencies

No dependencies added

## Testing Notes

- What was tested: grep/evidence-level (ASVS L1) verification of every mitigation; credential-pattern git grep across tracked files; Deploy Hook URL grep across both `915tldr.com` and `915tldr.com2`
- What wasn't tested: no fork PR has been opened against the public repo, so T-04-42 is unproven in practice; the build token's actual scopes were not read from the dashboard
- Edge cases: the only `deploy_hooks/` URL in either repo is the `super-secret-hook` test placeholder

## Next Steps

- [ ] Before `main` goes live, open one throwaway fork PR and confirm no build appears in the Worker's build history (AR-04-05)
- [ ] Confirm the Workers Builds token carries no scopes beyond Workers deploy / D1 Read / KV Edit
- [ ] `/gsd-validate-phase 4` or `/gsd-verify-work 4`

---

**Branch:** feature/phage-04-security
**Issue:** N/A
**Impact:** LOW - planning artifact and setup doc only; no code paths changed
