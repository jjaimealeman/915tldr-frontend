# Pitfalls Research

**Domain:** Astro 7 + Cloudflare Workers Static Assets static generation at scale (41k-82k pages), with an LLM content pipeline, against a retained Nuxt admin and an unchanged D1 database.
**Researched:** 2026-09-16
**Confidence:** MEDIUM overall — official docs (Astro, Cloudflare) are MEDIUM confidence; web survey findings on gotchas/community experience are LOW confidence and should be spot-verified during the phase that hits them. Every pitfall below is written against the specific numbers and defects already in `docs/PRD.md` and `.planning/PROJECT.md`, not generic advice.

This document is organized around one instruction from the brief: **prioritize pitfalls that are SILENT** — the ones that ship, look fine, and degrade invisibly. That is the exact shape of both defects that caused this rebuild (784M reads/day nobody watched; 16.6% fabricated advisories nobody read). Every pitfall below states how it would be *caught automatically*, not just how to avoid it by being careful, because "be careful" is what failed the first time.

---

## Critical Pitfalls

### Pitfall 1: The zero-D1-reads guarantee erodes one route at a time, silently

**What goes wrong:**
The entire rebuild exists to make D1 reads on the public path structurally zero. But "structural" is claimed, not yet proven, and the ways it erodes are individually small and easy to justify in the moment: a search endpoint that "just needs FTS5" (open decision #3 in the PRD explicitly leaves this door open), a sitemap generator that queries D1 directly instead of reading the render manifest, a 404 suggestion endpoint that looks up "similar articles" live, a server island that fetches from an API route which itself touches D1, or middleware that reads a feature flag or A/B config from D1 on every request. Each one individually reads a handful of rows. None of them look like the 784M/day defect. All of them are the same category of mistake — recomputing something live that should have been precomputed — that produced it.

**Why it happens:**
D1 is the path of least resistance. It already has the data, the schema, and the admin app's query patterns to copy-paste from. A developer under deadline pressure reaches for `db.select()` inside a "just this one route" without registering that the route is public. The v1 defect was not one big mistake, it was the *accumulation* of many small ones (`/api/tags`, `/api/stats`, `/api/categories`, per-category counts) each individually reasonable.

**How to avoid:**
- A build-time CI assertion (already specified in PRD §4 and PROJECT.md constraints) that fails the build if any file under the public route tree imports the D1 binding, `drizzle`, or the D1 client module. This should be a dependency-graph check (e.g. a small script using `es-module-lexer` or `madge`/`dependency-cruiser` over the build output, or an ESLint `no-restricted-imports` rule scoped to `src/pages/**` and `src/components/**` that forbids importing the D1 client module or `env.DB`), not a manual review checklist.
- Treat the search endpoint decision (open decision #3) as **architecturally load-bearing**, not a detail: if FTS5/D1 is chosen, the CI assertion needs an explicit, named, documented carve-out (e.g. `src/pages/api/search.ts` allow-listed) so the exception is visible in every PR diff, rather than silently weakening the rule for everything.
- Server islands are the second-most-likely leak: an island component is server-rendered per-request by definition (Pitfall 3), so it is exempt from prerender-time checks but not from the "public request path" rule. The CI assertion must scan island components too, not just `.astro` pages that are statically rendered.
- Sitemap and RSS generation must read from the same render manifest / KV precomputed data the pages use, never re-query D1 independently — these are exactly the kind of "just needs one more field" additions that get D1 access bolted on later.

**Warning signs:**
- Any PR that adds an import of the D1 client/binding under the public site's route or component tree.
- The daily budget routine (PRD §4) showing D1 reads/day above 0 that don't map to the cron/render step's expected read volume — the routine should distinguish "cron-time reads" (expected, bounded) from "request-time reads" (should be exactly zero) as separate line items, not a single total, or a slow reintroduction gets averaged away.
- A new API route or island added without a corresponding line item in the CI allow-list review.

**Phase to address:**
Foundation (phase 2) — the CI assertion must exist before any static generation work is built, so every subsequent phase is developed against a rule that already fails loudly. Re-verify at Hybrid archive (phase 4, where the PRD explicitly says "the entire premise" is gated here) and again at Interactivity (phase 6, where islands and search are added) and Quality gates (phase 9, final audit before cutover).

---

### Pitfall 2: "Is the fix actually live?" — cron-regenerated static sites make staleness invisible

**What goes wrong:**
On a normal server-rendered site, a bug fix deploys and is immediately visible on refresh. On this architecture, there are at least four independently-cached layers between "the code changed" and "a user sees it": the render/build step (runs on cron, not on deploy), the Workers Static Assets manifest cache (~5 min per the Cloudflare docs), R2-served archive HTML (potentially cached at the edge for longer, since content at a given path is treated as immutable), and any browser/CDN cache-control on individual assets. A developer who fixes a bug, deploys, and checks the live site five minutes later may be looking at a render generated *before* the fix, served from a *still-valid* edge cache, and reasonably but wrongly concludes the fix didn't work — or worse, concludes it did work when it happened to already match. This already burned real time once on this exact project: PROJECT.md records that "tonight's session lost real time to exactly that class of problem — a cached page served from a render made hours earlier," which is what motivated the git-hash-in-footer requirement.
Two categories can occur: (a) a *code* fix that hasn't re-run through the cron/render step yet, and (b) a *render* that ran but whose output is masked by a stale edge/R2 cache. These require different fixes (wait for cron / trigger a render vs. purge cache) and are easy to conflate under pressure.

**Why it happens:**
The architecture removes the request-time compute that would normally make "deploy = live" true. This is the correct tradeoff for the D1-reads goal, but it means "deployed" and "rendered" and "cache-fresh" are three different states that used to be one.

**How to avoid:**
- The git hash + build timestamp in the footer and at `/version.json` (already required in PRD §13.2) must be treated as the *first* diagnostic step for any "is this fix live" question, not an afterthought — check it before touching cache/CDN tooling.
- Distinguish, in tooling and in team vocabulary, "deployed" (code is on the Worker) from "rendered" (the render step has run against current data/templates) from "cache-fresh" (the edge is serving the newest render). Expose the last-render timestamp per content type (not just a global build hash) if the render step is incremental — a homepage regenerated at 14:00 and an archive page regenerated three weeks ago will both report the same *deploy* hash but very different *render* freshness, and that distinction matters when debugging "why does this one page look wrong."
- After deploying a template change intended to affect the archive, explicitly trigger (or wait for and confirm) the full archive re-render described in PRD §3.1/§4.1 — do not assume it happens automatically on deploy, since the PRD explicitly says it happens once per cron/trigger, not per deploy.
- When purge is genuinely needed, purge by cache tag/path scoped to what changed — bulk-purging everything after every deploy defeats the entire caching strategy the architecture depends on for the read/cost budget.

**Warning signs:**
- A bug report where the reporter's reload doesn't match a fresh curl/incognito fetch of the same URL — classic cache-staleness signature.
- Support/debugging sessions where "I deployed the fix and it's still broken" turns out to be true on inspection but the footer hash is *older* than the fix commit (render hasn't run) or *newer* than the fix commit but the page content is still old (cache issue) — these are distinguishable only if the hash/timestamp is actually checked first.

**Phase to address:**
Foundation (phase 2) for the git-hash/version.json infrastructure. Hybrid archive (phase 4) for the render-manifest/staleness model, since that's where the R2 archive and its caching semantics are built. Cutover (phase 10) should include an explicit runbook entry: "how to verify a fix is live" as a named procedure, not tribal knowledge.

---

### Pitfall 3: A server island silently breaks the static/zero-D1 guarantee, or fails ugly instead of gracefully

**What goes wrong:**
Server islands (`server:defer`) are, by definition, rendered on-demand per request — they are the one part of an otherwise-static page that is *not* prerendered. This is intentional and correct for weather/forecast/"updated Xm ago" (PRD §13.3/§14), but it means: (a) if an island's data-fetch function ever imports the D1 client "just to check something," it silently reintroduces a per-request D1 read that the build-time CI assertion (Pitfall 1) may not catch if the assertion only scans `.astro` page files and not island component files; (b) if the island's upstream (NWS `api.weather.gov`, the border-wait API) is slow or down, the default behavior without an explicit fallback is an unbounded wait or a broken component, not a graceful degrade — and per Context7's own Astro docs, `server:defer` fallback content is opt-in (`slot="fallback"`), not automatic; a component without one just doesn't render until its promise resolves, which can hang the visible page state; (c) encrypted island props are passed via GET query string capped at 2048 bytes and *silently* fall back to POST (uncacheable) if exceeded — this breaks the caching behavior the architecture depends on with no error, just a cache-hit-rate the team would need to notice was unexpectedly low; (d) the per-build random encryption key (`ASTRO_KEY`) means a CDN caching a page containing a server island, or a rolling/multi-instance deploy, can serve a page whose encrypted props were sealed with a key the currently-running backend no longer has — decryption fails, which on Workers likely surfaces as a broken/blank island rather than a clear error to the end user.

**Why it happens:**
Server islands are new (per PROJECT.md, "new since v1.0") and their caching/encryption model is genuinely non-obvious — it looks like "just another Astro component" but has HTTP-level behavior (GET/POST switch, per-build key rotation) that only shows up under specific conditions (large props, CDN caching, redeploys) that don't appear in local dev.

**How to avoid:**
- Always supply `slot="fallback"` content for every server island — never ship one without a fallback, and treat "an island with no fallback" as a lint-level/PR-review-blocking pattern.
- Set an explicit timeout on the upstream fetch inside the island (NWS/CBP APIs) and fail to the fallback content rather than hanging — PRD §12.1 already establishes this pattern for the border board ("stale-data handling that fails loudly rather than rendering an empty board"); server islands need the same discipline, not a bare `await fetch()`.
- Keep encrypted props minimal — pass IDs/keys the island re-fetches internally rather than large payloads, to stay under the 2048-byte GET threshold and preserve cacheability.
- Pin `ASTRO_KEY` as a stable secret (Cloudflare Workers secret binding) rather than relying on the per-build random default, since this site is deployed repeatedly via cron-triggered rebuilds and served through Cloudflare's edge cache — exactly the conditions the Astro docs flag as needing a stable key.
- Extend the build-time CI assertion from Pitfall 1 to scan island component files, not just statically-prerendered page files, for D1 imports.

**Warning signs:**
- Any island component file with no `slot="fallback"` markup in its usage.
- A fetch call inside an island with no timeout/AbortController.
- Cache-hit-rate metrics (if tracked) unexpectedly low on pages containing islands — signature of the GET→POST silent fallback.
- Intermittent blank/broken weather or "updated Xm ago" widgets immediately after a deploy, self-resolving after the next deploy — signature of encryption key mismatch during a rolling window.

**Phase to address:**
Interactivity (phase 6), where server islands are built. The CI assertion extension belongs in Foundation (phase 2) but should be revisited/tested against real island code once islands exist in phase 6.

---

### Pitfall 4: Content layer loader hits a D1 error and ships an empty (or partial) page instead of failing the build

**What goes wrong:**
This project already shipped this exact failure mode once, described verbatim in `docs/PRD.md` §15 "Known defects": `/changelog` rendered its empty state because an SSR-time fetch intermittently raced and returned nothing, and the empty payload got cached for an hour. The PRD claims "static generation removes that failure mode outright — there is no runtime fetch to race," but that claim needs scrutiny, not acceptance: the failure mode doesn't disappear, it *moves*. A custom Astro content layer loader (the "FlareCMS `flareLoader` pattern" referenced in PRD §14) reading from D1 at **build time** instead of request time removes the race condition specifically, but introduces a new, structurally similar one: if the loader's D1 query times out, throws, or returns zero rows (D1 connection issue during a cron-triggered build, a schema drift, a bad WHERE clause), the Astro Content Loader API does not fail the build by default for that condition — per Astro's own docs, a collection without a `loader` defined throws a hard build error, but a loader that *runs successfully and returns an empty array* is not itself an error. The build proceeds, pages render with zero articles/zero changelog entries, and — critically for this project — that empty static output then gets **deployed and cached exactly like a correct one**, potentially for the full cron interval (up to 2 hours) before anyone notices, unless something explicitly checks for it.

**Why it happens:**
Content layer loaders are new (PROJECT.md: "new since v1.0") and their contract is "fetch data, populate a store" — nothing in the API distinguishes "there genuinely are zero articles" from "the fetch silently failed and returned zero." Both look identical to the loader and to the resulting page.

**How to avoid:**
- Every custom loader must assert a sane minimum result count before calling `store.clear()`/populating, and **throw** (failing the build) if the row count is below a floor that would only occur on a genuine data failure — e.g., the changelog loader should throw if it gets 0 entries when the table is known to be non-empty; the articles loader should throw if the returned count is drastically below the previous build's count (a build-to-build delta check), not just below zero.
- Never let `store.clear()` run before the new data is validated — clear-then-fail is worse than fail-before-clearing, because a failed build using the old deployed output is safe; a failed build that already cleared the store and then throws (aborting the build) may leave a Content Layer cache in an inconsistent state for the next build attempt.
- Add a build-time assertion, separate from the loader itself, that checks aggregate counts across all collections against the previous successful build's manifest (e.g., "article count dropped by more than 5% since last build — abort") — this catches partial-data builds even if individual loaders don't self-check.
- This is the direct, structural answer to the section 4.1/PROJECT.md "fail loudly rather than shipping an empty page" principle already established for the border board — apply the identical discipline to every content layer loader, not just the ones for external APIs.

**Warning signs:**
- A collection's item count in build logs dropping to zero or near-zero without a corresponding real-world event (e.g., zero new articles on a day the cron definitely ran).
- Any page in production showing an "empty state" (the exact pattern that already happened with `/changelog`) — this should be alertable, not just visually noticeable, since a colour-forward editorial design might make an empty state look intentional rather than broken.
- Build success with a data-count delta the build-to-build assertion should have caught, if that assertion is missing.

**Phase to address:**
Static generation (phase 3), where content layer loaders against D1 are first built. Quality gates (phase 9) should include an explicit regression test replaying the exact `/changelog` failure condition (D1 returns empty/errors mid-query) to prove the new loader fails the build rather than shipping empty.

---

### Pitfall 5: Approaching the 100,000-file Workers Static Assets ceiling degrades before it hard-fails

**What goes wrong:**
The PRD already did the math correctly (Key Decisions table: hybrid static was chosen specifically because pure prerendering would hit the ceiling in ~90 days once bilingual doubles the page count to ~82k). But "we chose hybrid so this is solved" is a premise, not a proof, and the failure mode if the premise quietly stops holding is not a clean crash — it is one or more of: (a) the deploy step starts failing outright once a build attempts to upload more than 100,000 files, which *is* loud and would block a deploy — the safe case; (b) more insidiously, if "hot content" (homepage/category/tag pages + ~2,000 recent articles per PRD §3.1) grows over time because nobody prunes what counts as "hot" (e.g., the archive cutoff is a soft convention in code rather than an enforced ceiling), file count creeps upward across both languages and eventually crosses 100k mid-project, at a moment when nobody is specifically watching for it, turning a routine deploy into a hard failure with no advance warning; (c) even before the hard 100k ceiling, deploy time and Wrangler upload time scale with file count — tens of thousands of static assets uploaded on every deploy (not just every cron render) can turn deploys from "seconds" into "minutes," which matters for the "is the fix live" problem (Pitfall 2) and for how often the team is willing to deploy.

**Why it happens:**
"Hot" vs "archived" is a policy decision (currently ~2,000 recent articles, itself an open decision per PRD §17.4 — "archive depth" is explicitly not yet settled) enforced by code, not a platform-level guarantee. Policy that lives only in application logic drifts silently unless something continuously measures it against the actual limit.

**How to avoid:**
- Make the hot-content cutoff a single, testable configuration value, and have the build step assert the total static asset count (both languages combined) stays under a safety margin (e.g., 80,000, not 100,000 — leave headroom for static pages, category pages, tag pages, images, and any other non-article static output that also counts against the same ceiling) — fail the build loudly if exceeded, rather than letting Wrangler's own upload-time rejection be the first signal.
- Include static asset count as a tracked number in the daily budget routine (PRD §4) alongside D1 reads and spend — this is the same "a target nobody measures is a target that drifts" principle the PRD already applies to reads and Core Web Vitals; apply it here too.
- Decide the archive depth (open decision #4) based on the actual file-count budget, not purely on traffic patterns — PRD §17 says "phase 4 measures what is actually requested," but that measurement needs a static-file-budget ceiling as an upper bound input, not just a traffic-driven lower bound.
- Track deploy time as a metric across phases — a creeping deploy time (minutes instead of seconds) is an early symptom of approaching the file-count ceiling and should be investigated before it becomes a hard failure.

**Warning signs:**
- Wrangler deploy time trending upward across successive deploys.
- Total static asset count (visible in Wrangler's deploy output/manifest) approaching the safety-margin threshold in CI output, even if still under 100,000.
- The hot-content cutoff value existing in more than one place in the codebase (a sign it can drift out of sync).

**Phase to address:**
Hybrid archive (phase 4) — this is exactly where the PRD says "the entire premise gated here, if reads are not zero there, the architecture is wrong and we stop and reconsider"; add the file-count assertion at the same phase and to the same gate. Revisit at Quality gates (phase 9) once bilingual (~82k target) is fully wired.

---

### Pitfall 6: LLM padding/fabrication reappears through a different door after the prompt fix ships

**What goes wrong:**
PRD §8.3 requirement 5 specifies an "automated check: flag any summary longer than its source" — this is good and should ship, but it is a necessary, not sufficient, defense against a recurrence of exactly this defect class. A length-only check would not have caught the actual production example quoted in the PRD (the fabricated arson advisory) if the model had padded via *content* rather than raw length — e.g. hedged language ("this may indicate," "officials often respond to such incidents by"), plausible-sounding but unsupported claims that happen to stay under the length ceiling, or claims that are directionally true (e.g. genuinely reported police involvement) but embellished with unsupported specifics (a false claim about what officials "urged"). The new prompt (PRD §8.3 requirement 3) explicitly prohibits "advisories, calls to action, impact analysis... not present in the source" — but a prompt-level instruction is exactly the kind of thing that degraded silently the first time (the original prompt's "100-200 words" instruction was also a clear, sensible-sounding rule that the model quietly violated under specific conditions — short sources). Trusting the new prompt's instructions to hold without a structural, automated check that verifies the *content* (not just the length) of summaries against source content is repeating the same failure pattern this rebuild exists to fix.

**Why it happens:**
Prompt instructions are probabilistic constraints on a model, not hard guarantees — this is precisely why the original 39.3%-under-90-words / 16.6%-advisory-phrases defect could exist despite a seemingly reasonable prompt. A fixed prompt is progress but is not, by itself, proof against the same class of failure.

**How to avoid:**
- Beyond the length check (already required), implement a lightweight automated faithfulness/grounding check on a sample or on every summary: e.g., n-gram or entity overlap between summary and source (does the summary reference any named entity, number, or claim not present in the source text?), or an LLM-as-judge second pass that asks "does every claim in this summary appear in the source?" and flags mismatches for review — this doesn't need to be sophisticated NLI research-grade tooling; even a simple pattern-match for known advisory/hedge phrases ("urged to remain vigilant," "raises concerns about," "residents should be aware") that are common padding tells (the exact phrase already caught in production) catches the recurrence of the *specific* defect this rebuild fixes.
- Run this check as part of the batch re-processing dry run (PRD §4.1/§8.3) *before* the archive re-process, so the fix is validated on real data before being trusted at scale — and keep it running on the ongoing per-article pipeline, not just the one-time backfill, since the padding condition (short sources) recurs every day the pipeline runs against thin articles.
- Log/report the rate of flagged summaries in the daily budget routine so a recurrence is visible as a trend, not discovered nine months later on a spot-check — treat "% of summaries flagged" as a tracked number with the same seriousness as D1 reads/day.

**Warning signs:**
- Any summary containing a phrase from a small denylist of known advisory/hedge language that the source text does not contain.
- A rising trend in the flagged-summary rate after the prompt fix ships — the correct expectation is near-zero and stable; drift upward is the same silent-failure shape as the original defect.
- Spot-checks (still valuable, but explicitly *not* the primary detection mechanism per the brief's instruction to detect "automatically rather than by spot-check") turning up a fabrication that the automated check didn't flag — signals the automated check's pattern list or method needs expansion.

**Phase to address:**
Content quality (phase 8), where the prompt is rewritten and the archive re-processed — the automated check must ship in the same phase as the prompt fix, not after, since the dry run needs it to validate the fix before the costed re-processing operation runs. Keep it running as an ongoing pipeline check past this phase (it's on the retained Nuxt pipeline, so this is a small addition to the Admin split phase 7's territory too, but conceptually owned by phase 8).

---

### Pitfall 7: Bulk backfills (image + summary) blow through cost or rate limits because per-unit estimates don't account for burst/tier ceilings

**What goes wrong:**
The PRD's cost math (§4.1, §9.2) is careful about *per-unit* cost — $0.00063/image, ~$0.15/M input tokens — but per-unit cost is not the only constraint on a bulk backfill. Two independent ceilings can turn a correctly-estimated-in-dollars operation into a stalled or failed one: (a) OpenAI's image rate limits are enforced over **sub-minute windows**, not just a per-minute average — bursting requests can trigger 429s even when comfortably under the stated per-minute cap, and the limit is **organization-wide**, shared across every project/key on the account, not scoped to this one backfill — so a naive "loop and fire requests" backfill script for the 15,624-image Tier-2 (Workers AI) backfill or any Tier-3 (gpt-image) hero generation can throttle itself, or worse, throttle unrelated production traffic sharing the same OpenAI org if other work is running concurrently; (b) the Batch API's 24-hour SLA (used for "all bulk backfills" per the PRD constraint) is not a guarantee of prompt delivery — a batch can legitimately take up to the full 24 hours, and if it doesn't complete in that window, **whatever wasn't finished is cancelled** (not retried automatically) while completed work is still billed and returned. A dry-run cost estimate that assumes 100% completion in the batch window can be wrong if the batch is large enough or the queue is congested, and the team needs an explicit plan for "the batch didn't finish — what now" (resubmit the remainder? accept partial completion?) rather than discovering this live during the actual backfill.

**Why it happens:**
Per-unit pricing pages don't surface burst/window behavior or partial-completion semantics — those live in rate-limit docs and community bug reports, not pricing pages, so a cost estimate built from the pricing page alone (which is what the PRD's careful $-math is built from) is necessary but not sufficient.

**How to avoid:**
- For any bulk operation using synchronous (non-Batch) image generation — the Workers AI Flux-Schnell path is same-request, not Batch, since Batch is a text/OpenAI concept — implement client-side throttling with backoff (the standard pattern: 1s/2s/4s/8s with jitter, stop after ~6 attempts) rather than assuming the stated per-minute cap is a safe budget to spend evenly.
- For any OpenAI-side bulk operation (Batch API summaries, Tier-3 hero images if ever batched), explicitly plan the "batch didn't complete in 24h" case before running it: know in advance whether the remainder gets resubmitted automatically, manually, or accepted as partial — this should be a documented decision, not an improvisation during a live, money-spending operation.
- Poll batch status with exponential backoff, not fixed-interval polling, both to avoid wasting API quota on polling itself and because rapid polling right after submission is wasted effort during a job that structurally cannot finish early.
- Since the image rate limit is organization-wide, confirm the actual current tier via the live OpenAI limits dashboard immediately before a bulk operation, not from the PRD's tier table (which is a snapshot) — tiers move automatically with spend history and the number in a planning doc can be stale by the time the phase executes.

**Warning signs:**
- 429 responses appearing during a backfill that the per-unit-cost math said should be well within budget — signature of burst/window throttling rather than a total-spend problem.
- A Batch API job status still `in_progress` as the 24h mark approaches, with no plan for what happens to the unfinished portion.
- A backfill script with no backoff/retry logic at all — the simplest structural warning sign, catchable in code review.

**Phase to address:**
Imagery (phase 5) for the Tier-2/Tier-3 image backfills. Content quality (phase 8) for the Batch API summary re-processing backfill. Both should reuse one shared throttling/batch-status-handling utility rather than each phase reinventing it, given both are explicitly governed by the same PRD §4.1 cost-control rules.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems specific to this project.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Letting the CI D1-import assertion (Pitfall 1) scan only `.astro` page files, not island/component files | Simpler script, ships faster | Server islands (phase 6) become an undetected leak path for the zero-reads guarantee | Never — extend the scanner scope before islands ship, even if it means phase 2's version is intentionally incomplete and phase 6 must close the gap |
| Using a fixed-interval cache purge ("purge everything on every deploy") instead of scoped/tagged purging | Never have to think about which cache layer is stale | Defeats the R2/edge caching strategy the cost budget depends on; also masks real staleness bugs by resetting state instead of exposing it | Only during initial phase 3/4 development before the caching strategy is load-bearing; must not survive into phase 10 cutover |
| Length-only summary check (PRD §8.3 requirement 5) shipped without the content/grounding check from Pitfall 6 | Fast to build, immediately catches the most obvious padding case | Leaves the exact "official-sounding but unsupported claim under the length ceiling" failure mode open — the same failure class this rebuild exists to fix | Never as the sole check; acceptable as a first, cheap layer alongside (not instead of) a content-level check |
| Treating the 2,000-recent-article "hot" cutoff (PRD §3.1) as a hardcoded constant rather than a budget-driven, monitored value | One line of config, ships immediately | Silent drift toward the 100k file ceiling (Pitfall 5) with no warning until deploy fails | Only as a placeholder in early phase 3/4 work, before phase 4's "measure what's actually requested" analysis lands; must be replaced by a monitored, budget-aware value before phase 9 |
| Building server island fetches with a bare `await fetch()` and no timeout, matching NWS/CBP API's normally-fast response time | Less code, works fine in the common case | An upstream outage (Pitfall 3) hangs or breaks the island with no graceful fallback, on a page that is otherwise fully static and should be resilient by design | Never — this is the exact pattern PRD §12.1 already prohibits for the border board ("fails loudly rather than rendering an empty board") |

---

## Integration Gotchas

Domain-specific mistakes connecting to the external services this project actually uses.

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|-------------------|
| Cloudflare Workers Static Assets | Assuming the 100,000-file limit is a distant concern because "hybrid static" was chosen — treating the architectural decision as the fix rather than as a premise that needs continuous re-verification | Track total asset count in the daily budget routine; fail CI at a safety margin below 100k, not at the hard limit |
| Astro server islands | Passing large object/array props to an island, pushing the encrypted query string over 2048 bytes and silently losing GET cacheability | Pass minimal props (IDs), have the island re-fetch its own data; keep props small enough to stay well under the GET threshold |
| Astro content layer loaders + D1 | Trusting a loader that runs without throwing as proof the data is correct — an empty or partial result set is not an error to the Content Layer API by default | Loaders must self-validate row counts (or delta from previous build) and throw to fail the build on suspicious results, matching the border-board "fail loudly" pattern already established elsewhere in this project |
| WhatsApp / OG share cards | Verifying "the tags are present in the HTML" and calling it done — WhatsApp applies an undocumented ~300KB image size ceiling that silently drops the preview image entirely, with no public debugger to diagnose it | Actually paste real links into WhatsApp (and iMessage/Slack) per PRD §6.8's own instruction; keep generated card images well under 300KB; verify the final URL after any redirect, since a locale/consent redirect can serve different OG tags than the canonical |
| OpenAI Batch API | Assuming Batch API completion is guaranteed within 24h and treating an unfinished batch as a code bug rather than an expected outcome that needs a resubmission plan | Design the backfill workflow with an explicit "what happens to the unfinished remainder" branch before running it for real money |
| Cloudflare edge headers vs meta `noindex` | Relying on an app-level meta tag for `dev.915tldr.com` noindex, which depends on every route/template correctly rendering the tag | Set `X-Robots-Tag: noindex` at the Cloudflare edge (Transform Rule or a thin Worker) so it applies before any app code runs and can't be forgotten on a new route — PRD §13.1 already specifies this correctly; the risk is regressing to meta-tag-only under time pressure |
| D1 bound-parameter ceiling (100 params/statement) | The known `reprocess-all.post.ts` defect (PRD §15) of binding an unbounded ID list across `inArray` calls — this exact bug is already documented as needing a fix during the move, and the same anti-pattern could reappear in any new batch-oriented admin/render code that queries D1 by ID list | Chunk any ID-list-based D1 query into batches of ≤100 bound params; add a lint/test that constructs a large ID list and asserts the query layer chunks it, so the class of bug (not just this one instance) is prevented |

---

## Performance Traps

Patterns that work at small/dev scale but fail as the corpus and page count grow toward 82k.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Full-corpus template re-render treated as "free" because it's within the R2 Class A operations tier | Works fine through phase 4-8 testing on a partial dataset | Confirm the ~37,000 R2-write math (PRD §3.1) against the *actual* file count once bilingual doubles it to ~74,000+ writes, and re-confirm after any new derived-content type (share cards, per-language variants) adds more writes per article | Once total R2 writes per full re-render, across all derived artifacts (HTML + share card images + any per-language copies), approaches the 1,000,000/month included Class A operations if template changes become frequent (e.g. multiple design iterations in a short period) |
| Build-time image optimization (Sharp, Node-only per PRD §6.4) assumed to scale linearly with page count | Fine in local dev with a handful of test articles | Explicitly benchmark build time against the full ~15,624-image backfill + ongoing volume before assuming it fits inside the cron window; research found image processing, not HTML generation, is the dominant build-time cost at page counts in the tens of thousands | Once the image-processing step of a full/incremental build starts contending with the 2-hour cron interval, or with whatever CPU budget the render step (open decision #5, cron worker vs. separate worker) is given |
| Server island fetches assumed low-latency because NWS/CBP APIs are normally fast | No visible problem until an upstream slowdown or outage | Explicit per-fetch timeout + fallback content (see Pitfall 3); load-test the island under a simulated slow/failed upstream, not just the happy path | The first time NWS or CBP has an outage or degraded response time in production, which is a "when," not an "if," for a US federal API over a multi-year site lifetime |
| Static asset count treated as bounded by article count alone | Fine while only English articles + minimal per-article assets exist | Recount total assets including bilingual duplication, category/tag pages, generated share-card images per article/language, and any future derived artifact, against the 100k (or safety-margin) ceiling | Once bilingual, share cards, and archive depth all compound — the PRD's own ~90-day estimate for pure prerendering shows how fast this compounds; hybrid delays but does not eliminate the need to watch this number |

---

## Security Mistakes

Domain-specific issues beyond generic web security, given this project's public/admin split and edge-based access control.

| Mistake | Risk | Prevention |
|---------|------|------------|
| `admin.915tldr.com` reachable without Cloudflare Access actually enforced at the edge (e.g. Access policy misconfigured to allow a bypass, or a route added to the Nuxt app after the Access policy was last reviewed) | Full admin surface (~30 endpoints, direct D1 write access) exposed publicly | Verify Access policy coverage includes every admin route, including any newly added during the "admin split" phase; test with an unauthenticated request against a fresh route, not just the ones that existed when Access was configured |
| `dev.915tldr.com` staging host indexed because the edge `X-Robots-Tag` header was only applied to the main worker route pattern and a new subdomain/path didn't match it | Duplicate-content SEO penalty against the production site; a copy of the news site pointed at dev data becomes publicly discoverable | Apply the noindex header at the zone/account level for the `dev.` hostname pattern generically, not per-route; re-verify after any Cloudflare routing change (the `jja-cloudflare-deploy` skill referenced in the PRD covers exactly this trap) |
| Generated Open Graph / share-card images including any data not intended for public consumption (e.g. draft/unpublished article content rendered into a card before the article itself is public) | A share card could leak content ahead of intended publication, or be generated for content later retracted | Generate share cards from the same publish-gated data source as the page itself, at the same build step — never from a separate "preview" path that might run ahead of publication status |
| Server island encryption key (`ASTRO_KEY`) left as the per-build random default in a multi-deploy, cron-triggered environment | Not primarily a security leak, but a reliability/availability issue (Pitfall 3) with security-adjacent implications if props ever carry anything sensitive | Pin as a proper secret binding; rotate deliberately, not implicitly on every build |

---

## UX Pitfalls

Domain-specific to a colour-forward, bilingual, editorial news site with an established build-in-public identity.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Bold category palette (8 colours, PRD §5) meets contrast requirements in isolation but fails when combined (e.g. a category-coloured badge on a category-coloured background, or a category colour used as both text and its own background in different contexts) | Text becomes unreadable in specific, easy-to-miss combinations that a single-swatch contrast check wouldn't catch | Test contrast for every actual combination that appears in the design (badge-on-card, link-on-badge, etc.), not just each colour against white/black in isolation — this is explicitly why PRD §5.4/§9 puts contrast review *before* design acceptance, not after |
| Spanish text (15-25% longer than English, per PRD §7.3) breaking headline/card layouts that were only visually checked in English during design sketch (phase 1) | Clipped or wrapped headlines, broken share cards, in the language serving the more vulnerable/underserved audience the bilingual feature exists for | Validate every layout — mockups, cards, headlines — against realistic-length Spanish content during phase 1, not discovered later as PRD §7.3 already warns |
| `prefers-reduced-motion` implemented for page-transition motion (View Transitions) but missed for secondary motion (scroll/intersection effects via VueUse, hover states, load-more animations) | Users who set the OS-level reduced-motion preference for vestibular/attention reasons still get partial motion, which is often more jarring than full motion since it's inconsistent | Audit every animation/transition source (ClientRouter, VueUse scroll effects, CSS transitions/keyframes, island loading states) against the media query, not just the most visible one (page transitions) |
| Build-in-public changelog (a distinctive, valued feature per PRD §1/§2) rendering an empty or broken state that, on this specific colour-forward editorial design, could visually read as an intentional "nothing to report" design choice rather than a bug | The exact `/changelog` empty-state bug (PRD §15) recurring post-rebuild, but harder to notice because a stylized empty state looks more "designed" than the current plain one | Give the changelog's genuine empty state (if it can ever legitimately be empty) and its *failure* empty state visibly different treatment, or better, make the failure case impossible per Pitfall 4's build-time assertion so there is no failure empty state to confuse with a real one |

---

## "Looks Done But Isn't" Checklist

Things that will appear complete in a demo or a quick look but are missing the verification this project's own history shows is necessary.

- [ ] **Zero D1 reads on public path:** Often "looks done" because the obvious pages (homepage, article) don't query D1 directly — verify by running the CI import-assertion against the *full* build output including islands and API routes, not just spot-checking a few pages by eye.
- [ ] **Share cards:** Often "looks done" because `og:image` and dimension tags are present in page source — per PRD §6.8's own standard, this is explicitly *not* verification; actually paste real article links into Facebook Sharing Debugger, X Card Validator, WhatsApp, iMessage, and Slack, and look at the rendered card.
- [ ] **Content layer loader correctness:** Often "looks done" because the build succeeds and pages render — verify by deliberately breaking the D1 connection/query mid-development and confirming the build *fails loudly* rather than producing an empty-but-successful page (the exact `/changelog` regression test).
- [ ] **Server island resilience:** Often "looks done" because the happy path (upstream API responds normally) works in dev and demo — verify by simulating a slow (multi-second) or failed upstream response and confirming fallback content renders instead of a hang or blank island.
- [ ] **WCAG 2.2 AA:** Often "looks done" because automated tooling (axe/Lighthouse) passes — the PRD itself notes automated tooling catches "roughly a third of real issues"; verify with an actual manual keyboard-only pass and screen-reader pass, specifically checking focus-ring visibility on elements inside any `overflow: hidden` container (a known WCAG 2.2 focus-not-obscured trap) and 320px/200% zoom reflow on the actual bold-colour-palette design, not a generic template.
- [ ] **Static-asset file count headroom:** Often "looks done" because the current build deploys successfully — verify by projecting forward with bilingual + full archive depth + share-card images all counted, not just today's partial dataset.
- [ ] **Batch API cost estimates:** Often "looks done" because the dry-run reports a row count and a per-unit cost that multiplies out correctly — verify the plan also covers what happens if the batch doesn't complete within the 24h window, before running it against real money.
- [ ] **"Is the fix live" tooling (git hash/version.json):** Often "looks done" because it's implemented and displays *a* value — verify it actually changes when a new render happens (not just when code deploys), and that the team's actual debugging habit is to check it first, since the PRD records this exact tool being motivated by a real, recent incident of not doing so.

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover — scoped to this project's specific architecture and stated cost/risk tolerances.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|-----------------|------------------|
| D1 reads reintroduced on public path (Pitfall 1) | LOW if caught by CI before merge; MEDIUM-HIGH if it reaches production and drifts for weeks | If caught in CI: fix before merge, no recovery needed. If found in production: revert/disable the offending route immediately (rollback is a DNS/route change per PRD §15, which remains available throughout per the migration plan), then add the specific import pattern to the CI assertion's test suite so this exact regression is covered going forward |
| Stale render served as "live" (Pitfall 2) | LOW | Check `/version.json` and the footer hash first; if render is stale, trigger the render/build step explicitly rather than guessing; if cache is stale despite a fresh render, purge the specific cache tag/path, not the whole site |
| Content layer loader ships an empty/partial page (Pitfall 4) | MEDIUM | Because the site is regenerated on cron and rollback to the prior deployed Worker version is always available (PRD §15's zero-risk-by-construction design), the fastest recovery is reverting the deploy while fixing the loader, rather than attempting a hotfix under pressure against live traffic — this is explicitly the kind of low-traffic, low-stakes site where "revert and fix calmly" beats "patch live" |
| Fabricated/padded summary recurrence after prompt fix (Pitfall 6) | MEDIUM-HIGH (reputational, and a second costed re-processing run) | Re-run the automated faithfulness check across the full corpus to scope the actual damage (not a spot-check); if the recurrence is systemic (prompt regression), the fix is another prompt iteration, not another blind re-processing pass — validate the new prompt against the automated check *before* spending money on a second archive-wide re-process, learning directly from why the ~$5-9 estimate exists in the first place |
| Approaching/hitting the 100k static asset ceiling (Pitfall 5) | MEDIUM | Reduce the "hot" cutoff (fewer recent articles held as static assets, more pushed to the R2 archive path) — this is a config change, not an architecture change, since the hybrid model was built specifically to absorb this; if that's insufficient, revisit whether share-card images or other derived per-article assets should also move to R2-served rather than static-asset-served |
| Bulk backfill throttled or a Batch API job left unfinished at 24h (Pitfall 7) | LOW-MEDIUM | For throttling: back off and resume with proper rate limiting, no data lost, just slower. For an unfinished Batch job: the completed portion is still valid and billed; resubmit only the incomplete remainder (identify by diffing input IDs against returned output IDs) rather than resubmitting the whole batch, which would double-pay for the already-completed portion |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| D1 read reintroduction (search, islands, sitemap, middleware) | Foundation (2), extended in Interactivity (6) | CI build fails on any D1 import under public route/component tree, including islands; re-run at every subsequent phase's gate |
| "Is the fix live" ambiguity across cron/cache/deploy layers | Foundation (2) for tooling; Hybrid archive (4) for staleness model | Footer hash + `/version.json` distinguish deploy vs. render vs. cache freshness; runbook entry exists and is used in a real debugging session before cutover |
| Server island D1 leak / no fallback / prop-size cache break / stale encryption key | Interactivity (6) | Every island has `slot="fallback"`; every upstream fetch has a timeout; `ASTRO_KEY` pinned as a secret; CI import-scan covers island files |
| Content layer loader silent empty/partial build (the `/changelog` failure recurring in a new form) | Static generation (3) | Regression test replaying D1 failure mid-query proves the build fails loudly, not silently, for every loader |
| 100,000-file static asset ceiling approached silently | Hybrid archive (4), re-verified at Quality gates (9) | Total asset count tracked in daily budget routine; CI fails at a safety margin below 100k |
| LLM padding/fabrication recurs through content rather than length | Content quality (8) | Automated content/grounding check (not length-only) runs in the dry run before the costed re-process, and continues running on the ongoing pipeline afterward |
| Bulk backfill throttling / Batch API partial completion | Imagery (5) for images; Content quality (8) for summary re-processing | Backoff/retry logic present in backfill scripts; explicit documented plan for an unfinished 24h batch exists before the real run |
| Core Web Vitals failing despite static generation (font-swap CLS, missing dimensions, view-transition shift) | Design sketch (1) for font/layout decisions; Quality gates (9) for measurement | Lighthouse CI + field CWV in the daily routine; self-hosted fonts with `size-adjust` fallbacks verified to not shift layout on swap |
| WCAG 2.2 AA traps (contrast combinations, clipped focus rings, keyboard traps in islands, 320px reflow) | Design sketch (1) for the palette/contrast gate before acceptance; Quality gates (9) for full audit | Manual keyboard + screen-reader pass, not just automated tooling; focus-ring visibility specifically tested inside any `overflow` container |
| Open Graph / share card failures despite tags being present | Imagery + share cards (5) | Real platform validation (Facebook Debugger, X Validator, WhatsApp/iMessage/Slack paste-test) per PRD §6.8, not HTML inspection |
| hreflang / bilingual duplicate-content and layout errors | Foundation (2) for hreflang/routing structure; Design sketch (1) for Spanish-length layout tolerance | Self-referencing hreflang + consistent canonicals verified per page pair; Spanish-length content tested in mockups before build |
| Staging site (`dev.915tldr.com`) indexed | Cutover (10), but the edge header should exist from Foundation (2) onward | `X-Robots-Tag: noindex` verified as an edge/zone-level header (not just app meta tag) via direct HTTP header inspection, not visual check |
| Admin/Access misconfiguration exposing D1 write surface | Admin split (7) | Unauthenticated request against every admin route (including newly added ones) confirmed blocked by Cloudflare Access |

---

## Sources

- Cloudflare Workers changelog and docs on Static Assets file limits (2025-09-02 increase to 100,000 files/version on Paid, Wrangler ≥4.34.0 requirement) — MEDIUM confidence, official first-party documentation, retrieved via web search.
- Astro official documentation (`/withastro/docs` via Context7): server islands caching (GET/POST 2048-byte threshold), encryption key (`ASTRO_KEY`) synchronization requirements for CDN/rolling deploys, and content layer loader API / `content-collection-missing-loader` error reference — MEDIUM confidence, official docs.
- Astro build scaling blog post and community reports (astro.build, GitHub issues, dev.to) on large-page-count builds, memory behavior, and image-processing as the dominant build cost at scale — LOW confidence, mixed official/community.
- Web search survey (LOW confidence, community/blog sources, not independently verified) on: font-swap CLS mitigation and View Transitions CLS behavior; WCAG 2.2 focus-not-obscured and reflow common failure patterns; WhatsApp Open Graph caching/size-limit behavior and lack of a public debugger; hreflang/canonical duplicate-content failure patterns; LLM hallucination/faithfulness detection methods (claim-extraction, LLM-as-judge, Q-S-E); OpenAI Batch API 24h SLA and partial-completion/failure semantics; OpenAI image generation rate-limit tiers and sub-minute burst enforcement; staging-site noindex meta-tag vs. `X-Robots-Tag` header equivalence and edge-enforcement advantages.
- `/home/jaime/www/_github/915tldr.com/.planning/PROJECT.md` and `docs/PRD.md` (v2.0, 2026-09-15) — primary source for this project's own documented incident history (784M reads/day, 16.6% fabricated advisories, `/changelog` empty-state bug, prior ~$40 unforecast AI charge, D1 100-parameter ceiling) and stated architecture/constraints. All project-specific pitfall framing is grounded in these documents' own numbers and admissions, not assumed.

---
*Pitfalls research for: Astro 7 + Cloudflare Workers static generation at scale, with an LLM content pipeline (915tldr.com v2 rebuild)*
*Researched: 2026-09-16*
