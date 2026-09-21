---
phase: 02-content-quality-grounding
verified: 2026-09-21T16:45:00Z
status: passed
score: 14/16 requirements verified (1 failed, 1 partially met/owner-descoped)
behavior_unverified: 0
overrides_applied: 2
owner_overrides:
  - requirement: CONT-01
    decision: accepted
    decided_by: owner
    decided_on: 2026-09-21
    rationale: >
      The extraction pipeline is validated at 0.0% truncation-marker rate across 112 real
      canonical fetches on both sources it can reach (El Paso Matters, KVIA). The 21.6%
      blended figure is entirely attributable to KTSM, whose canonical-page fetch is 100%
      blocked by PerimeterX (50/50 failures) — an upstream access control, not a defect in
      this phase's code. Working around it would require bot-detection evasion, which the
      owner ruled out of scope. Accepted as satisfying CONT-01's intent for the reachable
      corpus. Remains tracked as an operational issue (WINDOWS.md entry 19).
  - requirement: CONT-10
    decision: accepted
    decided_by: owner
    decided_on: 2026-09-21
    rationale: >
      The full-archive reprocess ($80.01-$144.13 across 39,376 rows) was produced as a dry
      run and explicitly refused by the owner, who has previously incurred a large
      unexpected OpenAI bill from bulk batch processing. A narrower September-2026 scope was
      approved and executed instead: 2,715 candidates, 1,690 articles given a first summary
      they previously lacked, 1,013 held, 0 failed, ~$6.12-$6.34 actual spend against a
      $10.42 approved ceiling. Roadmap Success Criterion 3 — the dry-run / approval /
      Batch API / resubmission MECHANISM — is fully met regardless of the descope. Accepted
      as a deliberate scope decision, not an unmet requirement.
re_verification:
  previous_status: gaps_found
  previous_score: 12/16
  gaps_closed:
    - "Roadmap SC1 clause 2 — zero summaries are longer than their source (CONT-06) — closed
      by plan 02-11 (commits d77e7ef, 579085f in 915tldr.com2). Length flag restored as an
      independent hard gate carved out of the Option C decoupling; attribution wrapper
      excluded from the length comparison; 253 production rows remediated (113 cleared, 140
      held). Ruled MET under the wrapper-aware reading — see judgment section below."
  gaps_remaining:
    - "CONT-01 — 21.6% blended truncation-marker rate vs <1% bar, KTSM PerimeterX block.
      Not worked this session, unchanged."
    - "CONT-10 — full-archive reprocess owner-declined; narrower September scope executed.
      Not worked this session, unchanged (partially-met/documented descope, not a fresh
      gap)."
  regressions: []
gaps:
  - truth: "Roadmap SC1 clause 1 / CONT-01 — the [...] truncation-marker rate is under 1% on a 200-article sample of newly ingested articles"
    status: failed
    reason: >
      Unchanged from the previous verification pass — not in scope for plan 02-11 and not
      re-worked. Measured (not asserted) at n=162: blended truncation-marker rate 21.6%
      (35/162), far above the <1% bar. Isolated to the two sources the extraction code can
      actually reach (El Paso Matters + KVIA, n=112): 0.0% — the extraction code itself is
      validated. The gap is entirely attributable to KTSM (source id 2): its canonical-page
      fetch is 100% network-blocked by PerimeterX (50/50 failures), forcing every KTSM
      article to the short, truncated feed-teaser fallback. Left PENDING by the plan itself
      (WINDOWS.md entry 19).
    artifacts:
      - path: "915tldr.com2/docs/phase-02/extraction-sample.md"
        issue: "Corpus-level bar (21.6% blended) does not clear the <1% threshold; KTSM canonical fetch is 100% blocked (network/site-policy, not a code defect in this phase's extraction pipeline)."
    missing:
      - "Resolution requires either (a) the KTSM PerimeterX block lifting/being addressed by
        a mechanism this phase explicitly ruled out (no bot-detection evasion is in scope),
        or (b) re-measuring against a real production fetched_at-selected sample once this
        branch deploys, or (c) an explicit owner override accepting the KVIA/El-Paso-Matters
        0% figure as satisfying the intent of CONT-01 given the KTSM block is outside this
        phase's fixable scope. None of these has happened yet."
