# Phase 2: Content Quality & Grounding - Research

**Researched:** 2026-09-19
**Domain:** LLM content extraction, prompt engineering for faithfulness, grounding/hallucination
detection, OpenAI Batch API, Cloudflare D1 parameter limits
**Confidence:** MEDIUM — core mechanics (Batch API, D1 limits, extraction runtime) are HIGH
confidence (verified against official docs or the repo itself); grounding-check calibration and
`gpt-5.6-luna` pricing rest on live web search, not an official pricing page fetch that could be
independently loaded (see Sources).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Content Acquisition**
- **D-01:** Fetch the canonical article page for every article, from every source. Ignore feed
  bodies entirely rather than branching per source.
- **D-02:** On fetch failure: one retry with backoff, then fall back to the feed body, and
  record how each article's text was acquired (`fetched` / `feed_fallback` / `failed`) in a
  stored column.
- **D-03:** Extract article text with `linkedom` + Mozilla Readability. Named fallback if it
  does not fit the Worker runtime or bundle: `HTMLRewriter`. **UNVERIFIED at CONTEXT.md time —
  see Standard Stack below, now resolved.**
- **D-04:** The 6,000-character input cap at `server/utils/openai.ts:106` is raised to a
  measured value, not removed. Research measures the real article-length distribution across
  all three sources, sets a cap that keeps ~95% of articles whole, and re-costs the backfill at
  that input size.

**Summary Shape**
- **D-05:** The 100-200 word floor is replaced with proportional guidance plus a hard ceiling:
  summarise at whatever length the source supports, never exceed the source, enforce with the
  automated longer-than-source check (CONT-06).
- **D-06:** `keyPoints` is kept, moved out of the `summary` column into its own column, prompt
  rewritten to facts stated in the source only — no tips, no advice, no recommendations.
  Rows not re-processed keep inline markdown in `summary` (Phase 1's `summary-markdown.mjs`
  parser stays necessary for legacy rows).
- **D-07:** Attribution appears in the summary text for thin sources only. The branch is
  decided in code from the source word count; the model is never asked to judge thinness.

**Grounding Check**
- **D-08:** Detection is hybrid, with different policies for live ingest and backfill.
  Deterministic checks (advisory-phrase lexicon, longer-than-source, numbers/named entities
  present in summary but absent from source) plus an LLM entailment judge.
  - Live ingest: run *both* on every article (~150/day — judge cost negligible).
  - 41k backfill: deterministic sweep first (free), judge only what it flags.
- **D-09:** On a flag: retry once against a stricter prompt, then hold. Anything still flagged
  does not publish and enters a review queue with a visible count.
- **D-10:** The check is validated against a labelled fixture set drawn from the real corpus
  (the known fabrication plus known-good summaries), must catch all known-bad under a measured
  false-positive ceiling. Re-runnable whenever prompt or model changes.
- **D-11:** The grounding check also covers AI-generated titles, not only summaries.

**Re-processing**
- **D-12:** On re-processing, title and slug are frozen. Only `summary`, `keyPoints`, entities
  and tags update. New articles still receive AI-generated titles exactly as today.
- **D-13:** Archive re-processing re-summarises stored content and does not re-fetch source
  pages. (See Runtime State Inventory — this means archive rows sourced from KTSM/elpasonews
  stay thin; only EPM archive rows benefit from full-text re-summarisation.)
- **D-14:** The re-processing set is determined by the checks: sweep all 41,233 rows with free
  deterministic checks, judge what they flag, re-process the confirmed set plus the CONT-12
  outage window. The dry run reports that exact count and cost.
- **D-15:** The OPS-11 $1 gate is enforced by a two-command, report-gated split. Dry run
  computes count/cost, writes a report, calls nothing. Real run is separate, refuses to start
  unless pointed at a specific dry-run report, and aborts if the corpus has drifted since.

**Sources**
- **D-16:** The third source is repointed to `https://elpasonews.org/feed/` by updating
  `feed_url` on the existing source row. Publication-identity continuity is **not proven**.
  **OPEN for research:** when `elpasolocalnews.org` went dark and what corpus gap that left —
  **NOT RESOLVED in this research pass; see Open Questions, blocked on production D1 access.**

**Workflow**
- **D-17:** Phase 2 planning artifacts commit to `feature/phase-02` in this repo (915tldr.com).
- **D-18:** Phase 2 implementation lands on a new `feature/phase-02` branch in `915tldr.com2`,
  created by Jaime in lazygit off `develop`. **Blocker: branch does not exist yet — verified
  2026-09-19, see Environment Availability.**
- **D-19:** Both the prompt fix and the archive re-processing get public `/changelog` entries.

**Cautions carried into planning**
- **D-CAUTION-1:** Published cost figures (~$7.44 backfill, $0.48/month ongoing) are stale —
  computed against ~6,000-character truncated inputs. Must be re-derived. **Still open — see
  Environment Availability; requires production content-length measurement this research could
  not perform.**
- **D-CAUTION-2:** `linkedom` on Workers was unverified. **RESOLVED this session — see Standard
  Stack.**
- **D-CAUTION-3:** Third source's death date is unknown. **Still open.**

### Claude's Discretion
- The three FIX defects (FIX-01/02/03) — verified still open 2026-09-19, re-confirmed in this
  research pass (see Package Legitimacy Audit and Common Pitfalls).
- Prompt wording, code structure, module layout, chunk sizes, test organisation.
- Whether `server/utils/duplicate-detector.ts:182` (also on `gpt-4o-mini`) moves to
  `gpt-5.6-luna` alongside the summariser.

