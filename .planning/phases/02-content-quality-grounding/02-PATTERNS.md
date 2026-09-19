# Phase 2: Content Quality & Grounding - Pattern Map

**Mapped:** 2026-09-19
**Files analyzed:** 12 (new/modified, all in `915tldr.com2` except none in this repo)
**Analogs found:** 10 / 12

**REPO NOTE:** Every file below lives in `915tldr.com2` (the v1 Nuxt pipeline), not in
`915tldr.com` (this repo, planning-only for Phase 2). All paths are given relative to
`915tldr.com2/` unless explicitly prefixed otherwise. Resolved via `zoxide query --list --score`:
`915tldr.com2` is at `/home/jaime/www/_github/915tldr.com2`.

**CORRECTION TO 02-RESEARCH.md:** The Validation Architecture section's test-file list uses a
`.spec.ts` naming convention (`tests/content-extraction.spec.ts`, etc.) and cites
`vitest.config.ts`. Confirmed by reading both files directly this session:
- `vitest.config.ts` (`915tldr.com2/vitest.config.ts:9`) sets `include: ['tests/**/*.test.ts']`
  — **`.spec.ts` files will NOT be picked up by `pnpm test:run`.**
- The one existing test file, `915tldr.com2/tests/duplicate-detector.test.ts`, uses `.test.ts`.
- **Planner must rename every Wave-0 test file from RESEARCH.md's `.spec.ts` to `.test.ts`**
  (e.g. `tests/grounding/length-check.test.ts`, not `.spec.ts`), or add `.spec.ts` to the
  `include` glob in `vitest.config.ts` — renaming to match the existing convention is simpler
  and requires no config change.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `server/utils/openai.ts` (modified: prompt, model, cap) | service | request-response | itself (existing file, in-place edit) | exact |
