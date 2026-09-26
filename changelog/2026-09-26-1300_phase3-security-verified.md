# 2026-09-26 - Phase 3 security review: 26 of 26 threats closed

**Keywords:** [SECURITY] [DOCUMENTATION] [PLANNING]
**Session:** Midday, Duration (~1 hour)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-26-1300_phase3-security-verified.md`

## What Changed

- File: `.planning/phases/03-foundation-read-budget-guardrails/03-SECURITY.md`
  - New. Threat register for all 26 Phase 3 threats with dispositions, evidence and status
  - Accepted Risks Log: 4 accepted risks (T-03-08, -09, -12, -14), each tied to its plan's written rationale
  - Residuals section: uncommitted Nuxt-repo changes, `admin-dev` missing from Better Auth trustedOrigins, the fail-open page exemption, the redeployable CPU probe, register ID collisions
  - Audit trail: first run 25/26 closed with T-03-02a open; second entry after remediation, 26/26

## Why

Security enforcement is on for this project, so Phase 3 could not be marked complete without a SECURITY.md reporting `threats_open: 0`. The auditor found one blocking threat: `kv-manifest.ts` read the API token from outside the guarded directory. It was fixed in 7763b96, and the config guard was wired into `build` and `deploy` in 7821c06.

## Issues Encountered

The register reused two IDs (T-03-02, T-03-03) for different threats and declared T-03-01 and T-03-04 twice. These are recorded as hygiene findings, not rewritten in the sealed plans.

## Dependencies

No dependencies added

## Testing Notes

- What was tested: `pnpm test:unit` 92/92 and `pnpm test:build-gate` 6/6 after remediation; the auditor ran the guard plugin against KV import graphs, and the fix was proven by reverting it
- What wasn't tested: login on `admin-dev.915tldr.com` (trustedOrigins gap noted, not exercised)
- Edge cases: an on-demand page that doesn't declare `export const prerender = false` literally is not checked by the guard

## Next Steps

- [ ] Owner: commit the three `915tldr.com2` changes on `develop`
- [ ] Add `https://admin-dev.915tldr.com` to Better Auth trustedOrigins, or confirm admin isn't used there before Phase 12
- [ ] Phase 4: revisit the guard's page exemption when on-demand routes arrive

---

**Branch:** feature/phase-03
**Issue:** N/A
**Impact:** Medium. Closes the phase's security gate.
