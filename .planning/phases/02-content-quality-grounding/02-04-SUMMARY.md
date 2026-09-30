---
phase: 02-content-quality-grounding
plan: 04
subsystem: pipeline
tags: [linkedom, readability, openai, gpt-5.6-luna, grounding, d1, drizzle-kit, sqlite, cloudflare-workers, wrangler]

# Dependency graph
requires:
  - phase: 02-content-quality-grounding (plan 01)
    provides: wrangler/linkedom/@mozilla/readability/js-tiktoken pinned, CLOUDFLARE_API_TOKEN authenticated
  - phase: 02-content-quality-grounding (plan 03)
    provides: D-04 input cap (11000 chars), production corpus measurements, D-16 retired
provides:
  - Four additive columns (key_points, acquisition_status, grounding_status, grounding_report) live in production D1's articles table
  - extractArticleBody() — linkedom/worker + Readability extraction, CONFIRMED working inside a real Workers runtime (D-03 closed)
  - Canonical-page fetch with SSRF allowlist and D-02 retry/fallback, wired into fetch.post.ts's legacy insert path
  - Rewritten faithfulness-first summarisation prompt on gpt-5.6-luna with the measured D-04 input cap
  - checkGrounding() — a minimum-viable grounding gate (deterministic length check + claim-decomposition judge with sourceSpan re-verification) that holds flagged articles instead of publishing them
  - An empty-content guard so an article is never summarised from its title alone
  - docs/phase-02/tracer-evidence.md — the recorded end-to-end proof and D-03 go/no-go
affects: [02-05, 02-06, 02-07, 02-08, all downstream plans reading/writing the new columns or extending checkGrounding]

# Actuals (#2632)
actuals:
  tokens: 15521
  tasks: 3
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Production D1 migrations applied via `wrangler d1 execute --remote --file=` (not `wrangler d1 migrations apply` — no migrations_dir tracked), matching how 0000-0006 were applied"
    - "Test files that build an in-memory D1 replica from committed migration files should readdirSync the migrations directory rather than hand-maintain a file list"
    - "Workers-side HTML extraction: linkedom/worker's parseHTML() + Mozilla Readability, with the project's existing cleanHtmlContent() kept as the post-processing pass over Readability's output rather than retired"
    - "SSRF mitigation for outbound fetches driven by third-party data: build an allowlist from already-trusted DB rows (here, the loaded `sources` table), reject non-https, and re-check the allowlist on every redirect hop rather than trusting `redirect: 'follow'`"
    - "Grounding/faithfulness checks: claim-decomposition judge call whose every cited source span is re-verified with a plain string .includes() in code — never trust the model's own citation"
    - "gpt-5.6-luna (reasoning-capable model) quirks: no `max_tokens` (use `max_completion_tokens`), no custom `temperature` (default only), and a completion-token budget that must cover internal reasoning as well as the visible JSON answer — undersizing it produces an empty `message.content`, not an error"
    - "Mocking `openai`'s client in vitest: `vi.mock('openai', () => ({ default: class MockOpenAI { chat = {...} } }))` — a plain object mock breaks because the client is called with `new`"

key-files:
  created:
    - 915tldr.com2/server/db/migrations/sqlite/0007_absurd_matthew_murdock.sql
    - 915tldr.com2/server/utils/grounding-check.ts
    - 915tldr.com2/tests/grounding-check.test.ts
    - 915tldr.com2/tests/ai-processor-empty-content.test.ts
    - 915tldr.com2/docs/phase-02/tracer-evidence.md
  modified:
    - 915tldr.com2/server/db/schema.ts
    - 915tldr.com2/server/utils/content-extractor.ts
    - 915tldr.com2/server/utils/openai.ts
    - 915tldr.com2/server/utils/ai-processor.ts
    - 915tldr.com2/server/api/cron/fetch.post.ts
    - 915tldr.com2/tests/duplicate-detector.test.ts

