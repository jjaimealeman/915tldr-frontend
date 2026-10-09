---
phase: 07-imagery-share-cards
plan: 06
subsystem: share-card-owner-review
tags: [share-cards, owner-review, og-image, favicon, checkpoint-decision]
requires: ["07-02", "07-04", "07-05"]
provides:
  - tools/og-card/render.mjs --review <dir> mode (thumbnails, square crops, small icon renders from the committed public/ files)
  - tests/unit/share-card-assets.test.mjs alt-text to card-tagline parity test (D-10)
  - docs/phase-07/evidence/review/ (README.md and 11 review PNGs)
  - Jaime's recorded answers to the five remaining owner items (input to 07-07)
affects: [07-07, 07-08, 07-09]
tech-stack:
  added: []
  patterns:
    - review renders produced from the committed public/ files through the same Playwright route handler as the card render, writing nothing to public/
    - alt text pinned to the card's own tagline by a test, so a copy change cannot desync them
key-files:
  created:
    - docs/phase-07/evidence/review/README.md
    - docs/phase-07/evidence/review/ (11 PNGs)
  modified:
    - tools/og-card/render.mjs
    - tests/unit/share-card-assets.test.mjs
key-decisions:
  - "All five owner items resolved to their defaults (1a 2a 3a 4a 5a); no shipped asset or tag changed in this plan"
  - "4a: no local full build before merge, so 07-07 must NOT run pnpm test:unit, pnpm test:regression or pnpm build"
requirements-completed: []
duration: ~20 min
completed: 2026-10-08
status: complete
actuals:
  tokens: 12000
  tasks: 2
  commits: 2
---

# Phase 7 Plan 06: Owner review packet and recorded answers Summary

Jaime reviewed the rendered EN and ES share cards, thumbnails, square crops and small icon renders and answered "defaults.", which accepts all five remaining owner items as marked (default); the answers are quoted below as the input for 07-07.

## Tasks and commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Review packet, `--review` mode, alt-to-tagline parity test | b85cb71 | tools/og-card/render.mjs, tests/unit/share-card-assets.test.mjs, docs/phase-07/evidence/review/ |
| 2 | Owner answers (checkpoint:decision) | this SUMMARY commit | 07-06-SUMMARY.md, STATE.md, ROADMAP.md |

Commit b85cb71 carries its `changelog/` entry and README index row.

## Task 1 results (real output, reported to Jaime at the checkpoint)

- `node tools/og-card/render.mjs --review docs/phase-07/evidence/review` wrote 11 PNGs. `git status --porcelain public/` was empty afterwards (review mode wrote nothing to public/).
- Review PNG byte sizes: card-en-150 4980, card-en-300 11930, card-en-600 29181, card-en-square-crop 37548, card-es-150 5264, card-es-300 12715, card-es-600 29629, card-es-square-crop 39420, favicon-16 368, favicon-32 826, apple-touch-60 1995.
- `pnpm run test:fast`: 1207 tests, 1193 pass, 0 fail, 14 skipped.
- `pnpm run guard:config`: clean.
- `node tools/verify-share-meta.mjs --html tests/fixtures/head-harness/dist/en-article.html --lang en --kind article`: exit 0.
- `node tools/verify-share-meta.mjs --html tests/fixtures/head-harness/dist/es-article.html --lang es --kind article`: exit 0.
- Parity test passes for en and es: `SHARE_IMAGE_ALT[lang] === '915 TLDR — ' + COPY[lang].tagline`.

## Owner answers

Jaime's reply, verbatim:

> defaults.

The plan's resume-signal says "defaults" accepts every option marked (default). The five resolved choices:

| Item | Choice | Resolved to |
|------|--------|-------------|
| 1. Rendered card pair | 1a | Approve both cards as rendered: EN and ES copy as built (ES tagline "Noticias de El Paso, en breve."), logo at left 78px, and the non-multiple-of-4 positions from the approved mockup |
| 2. Credit-line size | 2a | 20px on both cards (EN 885px, ES 979px, rule 1028px; both on one line) |
| 3. twitter:image:alt | 3a | Keep it |
| 4. Local full build before merge | 4a | No local full build before merge |
| 5. favicon.svg identity | 5a | favicon.svg stays v1's blue "915" tile as ported; the 32x32 .ico is rasterised from it (D-23) |

Already settled before this plan and not asked: D-21 (og:image origin constant), D-22 (og:locale:alternate on every page), D-23 (32x32 .ico from favicon.svg).

### Instructions for 07-07 that follow from these answers

- **4a means 07-07 must NOT run `pnpm test:unit`, `pnpm test:regression`, or `pnpm build`.** Each local full build bulk-writes production render-manifest KV (06-15 deviation 2), and 4b was declined. 07-07 verifies with the harness (`node --test tests/unit/head-harness.test.mjs`), the pure tests, `pnpm run test:fast` and `pnpm run guard:config`. The real-build share test (`tests/unit/share-meta-dist.test.mjs`) and the byte-identity regression do not run on this change before it ships; 07-08's live check of the deployed site is the replacement evidence.
- **1a, 2a, 3a, 5a mean the current files are the approved ones.** The cards (20px credit line), `twitter:image:alt`, and `favicon.svg` need no change; 07-07 only has to rasterise `favicon.ico` from `public/favicon.svg` per D-23. No `915tldr.com2/public/915tldr.com_logo-.svg` check is needed (that was only for 5b).
- No copy changed, so `SHARE_IMAGE_ALT` stays pinned to the card taglines and the parity test needs no edit.

## Deviations from Plan

None - the plan executed as written. Task 1 ran without deviations; the Task 2 checkpoint was answered by Jaime, and no approval was recorded on his behalf.

## What was NOT verified

- The executor viewed only two of the eleven review images (not all eleven). Jaime's answer is the owner judgement on the cards, thumbnails, crops and icons; this SUMMARY does not claim the executor assessed legibility at 300px or 150px, or the favicon at 16px.
- No real-build checks ran (`pnpm build`, `pnpm test:unit`, `pnpm test:regression`) by instruction and by Jaime's 4a answer, so `tests/unit/share-meta-dist.test.mjs` and the full-site byte-identity were not exercised on this change.
- Nothing was checked against a deployed host or in a real share scraper; nothing has been pushed. Live validation is 07-08.
- No dev server was started.

## Known Stubs

None.

## Threat Flags

None. This plan added a render mode that reads only committed files and writes only into the evidence directory; no new network surface.

## Self-Check

- b85cb71 exists in `git log` on feature/phase-07: FOUND.
- docs/phase-07/evidence/review/README.md and the 11 PNGs: FOUND.
- This SUMMARY quotes Jaime's reply verbatim under "Owner answers": DONE.

## Self-Check: PASSED
