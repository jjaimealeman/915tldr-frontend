# Phase 2: Content Quality & Grounding - Context

**Gathered:** 2026-09-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Summaries are faithful to their sources before a single new summary is written in any
language. Three defects are in scope: content arrives truncated, the prompt rewards padding
and invented advisories, and nothing checks whether a summary's claims trace back to its
source. Plus three unrelated repo defects (FIX-01/02/03) that PROJECT.md scheduled here.

**This phase is pipeline-side.** Almost all code lands in `915tldr.com2` (the v1 Nuxt app),
not in this repo. Nothing ships to the v2 public site here — Phase 2 runs independently of
Phase 1 and gates Phases 4 and 6.

**Not in scope:** Spanish generation (Phase 6), the Astro scaffold or read-budget guardrails
(Phase 3), search or embeddings work, imagery (Phase 7), and any v2 public-route code.

</domain>

<decisions>
## Implementation Decisions

### Content Acquisition

- **D-01:** Fetch the canonical article page for **every** article, from every source.
  Ignore feed bodies entirely rather than branching per source.
  Rationale: El Paso Matters ships full `content:encoded` (sampled at 5,904 / 2,355 / 710
  words) while KTSM ships a ~55-word `<description>` cut with `[...]`, and the repointed
  third source (`elpasonews.org`) truncates the same way. A conditional "fetch only when
  short" path would need maintaining per source and would silently stop working if a feed
  changed its truncation behaviour. One code path is immune to that.
  — **Reversibility:** reversible — acquisition is internal to the ingest cron; falling back
  to feed bodies is a config change, and nothing downstream depends on where the text came from
  beyond the status flag in D-02.

- **D-02:** On fetch failure: **one retry with backoff, then fall back to the feed body**,
  and record how each article's text was acquired (`fetched` / `feed_fallback` / `failed`)
  in a stored column.
  Rationale: the fabrication risk and the acquisition risk decouple in this phase. Once the
  prompt no longer pads (D-05), a feed-fallback article is honest-but-thin rather than
  invented, which makes falling back safe in a way it was not before. "Leave pending and
  retry later" was rejected because a source-wide block would stop publishing with nothing
  announcing it — the same silent-drift failure class as the nine-month D1 problem.
  **The stored status column is the mitigation, not the fallback policy:** the fallback rate
  must be a number the owner can see, so a KTSM block shows up as a spike.

- **D-03:** Extract article text with **`linkedom` + Mozilla Readability**. Named fallback
  if it does not fit the Worker runtime or bundle: **`HTMLRewriter`**.
  Rationale: site-agnostic extraction means replacing or adding a source costs zero
  extraction work — which matters immediately, because the third source is being repointed
  (D-12). Readability degrades to a partial article where hand-written selectors would
  return nav and footer text to the model. `jsdom` is not an option; it does not run on
  Workers.
  **UNVERIFIED — must be confirmed in research before planning locks.** `linkedom` +
  Readability is widely used on Workers but has *not* been run in this Worker. Confirm
  runtime compatibility and bundle impact, then either proceed or take the HTMLRewriter
  fallback.
  — **Reversibility:** costly — swapping extractors after the archive has been ingested
  changes text for every subsequently-fetched article, so extraction quality differences
  become visible as a discontinuity in the corpus.

- **D-04:** The 6,000-character input cap at `server/utils/openai.ts:106` is **raised to a
  measured value**, not removed. Research measures the real article-length distribution
  across all three sources, sets a cap that keeps ~95% of articles whole, and re-costs the
  backfill at that input size.
  Rationale: full pages make the cap a real truncation point (EPM articles reach ~35,000
  characters), but removing it entirely leaves cost and latency unbounded on an outlier such
  as a liveblog or transcript page. **This invalidates published budget figures — see
  D-CAUTION-1.**

### Summary Shape

