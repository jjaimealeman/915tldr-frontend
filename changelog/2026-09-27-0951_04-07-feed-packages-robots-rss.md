# 2026-09-27 - Feed packages installed; v1's intended robots.txt policy shipped; /rss.xml built (04-07 Task 2)

**Keywords:** [FEATURE] [SEO] [DEPENDENCIES] [SECURITY] [TESTING] [BACKEND]
**Session:** Morning, Duration (~35 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-27-0951_04-07-feed-packages-robots-rss.md`

## What Changed

- File: `package.json`, `pnpm-lock.yaml`
  - Added `@astrojs/rss@4.0.19` and `@astrojs/sitemap@3.7.4` (exact pins, no carets). Owner
    approved both in the orchestrator session on 2026-09-27, after `@astrojs/sitemap` was flagged
    SUS ("too-new") by 04-RESEARCH.md's package-legitimacy audit. Re-verified against the live npm
    registry immediately before install (`npm view <pkg> version`) — both matched the
    owner-approved versions exactly.
- File: `src/lib/seo-feeds.ts` (new)
  - `RSS_ITEM_COUNT` (30, v1 parity), `NEWS_WINDOW_SECONDS` (172,800 = 48h), `NEWS_MAX_URLS`
    (1,000), `escapeXml`, `selectNewsWindow` (newest-first, uuid-ascending tiebreak, capped),
    `newsSitemapXml` (Google News 0.9 namespace). Pure module, no `astro:content`/D1/KV import —
    matches `src/lib/listing.ts`'s established pattern so it is unit-testable under plain
    `node --test`.
- File: `public/robots.txt` (new), `tests/fixtures/v1-robots.txt` (new)
  - Ships v1's *intended* per-bot policy (`Content-signal: search=yes,ai-input=yes,ai-train=no`,
    ~25 named user-agents, AI-training bots disallowed) — the rendered body of v1's
    `server/routes/robots.txt.ts` — with only the `Sitemap:` lines changed to point at the new
    `sitemap-index.xml` and `news-sitemap.xml`. See "Why" below: this is NOT what production
    currently serves.
- File: `src/pages/rss.xml.ts` (new)
  - `GET` endpoint via `@astrojs/rss`: 30 newest public articles (`sortNewestFirst` from
    `src/lib/listing.ts`), `trailingSlash: false` (required separately from the project-level
    `astro.config.mjs` key — `@astrojs/rss` does not read it), `customData` carrying
    `<language>en-us</language>`, per-item `source: {url, title}` matching v1's
    `<source url="siteUrl">{sourceName}</source>`. `@astrojs/rss` derives
    `<guid isPermaLink="true">` from each item's own `link` automatically — already
    byte-for-byte the same shape v1 hand-wrote, confirmed by reading the package's own source
    (`node_modules/@astrojs/rss/dist/index.js`) rather than assumed.
- File: `tests/unit/seo-surfaces.test.mjs` (new)
  - Against real `dist/client` output: robots.txt matches the fixture line-for-line except
    `Sitemap:` lines; Content-signal and every named AI-training bot's `Disallow: /` present;
    rss.xml has <= 30 items, every `<link>`/`<guid>` starts with the production origin, carries no
    trailing slash, and maps to a real page this same build produced; channel title/description/
    language match v1.

## Why

SEO-05/SEO-06: carry v1's robots.txt and RSS feed forward as static, build-time artifacts (zero
D1 reads on the public path) instead of v1's per-request D1 queries.

**Premise check that changed the plan's own instructions:** the plan's Task 2 action said "capture
v1's live robots.txt; if it differs from source, the live body wins." Curling
`https://915tldr.com/robots.txt` (cache-busted, verified via response headers) returned a fully
permissive `User-Agent: *\nDisallow:` — not the elaborate per-bot/AI-blocking policy in
`server/routes/robots.txt.ts`. Root cause: v1's own static `public/robots.txt` (also just
`Disallow:`) shadows its server route in Nitro's routing order, so the carefully-authored
AI-crawler-blocking policy has **never actually been served in production** — it is dead code.
Surfaced to the owner as a checkpoint (this was a real policy question, not an implementation
detail: ship what's live today, unprotected, or ship what v1 clearly intended). **Owner decision
(2026-09-27): ship the intended policy** (Option A) — a deliberate production policy change
(GPTBot/ClaudeBot/CCBot/etc. go from allowed to blocked) that takes effect once v2 serves
production, not a bug fix and not silently absorbed into "just following the live body."

## Issues Encountered

No bugs. The one real finding (robots.txt policy discrepancy above) was a plan-premise problem,
not a code problem — resolved via an owner checkpoint before any file was written, per this
project's "verify the premise" standard.

## Dependencies

Added: `@astrojs/rss@4.0.19` (RSS 2.0 feed generation, exact pin)
Added: `@astrojs/sitemap@3.7.4` (general sitemap integration, exact pin, used in Task 3)

## Testing Notes

- What was tested: full real `pnpm run build` (production D1 read-only + render-manifest KV, per
  this project's build cost rules — 59,889 pages, under the 100,000-file ceiling);
  `node --test tests/unit/seo-surfaces.test.mjs` (5/5 passing against real `dist/client/robots.txt`
  and `dist/client/rss.xml`); `diff <(grep -v '^Sitemap:' fixture) <(grep -v '^Sitemap:' built)`
  byte-identical; full `design/tests/unit/**` + `tests/unit/**` regression suite (330/330 passing,
  no regressions); `pnpm run test:build-gate` and `pnpm run guard:config` both pass.
- What wasn't tested: a live feed-reader subscription cutover check (confirming no duplicate items
  appear for an existing v1 subscriber) — that requires a real deployed comparison, out of scope
  for a build-time unit-test task.
- Edge cases: rss.xml's `source` field renders with `url` = the site origin, `title` = the
  article's source outlet name, matching v1's (slightly unusual) choice to put the *feed's own*
  URL in that attribute rather than the original article's URL — verified by reading v1's source
  directly, not assumed.

## Next Steps

- [ ] Task 3 (this plan): the Google News sitemap (48h window) and the general `@astrojs/sitemap`
      integration
- [ ] 04-07-SUMMARY.md should record the robots.txt policy discrepancy as a named, owner-approved
      deviation with a `## Threat Flags` note (production crawler policy changes on the next
      deploy)

---

**Branch:** feature/phase-04
**Issue:** N/A
**Impact:** HIGH - production robots.txt behavior changes on next deploy (AI-training bots newly
blocked); new public /rss.xml surface
