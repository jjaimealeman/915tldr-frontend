# Phase 5: Hybrid Archive & Zero-Reads Proof - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-30
**Phase:** 05-hybrid-archive-zero-reads-proof
**Areas discussed:** What counts as proof, Hot window & traffic, Tag pages: who stays static, Archive freshness

---

## What counts as proof

| Option | Description | Selected |
|--------|-------------|----------|
| Structure + load test | No D1 binding (build-enforced) + scripted load shows D1 reads don't rise above v1 background | ✓ |
| Literal 0 in analytics | A per-Worker D1 analytics number reading 0; may be impossible if attribution isn't supported | |
| You decide | Researcher finds the strongest proof available | |

| Option | Description | Selected |
|--------|-------------|----------|
| Halt, as written | Non-zero read stops the project for architecture review | ✓ |
| Fix and re-run | Treat a read as a bug and continue | |

**Notes:** Raised before asking: D1 analytics likely count per database, not per Worker, and v1
reads the same database constantly (unverified, researcher to confirm).

---

## Hot window & traffic

| Question | Options | Selected |
|----------|---------|----------|
| Whose traffic | v1's real readers now / Wait for v2 traffic | v1's real readers now |
| Window | 30 days / 7 days / As far back as it goes | 30 days |
| Bots | Humans only / Count everything | Humans only |
| Fallback | Age cutoff, provisional / Collect first, then decide | Age cutoff, provisional |

**Notes:** v1 was checked and has no view counting of its own; Cloudflare's per-URL request data
is the only source. Retention is unverified.

---

## Tag pages: who stays static

| Option | Description | Selected |
|--------|-------------|----------|
| 10+ articles (~2,300) | Frees ~17,500 files | ✓ |
| 5+ articles (~4,200) | Frees ~15,700 files | |
| Fixed top 1,000 | Fixed budget line, frees ~18,900 files | |

| Option | Description | Selected |
|--------|-------------|----------|
| Same cycle | Re-render touched archived tag pages every 2-hour ingest | ✓ |
| Once a day | Nightly batch; up to a day behind | |

**Notes:** Distribution measured from tonight's `dist/client/tag` before asking (10,240 tags with
exactly one article).

---

## Archive freshness

| Question | Options | Selected |
|----------|---------|----------|
| Redesign rollout | Background within 24h / All at once in the deploy | Background within 24h |
| Archived content change | Same 2-hour cycle / Next full re-render | Same 2-hour cycle |
| Partial R2 write failure | Keep old copy, alert / Fail the whole run | Keep old copy, alert |

---

## Claude's Discretion

- Where the archive render runs and how R2 objects are keyed/versioned
- Detection of touched articles and tags per cycle
- Load-test tooling, request count and baseline window
- Delivery channel for the daily file-count report

## Deferred Ideas

- Thin one-article tag pages (noindex or don't build): Phase 11 or its own decision
