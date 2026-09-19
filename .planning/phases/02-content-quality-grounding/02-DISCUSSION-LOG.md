# Phase 2: Content Quality & Grounding - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-18
**Phase:** 2-Content Quality & Grounding
**Areas discussed:** Full-text acquisition, Summary shape & keyPoints, Grounding check design, Title & slug stability, Re-processing scope, The dead third source, Where the work lands

**Note on process:** the owner asked "which do you recommend?" at four points. Where a
recommendation was given and accepted, it is marked in the Notes. One recommendation was
reversed mid-discussion after checking evidence — see Summary shape & keyPoints.

---

## Full-text acquisition

### Q1 — How do we get enough text from KTSM to summarise honestly?

| Option | Description | Selected |
|--------|-------------|----------|
| Fetch page only when short | Detect truncated teaser, fetch KTSM article page; EPM keeps its free full-text feed | |
| Fetch every article's page | Ignore feed bodies entirely; one code path, immune to feed changes | ✓ |
| No fetching — fix the prompt only | Let a 55-word source produce a short attributed summary; build nothing new | |

**User's choice:** Fetch every article's page
**Notes:** Asked for an ELI5 before answering. Framing that landed: to summarise truthfully
the model needs the actual article, and for KTSM we currently hand it only the teaser — which
is where "urged to remain vigilant" came from. Option 3 was presented honestly as fully
solving the *fabrication* problem while leaving *thinness* unsolved.

### Q2 — What happens when a page fetch fails?

| Option | Description | Selected |
|--------|-------------|----------|
| Retry, fall back, flag | One retry with backoff, then feed text, with acquisition status stored | ✓ |
| Fall back immediately | No retry; straight to feed text, still flagged | |
| Leave pending, retry later | Never summarise from thin text; article waits for next cron | |

**User's choice:** Retry, fall back, flag — Claude's recommendation
**Notes:** Recommendation rested on the observation that fabrication risk and acquisition risk
*decouple* in this phase: once the prompt stops padding, a feed-fallback article is
honest-but-thin rather than invented. "Leave pending" was argued against as reproducing the
nine-month silent-drift failure class. Recommendation came with a condition — store the
acquisition status so the fallback rate is visible — which is the actual guardrail.

### Q3 — How do we extract article text on Workers?

| Option | Description | Selected |
|--------|-------------|----------|
| linkedom + Readability | Workers-compatible DOM + Firefox Reader Mode algorithm; site-agnostic | ✓ |
| HTMLRewriter | Cloudflare-native, zero deps, but hand-written selectors per site | |
| Extend cleanHtmlContent | Existing regex stripper; no concept of "the article body" | |

**User's choice:** linkedom + Readability — Claude's recommendation
**Notes:** Decisive argument was the dead third source: site-agnostic extraction means
replacing a source costs zero extraction work. Explicitly flagged as **unverified on this
Worker** — Claude noted the project's own rule that capability claims are measured, not
remembered, and named HTMLRewriter as the fallback if verification fails.

### Q4 — What happens to the 6,000-character input cap?

| Option | Description | Selected |
|--------|-------------|----------|
| Raise it, measured | Measure real length distribution, cap to keep ~95% whole, re-cost backfill | ✓ |
| Remove it entirely | Maximum fidelity; unbounded cost/latency on outliers | |
| Keep 6,000 | Published cost estimates stay valid; defeats the fetch just decided | |

**User's choice:** Raise it, measured
**Notes:** Claude raised unprompted that this invalidates PROJECT.md's ~$7.44 and $0.48/month
figures, which were computed against truncated inputs, and that OPS-11 puts a $1 approval gate
on the result.

---

## Summary shape & keyPoints

### Q1 — What happens to keyPoints?

| Option | Description | Selected |
|--------|-------------|----------|
| Own column, facts-only | Stop concatenating; separate column; prompt forbids tips/advice | ✓ |
| Keep inline, facts-only | Constrain prompt, keep concatenation; markdown stays in the data | |
| Drop entirely | Remove field, prompt section and formatter | |

**User's choice:** Own column, facts-only — Claude's recommendation
**Notes:** **Claude's initial framing was wrong and was corrected mid-discussion.** The first
draft of this question listed "Drop entirely" first as the clean fix. Before recommending,
Claude checked whether Phase 1's design had anywhere to *show* key points and found it had
built *for* them: `summary-markdown.mjs` parses the label and bullets, `content.spec.ts:360-384`
asserts that shape, `i18n.ts:84` carries "Puntos clave", and the Phase 1 approval packet asked
the owner to sign off on "the rendered Key Details list". Dropping would have orphaned an
approved design element — the failure mode the user's own CLAUDE.md describes as taking a
screen away without inventorying what lived on it.

