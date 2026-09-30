# 2026-09-16 - Phase 1 Context Captured and Per-Phase Branch Convention Set

**Keywords:** [PLANNING] [DESIGN] [DOCUMENTATION] [CONFIG] [ACCESSIBILITY]
**Session:** Morning, Duration (~2 hours including an unrelated tooling investigation)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-16-1009_phase-1-context-and-branch-convention.md`

## What Changed

- File: `.planning/phases/01-design-sketch-editorial-identity/01-CONTEXT.md` (NEW)
  - 16 implementation decisions (D-01…D-16) across four discussed areas
  - 1 owner constraint (C-01) recorded as an explicit override on requirement DSGN-04
  - Canonical refs section with full relative paths, grouped by topic
  - Code context section recording that this repo is greenfield and v1 lives in `915tldr.com2`
  - Seven items recorded as open *within* the phase, needing research rather than owner input

- File: `.planning/phases/01-design-sketch-editorial-identity/01-DISCUSSION-LOG.md` (NEW)
  - Audit trail of every option presented and selected, per area
  - Records the one decision that was taken and then withdrawn (paper/ink neutrals)
  - Process notes on which questions were re-framed after checking source data

- File: `.planning/CONVENTIONS.md` (NEW)
  - Per-phase branch convention: `feature/phase-NN`, zero-padded to match phase directories
  - Distinguishes planning artifacts (may stay on `develop`) from implementation work (must not)

- File: `.claude/CLAUDE.md`
  - Populated the `GSD:conventions` managed block with the same branch convention
  - Block was previously the "not yet established" placeholder; source file created alongside
    so a regeneration reproduces it rather than reverting it

- File: `.planning/STATE.md`
  - Session recorded: stopped at "Phase 1 context gathered", resume file set to 01-CONTEXT.md

- File: `changelog/` (NEW)
  - First-time changelog setup for this repo: directory, keyword file, index

## Why

Phase 1 discussion ran through four gray areas — palette and category colour system, mockup
fidelity and file structure, editorial furniture and grid, and approval and verification
method. The output is the context file the researcher and planner consume, so decisions
needed to be recorded with enough rationale that downstream agents do not re-litigate them.

Three decisions were driven by checking source data rather than by preference, and are
recorded that way:

- **Card design** follows from PRD §9.1's measured imagery state — 58.0% usable image, 39.1%
  none at all, 3% junk. At 42% imageless, an image-led grid would be validated against
  placeholders until Phase 7.
- **Changelog treatment** follows from inspecting both changelog layers in `915tldr.com2`.
  The public `items[]` are already complete plain-English sentences, so DSGN-07 is a
  rendering problem, not a writing problem — narrower than the requirement's wording implies.
- **Homepage shape** follows from category distribution — ~40 articles/day across 8 uneven
  categories means any category-reserved layout shows empty sections on a normal day.

The branch convention was requested directly by the owner. It was written to
`.planning/CONVENTIONS.md` rather than only into `CLAUDE.md` because every section of that
file sits inside a GSD-managed block regenerated from a source file; a direct edit alone
would have been silently reverted on the next regeneration.

## Issues Encountered

- **One decision was withdrawn and re-taken.** The paper/ink neutrals were locked as warm
  bone `#F7F3EC`, and the owner then flagged — unprompted — that they dislike tan, brown and
  beige generally. Since bone is a beige, the decision was re-opened in the same session
  rather than carried forward, and re-taken as near-neutral `#FAFAF8`. Recorded as C-01 with
  the invalidation noted explicitly.

- **C-01 conflicts with the literal wording of DSGN-04**, which reads "a distinct colour from
  a Chihuahuan desert palette." An agent reading that requirement alone would re-import the
  rejected earth-tone register. Recorded in CONTEXT.md as an explicit override and flagged
  for a wording revision at the next phase transition; REQUIREMENTS.md was not edited
  mid-phase.

- **A deliberate PRD deviation was taken.** PRD §5.1 names pull quotes as a structural
  element, but the article body is an AI-generated summary — setting machine text at display
  size presents it as editorial voice, which is the credibility problem Phase 2 exists to
  fix. Replaced with a standfirst deck. Reasoning recorded so it can be overruled.

- **Platform gap found for a criterion-5 check.** D-08 calls for a WebKit pass to settle the
  unverified Safari `size-adjust` / `ascent-override` question, but Safari does not run on
  Arch Linux. Playwright's WebKit build is the same engine, not the same browser. Recorded as
  a planner-facing constraint with an instruction not to report "Safari verified" from a
  Linux run.

- **Unrelated, found during the session:** invoking a skill with `args` substitutes `$0`–`$9`
  into the served SKILL.md body, silently corrupting dollar figures. Confirmed across three
  skills and four invocations with a second session. The measured image costs recorded in
  commit `9576e2c` were verified unaffected by reconciling all four figures against the
  $30/M token rate. No files in this repo were changed as a result.

## Dependencies

No dependencies added. This repo still has no `package.json` — it contains only `docs/`,
`.planning/`, `.claude/` and now `changelog/`.

## Testing Notes

- What was tested: the four recorded cost figures in PROJECT.md were reconciled against token
  counts and the published $30/M rate; all four agree within the expected text-input delta
  (+$0.0011 on the three 2048×1152 calls, +$0.0001 on the 1024×1024).
- What wasn't tested: nothing in this commit is executable. The verification scripts that
  D-13, D-14 and D-15 describe are Phase 1 *implementation* work and do not exist yet.
- Edge cases: the stress set defined in D-06 is itself the edge-case plan for the mockups —
  longest and shortest headline, padded and thin summary, 5 tags and 0 tags, no image and
  junk image, Spanish at +25%.

## Next Steps

- [ ] `/gsd-plan-phase 1` — research and plan the phase from this context
- [ ] Create `feature/phase-01` in lazygit before any mockup or script work begins
- [ ] Resolve the seven open-within-phase items during research (focus-ring colour, brand
      colour, masthead and 320px nav, category masthead, subsetting toolchain,
      images-vs-placeholders, theme-toggle JS against DSGN-06)
- [ ] Decide whether `docs/` should be tracked — CONTEXT.md cites `docs/PRD.md` as a canonical
      ref, but the directory is untracked, so a fresh clone cannot resolve those references
- [ ] Revise DSGN-04's wording at the next phase transition to match C-01

---

**Branch:** develop
**Issue:** N/A
**Impact:** MEDIUM — no code changes; sets the decisions and branch policy that Phase 1
implementation and all later phases build on
