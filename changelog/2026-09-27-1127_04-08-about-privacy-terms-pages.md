# 2026-09-27 - /about, /privacy and /terms ported with v1's current text

**Keywords:** [FEATURE] [FRONTEND] [SEO] [TESTING] [DOCUMENTATION]
**Session:** Morning, Phase 4 Plan 8, Task 3 of 3 (plan complete)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-27-1127_04-08-about-privacy-terms-pages.md`

## What Changed

- File: `src/pages/about.astro`
  - v1's current text (`915tldr.com2/app/pages/about.vue`) carried over verbatim, converted from
    Vue/Tailwind markup to plain semantic HTML inside the same narrow reading column
    (`[data-contact-column]`) contact.astro established — confirmed against
    `design/mockups/style.css` that this attribute is a standalone narrow-column style, not paired
    to the rail layout, before reusing it here
- File: `src/pages/privacy.astro`
  - v1's current text (`privacy.vue`) carried over verbatim, same structure
- File: `src/pages/terms.astro`
  - v1's current text (`terms.vue`) carried over verbatim, same structure
- File: `tests/unit/static-pages.test.mjs`
  - Extended (Task 2's version covered changelog/contact only) with: each of the three pages'
    canonical URL and its first two headings verbatim from the matching v1 source file, plus a
    5-route collision sanity check (each of changelog/contact/about/privacy/terms emits exactly one
    `dist/client` file)

## Why

D-10: cutover never loses a privacy policy, terms of service, or about page. No wording was
changed — Phase 10 owns the About page rewrite (IDNT-01/02); this plan's job was preservation, not
editorial revision.

## Issues Encountered

One internal link was omitted, not reworded: v1's About page ends its "Our Sources" paragraph with
a "View our sources →" link to `/sources`. No such route exists in this build — only per-source
pages at `/source/<slug>` (04-05) — so linking to it would ship a dead internal link. The
surrounding sentence's wording is unchanged; only the dead CTA phrase itself was omitted. No other
sentence needed omitting — none of the three pages' v1 text depends on a runtime-computed value
beyond what a static build already has.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: all three pages against a real `pnpm run build`, plus the full existing
  `test:fast` suite (358/358) and `test:build-gate` (8/8) to confirm nothing regressed
- What wasn't tested: visual parity with any future approved design for these pages (no Phase 1
  mockup exists for about/privacy/terms — narrow-column structure only)
- Edge cases: n/a — these are static long-form pages with no data-dependent branching

## Next Steps

- [ ] 04-08-SUMMARY.md
- [ ] Phase 10 rewrites About (IDNT-01/02)

---

**Branch:** feature/phase-04
**Issue:** N/A
**Impact:** MEDIUM - three new public routes preserving legal/about content ahead of cutover
