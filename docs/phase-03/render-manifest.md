# The Render Manifest

**Source of truth:** `src/lib/server/kv-manifest.ts`. This document describes what is implemented there,
not what was planned — if the two ever disagree, the code is right and this file is stale and
needs a follow-up edit.

**Audience:** Phase 4 (decides what to re-render, using `contentHash`/`schemaVersion`), Phase 5
(uses the denormalised `category`/`publishedAt` for hot/archive tiering), and Phase 6 (pairs
hreflang using `translationGroupId`/`language`). Each of those phases should be able to build
against this document without reading `kv-manifest.ts` itself.

## Key shape

One KV key per article, `manifest:<uuid>`, in the `915tldr-render-manifest` namespace (id
`3c92531f94294fcc94006455f433885f`) — never a single blob, never sharded (D-03).

**Why:** O(1) independent reads and writes, and no read-modify-write race between concurrent
renders. A single blob holding the whole corpus works today (~42k articles × ~200 bytes ≈ 8 MB,
under KV's 25 MB value ceiling) but shrinks as the corpus grows, and every render would have to
rewrite the whole thing. These KV reads and writes happen at **build/render time only** — see
"What this does not consume" below.

## Every field

| Field | Type | What produces it | What a reader may rely on |
|---|---|---|---|
| `articleId` | `string` | The source row's `articles.uuid` | Matches the `<uuid>` in the KV key and in the public URL (`/[category]/[slug]-[uuid]`). Never empty. |
| `translationGroupId` | `string` | `buildManifestEntry()`, currently always equal to `articleId` | See "Translation identity" below. Never null, never empty. |
| `language` | `'en' \| 'es'` | `buildManifestEntry()`'s `opts.language`, default `'en'` | Always `'en'` today — no Spanish content is ingested yet. Phase 6 will write `'es'` entries. Never any other value; the writer rejects anything else. |
| `contentHash` | `string` (64 lowercase hex chars, SHA-256) | `computeContentHash()` over **exactly** `title`, `summary`, and `tags` from the source D1 row | Changes if and only if `title`, `summary`, or `tags` change. **Does not cover** `status`, `category`, `published_at`, or any other column — a reader deciding staleness must not assume this hash reflects anything outside those three fields. Order-independent over `tags` (sorted before hashing) and treats a `null` tags value (SQL `GROUP_CONCAT` returns `null` for zero tags) identically to an empty string. |
| `schemaVersion` | `string` | The exported `MANIFEST_SCHEMA_VERSION` constant, recorded automatically on every entry | See "Versioning" below. |
| `renderedAt` | `string` (ISO 8601) | `new Date().toISOString()` at build time | When this specific entry was written. Not necessarily when the corresponding page was last *deployed* — see "What this does not guarantee". |
| `buildHash` | `string` | `BUILD_HASH` from `src/lib/build-info.ts` (OPS-05/OPS-06) | The same commit-identity value `/version.json` and the public footer report for the same build — one resolution, read by three surfaces, so none of them can disagree (03-03). |
| `category` | `string` | Denormalised from the source row's resolved primary category | Avoids a second D1 read at render time. Singular — an article's primary category only. |
| `publishedAt` | `number` (epoch **seconds**) | Denormalised from `articles.published_at` | Not milliseconds, not an ISO string. Multiply by 1000 before constructing a `Date`. |

Every field above is **required and non-null** in a written entry. `getManifestEntry()` returns
`null` only for a key that does not exist — a stored entry is always fully populated, because
`validateManifestEntry()` rejects an incomplete or malformed entry before it ever reaches the
network (see "Validation" below). A reader never has to distinguish "missing key" from "missing
field" within a present entry — the second case cannot happen.

## Translation identity

This is the section Phase 3 success criterion 3 is actually about: *"The render manifest exists
in KV with a documented schema that already carries the Spanish counterpart ID per article, so
hreflang pairing never requires a backfill re-render of the corpus."*

**The rule Phase 6 should follow:** two manifest entries are translation counterparts of each
other **if and only if they share the same `translationGroupId`**. Pairing is a group lookup
("find the other entry with this `translationGroupId`"), never "follow a pointer to a specific
record ID."

For every entry written today (the whole corpus is English-only), `translationGroupId` equals the
article's own `articleId`. When Phase 6 ingests a Spanish counterpart for an article, it writes a
**new** manifest entry with `language: 'es'` and `translationGroupId` set to the **same** value as
the English entry's `articleId`/`translationGroupId` — not a new group id, not a derived id
computed from anything about the Spanish content itself.

### Which option was chosen, and why (Task 1 decision, human-resolved)

Three shapes were on the table:

- **Option A — derived counterpart id.** Compute a Spanish article's id now, as a pure function of
  the English uuid. Rejected: it commits to Phase 6's Spanish-content data model (a second row
  with its own id) before Phase 6 has designed it. The orchestrator verified the live production
  D1 schema directly — 24 tables, none translation-related; `articles` has 24 columns, none named
  `language`, `summary_es`, or anything translation-adjacent. A derived id would point at a record
  that demonstrably does not exist yet: confidently wrong rather than honestly empty, and the
  wrongness would only surface in Phase 6.