### Q2 — What replaces the 100–200 word floor?

| Option | Description | Selected |
|--------|-------------|----------|
| Proportional + ceiling | Length the source supports, never exceed it, plus CONT-06 check | ✓ |
| No length guidance at all | Maximum honesty; unpredictable output length | |
| Explicit tiers by source length | Predictable for card design; reintroduces numeric targets | |

**User's choice:** Proportional + ceiling — Claude's recommendation
**Notes:** Tiers rejected as reintroducing the exact mechanism behind the padding defect.
"No guidance" rejected against Phase 1's D-06, where cards were designed for two-to-six lines.

### Q3 — Where does attribution live?

| Option | Description | Selected |
|--------|-------------|----------|
| Thin sources only | Code branches on source word count; model never judges thinness | ✓ |
| Always in-text | Strongest legal posture; opens every deck with a publication name | |
| Never in-text — chrome only | Best-reading prose; provenance lost when text travels | |

**User's choice:** Thin sources only — Claude's recommendation
**Notes:** Chrome-only argued against because `/rss.xml`, share cards and search snippets
strip layout, which is exactly where the *AP v. Meltwater* exposure applies. The objection
that conditional rules are unreliable was met by making the branch deterministic in code
rather than a model judgement.

---

## Grounding check design

### Q1 — How should the check detect unsupported claims?

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid, split policy | Deterministic + judge; both live, judge-on-flagged for backfill | ✓ |
| LLM judge on everything, always | One call per summary everywhere; simplest, costliest | |
| Deterministic checks only | Free and auditable; cannot satisfy CONT-04 as written | |

**User's choice:** Hybrid, split policy — Claude's recommendation
**Notes:** Reasoning given up front unprompted. Key point: the lexicon *would* catch the known
example, but CONT-04 asks for any untraceable claim and a fabrication phrased without advisory
vocabulary passes clean. Cost asymmetry between ~150/day live and 41,233 backfill drove the
split policy.

### Q2 — What happens on a flag?

| Option | Description | Selected |
|--------|-------------|----------|
| Retry once, then hold | Stricter re-prompt; still-flagged goes to a visible review queue | ✓ |
| Hold immediately | Strictest; every false positive costs an article | |
| Publish and flag | Nothing stalls; fabrications readable until reviewed | |

**User's choice:** Retry once, then hold — Claude's recommendation

### Q3 — How do we prove the check works?

| Option | Description | Selected |
|--------|-------------|----------|
| Labelled fixture set | Known fabrication + known-good, measured false-positive ceiling | ✓ |
| Known example plus the 30-summary read | Meets CONT-05 literally; no measured FP rate | |
| Known example only | Minimum to satisfy the requirement as written | |

**User's choice:** Labelled fixture set — Claude's recommendation
**Notes:** Argued from the prior decision: Q2 makes false positives expensive, and a detector
validated on one positive and zero negatives says nothing about its false-positive rate.
Framed as the same instinct as Phase 1's D-06 stress set and D-13's generated contrast table.

---

## Title & slug stability

### Q1 — What is allowed to change on re-processing?

| Option | Description | Selected |
|--------|-------------|----------|
| Freeze title and slug | Only summary, keyPoints, entities, tags update | ✓ |
| Freeze slug, allow title change | Titles improve; URL text and headline drift apart | |
| Regenerate both, add redirects | Best quality; makes a UUID resolver release-blocking for Phase 4 | |

**User's choice:** Freeze title and slug — Claude's recommendation
**Notes:** Claude verified the URL mechanics before framing the question rather than assuming.
Finding: v1 resolves by UUID alone (`[slug].vue:8-24`), so slug text is decorative and
rewriting breaks nothing *in v1*. The real risk is v2's static pre-generation, where a
superseded slug 404s. That reframed the question from "do URLs break" to "how many old URLs
must v2 rescue".

### Q2 — Should the grounding check cover titles?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — same check as summaries | A headline is a claim, and the most-read AI text on the site | ✓ |
| No — summaries only | Tighter scope; leaves the most visible AI text unchecked | |

**User's choice:** Yes — same check as summaries

---

## Re-processing scope

### Q1 — Re-fetch source pages, or re-summarise stored content?

| Option | Description | Selected |
|--------|-------------|----------|
| Stored content only | Batch job, no network; fixes fabrication, leaves thinness | ✓ |
| Re-fetch everything | Best archive quality; ~41k fetches into nine months of link rot | |
| Re-fetch only truncated rows | ~6,000 fetches targeting known-deficient rows | |