### Deferred Ideas (OUT OF SCOPE)
- Re-fetching archive source pages to enrich thin legacy summaries.
- Moving `duplicate-detector.ts` off `gpt-4o-mini`.
- Lowering `temperature` from 0.4 for faithfulness.
- Running the grounding judge on a different model than the summariser.
- Extending the grounding check to Spanish summaries — Phase 6.
- Whether fetched full text is stored or only summarised from.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CONT-01 | Content extraction no longer truncates mid-article; `[...]` marker rate near zero on new articles | D-01/D-02/D-03 resolved: full-page fetch + `linkedom/worker` + Readability confirmed Workers-compatible |
| CONT-02 | Summary length proportional to source, no fixed word floor | Prompt-design section: proportional-guidance pattern, replaces `openai.ts:75` word-count instruction |
| CONT-03 | Prompt explicitly prohibits advisories, CTAs, impact analysis, editorial framing absent from source | Prompt-design section; exact prohibited phrases the current prompt requests (`openai.ts:79`, `82-87`) |
| CONT-04 | Automated grounding check flags any claim not traceable to source | Grounding-check architecture: claim-extraction + NLI + LLM-judge cascade |
| CONT-05 | Grounding check catches the known "urged to remain vigilant" fabrication | Fixture-set validation pattern (D-10); the fabrication is a length-compliant advisory with zero source support — an NLI/entailment layer catches it, a lexicon-only approach is fragile |
| CONT-06 | Automated check flags any summary longer than its source | Deterministic check — pure string/token length comparison, near-zero cost |
| CONT-07 | Thin sources produce short summary or attributed excerpt, not verbatim-heavy quoting | Verbatim-overlap detection section: longest-common-substring + n-gram precision |
| CONT-08 | Summarisation runs on `gpt-5.6-luna` | Standard Stack: pricing and Batch API support confirmed |
| CONT-09 | Dry run reports exact row count and projected cost before re-processing | Cost-projection section: tokenizer-based estimate, `o200k_base` encoding |
| CONT-10 | Affected archive re-processed once via Batch API after explicit approval | OpenAI Batch API Operational Semantics section |
| CONT-11 | Batch jobs handle the 24-hour window — unfinished work detected and resubmitted | OpenAI Batch API Operational Semantics section — exact JSONL shapes |
| CONT-12 | OpenAI outage window (2026-09-04→09-16) articles audited for gaps | Runtime State Inventory + Environment Availability — **cannot be completed without production D1 access; flagged as Wave 0 blocker** |
| FIX-01 | `reprocess-all.post.ts` chunks ID lists to ≤100 bound params | Common Pitfalls: exact line numbers verified, chunk-size arithmetic (params-in-SET count against the ceiling too) |
| FIX-02 | `pnpm deploy`/`deploy:dev` resolve `wrangler` as a real dependency | Verified: `wrangler` absent from `package.json` and `node_modules/.bin`; current version 4.135.0 |
| FIX-03 | `app/pages/privacy.vue` passes Prettier | Verified: `npx prettier --check` fails today |
| OPS-11 | No operation >$1 runs without approval and an estimate | D-15's two-command dry-run/execute split; cost-projection section |
</phase_requirements>

## Summary

Phase 2 fixes three independent defects in `915tldr.com2` (the v1 Nuxt pipeline, not this repo):
content arrives pre-truncated by upstream feeds, the summarisation prompt rewards padding and
invents advisories, and nothing checks whether a claim in a summary is actually supported by its
source. All three are verified still present in the current codebase as of this session — the
exact lines are cited below with line numbers, not paraphrased.

The extraction fix (`linkedom/worker` + Mozilla Readability) is now **confirmed** Workers-runtime
compatible, resolving D-CAUTION-2 — use the `linkedom/worker` entry point (not the default
Node-oriented one), which avoids the `canvas` dependency and reads `performance` off
`globalThis`. The grounding-check design should follow a claim-extraction-then-verify cascade
(NLI-style entailment as a first pass, LLM-as-judge only on ambiguous/high-risk claims) rather
than a single-pass judge call or a lexicon alone — a lexicon catches the known fabrication's
*vocabulary* but not the general case CONT-04 requires, and a pure LLM-judge-on-everything
approach is the most expensive option for no better recall than the cascade. At ~150 articles/day
live-ingest volume, even a full LLM-judge-on-every-article policy (which is what D-08 actually
locks in for live ingest, not the cascade — see Grounding Check Architecture) costs under
$0.25/month, so the "hybrid, split by ingest vs. backfill" decision the owner made is
economically sound regardless of which detection method sits inside "the judge."

**The single largest risk to this phase's planning is not technical, it is access.** `wrangler`
is not installed anywhere in `915tldr.com2` — confirming FIX-02 — and the project's own scripts
(`sync-prod-to-dev.sh`) assume `wrangler d1 execute --remote` for any production D1 read. The
local Miniflare D1 replica is 87 rows, last synced 2025-12-21 — nine months stale and useless for
either the CONT-12 outage audit, the D-16 death-date lookup, or the D-04 length-distribution
measurement. **None of D-CAUTION-1's re-costing, D-16's death-date research, or the CONT-12
outage-window count could be completed in this research pass** — they require either installing
and authenticating `wrangler`, or standing up direct D1 REST API access, before Wave 0 of
planning can produce real numbers. This is not a research gap that more searching closes; it is
a credential/tooling gap the plan must open with as its first task.

**Primary recommendation:** Sequence Wave 0 as "get production D1 read access working" (install
`wrangler`, satisfying FIX-02 simultaneously, then authenticate) before any measurement-dependent
task — the length-distribution cap (D-04), the outage audit (CONT-12), the death-date lookup
(D-16), and the dry-run cost projection (CONT-09) all depend on it and cannot be estimated from
this machine.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Full-page fetch + extraction (D-01/D-03) | API/Backend (Cloudflare Worker, Nuxt cron route) | — | Runs inside `server/api/cron/fetch.post.ts`; must work inside the Workers runtime, not Node |
| Summarisation prompt (D-05/D-06/D-07) | API/Backend | — | `server/utils/openai.ts`, called from the same Worker |
| Grounding check (D-08–D-11) | API/Backend | — | New module invoked after summarisation, inside the same request/cron lifecycle, gating the D1 write |
| Re-processing dry-run / execute (D-13–D-15) | API/Backend (as a script invoked via `wrangler`/admin route, not a public route) | Database/Storage | Reads/writes D1 directly; OPS-11 gate is enforced in this tier, never client-exposed |
| Acquisition-status column, keyPoints column (D-02/D-06) | Database/Storage | API/Backend | Schema migration in `server/db/schema.ts`; written by the API tier |
| Changelog entries (D-19) | Database/Storage (public_changelogs table) + CDN/Static (public changelog.json) | — | Existing two-layer mechanism (`server/api/admin/changelog`, `public/changelog.json`) — no new mechanism needed |

