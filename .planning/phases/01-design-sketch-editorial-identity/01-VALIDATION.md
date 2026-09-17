---
phase: 1
slug: design-sketch-editorial-identity
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-16
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `01-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright Test (`@playwright/test` 1.63.0, exact pin) + `node:test` + plain Node scripts (Node 24) |
| **Config file** | `playwright.config.ts` at repo root (01-01): projects `chromium`, `webkit`; `webServer` = `node design/scripts/serve-mockups.mjs --port 4319` (static, 127.0.0.1, test-scoped) |
| **Engine launcher** | `node design/scripts/pw.mjs --project=chromium\|webkit\|all <spec>` — WebKit runs natively or in `mcr.microsoft.com/playwright:v1.63.0-noble`, per `design/.webkit-mode.json` (Arch has ICU 78 only, so native WebKit may not launch) |
| **Quick run command** | `node design/scripts/pw.mjs --project=chromium design/tests/<spec>.spec.ts`, or `pnpm run check:contrast` / `pnpm run test:unit` for token changes |
| **Full suite command** | `pnpm run verify:phase-1` (D-16 runner: per-criterion verdict for C1–C5 across Chromium + WebKit (Playwright), plus node checks; `--pages`, `--criteria`, `--engines` narrow the scope and mark the run "SCOPED — NOT VALID FOR APPROVAL") |
| **Estimated runtime** | ~3–5 minutes for the full unscoped suite (the font-swap matrix is the long pole); per-task scoped runs ≤ 120 s |
| **Package manager** | pnpm (owner decision D-GAP-D, 2026-09-17); package-lock.json retired |
| **Paths** | All implementation lives under repo-root `design/` (`mockups/`, `scripts/`, `tests/`, `fixtures/`, `palette/`, `evidence/`) — see 01-01 context for the rationale |

---

## Sampling Rate

- **After every task commit:** the relevant single spec against `chromium`, or `node scripts/check-contrast.mjs` for token changes
- **After every plan wave:** `pnpm run verify:phase-1` (both engines)
- **Before `/gsd-verify-work`:** full suite green on both engines, and before `01-APPROVAL.md` is signed (D-16)
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

Filled in by the planner (2026-09-16). Criterion tags: `@c1`…`@c5` = ROADMAP Phase 1 success criteria 1–5, bucketed by `verify:phase-1`.

### Requirement → check mapping

| Requirement | Behavior | Test Type | Automated Command | Owning plan(s) | File Exists | Status |
|-------------|----------|-----------|-------------------|----------------|-------------|--------|
| DSGN-01 | 5 mockups + stylesheet + fonts/ (D-05 seven entries), both themes; zero Astro component files | smoke + e2e | `pnpm run verify:phase-1 --criteria=1` (node check walks the repo; `@c1` specs) | 01-02, 01-06, 01-07, 01-08, 01-10 | ❌ W0 | ⬜ pending |
| DSGN-02 / A11Y-01 | Every token pair ≥4.5:1 body, ≥3:1 large/UI/focus, both themes, all 8 category colours, worst hue per ramp row | unit | `pnpm run test:unit && pnpm run check:contrast` | 01-02, 01-03, 01-05 | ❌ W0 | ⬜ pending |
| DSGN-02 | Every interactive element Tab-reachable; visible, unclipped, unobscured focus ring ≥3:1 against its real background (WCAG 2.2 2.4.7 / 2.4.11) | e2e | `node design/scripts/pw.mjs --project=all design/tests/keyboard-walk.spec.ts` | 01-08 | ❌ W0 | ⬜ pending |
| DSGN-04 | Exactly 8 canonical categories, 3 stops each, pairwise OKLab distance ≥0.05; nav in seed order; uncategorized → `--cat-none` | unit + e2e | `pnpm run check:contrast` + `node design/scripts/pw.mjs --project=all design/tests/content.spec.ts` | 01-03, 01-05, 01-06, 01-08 | ❌ W0 | ⬜ pending |
| DSGN-05 | Light default with no `data-theme`; dark tokens all differ from light; toggle works by keyboard and persists | unit + e2e | `pnpm run check:contrast` + `node design/scripts/pw.mjs --project=all design/tests/structure.spec.ts` | 01-02, 01-03, 01-08 | ❌ W0 | ⬜ pending |
| DSGN-07 | `changelog.html`: 8 dated dispatches in source order, items byte-identical, no list elements, ties separate, single item = one paragraph | e2e | `node design/scripts/pw.mjs --project=all design/tests/content.spec.ts` | 01-04, 01-07, 01-08 | ❌ W0 | ⬜ pending |
| DSGN-03 | Instrument Serif + Source Serif 4 only; the two forbidden faces appear nowhere under design/mockups | smoke + e2e | `pnpm run verify:phase-1 --criteria=5` (node grep of design/mockups + `@c5` font-family checks) | 01-02, 01-08, 01-09 | ❌ W0 | ⬜ pending |
| DSGN-06 | Every `[data-grid]` has zero `script` / `on*`; identical render with JavaScript disabled | e2e | `node design/scripts/pw.mjs --project=all design/tests/structure.spec.ts` | 01-02, 01-06, 01-08 | ❌ W0 | ⬜ pending |
| I18N-07 | Real + synthetic (+25% rendered width) Spanish: no overflow/clip/ellipsis/loss at 320/768/1280; 320 px and 200% (emulated) reflow | e2e | `node design/scripts/pw.mjs --project=all design/tests/spanish-overflow.spec.ts` | 01-04, 01-06, 01-09 | ❌ W0 | ⬜ pending |
| PERF-07 | Pinned-source subset woff2 (≤150 KB) incl. Spanish baseline; capsize fallbacks; swap score <0.005 per page × width × scroll × variant × face, both engines; full glyph coverage | integration + e2e | `pnpm run verify:phase-1 --criteria=5` | 01-01, 01-02, 01-07, 01-09 | ❌ W0 | ⬜ pending |

### Per-task map

| Task ID | Wave | Requirement(s) | Behavior | Type | Automated Command | Status |
|---------|------|----------------|----------|------|-------------------|--------|
| 01-01-T1 | 1 | (supply-chain gate) | Owner approves the exact package/image list before install | manual, blocking-human | — (legitimacy checkpoint; never auto-approved) | ⬜ pending |
| 01-01-T2 | 1 | PERF-07, DSGN-02 | Pinned deps import; WebKit launches (native or Docker), recorded | smoke | `pnpm run probe:webkit` + dependency import check | ⬜ pending |
| 01-01-T3 | 1 | DSGN-02, I18N-07 | Static server hardened; harness green in both engines | integration | `node design/scripts/pw.mjs --project=all design/tests/harness.spec.ts` | ⬜ pending |
| 01-02-T1 | 2 | DSGN-01, DSGN-05, DSGN-06, A11Y-01 | Tracer: D1 row → index.html → tokens → gate → both engines → runner | e2e | `pnpm run data:stress --only=tracer-pair && pnpm run check:contrast && pnpm run verify:phase-1 --pages=index --criteria=1,2` | ⬜ pending |
| 01-02-T2 | 2 | PERF-07, DSGN-03 | Subset fonts, fallback faces, swap measured in both engines | integration | `pnpm run fonts:fetch && pnpm run fonts:build && pnpm run verify:phase-1 --pages=index --criteria=1,2,5` | ⬜ pending |
| 01-03-T1 | 3 | DSGN-04 | Eight photo-sampled hues with licences | script | `pnpm run palette:sample` + JSON check | ⬜ pending |
| 01-03-T2 | 3 | DSGN-04, DSGN-05, A11Y-01 | Gamut-safe three-stop palette passes the gate with margin | unit | `pnpm run palette:build && pnpm run check:contrast` | ⬜ pending |
| 01-03-T3 | 3 | DSGN-04 | Swatch evidence, both themes | smoke | `pnpm run palette:swatches` + PNG check | ⬜ pending |
| 01-04-T1 | 3 | DSGN-01, DSGN-07 | Full stress set, feeds, categories, changelog copy | script | `pnpm run data:stress` + JSON checks + `cmp` | ⬜ pending |
| 01-04-T2 | 3 | I18N-07 | Real Spanish + width-calibrated synthetic strings | integration | `node design/scripts/calibrate-spanish.mjs` + JSON check | ⬜ pending |
| 01-05-T1 | 4 | A11Y-01, DSGN-04 | RED suite for every gate rule | unit | `pnpm run test:unit` (expected to fail) | ⬜ pending |
| 01-05-T2 | 4 | A11Y-01, DSGN-02, DSGN-04, DSGN-05 | Hardened gate green on fixtures and real CSS | unit | `pnpm run test:unit && pnpm run check:contrast` | ⬜ pending |
| 01-06-T1 | 5 | DSGN-01, DSGN-04, DSGN-06, I18N-07 | Home page with full stress grid | e2e | `pnpm run verify:phase-1 --pages=index --criteria=1,2,5` + contract check | ⬜ pending |
| 01-06-T2 | 5 | DSGN-01, DSGN-04, DSGN-05 | Category page with masthead block | e2e | `pnpm run verify:phase-1 --pages=index,category --criteria=1,2,5` | ⬜ pending |
| 01-07-T1 | 6 | DSGN-01 | Article page (D-10) | e2e | `pnpm run verify:phase-1 --pages=article --criteria=1,2` + contract check | ⬜ pending |
| 01-07-T2 | 6 | DSGN-07, DSGN-01 | Changelog dispatches + contact | e2e | `pnpm run verify:phase-1 --pages=changelog,contact --criteria=1,2` + contract check | ⬜ pending |
| 01-07-T3 | 6 | PERF-07 | Final subset; C1/C2/C5 on all five pages | e2e | `pnpm run fonts:build && pnpm run verify:phase-1 --criteria=1,2,5` | ⬜ pending |
| 01-08-T1 | 7 | DSGN-02 | Scripted keyboard walk + contact sheets | e2e | `node design/scripts/pw.mjs --project=all design/tests/keyboard-walk.spec.ts` | ⬜ pending |
| 01-08-T2 | 7 | DSGN-01, DSGN-03, DSGN-05, DSGN-06 | Structure, zero-JS grids, faces, request hygiene | e2e | `node design/scripts/pw.mjs --project=all design/tests/structure.spec.ts` | ⬜ pending |
| 01-08-T3 | 7 | DSGN-04, DSGN-07 | Content integrity + probe edges | e2e | `node design/scripts/pw.mjs --project=all design/tests/content.spec.ts && pnpm run verify:phase-1 --criteria=1,3,5` | ⬜ pending |
| 01-09-T1 | 8 | I18N-07 | Spanish overflow, null summary, 320/200% reflow | e2e | `node design/scripts/pw.mjs --project=all design/tests/spanish-overflow.spec.ts && pnpm run verify:phase-1 --criteria=4` | ⬜ pending |
| 01-09-T2 | 8 | PERF-07, DSGN-03 | Full swap matrix + font-cls.md | e2e | `pnpm run verify:phase-1 --criteria=4,5` + evidence check | ⬜ pending |
| 01-10-T1 | 9 | all | Unscoped run, packet, verifier | e2e | `pnpm run verify:phase-1 && pnpm run approval:packet && pnpm run verify:approval --pending-ok` | ⬜ pending |
| 01-10-T2 | 9 | DSGN-01, DSGN-02 | Owner keyboard walk + visual review | manual (checkpoint) | — | ⬜ pending |
| 01-10-T3 | 9 | DSGN-01 | Owner signs or requests revisions | manual + script | `pnpm run verify:approval` (or a non-empty Revision requests section) | ⬜ pending |

Sampling continuity: no run of three consecutive tasks lacks an automated command; the only manual tasks are 01-01-T1, 01-10-T2 and 01-10-T3, and each sits next to an automated task.

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `package.json` (exact pins, installed with `--ignore-scripts`) + `playwright.config.ts` (chromium + webkit projects) — 01-01
- [ ] `pnpm exec playwright install chromium webkit` — **without** the dependency-install flag, which uses apt-get and does not exist on Arch; WebKit launch proven by `pnpm run probe:webkit` (Docker fallback) — 01-01
- [ ] `design/scripts/serve-mockups.mjs`, `design/scripts/pw.mjs`, `design/tests/support/harness.ts` — 01-01
- [ ] `design/scripts/check-contrast.mjs` — D-13, becomes the Phase 3 CI guard — 01-02 (tracer), hardened test-first in 01-05
- [ ] `design/tests/structure.spec.ts`, `design/tests/font-cls.spec.ts` — 01-02; `keyboard-walk.spec.ts`, `content.spec.ts` — 01-08; `spanish-overflow.spec.ts` — 01-09 (full versions written directly; no stubs)
- [ ] `design/scripts/build-fonts.mjs` — capsize fallback faces generated into the fonts region (replaces the proposed `generate-fallback-css.mjs`) — 01-02
- [ ] Font subsetting: `subset-font` with a Playwright glyph crawl and a Spanish baseline set (glyphhanger dropped: its `--subset` needs an external Python font toolchain, and RESEARCH A2/A4 left it unverified) — 01-02
- [ ] `verify:phase-1` npm script — the D-16 single runner, per-criterion verdict — 01-02

## Research corrections recorded at planning time

- The layout-shift entry type is not implemented in any Safari/WebKit release (caniuse, through Safari 27.1). A PerformanceObserver CLS sum in WebKit is always 0, so the font-swap spec uses a geometry-derived Layout Instability score in both engines, cross-checked against native CLS in Chromium.
- The observer must be installed with `page.addInitScript`; RESEARCH Pattern 3's `page.evaluate` before `goto` is lost on navigation.
- RESEARCH Pattern 4 (clipping) is extended to `overflow-x`/`overflow-y` separately, `contain`, `clip-path`, viewport edges, obscuring and ring contrast.
- Georgia and Times New Roman are not installed on this machine; Liberation Serif and Noto Serif are. The Georgia fallback face is not exercised by any automated run, and the evidence says so.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Owner approval of the mockups | DSGN-01 | Design acceptance is a human judgement | 01-10-T2/T3: owner reviews all 5 mockups × 2 themes × 3 widths, then adds their own `Approved-by:` line to `01-APPROVAL.md` (D-16); `pnpm run verify:approval` binds it to file fingerprints |
| Owner keyboard walk | DSGN-02 | D-14 requires the owner's own walk in addition to the script | 01-10-T2: Tab / Shift+Tab / Enter / Space through each mockup in both themes; judge tab order and operability |
| Real 200% browser zoom | DSGN-01 (PRD §6.1) | The automated check emulates zoom by halving the CSS viewport at DPR 2 | 01-09-T1 human-check, repeated in the 01-10 checklist: Ctrl+= to 200% on each page |
| C-01 palette register | DSGN-04 | Whether a dark amber block reads as brown is aesthetic | 01-03 swatches + palette.md "C-01 review" rows, judged at 01-10-T2 |
| Real-Safari font metrics and the Georgia fallback | PERF-07 | Safari is unavailable on Arch; Playwright WebKit tracks trunk, ahead of shipped Safari (`ascent-override` fixed in trunk 2026-08, not in any released Safari); Georgia is not installed on Linux | Record WebKit results only as "WebKit (Playwright) <version>"; the real-Safari/Georgia pass is an open item listed in `01-APPROVAL.md` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