| `server/utils/content-extractor.ts` (add extraction fn) | utility | transform | itself (existing file, in-place edit) — `cleanHtmlContent` stays as post-processor | exact |
| `server/utils/grounding-check.ts` (new) | service | request-response (LLM judge call) + transform (deterministic checks) | `server/utils/duplicate-detector.ts` | role-match (two-stage heuristic + AI-confirmation shape) |
| `server/utils/verbatim-overlap.ts` (new) | utility | transform | `server/utils/duplicate-detector.ts` (Jaccard/keyword helpers) | partial-match (pure-function string comparison) |
| `server/utils/chunk.ts` (new) | utility | transform | no analog — greenfield (generic helper, no prior chunking utility exists) | none |
| `server/db/schema.ts` (add `keyPoints`, `acquisitionStatus` columns + migration) | model | CRUD | itself (existing `articles` table def) | exact |
| `server/api/cron/fetch.post.ts` (modified: full-page fetch + D-02 retry/fallback) | route | request-response (cron-triggered) | itself (existing file, in-place edit) | exact |
| `server/api/cron/process.post.ts` (wire in grounding check) | route | request-response | `server/api/cron/detect-duplicates.post.ts` | role-match (cron route calling a utils module, `requireCronAuth`-gated) |
| `scripts/reprocess-dry-run.mjs` (new) | utility / script | batch | `server/api/admin/articles/reprocess-all.post.ts` | role-match (bulk-reprocess logic, but analog is an H3 route not a standalone script) |
| `scripts/reprocess-execute.mjs` (new) | utility / script | batch + event-driven (Batch API poll) | `server/api/admin/articles/reprocess-all.post.ts` (chunking pattern) + OpenAI Batch API docs (no in-repo analog for Batch calls) | partial-match |
| `server/api/admin/articles/reprocess-all.post.ts` (modified: FIX-01 chunking) | route | request-response | itself (existing file, in-place edit) | exact |
| `app/pages/privacy.vue` (modified: FIX-03 formatting only) | component | request-response (static page) | itself (existing file, in-place edit) | exact |
| `package.json` (modified: FIX-02, add `wrangler`/`linkedom`/`@mozilla/readability`/`js-tiktoken`) | config | — | itself | exact |
| `tests/grounding/*.test.ts`, `tests/content-extraction.test.ts`, `tests/batch/resubmit.test.ts`, `tests/admin/reprocess-chunking.test.ts` (new, renamed from RESEARCH.md's `.spec.ts`) | test | request-response (unit, mocked) | `tests/duplicate-detector.test.ts` | exact |

## Pattern Assignments

### `server/utils/openai.ts` (service, request-response) — modify in place

**Analog:** itself, current state read this session (`915tldr.com2/server/utils/openai.ts:1-130`)

**Imports pattern** (lines 1-8):
```typescript
/**
 * OpenAI Client Wrapper
 */
import OpenAI from 'openai'
```
No import changes needed unless the model-selection or grounding call is factored out here.

**Client singleton pattern** (lines 10-22) — reuse as-is:
```typescript
let openaiClient: OpenAI | null = null
export function getOpenAIClient(apiKey: string): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey })
  }
  return openaiClient
}
```

**What changes (concrete diff targets):**
- Line 111: `model: 'gpt-4o-mini'` → `model: 'gpt-5.6-luna'` (CONT-08).
- Line 106: `content?.slice(0, 6000) || 'No content available...'` → raise to the D-04 measured
  cap (pending Wave 0 production measurement — do not hardcode a guess).
- Lines 75 ("100-200 words, 3-5 sentences") and 79/82-87 (advisory/tips/recommendations
  instructions) → rewrite per D-05/D-06/D-07 (proportional length + hard ceiling; keyPoints
  facts-only; conditional attribution branch decided in code, not by the model — see
  Pattern 1 below, sourced from RESEARCH.md).
- Line 116: `temperature: 0.4` — Claude's Discretion per CONTEXT.md; not required to change.
- The JSON response shape (`AIProcessingResult` interface, lines 27-38) gains no new top-level
  field for keyPoints (it already exists) — D-06 only changes *where it's stored*, not the
  model's output contract.

**Error handling pattern** (lines 118-124) — reuse as-is:
```typescript
const responseContent = response.choices[0]?.message?.content
if (!responseContent) {
  throw new Error('No response from OpenAI')
}
const result = JSON.parse(responseContent) as AIProcessingResult
```

---

### `server/utils/content-extractor.ts` (utility, transform) — extend in place

**Analog:** itself (`915tldr.com2/server/utils/content-extractor.ts:1-80`, full file read)

**Existing pattern to preserve as post-processor** (lines 10-42):
```typescript
export function cleanHtmlContent(html: string): string {
  let cleaned = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    // ...
  cleaned = decodeHtmlEntities(cleaned)
  return cleaned.replace(/\n\s*\n\s*\n+/g, '\n\n').replace(/[ \t]+/g, ' ').trim()
}
```
Per RESEARCH.md's "Don't Hand-Roll" table: keep `cleanHtmlContent` as a post-processing pass
*after* Readability extraction, not as the primary extractor. New function should follow the
same "pure function taking a string, returning a string" shape:
```typescript
// NEW — same file, same export style as cleanHtmlContent
export async function extractArticleBody(html: string, url: string): Promise<string> {
  // linkedom/worker parseHTML() -> Readability -> cleanHtmlContent() post-process
}
```
File header comment ("For MVP, we rely primarily on RSS content...") is now stale per D-01 and
should be updated/removed as part of this edit — it documents the exact assumption D-01 reverses.

---

### `server/utils/grounding-check.ts` (service, request-response + transform) — new file

**Analog:** `server/utils/duplicate-detector.ts` (`915tldr.com2/server/utils/duplicate-detector.ts`)

**Why this is the closest match:** it is the only existing module in the codebase with the same
two-stage shape D-08 requires — cheap deterministic heuristics first, LLM confirmation only on
what the heuristics flag.

**Imports pattern** (lines 1-13):
```typescript
import { drizzle } from 'drizzle-orm/d1'
import { eq, and, ne, gte, sql, inArray } from 'drizzle-orm'
import * as schema from '../db/schema'
import type OpenAI from 'openai'

const JACCARD_THRESHOLD = 0.6
const ENTITY_OVERLAP_THRESHOLD = 0.5
const TIME_WINDOW_HOURS = 48
```
Mirror this: constants for thresholds declared at module top, not magic numbers inline.

**Stage-2 AI-confirmation call pattern** (from duplicate-detector, the section read this
session):
```typescript
const userPrompt = `Are these two articles about the same story?
Article 1: "${pair.article1.title}"
Entities: ${pair.article1.entities.join(', ') || 'none'}
Article 2: "${pair.article2.title}"
Entities: ${pair.article2.entities.join(', ') || 'none'}
Answer "yes" or "no":`

try {
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.1,
    max_tokens: 10,
  })
  const answer = response.choices[0]?.message?.content?.toLowerCase().trim()
  return answer === 'yes'
} catch (error) {
  console.error('[Duplicate Detector] AI confirmation error:', error)
  // On error, fall back to high-confidence heuristic match
  return pair.jaccardScore >= 0.8 || pair.entityOverlap >= 0.8
}
```
**Apply this shape to the grounding judge**, per RESEARCH.md's Pattern 2 (claim-extraction-then-
verify cascade): same try/catch-with-safe-fallback discipline, same low `temperature` for a
verdict call, same `console.error` prefix convention (`[Grounding Check]` instead of
`[Duplicate Detector]`). RESEARCH.md's own judge-call interface (`ClaimVerdict`,
`GroundingResult`) is the target shape for the JSON response — the duplicate-detector's
yes/no prompt is a weaker precedent than RESEARCH.md's synthesized cascade design, so prefer
RESEARCH.md's `sourceSpan` interface over copying duplicate-detector's binary yes/no.

