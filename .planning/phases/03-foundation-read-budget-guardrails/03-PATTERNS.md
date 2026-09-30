# Phase 3: Foundation & Read-Budget Guardrails - Pattern Map

**Mapped:** 2026-09-22
**Files analyzed:** 12 (create/modify)
**Analogs found:** 7 / 12 (5 greenfield — see "No Analog Found")

## Repo-layout note

This repo (`915tldr.com`) currently holds **no application code** — no `src/`, no `astro.config.mjs`,
no `wrangler.jsonc`. Phase 1's `design/` tree (Node scripts + `node --test` unit tests +
Playwright e2e specs) is the only prior engineering pattern in this repo, and it sets the CLI/test
conventions Phase 3 should follow. `915tldr.com2/` (the Nuxt pipeline/admin app, sibling directory)
supplies the one real Cloudflare-config analog (`wrangler.jsonc`) and the proven D1 REST-access
pattern (`docs/phase-02/d1-access.md`), but **is not touched by this phase** — copy the shape,
never the D1-bound content.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `tools/assert-no-d1.mjs` (Vite/Rollup plugin) | build-tooling / middleware | transform (module-graph walk) | none in-repo | greenfield (Rollup/Vite plugin — see RESEARCH.md Pattern 1 for the only concrete precedent) |
| `astro.config.mjs` | config | request-response (build-time config) | none in-repo | greenfield — config shape fully specified in RESEARCH.md, no in-repo analog to diverge from |
| `wrangler.jsonc` (new Astro app, **no `d1_databases` block**) | config | request-response | `915tldr.com2/wrangler.jsonc` | role-match (same config file type, deliberately must NOT copy its D1/KV block) |
| `wrangler.jsonc` guard check script (greps for `d1_databases`) | utility / CI check | batch (static grep) | `design/scripts/verify-phase-1.mjs` | role-match (CLI script, spawns/parses, exits non-zero on violation) |
| `src/lib/server/d1-client.ts` (single D1 chokepoint) | service | CRUD (build-time D1 REST reads) | `915tldr.com2/docs/phase-02/d1-access.md` (documented pattern, not a module) | partial-match — pattern documented, no existing TS module; nearest real code is the `wrangler d1 execute --remote --json` command shape and `data[0]?.results` parsing convention |
| `src/lib/kv-manifest.ts` (render-manifest read/write) | service | CRUD (KV get/put, per-article) | none in-repo | greenfield — schema fully specified in RESEARCH.md "Render Manifest Entry Shape" |
| `tests/ci-fixtures/page-with-d1-import.astro` | test fixture | transform (negative fixture) | `design/tests/unit/fixtures/*` (fixture-dir convention) | role-match (fixture directory pattern only; content is new — `.astro`, not CSS) |
| `tests/ci-fixtures/island-with-d1-import.astro` | test fixture | transform (negative fixture) | same as above | role-match |
| `tests/ci-fixtures/assert-no-d1.test.mjs` | test | request-response (spawn + assert exit code) | `design/tests/unit/check-contrast.test.mjs` | exact-match (spawnSync a CLI/build against a fixture, assert exit status) |
| `tests/unit/manifest-schema.test.mjs` | test | CRUD (schema validation) | `design/tests/unit/check-contrast.test.mjs` (node:test structure) + `design/tests/unit/summary-markdown.test.mjs` | role-match |
| `tests/unit/build-stamp.test.mjs` | test | request-response (compare two derived surfaces) | `design/tests/unit/check-contrast.test.mjs` | role-match |
| `tools/measure-d1-pagination.mjs` (D-01 measurement harness) | utility / script | batch (paginated fetch + percentile) | `915tldr.com2/docs/phase-02/corpus-measurements.md` (nearest-rank percentile method) + `design/scripts/check-contrast.mjs` (CLI arg-parsing/report-writing shape) | role-match |
| Global stylesheet port (`src/styles/global.css` or equivalent) | config / static asset | file-I/O (copy-with-adaptation) | `design/mockups/style.css` | exact-match (D-07: ported wholesale, verbatim regions preserved) |
| `/version.json` + footer build-stamp plumbing | config / component | request-response (virtual module → two consumers) | none in-repo (Astro virtual-module pattern is new); `design/scripts/build-feed.mjs`'s "single source written to two surfaces" shape is the closest structural cousin | partial-match |
| README read-budget section (OPS-08) | docs | — | `.planning/PROJECT.md` (the budget numbers themselves) | content-source only, not a code analog |

## Pattern Assignments

### `tools/assert-no-d1.mjs` (build-tooling, transform)

