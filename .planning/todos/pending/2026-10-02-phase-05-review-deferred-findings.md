---
created: 2026-10-02T19:45:00Z
title: Phase 5 code-review findings deferred from gap closure
area: tooling
severity: mixed
files:
  - tools/archive-sync.mjs
  - src/lib/server/r2-client.ts
  - src/worker.ts
  - tools/partition-archive.mjs
  - tools/assert-file-count.mjs
  - tools/verify-edge-headers.mjs
  - tools/measure-archive-latency.mjs
  - tools/lib/run-pool.mjs
  - wrangler.jsonc
resolves_phase: 5
---

## Problem

05-REVIEW.md (the Phase 5 code review) found 2 critical, 9 warning, and 10 info findings. The
owner's 2026-10-02 scope decision for gap closure (05-13 through 05-21) was: fix the verifier's
gaps and the critical/high-impact safety warnings now; defer the rest to a later
`/gsd-code-review 5 --fix` run. The two critical findings (CR-01, CR-02) and warnings WR-01, WR-02,
WR-08 were all closed during gap closure (05-13, 05-14, 05-15, 05-18, 05-20). The findings below
were explicitly scoped out and are parked here so none drops silently.

## Deferred findings (one bullet per ID, file + one-line issue from 05-REVIEW.md)

- **WR-03** — `tools/archive-sync.mjs:214, 516, 616-622`: Force-full re-upload restarts from zero
  every run instead of tracking progress against the marker, so it can fail to converge on slow
  builds, and an entry whose upload failed under force-full is never retried once the marker
  clears.
- **WR-04** — `src/lib/server/r2-client.ts:157-166`, `tools/lib/run-pool.mjs:57-68`: The upload
  deadline is not a real bound because the S3 client has no request timeout; a stalled connection
  can hold pre-sync/post-sync past Workers Builds' 20-minute ceiling.
- **WR-05** — `tools/archive-sync.mjs:82-87`, `src/lib/server/r2-client.ts:153-166`,
  `tools/r2-roundtrip.mjs:28,42,64`: The non-main branch guard lives in `archive-sync.mjs`, not in
  `r2-client.ts`'s `createArchiveStore` chokepoint, so a caller that imports the store directly
  (e.g. `r2-roundtrip.mjs`, or any future tool) can bypass it.
- **WR-06** — `src/worker.ts:235-241`: A KV read failure on an archived-article URL serves a 404
  (via the static-asset fallback) instead of a 503, unlike the R2-failure path, which is the
  intentionally safe answer once a request has already missed the static layer.
- **WR-07** — `src/worker.ts:208-211, 223-226`: `cache.match()` is unguarded on both archived tag
  and archived article paths; a Cache API rejection becomes an uncaught Worker exception instead
  of degrading to direct R2 serving.
- **WR-09** — `tools/load-test-zero-reads.mjs:819-824, 656-665, 516-556`: The gate's preflight
  checks the wrong URL slice (not the ones actually drawn into the measured mix), the pass ignores
  response status codes (a run where every archived URL 404s would still PASS), and a structural
  D1-binding FAIL can be masked as INCONCLUSIVE because `hasD1Binding` is evaluated after the
  validity rules instead of before them.
- **IN-02** — `wrangler.jsonc:38`: `nodejs_compat` is enabled with zero `node:` imports anywhere in
  the bundle; its effect on measured startup CPU is unverified. (Also noted as an ARCH-08
  cold-start hypothesis — see the 05-19 decision doc; not tested there either, since that plan's
  mandate was read-only measurement, not a deploy.)
- **IN-03** — `src/worker.ts:198-213, 133-139`: Every miss on an archive-shaped tag path costs an
  uncached R2 read; bot scans of nonexistent tags generate unbounded Class B operations.
- **IN-04** — `tools/assert-file-count.mjs:122-132, 174-176`: `/static-budget.json` publishes the
  full hot-window record (per-day eyeball/human traffic counts, bot-filter description), not just
  the budget status fields.
- **IN-05** — `tools/partition-archive.mjs:83`, `src/lib/server/r2-client.ts:64-65`,
  `src/lib/archive/archive-route.ts:34`: Uuid case normalization is inconsistent across partition
  (accepts any case), the R2 client (lowercase-only keys), and the Worker (lowercases) — an
  uppercase uuid would silently fail upload and stay static forever. Zero such uuids exist today.
- **IN-06 (remainder)** — `tools/archive-sync.mjs:89-97`: `partition-archive --clean` still leaves
  the build-start marker (`.astro/ci-build-started-at`) in place. The deploy-path half of this
  finding (a stale marker making both archive-sync deadlines look already expired) was fixed in
  05-20 via `BUILD_START_MARKER_MAX_AGE_SECONDS` (1,800s) — only the `--clean` cleanup gap remains
  open.
- **IN-07** — `tools/verify-edge-headers.mjs:312, 332`: Check 5 asserts only status 200 + noindex,
  not that the response actually carries `server-timing: archive;` — a stale local plan whose
  sampled article is now hot would pass via the static layer undetected. A missing plan reports
  SKIP and still exits 0.
- **IN-08** — `tools/measure-archive-latency.mjs:254-255, 365`: Hardcoded sample offsets (the
  `< 200` cold-sample check, the `.slice(220)` LCP offset) ignore `--r2-sample-size`, and would
  overlap the R2 sample (reading from edge cache instead) once that flag exceeds 210.
- **IN-09** — `tools/archive-sync.mjs:381, 523`, `tools/lib/run-pool.mjs:42-44`: A non-integer
  `ARCHIVE_SYNC_CONCURRENCY` (e.g. `"2.5"`) passes the `> 0` guard then throws inside `runPool`,
  aborting the deploy as an uncaught rejection in pre-sync.
- **IN-10** — `wrangler.jsonc:105`, `src/worker.ts:33`: Two comments point the wrong direction
  (reference a section "below" that is actually above, and vice versa). The third IN-10 item (the
  `runPreSync` docstring's exit-1-only claim) is already accurate again after 05-18 fixed WR-02.

## Handled elsewhere (not deferred — listed for completeness)

- **CR-01, CR-02, CR-03, WR-01, WR-02, WR-08** — closed by 05-13, 05-14, 05-15, 05-16, 05-18, 05-20
  (gap closure, this series).
- **IN-01** — addressed by 05-17 (per-request correlation tool) / 05-19 (owner decision + deferred
  to Phase 12 per 05-21).
- **Criterion 2 (R2 latency vs. 1.5s LCP)** — stays deferred to Phase 11 / `WINDOWS.md` #27; not
  planned here.
