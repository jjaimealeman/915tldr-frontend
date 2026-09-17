# 2026-09-17 - Failing summary-markdown test suite (D-GAP revision 9, RED)

**Keywords:** [TESTING] [FEATURE]
**Session:** Morning, Duration (~15 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-17-1057_summary-markdown-red-suite.md`

## What Changed

- File: `design/tests/unit/summary-markdown.test.mjs` (new)
  - node:test suite for a not-yet-built `design/scripts/lib/summary-markdown.mjs` library: `escapeHtml`, `parseSummary`, `renderSummaryHtml`, `summaryPlainText`, `validateBlocks`.
  - Covers every behavior bullet in 01-12-PLAN.md: empty/whitespace input, single/multiple paragraphs, the `**Key Details:**` + bullet-list corpus pattern (exact HTML output), CRLF normalisation, inline bold parsing (matched and unmatched `**`), HTML escaping of `<script>` and quote characters, Spanish/non-ASCII pass-through, non-bullet punctuation (`•no space`, `- dash`, `* star`, `1. numbered`) staying literal, `summaryPlainText` joining, `validateBlocks` acceptance/rejection, and the exact five-export public API.
  - Two exhaustive sweeps: a fixture sweep that recursively walks every real row (uuid+status+summary) in `design/fixtures/stress-set.json`, and a Spanish sweep over every string field of every component in `design/fixtures/spanish-stress.json`.

## Why

Revision request 9 (raw markdown leaking into rendered summaries) needs a pure, tested conversion before any page consumes it (01-18 static pages, 01-21 feed JSON/client renderer, 01-22). This is the RED half of the plan's TDD gate: the contract is pinned down as a failing suite before any implementation exists.

## Issues Encountered

None — `node --test design/tests/unit/summary-markdown.test.mjs` fails as expected because the module doesn't exist yet (`ERR_MODULE_NOT_FOUND`), not a syntax error in the test file itself.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `node --test design/tests/unit/summary-markdown.test.mjs` run directly — confirmed exit code 1 and the failure is the missing module import, not a test-file syntax error.
- What wasn't tested: the implementation itself doesn't exist yet — this is the failing RED commit only. GREEN follows in the next commit.

## Next Steps

- [ ] Implement `design/scripts/lib/summary-markdown.mjs` until the suite is green (GREEN commit)
- [ ] Write 01-12-SUMMARY.md once both commits land

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** LOW - test-only commit, no production code changed yet