- **D-05:** The 100–200 word floor is replaced with **proportional guidance plus a hard
  ceiling**: summarise at whatever length the source supports, never exceed the source, and
  enforce it with the automated longer-than-source check (CONT-06).
  Rationale: satisfies CONT-02's "no fixed word floor" and gives CONT-06 something real to
  enforce. Explicit length tiers were rejected — they reintroduce numeric targets, which is
  precisely the mechanism that produced the padding defect.

- **D-06:** `keyPoints` is **kept**, moved out of the `summary` column into **its own
  column**, and its prompt rewritten to **facts stated in the source only** — no tips, no
  advice, no recommendations.
  Rationale: dropping it was considered and rejected on evidence. Phase 1 did not work around
  the `**Key Details:**` markdown — it *built for it*: `design/scripts/lib/summary-markdown.mjs`
  parses the label and bullets into a `<strong>` plus `<ul>`, `design/tests/content.spec.ts:360-384`
  asserts that shape, `design/tests/support/i18n.ts:84` carries the Spanish "Puntos clave"
  form, and the Phase 1 approval packet asked the owner to sign off on "the rendered Key
  Details list". Dropping the field would orphan an approved design element, its renderer and
  its tests. Moving it to a column preserves the approved rendering (v2 renders an array
  instead of parsing asterisks), cleans the `summary` column so D-10's standfirst deck can
  take its opening sentence without stripping a blob, and removes the *"Tips, advice, or
  recommendations"* instruction — the same fabrication vector as the invented advisory, in a
  different field.
  **Consequence for the planner:** rows that are not re-processed keep inline markdown in
  `summary`, so Phase 1's parser stays necessary for legacy rows. How long that lasts is set
  by D-09's scope.
  — **Reversibility:** one-way — adding the column is a D1 migration, and once the v2
  renderer reads the column rather than parsing prose, reverting means both a schema change
  and a template change on a published contract.

- **D-07:** Attribution appears **in the summary text for thin sources only**. The branch is
  decided **in code from the source word count**, which selects a prompt variant — the model
  is never asked to judge whether a source is thin.
  Rationale: chrome-only attribution does not travel. `/rss.xml` is a preserved requirement,
  share cards land in Phase 7, and search snippets and social pastes strip layout entirely —
  so provenance living only in the design disappears exactly where the legal exposure
  PROJECT.md cites (*AP v. Meltwater*, hot-news misappropriation) applies. Always-in-text was
  rejected because D-10 sets the standfirst deck from the summary's opening sentence, so every
  article would open in display serif with a publication name. Thin sources are where
  paraphrase runs closest to the original, which is the case CONT-07 names as an "attributed
  excerpt". Deciding the branch in code removes the reliability objection to a conditional
  rule and makes the behaviour testable.

### Grounding Check

- **D-08:** Detection is **hybrid, with different policies for live ingest and backfill**.
  Deterministic checks (advisory-phrase lexicon, longer-than-source, numbers and named
  entities present in the summary but absent from the source) plus an **LLM entailment judge**.
  - **Live ingest:** run *both* on every article. At ~150 articles/day the judge call is
    negligible, and gating it to "suspicious" articles would optimise a cost that does not
    exist while reintroducing the blind spot.
  - **41k backfill:** deterministic sweep first (free), judge only what it flags. Here the
    cost is real and lands inside the CONT-09 dry run.
  Rationale: the deterministic lexicon *would* catch the known production example, but CONT-04
  asks for *any* untraceable claim and a lexicon cannot do that — a fabrication phrased without
  advisory vocabulary passes clean.

- **D-09:** On a flag: **retry once against a stricter prompt, then hold.** Anything still
  flagged does not publish and enters a review queue with a visible count.
  Rationale: blocking outright means a false positive silently kills an article;
  publish-and-flag means fabrications are readable until someone looks, which defeats the
  phase. One retry absorbs transient model noise. As with D-02, the visible count is the real
  guardrail.

