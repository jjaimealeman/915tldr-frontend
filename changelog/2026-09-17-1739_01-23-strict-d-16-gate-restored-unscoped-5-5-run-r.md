# 2026-09-17 - Strict D-16 gate restored, unscoped 5/5 run, round-2 approval packet (Task 1)

**Keywords:** [FEATURE] [TESTING] [BUG_FIX] [DOCUMENTATION]
**Session:** Evening, Duration ~15 min
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-17-1739_01-23-strict-d-16-gate-restored-unscoped-5-5-run-r.md`

## What Changed

- File: `design/scripts/write-approval-packet.mjs` (rewritten)
  - Removed the 01-10 criterion-5 exception. That exception let the generator accept a FAIL on
    criterion 5 alone while the owner's font-swap-CLS architectural decision was still pending;
    D-GAP-A (owner decision, implemented in 01-13/01-14) resolved it, so the gate now requires
    every criterion PASS in every engine, full stop — D-16's original contract.
  - Added a `--packet <path>` flag (defaults to the real `01-APPROVAL.md`), used by the new
    signed-packet refusal test.
  - Refuses to regenerate over a signed packet — any line starting with `Approved-by:` in the
    existing packet halts generation (T-01-32/T-01-33/T-01-64).
  - Carries the existing packet's `## Revision requests` and `## File fingerprints` sections
    into a new `## Revision history` section (with a `#### Round 1 closure` table mapping all
    14 round-1 items to the gap-closure plans and evidence that addressed them) instead of
    silently discarding the owner's round-1 words on regeneration.
  - Fixed a real bug (Rule 1) in `readFallbackFacesPerEngine`: `font-cls.md` grew a second table
    (the D-GAP-A positive control, added in 01-13) whose own column 5 lands on `verdict` /
    `detected` / `not observable` at the same column index the swap-matrix table uses for
    "fallback face" — polluting the Environment section's fallback-face list with garbage
    values. Scoped collection to rows strictly inside the swap-matrix table.
- File: `.planning/phases/01-design-sketch-editorial-identity/01-APPROVAL.md` (regenerated)
  - Round-2 packet: "Owner review focus (round 2)" (7 items, including two issues surfaced
    beyond the plan's own checklist — the Business record's stale "turquoise or teal" subject
    wording against its actual 152° green hue, and stale "Instrument Serif" captions in the
    palette swatch PNGs); deviations (D-GAP-A, D-GAP-B, D-05, DSGN-06 wording); ten planner
    resolutions; flagged assumptions A-01 through A-14; 14 fingerprinted files (the original 8
    plus `home-feed.json` and 5 feed pages); an unchecked owner review checklist; an empty
    `(none yet — round 2)` Revision requests section; and a Revision history preserving round 1
    verbatim (owner quotes byte-identical) plus the closure table.
- File: `design/evidence/verify-phase-1.json`, `design/evidence/verify-phase-1.txt` (regenerated)
  - Full unscoped `pnpm run verify:phase-1`: 5/5 PASS, Chromium + WebKit (Playwright 26.6,
    docker), no SCOPED banner, no `.astro` file anywhere in the repo (353 Playwright tests,
    ~3m10s).
- Files: `design/evidence/font-cls.md`, `design/evidence/keyboard/*.png`,
  `design/evidence/pages/index-*.jpg`
  - Regenerated as a side effect of the unscoped run (screenshots and swap-matrix evidence are
    re-captured on every full run); committed as part of the packet rather than left dirty.
- File: `.planning/phases/01-design-sketch-editorial-identity/01-VALIDATION.md`
  - Appended a "Gap-closure per-task map" (01-11-T1 … 01-23-T3: wave, requirement IDs, behaviour,
    type, automated command, status) and a requirement-map addition for the six spec/test files
    the gap-closure plans introduced (`chrome.spec.ts`, `layout.spec.ts`, `lead-fallback.spec.ts`,
    `load-more.spec.ts`, `summary-markdown.test.mjs`, `font-axes.test.mjs`). Frontmatter status
    left unchanged (still `draft`).

## Why

D-16 requires one full, unscoped machine run against a strict 5/5 gate before any approval
packet is regenerated, and requires the owner's round-1 revision history to survive a
regeneration. The round-1 packet's own gate was intentionally widened (01-10) to let a packet
exist at all while the owner's criterion-5 architectural decision was still open; now that
decision has been implemented and verified, keeping the widened gate would be dishonest —
criterion 5 genuinely passes on real evidence, so there is no remaining reason to special-case
it. Regenerating the packet from scratch without preserving round 1 would also erase the
owner's original ten revision requests and four decisions, which the phase's own audit trail
depends on.

## Issues Encountered

- `readFallbackFacesPerEngine`'s original round-1 implementation assumed any wide markdown table
  row was the swap matrix. `font-cls.md` grew a second table since round 1 (01-13's positive
  control), which happened to share the same column index for an unrelated field, corrupting
  the Environment section's fallback-face list. Found while reviewing the freshly generated
  packet's own output before committing it, not by a failing test — fixed and re-verified by
  regenerating the packet again and confirming the Environment line read cleanly.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: three refusal tests (scoped evidence, full-scope evidence with criterion 5
  forced to FAIL, and a signed packet via `--packet`) each confirmed to exit 1 against synthetic
  fixtures under `design/.cache/approval-check/` (gitignored, not committed). Full unscoped
  `pnpm run verify:phase-1`: 5/5 PASS both engines. `pnpm run approval:packet` then
  `pnpm run verify:approval --pending-ok` exits 0 (14/14 fingerprints match); `pnpm run
  verify:approval` with no flag exits 1 (correctly unsigned — no owner signature exists yet).
  The plan's own acceptance-check script (string-presence checks against the generated packet,
  unsigned-line check, Revision-requests placeholder check, evidence cleanliness check) passed.
- What wasn't tested: the owner's own visual/keyboard re-review (Task 2) and sign-off decision
  (Task 3) — those are this plan's next two tasks, checkpoints the executor cannot perform on
  the owner's behalf.

## Next Steps

- [ ] 01-23 Task 2: owner keyboard walk and visual review of all five mockups (checkpoint)
- [ ] 01-23 Task 3: owner's approve/revise decision (checkpoint)

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** HIGH — restores the phase's approval gate to its original strict contract and
produces the packet the owner's re-review depends on.