**Deterministic (Stage 1) pattern to copy structurally, not literally** — pure functions with no
DB/model dependency (from RESEARCH.md's own Pattern 1, already codebase-idiomatic):
```typescript
function summaryExceedsSource(summary: string, sourceContent: string): boolean {
  return summary.trim().length > sourceContent.trim().length
}
```

---

### `server/utils/verbatim-overlap.ts` (utility, transform) — new file

**Analog:** `server/utils/duplicate-detector.ts`'s keyword/Jaccard helpers (`extractTitleKeywords`
and the Jaccard-similarity scoring, top of file). Partial match — same "extract signal from two
strings, return a similarity score" shape, applied to different signal (n-gram/longest-common-
substring vs. keyword-set Jaccard). No existing longest-common-substring implementation found in
the codebase — this function's core algorithm is greenfield even though its module-level shape
(pure exported function, no DB access) follows `duplicate-detector.ts`'s stage-1 helpers.

---

### `server/utils/chunk.ts` (utility, transform) — new file

**No analog — greenfield.** No chunking helper exists anywhere in `915tldr.com2` today; every
`inArray` call site (`reprocess-all.post.ts`, `duplicate-detector.ts`) either has no chunking or
was fixed ad-hoc in commit `8552b9e` (per RESEARCH.md) rather than via a shared utility.
RESEARCH.md's own `chunk.ts` code sample (Pattern 3) is the reference implementation:
```typescript
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}
```

---

### `server/db/schema.ts` (model, CRUD) — modify in place

**Analog:** itself, `articles` table definition (`915tldr.com2/server/db/schema.ts:23-61`, read
in full this session)

**Column-definition pattern to copy exactly** for the two new columns (D-02's
`acquisitionStatus`, D-06's `keyPoints`):
```typescript
// existing precedent for a status-like enum-as-text column:
status: text('status').default('pending'), // 'pending' | 'processed' | 'failed' | 'hidden'
// existing precedent for a boolean:
isDuplicate: integer('is_duplicate', { mode: 'boolean' }).default(false),
```
New columns should follow the same "text column with an inline comment enumerating the allowed
string values" convention rather than introducing a SQLite `CHECK` constraint or enum type —
matches `status`'s existing style exactly. `keyPoints` should be stored as `text` (JSON-encoded
array), matching how `entities` is handled elsewhere in the schema (verify against the
`articleEntities`/`entities` table shape before finalizing — not fully read this session).