**Analog:** none in-repo — greenfield. RESEARCH.md's own skeleton (Pattern 1, lines 300-338 of
`03-RESEARCH.md`) is the only concrete precedent and is explicitly flagged `[ASSUMED]`/untested
against a real Astro build. Copy that skeleton as the starting point, not a proven analog:

```javascript
// tools/assert-no-d1.mjs (skeleton from 03-RESEARCH.md Pattern 1)
const FORBIDDEN = /\/src\/lib\/server\/d1-client\.ts$/;
const ENTRYPOINT_GLOBS = [
  'src/pages/**/*.astro',
  'src/islands/**/*.astro',
  'src/middleware.ts',
];

export function assertNoD1Plugin() {
  return {
    name: 'assert-no-d1-import',
    buildEnd() {
      const moduleIds = this.getModuleIds ? [...this.getModuleIds()] : [];
      const entrypoints = moduleIds.filter((id) =>
        ENTRYPOINT_GLOBS.some((pattern) => matchGlob(id, pattern))
      );
      for (const entry of entrypoints) {
        const seen = new Set();
        const queue = [entry];
        while (queue.length) {
          const id = queue.pop();
          if (seen.has(id)) continue;
          seen.add(id);
          if (FORBIDDEN.test(id)) {
            this.error(`D1-import assertion violated: ${entry} transitively imports ${id}`);
          }
          const info = this.getModuleInfo(id);
          if (!info) continue;
          queue.push(...(info.importedIds ?? []));
          queue.push(...(info.dynamicallyImportedIds ?? []));
        }
      }
    },
  };
}
```

**CLI/report-writing convention to borrow from `design/scripts/check-contrast.mjs` (lines 1-45):**
argument parsing via a manual `parseArgs(argv)` loop (no external arg-parser dependency), a
top-of-file comment block naming the requirement ID it satisfies and why it's hardened. Follow
this same header-comment convention for `assert-no-d1.mjs` — name ARCH-02/ARCH-03/D-05 in the
header, exactly as `check-contrast.mjs` names D-13 in its own header.

---

### `astro.config.mjs` (config)

**Analog:** none in-repo. Exact shape is given verbatim in RESEARCH.md (lines 343-358):

```javascript
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import { assertNoD1Plugin } from './tools/assert-no-d1.mjs';

export default defineConfig({
  output: 'static',
  adapter: cloudflare({
    imageService: { build: 'compile', runtime: 'passthrough' },
  }),
  vite: {
    plugins: [assertNoD1Plugin()],
  },
});
```
No in-repo file to diverge from; treat RESEARCH.md as the source of truth here, not a codebase
analog.

---

### `wrangler.jsonc` (new Astro app)

**Analog:** `915tldr.com2/wrangler.jsonc` (role-match, config file shape) — copy the top-level
shape (`$schema`, `name`, `main`/`assets`, `compatibility_date`, `compatibility_flags`,
`observability`) but **omit the `d1_databases` block entirely**:

```jsonc
// 915tldr.com2/wrangler.jsonc:1-38 (DO NOT copy d1_databases or kv_namespaces verbatim —
// this is what to structurally imitate, not duplicate)
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "915tldr",              // new app needs its own distinct name
  "main": "dist/server/index.mjs",
  "compatibility_date": "2026-07-18",
  "compatibility_flags": ["nodejs_compat"],
  "assets": { "directory": "dist/public", "binding": "ASSETS" },
  "d1_databases": [ /* ... DO NOT COPY — the new app must have zero D1 binding ... */ ],
  "kv_namespaces": [ /* create a NEW dedicated namespace per RESEARCH.md Open Question 2,
                          do not reuse the existing KV/CACHE ids verbatim */ ],
  "observability": { "enabled": true }
}
```

---

### `wrangler.jsonc` guard-check script (Known Threat Pattern mitigation)

**Analog:** `design/scripts/verify-phase-1.mjs` (lines 1-38) — CLI script structure: shebang,
requirement-ID comment header explaining what it guards and why, `spawnSync`/file-read based
verification, hard-coded forbidden-string list as a top-level constant (mirrors `FORBIDDEN_FACES`
at line 27):

```javascript
// design/scripts/verify-phase-1.mjs:27-29 — the pattern to copy for a forbidden-string guard
const FORBIDDEN_FACES = ['Playfair Display', 'Merriweather'];
```
Apply the same shape: a `FORBIDDEN_KEYS = ['d1_databases']` constant, grep `wrangler.jsonc`,
exit non-zero if found. Wire into the same test-runner convention as `check:contrast`/`verify:phase-1`
npm scripts in `package.json`.

