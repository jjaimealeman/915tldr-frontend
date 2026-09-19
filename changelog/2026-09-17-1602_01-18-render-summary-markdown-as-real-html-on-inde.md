# 2026-09-17 - Summary markdown renders as real HTML on index (defect 9, Task 1)

**Keywords:** [FEATURE] [BUG_FIX] [TESTING] [STYLING]
**Session:** Afternoon
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-17-1602_01-18-render-summary-markdown-as-real-html-on-inde.md`

## What Changed

- File: `design/scripts/render-summaries.mjs` (new)
  - Converts every `<p data-summary ...>` element on a mockup page into `<div data-summary ...>` holding the 01-12 `summary-markdown` converter's rendered HTML (`parseSummary` + `renderSummaryHtml`) — never re-implements markdown parsing or escaping. Decodes `&amp; &lt; &gt; &quot; &#39;` plus numeric character references before parsing; aborts loudly on any other named entity. An empty parse result removes the element; a non-empty one becomes `<div data-summary>` with the original attributes carried over verbatim. Only touches `<p data-summary>` — an already-converted `<div data-summary>` is left untouched, so a second run is byte-identical (`--pages=index` twice: `converted=33 removed=0` then `converted=0 removed=0 unchanged=33`).
- File: `design/mockups/index.html`
  - Ran through the converter: 33 `<p data-summary>` elements became `<div data-summary>`, 25 of which held the `**Key Details:**`/bullet markdown reproduced during planning — now a real `<p><strong>Key Details:</strong></p>` label followed by `<ul data-key-details><li>...` per bullet.
- File: `design/mockups/style.css`
  - `[data-lead] p[data-summary]` / `[data-card] p[data-summary]` retargeted to `[data-lead] [data-summary]` / `[data-card] [data-summary]`, `white-space: pre-line` removed (real block elements carry their own spacing now). New rules: `[data-summary] > p` margin, `[data-summary] > :last-child` margin reset, `[data-key-details]` list indent/margin, `[data-key-details] li + li` spacing. No colour literal in any of them.
- File: `design/tests/content.spec.ts`
  - New per-page test ("summaries render markdown as HTML...@c1"): walks all rendered body text for a literal `**`; for every `[data-key-details]`, checks its preceding sibling is a `<p>` holding exactly one `<strong>Key Details:</strong>`, every `<li>` is non-empty and doesn't start with the bullet character; and for any such list whose card/lead has no `lang="es"`, compares the rendered items against the fixture row's own bullet lines (prefix-stripped, whitespace-normalised).
- File: `design/tests/support/i18n.ts`
  - Real bug found and fixed while proving the Spanish injection path still passes (a must-have truth of this plan): `injectText()`'s generic "ambiguous target → overwrite the whole element" fallback used to paste the Spanish fixture's raw `**Puntos clave:**`/bullet text straight into `[data-summary]` as a flat text node. That used to work because `white-space: pre-line` gave the raw markdown visible line breaks; removing that CSS (this plan) collapsed it to one run-on line, shrinking the container and tripping the overflow spec's "container must grow to fit longer text" guard as a false positive at 768px/1280px in both engines. Fixed: a `[data-i18n]` hook that resolves directly to a `[data-summary]` element is now rendered through the same `parseSummary`/`renderSummaryHtml`/`summaryPlainText` functions the static page itself uses (computed in the Node/test-runner context, passed into `page.evaluate` as data, never eval'd in-page) — matching what the real bilingual pipeline will actually produce.

## Why

Closes defect 9 from `01-APPROVAL.md`: "Raw markdown in the article body: `**Key Details:**` renders with literal asterisks — the summary's markdown is not converted to HTML." Planning found 25 raw marker lines on index.html and 11 on category.html; this task reproduces and closes it on index (category and the remaining pages are Task 2).

## Issues Encountered

Real regression, not just a stub: converting the summary markup broke the existing Spanish-overflow container-growth check for `lead-summary` (`i18n.ts`'s ambiguous-target fallback). Root-caused to `white-space: pre-line` removal + a flat-text injection path that never rendered the raw markdown it was pasting. Fixed by routing `[data-summary]` injections through the real converter rather than loosening the container-growth threshold.

## Dependencies

No new dependencies — consumes 01-12's existing `design/scripts/lib/summary-markdown.mjs`.

## Testing Notes

- What was tested: `node design/scripts/render-summaries.mjs --pages=index` run twice (idempotency proven); `MOCKUP_PAGES=index node design/scripts/pw.mjs --project=all design/tests/content.spec.ts` (18/18 both engines, including the new test); `MOCKUP_PAGES=index node design/scripts/pw.mjs --project=all design/tests/spanish-overflow.spec.ts` (14/14 both engines, including the two tests that failed before the `i18n.ts` fix).
- What wasn't tested: category, article, changelog, contact pages (Task 2) and the category lead image/fallback contract (Task 3).

## Next Steps

- [ ] Task 2: convert the remaining four pages and re-prove criteria 1 and 4 across all pages
- [ ] Task 3: category lead — image-led only with a usable image, defined typographic fallback

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** MEDIUM — content-rendering fix on the busiest page (index), verified in both engines