- **Option B — nullable field, populated by a Phase 6 backfill.** This is the outcome this plan's
  own prohibition forbids: the field would be structurally always null for the entire Phase 3–6
  window, satisfying the letter of "carries the field" while delivering none of the benefit the
  success criterion describes ("never requires a backfill re-render"). Nothing would exercise the
  field until Phase 6, and any bug in its shape would surface only then.
- **Option C — translation-group id plus a language field. CHOSEN.** Both language variants carry
  the same group id, computable today from information that already exists (the English article's
  own uuid) with no new identity scheme invented. Pairing works identically whether Phase 6's
  Spanish content ends up as new rows with their own uuids or as new columns on the existing
  `articles` row — the manifest's `translationGroupId` doesn't need to know which. Never null, and
  never wrong about a record that doesn't exist.

**Precedent already in production:** the pipeline already models "several rows are one logical
story" as a group — `duplicate_groups (id, primary_article_id, created_at)` (79 live rows) plus
`duplicate_group_members (group_id, article_id)`, used for cross-source duplicate detection. A
translation group is structurally the same relationship. Option C reuses an established pattern in
this codebase rather than introducing a new one.

**Cost of this choice:** two fields instead of one, and readers have to understand grouping rather
than following a direct pointer. The group id is redundant with the article id for every
English-only article until Phase 6 arrives — an acceptable, documented redundancy, not a bug.

## Versioning

`MANIFEST_SCHEMA_VERSION` (currently `'1'`) is an exported constant in `src/lib/server/kv-manifest.ts`.
Every entry records it as `schemaVersion` — automatically, via `buildManifestEntry()`; no call
site passes a version literal (the 03-01 tracer's hand-written `renderVersion: '0'` was exactly
the kind of drift this constant exists to prevent).

**Bump it when** the shape of `ManifestEntry` changes, or when a template/render-logic change
means an existing entry's `renderedAt`/`contentHash` can no longer be trusted to describe what was
actually rendered for that schema.

**What a bump implies for existing entries:** entries at an older `schemaVersion` become
selectively identifiable — and therefore selectively re-renderable — rather than the whole corpus
being invalidated at once. That selectivity is the entire reason this is a version field on every
entry rather than a single global flag. A version bump is a decision a future render step makes
about entries below the new version; this module itself does not act on version comparisons.

## Validation

`validateManifestEntry()` runs before **every** write — inside both `putManifestEntry()` and
`putManifestEntriesBulk()` — and throws, naming the offending field, before any network call is
made. Rejected: any required string field missing or empty, `language` outside `'en'`/`'es'`, a
`contentHash` that isn't exactly 64 lowercase hex characters, or a `publishedAt` that isn't a
finite number.

**Why this matters:** an incomplete or malformed entry stored in KV makes the whole manifest
untrustworthy, and Phase 4 acts on what it finds there — an untrustworthy manifest is worse than
no manifest at all, because it drives decisions across ~42,000 articles instead of just failing
visibly. `putManifestEntriesBulk()` validates **every** entry in a call before issuing **any**
request for that call — a bad entry at position 20,001 of 25,000 cannot let the first two valid
batches land in KV while a partial third is silently dropped.

No write path — single or bulk — ever sets an `expiration`/`expiration_ttl`. A manifest entry that
expires would silently erase render state, which is the opposite of what the manifest exists to
record.

## Bulk writes

`putManifestEntriesBulk(entries)` batches at `KV_BULK_WRITE_MAX_PAIRS` (10,000 pairs) against the
Cloudflare KV bulk-write REST endpoint — `PUT
.../storage/kv/namespaces/{namespace_id}/bulk` — instead of one HTTP round trip per article. 25,000
entries produce exactly 3 requests (10,000 + 10,000 + 5,000), asserted directly by a request-count
test in `tests/unit/manifest-schema.test.mjs` rather than by inspection. `putManifestEntriesBulk([])`
issues zero requests and does not throw — the normal steady state once a build finds nothing
changed.

