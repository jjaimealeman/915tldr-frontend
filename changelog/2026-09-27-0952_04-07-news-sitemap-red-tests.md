# 2026-09-27 - Failing tests for the Google News sitemap and general sitemap (04-07 Task 3, RED)

**Keywords:** [TESTING] [SEO] [FEATURE]
**Session:** Morning, Duration (~10 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-27-0952_04-07-news-sitemap-red-tests.md`

## What Changed

- File: `tests/unit/news-sitemap.test.mjs` (new)
  - Behavior cases against `src/lib/seo-feeds.ts`'s `selectNewsWindow`/`newsSitemapXml`: an
    article at exactly `now - NEWS_WINDOW_SECONDS` is included, one second older is excluded, a
    future-dated article is included; 1,500 in-window articles return exactly the 1,000 newest,
    newest-first with a uuid-ascending tiebreak; input array is never mutated; `&`/`<` in titles
    are escaped; one `<url>` per entry; a zero-entry list renders a valid, empty `<urlset>` (a
    quiet news day is not a loader failure); both the sitemap 0.9 and Google News 0.9 namespaces
    are present.
  - Dist-output cases (skip if `dist/client` unbuilt): `news-sitemap.xml` exists, parses, every
    `<loc>` maps to a real built article page, and every `<news:publication_date>` is within 48h
    of `/version.json`'s `builtAt`; `sitemap-index.xml` exists with at least one child sitemap;
    across all children, total URL count equals the built HTML file count minus `404.html`, no
    trailing slashes except the root, and `/404` never appears.

## Why

04-07-PLAN.md Task 3 is `tdd="true"`: SEO-03 (Google News sitemap) and SEO-04 (general sitemap)
need their own RED-first tests before `src/pages/news-sitemap.xml.ts` and `astro.config.mjs`'s
`@astrojs/sitemap` integration are implemented.

## Issues Encountered

The plan's own pure-selector functions (`selectNewsWindow`, `newsSitemapXml`) were already
implemented in the prior Task 2 commit (04-07-PLAN.md's own file split puts all of
`src/lib/seo-feeds.ts` in Task 2, not Task 3) — so those specific cases pass immediately at RED
time, which is expected and not a false-RED signal. The three genuinely new-behavior cases (the
dist-output checks for `news-sitemap.xml` and `sitemap-index.xml`, which this task's
implementation doesn't exist yet to produce) were confirmed to fail before this commit: the
current `dist/client`'s `news-sitemap.xml`, `sitemap-index.xml`, `sitemap-0.xml` and
`sitemap-1.xml` (built during Task 2's own verification, before this task's `astro.config.mjs`
change was written) were temporarily moved out of `dist/client` (`mv`, not `rm` — restored
immediately after), the suite was re-run and showed exactly the expected `ENOENT`/assertion
failures on those three cases, then the files were moved back.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `node --test tests/unit/news-sitemap.test.mjs` twice — once against the
  temporarily-reduced `dist/client` (RED: 3 failures, exactly the dist-output cases; the 10
  pure-selector cases still passed) and once restored (11/13 passing at this point, pending the
  GREEN commit's `pnpm run build` to regenerate the moved files).
- What wasn't tested: nothing yet built by this commit — `src/pages/news-sitemap.xml.ts` and the
  `astro.config.mjs` sitemap integration land in the next (GREEN) commit.
- Edge cases: covered by the behavior list above, taken directly from 04-07-PLAN.md Task 3's own
  `<behavior>` block.

## Next Steps

- [ ] GREEN commit: implement `src/pages/news-sitemap.xml.ts` and add `@astrojs/sitemap` to
      `astro.config.mjs`'s `integrations` array with a filter excluding non-HTML endpoints and 404

---

**Branch:** feature/phase-04
**Issue:** N/A
**Impact:** LOW - test-only commit, no behavior change