**Index pattern precedent** (lines 51-59) — if the new `acquisitionStatus` column needs to be
queried at scale (e.g., "how many feed_fallback rows"), follow the existing inline-comment style
explaining *why* the index exists, not just declaring it:
```typescript
index('idx_articles_status_published').on(table.status, desc(table.publishedAt)),
```

**Migration mechanics:** migrations live under `server/db/migrations/sqlite/` — confirmed via
`tests/duplicate-detector.test.ts:17-22`'s `MIGRATION_FILES` list (`0000_empty_gorilla_man.sql`
… `0005_amused_venus.sql`). New migration is `0006_<generated-name>.sql`, generated via the
project's existing drizzle-kit migration command (verify exact `pnpm` script name in
`package.json` before writing it by hand).

---

### `server/api/cron/fetch.post.ts` (route, request-response) — modify in place

**Analog:** itself, full file read this session (`915tldr.com2/server/api/cron/fetch.post.ts`)

**Auth pattern** (lines 9, 37) — unchanged, reuse exactly:
```typescript
import { requireCronAuth } from '../../utils/requireCronAuth'
// ...
export default defineEventHandler(async event => {
  await requireCronAuth(event)
```

**Where D-01/D-02 land** — inside the per-item loop, legacy-mode insert branch (lines 133-168):
today this branch takes `item.content`/`item.description` directly from the RSS item and calls
`cleanHtmlContent`. D-01 replaces this with a full-page fetch + Readability extraction call
(`extractArticleBody` from `content-extractor.ts`), and D-02 wraps that call in a
retry-with-backoff-then-fallback:
```typescript
// current (to be replaced):
const content = item.content ? cleanHtmlContent(item.content) : null
const description = item.description ? cleanHtmlContent(item.description) : null
await db.insert(schema.articles).values({
  // ...
  content: content || description,
  // ...
})
```
New shape should preserve the existing per-item `try/catch` around the whole insert (lines
135-167) and store D-02's acquisition status in the same `values()` call, not a follow-up
`UPDATE` — matches the file's existing single-insert-per-article discipline.

**Error handling pattern** (lines 159-167) — reuse exactly, including the `UNIQUE constraint`
special-case:
```typescript
} catch (insertError: unknown) {
  const errorMsg = insertError instanceof Error ? insertError.message : 'Unknown error'
  if (errorMsg.includes('UNIQUE constraint')) {
    result.skipped++
  } else {
    result.errors.push(`Failed to insert "${item.title}": ${errorMsg}`)
  }
}
```

**Logging convention** — every line in this file prefixes `console.log`/`console.error` with
`[RSS Fetch]`. New code (fetch/extraction/fallback) must use the same bracket-tag prefix, e.g.
`[RSS Fetch] Canonical page fetch failed, retrying...`.

---

### `server/api/cron/process.post.ts` (route, request-response) — modify to wire in grounding check

**Analog:** `server/api/cron/detect-duplicates.post.ts` (full file read this session) — closer
match than reading `process.post.ts` itself for *this specific change*, because it shows the
established shape for "cron route that gates on `OPENAI_API_KEY`, validates bounded input, and
calls a `utils/*` module."