- **D-10:** The check is validated against a **labelled fixture set drawn from the real
  corpus** — the known fabrication plus known-good summaries — and must catch all known-bad
  under a **measured false-positive ceiling**. Re-runnable whenever prompt or model changes.
  Rationale: a detector tuned against a single positive example and zero negatives says
  nothing about its false-positive rate, and D-09 makes false positives expensive. Same
  instinct as Phase 1's D-06 stress set and D-13's generated contrast table: make the
  acceptance bar executable. Makes CONT-05 testable rather than anecdotal.

- **D-11:** The grounding check **also covers AI-generated titles**, not only summaries.
  Rationale: the prompt has the model rewrite every headline. A headline is a claim, it is the
  most-read AI-written text on the site (cards, search results, share cards), and CONT-04 says
  "any claim not traceable to its source". Marginal cost — the judge already holds source and
  summary.

### Re-processing

- **D-12:** On re-processing, **title and slug are frozen**. Only `summary`, `keyPoints`,
  entities and tags update. New articles still receive AI-generated titles exactly as today.
  Rationale: v1 resolves articles by UUID alone — `app/pages/[category]/[slug].vue:8-24`
  extracts the trailing UUID and calls `/api/articles/{uuid}`, so the slug text is decorative
  and rewriting it breaks nothing *in v1*. The risk is v2: Phase 4 pre-generates every page as
  a static file, and a superseded slug 404s unless a UUID-fallback resolver exists. Freezing
  slugs means every indexed URL keeps matching a generated path, so Phase 4 inherits no
  catch-all resolver as mandatory work. Titles are not what is defective here, and rewriting
  nine months of indexed headlines at once is SEO churn taken on for no requirement in this
  phase.
  — **Reversibility:** one-way — once 41k summaries are re-processed with frozen slugs,
  rewriting slugs later means either accepting 41k dead indexed URLs or building the resolver
  and redirect layer that this decision avoids.

- **D-13:** Archive re-processing **re-summarises stored content and does not re-fetch source
  pages**.
  Rationale: the two defects do not cost the same. Fabrication is fixed by re-summarising
  stored content through the corrected prompt — cheap, no network, a pure Batch job. Thinness
  is only fixed by re-fetching, because full text was never stored for KTSM articles: ~41k
  HTTP requests to two newsrooms, an unknown 404 rate across nine months of link rot, and an
  unbudgeted politeness burden. Premise checked: re-fetching is only worth it if old articles
  are read, and PROJECT.md derives archive depth from measured traffic in Phase 4/5 while
  treating the PRD's 2,000-article hot-content figure as the one number not grounded in a
  measurement. The roadmap agrees with itself — criterion 1 scopes the truncation bar to
  *"a 200-article sample of **newly ingested** articles"*; the archive is never asked to meet
  it. Fabrication is fixed corpus-wide; thinness is fixed from ingest forward. If traffic data
  later shows specific old articles matter, re-fetching a targeted set is a cheap follow-up
  with real numbers behind it.

- **D-14:** The re-processing set is **determined by the checks**: sweep all 41,233 rows with
  the free deterministic checks, judge what they flag, and re-process the confirmed set plus
  the CONT-12 outage window. The dry run reports that exact count and cost.
  Rationale: matches CONT-10's "the affected archive" literally and pays only for what is
  actually broken. Known-bad heuristics alone would miss fabrications avoiding advisory
  vocabulary — the exact blind spot D-08 exists to close.

- **D-15:** The OPS-11 $1 gate is enforced by a **two-command, report-gated split**. The dry
  run computes row count and projected cost, writes a report, and calls nothing. The real run
  is a separate command that refuses to start unless pointed at a specific dry-run report, and
  aborts if the corpus has drifted since.
  Rationale: structural, not procedural. A `--confirm` flag is one flag away from being
  bypassed, including by an agent; an interactive prompt does not survive cron or a subagent.
  Same instinct as the zero-D1-reads build assertion — enforce it so it cannot be forgotten.

### Sources