This phase has **no browser/client-tier or v2-Astro-tier work** — everything lands in the v1 Nuxt
Worker (`915tldr.com2`), consistent with CONTEXT.md's phase boundary ("Almost all code lands in
`915tldr.com2`... Nothing ships to the v2 public site here").

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `linkedom` | **0.18.13** (npm, current) [VERIFIED: npm registry] | DOM implementation for Workers, feeds Readability | `linkedom/worker` is the Worker-specific entry point — avoids the `canvas` module and reads `performance` from `globalThis` instead of Node's `perf_hooks` [CITED: aggregated web search, not independently confirmed against linkedom's own README this session — see Sources] |
| `@mozilla/readability` | **0.6.0** (npm, current) [VERIFIED: npm registry] | Firefox Reader-Mode extraction algorithm; site-agnostic article body extraction | Site-agnostic means adding/replacing a source (D-16 already forces this) costs zero extraction code; requires a DOM `Document`, which `linkedom/worker`'s `parseHTML()` supplies | 
| `wrangler` | **4.135.0** (npm, current) [VERIFIED: npm registry] | Build/deploy CLI and D1 remote access | Currently **absent from `915tldr.com2`'s `package.json` and `node_modules`** — this is FIX-02 itself. Installing it is both the FIX-02 fix and the prerequisite for every production-D1-dependent research/planning task this phase needs |
| `openai` | **7.19.0** (npm, current) [VERIFIED: npm registry] — installed: **6.15.0** per `package.json` | OpenAI SDK, chat completions + Batch API | Already a dependency; a minor version bump (6→7) is available but not required by this phase — Batch API endpoints (`client.batches.create`, `client.files.create`) are stable across both |
| `js-tiktoken` | **1.0.21** (npm, current) [VERIFIED: npm registry] | Token counting for the CONT-09 cost-projection dry run | Needed to estimate input/output tokens *before* submitting, since Batch API cost cannot be known without counting tokens; use `getEncoding('o200k_base')` for `gpt-5.6-luna` [ASSUMED — single web-search source, see Sources; not cross-checked against tiktoken's own model-to-encoding table] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None new required for grounding check | — | The deterministic checks (length, lexicon, entity-presence) and verbatim-overlap detection (longest-common-substring, n-gram precision) are pure string/array algorithms — no NLI model package is necessary if the LLM-judge call itself is asked to also return an entailment verdict per claim (folding NLI into the judge prompt rather than running a separate local NLI model) | Recommended for this phase's scale (~150/day live, tens of thousands backfill) — avoids introducing a second model/runtime dependency (e.g., a local NLI model needing its own inference path) for a check that already has an LLM call in the loop |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `linkedom` + Readability | `HTMLRewriter` (Cloudflare-native) | D-03's own named fallback; zero deps, but requires hand-written per-site selectors — reintroduces the per-source maintenance D-01 explicitly rejected. Only fall back to this if `linkedom/worker` fails in practice inside this specific Worker's bundle (untested — see Open Questions) |
| LLM-judge-per-claim inline in the summarisation call | Separate local NLI model (e.g., a small entailment classifier) | A dedicated NLI model is faster/cheaper per claim at very high volume, but adds a second model dependency and inference path for a check running at ~150/day live + a one-time backfill sweep — not worth the operational complexity at this scale |
| `js-tiktoken` `o200k_base` for cost estimation | Character-count heuristic (chars ÷ 4 ≈ tokens) | Faster to implement, no dependency, but less accurate — use as a documented fallback only if `o200k_base` estimation is later found to diverge materially from actual Batch API billed usage (compare against `usage.prompt_tokens`/`usage.completion_tokens` from a small live test batch before trusting either for the full dry-run report) |

**Installation:**
```bash
pnpm add linkedom @mozilla/readability js-tiktoken
pnpm add -D wrangler
```

**Version verification:** confirmed live against npm registry 2026-09-19 via `npm view <pkg>
version`. `wrangler` and `openai`'s package-legitimacy check flagged both `SUS` for "too-new" —
see Package Legitimacy Audit; this reflects a very recent patch release, not package age (both
have tens of millions of weekly downloads and long-established GitHub repos).

## Package Legitimacy Audit

| Package | Registry | Age (first seen) | Downloads/wk | Source Repo | Verdict | Disposition |
|---------|----------|-------------------|--------------|-------------|---------|-------------|
| `linkedom` | npm | latest publish 2026-07-07 | 3,949,784 | github.com/WebReflection/linkedom | OK | Approved |
| `@mozilla/readability` | npm | latest publish 2025-03-03 | 2,198,660 | github.com/mozilla/readability | OK | Approved |
| `wrangler` | npm | latest publish 2026-09-18 | 16,212,853 | github.com/cloudflare/workers-sdk | SUS ("too-new") | Flagged — planner should add a `checkpoint:human-verify` before pinning the exact patch version, but the "too-new" signal here is a same-day patch release against an official Cloudflare monorepo with 16M weekly downloads, not a slopsquat risk |
| `openai` | npm | latest publish 2026-09-18 | 28,836,047 | github.com/openai/openai-node | SUS ("too-new") | Flagged — same reasoning as `wrangler`; official OpenAI SDK, already an existing dependency at an older pinned version (6.15.0) |
| `js-tiktoken` | npm | — | — | github.com/dqbd/tiktoken | Not run through the legitimacy gate this session — verify before install | Verify with `npm view js-tiktoken` before pinning |

**Packages removed due to SLOP verdict:** none.
**Packages flagged as suspicious (SUS):** `wrangler`, `openai` — both flagged purely on
publish-date recency of the current version, not on any structural risk signal (no missing repo,
no anomalous download count, no postinstall script). The planner should still add a
`checkpoint:human-verify` before pinning either exact patch version, per protocol, but should not
treat this the same as an unknown/low-download package.

## Architecture Patterns

### System Architecture Diagram

```
RSS feed poll (cron)
      │
      ▼
[fetch.post.ts] ── new item found ──► fetch canonical article page (D-01)
      │                                      │
      │                              success │ failure → retry w/ backoff (D-02)
      │                                      │                  │
      │                                      ▼                  ▼ still fails
      │                          [linkedom/worker + Readability]  feed_fallback
      │                                extraction (D-03)          (stored + flagged)
      │                                      │
      │                                      ▼
      │                          store: content, acquisition_status
      │
      ▼
[process.post.ts] ── pending articles ──► [processArticleWithAI] (openai.ts)
                                                  │
                                    proportional-length prompt (D-05/06/07)
                                    gpt-5.6-luna (CONT-08)
                                                  │
                                                  ▼
                                    { title, summary, keyPoints, tags,
                                      category, entities }
                                                  │
                                                  ▼
                                    ┌─────────────────────────────┐
                                    │   GROUNDING CHECK (new)      │
                                    │  1. deterministic: length,   │
                                    │     lexicon, entity-presence │
                                    │     (CONT-06, part of -04)   │
                                    │  2. LLM entailment judge     │
                                    │     (title + summary vs.     │
                                    │     source) — every live     │
                                    │     article (D-08)           │
                                    └──────────────┬───────────────┘
                                          flagged?  │  clean
                                     ┌──────yes─────┘
                                     ▼
                          retry once, stricter prompt (D-09)
                                     │
                          still flagged?──no──► publish
                                     │yes
                                     ▼
                          hold + review queue (visible count)

[Separate, offline path — CONT-09/10/13/14/15]
41,233-row corpus
      │
      ▼
[dry-run script] ── deterministic sweep (free) ──► candidates
      │                                                  │
      │                                     judge only candidates (cost)
      │                                                  │
      ▼                                                  ▼
  writes report (rows, $ cost) ◄──────────────────────────
      │
      │  owner approves, points execute-run at this report file
      ▼
[execute-run script] ── re-verify corpus unchanged ──► build Batch JSONL
                                                              │
                                                              ▼
                                                  OpenAI Batch API (24h window)
                                                              │
                                          ┌───────────────────┴────────────────┐
                                          ▼                                    ▼
                                completed → output_file_id          expired → error_file_id
                                          │                                    │
                                          ▼                        parse custom_id where
                              update summary/keyPoints/            code == "batch_expired" →
                              entities/tags (title/slug frozen,     resubmit only those (CONT-11)
                              D-12)
```

### Recommended Project Structure (additions to `915tldr.com2`)
```
server/
├── utils/
│   ├── openai.ts              # prompt rewrite (D-05/06/07), model → gpt-5.6-luna
│   ├── content-extractor.ts   # add linkedom/worker + Readability extraction fn
│   ├── grounding-check.ts     # NEW: deterministic checks + LLM judge cascade
│   ├── verbatim-overlap.ts    # NEW: longest-common-substring + n-gram precision
│   └── chunk.ts                # NEW: generic ≤100-param chunking helper (FIX-01 + reuse)
├── db/
│   └── schema.ts               # + keyPoints column, + acquisition_status column
scripts/
├── reprocess-dry-run.mjs       # NEW: D-14/D-15 — writes cost report, calls nothing
└── reprocess-execute.mjs       # NEW: D-15 — requires --report <path>, aborts on drift
```

### Pattern 1: Deterministic-branch-in-code, never model-judged
**What:** Where a rule depends on a property the code can compute (source word count, whether a
summary is longer than its source, whether an advisory phrase appears), compute it in code and
either select a prompt variant or reject the output — never ask the model to self-assess the
property.
**When to use:** D-07 (attribution branch), CONT-06 (length check), the lexicon layer of D-08.
**Example (length check, CONT-06):**
```typescript
// Deterministic — no model call needed.
function summaryExceedsSource(summary: string, sourceContent: string): boolean {
  return summary.trim().length > sourceContent.trim().length
}
```

### Pattern 2: Claim-extraction-then-verify grounding cascade
**What:** Decompose the summary (and title, per D-11) into atomic claims, check each claim for
a supporting span in the source, and only escalate ambiguous/unsupported claims to a full
LLM-judge call rather than judging the whole summary in one pass.
**When to use:** D-08's LLM entailment judge — this is the internal design of "the judge," not a
replacement for it. A single-pass "does this summary match this source, yes/no" prompt is weaker
at multi-hop and partial-fabrication cases (a sentence with one true fact and one invented claim
reads as "mostly true" to a whole-summary judge).
**Example (judge call shape):**
```typescript
// Source: pattern synthesized from Perplexity-sourced comparison of grounding-check
// architectures (see Sources) — not copied from a single official doc.
interface ClaimVerdict {
  claim: string
  supported: boolean
  sourceSpan: string | null   // exact substring of sourceContent, or null if unsupported
}

interface GroundingResult {
  claims: ClaimVerdict[]
  titleSupported: boolean      // D-11: title checked too
  flagged: boolean             // true if any claim/title is unsupported
}
```
The judge prompt should require every claim to cite an exact `sourceSpan` substring, and the
code should verify that span actually occurs in `sourceContent` (a cheap string `.includes()`
check) rather than trusting the model's claim that it found one — this catches a judge that
hallucinates its own supporting citation.

### Pattern 3: Chunked D1 writes respecting the empirical 100-param ceiling
**What:** Any `inArray(column, ids)` call — or any statement combining `SET` values with an
`inArray` `WHERE` — must keep **total bound parameters per statement** at or under 100, not just
the length of the ID array.
**When to use:** FIX-01 (`reprocess-all.post.ts`), and any new batched write this phase adds
(the re-processing execute script writing back `summary`/`keyPoints`/entities/tags for
thousands of rows).
**Example:**
```typescript
// chunk.ts
export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

// reprocess-all.post.ts — the UPDATE binds 3 SET values (status, processedAt, summary)
// PLUS one param per ID in the WHERE inArray. 100 total params means the ID chunk for
// THIS statement must be ≤97, not 100 — see Common Pitfalls.
for (const idChunk of chunk(articleIds, 97)) {
  await db.update(schema.articles)
    .set({ status: 'pending', processedAt: null, summary: null, updatedAt: sql`(unixepoch())` })
    .where(inArray(schema.articles.id, idChunk))
}
// The three DELETE statements bind zero SET params, so their chunks can use the full 100:
for (const idChunk of chunk(articleIds, 100)) {
  await db.delete(schema.articleTags).where(inArray(schema.articleTags.articleId, idChunk))
  // ...articleCategories, articleEntities identically
}
```

### Anti-Patterns to Avoid
- **Single flat chunk size across all four `inArray` statements in `reprocess-all.post.ts`:**
  the UPDATE statement carries 3 extra bound `SET` params (`status`, `processedAt`, `summary`);
  a chunk size of exactly 100 there produces 103 total bound params and reproduces the exact
  `SQLITE_ERROR` FIX-01 exists to fix. `updatedAt: sql\`(unixepoch())\`` does **not** count — it
  is an unparameterised raw SQL fragment, verified by reading `ai-processor.ts:105-113` and
  `reprocess-all.post.ts:49-56` this session.
- **Trusting `wrangler d1 execute --remote --json` output structure without checking `results`
  nesting:** the existing `sync-prod-to-dev.sh` script reads `data[0]?.results`, confirming the
  JSON output wraps each statement's rows one level deep — a new script parsing this output
  must match that shape, not assume a flat array.
- **Judging the whole summary as one blob:** loses the ability to say *which* claim is
  unsupported, which the review queue (D-09) needs to be actionable rather than "something in
  this article is wrong."

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DOM parsing on Workers | A regex-based HTML-to-text pipeline (the existing `cleanHtmlContent` in `content-extractor.ts`) as the *primary* extractor | `linkedom/worker` + `@mozilla/readability` | The existing regex cleaner has no concept of "the article body" vs. nav/footer/ads — it strips tags but does not select content. `cleanHtmlContent` remains useful as a *post-processing* step after Readability, not as the extractor itself |
| Token counting for cost estimation | A hand-rolled character-to-token heuristic as the primary method | `js-tiktoken` with `o200k_base` | A hand-rolled heuristic is the documented fallback only, not the default — OPS-11's $1 gate and CONT-09's "exact... projected cost" wording argue for the more accurate tokenizer-based estimate as primary, with the heuristic as a sanity-check floor |
| Batch job retry tracking | A custom "which requests finished" ledger | The `error_file_id`'s `custom_id` + `code: "batch_expired"` records, per OpenAI's own documented shape | OpenAI already returns exactly the information needed to compute the unfinished remainder — building a separate tracking table duplicates data the API already provides authoritatively |

**Key insight:** every "don't hand-roll" item above already has an off-the-shelf answer that is
either already installed in the neighboring ecosystem (Workers-compatible DOM) or already
returned by the API being called (Batch error file). This phase's real engineering effort is in
wiring these together and in the grounding-check *prompt design*, not in building infrastructure
that already exists.

## Runtime State Inventory

This phase is not a rename/refactor, but D-13's re-processing plan and D-16's source repoint both
touch stored state in ways worth inventorying explicitly.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `articles.content` already stores full extracted text for El Paso Matters (up to ~35,000 chars per CONTEXT.md's 2026-09-18 sample) but only the truncated `[...]`-marked teaser for KTSM and `elpasonews.org` — verified by reading `fetch.post.ts:119,150` and `rss.ts:92,162`, which show `content` is populated from `content:encoded` falling back to `description`, with no length cap applied at storage time (the 6,000-char cap lives only in `openai.ts:106` at prompt-build time). **Consequence for D-13:** re-summarising stored content fixes fabrication corpus-wide but does not fix thinness for KTSM/elpasonews-sourced archive rows — matches CONTEXT.md's own stated tradeoff, now independently confirmed at the code level. | Re-processing script must not assume uniform content quality across sources; the dry-run report (CONT-09) should break down row counts by source so the owner sees which fraction of the re-processing set is "fabrication-fixed only" vs. "fabrication-fixed and length-improved." |
| Live service config | The `sources` table row for the third source (`feed_url` currently pointing at NXDOMAIN `elpasolocalnews.org`) — this is DB-stored config, not a git-tracked file; D-16's repoint is a single-row UPDATE, not a code change. | Update `feed_url` via an admin action or migration script, not a code deploy. |
| OS-registered state | None found — this phase's re-processing is triggered via an admin endpoint / script invocation, not a cron/OS-level registration. | None. |
| Secrets/env vars | `OPENAI_API_KEY`, `CLOUDFLARE_API_TOKEN` (for `wrangler`/D1 REST access) — existence not directly readable this session (`.env` read was blocked by a deny rule); presence/absence of `CLOUDFLARE_API_TOKEN` specifically could not be confirmed. | Planner must verify a valid, scoped Cloudflare API token or authenticated `wrangler` session exists before Wave 0's measurement tasks can run — this is a blocking unknown, not a confirmed gap. |
| Build artifacts | None specific to this phase — no package/script renames occur. | None. |

## Common Pitfalls

### Pitfall 1: Chunk size that ignores non-ID bound parameters
**What goes wrong:** Chunking `articleIds` to exactly 100 per `inArray` call reproduces the
`SQLITE_ERROR: too many SQL variables` FIX-01 exists to fix, if that same statement also binds
other `SET` values.
**Why it happens:** D1's 100-parameter ceiling (verified empirically by this project on
2026-09-15, per the `8552b9e` commit message: "100 succeeds, 101 fails with 'too many SQL
variables at offset 226: SQLITE_ERROR'") counts **every bound parameter in the statement**, not
just the length of an `IN (...)` list.
**How to avoid:** For `reprocess-all.post.ts`'s UPDATE (3 `SET` params: `status`, `processedAt`,
`summary` — `updatedAt` is a raw `sql` fragment, not a bound param, verified by reading lines
49-56), cap ID chunks at 97. For the three DELETE statements (zero extra `SET` params), 100 is
safe.
**Warning signs:** The exact error string `too many SQL variables at offset N: SQLITE_ERROR` in
Worker logs; only reproduces once the corpus exceeds 100 rows in the affected status, which is
why this bug is easy to miss in local/dev testing against a handful of seed rows.

### Pitfall 2: Re-fetching the archive under D-13's "no re-fetch" decision
**What goes wrong:** A future engineer (or an agent under time pressure) "fixes" a thin archive
summary by re-fetching its source page during the re-processing run, silently expanding scope
from a pure Batch job (no network) into ~41k HTTP requests against two newsrooms' servers with
an unknown 404 rate — exactly what D-13 rejected.
**Why it happens:** It looks like the "better" fix, and the code path for fetching pages already
exists from D-01.
**How to avoid:** The re-processing execute script should structurally have no network-fetch
capability at all — it should only read `articles.content` and call the summarisation endpoint,
never `fetch()` an external URL. Enforce this at the module boundary (the script imports only
`processArticleWithAI`/DB utilities, not `content-extractor.ts`'s page-fetch function).
**Warning signs:** Any `fetch(article.url, ...)` call appearing inside the re-processing script.

### Pitfall 3: Trusting the local D1 replica or a stale `db:sync-to-local` snapshot for measurement
**What goes wrong:** Using the Miniflare local D1 file to answer "what's the real article-length
distribution" or "how many articles fell in the outage window" produces confidently wrong
numbers, because the local file is a stale, tiny snapshot.
**Why it happens:** It's the path of least resistance — no auth needed, `sqlite3` works
immediately, and it silently succeeds rather than erroring.
**How to avoid:** Verified this session: `./.wrangler/state/v3/d1/.../<hash>.sqlite` contains
**87 rows**, last modified **2025-12-21** — nine months before the September 2026 outage window
and roughly 474x smaller than the real 41,233-row corpus. Any measurement query for this phase
(D-04's length distribution, CONT-12's outage count, D-16's death-date lookup) must run against
**production** via `wrangler d1 execute 915tldr-db --remote` (the pattern the project's own
`sync-prod-to-dev.sh` already uses) or the D1 REST API, never the local file.
**Warning signs:** A measurement query returning suspiciously small row counts (tens, not
thousands); a modification/last-sync date visibly predating the window being measured.

### Pitfall 4: Assuming `js-tiktoken`'s model-name lookup recognizes `gpt-5.6-luna`
**What goes wrong:** Calling `encodingForModel('gpt-5.6-luna')` may throw if the installed
`js-tiktoken` version's model-to-encoding table has not been updated for this model name, since
`gpt-5.6-luna` is a very recent model (this claim is [ASSUMED] — not independently verified
against `js-tiktoken`'s source this session).
**Why it happens:** Model-to-encoding lookup tables in tokenizer libraries lag model releases.
**How to avoid:** Call `getEncoding('o200k_base')` directly rather than the model-name lookup
function, and validate the resulting token count against a small live API call's
`usage.prompt_tokens` before trusting it for the full CONT-09 dry-run report.
**Warning signs:** An exception naming an unrecognized model string at dry-run time.

## Code Examples

### OpenAI Batch API job submission and status polling
```typescript
// Source: OpenAI official docs (developers.openai.com/api/docs/guides/batch),
// fetched directly this session — see Sources.
import OpenAI from 'openai'

const client = new OpenAI({ apiKey })

// 1. Upload the JSONL request file (one line per article, each with a unique custom_id)
const file = await client.files.create({
  file: fs.createReadStream('batch-requests.jsonl'),
  purpose: 'batch',
})

// 2. Create the batch job — completion_window is currently ONLY '24h', no other value works
const batch = await client.batches.create({
  input_file_id: file.id,
  endpoint: '/v1/chat/completions',
  completion_window: '24h',
})

// 3. Poll for completion (status becomes 'completed', 'failed', or 'expired')
const status = await client.batches.retrieve(batch.id)

// 4. On 'expired' or 'completed': always fetch BOTH files — completed work is in
//    output_file_id even for an expired batch (partial results).
if (status.output_file_id) {
  const output = await client.files.content(status.output_file_id)
  // one JSON object per line, custom_id + response.body — order NOT guaranteed
}

if (status.error_file_id) {
  const errors = await client.files.content(status.error_file_id)
  // parse each line; entries with error.code === 'batch_expired' are the
  // unfinished remainder (CONT-11) — extract their custom_id, rebuild those
  // specific requests from the original input, and submit a NEW batch containing
  // only them. There is no automatic retry — this is a manual resubmit step.
}
```

### Token-based cost projection before submitting a batch (CONT-09)
```typescript
// Source: pricing figures from live web search (Perplexity + WebFetch of
// developers.openai.com/api/docs/pricing), cross-checked, both agreeing exactly —
// see Sources. NOT independently re-verified against a screenshot of the page.
import { getEncoding } from 'js-tiktoken'

const enc = getEncoding('o200k_base')

// gpt-5.6-luna Batch API pricing (50% of standard synchronous rates):
const BATCH_INPUT_PER_M = 0.10   // USD per 1,000,000 input tokens
const BATCH_OUTPUT_PER_M = 0.60  // USD per 1,000,000 output tokens

function estimateArticleCost(promptText: string, estimatedOutputTokens: number): number {
  const inputTokens = enc.encode(promptText).length
  return (
    (inputTokens / 1_000_000) * BATCH_INPUT_PER_M +
    (estimatedOutputTokens / 1_000_000) * BATCH_OUTPUT_PER_M
  )
}

// Sum estimateArticleCost() across the confirmed re-processing set (D-14) to get
// CONT-09's "projected cost in dollars" BEFORE building the JSONL batch file.
// Validate against a small (~10-article) real batch's usage.prompt_tokens /
// usage.completion_tokens before trusting the full-corpus estimate.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Fixed 100-200 word summary floor | Proportional length + hard ceiling (never exceed source) | This phase (D-05) | Removes the exact mechanism that produced both padding and the fabricated advisory |
| `gpt-4o-mini` (Aug 2024 model) | `gpt-5.6-luna` | This phase (CONT-08) | Per PROJECT.md, chosen for "best instruction-following in the cheap tier" — directly targets the padding defect, which is an instruction-following failure, not a capability gap |
| Whole-summary "does this look right" review (implicit, none exists today) | Claim-level extraction + entailment verification | This phase (D-08) | Catches partial fabrications a whole-summary judge misses — a sentence with one true fact and one invented advisory reads as "mostly accurate" to a coarse judge |
| Single 6,000-char slice fed to prompt regardless of source | Measured cap keeping ~95% of articles whole (D-04) | This phase | EPM articles reaching ~35,000 chars were being cut at roughly 17% of their length before — a direct contributor to earlier defects, though the padding/fabrication defect is prompt-driven, not truncation-driven |

**Deprecated/outdated:**
- The `formatSummaryWithKeyPoints` concatenation pattern (`ai-processor.ts:105-113`) that pastes
  `**Key Details:**` markdown into the `summary` column is superseded by D-06's dedicated
  `keyPoints` column for newly-processed rows — but the parser (`summary-markdown.mjs`) must stay
  live for legacy, not-yet-reprocessed rows (D-06's explicit "consequence for the planner").

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `linkedom/worker` avoids the `canvas` dependency and reads `performance` from `globalThis`, making it Workers-compatible | Standard Stack, Architecture Patterns | If wrong, extraction throws at runtime in the actual deployed Worker despite working in isolated testing — the planner should schedule an early spike task that runs `linkedom/worker` + Readability inside an actual `wrangler dev` session against a real KVIA/KTSM/EPM URL before committing further plan waves to it |
| A2 | `js-tiktoken`'s `o200k_base` encoding is the correct tokenizer for `gpt-5.6-luna` | Standard Stack, Code Examples | If wrong, the CONT-09 cost projection is systematically off — mitigated by the recommendation to validate against a real small batch's `usage` object before trusting the full estimate |
| A3 | `gpt-5.6-luna` pricing: $0.20/$1.20 per 1M input/output tokens standard, $0.10/$0.60 batch (50% discount), $0.02 cached input | Standard Stack, Code Examples, Summary | If wrong, every cost figure in the dry-run report and D-CAUTION-1's re-costing is wrong — this is the single highest-impact assumption in this document given OPS-11's $1 approval gate. Sourced from two independent live queries (Perplexity search + WebFetch of `developers.openai.com/api/docs/pricing`) that returned identical numbers, raising confidence above a single-source claim, but neither this agent nor the planner has an independent screenshot/PDF of OpenAI's own pricing page to check against |
| A4 | robots.txt/User-Agent/rate-limiting posture (10-15s per-host interval, honest User-Agent string, conditional requests) | Deferred/Open Questions | Low risk to correctness, but ignoring it risks a source blocking the aggregator's IP outright — recommend the planner treat this as a real (if small) task, not skip it entirely, since D-01 puts this pipeline on two newsrooms' servers daily going forward |
| A5 | `gpt-5.6-luna` supports the Batch API and JSON/structured-outputs mode identically to other current chat-completions models | Code Examples, OpenAI Batch API section | If wrong (e.g., some parameter or response-format restriction specific to this model), the Batch JSONL requests could fail in bulk at submission time rather than per-request — recommend a small (~5-10 article) live Batch test before the full-corpus CONT-10 run, which D-15's two-command structure already supports as a natural checkpoint |

**If this table is empty:** N/A — see entries above; none of these are compliance/retention/
security claims, all are technical/cost claims subject to the verification protocol.

## Open Questions

1. **When did `elpasolocalnews.org` go dark, and what corpus gap did that leave? (D-16,
   D-CAUTION-3)**
   - What we know: it currently returns NXDOMAIN (re-verified by the user's own session,
     2026-09-18 16:10 MDT, per CONTEXT.md).
   - What's unclear: the last successful fetch date from that source, and whether any gap
     overlaps the CONT-12 outage window.
   - Recommendation: query production D1 (`SELECT MAX(published_at) FROM articles a JOIN
     sources s ON a.source_id = s.id WHERE s.feed_url LIKE '%elpasolocalnews%'` or equivalent)
     via `wrangler d1 execute --remote` once wrangler is installed and authenticated — this
     research pass could not reach production D1 to answer it.

2. **How many articles in the 2026-09-04→2026-09-16 OpenAI outage window have a null,
   truncated, or absent summary, and did `detect-duplicates` run for them? (CONT-12)**
   - What we know: `cron/process.post.ts`, `cron/fetch.post.ts`, and
     `cron/detect-duplicates.post.ts` all call OpenAI and would 429 during that window
     (STATE.md's own "URGENT, Phase 3" blocker note, and the roadmap's Measurement Obligations
     table, both corroborate the outage dates and affected endpoints).
   - What's unclear: the exact row count — this is a production-D1 query this research pass
     could not run.
   - Recommendation: first task of Wave 0, immediately after wrangler is installed/authenticated
     — this number sizes the re-processing set (D-14) and gates the CONT-09 dry run.

3. **What is the real content-length distribution across all three sources, needed to set the
   D-04 raised cap? (D-04, D-CAUTION-1)**
   - What we know: CONTEXT.md's own 2026-09-18 sample: El Paso Matters at 5,904/2,355/710 words
     (three articles, [CITED: CONTEXT.md, not independently re-verified this session — no
     production D1 access]); KTSM and elpasonews ship only a ~55-word truncated teaser with zero
     `content:encoded`.
   - What's unclear: the full distribution (p50/p90/p95) across the whole corpus, needed to pick
     a cap that keeps ~95% of articles whole per D-04's own wording.
   - Recommendation: a production D1 query computing `LENGTH(content)` percentiles per source,
     run once wrangler access exists — feeds directly into both the prompt's input cap and the
     re-costing of D-CAUTION-1's stale figures.

4. **Does `linkedom/worker` + Readability actually work inside this specific
   `915tldr.com2` Worker bundle (real bundle size, real compatibility flags)?**
   - What we know: the combination is reported Workers-compatible in general (see Standard
     Stack), and Cloudflare's Node-compat default changed for compatibility dates ≥2026-08-04.
   - What's unclear: `915tldr.com2`'s actual `wrangler.jsonc` compatibility_date and whether the
     existing bundle already sets `nodejs_compat` — this session did not check
     `wrangler.jsonc`'s `compatibility_date` field.
   - Recommendation: check `wrangler.jsonc` compatibility_date directly, and run a real
     `wrangler dev` spike against one live URL per source before committing further plan waves
     to this extraction path.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `wrangler` CLI, installed | FIX-02, all production-D1 measurement tasks (D-04, D-16, CONT-12) | ✗ — verified via `which wrangler` (not found) and absent from `node_modules/.bin` and `package.json` | — | None viable — this is a hard blocker for every measurement-dependent task in this phase; installing it is itself FIX-02 |
| `wrangler` authenticated session or `CLOUDFLARE_API_TOKEN` | Same as above | Could not be verified this session — `.env`/`.dev.vars` reads were blocked by a deny rule in this environment | — | If no token exists, the D1 REST API (`POST .../d1/database/{id}/query`) is a documented alternative that only needs an API token, not a full `wrangler login` |
| `915tldr.com2` `feature/phase-02` branch | D-18 (all implementation work) | ✗ — confirmed absent; repo currently on a different branch per CONTEXT.md's own note | — | Jaime creates it in lazygit; blocks implementation start, not planning |
| Local Miniflare D1 replica | — (explicitly NOT a valid substitute) | ✓ exists but stale (87 rows, last synced 2025-12-21) | — | Not usable as a fallback for any real measurement — see Common Pitfalls Pitfall 3 |
| `sqlite3` CLI (for inspecting the local replica) | Ad-hoc local dev queries only | ✓ available on this machine | — | — |

**Missing dependencies with no fallback:**
- `wrangler` installed and authenticated (or an equivalent D1 REST API token) — blocks D-04,
  D-16, CONT-12, and D-CAUTION-1's re-costing. This must be the first item of Wave 0.

**Missing dependencies with fallback:**
- `wrangler` authentication specifically could fall back to direct D1 REST API calls with a
  Cloudflare API token, if a full `wrangler login` is undesirable in the execution environment.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest **4.0.16** [VERIFIED: `915tldr.com2/package.json` devDependencies] |
| Config file | `915tldr.com2/vitest.config.ts` |
| Quick run command | `pnpm test` (watch mode) or targeted: `pnpm vitest run <file>` |
| Full suite command | `pnpm test:run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CONT-01 | `[...]` marker rate <1% on a 200-article sample | integration (fixture-based, against stored/sample HTML pages, not live network in CI) | `pnpm vitest run tests/content-extraction.spec.ts` | ❌ Wave 0 |
| CONT-02/CONT-06 | Summary never exceeds source length; no fixed floor | unit | `pnpm vitest run tests/grounding/length-check.spec.ts` | ❌ Wave 0 |
| CONT-04/CONT-05 | Grounding check flags the known fabrication and passes on known-good fixtures | unit (fixture set, D-10) | `pnpm vitest run tests/grounding/fixture-set.spec.ts` | ❌ Wave 0 — fixture set itself must be built from the real corpus |
| CONT-07 | No verbatim-heavy excerpting on thin sources | unit | `pnpm vitest run tests/grounding/verbatim-overlap.spec.ts` | ❌ Wave 0 |
| CONT-11 | Batch resubmit logic only re-sends `batch_expired` entries | unit (mocked OpenAI client) | `pnpm vitest run tests/batch/resubmit.spec.ts` | ❌ Wave 0 |
| FIX-01 | Chunked `inArray` stays ≤100 total bound params | unit (assert chunk sizes; integration against local D1 replica for the actual SQL execution) | `pnpm vitest run tests/admin/reprocess-chunking.spec.ts` | ❌ Wave 0 |
| FIX-03 | `privacy.vue` passes Prettier | lint/format | `npx prettier --check app/pages/privacy.vue` | ✓ exists as a command already, currently failing (verified this session) |

### Sampling Rate
- **Per task commit:** targeted `pnpm vitest run <file>` for the file(s) touched.
- **Per wave merge:** `pnpm test:run` (full suite).
- **Phase gate:** Full suite green, plus `npx prettier --check .` and `pnpm typecheck` (both
  existing scripts in `package.json`), before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/content-extraction.spec.ts` — CONT-01
- [ ] `tests/grounding/length-check.spec.ts` — CONT-02, CONT-06
- [ ] `tests/grounding/fixture-set.spec.ts` — CONT-04, CONT-05, D-10 (needs the labelled fixture
      set itself built from real corpus rows first — a data task, not just a test-file task)
- [ ] `tests/grounding/verbatim-overlap.spec.ts` — CONT-07
- [ ] `tests/batch/resubmit.spec.ts` — CONT-11 (mocked OpenAI client, no real API calls in CI)
- [ ] `tests/admin/reprocess-chunking.spec.ts` — FIX-01
- [ ] Production D1 read access (wrangler install + auth) — not a test file, but a hard
      prerequisite for the length-distribution and outage-window numbers multiple tests and the
      dry-run script depend on.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | Admin endpoints already exist behind an established auth pattern (`requireCronAuth`, verified present in `fetch.post.ts` and `detect-duplicates.post.ts`); this phase adds no new auth surface |
| V3 Session Management | No | No new sessions introduced |
| V4 Access Control | Yes | The re-processing dry-run/execute scripts and any new admin endpoint must route through the existing `requireCronAuth` pattern — never expose the execute path as an unauthenticated public route |
| V5 Input Validation | Yes | The Batch API request-building code must validate/sanitize article content before embedding it in JSONL request bodies (control characters, embedded newlines breaking JSONL structure) |
| V6 Cryptography | No | No new cryptographic operations |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| SSRF via full-page fetch (D-01 fetches an arbitrary URL from RSS feed data) | Tampering / Elevation of Privilege | Restrict fetch targets to the three configured source domains (allowlist by hostname), not an arbitrary URL parsed from feed XML — a compromised or malicious feed entry could otherwise point the fetch at an internal address |
| Prompt injection via fetched article content (Readability-extracted text is fed directly into an LLM prompt) | Tampering | The existing prompt structure already separates "ORIGINAL HEADLINE" and "ARTICLE CONTENT" as labeled sections; the grounding-check judge prompt should apply the same labeled-section discipline so injected instructions inside a scraped article cannot easily masquerade as system/developer instructions. This is a real, not theoretical, risk once full third-party HTML is being fed to the model (a change from today's RSS-teaser-only input) |
| Malformed JSONL breaking a Batch submission mid-corpus | Denial of Service (to the pipeline, not external) | Validate/escape each request line before writing the batch file; a single malformed line can fail the whole file's parse depending on OpenAI's validation behavior — verify each `custom_id` is unique and each `content` field is valid JSON-string-escaped before writing |

## Sources

### Primary (HIGH confidence)
- Direct `Read`/`Bash` inspection of `915tldr.com2` source this session: `server/utils/openai.ts`
  (lines 65-99, 106, 111, 116), `server/utils/ai-processor.ts` (lines 105-113, 118-169),
  `server/api/admin/articles/reprocess-all.post.ts` (lines 1-135), `server/db/schema.ts` (lines
  23-61), `server/utils/content-extractor.ts` (full file), `server/utils/duplicate-detector.ts`
  (line 182, 300-345), `server/api/cron/fetch.post.ts`, `server/api/cron/detect-duplicates.post.ts`,
  `scripts/sync-prod-to-dev.sh`, `scripts/sync-prod-to-local.sh`, `package.json`,
  `app/pages/privacy.vue`.
- `developers.openai.com/api/docs/guides/batch` (WebFetch, direct fetch this session) — 24-hour
  window semantics, `output_file_id`/`error_file_id` shapes, `batch_expired` error format.
- `developers.openai.com/api/docs/pricing` (WebFetch, direct fetch this session) — `gpt-5.6-luna`
  pricing figures, cross-checked against an independent Perplexity query returning identical
  numbers.
- npm registry (`npm view <pkg> version`, live query 2026-09-19) — `linkedom`, `@mozilla/readability`,
  `wrangler`, `openai`, `js-tiktoken` current versions.
- `gsd-tools query package-legitimacy check` (this session) — `linkedom`, `@mozilla/readability`,
  `wrangler`, `openai` verdicts and signals.
- Local filesystem inspection: `.wrangler/state/v3/d1/.../` sqlite file row count and mtime.

### Secondary (MEDIUM confidence)
- Perplexity search (`jja-perplexity` skill, `pro`/`fast` modes) — grounding-check architecture
  comparison (NLI vs. LLM-judge vs. claim-extraction), verbatim-overlap detection algorithms,
  `linkedom/worker` Cloudflare Workers compatibility pattern, robots.txt/politeness posture,
  `js-tiktoken` `o200k_base` encoding for `gpt-5.6-luna`.

### Tertiary (LOW confidence)
- The `js-tiktoken`/`o200k_base` model-encoding mapping claim (A2 in Assumptions Log) — single
  web-search source, not cross-checked against `js-tiktoken`'s own source or changelog.
- Robots.txt/rate-limiting numeric recommendations (10-15s interval) — general web-search
  synthesis, not sourced from any of the three specific outlets' own published crawling policies.

## Metadata

**Confidence breakdown:**
- Standard stack (extraction runtime, Batch API mechanics, D1 param limits): HIGH — verified
  against official docs or the repo's own code and git history.
- `gpt-5.6-luna` pricing and Batch cost model: MEDIUM — two independent live sources agree
  exactly, but neither is an independently-loadable static page this document can point at for
  re-verification; pricing on a model this new is also the figure most likely to have already
  shifted by the time this phase executes.
- Grounding-check architecture recommendation: MEDIUM — synthesized from live search across
  multiple sources describing general LLM-faithfulness-detection practice, not a single
  authoritative spec for this exact use case (local news summary fact-checking specifically).
- Environment/measurement gaps (wrangler absence, stale local D1, missing production numbers):
  HIGH — directly observed this session, not inferred.

**Research date:** 2026-09-19
**Valid until:** 7 days for the `gpt-5.6-luna` pricing figures specifically (very new model,
OpenAI pricing on new models has moved before); 30 days for the rest (D1 limits, extraction
runtime compatibility, Batch API mechanics are stable, slower-moving surfaces).