**Pattern to copy** (lines 1-33 of `detect-duplicates.post.ts`):
```typescript
import { requireCronAuth } from '../../utils/requireCronAuth'

export default defineEventHandler(async event => {
  await requireCronAuth(event)
  const { DB, OPENAI_API_KEY } = event.context.cloudflare.env
  if (!OPENAI_API_KEY) {
    throw createError({ statusCode: 500, message: 'OPENAI_API_KEY not configured' })
  }
  const db = drizzle(DB, { schema })
  // ... bounded query-param validation with an explicit MAX_* constant and a clear error
  // message when exceeded (see MAX_ARTICLE_IDS = 200 pattern)
})
```
D-08's grounding check should be invoked from `process.post.ts` right after
`processArticleWithAI` returns (same point `ai-processor.ts`'s `storeProcessingResults` is
currently called), gating the D1 write per RESEARCH.md's architecture diagram — do not gate at
the route level, gate inside `ai-processor.ts`'s per-article loop so a flagged article can be
retried (D-09) without re-running the whole batch.

---

### `scripts/reprocess-dry-run.mjs` / `scripts/reprocess-execute.mjs` (script, batch) — new files

**Analog:** `server/api/admin/articles/reprocess-all.post.ts` (`915tldr.com2/server/api/admin/
articles/reprocess-all.post.ts:1-135`, full file read this session) for the **chunking and
bulk-selection logic only** — the analog is an H3 route, not a standalone script, so the
request/response wrapper (`defineEventHandler`, `getQuery`, `createError`) does not transfer;
only the query/chunk/loop shape does.

**Chunking pattern to copy, corrected per FIX-01 and RESEARCH.md's Pitfall 1** (this file's
current bug, lines 49-66 — confirmed at these exact line numbers this session, RESEARCH.md's
citation is accurate and unchanged):
```typescript
// BUG (current, unchunked — reproduces SQLITE_ERROR above ~100 ids):
await db.update(schema.articles)
  .set({ status: 'pending', processedAt: null, summary: null, updatedAt: sql`(unixepoch())` })
  .where(inArray(schema.articles.id, articleIds))         // line 57 — 4 bound params + N ids
await db.delete(schema.articleTags).where(inArray(schema.articleTags.articleId, articleIds))       // line 60
await db.delete(schema.articleCategories).where(inArray(schema.articleCategories.articleId, articleIds)) // line 63
await db.delete(schema.articleEntities).where(inArray(schema.articleEntities.articleId, articleIds))     // line 65-66

// FIX — using chunk.ts, per RESEARCH.md's own worked example:
for (const idChunk of chunk(articleIds, 97)) {   // UPDATE has 3 SET params; cap at 97, not 100
  await db.update(schema.articles)
    .set({ status: 'pending', processedAt: null, summary: null, updatedAt: sql`(unixepoch())` })
    .where(inArray(schema.articles.id, idChunk))
}
for (const idChunk of chunk(articleIds, 100)) {  // DELETEs have zero extra SET params
  await db.delete(schema.articleTags).where(inArray(schema.articleTags.articleId, idChunk))
  await db.delete(schema.articleCategories).where(inArray(schema.articleCategories.articleId, idChunk))
  await db.delete(schema.articleEntities).where(inArray(schema.articleEntities.articleId, idChunk))
}
```

**Selection-query pattern** (lines 27-34) — reuse the shape, not the filter:
```typescript
const articlesToReprocess = await db
  .select({ id: schema.articles.id, title: schema.articles.title })
  .from(schema.articles)
  .where(eq(schema.articles.status, 'processed'))
```
D-14's dry-run script needs a different `WHERE` (deterministic-sweep-flagged rows plus the
CONT-12 outage window), but the same `select → map to ids → operate` shape.

**No in-repo analog for:** the Batch API submission/poll/resubmit logic (OpenAI Batch API
calls) or the report-write-then-gate two-command split (D-15). RESEARCH.md's own "Code Examples"
section (Batch job submission, token-cost projection) is the only available reference — treat it
as the analog since no Batch API code exists anywhere in this codebase today. Confirmed by
grep: no occurrence of `.batches.` or `files.create` anywhere under `server/` or `scripts/`.

**Structural safety pattern (Pitfall 2, D-13):** the execute script must import only
`processArticleWithAI`/DB utilities — never `content-extractor.ts`'s fetch function — so it is
architecturally incapable of re-fetching source pages. Enforce via import list, not a runtime
check.

