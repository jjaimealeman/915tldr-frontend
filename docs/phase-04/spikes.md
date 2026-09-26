# Phase 4 Spikes — measured results

Recorded 2026-09-26 during 04-01 (Task 3). Every number below is measured against a real `pnpm
run build` / real live deployment, not projected.

## Spike 1 — Loader throw propagation

**Question (04-RESEARCH.md Open Question 1 / Assumption A1):** does a thrown error inside a
Content Layer `Loader.load()` actually fail `astro build` with a non-zero exit code, the same way
a `getStaticPaths()` throw does (proven in Phase 3)?

**Command:**
```bash
CLOUDFLARE_API_TOKEN=invalid-token-for-spike pnpm run build
```

**Exit code:** `1` (non-zero)

**The failing line** (`fetchPublicArticlesWindow` -> `queryD1WithMeta` -> D1 REST 401, thrown
inside `articlesLoader().load()`):
```
d1-client: D1 REST API responded 401 Unauthorized: {"result":null,"success":false,"errors":[{"code":10000,"message":"Authentication error"}],"messages":[]}
  Location:
    /home/jaime/www/_github/915tldr.com/src/lib/server/d1-client.ts:57:9
  Stack trace:
    at queryD1WithMeta (/home/jaime/www/_github/915tldr.com/src/lib/server/d1-client.ts:57:9)
    at async fetchPublicArticlesWindow (/home/jaime/www/_github/915tldr.com/src/lib/server/d1-client.ts:146:63)
    at async Promise.all (index 0)
    at async run (.../p-queue/dist/index.js:400:36)
[ELIFECYCLE] Command failed with exit code 1.
```

**Conclusion:** YES — a throw inside a real Content Layer `Loader.load()` fails `astro build`
identically to a `getStaticPaths()` throw: non-zero exit (`1`), the failing line names the
`d1-client` module specifically (not a generic Astro sync-phase wrapper message), and no output is
written. Assumption A1 is CONFIRMED. REND-02/REND-03's fail-loud guarantee can rest on a Loader
throw exactly as designed — no fallback to a `getStaticPaths()`-level check is needed for this
guarantee.

**Secondary finding (not a bug):** the D1-import assertion's zero-candidate guard
(`tools/assert-no-d1.mjs`) also fired in this run, because the build aborted during the content-sync
phase, before any page/island candidate was ever walked. This is the guard working as designed
(D-06: a guard that matches nothing must fail loudly) — it is a second, independent signal that
the build never reached page generation, consistent with the loader throw happening as early as
intended, not a false positive introduced by this spike.

## Warm window cost

**Command:** `pnpm run build` (credentials from the shell env, real D1/KV, warm
`node_modules/.astro` content-layer cache from a prior build)

**Date:** 2026-09-26

| Metric | Value |
|---|---|
| Synced (public articles in the 3-day window) | 324 |
| Changed (digest differed from the cached store) | 0 |
| Removed (present in the store, no longer public) | 0 |
| `rowsRead` (D1, summed across every statement) | 5,926 |
| Total build wall time (`pnpm run build`, includes `guard:config` + `astro build`) | 6.16s |
| Astro's own reported page-build time | 4.23s (328 pages) |

**Reading this:** `changed=0` on a warm-cache run is the loader's digest-based skip working
correctly — the content-layer store persisted across builds (Workers Builds build caching, per
D-06, is expected to cover exactly this directory) already held every synced article at its
current digest, so zero manifest writes were issued. `rowsRead=5,926` for a 3-day, ~324-article
window is comfortably inside PROJECT.md's daily budget (2,000,000 soft / 5,000,000 hard) even
before accounting for the 12-cycles-a-day multiplier a steady-state cron would apply — 5,926 x 12
= 71,112/day, 0.036x the soft budget. This is the incremental-window shape doing exactly what
Phase 3's binding constraint required (never re-scan the full ~957,008-row corpus every cycle).

**Not measured here:** a genuinely cold-cache first build (no `node_modules/.astro` at all) would
cost more — `synced` would be every public article in the window on the first pass, and the loader
has no "first sync vs. warm sync" distinction that changes its query shape (the window is always
`[now - SYNC_WINDOW_SECONDS, now)`, cold or warm). A cold build's `rowsRead` is bounded by the same
window-scoped query, so it should not exceed the warm figure by more than the corpus's true article
count in that window — not separately spiked in this task, since `rm -rf` (needed to force a truly
empty cache) is a sandbox-blocked operation in this execution environment. Listed under Cleanup
needed in 04-01-SUMMARY.md for a follow-up manual run.

## Trailing slash

**Question (CONTEXT.md discretion item / RESEARCH.md Common Pitfall 2):** with `trailingSlash:
'never'` + `build.format: 'file'`, does `/path` -> 200 and `/path/` -> a single redirect to
`/path`, and what status code does Cloudflare's native `html_handling` actually emit?

**Measured live** against a real deployed article path on `dev.915tldr.com` (Task 1, re-confirmed
during this task):

| Request | Result |
|---|---|
| `GET /weather/el-paso-faces-heavy-rain-and-flood-warnings-this-friday-0a0e5d74-...` | `200`, no `Location` header |
| `GET /weather/el-paso-faces-heavy-rain-and-flood-warnings-this-friday-0a0e5d74-.../` | `307`, `Location:` resolves to the exact no-slash path |

**Named deviation from CONTEXT.md's literal wording:** CONTEXT.md's discretion item asks for "a
single **301** to `/path`". The measured status is **307**, not 301. This matches
04-RESEARCH.md's Common Pitfall 2 finding exactly: Cloudflare's native `html_handling` modes
(`auto-trailing-slash` and its siblings) document their redirect as 307 in every mode — there is no
native configuration that emits 301, and getting a real 301 would require routing every
trailing-slash-mismatched request through the Worker (`run_worker_first`), which this project
deliberately avoids for cost/architecture reasons (every such request would cost a Worker
invocation this design otherwise keeps at zero for the static asset layer).

This is recorded here, plainly, as a named deviation for the end-of-phase owner review — not
silently accepted and not silently "fixed" by adding a Worker-mediated redirect path. 307 is not
an SEO problem in practice (search engines consolidate ranking signals through a redirect chain
regardless of the 301-vs-307 status code), but it is not what CONTEXT.md asked for word-for-word,
and RESEARCH.md's own Assumption A3 flagged this exact gap as worth surfacing rather than assuming
away.
