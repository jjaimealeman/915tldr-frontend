# 2026-10-07 - Umami opt-out pages (/opt-out and /es/opt-out)

**Keywords:** [FRONTEND] [I18N] [TESTING] [SEO]
**Session:** Evening, Duration (~60 minutes)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-07-2209_umami-opt-out-pages-en-es.md`

## What Changed

- File: `src/lib/opt-out.ts` (new)
  - Pure read/set/toggle over a Storage-shaped object for the `umami.disabled` key; unavailable and silently-ignored writes reported honestly
- File: `src/components/OptOut.astro`, `src/pages/opt-out.astro`, `src/pages/es/opt-out.astro` (new)
  - Status line (aria-live), one 44px button, honest scope note; noindex, no hreflang alternates, no new CSS
- File: `src/lib/i18n/dictionary.ts`
  - `optOut*` strings in English and Spanish (Spanish Claude-drafted, not human-reviewed)
- File: `src/lib/i18n/sitemap.ts`
  - `isSitemapExcludedPath` also drops the two opt-out paths
- File: `tests/unit/opt-out.test.mjs` (new), `tests/unit/news-sitemap.test.mjs`, `tests/helpers/dist-fresh.mjs`
  - Unit tests with fake storages, copy checks, source wiring, rendered-output checks gated on a fresh build; sitemap count now subtracts the two pages
- File: `tests/integration/browser-journeys.test.mjs`
  - Four live Chromium tests at 390px (toggle, reload, keyboard, no POST to Umami after opt-out, throwing storage); red until deploy
- File: `docs/phase-06/live-verification.md`
  - Task C note with the recorded red run

## Why

The owner tests a lot and cannot paste console code on a phone, so his own visits inflate Umami. The tracker skips sends when `localStorage["umami.disabled"]` is truthy; localStorage is per origin, so the page must ship with the site.

## Issues Encountered

- No local full build is allowed; rendered pages were rehearsed in an isolated scratch Astro project with the real tracker script and a stubbed endpoint, not on the real build.
- The first live run is red (404) by design until the branch is deployed.

## Dependencies

No dependencies added

## Testing Notes

- What was tested: `pnpm run test:fast` 1059 pass, 0 fail, 5 skipped (stale-dist gated); build-gate 9 of 9; `astro check` 0 errors; offline Chromium rehearsal passed for both languages
- What wasn't tested: the real built HTML, the live tracker on dev, Spanish copy by a fluent human reviewer
- Edge cases: empty-string flag counts as not opted out, "0" counts as opted out (matches the tracker)

## Next Steps

- [ ] After deploy, run the four `closeout` browser tests against dev
- [ ] Visit /opt-out once on each host the owner uses (915tldr.com, dev.915tldr.com)
- [ ] Have a fluent reviewer read the Spanish copy

---

**Branch:** feature/phase-06-closeout
**Issue:** N/A
**Impact:** LOW
