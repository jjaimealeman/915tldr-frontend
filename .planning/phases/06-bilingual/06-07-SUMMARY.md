---
phase: 06-bilingual
plan: 07
subsystem: i18n
tags: [astro, i18n, hreflang, seo, accessibility, privacy, content]

# Dependency graph
requires:
  - phase: 06-bilingual (06-05)
    provides: "src/lib/i18n/dictionary.ts (t), src/lib/i18n/hreflang.ts (alternateLinks/pairedPath), Base.astro's lang/alternates/switchPath props, the live Umami tag"
  - phase: 06-bilingual (06-06)
    provides: "articlesEs Content Layer collection, src/lib/i18n/spanish-view.ts (buildEsIndex/localizedArticleView/categoryLabel)"
provides:
  - "Five human-approved Spanish static pages: /es/about, /es/privacy, /es/terms, /es/contact, /es/changelog — the full set of I18N-04's non-article, non-listing page types"
  - "An accurate English Privacy disclosure (src/pages/privacy.astro): names Umami precisely (self-hosted at stats.915websites.com, cookieless, no PII) and replaces a false 'we never track where you are' claim with an accurate coarse country/region statement, every claim cited against Umami's own documentation"
  - "docs/phase-06/spanish-pages-review.md: the side-by-side EN/ES review packet plus the recorded human approval (D-16) — Jaime Aleman, 2026-10-04, 'approved. all.', no edits"
  - "tests/unit/es-static-pages.test.mjs: dist-based coverage for self-canonical + reciprocal hreflang + /es-only internal links across all five Spanish static page types, plus /es/changelog's D-17 behavior"
affects: [06-bilingual-sitemaps-feeds, 06-bilingual-go-live-decision]

# Actuals (#2632)
actuals:
  tokens: 15700
  tasks: 2
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Static trust-page prose (About/Privacy/Terms/Contact) is D-16 human-reviewed content, not dictionary-driven — unlike chrome strings, it lives directly in each .astro file and is reviewed via a dedicated side-by-side packet (docs/phase-06/spanish-pages-review.md), not an automated test"
    - "Third-party tool claims (Umami's data collection) are verified against the vendor's own live-fetched documentation and cited by URL in the review packet, never asserted from training-data memory — the project's own 06-CONTEXT.md instruction for this plan"
    - "Genuine TDD RED proven by temporarily moving the real implementation file (es/changelog.astro) aside with `mv` (not git stash, which is forbidden project-wide), rebuilding, confirming the exact expected failures, then restoring for GREEN — same discipline as 06-05/06-09's tracer-then-TDD pattern applied to a plain feature task"

key-files:
  created:
    - src/pages/es/about.astro
    - src/pages/es/privacy.astro
    - src/pages/es/terms.astro
    - src/pages/es/contact.astro
    - src/pages/es/changelog.astro
    - docs/phase-06/spanish-pages-review.md
    - tests/unit/es-static-pages.test.mjs
  modified:
    - src/pages/privacy.astro

key-decisions:
  - "English Privacy's old 'Cloudflare for hosting and basic analytics' claim was split into two real things — a Cloudflare (hosting/CDN only) section and a new Umami Analytics section — rather than patching the existing sentence, because the two tools do genuinely different jobs and conflating them was part of the original inaccuracy (T-06-26)"
  - "The Umami Analytics disclosure names country/region only, not city, even though Umami's schema supports a City metric — this project has not verified live Cloudflare-header precision reaches city level on this instance, so the page states the conservative, narrower claim it can actually stand behind"
  - "The /es/changelog rail and /es/contact rail both use localizedArticleView (Spanish titles where available, English fallback marked lang=\"en\" otherwise) rather than the plain English titles 06-05's /es/index.astro used before the articlesEs collection existed — this plan's two rails are the first static (non-article, non-listing) pages to adopt the now-available real-data pattern"

patterns-established:
  - "A dedicated review-packet document (one per plan, not a shared file) is the correct artifact shape for a D-16-style human-content-approval gate — side-by-side table per page, a citations section for any factual claim resting on third-party documentation, and a single 'Reviewer decision' section at the end that the plan edits in place once resolved, rather than a separate approval file"

requirements-completed: []  # I18N-04 and I18N-10 (this plan's frontmatter requirements) are intentionally left Pending in REQUIREMENTS.md, matching this phase's own established precedent (06-02/06-05/06-06/06-09): this plan completes the STATIC-PAGE half of I18N-04 (about/privacy/terms/contact/changelog, now human-approved) and the DISCLOSURE half of I18N-10 (an accurate Privacy statement), but I18N-04's full behavior spans every public page type (category/tag/source/listing pages, built in the concurrently-executed 06-10), and I18N-10's full behavior still needs 06-16's live confirmation that the Umami instance exposes a Languages report (06-05-PLAN.md's own "Flagged assumptions" section, unchanged by this plan).

