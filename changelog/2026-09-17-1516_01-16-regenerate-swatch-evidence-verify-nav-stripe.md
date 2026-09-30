# 2026-09-17 - Swatch Evidence Regenerated, Nav-Stripe Distinctness Verified, WINDOWS Entry 3 Closed

**Keywords:** [FEATURE] [TESTING] [DOCUMENTATION]

**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-17-1516_01-16-regenerate-swatch-evidence-verify-nav-stripe.md`

## What Changed

- `design/evidence/palette-swatches-{light,dark}.png`: regenerated via
  `pnpm run palette:swatches` against the new Business colour. Both PNGs
  are newer than `palette.json`, over 10KB, at least 1200px wide, and
  the script's own in-page hex-label check confirms every displayed
  colour matches `palette.md` exactly. Visually, Business now renders
  as a clear forest green in both light and dark themes — no
  amber/olive cast, clearly distinguishable from Health's olive-green
  and Sports's amber.
- Ran `node design/scripts/pw.mjs --project=all design/tests/content.spec.ts`:
  37/37 tests pass in both Chromium and WebKit, including the
  pairwise-distinctness check on the eight nav stripe colours per theme.
- `.planning/WINDOWS.md`: entry 3 marked `fixed` via
  `gsd-tools windows fixed 3`, with its description rewritten (both the
  markdown row and the JSON block, kept in sync) to record the actual
  outcome rather than leave the original "flagged for owner review"
  wording stale — Sports (49.4deg) was accepted by the owner in round 1
  in their own words ("sports is more redish, thats ok", per
  `01-APPROVAL.md`), while Business was re-sampled to 152.1deg, fully
  outside the 40-100deg amber/olive band, so it no longer reads as
  brown by construction rather than by owner tolerance of a borderline
  colour. Entry 2 (the politics photo substitution) was left untouched
  and still `open`, per the plan's instruction — its confirmation
  belongs to the phase's 01-23 re-review, not this plan.

## Why

Task 1 fixed the underlying colour; this task makes that fix visible in
the same evidence artifacts the owner and the phase's automated checks
already rely on, and updates the cross-phase defect ledger so the fix
is recorded where `/gsd-ship`'s windows-enforcement gate will see it.

## Issues Encountered

None — every check passed on the first run once Task 1's palette
change was in place.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `pnpm run palette:swatches` (both PNGs pass the
  script's own size/width/hex-match checks); `content.spec.ts` in both
  engines (37/37 passing, including nav-stripe distinctness); visual
  read of both regenerated swatch PNGs against C-01's "does it read as
  brown" question.
- What wasn't tested: this remains a human aesthetic judgement per
  C-01 — the phase's end-of-phase human check (collected at 01-23)
  still applies to the Business masthead and both swatch PNGs.

## Next Steps

- [ ] Plan-level metadata commit (SUMMARY, STATE, ROADMAP)
- [ ] End-of-phase human check at 01-23: owner looks at the Business
      masthead on category.html in both themes and at both swatch PNGs

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** LOW - regenerates evidence artifacts and closes one ledger
entry; no code, threshold, or gate changed.