---

### `app/pages/privacy.vue` (component) — FIX-03, formatting only

**Analog:** itself; `npx prettier --check app/pages/privacy.vue` currently fails (verified this
session — command runs, exits non-zero). This is a mechanical `npx prettier --write
app/pages/privacy.vue` fix, no analog needed beyond the file itself. Confirm no other `.vue`
files in `app/pages/` have the same drift before treating this as isolated (not checked this
session — quick follow-up: `npx prettier --check app/pages/`).

---

### `package.json` (config) — FIX-02 + new dependencies

**Analog:** itself. Current `scripts` block (read this session) already has `dev:remote` and
`dev:local` invoking `wrangler` directly (`nuxt build && wrangler dev --remote`) while `wrangler`
is absent from both `dependencies` and `devDependencies` — this is FIX-02 exactly as RESEARCH.md
describes, confirmed present at this session's read.

**Fix:**
```bash
pnpm add -D wrangler
pnpm add linkedom @mozilla/readability js-tiktoken
```
No structural pattern to copy — this is a dependency-list edit, not a code pattern. Per
RESEARCH.md's Package Legitimacy Audit, add a `checkpoint:human-verify` before pinning exact
patch versions of `wrangler` and `openai` (both flagged `SUS` for publish-date recency, not
structural risk).

---

### Test files (`tests/**/*.test.ts`) — new, Wave 0

**Analog:** `tests/duplicate-detector.test.ts` (`915tldr.com2/tests/duplicate-detector.test.ts`,
read in full for its setup section this session) — this is the **only** existing test file with
substantive coverage in the repo (`tests/example.test.ts` is presumably a scaffold stub, not
read this session but named suggestively).

**In-memory D1 test-db pattern to copy exactly** (lines 1-36):
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import type { drizzle as d1Drizzle } from 'drizzle-orm/d1'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as schema from '../server/db/schema'

type TestDb = ReturnType<typeof d1Drizzle>

const MIGRATION_FILES = [
  '0000_empty_gorilla_man.sql',
  '0001_absurd_squadron_sinister.sql',
  '0002_fts5_articles_search.sql',
  '0003_steep_lake.sql',
  '0004_daffy_skaar.sql',
  '0005_amused_venus.sql',
  // + the new migration this phase adds (0006_...) once it exists
]

function createTestDb(): TestDb {
  const sqlite = new Database(':memory:')
  const migrationsDir = join(process.cwd(), 'server/db/migrations/sqlite')
  for (const file of MIGRATION_FILES) {
    const sql = readFileSync(join(migrationsDir, file), 'utf-8')
    for (const statement of sql.split('--> statement-breakpoint')) {
      const trimmed = statement.trim()
      if (trimmed) sqlite.exec(trimmed)
    }
  }
  return drizzle(sqlite, { schema }) as unknown as TestDb
}
```
**This is the exact pattern `tests/admin/reprocess-chunking.test.ts` and any grounding test that
touches the DB should use** — a real in-memory SQLite built from the committed migration files,
not a mocked drizzle client. Comment at lines 12-15 explains why this is a faithful stand-in for
the D1 client (shared sqlite-core query builder) — carry that comment forward verbatim into new
test files touching DB code, since the same justification applies.

**For pure-function tests with no DB dependency** (grounding length-check, verbatim-overlap,
chunk.ts) — no analog exists in-repo for a DB-free test file; follow the same `describe`/`it`/
`expect` Vitest shape from the top of `duplicate-detector.test.ts` but omit `createTestDb()`
entirely.

**Mocked-OpenAI-client pattern for `tests/batch/resubmit.test.ts` (CONT-11):** no analog exists
— `duplicate-detector.test.ts`'s `vi` import (line 1) suggests `vitest`'s built-in mocking is the
established tool, but no example of mocking `OpenAI`'s client specifically was found in this
codebase this session. Use `vi.fn()`/`vi.mock('openai', ...)` per Vitest convention; no
project-specific wrapper exists to copy.

## Shared Patterns

### Cron-route authentication (`requireCronAuth`)
**Source:** `server/utils/requireCronAuth.ts` (full file read this session)
**Apply to:** `process.post.ts`, `fetch.post.ts` (already applied), and any new admin route
exposing the re-processing dry-run/execute pair, per RESEARCH.md's Security Domain (V4 Access
Control) — the execute path must never be an unauthenticated public route.
```typescript
import type { H3Event } from 'h3'
import { getAuthSession } from './requireAuth'

