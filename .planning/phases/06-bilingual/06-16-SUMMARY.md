---
phase: 06-bilingual
plan: 16
subsystem: verification
tags: [live-verification, playwright, i18n, hreflang, umami, archive-tier]
requires:
  - phase: 06-bilingual (06-15)
    provides: "the bilingual build live on dev.915tldr.com"
provides:
  - "tests/integration/browser-journeys.test.mjs: real-Chromium Journeys A-C and the keyboard check (14/14 live)"
  - "tests/integration/url-shapes.test.mjs: live /es URL contract (90/90 live)"
  - "docs/phase-06/live-verification.md and docs/phase-06/evidence/ (5 screenshots)"
  - "D-09 recorded in .planning/PROJECT.md (/es is public from day one; language data informs promotion)"
key-decisions:
  - "Task 3 answered by Jaime from his phone on 2026-10-04: the switcher works (Español and 'Read in English' both switch); the Umami dashboard showed the /es page views but no Languages panel."
  - "I18N-10 is provisionally NOT met: Jaime saw no Languages panel. The Umami Filter and Breakdown views were not checked. If confirmed, D-11's aggregate-bucket counter goes to a gap plan."
requirements-completed: []
---

# Phase 6 Plan 16: Live verification on dev.915tldr.com Summary

**Status:** complete with two defects found and one open requirement. Summary written by the orchestrator (the executor stopped at the Task 3 checkpoint).

## Results

| Check | Result |
|---|---|
| Journey A: English article, header Español, `/es` canonical with `lang="es"`, first rail card stays in `/es`, Read in English returns | pass, real Chromium locator clicks |
| Journey B: `/es`, Crimen, first card | pass |
| Journey C (D-13): es-MX browser with `Accept-Language` | `/`, `/crime`, an article all 200, `lang="en"`, one navigation, no redirect |
| Keyboard: Tab 3 reaches Español, 3px focus ring not clipped | pass (desktop; screenshot) |
| `browser-journeys.test.mjs` | 14/14 (10 existing, 4 new) |
| `url-shapes.test.mjs` | 90/90, including the T-04-48 guard |
| Archived `/es` article via the Worker | `Server-Timing: archive;desc=r2`, then `edge-cache`; `lang="es"` |
| Wrong-category `/es` URL | one 301 to the `/es` canonical |
| `/es/` | 307 to `/es` (documented static-assets behaviour, not 301) |
| Feeds | `/es/rss.xml` `es-us`; Spanish sitemap `<loc>` all start `https://915tldr.com/es` (20,123); news sitemap `es` |
| Jaime's phone, `/es/community/...` | fallback note "No disponible en español todavia." for an untranslated article (correct D-05 behaviour) |

## Defects found

1. **Archived English pages unstyled during the upload backlog.** They referenced the previous build's stylesheet (404). 25/25 archived tags and 2/25 archived articles were affected at ~20:00 MDT. **Resolved**: the backlog drained in the 02:07Z build (see 06-15) and `/tag/1099-forms` now points at the current stylesheet (200). Only a sample was re-checked.
2. **Spanish category nav unstyled on every `/es` page** (plain bulleted list). Cause: CSS selected `nav[aria-label="Sections"]`; the Spanish label is "Secciones". **Fixed in code** on `feature/phase-06-gaps` (`908ee79`: `data-site-nav="sections"` hook, 7 selectors changed, regression guard `tests/unit/css-no-translated-selectors.test.mjs`, live layout test). Simulation in Chromium showed the fix; the live test is **red on `/es` until deployed**. Confirmed on Jaime's phone before the fix.

## Open items

- Deploy the nav fix (merge `feature/phase-06-gaps` to `develop` to `main`) and run `node --test --test-name-pattern="06-16 gap" tests/integration/browser-journeys.test.mjs`; expect green.
- I18N-10 (Umami language report): not seen on the dashboard. Check Filter/Breakdown; otherwise route D-11's counter to a gap plan.
- Not checked: mobile viewports beyond Jaime's own phone look, screen reader, Safari/Firefox, Lighthouse on `/es`.
- Mockups under `design/` still use the English `nav[aria-label="Sections"]` selector; they test the English-only Phase 1 HTML, so unaffected.
