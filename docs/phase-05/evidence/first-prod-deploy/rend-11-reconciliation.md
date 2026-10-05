# REND-11 reconciliation — the 12-directory and 4-control-file gaps, explained file by file

Produced 2026-10-01, reconciling the orchestrator-supplied real build log
(`build-241c97e1-archive-lines.log`, `build-241c97e1-wrangler-window.log`) against a local
reproduction. Three numbers from the real production build (`241c97e1`, commit `57dfa94`):

| Source | Number |
|---|---|
| `assert-file-count.mjs`'s own gate count (`/static-budget.json`, logged mid-build) | **29,966** |
| wrangler's own `✨ Read N files from the assets directory` console line | **29,978** |
| wrangler's own upload accounting (`Found 2 new... Success! Uploaded 2 files (29960 already uploaded)`) | 2 + 29,960 = **29,962** |

Neither gap (`29,978` vs `29,966`, and `29,966` vs `29,962`) is a bug. Both are now explained
file by file.

## Gap 1 — wrangler's "Read N files" line counts directories, not just files (29,978 − 29,966 = 12)

Reproduced locally: `pnpm exec wrangler deploy --dry-run --config wrangler.jsonc --outdir
.wrangler/ci-dry-run` with `WRANGLER_LOG=debug` prints every path its own asset-directory walk
visits. Classifying each printed path against the real filesystem (`fs.statSync`) on this
session's local `dist/client` (29,940 real files, confirmed via both `find -type f` and
`assert-file-count.mjs`'s own `countStaticFiles()`):

```
Read 29952 files from the assets directory .../dist/client   <- wrangler's own line
29952 total printed paths = 29940 real files + 12 directories
```

The 12 directories wrangler's debug walk prints as standalone entries before recursing into
them (confirmed on disk, all 12 are real directories, not files):

```
/_astro  /business  /community  /crime  /education  /fonts
/health  /politics  /source  /sports  /tag  /weather
```

This is wrangler's own CLI message counting raw `readdir()` entries (directories included)
rather than leaf files alone — a cosmetic quirk in its console output, not an asset-count
discrepancy. The gap size (12) matches exactly between this local reproduction (29,952 − 29,940)
and the real production build (29,978 − 29,966) — the same fixed set of top-level category/
asset directories exists in both, since they come from the same source code and routing config,
not from data that differs build to build.

**The real per-build file total wrangler's walk actually found is `29,978 − 12 = 29,966`** —
which equals the gate's own count exactly, with zero drift.

## Gap 2 — four root-level control files are read but deliberately never served (29,966 − 29,962 = 4)

Confirmed present at `dist/client`'s root (real files, not directories):

| File | Why it's excluded from the served/uploaded asset set |
|---|---|
| `.assetsignore` | The ignore-rules file itself — Workers Static Assets reads it as configuration, never serves it as content. |
| `_headers` | Parsed into the deployed Worker's `script_runtime.assets.headers` config (confirmed earlier this session via the Workers Versions API — `raw_headers: "/_astro/*\n  Cache-Control: ..."`), not served as a literal response body. |
| `_redirects` | Parsed into `script_runtime.assets.redirects` config (same Versions API confirmation — `raw_redirects: "/categories / 301\n..."`), not served as a literal response body. |
| `wrangler.json` | Present in `dist/client` (an `@astrojs/cloudflare` build-output artifact) and explicitly listed inside `dist/client/.assetsignore`'s own two ignore lines (`wrangler.json`, `.dev.vars` — the latter doesn't exist in `dist/client`, so that line is a no-op here). |

`29,966 (gate count) − 4 (control files) = 29,962` — **exactly** wrangler's own reported
upload-accounting total (`2 new + 29,960 already uploaded`).

## Verdict

The gate's conservative count is **over** wrangler's real served-asset total by exactly 4, every
one of the 4 named above, and never under. This is precisely the shape the plan's own must_haves
require ("it may only be over, never under," "explained file by file"). **REND-11's precision
bar is met — no code fix is needed.** `assert-file-count.mjs`'s `countStaticFiles()` is correctly
implemented as documented (every regular file counted, directories excluded, no filtering) — the
12-file "gap" was a misreading of wrangler's own debug console line, not a defect in this
project's code.