**User's choice:** Stored content only — Claude's recommendation
**Notes:** Framed as a premise check: re-fetching is only worth it if old articles are read,
and PROJECT.md derives archive depth from measured traffic while treating the PRD's 2,000
hot-content figure as the one ungrounded number. Supporting evidence — ROADMAP criterion 1
scopes the truncation bar to *newly ingested* articles, so the archive is never asked to meet
it.

### Q2 — What defines the re-processing set?

| Option | Description | Selected |
|--------|-------------|----------|
| Check-determined slice | Free deterministic sweep, judge the flagged, plus outage window | ✓ |
| Whole corpus | Uniform provenance; pays to redo summaries that were fine | |
| Known-bad heuristics only | Cheapest to scope; misses fabrications avoiding advisory vocabulary | |

**User's choice:** Check-determined slice — Claude's recommendation

### Q3 — How is the $1 approval gate enforced?

| Option | Description | Selected |
|--------|-------------|----------|
| Two commands, report-gated | Dry run writes a report and calls nothing; real run requires it | ✓ |
| One command with a confirm flag | Simpler; one flag from being bypassed, including by an agent | |
| Dry run plus interactive prompt | Hard to miss; doesn't survive cron or a subagent | |

**User's choice:** Two commands, report-gated — Claude's recommendation
**Notes:** Argued as structural rather than procedural enforcement, by analogy to the
zero-D1-reads build assertion. This question was asked twice — the user said "try again" after
the first round and selected identically.

---

## The dead third source

### Q1 — What do we do about elpasolocalnews.org?

| Option | Description | Selected |
|--------|-------------|----------|
| Repoint to elpasonews.org | Update feed_url; three-source mix preserved | ✓ |
| Deactivate, run on two sources | Unambiguous; changes the pinned source mix | |
| Repoint, but verify first | Most rigorous; defers the fix into research | |

**User's choice:** Repoint to elpasonews.org
**Notes:** Claude re-verified the 16-hour-old DNS finding before presenting it, getting
NXDOMAIN from Cloudflare's resolver directly — authoritative non-existence, not an outage.
Then checked whether the outlet had simply moved and found El Paso News live at
`elpasonews.org`. Claude stated plainly that publication-identity continuity was **not proven**,
only plausible, and asked the owner — who knows the local outlets — to make the call. Also
flagged as open: when the old domain died and what corpus gap that left.

---

## Where the work lands

### Q1 — Where do planning artifacts commit?

| Option | Description | Selected |
|--------|-------------|----------|
| develop | Matches documented convention; keeps phase-01's approved diff clean | ✓ |
| New feature/phase-02 branch | Strictest one-branch-per-phase reading | |
| Stay on feature/phase-01 | No branch work; mixes into a completed phase's branch | |

**User's choice:** develop — Claude's recommendation
**Notes:** `develop` is a protected branch under the user's global rules, so the option text
stated that selecting it constitutes explicit authorisation to commit there.

### Q2 — What branch for pipeline code?

| Option | Description | Selected |
|--------|-------------|----------|
| New feature/phase-02 | Created by Jaime in lazygit off develop | ✓ |
| Continue on feature/fix/d1-sort-index | No branch juggling; mixes unrelated in-flight work | |
| Decide at plan time | Defers; leaves the planner without a locked answer | |

**User's choice:** New feature/phase-02
**Notes:** Branch does not exist yet. Claude does not create branches — this is a blocker the
planner must surface before implementation starts.

### Q3 — Public changelog entry?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — prompt fix and re-processing | Consistent with building in the open | ✓ |
| Yes, but only the re-processing | Focused on what readers would notice | |
| No — internal changelog only | Sits awkwardly against the project's own claim | |

**User's choice:** Yes — prompt fix and re-processing

---

## Claude's Discretion

- The three FIX defects (FIX-01, FIX-02, FIX-03) — unambiguous, not discussed. All three
  verified still open against the working tree on 2026-09-18.
- Prompt wording, code structure, module layout, chunk sizes, test organisation.
- Whether `duplicate-detector.ts` moves off `gpt-4o-mini` alongside the summariser.

## Deferred Ideas

- Re-fetching archive source pages to enrich thin legacy summaries — revisit only on Phase 4/5
  traffic data.
- Moving `duplicate-detector.ts` off `gpt-4o-mini`.
- Lowering `temperature` from 0.4 for faithfulness.
- Running the grounding judge on a different model than the summariser.
- Extending the grounding check to Spanish summaries — Phase 6.
- Politeness posture toward the three sources (robots.txt, User-Agent, rate limiting) — must be
  settled during planning, since the fetch decision puts us on two newsrooms' servers daily.
- Whether fetched full text is stored or only summarised from.
- CONT-11's 24-hour Batch window mechanics.