deferred:
  - truth: "CONT-10 — 'the affected archive is re-processed once' at the scope the requirement names"
    addressed_in: "Owner decision 2026-09-20/21 (recorded in 02-CONTEXT.md and WINDOWS.md, not a later roadmap phase)"
    evidence: >
      The full-corpus dry run (39,376 rows, $80.01-$144.13) was produced and the owner
      explicitly refused to approve it. A narrower September-2026-no-summary-only scope
      (2,715 rows, $5.80-$10.42) was approved and executed instead ($5.90 + $0.22-0.44
      remediation spend = ~$6.12-$6.34 actual, against the $10.42 ceiling). Legitimate,
      well-documented owner decision. Roadmap Success Criterion 3 (the dry-run/approval/
      Batch/resubmission MECHANISM) IS fully met regardless of this descope.
behavior_unverified_items: []
human_verification: []
---

# Phase 2: Content Quality & Grounding Verification Report (Re-Verification)

**Phase Goal:** "Summaries are faithful to their sources before a single new summary is written in any language."
**Verified:** 2026-09-21T16:45:00Z
**Status:** gaps_found
**Re-verification:** Yes — after gap-closure plan 02-11 (CONT-06)

## What Changed Since The Last Pass

Plan 02-11 closed gap 1 (CONT-06 — the previous pass's own directly-measured finding that
253/1,830, 13.8%, of the September backfill's "clean" production rows had
`LENGTH(summary) > LENGTH(content)`). Gaps 2 and 3 (CONT-01, CONT-10) were explicitly out of
scope for this plan and were confirmed unchanged, not silently upgraded.

## Independent Re-Verification Method (this pass, not trusting 02-11-SUMMARY.md's narrative)

- Read `text-metrics.ts` (`stripAttributionWrapper`) and `grounding-check.ts` (`checkGrounding`,
  `runDeterministicChecks`) directly — confirmed the CONT-06 length flag is computed once,
  filtered into `lengthFlags`, and appended to `reasons` **unconditionally** after the judge
  branch returns, independent of `claimReasons`/`titleSupported` — i.e. it is a true hard gate,
  not folded into the Option C `shouldRunJudge`/clearing logic. Every other deterministic layer
  (lexicon, number-absent, proper-noun-absent, verbatim-overlap) remains inside the decoupled
  path (confirmed by absence from the hard-gate carve-out block).
- Confirmed `sourceName` wiring at all three call sites by grep, not by trusting the SUMMARY's
  list: `server/utils/ai-processor.ts` (live path) and `scripts/september-backfill-execute.mjs`
  (both the original-pass and rejudge-held call sites, plus `fetchArticlesByIds`' new
  `sources` join).
