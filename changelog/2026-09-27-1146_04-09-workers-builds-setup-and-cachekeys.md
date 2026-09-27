# 2026-09-27 - Owner setup document, incremental-build flag seam, and per-page cacheKeys (04-09 Task 2)

**Keywords:** [DOCUMENTATION] [CONFIG] [FEATURE] [SEO]
**Session:** Morning, Duration (~25 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-27-1146_04-09-workers-builds-setup-and-cachekeys.md`

## What Changed

- File: `docs/phase-04/workers-builds-setup.md` (new)
  - Six numbered, concrete-values-only steps for the owner to follow in 04-10: create the
    public `915tldr-frontend` GitHub remote (D-03); connect the repo in the Cloudflare
    dashboard with `main` as production (D-04), build command `pnpm run build:ci`, deploy
    command `pnpm run deploy:ci`, non-production branches deploying via
    `wrangler versions upload`, build caching on; the build variables to set
    (`NTFY_TOPIC` secret, optional `NTFY_SERVER`/`NTFY_TOKEN`, and
    `ASTRO_INCREMENTAL_BUILD=1` scoped to `feature/phase-04` only, never production); how to
    confirm the platform-injected `CLOUDFLARE_API_TOKEN` carries D1 read + Workers KV Storage
    edit; creating the two Deploy Hooks (`feature/phase-04` spike, `main` production) and
    handling the URLs as secrets via the gitignored `.dev.vars`
    (`DEPLOY_HOOK_URL_PHASE04`), never committed or logged; and recording the account's
    build-minute allowance/concurrency (flagged as unverified, ~360 builds/month expected).
- File: `astro.config.mjs`
  - Added `experimental: { incrementalBuild: process.env.ASTRO_INCREMENTAL_BUILD === '1' }`
    (Context7 `/withastro/docs` confirmed exact flag key and semantics) — default OFF; every
    existing key/comment preserved.
- File: `src/pages/[category]/[slug].astro`
  - `getStaticPaths()` now returns `cacheKey: \`${entry.digest}|${railFingerprint(rail)}\`` per
    article — the page's full render inputs (its own content-layer digest plus its rail
    neighbours, since a neighbour's title/slug/category change re-renders this page even when
    this article's own digest is unchanged).
- File: `src/pages/tag/[slug].astro`
  - `getStaticPaths()` now returns `cacheKey` = the page's listed articles' own digests
    (looked up via a uuid→digest map built from the real collection entries, since
    `groupByTag` operates on the plain `ArticleData` shape) joined with `|`.

## Why

D-06/RESEARCH Open Question 2: `experimental.incrementalBuild` must be provable as a flag that
can be switched on for measurement (Task 3) without committing production to it — 04-11 makes
that decision. The owner setup doc exists so 04-10's Workers Builds connection is a checklist,
not an improvised dashboard session with a live production Worker.

## Issues Encountered

`groupByTag` (src/lib/listing.ts) operates on `ArticleData`, which has no digest field of its
own — the tag page's cacheKey needed a separate uuid→digest map built from the real
`getCollection('articles')` entries before grouping, rather than reading `.digest` directly off
a grouped article.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `pnpm run build` (flag off, 59,907 pages, 2m8s) and
  `ASTRO_INCREMENTAL_BUILD=1 pnpm run build` (flag on, 59,907 pages, 2m1s) both completed with
  exit code 0; `node --test tests/unit/astro-config.test.mjs` (18/18 pass, including the ARCH-06
  imageService checks against the now-modified `astro.config.mjs`); `pnpm run guard:config`
  (no violations); the full `design/tests/unit/**` + `tests/unit/**` suite (377/377 pass,
  confirming the article/tag page edits didn't regress the existing markup/rail/JSON-LD tests).
- What wasn't tested here: whether the flag actually SKIPS re-rendering unchanged pages — that
  measurement is Task 3's job (the local incremental-build spike), not this task's.
- Edge cases: n/a — this task adds configuration and cacheKey plumbing, not new logic with
  branching behavior of its own.

## Next Steps

- [ ] Task 3: local incremental-build spike (warm checkout, flag on/off, fresh-clone CI
      simulation, byte-identity measurement)

---

**Branch:** feature/phase-04
**Issue:** N/A
**Impact:** LOW — the flag defaults off; no production build behavior changes until 04-11.