coverage:
  - id: D1
    description: "/es/about, /es/privacy, /es/terms, /es/contact and /es/changelog are built with <html lang=\"es\">, Spanish chrome, a self canonical and reciprocal hreflang pairs with their English pages"
    requirement: "I18N-04"
    verification:
      - kind: unit
        ref: "tests/unit/es-static-pages.test.mjs#es-static-pages: {about,privacy,terms,contact,changelog}.html has a self canonical and reciprocal en/es/x-default hreflang with its English page — 5/5 pass"
        status: pass
      - kind: unit
        ref: "tests/unit/es-static-pages.test.mjs#es-static-pages: every internal href on {about,privacy,terms,contact,changelog}.html starts with /es, except the language switch and fragment links — 5/5 pass"
        status: pass
    human_judgment: false
  - id: D2
    description: "The Spanish About, Privacy, Terms and Contact text shipped is exactly the text a fluent human reviewer approved (D-16); the approval, reviewer and any edits are recorded in docs/phase-06/spanish-pages-review.md"
    requirement: "I18N-04"
    verification:
      - kind: manual_procedural
        ref: "docs/phase-06/spanish-pages-review.md#Reviewer decision — Jaime Aleman, 2026-10-04 06:30 MDT, \"approved. all.\", no edits requested, covering all four pages and the English Privacy correction"
        status: pass
    human_judgment: true
    rationale: "D-16 is explicitly a human-judgment gate (translation fidelity, register, legal-text obligation parity) — no automated check can substitute for a fluent reader's approval. Resolved: approved as-is, no edits."
  - id: D3
    description: "/es/changelog has a Spanish heading and intro, a one-line note that build notes are published in English, and every changelog entry rendered with lang=\"en\" and left untranslated (D-17)"
    requirement: "I18N-04"
    verification:
      - kind: unit
        ref: "tests/unit/es-static-pages.test.mjs#es-static-pages: es/changelog.html has <html lang=\"es\">, a Spanish heading/intro and the English-build-notes note"
        status: pass
      - kind: unit
        ref: "tests/unit/es-static-pages.test.mjs#es-static-pages: es/changelog.html renders the same number of dispatch entries as changelog.html, each inside a lang=\"en\" element"
        status: pass
    human_judgment: false
  - id: D4
    description: "The English and Spanish Privacy pages name the self-hosted Umami analytics at stats.915websites.com and state what it records (including browser language and coarse location) consistently with Umami's own documentation; no sentence claims location is never recorded (D-11)"
    requirement: "I18N-10"
    verification:
      - kind: other
        ref: "grep -c \"stats.915websites.com\" dist/client/privacy.html dist/client/es/privacy.html — 1 match in each"
        status: pass
      - kind: manual_procedural
        ref: "docs/phase-06/spanish-pages-review.md's Umami documentation citation table (docs.umami.is/docs/{faq,metric-definitions,sessions}, fetched 2026-10-04), reviewed and approved by Jaime Aleman as part of the same \"approved. all.\" decision"
        status: pass
    human_judgment: true
    rationale: "Whether a privacy claim is factually accurate for how Umami is actually configured on this instance is a judgment call about a live third-party service, not something a unit test can fully certify — the reviewer's approval covers this claim alongside the translation review."

duration: ~50min
completed: 2026-10-04
status: complete
---

# Phase 6 Plan 07: Spanish Trust Pages Summary

**All five Spanish static page types (About, Privacy, Terms, Contact, Changelog) are now live under `/es`, with human-approved translations and a corrected English Privacy page that names the self-hosted Umami analytics precisely instead of the false "we never track where you are" claim it carried before — reviewed and approved by Jaime Aleman on 2026-10-04 with zero edits requested.**

## Performance

- **Duration:** ~50min
- **Completed:** 2026-10-04
- **Tasks:** 2 of 2 (plus the Task 3 review checkpoint, now resolved)
- **Files modified:** 8 (7 new, 1 modified)

## Accomplishments

- `src/pages/es/{about,privacy,terms,contact}.astro` ship Claude-drafted, now human-approved
  Spanish translations of all four trust pages, mirroring each English page's structure and
  props exactly. Terms' near-legal obligations/disclaimers are preserved 1:1 — nothing added,
  nothing dropped. Contact keeps the same disabled-form honesty and the same real bio copy,
  translated, with its "Latest Stories" rail driven by `localizedArticleView` (real Spanish
  titles where they exist, English fallback marked `lang="en"` otherwise).
- `src/pages/privacy.astro` (English) is corrected (D-11, T-06-26): names Umami explicitly as
  the self-hosted, cookieless analytics tool at `stats.915websites.com`, and replaces "Your
  location is your business. We never track where you are." with an accurate "Coarse Location
  Only" statement — no precise location, aggregate country/region only, IP address itself never
  stored. Every claim is cited directly against Umami's own documentation
  (`docs.umami.is/docs/{faq,metric-definitions,sessions}`), fetched live during this plan, not
  recalled from memory.
- `src/pages/es/changelog.astro` ships the Spanish changelog (D-17): Spanish heading/intro/
  one-line "build notes are published in English" note from the fixed dictionary, with every
  entry rendered unchanged inside a `lang="en"` wrapper — entries are never translated, now or in
  the future.