The 10,000-pair, <100MB-per-request ceiling is carried forward from 03-RESEARCH.md's own directly
fetched citation (`developers.cloudflare.com/kv/api/write-key-value-pairs/`, quoted there: *"Write
more than one key-value pair at a time with Wrangler or via the REST API. The bulk API can accept
up to 10,000 KV pairs at once."*). This task did not re-fetch that page live — the cloudflare-docs
MCP tool named in this plan's `<mcp_tools>` block was not present in this execution's available
tool surface, so the already-cited, already-directly-fetched research source was used rather than
either a fresh live lookup or an unverified assumption. It is explicitly **not** the same number as
D1's unrelated 100-bound-parameters-per-statement ceiling — the two limits come from different
Cloudflare products and were not carried over by analogy.

**Budget note:** building and testing bulk-write capability is in scope for this plan; running it
against the real ~41,233-article corpus is not, and would be a separate, budget-reviewed operation.
This document describes the capability as implemented and stub-tested, not as exercised at corpus
scale.

## What this does not guarantee

A manifest write and an asset deploy are **separate operations with no shared transaction.** The
render step (`astro build`) writes a manifest entry the moment it renders a page; a subsequent
`wrangler deploy` of that build's output is a distinct step that can fail, be skipped, or target a
different environment. A manifest entry can therefore claim a render that a failed deploy never
actually shipped — `renderedAt`/`buildHash` describe what the build produced, not what is
currently live.

**This is a known, accepted gap for this phase** (T-03-12 in 03-04-PLAN.md's threat register,
severity medium, disposition accept). The reconciliation mechanism is **Phase 4's incremental
build**, via content-hash comparison (REND-02/REND-03) — not this module. Building that
reconciliation here would mean building Phase 4's render loop inside Phase 3's scaffold. Phase 4
inherits this gap explicitly, in writing, here — rather than rediscovering it mid-implementation.

## What this does not consume

All manifest KV access — reads and writes both — happens at **build/render time only**, running in
Node during `astro build`. None of it happens inside the deployed Worker on the public request
path. This means manifest KV traffic does **not** count against PROJECT.md's public-request budget
of at most one KV read per request — someone will ask this, so it is stated here plainly rather
than left implied.

## Guard enforcement (T-03-02a correction)

**This section corrects an assumption 03-01-SUMMARY.md left implicit.** That summary describes
`src/lib/server/d1-client.ts` as "the single D1 chokepoint module" and states the D1-import
assertion (`tools/assert-no-d1.mjs`) protects it structurally. That was true for D1 access, but
this module — which reads `CLOUDFLARE_API_TOKEN` directly (four call sites, for the KV REST
API, not D1) — originally lived at `src/lib/kv-manifest.ts`, OUTSIDE the directory the guard
actually walked toward. A security audit ran the real guard against synthetic on-demand
page/island fixtures importing this module and found them **accepted**, while the guard's own
control case (an entrypoint importing `d1-client.ts`) was correctly rejected — proving the gap
was the forbidden set's scope, not a broken module-graph walk. No production exposure existed at
audit time (Phase 3 has no real on-demand route or island yet), but it would have opened silently
the moment Phase 4 introduces one.

**Fix:** this module moved to `src/lib/server/kv-manifest.ts`, and `tools/assert-no-d1.mjs` now
forbids the whole `src/lib/server/` directory rather than one filename — so this module, and any
future credential-holding module placed there, gets the same structural protection without a
guard edit. Verified two ways: `tests/ci-fixtures/assert-no-d1.test.mjs` Cases 5-6 (synthetic
page/island fixtures reaching `kv-manifest.ts`, both rejected) and a real `pnpm build` against a
temporary on-demand page importing this module directly (rejected, same as the fixture suite —
see the T-03-02a security remediation's execution report for the captured failing build output).

## Related

- Implementation: `src/lib/server/kv-manifest.ts`
- Tests: `tests/unit/manifest-schema.test.mjs` (schema/validation/hash/bulk-batching), `tests/tracer/tracer.test.mjs` (end-to-end against the real D1 row and real KV namespace), `tests/ci-fixtures/assert-no-d1.test.mjs` Cases 5-6 (T-03-02a guard coverage)
- Build-stamp source (`BUILD_HASH`): `src/lib/build-info.ts` (03-03)
- Decision record: `.planning/phases/03-foundation-read-budget-guardrails/03-04-PLAN.md` Task 1 (checkpoint), `.planning/phases/03-foundation-read-budget-guardrails/03-04-SUMMARY.md`