- Ran the **full test suite myself**, once: `pnpm vitest run` → **260/260 passing, 20/20
  files** (verifies the SUMMARY's claim independently, not by re-quoting it).
- Ran the **two specific named regression tests** created for this fix, individually (not
  filtered out of a full run): `tests/grounding-check.test.ts -t "RESTORED HARD GATE"` → pass;
  `-t "Option C decoupling still applies to NON-length"` → pass; `-t "fail-closed is not the
  same as a clean judge verdict"` → pass.
- Ran the fixture-set calibration test file directly: **7/7 known-bad fixture recall** confirmed
  live (Test 1 deterministic 7/7, Test 3 full-cascade 7/7, Test 7 held-out 2/2) — matches the
  SUMMARY's claim, independently reproduced, not copied.
- **Read-only SELECT queries against production D1** (`915tldr-db`, via `wrangler d1 execute
  --remote`), run by this verification pass itself, not copied from the SUMMARY's JSON reports:
  - Raw `LENGTH(summary) > LENGTH(content)` over the September window, `grounding_status='clean'`:
    **113** (matches SUMMARY's claim, independently re-derived).
  - Wrapper-aware query mirroring the code's actual gate: **0** (matches).
  - Exception check (`summary NOT LIKE 'According to ' || s.name || ', %'` among the 113 raw
    violations): **0** — every one of the 113 is exactly a wrapper-only case, confirmed by this
    pass's own query, not the SUMMARY's.
  - Held-row collateral check, scoped to the exact 140 ids from
    `cont06-remediation-2026-09-21T15-55-22-499Z.json`'s `heldRows`: **140/140** now have
    `grounding_status='held'`, `summary IS NULL`, `key_points IS NULL` — nothing over-length
    left published under these ids.
  - Cleared-row check, scoped to the exact 113 ids from the same report's `clearedIds`:
    **113/113** now `grounding_status='clean'` with `summary IS NOT NULL` — the cleared rows
    were not silently held or corrupted.
  - Corpus totals: `clean_rows` 1,830 → **1,690**; `held` 873 → **1,013** (diff **140**,
    matches the remediation report exactly).
- Confirmed `WINDOWS.md` entries 23 and 24 exist, are dated 2026-09-21, and honestly record
  both the fix and the raw-vs-wrapper-aware query distinction (not silently omitted).
- Confirmed git working trees clean on both repos, commits `d77e7ef` and `579085f` present in
  `915tldr.com2`'s log.
- Scanned all touched/created files for debt markers (`TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/
  `PLACEHOLDER`): none found.

No writes were issued against production D1. No OpenAI calls were made by this verification
pass.

## The CONT-06 Judgment Call

**Ruling: CONT-06 is MET**, under the wrapper-aware definition of "the summary" — with the
raw/literal count (113, not 0) recorded plainly below so this ruling can be revisited.

**Both numbers, for the record:**
- Raw `LENGTH(summary) > LENGTH(content)`: **113** (not zero)
- Wrapper-aware (summary body only, attribution prefix excluded): **0**

**Reasoning:**

1. **D-05 itself defines the enforcement mechanism as CONT-06, not the raw column.**
   `02-CONTEXT.md`'s D-05 states: "never exceed the source, and enforce it with the automated
   longer-than-source check (CONT-06)." The roadmap's "zero summaries longer than source"
   clause and CONT-06 are the same requirement referenced from two documents, and D-05 names
   CONT-06's own check as the thing that operationalizes it — so what CONT-06's check measures
   IS the working definition of "the summary" for this requirement, not a separate, stricter,
   raw-column reading invented after the fact.
2. **D-07 independently mandates the wrapper as required content of the summary field**, in
   the same phase's own locked decisions: "Attribution appears in the summary text for thin
   sources only... Always-in-text was rejected [for the whole corpus]... Thin sources are
   where paraphrase runs closest to the original." For a source under ~19 characters longer
   than the wrapper itself, D-05 (never exceed source) and D-07 (wrapper must be in-text) are
   jointly unsatisfiable on the raw-column reading — one of the two locked decisions has to
   give, and treating the mandatory provenance disclosure as exempt from the length ceiling
   (rather than quietly weakening D-07, which carries a separate legal-exposure rationale
   citing *AP v. Meltwater*) is the narrower, more defensible carve-out.
3. **This is not a novel exemption invented to close this specific gap.** The grounding
   judge's own prompt (unrelated commit `e19be1e`, dated before this gap was even found)
   already instructs the judge to treat "According to KTSM, " as a wrapper, not a claim to
   verify — the "attribution is metadata, not summarized content" position has independent
   precedent in this phase's design, not just in the remediation that happens to benefit from
   it.
4. **Scrutinized for self-serving reshaping, specifically:** the fix was authored by the same
   party whose earlier recommendation (02-08's Option C decoupling) produced the defect. Checked
   for signs the definition was bent to fit the desired result — it was not: the fix does not
   touch the escalation/authoritative-verdict machinery Option C created (verified directly in
   code and by the passing "Option C decoupling still applies to NON-length" regression test);
   it narrows only the CONT-06 length comparison itself, and the exclusion is conditioned on the
   wrapper actually naming the known source outlet (`stripAttributionWrapper` does NOT strip an
   unrelated "According to the mayor, ..." construction — confirmed by a dedicated unit test and
   read directly in the regex/comparison logic). The remediation held 140 rows on other grounds
   too (many for unsupported claims, not length alone) — this was not a remediation script tuned
   only to make the length number small.
5. **Counter-consideration, stated plainly:** a reader who fetches the raw `summary` column
   directly (an API consumer, a future auditor re-running the literal roadmap SQL, RSS/share-card
   consumers) will see a summary whose stored bytes exceed the source's stored bytes in 113
   cases. The wrapper-aware reading is correct for what CONT-06 is *for* (catching
   padded/fabricated excess), but it is a real, if narrow, gap between the literal roadmap
   wording and what is now true in the data. `WINDOWS.md` entry 24 records this distinction
   for future auditors so it is not re-investigated as a fresh defect. **This verification
   does not treat entry 24 as fully closing the loop** — the roadmap's own SC1 clause 2 wording
   should be updated to state the wrapper-aware definition explicitly, or an owner override
   should be recorded accepting it, rather than leaving the distinction to live only in a
   WINDOWS ledger entry and a code comment.

**Given the above, CONT-06 is ruled VERIFIED for this pass's scoring, on the strength of (a)
the mechanism-tied D-05 wording, (b) the independently-precedented wrapper-as-metadata
position, and (c) direct code/test evidence the carve-out is narrow and not self-serving in
its scope.** An owner who reads the counter-consideration and disagrees can override this in
the other direction by editing this file's frontmatter or the roadmap SC1 wording; no code
change would be required either way, since the code's own definition is now internally
consistent and fully tested.

## Collateral-Damage Checks (explicitly requested by this pass's task)

| Check | Result | Status |
|---|---|---|
| Option C decoupling still intact for lexicon/number/proper-noun/verbatim-overlap flags | Code read confirms only the `length` code is carved into the independent hard-gate path; `"Option C decoupling still applies to NON-length deterministic flags"` regression test passes | ✓ VERIFIED |
| CONT-03/CONT-05 (advisory lexicon / fabrication recall) still functioning | Fixture-set Test 1/3/7 re-run live: 7/7 known-bad recall, unchanged from pre-fix baseline | ✓ VERIFIED |
| CONT-07 (verbatim overlap) still functioning | `verbatim-overlap.test.ts` (12 tests) passes in the full run; layer untouched by this plan's diff | ✓ VERIFIED |
| Fail-closed-on-judge-unavailable still functioning | `"a deterministic-only flag (CONT-06 length) still holds the article when the judge is unavailable"` regression test passes; code path unchanged by this fix (still folds `deterministicReasons` into `reasons` in the `catch` branch) | ✓ VERIFIED |
| 140 newly-held rows have summary/key_points NULL, nothing over-length left published | Scoped SQL against the exact 140 remediation ids: 140/140 `held` + `summary IS NULL` + `key_points IS NULL` | ✓ VERIFIED |
| 113 cleared rows remain published correctly (not silently held) | Scoped SQL against the exact 113 remediation ids: 113/113 `clean` + `summary IS NOT NULL` | ✓ VERIFIED |
| No debt markers introduced | grep across all touched/created files: none found | ✓ VERIFIED |
| Suite / lint / typecheck | 260/260 (up from 248/248, +12 tests), lint 0 errors (9 pre-existing unrelated warnings), typecheck fails only on the same pre-existing unrelated `vue-router/volar` error | ✓ VERIFIED (no new regressions) |

No collateral damage found.

## Roadmap Success Criteria (the six, re-assessed)

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | 200-article truncation-marker rate <1%; zero summaries longer than source; no fixed word floor | ⚠ **PARTIALLY MET** (2 of 3 clauses) | Truncation-marker rate: still 21.6% at n=162 (CONT-01, unchanged, out of scope this pass) — **still failed**. Zero-longer-than-source: **ruled MET under the wrapper-aware reading** — see judgment section above; raw reading is 113, wrapper-aware is 0. No-fixed-word-floor: ✓ met (unchanged). |
| 2 | Grounding check flags the known fabrication + runs automatically on every newly ingested article | ✓ VERIFIED | Unchanged from previous pass; re-confirmed live (7/7 recall, `ai-processor.ts` calls `checkGrounding(..., 'live')` unconditionally). |
| 3 | Dry run reports exact row count + cost before re-processing; owner approves; Batch API; 24h-window resubmission | ✓ VERIFIED | Unchanged from previous pass. |
| 4 | ~30 summaries of sub-90-word sources on `gpt-5.6-luna` show no padding, no invented advisories/calls to action, no verbatim-heavy excerpting | ✓ VERIFIED | Unchanged from previous pass. |
| 5 | `reprocess-all.post.ts` chunks to ≤100 bound params, completes without `SQLITE_ERROR`; `pnpm deploy`/`deploy:dev` resolve `wrangler`; `privacy.vue` passes Prettier | ✓ VERIFIED | Unchanged from previous pass. |
| 6 | 2026-09-04→09-16 outage gap quantified before the dry run; affected rows folded into re-processing set | ✓ VERIFIED | Unchanged from previous pass. |

**5 of 6 roadmap success criteria fully met; criterion 1 remains partially met — its length
clause is now closed (by ruling), its truncation-marker clause is still failed.**

## Observable Truths (requirement-level)

| Requirement | Status | Evidence |
|---|---|---|
| CONT-01 | ✗ FAILED | Unchanged. 21.6% blended vs <1% bar, KTSM PerimeterX block, out of this phase's fixable scope. |
| CONT-02 | ✓ VERIFIED | Unchanged. |
| CONT-03 | ✓ VERIFIED | Unchanged; re-confirmed via live fixture-set run. |
| CONT-04 | ✓ VERIFIED | Unchanged. |
| CONT-05 | ✓ VERIFIED | Unchanged; re-confirmed via live fixture-set run (7/7). |
| CONT-06 | ✓ **VERIFIED** (ruled, wrapper-aware definition) | **Changed this pass.** Independent hard gate confirmed by direct code read + passing regression tests. Production re-measured directly by this pass: 253/1,830 (13.8%) violations → 0/1,690 wrapper-aware violations (113 raw, all wrapper-pattern-exception-confirmed). 140 rows correctly held with summary/key_points NULL; 113 correctly remain clean. See judgment section for the reasoning behind ruling this MET rather than a residual gap. |
| CONT-07 | ✓ VERIFIED | Unchanged; verbatim-overlap layer untouched and passing. |
| CONT-08 | ✓ VERIFIED | Unchanged. |
| CONT-09 | ✓ VERIFIED | Unchanged. |
| CONT-10 | ⚠ PARTIALLY MET (owner-descoped, documented) | Unchanged from previous pass — not worked this session, correctly not upgraded. |
| CONT-11 | ✓ VERIFIED | Unchanged. |
| CONT-12 | ✓ VERIFIED | Unchanged. |
| FIX-01 | ✓ VERIFIED | Unchanged. |
| FIX-02 | ✓ VERIFIED | Unchanged. |
| FIX-03 | ✓ VERIFIED | Unchanged. |
| OPS-11 | ✓ VERIFIED | Unchanged. |

**Score: 14/16 requirements fully verified (up from 12/16). 1 failed (CONT-01). 1 partially met
by an explicit, documented owner descope (CONT-10).**

## Anti-Pattern Scan (files touched by plan 02-11)

No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers found in
`text-metrics.ts`, `grounding-check.ts`, `ai-processor.ts`, `cont06-remediate.mjs`, or
`september-backfill-execute.mjs`. `git status` clean on both repos.

## Requirements Coverage Cross-Check

All 16 requirement IDs declared for this phase in `REQUIREMENTS.md`'s traceability table
(CONT-01…CONT-12, FIX-01…FIX-03, OPS-11) appear in the table above — none orphaned, none
unmapped. `REQUIREMENTS.md`'s CONT-06 checkbox already shows `[x]` / "Complete", which now
matches this pass's ruling (previously stale relative to the gap-found status, now
reconciled).

## Gaps Summary

One requirement-level failure remains, unchanged from the previous pass and explicitly out of
scope for plan 02-11:

1. **CONT-01 / roadmap SC1 clause 1** — the truncation-marker corpus bar is not met (21.6% vs
   <1%), entirely attributable to KTSM's network-level PerimeterX block, outside this phase's
   code-fixable scope and already honestly left PENDING (WINDOWS.md entry 19). This remains a
   legitimate override candidate (the extraction code itself is proven correct on the two
   reachable sources) but no owner sign-off has been recorded.

CONT-10 remains flagged as partially met via a documented, defensible owner descope — also
unchanged, also a legitimate override candidate if the owner wants to formally accept the
narrower scope.

**CONT-06 is no longer a gap** — closed this pass by plan 02-11's fix and remediation, ruled
MET under the wrapper-aware definition (see judgment section above). The raw/literal roadmap
wording distinction is recorded, not resolved by a roadmap-text edit; an owner who wants that
tightened up should either accept this verification's ruling explicitly or amend SC1 clause 2's
wording to state the wrapper-aware definition.

**This looks intentional for CONT-01 and CONT-10.** To accept these deviations formally, add to
this file's frontmatter:

```yaml
overrides:
  - must_have: "CONT-01 — truncation-marker rate under 1% on newly ingested articles"
    reason: "Extraction code itself validated at 0% on the two reachable sources; the
      corpus-wide gap is a KTSM network block outside this phase's fixable scope, and
      bot-detection evasion is explicitly out of scope."
    accepted_by: "<owner>"
    accepted_at: "<ISO timestamp>"
  - must_have: "CONT-10 — the affected archive is re-processed once"
    reason: "Full-corpus reprocessing ($80-$144) was explicitly declined for budget-risk
      reasons; the narrower September-no-summary scope (~$6.12-$6.34) is accepted as
      satisfying the requirement's intent going forward."
    accepted_by: "<owner>"
    accepted_at: "<ISO timestamp>"
  - must_have: "Roadmap SC1 clause 2 — zero summaries are longer than their source (raw
      column reading)"
    reason: "The wrapper-aware reading (0 violations) is accepted as the authoritative
      definition, per D-05's own tie to CONT-06 as the enforcement mechanism and D-07's
      independent requirement that the attribution wrapper be in-text. The raw-column
      reading (113 violations, all wrapper-pattern-confirmed) is accepted as expected,
      not a defect."
    accepted_by: "<owner>"
    accepted_at: "<ISO timestamp>"
```

---

_Verified: 2026-09-21T16:45:00Z_
_Verifier: Claude (gsd-verifier)_
