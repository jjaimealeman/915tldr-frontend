# 2026-10-03 - 06-05 Task 2 (GREEN): Spanish dates, ArticleCard language props, the reserved /es route and the Umami tag

**Keywords:** [FRONTEND] [BACKEND] [FEATURE] [I18N] [TESTING] [ACCESSIBILITY] [SECURITY]
**Session:** Morning, Duration (~50 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-10-03-1048_06-05-task2-green-spanish-dates-card-props-umami-tag.md`

## What Changed

- File: `src/lib/format.ts`
  - `FormatBylineTimeOptions` gained an optional `language: 'en' | 'es'` (default `'en'`);
    `formatDateline` gained a second `language` parameter (default `'en'`)
  - Spanish output is built from fixed arrays (`ES_MONTHS_ABBR`, `ES_MONTHS_FULL`,
    `ES_WEEKDAYS_FULL`), never `Intl`'s own locale-specific month/weekday names — same
    byte-identity reasoning as the existing `AP_MONTHS` table. English output is produced by the
    exact same code path as before, byte-identical
- File: `src/components/ArticleCard.astro`
  - New `lang?: Language` (drives `formatBylineTime`'s language) and `contentLang?: Language`
    (when it differs from `lang`, the title heading and summary paragraph carry their own
    `lang={contentLang}` — D-05's fallback-content marking)
- File: `src/lib/listing.ts`
  - Added `'es'` to `RESERVED_TOP_LEVEL` (I18N-04 adjacency — no category slug can ever collide
    with the Spanish route tree)
- File: `src/layouts/Base.astro`
  - Dateline now calls `formatDateline(epoch, lang)` instead of the English-only call
  - Added the D-11 Umami tag verbatim in `<head>`, `is:inline` + `defer` (self-hosted, cookieless;
    `is:inline` is an Astro compile-time-only directive — it does not appear in the rendered HTML)
- File: `src/pages/es/index.astro`
  - Replaced Task 1's section-level `lang="en"` wrapper with per-card `lang="es"
    contentLang="en"` on every `ArticleCard`, now that the component supports it — byline dates
    render in Spanish, while the (still-English, pending 06-06/06-10) titles/summaries stay
    correctly marked `lang="en"`
- File: `.planning/phases/06-bilingual/deferred-items.md` (new)
  - Logs the one out-of-scope discovery from this task's own verification pass: `pnpm run
    typecheck` always exits 1 in this repo (a pre-existing `astro check` vs. `astro build`
    tooling characteristic in `tools/assert-no-d1.mjs`'s own D-06 non-vacuity guard), confirmed
    via `git stash -u` against the untouched prior commit — not caused by, or fixable within,
    this task's scope

## Why

Closes 06-05-PLAN.md Task 2 (GREEN): makes the RED commit's tests pass. Spanish dates and
per-card language marking are the last piece of the `/es` home's chrome; the reserved `'es'` route
closes the I18N-04 adjacency gap structurally; the Umami tag is the entire mechanism I18N-10 (the
language-share report) depends on; the no-auto-language guard (already proven passing against the
untouched tree in the RED commit) stays load-bearing going forward.

## Issues Encountered

**[Scope note]** `pnpm run typecheck`'s exit code does not flip to 0 with this task's changes —
confirmed (via `git stash -u`) that it was already non-zero on the untouched prior commit, for a
reason unrelated to any code this task touches. Logged to `deferred-items.md`, not fixed (out of
scope per the executor's own scope-boundary rule). The real type-correctness signal — `astro
check`'s own "0 errors" diagnostics line — is unchanged by this task (0 errors before, 0 errors
after).

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `pnpm run build` (real build, 60,674 pages); every RED test from the prior
  commit now passes — `node --test tests/unit/format.test.mjs tests/unit/chrome.test.mjs
  tests/unit/no-auto-language.test.mjs tests/unit/hreflang.test.mjs tests/unit/i18n.test.mjs`
  (57/57); full `pnpm run test:fast` (876/876, no regressions); `pnpm run test:build-gate` (9/9);
  `pnpm run test:regression` (byte-identity, 5/5, including a real two-build replay against live
  production D1); live greps confirming the Umami tag count/shape and the `'es'` entry in
  `RESERVED_TOP_LEVEL`.
- What wasn't tested: the Spanish screen-reader voice-switching claim (flagged unresolved in
  06-05-PLAN.md's own "Flagged assumptions" section — deferred to 06-16's real-browser pass) and
  whether this Umami instance exposes a Languages report (same section, deferred to 06-16).
- Edge cases: the Spanish month-abbreviation table's full 12-month sweep (every month gets a
  trailing period in Spanish, unlike English's unabbreviated March–July); `formatDateline`'s
  weekday lookup via a fixed English-short-name index rather than a second Intl locale call.

## Next Steps

- [ ] 06-06 onward: add the real `articlesEs` content collection and the rest of the `/es` route
      tree (category/tag/source/article/static pages) on top of this plan's now-proven
      dictionary/hreflang/chrome/date-formatting foundation
- [ ] 06-16: confirm this Umami instance exposes a Languages report before marking I18N-10 met

---

**Branch:** feature/phase-06
**Issue:** N/A
**Impact:** MEDIUM - completes 06-05's chrome/date/analytics foundation; still no real Spanish
article content until later plans ship.