key-decisions:
  - "Owner selected apply-additive: all four columns applied to production D1 in one migration, via direct wrangler d1 execute --remote --file= (Task 1, prior session)"
  - "requirements-completed deliberately OMITS CONT-01: its success criterion is a corpus-level statistic ('the [...] marker rate drops to near zero on newly ingested articles'), and this tracer proved the mechanism on exactly one article. Marking it complete now would overclaim; it's left pending for plan 02-05+'s at-scale validation."
  - "Grounding judge shares the summariser's gpt-5.6-luna pin (Claude's Discretion per 02-CONTEXT.md — CONT-08 names summarisation only). No separate model was evaluated given the tracer's scope."
  - "On a flagged article this plan's Task 2 holds immediately (grounding_status: held) rather than implementing D-09's full 'retry once against a stricter prompt, then hold' — the plan's own Task 2 action text specifies the simpler immediate-hold behavior for this slice; the retry step is part of the full detection suite plan 02-07 builds behind the same checkGrounding signature."
  - "storeProcessingResults, when the gate flags an article, writes ONLY grounding_status/grounding_report and leaves title/slug/summary/key_points untouched — chosen over writing-then-hiding via a status flag, since it means a flagged row can never be accidentally exposed by a read path that doesn't yet know about grounding_status."

patterns-established:
  - "Dynamic readdirSync-based migration list in DB-backed test setup, applied consistently now across tests/duplicate-detector.test.ts, tests/admin/reprocess-chunking.test.ts and the new tests/ai-processor-empty-content.test.ts"
  - "Local-D1 tracer proof technique: pre-seed the local Miniflare replica with placeholder rows for every item in a live source's RSS feed except the one under test, so the real fetch endpoint finds exactly one genuinely new article and the full pipeline runs on real data without a mocked network layer"

requirements-completed: [CONT-02, CONT-03, CONT-04, CONT-06, CONT-08]

# Metrics
duration: ~131min (26min prior halted session + ~105min this continuation, estimated)
completed: 2026-09-19
status: complete
---

# Phase 2 Plan 4: End-to-End Tracer — Canonical Fetch, Extraction, Faithful Summarisation, Grounding Gate Summary

**One real El Paso Matters article travelled canonical-page fetch → `linkedom/worker` + Readability extraction → gpt-5.6-luna summarisation under a rewritten faithfulness-first prompt → a claim-decomposition grounding gate → a columnar D1 write, inside a live `wrangler dev` Worker — and a second real article was correctly held, not published, when the gate caught two genuine unsupported claims**

## Performance