export async function requireCronAuth(event: H3Event): Promise<void> {
  const { CRON_SECRET } = event.context.cloudflare.env
  const cronSecretHeader = getHeader(event, 'x-cron-secret')
  if (CRON_SECRET && cronSecretHeader === CRON_SECRET) return
  const session = await getAuthSession(event)
  if (session?.user) return
  throw createError({ statusCode: 401, statusMessage: 'Unauthorized - Cron secret or admin session required' })
}
```

### Bracketed console logging convention
**Source:** every route/util read this session (`[RSS Fetch]`, `[AI Processor]`, `[Admin]`,
`[Duplicate Detector]`)
**Apply to:** all new modules — `[Grounding Check]`, `[Content Extractor]`, `[Reprocess Dry
Run]`, `[Reprocess Execute]`. This is a strict, unbroken convention across every file read this
session; deviating from it is the only "wrong pattern" risk here.

### Error normalization
**Source:** repeated verbatim across `ai-processor.ts`, `fetch.post.ts`, `reprocess-all.post.ts`
```typescript
} catch (error: unknown) {
  const errorMsg = error instanceof Error ? error.message : 'Unknown error'
  // ... console.error(`[Tag] ...`, errorMsg) then either continue, mark failed, or createError
}
```
**Apply to:** every new try/catch in this phase's code — grounding-check judge calls,
extraction calls, Batch API calls.

### Chunked D1 writes (≤100 total bound params)
**Source:** RESEARCH.md Pattern 3, `chunk.ts` (greenfield) — applies to FIX-01 and every new
batched write (re-processing execute script writing back thousands of rows).
See full example under `scripts/reprocess-dry-run.mjs` above. Non-negotiable per D1's empirically
verified ceiling (commit `8552b9e`, 2026-09-15).

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `scripts/reprocess-execute.mjs` (Batch API submit/poll/resubmit portion only) | service | event-driven | No OpenAI Batch API code exists anywhere in `915tldr.com2` — confirmed via grep for `.batches.`/`files.create`, zero hits. RESEARCH.md's own Code Examples section (sourced from OpenAI's official docs, fetched directly) is the only available reference; treat that as the pattern source instead of an in-repo analog. |
| `server/utils/chunk.ts` | utility | transform | No chunking helper exists anywhere in the codebase prior to this phase; each `inArray` call site was previously either unchunked (the FIX-01 bug) or fixed ad hoc in an unrelated commit. RESEARCH.md's worked example is the reference implementation. |

## Metadata

**Analog search scope:** `915tldr.com2/server/{utils,api,db}`, `915tldr.com2/tests`,
`915tldr.com2/app/pages/privacy.vue`, `915tldr.com2/package.json`,
`915tldr.com2/vitest.config.ts`. No search was performed inside `915tldr.com` (this repo) since
CONTEXT.md/RESEARCH.md both confirm this phase's code lands entirely in `915tldr.com2`.
**Files scanned:** 11 read in full or targeted sections (`openai.ts`, `ai-processor.ts`,
`reprocess-all.post.ts`, `content-extractor.ts`, `schema.ts` (partial), `fetch.post.ts`,
`detect-duplicates.post.ts`, `duplicate-detector.ts` (partial), `duplicate-detector.test.ts`
(partial), `requireCronAuth.ts`, `privacy.vue` (partial), `vitest.config.ts`, `package.json`
(partial)).
**Pattern extraction date:** 2026-09-19
