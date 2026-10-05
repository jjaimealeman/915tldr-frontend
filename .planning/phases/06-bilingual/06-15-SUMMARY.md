---
phase: 06-bilingual
plan: 15
subsystem: deploy
tags: [deploy, r2, archive-sync, workers-builds, i18n, dev-915tldr]
requires:
  - phase: 06-bilingual (06-12)
    provides: "corrected build budget (render end ~643s projected) and the full-corpus invariants"
provides:
  - "The bilingual build live on dev.915tldr.com (main 454aab4), built by a real Workers Build"
  - "31,018 Spanish archive objects (es/articles 13,290 + es/tags 17,728) pre-populated in production R2"
  - "docs/phase-06/deploy-record.md"
key-decisions:
  - "Task 1 resolved by Jaime 2026-10-04 14:32 MDT: option-a (merge and push, no local deploy) plus 'pre-populate ok'."
  - "Task 3 done by Jaime: feature/phase-06 merged into develop (e6c48d8) and develop into main (454aab4), pushed. Dashboard variables: only NTFY_TOPIC, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY set, so ARTICLES_FORCE_COLD, ASTRO_INCREMENTAL_BUILD and ALLOW_FALLBACK_HOT_WINDOW are not set (from Jaime's screenshot of a cropped list)."
requirements-completed: []
---

# Phase 6 Plan 15: Ship the bilingual build to dev.915tldr.com Summary

**Status:** complete. The summary was written by the orchestrator: the 06-15 executor stopped at the Task 3 human checkpoint and could not write it.

## What happened

| Step | Result | Source |
|---|---|---|
| Suite before upload (`test:unit`, `test:build-gate`, `test:regression`) | 1021/1021, 9/9, 5/5 | executor |
| R2 pre-population (Task 2, commit `5027e12`) | 31,018 `es/` keys uploaded in one ~7-minute pass, 0 failed; English keys unchanged (13,290 `articles/`, 17,728 `tags/`); second preflight 0 new keys | executor; preflight diff, not a byte re-read of English objects |
| Class A cost | at most ~$0.14 by R2's published rate; account free tier not checked | executor, derived |
| Merge and push (Task 3) | develop `e6c48d8`, main `454aab4`, 2026-10-05T00:28Z | orchestrator, verified locally and on origin/main |
| Production Workers Build `bf7b3a62` | success, ~1,070s; build command 631s; render+partition done at 667s vs 643s projected (+3.7%) | Builds API log read by a helper |
| Live | `dev.915tldr.com/version.json` commit `454aab4`; `/es`, `/es/about`, `/es/rss.xml`, `/es/news-sitemap.xml`, `/sitemap-index.xml` all 200 | orchestrator curl |

## Archive convergence (REND-12), observed

- First build: archive-sync post uploaded 11,959 and deferred **19,252** (English archive pages changed by the new chrome and hreflang).
- Next cron build (`15dfaa60`, 02:07Z): post uploaded **19,257**, deferred **0**, backlog 0. Converged in 2 builds, as derived. Warm build rendered 5 changed articles; 121,700 pages in 1m46s.
- While the backlog existed, archived English pages still referencing the old stylesheet returned an unstyled page (found in 06-16). By the sampled check after the 02:07Z build, `/tag/1099-forms` points at the current stylesheet (200).

## Deviations and disclosures

1. The executor ran `CI_BUILD_DEPLOY_DRY_RUN=1 node tools/ci-build.mjs deploy` against the build `test:unit` had just made instead of `ci:local`, to avoid a second cold build and a second rewrite of production KV. It wrote `.astro/ci-build-started-at` itself so the pre-sync deadline would apply.
2. **Production KV was written by local builds.** The cold build inside `test:unit` logged `mode=cold changed=40726` and bulk-writes every public article's manifest entry to the production render-manifest namespace (`buildHash` afb5f4b, a local HEAD). The Worker does not read `buildHash`; the incremental comparison path was not proven unaffected. Earlier executor builds in this phase very likely did the same. Same content as a real build writes, not counted independently.
3. The pre-sync result reports counts, not a key list, so "only `es/` keys uploaded" rests on the preflight diff.
4. Static files: 59,616 by the gate's count against the 60,000 planning budget; the Workers Build reported 59,306/100,000 (hard fail 80,000).

## Open follow-ups

- Scope of the 1,200s Workers Builds ceiling (build command only vs the whole 1,070s build) is unverified.
- Build contention between the concurrent `main` and `develop` builds was not tested.
- Production KV writes by local builds (see deviation 2): decide whether local builds should be guarded.
