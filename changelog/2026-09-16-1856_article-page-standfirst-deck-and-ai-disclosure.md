# 2026-09-16 - Article Page: Standfirst Deck, AI Disclosure, and Removable Tags Section

**Keywords:** [FEATURE] [STYLING] [UI] [DESIGN] [ACCESSIBILITY]
**Session:** Evening, Duration (~40 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-16-1856_article-page-standfirst-deck-and-ai-disclosure.md`

## What Changed

- File: `design/mockups/article.html`
  - New article mockup built on the `five-tags` stress-set row (USPS Operation Santa)
  - D-01 second colour-block context: a `header[data-block][data-category="community"]` category header (category link + source/time byline)
  - D-10 standfirst deck: `[data-standfirst]` carries the summary's own first sentence, in italic Instrument Serif, as the deliberate replacement for the PRD §5.1 pull-quote device this content model cannot honestly support
  - Body split so the deck plus body paragraph together reproduce the summary exactly once
  - Per-article AI-summary disclosure crediting KTSM by name, linking to the original story (`rel="noopener external"`), plus a separate attribution line
  - Five-tag `[data-tags]` section as a single removable unit, no chip backgrounds (colour stays out of text grounds per D-01)
  - "More in Community" grid reusing three real feed rows, same card markup as 01-06
  - Community nav link carries `aria-current="page"` — the only page in the set where the nav reflects content rather than staying neutral
- File: `design/mockups/style.css`
  - Article layout CSS: block header, standfirst deck, body, disclosure/attribution, tags, grid heading
  - Added a generic `main h1` display-font rule, written broadly enough to also cover the page-level headings 01-07's remaining changelog.html and contact.html pages will add next

## Why

Task 1 of `01-07-PLAN.md`. The article page is where D-10 (no pull quotes) actually gets built, and where the second D-01 colour-block context gets its first real content test after the category masthead in 01-06.

## Issues Encountered

None — the deck/body split against the summary text checked out byte-for-byte on the first pass; no auto-fixes were needed.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested: `npm run check:contrast` (PASS); `npm run verify:phase-1 -- --pages=article --criteria=1,2` (PASS, both engines); inline Node contract check (`article contract ok`); acceptance-criteria greps (`rel="noopener"` = 2, `data-block` = 1, `data-i18n=` = 8); real Chromium screenshots at 320px and 1280px in light and dark themes
- What wasn't tested: WebKit-specific visual check (deferred to Task 3's full font-swap/CLS pass across all five pages, consistent with the plan); the owner's own keyboard-walk pass (criterion 3, end-of-phase)
- Edge cases: the five-tags row's usable image renders correctly; the removable tags section leaves no wrapper artifacts when mentally subtracted

## Next Steps

- [ ] Task 2: changelog.html and contact.html
- [ ] Task 3: rebuild the font subset against the final five-page copy and prove criteria 1, 2, 5

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** MEDIUM - one new page in a five-page design-sketch phase, no production code
