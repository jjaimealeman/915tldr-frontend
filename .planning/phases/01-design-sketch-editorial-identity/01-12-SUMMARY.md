---
phase: 01-design-sketch-editorial-identity
plan: 12
subsystem: testing
tags: [markdown, html-escaping, node-test, i18n, tdd]

requires:
  - phase: 01-design-sketch-editorial-identity
    provides: "01-11: pnpm as the sole package manager, so `node --test` runs cleanly under the pnpm toolchain this plan's verification depends on"
provides:
  - "design/scripts/lib/summary-markdown.mjs: escapeHtml, parseSummary, renderSummaryHtml, summaryPlainText, validateBlocks — pure ESM, no dependencies, no I/O"
  - "A closed block/inline contract (p/list blocks, plain/strong inlines) proven against all 54 real fixture summaries and every Spanish fixture string, ready for 01-18 (static pages), 01-21 (feed JSON + client renderer) and 01-22"
affects: [01-18, 01-21, 01-22]

actuals:
  tokens: 5823
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Escape at render time, never at parse time — typed blocks carry raw text so a client renderer (01-21) can use textContent instead of innerHTML, and a server renderer can still call escapeHtml explicitly."
    - "Inline **bold** parsing via a manual character scan (indexOf-based lookahead for a closing '**'), not a global regex sweep — an unmatched '**' degrades to literal text instead of accidentally pairing with a later, unrelated '**' elsewhere in the string."
    - "Fixture sweeps walk JSON fixtures recursively and collect real rows by structural shape (uuid + status + summary present), following the same pattern design/tests/content.spec.ts already established for this fixture, rather than hand-enumerating the fixture's mixed shapes (bare row / array of rows / {chosen,rejected} pairs / {rows,chosen} pairs / non-row metadata)."

key-files:
  created:
    - design/scripts/lib/summary-markdown.mjs
    - design/tests/unit/summary-markdown.test.mjs
  modified: []

key-decisions:
  - "Implemented the plan's <feature> block literally rather than relying on the fact that generic inline-parsing alone would already produce the correct single-strong-inline 'Key Details:' paragraph in the common case — the explicit header/bullet-run split in parseGroup is needed for the less common case where prose and a Key Details label share the same blank-line-delimited group (no blank line between them), which the generic space-join rule would otherwise merge into one paragraph."
  - "validateBlocks treats 'strong: false' as invalid (not merely redundant) — the contract states strong's only allowed value is true, so parseSummary never emits it and a feed payload that does is rejected rather than silently accepted."

patterns-established:
  - "Pattern: dependency-free lib modules under design/scripts/lib/ pair with a node:test suite in design/tests/unit/ named after the lib, following glyphs.mjs / check-contrast.test.mjs precedent."

requirements-completed: [DSGN-06, I18N-07]

coverage:
  - id: D1
    description: "parseSummary converts the corpus's two markdown constructs (**Key Details:** label + bullet lines) into typed p/list blocks with plain/strong inlines, matching the exact structural contract for the prose+Key Details+bullets case"
    requirement: "DSGN-06"
    verification:
      - kind: unit
        ref: "design/tests/unit/summary-markdown.test.mjs#Prose + Key Details + bullets parses to [p, p(strong), list] and renders exact HTML"
        status: pass
    human_judgment: false
  - id: D2
    description: "renderSummaryHtml emits only p/strong/ul[data-key-details]/li, escapes & < > \" ' in every text run, and never passes raw HTML through — proven against a script-tag/quote-character injection case"
    requirement: "DSGN-06"
    verification:
      - kind: unit
        ref: "design/tests/unit/summary-markdown.test.mjs#script tags and quote characters are escaped, never emitted as raw HTML"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every summary in design/fixtures/stress-set.json parses and renders without throwing; every Key Details summary yields exactly one strong-only paragraph followed by a list with the correct item count and a plain-text round trip; no rendered summary contains a literal **"
    requirement: "DSGN-06"
    verification:
      - kind: unit
        ref: "design/tests/unit/summary-markdown.test.mjs#fixture sweep: every stress-set.json summary parses and renders without throwing"
        status: pass
    human_judgment: false
  - id: D4
    description: "Spanish and other non-ASCII characters (accents, ñ/ü, curly quotes, em dash, ellipsis) pass through parse and render unchanged, and empty/whitespace-only input parses to an empty block list"
    requirement: "I18N-07"
    verification:
      - kind: unit
        ref: "design/tests/unit/summary-markdown.test.mjs#Spanish and other non-ASCII characters are preserved code point for code point"
        status: pass
      - kind: unit
        ref: "design/tests/unit/summary-markdown.test.mjs#parseSummary('') returns []"
        status: pass
      - kind: unit
        ref: "design/tests/unit/summary-markdown.test.mjs#Spanish sweep: every spanish-stress.json component string survives parse + summaryPlainText"
        status: pass
    human_judgment: false
  - id: D5
    description: "validateBlocks rejects any block structure the renderers would not produce (unknown type, extra keys, non-string/empty text, strong:false) and returns [] for any real parseSummary output"
    requirement: "DSGN-06"
    verification:
      - kind: unit
        ref: "design/tests/unit/summary-markdown.test.mjs#validateBlocks rejects malformed block structures"
        status: pass
      - kind: unit
        ref: "design/tests/unit/summary-markdown.test.mjs#validateBlocks returns [] for any parseSummary output"
        status: pass
    human_judgment: false