- `docs/phase-06/spanish-pages-review.md` is the side-by-side EN/ES review packet (paragraph by
  paragraph, all four trust pages) plus the English Privacy diff and the full Umami citation
  table — and now carries the recorded reviewer decision.
- `tests/unit/es-static-pages.test.mjs` (new, TDD) proves self-canonical + reciprocal
  en/es/x-default hreflang and `/es`-only internal links across all five Spanish static page
  types, plus `/es/changelog`'s specific D-17 behavior (lang="es" chrome, matching entry count,
  `lang="en"` per entry).
- **Task 3's blocking checkpoint resolved**: Jaime Aleman reviewed the full packet and replied
  "approved. all." (2026-10-04, 06:30 MDT) — approved as-is, no edits, covering all four Spanish
  pages and the English Privacy correction. Recorded verbatim in the review packet's "Reviewer
  decision" section.

## Task Commits

Each task was committed atomically via `/jja-commit`:

1. **Task 1: Spanish About, Privacy, Terms and Contact drafts + accurate Umami disclosure on both Privacy pages** - `c970433` (feat)
2. **Task 2 (RED): failing coverage for /es/changelog and the five-page hreflang/link contract** - `c2428b3` (test)
3. **Task 2 (GREEN): /es/changelog ships, full test suite passes** - `a815470` (feat)

**Plan metadata:** this file's own commit (docs: complete plan)

_Note: Task 2's TDD cycle was genuine, not disclosed-as-approximate: `src/pages/es/changelog.astro`
was moved aside (`mv`, not `git stash` — forbidden project-wide) before the RED commit, a real
build confirmed exactly the 4 expected failures (the other 10 about/privacy/terms/contact tests
already passed from Task 1), then the implementation was restored for GREEN and the same suite
ran 21/21._

## Files Created/Modified

- `src/pages/es/about.astro` - Spanish About page
- `src/pages/es/privacy.astro` - Spanish Privacy page, accurate Umami disclosure from the start
- `src/pages/es/terms.astro` - Spanish Terms page, obligation-parity preserved
- `src/pages/es/contact.astro` - Spanish Contact page, `localizedArticleView`-driven rail
- `src/pages/es/changelog.astro` - Spanish changelog chrome, untranslated `lang="en"` entries
- `src/pages/privacy.astro` - corrected Umami/location disclosure (English)
- `docs/phase-06/spanish-pages-review.md` - review packet + recorded approval
- `tests/unit/es-static-pages.test.mjs` - new, 14 tests

## Decisions Made

See `key-decisions` in the frontmatter. In brief: the English Privacy's conflated
Cloudflare/analytics claim was split into two accurate sections rather than patched in place; the
Umami disclosure deliberately claims only country/region, not city, since city-level accuracy on
this specific instance hasn't been verified; and both new rails (`/es/changelog`, `/es/contact`)
use the now-available `localizedArticleView` real-data pattern rather than the English-fallback-
only approach 06-05's `/es/index.astro` used before `articlesEs` existed.

## Deviations from Plan

None — plan executed exactly as written, including a genuine (not approximated) TDD RED/GREEN
cycle for Task 2.

## Issues Encountered

None. Both real builds (RED-state with `es/changelog.astro` absent, and GREEN-state restored)
succeeded on the first attempt with the exact expected page counts (101,439 then 101,440).

## User Setup Required

None — no external service configuration required. The Umami instance (`stats.915websites.com`)
was already live and provisioned per 06-05 (D-11); this plan only corrected what the Privacy
pages say about it.

## Next Phase Readiness

- All five Spanish static page types now exist and are human-approved, closing the static-page
  half of I18N-04 for this project.
- `docs/phase-06/spanish-pages-review.md`'s "Reviewer decision" pattern (a dedicated packet per
  plan, edited in place once resolved) is available as a template for any future D-16-style
  human-content-approval gate.
- I18N-10 still needs 06-16's live confirmation that the Umami instance exposes a Languages
  report before the requirement can be marked complete (unchanged from 06-05's own flagged
  assumption) — this plan only fixed the DISCLOSURE accuracy, not that separate confirmation.
- No blockers for subsequent plans. 06-10 (Spanish listing pages, category/tag/source/404) was
  executed concurrently in this same repo and is unaffected by this plan's files.

---
*Phase: 06-bilingual*
*Completed: 2026-10-04*

## Self-Check: PASSED

All files created/modified verified present on disk (`src/pages/es/about.astro`,
`src/pages/es/privacy.astro`, `src/pages/es/terms.astro`, `src/pages/es/contact.astro`,
`src/pages/es/changelog.astro`, `src/pages/privacy.astro`,
`docs/phase-06/spanish-pages-review.md`, `tests/unit/es-static-pages.test.mjs`). All three task
commits (`c970433`, `c2428b3`, `a815470`) confirmed present in `git log --oneline --all`. Build
and test results (101,439/101,440 pages, 21/21 unit tests, 5/5 regression tests) independently
re-derived from this session's own command output, not asserted from memory.