- **D-16:** The third source is **repointed to `https://elpasonews.org/feed/`** by updating
  `feed_url` on the existing source row.
  Rationale: `elpasolocalnews.org` returns **NXDOMAIN** from Cloudflare's resolver —
  authoritative non-existence, not an outage (re-verified 2026-09-18 16:10 MDT). El Paso News
  is live at `elpasonews.org`: HTTP 200, 44,064-byte feed, current El Paso reporting. Keeping
  three sources preserves PROJECT.md's pinned source mix, so budget validation stays
  unconfounded. Its feed truncates like KTSM's (zero `content:encoded`, 8 `[...]` markers), so
  D-01's full-page fetch already covers it.
  **Publication-identity continuity is NOT proven** — same display name and an obvious domain
  move, but unverified. The owner accepted the repoint on that basis.
  **OPEN for research:** when `elpasolocalnews.org` went dark and what corpus gap that left.
  Query production D1 for that source's last article date; the gap may overlap CONT-12's
  outage window and should be folded into the same audit.

### Workflow

- **D-17:** Phase 2 planning artifacts (`02-CONTEXT.md`, `02-DISCUSSION-LOG.md`) commit to
  **`feature/phase-02`** in this repo.
  Rationale: originally decided as `develop`, to keep `feature/phase-01`'s approved diff clean.
  **Amended 2026-09-19:** the owner merged `feature/phase-01` into `develop` (merge commit
  `1b66ffb`), deleted the phase-01 branch, and created `feature/phase-02` — which is level with
  `develop`. With the branch in existence, planning and implementation share it, matching the
  one-branch-per-phase convention directly. The original concern is resolved either way, since
  Phase 1's design work is now on `develop` and inherited by this branch.

- **D-18:** Phase 2 implementation lands on a **new `feature/phase-02` branch in
  `915tldr.com2`**, created by Jaime in lazygit off `develop`.
  **Blocker for the planner:** `915tldr.com2` is currently on `feature/fix/d1-sort-index`,
  which needs landing or setting aside first. The branch does not exist yet — ask before
  starting implementation, never create it.

- **D-19:** Both the prompt fix and the archive re-processing get **public `/changelog`
  entries**, not just internal `changelog/*.md` ones.
  Rationale: the project's stated identity is that every change is documented publicly, and
  re-processing rewrites summaries readers may already have read — a content change worth
  disclosing.

### Cautions Carried Into Planning

- **D-CAUTION-1: published cost figures are stale.** PROJECT.md's **~$7.44 batched backfill**
  and **$0.48/month ongoing** were computed against today's ~6,000-character truncated inputs.
  D-01 and D-04 raise real input size substantially (EPM articles reach ~35,000 characters).
  Both figures must be **re-derived** before the CONT-09 dry run is presented for approval.
  Do not quote the old numbers.

- **D-CAUTION-2: `linkedom` on Workers is unverified.** See D-03. Confirm before planning
  locks.

- **D-CAUTION-3: the third source's death date is unknown.** See D-16.

### Claude's Discretion