- **Duration:** ~131 min total (26 min prior halted session for Task 1 / schema+migration; ~105 min this continuation for the remainder of Task 2 and all of Task 3, estimated from session activity — no precise wall-clock start was captured for this continuation)
- **Completed:** 2026-09-19
- **Tasks:** 3 of 3 complete (Task 1 was completed and committed in a prior session; this continuation resumed at Task 2's remaining action steps and completed Task 2 and Task 3)
- **Files modified:** 13 code/doc/test files, plus 4 changelog entries and the changelog index

## Accomplishments

- **D-03/D-CAUTION-2 CONFIRMED**: `linkedom/worker`'s `parseHTML()` plus Mozilla Readability loads and runs inside a real Cloudflare Workers runtime (`wrangler dev --persist-to .wrangler/state`), verified across three separate live-page fetches. No HTMLRewriter fallback needed. Full evidence in `docs/phase-02/tracer-evidence.md`.
- **Canonical-page fetch (D-01/D-02)** wired into `fetch.post.ts`'s legacy insert path with an SSRF allowlist built from the already-loaded `sources` rows (T-02-01), https-only, redirect-hop re-checked against the allowlist, one retry with backoff, an identifying User-Agent, and `acquisition_status` (`fetched`/`feed_fallback`/`failed`) recorded in the same insert as the row.
- **Faithfulness-first prompt rewrite (D-05/D-06/D-07)** on `gpt-5.6-luna` (CONT-08): proportional summary length with a hard never-exceed-source ceiling and no numeric word target, `keyPoints` restricted to source-stated facts only, an explicit prohibition block against advisories/warnings/calls-to-action/editorial framing, and the measured D-04 11,000-character input cap replacing the old flat 6,000.
- **Grounding gate (D-08/D-09, new `grounding-check.ts`)**: a deterministic summary-longer-than-source check plus an LLM judge that decomposes title/summary/key points into atomic claims, requires an exact source-substring citation per claim, and re-verifies every citation with a plain string-containment check in code — a hallucinated citation is never trusted. Proven live: one real article was correctly held after the judge caught two genuine, subtle unsupported claims in a multi-topic roundup story.
- **Empty-content guard (CONT-02/edge)**: an article with null/empty/whitespace-only content is marked `failed` with an explicit reason and never reaches the model — the old title-only fallback path (unbounded invention) is gone. Now covered by 4 unit tests.
- Test suite grew from 41 → 50 passing tests (5 new grounding-check tests, 4 new empty-content-guard tests); `pnpm typecheck`, `pnpm lint`, `pnpm exec drizzle-kit check` all clean throughout.
- Three real API-compatibility bugs specific to `gpt-5.6-luna` were discovered only by running the live endpoint (not by reading code) and fixed inline: rejection of `max_tokens` (→ `max_completion_tokens`), rejection of a non-default `temperature` (removed), and an under-sized completion-token budget producing an empty response on a reasoning-capable model.

## Task Commits

Each task was committed atomically (all in `915tldr.com2`, branch `feature/phase-02`):

1. **Task 1: Apply the additive Phase 2 migration to production D1** — `4cfdc2b` (feat) — completed in the prior halted session; not touched by this continuation
2. **Task 2: End-to-end "one faithful summary"** — `eba387a` (feat) — canonical fetch/SSRF allowlist, extraction, prompt rewrite, empty-content guard, grounding gate, wiring, and the new `tests/grounding-check.test.ts`
3. **Task 3: Record tracer evidence and resolve D-03** — `9adbf99` (docs) — `docs/phase-02/tracer-evidence.md`
4. **Follow-up: empty-content guard test coverage** — `5608cce` (test) — closed a self-check gap (Task 2's empty-content guard had been verified by code-reading only); `tests/ai-processor-empty-content.test.ts`

No plan-metadata commit is made in the code repo (per project convention, only this planning repo commits STATE/SUMMARY docs).

## Files Created/Modified

- `915tldr.com2/server/db/schema.ts` — four additive columns (Task 1, prior session)
- `915tldr.com2/server/db/migrations/sqlite/0007_absurd_matthew_murdock.sql` — the additive migration (Task 1, prior session)
- `915tldr.com2/server/utils/content-extractor.ts` — new `extractArticleBody()` (linkedom/worker + Readability); rewrote the stale file header
- `915tldr.com2/server/api/cron/fetch.post.ts` — new SSRF-allowlisted canonical-page fetch helpers; legacy insert branch now fetches/extracts/falls back and records `acquisition_status`
- `915tldr.com2/server/utils/openai.ts` — `gpt-5.6-luna` pin, D-04 11,000-char cap, faithfulness-first prompt rewrite, empty-content throw guard, `max_completion_tokens`/no-`temperature` fixes
- `915tldr.com2/server/utils/grounding-check.ts` (new) — `checkGrounding()`, `ClaimVerdict`, `GroundingResult`
- `915tldr.com2/server/utils/ai-processor.ts` — empty-content guard, grounding gate wiring, `held` counter, `storeProcessingResults` branch on flagged vs. clean
- `915tldr.com2/tests/grounding-check.test.ts` (new) — 5 unit tests, mocked OpenAI client
- `915tldr.com2/tests/ai-processor-empty-content.test.ts` (new) — 4 unit tests, mocked `openai` module
- `915tldr.com2/tests/duplicate-detector.test.ts` — dynamic migration-file loading fix (Task 1, prior session)
- `915tldr.com2/docs/phase-02/tracer-evidence.md` (new) — the recorded proof and D-03 decision
- `915tldr.com2/changelog/2026-09-19-1859_*.md`, `*-1900_*.md`, `*-1904_*.md`, `changelog/README.md` — dev changelog entries for this session's three commits

## Decisions Made

- **`requirements-completed` deliberately omits CONT-01.** CONT-01's success criterion ("the `[...]` marker rate drops to near zero on newly ingested articles") is a corpus-level statistic. This tracer proved the *mechanism* (canonical-page fetch replacing the feed body, extraction working) on exactly one article — genuinely strong evidence the pipeline works, but not evidence the marker rate has actually dropped at ingest volume. Marking it complete here would be the kind of premise-not-checked overclaim the project's own verification standard exists to prevent. It stays pending in `REQUIREMENTS.md` until plan 02-05+ runs at real volume and measures it.
- **Held articles get a minimal write, not a status-flag hide.** When `checkGrounding` flags a result, `storeProcessingResults` writes only `grounding_status`/`grounding_report` — title/slug/summary/`key_points` are left exactly as they were (still their pre-processing values). This means a flagged row cannot be accidentally exposed by any future read path that doesn't yet know to check `grounding_status`, at the cost of the row staying `pending` rather than moving through a visible `held` state machine value (deferred to 02-08's invariant test per 02-CONTEXT.md's Assumption-delta section).
- **No retry-before-hold in this slice.** D-09's full design is "retry once against a stricter prompt, then hold." This plan's own Task 2 action text specifies immediate hold on flag for the tracer slice; the retry step is explicitly part of what plan 02-07 builds behind `checkGrounding`'s stable signature.
- **Grounding judge reuses the summariser's model pin** (`gpt-5.6-luna`) rather than evaluating a separate model — 02-CONTEXT.md left this as Claude's Discretion and the tracer's scope didn't call for a model comparison.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `gpt-5.6-luna` rejects the legacy `max_tokens` parameter**
- **Found during:** Task 2, first live run of `/api/cron/fetch`
- **Issue:** `400 Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead.`
- **Fix:** Changed `max_tokens` → `max_completion_tokens` in both `openai.ts` and `grounding-check.ts`
- **Files modified:** `915tldr.com2/server/utils/openai.ts`, `915tldr.com2/server/utils/grounding-check.ts`
- **Verification:** Re-ran the live endpoint; the summarisation call succeeded
- **Committed in:** `eba387a`

**2. [Rule 1 - Bug] `gpt-5.6-luna` rejects a non-default `temperature`**
- **Found during:** Task 2, second live run (after fixing #1)
- **Issue:** `400 Unsupported value: 'temperature' does not support 0.4 with this model. Only the default (1) value is supported.`
- **Fix:** Removed the `temperature: 0.4` override in `openai.ts` (previously set "for more creative titles") and did not add the `temperature: 0.1` override the grounding judge would otherwise have used to mirror `duplicate-detector.ts`'s pattern — no `temperature` parameter is sent for this model
- **Files modified:** `915tldr.com2/server/utils/openai.ts`, `915tldr.com2/server/utils/grounding-check.ts`
- **Verification:** Re-ran the live endpoint; both calls succeeded without a temperature error
- **Committed in:** `eba387a`

**3. [Rule 1 - Bug] Grounding judge returned an empty response on a full-length source article**
- **Found during:** Task 2, live run against a 6,578-character El Paso Matters article
- **Issue:** `Error: No response from grounding judge` — `gpt-5.6-luna` is reasoning-capable and its `max_completion_tokens` budget covers internal reasoning as well as the visible JSON answer; 1,500 tokens was consumed entirely by reasoning on a long, multi-claim article, leaving nothing for the answer
- **Fix:** Raised `JUDGE_MAX_TOKENS` to 4,000 and the summariser's `max_completion_tokens` to 4,000 for the same reason, now that full pages up to the D-04 cap are being summarised
- **Files modified:** `915tldr.com2/server/utils/grounding-check.ts`, `915tldr.com2/server/utils/openai.ts`
- **Verification:** Re-ran; the judge returned a full, well-formed claim decomposition
- **Committed in:** `eba387a`

**4. [Rule 2 - Missing coverage] Empty-content guard had no test, only code review**
- **Found during:** Self-check after Task 3, applying the project's own verification standard ("the code is present" is not verification)
- **Issue:** The CONT-02/edge empty-content guard (a `must_haves.truths` item) was implemented correctly but unverified by any automated test
- **Fix:** Added `tests/ai-processor-empty-content.test.ts` (4 tests), which required mocking the `openai` module at the module level since `getOpenAIClient()` constructs a real client eagerly before the guard runs, and the real SDK refuses to construct one in this project's happy-dom test environment
- **Files modified:** `915tldr.com2/tests/ai-processor-empty-content.test.ts` (new)
- **Verification:** 4/4 new tests pass; full suite 50/50
- **Committed in:** `5608cce`

---

**Total deviations:** 4 auto-fixed (3 Rule 1 bugs — all real API-compatibility issues found only by running the live endpoint, not readable from code — 1 Rule 2 missing-coverage addition)
**Impact on plan:** All four were necessary for correctness or verification completeness. No scope creep — none touched files outside this plan's declared scope.

## Issues Encountered

- **KTSM's site blocks this project's outbound fetches with HTTP 403** (PerimeterX bot protection), confirmed unrelated to this code by testing both the identifying `915tldr-bot` User-Agent and a full desktop browser User-Agent from the same machine — both blocked identically. D-02's retry-then-feed-fallback path handled this exactly as designed (`acquisition_status: feed_fallback`, no exception). This blocked KTSM specifically as the tracer's demonstration source (it has the highest truncation rate and would have shown the most dramatic before/after), so the tracer proceeded against El Paso Matters instead, with KVIA confirmed as a secondary reachable source. Recorded as a real operational finding for plan 02-05's politeness-posture work (`.planning/WINDOWS.md`, tracked separately) rather than worked around or hidden.
- **`.output` total build size decreased after adding `linkedom`+Readability**, the opposite of the naive expectation. Investigated rather than reported at face value: the overall total is dominated by sourcemap files and content-hashed Vue-island chunks whose sizes drift a few percent between independent `nuxt build` runs (ordinary Rollup/Vite non-determinism). Isolating the one chunk that actually imports the new code (`nitro.mjs`) gives the real, attributable signal: +224,515 bytes (+18.24%). Both numbers are recorded in `tracer-evidence.md` with the explanation, not just the flattering one.

## User Setup Required

None further. `.dev.vars` (the only remaining setup item from the halted-session summary) was already created by the orchestrator before this continuation began.

## Next Phase Readiness

- **D-03 is closed.** Plan 02-05 onward can build on `extractArticleBody` without re-verifying Workers-runtime compatibility.
- **The grounding gate's signature (`checkGrounding`) is stable and proven.** Plan 02-07 expands its deterministic stage (advisory lexicon, entity presence, verbatim overlap) and adds the D-10 labelled fixture set behind this same signature.
- **CONT-01 remains open pending at-scale validation** — tracked in `.planning/WINDOWS.md` and in this summary's Decisions Made.
- **KTSM's bot-block is a real input to plan 02-05's politeness-posture design** — tracked in `.planning/WINDOWS.md`.
- **`queue-processor.ts` (disabled queue-mode consumer) was not touched** and still uses the old concatenated-summary shape with no grounding gate — out of scope since queue mode is disabled by default, but flagged in `.planning/WINDOWS.md` so it isn't silently enabled later without reconciling it.
- Legacy rows are untouched; `design/scripts/lib/summary-markdown.mjs`'s parser stays necessary and valid for them, matching the plan's success criteria.

---
*Phase: 02-content-quality-grounding*
*Completed: 2026-09-19*

## Self-Check: PASSED

- FOUND: `4cfdc2b`, `eba387a`, `9adbf99`, `5608cce` in `915tldr.com2`'s git log
- FOUND: `915tldr.com2/server/utils/grounding-check.ts`
- FOUND: `915tldr.com2/server/utils/content-extractor.ts` exports `extractArticleBody`
- FOUND: `915tldr.com2/docs/phase-02/tracer-evidence.md` (171 lines)
- FOUND: `915tldr.com2/tests/grounding-check.test.ts` (5 tests, passing)
- FOUND: `915tldr.com2/tests/ai-processor-empty-content.test.ts` (4 tests, passing)
- FOUND: this SUMMARY.md at `.planning/phases/02-content-quality-grounding/02-04-SUMMARY.md`
- FOUND: `915tldr.com2` full test suite — 50/50 passing, `pnpm typecheck` exit 0, `pnpm exec drizzle-kit check` clean
