# Phase 5: Hybrid Archive & Zero-Reads Proof - Pattern Map

**Mapped:** 2026-09-30
**Files analyzed:** 11 (from RESEARCH.md's "Recommended Project Structure" + Wave 0 Gaps + CONTEXT.md's Claude's Discretion items)
**Analogs found:** 9 / 11

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/worker.ts` (extend) | route/middleware | request-response | `src/worker.ts` (itself — existing file to extend) | exact (self) |
| `src/lib/archive/tiering.ts` | utility | transform (pure functions) | `src/lib/article-redirect.ts` | exact |
| `src/lib/archive/r2-client.ts` | service | file-I/O (build-time write) | `src/lib/server/d1-client.ts` | role-match (build-time-only, credentialed, chokepoint-directory module) |
| `src/lib/server/kv-manifest.ts` (extend to v3) | model | CRUD (KV read/write) | `src/lib/server/kv-manifest.ts` (itself) | exact (self) |
| `tools/assert-file-count.mjs` | config/build-gate | batch (build-time assertion) | `tools/assert-no-d1.mjs` | exact |
| `tools/load-test-zero-reads.mjs` | test/tool | batch (scripted HTTP load test + analytics delta) | `tools/ci-build.mjs` (deps-injection + ntfy pattern) + `tools/assert-no-d1.mjs` (fail-loud discipline) | role-match |
| `tests/unit/tiering.test.mjs` | test | transform | `tests/unit/article-redirect.test.mjs` | exact |
| `tests/unit/file-count.test.mjs` | test | batch | `tests/unit/ci-build.test.mjs` (fixture-dir + injected-deps style) | role-match |
| `tests/integration/url-shapes.test.mjs` (extend) | test | request-response (live HTTP) | `tests/integration/url-shapes.test.mjs` (itself) | exact (self) |
| `wrangler.jsonc` (extend: add `r2_buckets`, manifest v3 note) | config | — | `wrangler.jsonc` (itself) | exact (self) |
| `docs/phase-05/*.md` (3 docs) | docs | — | `docs/phase-04/build-pipeline-decision.md`, `docs/phase-03/render-manifest.md` | exact |

## Pattern Assignments

### `src/worker.ts` (route, request-response) — extend

**Analog:** itself, `/home/jaime/www/_github/915tldr.com/src/worker.ts` (70 lines, read in full)

**Current shape to preserve exactly** (lines 24-55):
```typescript
export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  RENDER_MANIFEST: { get(key: string, type: 'json'): Promise<unknown> };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return env.ASSETS.fetch(request);
    }
    const url = new URL(request.url);
    const uuid = extractArticleUuid(url.pathname);
    if (!uuid) {
      return env.ASSETS.fetch(request);
    }
    let entry: unknown;
    try {
      entry = await env.RENDER_MANIFEST.get(`manifest:${uuid}`, 'json');
    } catch (err) {
      console.error(`[worker] render-manifest KV read failed for uuid ${uuid}: ...`);
      return env.ASSETS.fetch(request);
    }
    const decision = resolveRedirect(url.pathname, entry);
    if (decision.type === 'not-found') {
      return env.ASSETS.fetch(request);
    }
    return new Response(null, { status: 301, headers: { Location: ..., 'Cache-Control': 'public, max-age=3600' } });
  },
};
```

**Critical gap this exposes (RESEARCH.md, Code Examples section):** `extractArticleUuid` returns
`null` for tag paths (`/tag/<slug>`) and for already-canonical article paths — meaning archived
tag pages and archived-but-canonical article paths are NOT reachable through the existing
`if (!uuid) return env.ASSETS.fetch(request)` branch. The archive branch needs its own routing
condition, added as a new `else` path alongside the uuid branch, not nested inside it.

**Pattern to copy:**
1. Add `ARCHIVE_BUCKET: R2Bucket`-shaped binding to `Env` (mirror the two-line `ASSETS`/`RENDER_MANIFEST` interface style exactly — minimal local interface, no `@cloudflare/workers-types` dependency, confirmed absent from `node_modules`).
2. Keep the **same single KV read** — extend `ManifestEntry`/the KV payload (not a second `get()` call) with `tier`/`r2Key` per RESEARCH.md Pattern 1, and add a parallel tag-manifest read ONLY for tag-shaped paths (never both per request — still ≤1 KV read per request, just a different keyspace depending on path shape).
3. Error handling: identical try/catch-and-log-then-fall-through shape as the existing KV read (lines 43-55) — do not introduce a different error-handling convention for the R2 read.
4. Use `caches.default` per RESEARCH.md Pattern 3 (Common Pitfalls/Architecture Patterns section) to avoid paying R2 latency on every archived-page request.

---

### `src/lib/archive/tiering.ts` (utility, transform) — new

**Analog:** `/home/jaime/www/_github/915tldr.com/src/lib/article-redirect.ts` (106 lines, read in full)

**Pattern to copy — pure, side-effect-free, independently unit-testable functions:**
```typescript
// article-redirect.ts shape to mirror exactly:
export function extractArticleUuid(pathname: string): string | null { ... }
export type RedirectDecision = { type: 'redirect'; location: string } | { type: 'not-found' };
export function resolveRedirect(pathname: string, entry: unknown): RedirectDecision {
  if (!entry || typeof entry !== 'object') return { type: 'not-found' };
  // ... defensive field-by-field validation before trusting entry fields ...
}
```

For `tiering.ts`, write the equivalent pure functions named directly in RESEARCH.md's
Recommended Project Structure:
```typescript
export function isHotArticle(publishedAt: number, cutoffEpochSeconds: number): boolean { ... }
export function isHotTag(articleCount: number, threshold = 10): boolean { ... }
```
- No imports from `src/lib/server/` (the D1/KV chokepoint directory) — same module-boundary
  discipline `article-redirect.ts`'s own header comment states explicitly.
- Validate inputs defensively the same way `resolveRedirect` validates `entry` fields before
  trusting them (type checks before comparison), since these functions will be called from both
  the build-time render step and (per Pattern 1) potentially inform manifest construction.

---

### `src/lib/archive/r2-client.ts` (service, file-I/O) — new

**Analog:** `/home/jaime/www/_github/915tldr.com/src/lib/server/d1-client.ts` (first 60 lines read; file continues beyond)

**Pattern to copy — build-time-only, credentialed, chokepoint-directory module:**
```typescript
// d1-client.ts shape:
const D1_DATABASE_ID = '552ba1d1-024a-4dee-bdaa-3ffd4bdb1f77'; // hardcoded id, not env-derived

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`d1-client: ${name} is not set in the environment`);
  }
  return value;
}

export interface D1QueryWithMetaResult<T> {
  results: T[];
  rowsRead: number;
}
```
- Place `r2-client.ts` under `src/lib/archive/` per RESEARCH.md's structure — but note
  `tools/assert-no-d1.mjs`'s `FORBIDDEN_TARGET_DIR` is `src/lib/server/` specifically. If
  `r2-client.ts` holds build-time R2 write credentials and must NEVER be reachable from a public
  entrypoint (same reasoning as `d1-client.ts`), it should live in `src/lib/server/` instead of
  `src/lib/archive/` so it inherits the existing structural guard automatically — flag this as a
  placement decision for the plan, not an assumption to carry forward silently (RESEARCH.md's own
  proposed path puts it under `src/lib/archive/`, outside the enforced boundary).
- Credential handling: `requireEnv()` exactly as above — read from `process.env` only, never
  logged, never written to a file (same OPS-11 convention cited in both `d1-client.ts` and
  `kv-manifest.ts` headers).
- Error handling: throw on a non-2xx/failed response rather than silently returning empty —
  same "a read/write this module cannot account for is treated as a failure" discipline as
  `d1-client.ts`'s header comment states for its own query function.

---

### `src/lib/server/kv-manifest.ts` (model, CRUD) — extend to schema v3

**Analog:** itself, `/home/jaime/www/_github/915tldr.com/src/lib/server/kv-manifest.ts` (first ~110 lines read)

**Pattern to copy:**
```typescript
export const MANIFEST_SCHEMA_VERSION = '2'; // bump to '3'

export interface ManifestEntry {
  articleId: string;
  translationGroupId: string;
  language: 'en' | 'es';
  contentHash: string;
  schemaVersion: string;
  renderedAt: string;
  buildHash: string;
  category: string;
  publishedAt: number;
  slug: string;
  // NEW (Phase 5, per RESEARCH.md Code Examples "Proposed v3 addition"):
  // tier: 'hot' | 'archive';
  // r2Key: string | null;
}
```
- Every field addition goes through the same `validateManifestEntry()`-before-write discipline
  the file's header comment describes ("an incomplete or malformed entry stored in KV makes the
  whole manifest untrustworthy") — apply this to `tier`/`r2Key` exactly as done for `slug` in the
  v2 bump (04-01, D-08).
- Bulk-write ceiling constant already exists and should be reused unchanged: `KV_BULK_WRITE_MAX_PAIRS = 10_000`.
- **New keyspace needed, not a reuse of the article manifest**: RESEARCH.md Pattern 2 is explicit
  that tag tiering requires a NEW per-tag KV record (e.g. `tag-manifest:<tag-slug>`), following
  the same validation-before-write, no-expiration discipline as the article manifest — this is
  new design surface in this same file or a sibling module, not an extension of the existing
  `manifest:<uuid>` keyspace.

---

### `tools/assert-file-count.mjs` (build-gate, batch) — new

**Analog:** `/home/jaime/www/_github/915tldr.com/tools/assert-no-d1.mjs` (full file read, 200+ lines)

**Pattern to copy:**
- Same fail-loud discipline: "A matcher that matches zero entrypoints must fail loudly
  (`this.error`), never pass silently" — for file-count, this becomes "a count of zero files (a
  broken glob) must fail the build, never silently report 0/80000 as passing."
- Same Rollup/Vite plugin shape if wired into the Astro build (`buildEnd()` hook), OR a plain
  Node script if run as a separate `pnpm run build` step — match whichever `assert-no-d1.mjs`
  itself uses (a Vite plugin registered in `astro.config.mjs`) for consistency, unless the plan
  has a specific reason to diverge (e.g. file-count must run AFTER `dist/client` is fully written,
  which `buildEnd` may fire before `writeBundle` completes — verify hook timing before copying
  verbatim).
- Exit/error convention: `this.error(...)` inside a Rollup plugin, or `process.exitCode = 1` +
  `console.error(...)` for a standalone script — both patterns appear in `assert-no-d1.mjs`
  (the latter in its `registerZeroCandidateGuard` exit handler).
- Threshold constants declared at module top, documented with the decision id, exactly like
  `const FORBIDDEN_TARGET_DIR = 'src/lib/server/';`:
  ```javascript
  const FILE_COUNT_FAIL_THRESHOLD = 80_000; // D-13, roadmap criterion 4
  ```

---

### `tools/load-test-zero-reads.mjs` (test/tool, batch) — new

**Analogs:**
1. `/home/jaime/www/_github/915tldr.com/tools/ci-build.mjs` (first ~90 lines read) — for the
   injectable-deps pattern and ntfy alerting shape.
2. `/home/jaime/www/_github/915tldr.com/tools/assert-no-d1.mjs` — for fail-loud discipline.

**Pattern to copy from `ci-build.mjs`:**
```javascript
// Every network/process boundary is an injectable deps seam
// (spawnImpl/notifyImpl/commitImpl/setTimer/clearTimer) — this project's own established
// convention — so tests never spawn a real process or send a real network request.
import { spawn } from 'node:child_process';

const SECRET_ENV_KEYS = ['CLOUDFLARE_API_TOKEN', 'NTFY_TOKEN'];
const TOKEN_LIKE_RE = /[A-Za-z0-9_-]{40,}/g;

export function redact(text, env = {}) {
  let out = String(text ?? '');
  for (const key of SECRET_ENV_KEYS) {
    const value = env?.[key];
    if (value) out = out.split(value).join('[REDACTED]');
  }
  return out.replace(TOKEN_LIKE_RE, '[REDACTED]');
}
```
For `load-test-zero-reads.mjs` specifically:
- Use the same injectable-deps convention (`fetchImpl` seam, matching `d1-client.ts`'s/
  `changelog-loader.ts`'s own `fetchImpl` precedent cited in `ci-build.mjs`'s header) so the
  D1-analytics GraphQL calls and the scripted HTTP request pass are both mockable in tests.
- D1 database id to filter on: `552ba1d1-024a-4dee-bdaa-3ffd4bdb1f77` (production — see
  RESEARCH.md Pitfall 4; NOT `252435de-25d3-4e0a-8652-c2cb0ea1751c`, which is `915tldr-dev-db`).
- Redact the `CLOUDFLARE_API_TOKEN` from any logged output using the same `redact()` shape above.
- Fail-loud: if the baseline or load-test window query returns zero rows total (not zero delta —
  zero *total*), treat that as a broken measurement, not a clean pass (same zero-matches-must-fail
  discipline as `assert-no-d1.mjs`'s `registerZeroCandidateGuard`).

---

### `tests/unit/tiering.test.mjs` (test, transform) — new

**Analog:** `/home/jaime/www/_github/915tldr.com/tests/unit/article-redirect.test.mjs`

**Pattern to copy:** Node's built-in `node --test` runner (no Jest/Vitest), one `describe`/`test`
block per exported pure function, table-driven boundary cases (e.g. for `isHotTag`, test
`articleCount` at 9, 10, 11 to prove the `>= 10` threshold boundary from D-08 exactly). Mirror
`article-redirect.test.mjs`'s structure of testing the pure function in isolation with no network
mocking required, since `tiering.ts` has no I/O.

---

### `tests/unit/file-count.test.mjs` (test, batch) — new

**Analog:** `/home/jaime/www/_github/915tldr.com/tests/unit/ci-build.test.mjs`

**Pattern to copy:** injected-deps testing style (a fixture directory or an injected
`listFilesImpl`/`countImpl` seam rather than scanning the real `dist/client`), matching how
`ci-build.test.mjs` tests `ci-build.mjs` by injecting `spawnImpl`/`notifyImpl` rather than
spawning real processes.

---

### `tests/integration/url-shapes.test.mjs` (test, request-response) — extend

**Analog:** itself (existing file — not re-read in full this pass; confirmed present and
referenced directly in RESEARCH.md's Validation Architecture as "⚠️ Partial — file exists,
archive cases don't").

**Pattern to copy:** Add new live-request test cases for (a) an archived article path (tier:
archive in the manifest) expecting a 200 served via the Worker → R2 path, and (b) an archived tag
path, following the file's existing live-URL-contract assertion style. Extend, do not replace.

---

### `wrangler.jsonc` (config) — extend

**Analog:** itself (full file read).

**Pattern to copy:** Follow the exact same heavily-commented-decision-record style already used
for every existing block (`assets`, `kv_namespaces`) — each new `r2_buckets` entry should carry an
inline comment naming the decision id (e.g. D-07a/REND-07) and the binding name, matching:
```jsonc
"kv_namespaces": [
  {
    "binding": "RENDER_MANIFEST",
    "id": "3c92531f94294fcc94006455f433885f",
  },
],
```
Add:
```jsonc
"r2_buckets": [
  {
    "binding": "ARCHIVE_BUCKET",
    "bucket_name": "<new bucket, created this phase>",
  },
],
```
**No `d1_databases` binding** — preserve the existing "DELIBERATELY ABSENT" comment block
unchanged; this phase must not add one (D-01 leg 1 depends on its continued absence).

---

### `docs/phase-05/*.md` (3 files: `archive-architecture.md`, `zero-reads-gate.md`, `hot-window-derivation.md`)

**Analogs:** `docs/phase-04/build-pipeline-decision.md`, `docs/phase-03/render-manifest.md`

**Pattern to copy:** Each doc records a measured verdict with a reproducible command and a named
verdict constant, e.g. `WB_COLD_FITS | 649s comfortably fits the 20-minute hard ceiling`. Follow
this exact "verdict name | evidence | command to reproduce" convention for:
- `zero-reads-gate.md`: record the D1-attribution finding (RESEARCH.md Question 1) and the
  delta-measurement result, with a named verdict (e.g. `ZERO_READS_PROVEN` or similar).
- `hot-window-derivation.md`: explicitly flag provisional status if D-07's age-based cutoff is
  what actually shipped (per RESEARCH.md Question 2's practical conclusion that this is likely,
  not merely a fallback).
- `archive-architecture.md`: record the R2 key scheme, manifest v3 schema, and which ceiling
  governs the full re-render (RESEARCH.md Pitfall 1's resolution: Workers Builds' 20-minute wall
  clock, not a 300s CPU figure).

## Shared Patterns

### Build-time-only, credentialed chokepoint modules
**Source:** `src/lib/server/d1-client.ts`, `src/lib/server/kv-manifest.ts`
**Apply to:** `src/lib/archive/r2-client.ts` (recommend relocating under `src/lib/server/` — see
note above)
```typescript
function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`<module-name>: ${name} is not set in the environment`);
  return value;
}
```
Never log a credential; never write one to a file; read only from `process.env`.

### Structural build-gate (fail loud, never silent)
**Source:** `tools/assert-no-d1.mjs`
**Apply to:** `tools/assert-file-count.mjs`, `tools/load-test-zero-reads.mjs`
A guard that matches/measures zero of anything must fail the build — this project shipped a real
incident (Phase 2 CONT-06) from a check that silently stopped gating. Every new Phase 5 gate must
include an explicit "zero total measured = broken check, not a pass" branch.

### Injectable-deps seam for testability
**Source:** `tools/ci-build.mjs` (`spawnImpl`/`notifyImpl`/`commitImpl`/`setTimer`/`clearTimer`),
`src/lib/server/build-state.ts` (`fetchImpl`), `src/content/loaders/changelog-loader.ts`
(`fetchJson`)
**Apply to:** `tools/load-test-zero-reads.mjs`'s GraphQL/HTTP calls, `src/lib/archive/r2-client.ts`'s
R2 PutObject calls
Every network/process boundary gets an injectable parameter defaulting to the real implementation,
so unit tests substitute a fake and never perform real I/O.

### ntfy alerting on failure, keep serving the old copy
**Source:** `tools/ci-build.mjs` (D-15 pattern), applies to D-12 here
**Apply to:** the archive-tier R2 write step (wherever it lands — Workers Builds build step per
RESEARCH.md's recommendation)
On partial failure: keep the previous good artifact serving, push exactly one ntfy notification
naming how many pages/what failed, with secrets redacted via the same `redact()`/`TOKEN_LIKE_RE`
pattern, and let the next cycle retry — never fail the whole build/deploy for a partial archive
write.

### One KV read per request, extend the payload instead of adding a second read
**Source:** `src/worker.ts` (existing single `RENDER_MANIFEST.get()` call)
**Apply to:** the archive-serving branch added to `src/worker.ts`
Extend `ManifestEntry`'s KV payload with `tier`/`r2Key` fields (schema v3) rather than adding a
second KV namespace lookup per request, to hold ARCH-08's ≤1 KV read budget.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `tag-manifest:<tag-slug>` KV keyspace (new, inside `kv-manifest.ts` or a sibling module) | model | CRUD | No existing per-tag KV record exists — the current manifest is article-keyed only (RESEARCH.md Pattern 2, explicit "this is new design surface, not a reuse"). Use the article manifest's validation-before-write/no-expiration conventions as the nearest structural analog, but the schema itself has no precedent in this codebase. |
| Edge-cache-via-`caches.default` code path inside `src/worker.ts` | middleware | request-response | No prior use of the Workers Cache API exists in this codebase (confirmed: this is the project's first R2/Cache-API code). RESEARCH.md's Pattern 3 code example is the only available reference (cited from Cloudflare docs, not an in-repo analog) — treat as new ground, verify exact `caches.default`/`cache.match`/`cache.put` method signatures before implementing per RESEARCH.md's own flagged caveat (Assumption A2).

## Metadata

**Analog search scope:** `src/`, `tools/`, `tests/`, `wrangler.jsonc`, `docs/phase-03/`,
`docs/phase-04/` — directories named directly in CONTEXT.md's "Reusable Assets"/"Integration
Points" and RESEARCH.md's "Recommended Project Structure"/"Code Examples".
**Files scanned:** `src/worker.ts`, `src/lib/article-redirect.ts`, `src/lib/server/d1-client.ts`,
`src/lib/server/kv-manifest.ts`, `tools/assert-no-d1.mjs`, `tools/ci-build.mjs`, `wrangler.jsonc`,
plus a directory listing of `tests/unit/` and `tests/integration/` to confirm existing test-file
conventions.
**Pattern extraction date:** 2026-09-30