- The three FIX defects are unambiguous and were not discussed — all three verified still open
  on 2026-09-18:
  - **FIX-01:** `server/api/admin/articles/reprocess-all.post.ts` has four unbounded `inArray`
    calls (lines 57, 60, 63, 66). Note: commit `8552b9e` ("stop binding unbounded ID lists past
    D1's 100-parameter ceiling") fixed *different* files — `server/api/articles/index.get.ts`
    and `server/routes/sitemap.xml.ts`. No chunk helper exists in the repo yet.
  - **FIX-02:** `package.json` has `wrangler` in neither `dependencies` nor `devDependencies`,
    while `deploy` and `deploy:dev` both invoke a bare `wrangler`.
  - **FIX-03:** `npx prettier --check app/pages/privacy.vue` fails.
- Prompt wording, code structure, module layout, chunk sizes, and test organisation.
- Whether `server/utils/duplicate-detector.ts:182` (also on `gpt-4o-mini`) moves to
  `gpt-5.6-luna` alongside the summariser — not discussed; planner's call, but note CONT-08
  names summarisation only.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level (this repo)
- `.planning/PROJECT.md` — the content-quality defect statement (lines 141-152: the 39.3% /
  14.7% / 16.6% figures and the verbatim fabrication), the budget constraints, and the
  pipeline non-goal's explicit exception for extraction and the summary prompt
- `.planning/REQUIREMENTS.md` — CONT-01…CONT-12, FIX-01…FIX-03, OPS-11
- `.planning/ROADMAP.md` §"Phase 2: Content Quality & Grounding" — the six success criteria
- `docs/PRD.md` §8.1–8.3 — content quality: the padding defect, the 100–200 word floor this
  phase removes, and the posture against verbatim-heavy excerpting
- `.claude/CLAUDE.md` — the one-branch-per-phase convention and the planning-artifacts-on-
  `develop` note

### Phase 1 handoff (binding on this phase)
- `.planning/phases/01-design-sketch-editorial-identity/01-CONTEXT.md` — **D-06** (cards must
  survive two-line *and* six-line summaries; explicitly warns the planner not to design
  against today's padded lengths), **D-10** (standfirst deck drawn from the summary's opening
  sentence; pull quotes dropped), and revision-request item 9
- `design/scripts/lib/summary-markdown.mjs` — the `**Key Details:**` parser Phase 1 built and
  the owner approved; D-06 above preserves what it renders
- `design/tests/content.spec.ts` — lines 360-384 assert the Key Details label-plus-list shape;
  line 774 strips the block by splitting on `\n\n` to obtain the deck's opening sentence

### Pipeline code (in `915tldr.com2`, NOT this repo)
- `915tldr.com2/server/utils/openai.ts` — the system prompt (lines 65-99), the `gpt-4o-mini`
  model pin (line 111), `temperature: 0.4` set "for more creative titles" (line 116), and the
  6,000-character content slice (line 106)
- `915tldr.com2/server/utils/ai-processor.ts` — `formatSummaryWithKeyPoints` (lines 105-113)
  concatenating markdown into the `summary` column, and `storeProcessingResults` (lines
  118-169) regenerating the slug from the AI title
- `915tldr.com2/server/utils/content-extractor.ts` — the regex cleaner, whose own header
  records that the pipeline "relies primarily on RSS content"
- `915tldr.com2/server/api/admin/articles/reprocess-all.post.ts` — FIX-01
- `915tldr.com2/server/api/cron/process.post.ts`, `fetch.post.ts`, `detect-duplicates.post.ts`
  — the OpenAI-dependent endpoints implicated in the CONT-12 outage window
- `915tldr.com2/app/pages/[category]/[slug].vue` — UUID-based article resolution (lines 8-24),
  the evidence behind D-12
- `915tldr.com2/server/db/seeds/002-sources.sql` — the seeded three-source mix, including the
  now-NXDOMAIN `elpasolocalnews.org`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server/utils/content-extractor.ts` — `cleanHtmlContent`, `decodeHtmlEntities` and
  `extractFirstImage` remain useful as post-processing after Readability, even though
  Readability replaces its role as the body extractor.
- `server/utils/rss.ts` — `generateSlug` is reused; under D-12 it is simply not called on
  re-processing.
- `design/scripts/lib/summary-markdown.mjs` + its unit tests — already model the legacy
  `**Key Details:**` shape; still needed for un-re-processed rows under D-06.
- The `changelog/*.md` + `public/changelog.json` two-layer changelog already exists and feeds
  the public page — D-19 needs no new mechanism.

### Established Patterns
- One OpenAI call returns title, summary, keyPoints, tags, category and entities together
  (`processArticleWithAI`). D-06 changes what is stored, not necessarily the call shape.
- Article status is a state machine on `articles.status` (`pending` → `processed` / `failed`).
  D-02's acquisition flag and D-09's review queue should extend this rather than invent a
  parallel mechanism.
- The pipeline runs on Cloudflare Workers via Nuxt + Wrangler — this is what rules out `jsdom`
  and constrains D-03.
- **D1 allows at most 100 bound parameters per statement** (verified empirically 2026-09-15).
  Binding on FIX-01 and on every batched write this phase adds. No chunk helper exists yet;
  one should be written once and reused.

### Integration Points
- `server/api/cron/fetch.post.ts` — where D-01's page fetching and D-02's retry/fallback land.
- `server/api/cron/process.post.ts` → `ai-processor.ts` → `openai.ts` — where D-05, D-06, D-07
  and the CONT-08 model change land.
- A new grounding-check module invoked after summarisation (D-08…D-11), gating the write.
- `server/db/schema.ts` + a migration — the `keyPoints` column (D-06) and the acquisition
  status column (D-02).
- A new dry-run/execute pair of scripts under `scripts/` for D-13…D-15.

</code_context>

<specifics>
## Specific Ideas

- **The fabrication that defines the bar** (must be caught by the grounding check, CONT-05):
  > *"Residents and dealership owners are urged to remain vigilant and report any suspicious
  > activity to the authorities."*
  On a story that reported only an arson arrest. It is well-formed, length-compliant, and
  invisible to a length check.

- **A complete KTSM feed item as received today**, illustrating what the model is currently
  asked to turn into 100-200 words:
  > *"EL PASO, Texas (KTSM) — At least one person is dead following a crash in South-Central
  > El Paso, according to the El Paso Police Department on Thursday, Sept. 17. The call of the
  > crash came in at 9:30 p.m. at 4010 E Paisano Drive. EPPD said one person died in the
  > single-vehicle crash. The department* **[...]**"

- **Measured source behaviour, 2026-09-18:** El Paso Matters ships full `content:encoded`
  (sampled at 5,904 / 2,355 / 710 words). KTSM ships `<description>` only — zero
  `content:encoded`, 28 `[...]` markers in a single fetch. `elpasonews.org` likewise — zero
  `content:encoded`, 8 `[...]` markers. The `[...]` marker appears **nowhere** in our own
  source; it originates upstream. CONT-01 is therefore an acquisition problem, not an
  extraction-code bug.

- **Deterministic-branch principle (D-07, and a general preference):** where a rule depends on
  a property we can compute ourselves (source word count), compute it and hand the model the
  matching prompt — do not ask the model to judge the property.

</specifics>

<deferred>
## Deferred Ideas

- **Re-fetching archive source pages to enrich thin legacy summaries** — deferred out of
  D-13. Revisit only if Phase 4/5 traffic measurement shows specific old articles are read.
  Needs real numbers, not intuition.
- **Moving `duplicate-detector.ts` off `gpt-4o-mini`** — noted, not decided. CONT-08 names
  summarisation only.
- **Lowering `temperature` from 0.4** (set "for more creative titles") for faithfulness —
  raised but not discussed; planner's call.
- **Whether the grounding judge should run on a different model than the summariser**
  (self-grading is weak) — raised but not discussed.
- **Whether the grounding check extends to Spanish summaries** — belongs to Phase 6.
- **Politeness posture toward the three sources** — `robots.txt` handling, `User-Agent`
  identification and rate limiting under D-01. Raised but not discussed; must be settled
  during planning since D-01 puts us on two newsrooms' servers daily.
- **Whether fetched full text is stored or only summarised from** — raised but not discussed.
  Storing it would make future re-processing far cheaper and would retire D-13's limitation,
  at the cost of D1 storage against a 435 MB database.
- **CONT-11's 24-hour Batch window mechanics** (automatic vs manual resubmission, chunk size)
  — not discussed; requirement is explicit enough for the planner.

</deferred>

---

*Phase: 2-Content Quality & Grounding*
*Context gathered: 2026-09-18*