---

### `src/lib/server/d1-client.ts` (D1 chokepoint)

**Analog:** no existing module — the proven pattern is documented, not coded, in
`915tldr.com2/docs/phase-02/d1-access.md` (lines 30-71). Concrete elements to carry over:

```bash
# 915tldr.com2/docs/phase-02/d1-access.md — the exact proven command/auth shape
wrangler d1 execute 915tldr-db --remote --command "SELECT COUNT(*) AS n FROM articles" --json
```
- Auth: `CLOUDFLARE_API_TOKEN` read from the environment only — never logged, never written to
  any file (per OPS-11, confirmed at d1-access.md:33-34).
- Response shape: rows nest one level under `<top-level-array>[0].results` — any new fetch-based
  reader (this module will use the D1 REST API via `fetch()`, per RESEARCH.md, not the wrangler
  CLI) must match this same `data[0]?.results` unwrapping convention.
- This module is a build-time-only Node loader (`astro/loaders` Loader), never imported by
  runtime/Worker code — enforced by `assert-no-d1.mjs`.

---

### `src/lib/kv-manifest.ts` (render manifest)

**Analog:** none in-repo — schema is fully specified in RESEARCH.md "Render Manifest Entry Shape"
(lines 493-507):

```typescript
interface ManifestEntry {
  articleId: string;
  spanishCounterpartId: string | null;
  contentHash: string;
  renderVersion: string;
  renderedAt: string;
  buildHash: string;
  category: string;
  publishedAt: number;
}
```
Bulk-write via the KV bulk REST endpoint (up to 10,000 pairs/call) rather than per-key writes —
see RESEARCH.md "Don't Hand-Roll" table and the `wrangler kv bulk put` example at line 517.

---

### `tests/ci-fixtures/assert-no-d1.test.mjs` (D-06 permanent negative fixtures)

**Analog:** `design/tests/unit/check-contrast.test.mjs` (lines 1-40) — exact structural match:
`node:test` + `spawnSync` against the real script/build, asserting on `{ status, stdout, stderr }`:

```javascript
// design/tests/unit/check-contrast.test.mjs:1-26 — pattern to copy directly
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const SCRIPT = 'design/scripts/check-contrast.mjs';
const FIXTURES = 'design/tests/unit/fixtures';

function run(fixture, extraArgs = []) {
  const outFile = path.join(mkdtempSync(path.join(tmpdir(), 'contrast-')), 'out.md');
  const result = spawnSync(
    process.execPath,
    [SCRIPT, '--css', path.join(FIXTURES, fixture), '--out', outFile, ...extraArgs],
    { encoding: 'utf8' }
  );
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '', outFile };
}
```
For Phase 3: replace the `SCRIPT`/args with an invocation of `astro build` (or the plugin
directly) against the fixture tree under `tests/ci-fixtures/`, and assert `status !== 0` for both
`page-with-d1-import.astro` and `island-with-d1-import.astro`. Fixture-directory convention
(`design/tests/unit/fixtures/`) maps directly to `tests/ci-fixtures/`.

---

### `tests/unit/manifest-schema.test.mjs`, `tests/unit/build-stamp.test.mjs`

**Analog:** same `node:test` + `assert/strict` structure as `check-contrast.test.mjs` and
`design/tests/unit/summary-markdown.test.mjs`. No spawning needed for pure schema/shape
assertions — a plain `import` + `assert.deepEqual`/`assert.equal` suffices, following the
node:test idiom already established (no Jest/Vitest anywhere in this repo — do not introduce one).

---

### `tools/measure-d1-pagination.mjs` (D-01 measurement #3)

**Analog:** structural hybrid of two files:
1. `915tldr.com2/docs/phase-02/corpus-measurements.md:23` — nearest-rank percentile method
   (`"percentiles computed in this script via nearest-rank (D1/SQLite has no percentile
   function)"`) — reuse this exact method, do not pull in a stats library (see RESEARCH.md
   "Don't Hand-Roll").
2. `design/scripts/check-contrast.mjs`'s CLI shape (`parseArgs`, `--out` report writing) for
   how the harness should report its numbers to a file rather than only stdout.

RESEARCH.md itself provides the concrete fetch loop (lines 547-573) — treat that as the
authoritative starting code, not an in-repo file.

---

### Global stylesheet port (D-07)

**Analog:** `design/mockups/style.css` (exact-match — this is a wholesale port per D-07, not a
new pattern). The file's own header comment states the contract Phase 3 must honor verbatim:

```css
/* design/mockups/style.css:1-9 */
/*
  915 TLDR - production token layer + component CSS (Phase 1 tracer, 01-02).

  Layout contract (fixed here; Phase 3 copies it verbatim):
    1. the fonts region, generated by build-fonts.mjs (Task 2).
    2. the tokens region - exactly two rules: :root (light) and
       [data-theme="dark"] (dark overrides only). Each declaration sits on
       its own line; comment lines and blank lines are also permitted.
    3. Component CSS, mobile-first (D-07).
*/
```
Astro components must emit the same class names/DOM shape as `design/mockups/{index,category,
article,changelog,contact}.html` (per D-07) — do not restructure into scoped component styles.

---

## Shared Patterns

### CLI script header-comment convention
**Source:** `design/scripts/check-contrast.mjs:1-7`, `design/scripts/verify-phase-1.mjs:1-4`,
`design/scripts/build-feed.mjs:1-16`
**Apply to:** every new script under `tools/` and `design/scripts/`
Every script opens with a comment naming the requirement ID(s) it satisfies and *why* it exists
(not just what it does) — e.g. "D-13 hardened gate: ... Phase 3 CI guard (01-CONTEXT.md)." Carry
this into `tools/assert-no-d1.mjs`, the `wrangler.jsonc` guard script, and
`tools/measure-d1-pagination.mjs`: name ARCH-02/03/D-05/D-06 or D-01/D-02 respectively.

### Manual argv parsing, no dependency
**Source:** `design/scripts/check-contrast.mjs:32-44`, `design/scripts/verify-phase-1.mjs:16-24`
**Apply to:** all new CLI scripts (`assert-no-d1.mjs` if it takes flags, `measure-d1-pagination.mjs`)
A hand-rolled `parseArgs(argv)` loop matching both `--flag value` and `--flag=value` forms — no
`yargs`/`commander` dependency anywhere in this repo; do not introduce one.

### `node:test` + `spawnSync` for CLI/build-invocation tests
**Source:** `design/tests/unit/check-contrast.test.mjs:1-26`
**Apply to:** `tests/ci-fixtures/assert-no-d1.test.mjs` (exact-match use), and any other test that
must exercise a real script/build rather than an internal function.

### Percentile computation without a stats library
**Source:** `915tldr.com2/docs/phase-02/corpus-measurements.md:23` (nearest-rank method)
**Apply to:** `tools/measure-d1-pagination.mjs`

### Credential handling
**Source:** `915tldr.com2/docs/phase-02/d1-access.md:30-34` (OPS-11 precedent)
**Apply to:** `src/lib/server/d1-client.ts`, `tools/measure-d1-pagination.mjs` — read
`CLOUDFLARE_API_TOKEN` from environment only; never log it, never write it to any file or test
fixture.

## No Analog Found

Files with no close match in the codebase — planner should build directly from RESEARCH.md's
specified shapes rather than a codebase analog:

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `tools/assert-no-d1.mjs` | build-tooling | transform | No Vite/Rollup plugin exists anywhere in this repo; RESEARCH.md Pattern 1 skeleton is the only precedent and is explicitly untested |
| `astro.config.mjs` | config | request-response | First Astro app in this repo — no prior `astro.config.*` to diverge from |
| `src/lib/server/d1-client.ts` | service | CRUD | No TS module exists yet doing D1 REST reads from Node; only a documented CLI/curl pattern exists (Phase 2 doc) |
| `src/lib/kv-manifest.ts` | service | CRUD | No KV read/write code exists in this repo (KV usage so far is Nuxt-app-only, in the untouched sibling repo) |
| `/version.json` + footer build-stamp virtual module | config/component | request-response | No Astro virtual-module pattern exists in this repo yet; RESEARCH.md's `WORKERS_CI_COMMIT_SHA` code example (lines 526-536) is the only precedent |

## Metadata

**Analog search scope:** `/home/jaime/www/_github/915tldr.com` (root, `design/`, `.planning/`),
`/home/jaime/www/_github/915tldr.com2` (`wrangler.jsonc`, `docs/phase-02/*.md` only — per
CONTEXT.md's explicit "not touched" boundary, no source code from that repo was treated as a
copyable analog beyond its documented D1-access shape).
**Files scanned:** `package.json`, `design/scripts/*.mjs` (5 read), `design/tests/unit/*.test.mjs`
(1 read in full, 2 more listed), `design/mockups/style.css` (header + structure), `915tldr.com2/
wrangler.jsonc` (full), `915tldr.com2/docs/phase-02/d1-access.md` (full).
**Pattern extraction date:** 2026-09-22