duration: 8min
completed: 2026-09-17
status: complete
---

# Phase 01 Plan 12: Summary Markdown to Typed Blocks and Safe HTML Summary

**Built and TDD-tested the one conversion function that fixes revision request 9 (raw `**Key Details:**`/bullet markdown leaking into rendered summaries): `design/scripts/lib/summary-markdown.mjs` exports `parseSummary`, `renderSummaryHtml`, `summaryPlainText`, `validateBlocks`, `escapeHtml`, proven against all 54 real fixture summaries and every Spanish fixture string.**

## Performance

- **Duration:** ~8 min (Tasks 1-2)
- **Started:** 2026-09-17 (immediately following 01-11's completion commit)
- **Completed:** 2026-09-17
- **Tasks:** 2 (both complete)
- **Files modified:** 2 (both new)

## Accomplishments

- `parseSummary` turns the corpus's two markdown constructs into a closed typed-block contract: paragraphs (`{type:'p', inlines}`) with plain/strong inline runs, and lists (`{type:'list', items}`) of inline runs per bullet item.
- `renderSummaryHtml` emits only `<p>`, `<strong>`, `<ul data-key-details>` and `<li>`, escaping `& < > " '` in every text run at render time — never passing raw HTML through, verified against a `<script>` tag + quote-character injection case.
- `summaryPlainText` and `validateBlocks` round out the contract: plain-text flattening for search/RSS-style uses, and a strict structural validator so feed JSON (01-21) can be checked before it reaches the browser.
- 20/20 tests pass on `node --test design/tests/unit/summary-markdown.test.mjs`, including a fixture sweep over every real row in `design/fixtures/stress-set.json` (recursively walked, deduped by uuid) and a Spanish sweep over every string field of every `design/fixtures/spanish-stress.json` component.
- TDD gate executed as two real commits, RED then GREEN, no refactor needed — implementation passed the full suite on the first attempt.

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Write the failing summary-markdown test suite** - `5069223` (test)
2. **Task 2 (GREEN): Implement summary-markdown.mjs until the suite passes** - `ae705b7` (feat)

_No refactor commit: the implementation passed all 20 tests on the first attempt with no cleanup needed._

## Files Created/Modified

- `design/tests/unit/summary-markdown.test.mjs` - node:test suite covering every behavior bullet in 01-12-PLAN.md, plus the fixture and Spanish sweeps
- `design/scripts/lib/summary-markdown.mjs` - the five-export library: `escapeHtml`, `parseSummary`, `renderSummaryHtml`, `summaryPlainText`, `validateBlocks`

## Decisions Made

- Implemented the plan's explicit header/bullet-run split in `parseGroup` rather than relying on generic inline parsing alone to produce the single-strong-inline "Key Details:" paragraph — needed for the case where prose and the Key Details label share one blank-line-delimited group with no blank line between them.
- `validateBlocks` treats `strong: false` as invalid (not merely redundant), matching the contract's "strong's only allowed value is true."
- Fixture sweeps use the same recursive-walk-by-structural-shape pattern `design/tests/content.spec.ts` already established for `stress-set.json`, extended with the `summary` field requirement this plan needs, rather than hand-enumerating the fixture's mixed shapes.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' acceptance criteria passed on the first attempt; no auto-fixes were needed.

## Issues Encountered

None.

## Known Stubs

None - this is a pure, fully-implemented data-transform library with no placeholder data or UI. No page yet renders through it (that wiring is 01-18/01-21/01-22's job), which is the plan's stated scope, not a stub.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The summary-markdown contract is implemented, tested against every real fixture summary and every Spanish fixture string, and ready for 01-18 (static pages), 01-21 (feed JSON + client renderer) and 01-22 to consume.
- No page currently calls this library yet — wiring it into actual page rendering is explicitly out of scope for this plan (it exists to prove the conversion before any page depends on it) and is left for the plans named above.

---
*Phase: 01-design-sketch-editorial-identity*
*Completed: 2026-09-17*

## Self-Check: PASSED

Both created files found on disk (`design/tests/unit/summary-markdown.test.mjs`, `design/scripts/lib/summary-markdown.mjs`); both commits (`5069223`, `ae705b7`) found in git log.
