# 2026-09-17 - content.spec.ts: Nav Order, Fixture-Uuid Fidelity, Changelog Dispatch Verification (D-01, D-06, D-10, D-11, D-12)

**Keywords:** [FEATURE] [TESTING] [BUG_FIX] [DATABASE] [ACCESSIBILITY]
**Session:** Early morning, Duration (~35 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-17-0545_content-spec-nav-order-uuid-fidelity-changelog-dispatches.md`

## What Changed

- File: `design/tests/content.spec.ts` (new, 37 tests, tagged `@c1`/`@c5`)
  - **All five pages:** canonical nav category order plus pairwise-distinct stripe colours per
    theme; every categorised `[data-card]` has a non-empty `[data-category-name]`, every
    `data-category="none"` card has neither a name nor a non-`--cat-none` stripe, every
    `[data-summary]` is non-empty; `[data-block]` exists exactly once on category.html and
    article.html and nowhere else, computing to `--block-ink`; every `data-uuid` resolves to a
    real, `processed`, non-duplicate row in `design/fixtures/stress-set.json`; every external
    link carries `rel=noopener`, every `img` has `width`/`height`/`alt`, and the
    `[data-stress="junk-image"]` card has no `img`
  - **index/category:** `[data-grid]` `time[datetime]` values are non-increasing; index has no
    per-category heading outside a card (D-12)
  - **changelog:** dispatch count/titles/dates/item-text match `changelog.json` exactly in array
    order (NFC-normalised); no `ul`/`ol`/`li` in `main`; no empty `<p>` inside a dispatch; the
    single-item entry renders as one `<p>` holding one `[data-item]`; same-date dispatches are
    distinct elements each with their own `<time>`
  - **article:** no `blockquote`/`q`/`pull`-named element; `[data-standfirst]` + body
    reproduces the fixture row's own summary exactly once (D-10); `[data-ai-disclosure]` links
    to the row's own `url`; `[data-tags]` holds five links and removing it leaves no orphaned
    "Tags" heading or empty `section`
  - **contact:** every `input`/`textarea` has a matching `label[for]`; the form has no `action`
    attribute
  - `readFixtureRowsByUuid()` recursively walks `design/fixtures/stress-set.json`'s `cases`
    object (a hand-authored mix of bare rows, lists, `{chosen, rejected}` pairs, and
    non-row metadata) to build a uuid -> `{status, is_duplicate}` map, the same
    don't-hand-enumerate-shapes approach `check-contrast.mjs`'s coverage rule already
    established (01-05/01-07 precedent)

## Why

Turns the probe-derived edge cases from 01-CONTEXT.md (nav order, the uncategorized stripe,
changelog ties and the single-item entry) and the decision-level content rules (D-01 block
placement, D-10 standfirst fidelity, D-12 no per-category sections) into regression-proof
checks, so a future edit can't silently reintroduce a stray per-category section or an
uncategorized card with a phantom colour.

## Issues Encountered

- **Real bug in my own first draft, caught before commit — fixture-row shadowing.**
  `design/fixtures/stress-set.json`'s `cases.usable-image.rejected` array contains bare
  `{uuid, url, headStatus, reason}` image-candidate records that share a uuid with a real
  article row filed elsewhere in the fixture (e.g. under `cases.feed`). A first-seen-wins uuid
  walk (mirroring `check-contrast.mjs`'s union-find precedent a little too literally) picked up
  the candidate record first for several uuids and reported `status: "undefined"` — a false
  failure on real, correctly-published rows, not a real content defect. Root-caused by
  comparing `usable-image`'s key position (before `feed`) in the `cases` object against
  Python's own JSON key-order walk. Fixed by only accepting a record once it actually has a
  `status` field (the real-row shape), for both `readFixtureRowsByUuid()` and article.html's
  own single-row lookup — never by loosening the "processed, non-duplicate" assertion itself.
- Verified this fix against real content: uuid `aee43053-...` (the Fredd Young community card,
  reused across index/article/changelog/contact) and three others now correctly resolve to
  their `feed`/named-case row instead of their `usable-image.rejected` shadow.
- Ran `npm run verify:phase-1 -- --criteria=1,3,5` per the plan's own verification step: criteria
  1 and 3 PASS cleanly in both engines. Criterion 5 (font-swap CLS timing, not this plan's own
  content/structure work) FAILs in both engines — but the two failures are **byte-for-byte the
  same already-recorded findings** as WINDOWS.md entries 4 and 6, not new regressions: WebKit's
  index@320px `geometryScore` (0.7587...) matches entry 4's "up to 0.76" WebKit-Docker
  missing-font root cause exactly, and Chromium's changelog@320px native CLS (0.012502...)
  matches entry 6's recorded 0.0125 exactly. Per this plan's own explicit scope boundary
  ("font-swap CLS timing belongs to 01-09 — don't fix, don't weaken") and 01-07's own precedent
  for the identical situation, these are recorded as pre-existing, non-blocking, unchanged
  findings rather than re-investigated or worked around.

## Dependencies

No dependencies added. Reuses `node:fs` and this project's own `design/fixtures/*.json`, plus
`@playwright/test`'s `request`/`evaluateAll` already in use elsewhere in the suite.

## Testing Notes

- What was tested: `node design/scripts/pw.mjs --project=chromium|webkit
  design/tests/content.spec.ts` — 37/37 passing in both engines (single full run each, after
  the fixture-shadowing fix). `npm run verify:phase-1 -- --criteria=1,3,5`: criteria 1 and 3
  PASS in both engines; criterion 5 fails on the two pre-existing WINDOWS.md findings described
  above (not this plan's scope). `npm run check:contrast` (PASS) and `npm run test:unit`
  (17/17) both still green.
- What wasn't tested: font-swap CLS timing itself (explicitly out of scope for 01-08, owned by
  01-09); real Safari (not available on this machine).

## Next Steps

- [ ] 01-09 owns WINDOWS.md entries 1/4/5/6 (font-swap CLS timing) — unchanged by this plan
- [ ] This plan (01-08) is now complete: Task 1 (keyboard walk, D-14), Task 2 (structure —
      landmarks/DSGN-05/fonts/drift), Task 3 (content — nav/uuid/changelog/D-10/D-12) all done

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** MEDIUM - closes out 01-08's three tasks; catches and fixes a real fixture-lookup bug
in the new test itself before it could report false content failures on legitimately published
rows.
