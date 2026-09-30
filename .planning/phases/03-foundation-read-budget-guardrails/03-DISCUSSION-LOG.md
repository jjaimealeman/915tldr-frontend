# Phase 3: Foundation & Read-Budget Guardrails — Discussion Log

**Date:** 2026-09-21
**Mode:** discuss (default)
**Areas presented:** 4 — all four selected

> Human reference only. Downstream agents (researcher, planner, executor) read
> `03-CONTEXT.md`, not this file.

---

## Area 1: Render-step location

**Q: How should the render-step location be decided?**

Options presented:
1. Measure first, decide from data *(recommended)*
2. Default to cron worker, measure to confirm
3. Decide it now — owner has a leaning

**Selected:** Measure first, decide from data

Notes: ROADMAP success criterion 5 requires three numbers "recorded, not guessed" —
cron CPU headroom, per-page render cost, D1 REST p50/p95 at 41k rows. Phase 2 supplied
two precedents for taking that literally: the `~$7.44` backfill estimate that re-derived
to `$80.01–$144.13`, and D-16's dead source row that did not exist in production.

---

**Q: Measuring per-page render cost needs something that renders a page. Where should
the measurement task sit?**

Options presented:
1. Tracer slice, then measure *(recommended)*
2. Measure D1 + CPU first, render cost later
3. Synthetic render benchmark

**Selected:** Tracer slice, then measure

Notes: A synthetic benchmark measures a different code path than production — the same
trap as the 2026-08-27 server-render-vs-click-through incident. Phase 2's tracer (02-04)
found three live API incompatibilities that code review would not have surfaced.

→ Captured as **D-01**, **D-02**

---

## Area 2: Render manifest schema

**Q: What should the KV render manifest record per article, beyond the Spanish
counterpart ID?** *(multi-select)*

Options presented:
1. Content hash (staleness detection)
2. Render version / schema version
3. Rendered-at timestamp + build hash
4. Category + published_at (routing/tiering)

**Selected:** All four

---

**Q: How should the manifest be keyed at ~42k articles and growing?**

Options presented:
1. One key per article *(recommended)*
2. Single manifest blob
3. Sharded blobs (by month or category)

**Selected:** One key per article

Notes: Single blob is ~8 MB against KV's 25 MB ceiling — works now, shrinks over time, and
makes every render a read-modify-write with lost-update risk. Per-article KV access is
build/render-time, so it does not consume the ≤1 KV read/request public-path budget.

→ Captured as **D-03**, **D-04**

---

## Area 3: D1-import assertion design

**Q: How should the D1-import assertion detect violations?**

Options presented:
1. Import-graph walk from public entrypoints *(recommended)*
2. AST scan of public file trees
3. Grep-based pattern scan

**Selected:** Import-graph walk from public entrypoints

Notes: Only the graph walk catches a transitive violation — a page importing a helper that
imports the binding. Grep additionally cannot distinguish an import from a mention in a
comment, and this repo's planning docs quote the banned patterns verbatim.

---

**Q: How should the assertion be proven to actually fire?**

Options presented:
1. Permanent negative tests in CI *(recommended)*
2. One-time CI demonstration, documented
3. Both — demo now, tests forever

**Selected:** Permanent negative tests in CI

Notes: Phase 2's CONT-06 defect is the precedent — 248 tests passed while 253 production
rows violated the requirement, because the check existed but had stopped gating. Permanent
fixtures also survive an Astro upgrade changing island output paths.

→ Captured as **D-05**, **D-06**

---

## Area 4: Scaffold vs mockup adoption

**Q: How should Phase 1's approved mockups become Astro components?**

Options presented:
1. Port style.css wholesale, components under it *(recommended)*
2. Restructure into scoped component styles
3. Hybrid — global tokens, scoped components

**Selected:** Port style.css wholesale, components under it

Notes: Phase 1's output was formally approved via `01-APPROVAL.md`. Wholesale port keeps
that approval valid and keeps D-13's token-generated contrast table valid without
re-derivation.

→ Captured as **D-07**

---

## Follow-up: staging noindex (OPS-02)

**Q: How should dev.915tldr.com's noindex header be served at the edge?**

Options presented:
1. Cloudflare Transform Rule *(recommended)*
2. Astro `_headers` file
3. Worker-set response header

**Selected:** Cloudflare Transform Rule

Notes: Holds even if the Worker errors or a broken build ships. A Worker-set header is
unsuitable by construction — static asset requests bypass the Worker entirely under
`run_worker_first: false`, which is the architecture's whole point.

→ Captured as **D-08**

---

## Claude's Discretion

ARCH-04, ARCH-05, ARCH-06 and OPS-05/06/08 were not discussed — the stack research in
`.claude/CLAUDE.md` already fixes them and no gray area remains. Recorded in CONTEXT.md
under "Claude's Discretion" so the planner treats them as settled, not forgotten.

## Deferred Ideas

None raised during discussion. The deferred section of CONTEXT.md carries forward items
from Phase 2 (KTSM block, D-09 gating, dedup miss) and two housekeeping items
(changelog placeholders, untracked `.gsd/` and `docs/screenshots/`).

## Scope Creep

None — discussion stayed within the phase boundary.
