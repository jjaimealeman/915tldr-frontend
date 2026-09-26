# Changelog Index

Development changelog for **915 TLDR — v2 Rebuild**. One entry per commit.

Entries are named `YYYY-MM-DD-HHMM_slug.md` and grouped by month, newest first.

---

## September 2026

| Date | Entry | Keywords |
|------|-------|----------|
| 2026-09-26 | [Todo filed: tracer test fails on apostrophes in titles](2026-09-26-1420_todo-tracer-html-entity-title.md) | `[TESTING]` `[PLANNING]` |
| 2026-09-26 | [Phase 3 complete: Foundation & Read-Budget Guardrails](2026-09-26-1315_phase3-complete.md) | `[PLANNING]` `[DOCUMENTATION]` `[ARCHITECTURE]` |
| 2026-09-26 | [Phase 3 security review: 26 of 26 threats closed](2026-09-26-1300_phase3-security-verified.md) | `[SECURITY]` `[DOCUMENTATION]` `[PLANNING]` |
| 2026-09-26 | [Config guard now runs on `build` and `deploy`, not only `test:unit`](2026-09-26-1251_config-guard-runs-on-build-and-deploy.md) | `[SECURITY]` `[CONFIG]` `[TESTING]` `[DEPLOYMENT]` `[CRITICAL]` |
| 2026-09-26 | [Close T-03-02a: widen the D1-import guard from one filename to the whole server directory](2026-09-26-1250_close-t-03-02a-kv-manifest-directory-guard.md) | `[SECURITY]` `[CRITICAL]` `[TESTING]` `[BACKEND]` `[DOCUMENTATION]` |
| 2026-09-26 | [Phase 3 UAT complete: 2 of 2 passed](2026-09-26-1212_phase3-uat-complete.md) | `[TESTING]` `[PLANNING]` `[DOCUMENTATION]` |
| 2026-09-26 | [Trailing slash: decided to drop it in Phase 4, RSS gotcha recorded](2026-09-26-1130_trailing-slash-dropped-rss-gotcha-recorded.md) | `[DOCUMENTATION]` `[SEO]` `[ARCHITECTURE]` `[PLANNING]` |
| 2026-09-23 | [Fix Phase 3 COVERAGE.md to pass the api-coverage.verify-pre gate](2026-09-23-1422_phase3-coverage-md-length-gate.md) | `[DOCUMENTATION]` `[CONFIG]` `[BUG_FIX]` |
| 2026-09-23 | [`pnpm verify:edge` loads `.dev.vars` itself — no more manual export required](2026-09-23-1930_verify-edge-loads-dev-vars-automatically.md) | `[TESTING]` `[BACKEND]` `[BUG_FIX]` `[DOCUMENTATION]` |
| 2026-09-23 | [Phase 12 directory reorganization recorded (plain parent, two repos)](2026-09-23-1900_phase12-directory-reorg-recorded.md) | `[DOCUMENTATION]` `[PLANNING]` `[ARCHITECTURE]` |
| 2026-09-23 | [Repo-role READMEs: frontend/backend split is permanent, not transitional](2026-09-23-1850_repo-role-readmes-frontend-backend-split.md) | `[DOCUMENTATION]` `[ARCHITECTURE]` |
| 2026-09-23 | [`pnpm verify:edge` hardened: discover the live article, not the local build](2026-09-23-1840_harden-verify-edge-live-article-discovery.md) | `[TESTING]` `[BACKEND]` `[BUG_FIX]` `[DOCUMENTATION]` |
| 2026-09-23 | [Trailing-slash redirect deferral recorded as an explicit Phase 4 carry-over](2026-09-23-1830_trailing-slash-deferral-recorded-in-roadmap.md) | `[DOCUMENTATION]` `[SEO]` `[ARCHITECTURE]` |
| 2026-09-23 | [Phase 3 verification persisted: 5/5 must-haves, two items routed to the owner](2026-09-23-0759_03-persist-human-verification-items-as-uat.md) | `[DOCUMENTATION]` `[PLANNING]` `[TESTING]` |
| 2026-09-23 | [Render-step location decided (D-01): Option A, ruled in by measured ingest volume](2026-09-23-1345_render-step-location-decided-option-a.md) | `[ARCHITECTURE]` `[DOCUMENTATION]` `[INFRA]` `[DEPLOYMENT]` |
| 2026-09-23 | [03-06 Addendum: Bulk-fetch query shape solves the D1 rows-read budget, not the cron CPU ceiling](2026-09-23-0730_03-06-addendum-bulk-fetch-solves-d1-budget-not-cpu-ceiling.md) | `[BACKEND]` `[DATABASE]` `[PERFORMANCE]` `[TESTING]` `[DOCUMENTATION]` |
| 2026-09-23 | [Cron CPU ceiling measured — STATE.md's 300s figure was wrong by 3x](2026-09-23-0058_cron-cpu-ceiling-measured.md) | `[BACKEND]` `[PERFORMANCE]` `[SECURITY]` `[DOCUMENTATION]` `[BUG_FIX]` |
| 2026-09-22 | [Per-page render cost measurement harness — manifest write, not render, dominates](2026-09-22-2306_render-cost-measurement-harness.md) | `[BACKEND]` `[PERFORMANCE]` `[TESTING]` `[BUG_FIX]` |
| 2026-09-22 | [D1 REST pagination measurement harness surfaces a 49M-row offset-pagination finding](2026-09-22-2258_d1-pagination-measurement-harness.md) | `[BACKEND]` `[DATABASE]` `[PERFORMANCE]` `[TESTING]` |
| 2026-09-22 | [One command re-proves the edge noindex policy on every deploy](2026-09-22-2241_03-05-verify-edge-command-completes-plan.md) | `[TESTING]` `[SECURITY]` `[DEPLOYMENT]` `[BUG_FIX]` `[DOCUMENTATION]` |
| 2026-09-22 | [915tldr-v2 deployed to dev.915tldr.com, production untouched](2026-09-22-2235_03-05-deploy-915tldr-v2-to-dev-hostname.md) | `[DEPLOYMENT]` `[INFRA]` `[BUG_FIX]` `[SECURITY]` `[CONFIG]` |
| 2026-09-22 | [Edge noindex Transform Rule now covers dev and admin-dev](2026-09-22-2223_03-05-edge-noindex-rule-covers-dev-and-admin-dev.md) | `[INFRA]` `[SECURITY]` `[DEPLOYMENT]` `[DOCUMENTATION]` |
| 2026-09-22 | [Plan 03-05 resumed on owner's hostname decision; halted again at the noindex rule (token scope)](2026-09-22-2035_03-05-admin-dev-bound-blocked-on-rules-scope.md) | `[DOCUMENTATION]` `[INFRA]` `[DEPLOYMENT]` `[SECURITY]` |
| 2026-09-22 | [Plan 03-05 halted before any change: dev.915tldr.com already routes to v1](2026-09-22-1422_03-05-blocked-dev-hostname-already-taken.md) | `[DOCUMENTATION]` `[INFRA]` `[DEPLOYMENT]` `[CRITICAL]` |
| 2026-09-22 | [Render manifest schema documented for Phase 4/5/6](2026-09-22-1420_03-04-render-manifest-schema-documented.md) | `[DOCUMENTATION]` `[BACKEND]` `[SECURITY]` |
| 2026-09-22 | [Translation identity, validation, versioning and bulk writes for the render manifest](2026-09-22-1415_03-04-translation-identity-validated-bulk-manifest-writer.md) | `[BACKEND]` `[TESTING]` `[SECURITY]` `[CONFIG]` |
| 2026-09-22 | [README states the read budget in numbers (OPS-08)](2026-09-22-1403_03-03-readme-read-budget.md) | `[DOCUMENTATION]` `[CONFIG]` |
| 2026-09-22 | [Permanent test proves /version.json and the footer cannot disagree](2026-09-22-1401_03-03-cross-surface-build-stamp-test.md) | `[TESTING]` `[SECURITY]` `[BACKEND]` |
| 2026-09-22 | [One build-info module drives /version.json and the footer stamp](2026-09-22-1358_03-03-build-info-module.md) | `[BACKEND]` `[CONFIG]` `[SECURITY]` |
| 2026-09-22 | [Wire the D1-import and config gates into the normal test command](2026-09-22-1352_phase-03-02-wire-gates-into-test-unit.md) | `[CONFIG]` `[TESTING]` `[DEPENDENCIES]` |
| 2026-09-22 | [Config guard closes the gap the D1-import module-graph walk cannot see](2026-09-22-1348_phase-03-02-config-guard.md) | `[SECURITY]` `[CONFIG]` `[TESTING]` `[BACKEND]` |
| 2026-09-22 | [Permanent negative fixtures prove the D1-import assertion actually rejects](2026-09-22-1342_phase-03-02-d1-negative-fixtures.md) | `[TESTING]` `[SECURITY]` `[BACKEND]` `[CRITICAL]` |
| 2026-09-22 | [Complete Plan 03-01: Tracer Summary and Requirement Tracking](2026-09-22-1333_complete-plan-03-01-tracer-summary.md) | `[DOCUMENTATION]` `[PLANNING]` `[TESTING]` |
| 2026-09-22 | [Phase 3 Plan 1: One Real Article, End to End](2026-09-22-1329_phase-03-01-tracer-one-real-article.md) | `[FEATURE]` `[BACKEND]` `[API]` `[CONFIG]` `[DEPENDENCIES]` `[TESTING]` `[INFRA]` |
| 2026-09-22 | [Phase 3 plan set: seven plans, five waves, tracer-first](2026-09-22-1144_phase-03-plan-set-read-budget-guardrails.md) | `[PLANNING]` `[INFRA]` `[TESTING]` `[SECURITY]` `[CONFIG]` |
| 2026-09-21 | [CONT-06 Gap Closure (Plan 02-11)](2026-09-21-1615_cont06-gap-closure-plan-02-11.md) | `[DOCUMENTATION]` `[PLANNING]` `[BACKEND]` `[AI]` |
| 2026-09-21 | [CONT-07 Editorial Read Closes Plan 02-10](2026-09-21-0910_cont07-editorial-read-closes-plan-10.md) | `[DOCUMENTATION]` `[PLANNING]` `[AI]` |
| 2026-09-21 | [Complete Plan 02-10: Attribution-Wrapper Judge Fix, September Backfill Finished](2026-09-21-0212_complete-02-10-attribution-fix-and-backfill-completion.md) | `[DOCUMENTATION]` `[BACKEND]` `[AI]` |
| 2026-09-21 | [CHECKPOINT: Grounding Judge Holds ~54% of Thin-Source Summaries on Attribution False Positive](2026-09-21-0705_checkpoint-grounding-judge-attribution-false-positive.md) | `[DOCUMENTATION]` `[PLANNING]` `[AI]` `[SECURITY]` |
| 2026-09-21 | [Plan 10 Halted: September Backfill Batch Submitted, Write-Back Pending](2026-09-21-0650_plan-02-10-halted-batch-submitted-pending.md) | `[DOCUMENTATION]` `[PLANNING]` `[AI]` |
| 2026-09-19 | [Complete Plan 9: OPS-11 Dry-Run Cost Projection — Checkpoint on the Real Figure](2026-09-19-2350_complete-02-09-dry-run-cost-projection-checkpoint.md) | `[DOCUMENTATION]` `[PLANNING]` `[AI]` |
| 2026-09-19 | [Reconcile the Phase 2 Validation Map for Plans 02-01 Through 02-09](2026-09-19-2325_reconcile-validation-map-for-plans-02-01-through-02-09.md) | `[DOCUMENTATION]` `[TESTING]` |
| 2026-09-20 | [Complete Plan 8: Grounding Calibration, Checkpoint Resolved (Option C+D)](2026-09-20-0421_02-08-complete-grounding-calibration-checkpoint-resolved.md) | `[FEATURE]` `[SECURITY]` `[TESTING]` `[AI]` `[DOCS]` |
| 2026-09-19 | [Replace auto-generated placeholders in Phase 2 tracking changelogs](2026-09-19-2101_replace-auto-generated-tracking-changelog-placeholders.md) | `[DOCUMENTATION]` `[PLANNING]` `[PROCESS]` |
| 2026-09-19 | [Complete Plan 7: Grounding Detection Cascade](2026-09-19-2100_02-07-complete-grounding-detection-cascade.md) | `[FEATURE]` `[SECURITY]` `[TESTING]` `[AI]` |
| 2026-09-19 | [Phase 2 Wave 4 complete: real extraction path and prompt rewrite](2026-09-19-2032_phase-02-update-tracking-after-wave-4.md) | `[TRACKING]` `[PHASE-02]` `[AI]` `[MEASUREMENT]` |
| 2026-09-19 | [Complete Plan 6: Faithfulness Prompt Rewrite, Thin-Source Attribution, Columnar Key Points](2026-09-19-2030_02-06-complete-faithfulness-prompt-rewrite.md) | `[FEATURE]` `[AI]` `[TESTING]` `[DATABASE]` |
| 2026-09-19 | [docs(02-05): complete plan 5 — source-fetch hardening, extraction threshold, CONT-01 measurement](2026-09-19-2015_02-05-complete-source-fetch-extraction-cont01-measurement.md) | `[PLANNING]` `[CONTENT-QUALITY]` `[DOCS]` |
| 2026-09-19 | [docs(02-04): complete end-to-end tracer plan](2026-09-19-1908_02-04-complete-end-to-end-tracer-plan.md) | `[docs]` `[auto-generated]` |
| 2026-09-19 | [Phase 2 Plan 4: Production Migration Applied, Tracer Halted on Missing .dev.vars](2026-09-19-1830_02-04-migration-applied-tracer-halted-on-devvars.md) | `[DOCUMENTATION]` `[DATABASE]` `[PLANNING]` `[CRITICAL]` |
| 2026-09-19 | [Phase 2 Content Quality & Grounding Research](2026-09-19-1630_phase-2-content-quality-research.md) | `[DOCUMENTATION]` `[BACKEND]` `[API]` |
| 2026-09-19 | [Append Self-Check Results to Phase 2 Plan 3 Summary](2026-09-19-1332_02-03-append-self-check-to-summary.md) | `[DOCUMENTATION]` `[PLANNING]` |
| 2026-09-19 | [Phase 2 Wave 2 complete: corpus measurements, D-16 retired](2026-09-19-1330_phase-02-update-tracking-after-wave-2.md) | `[TRACKING]` `[PHASE-02]` `[MEASUREMENT]` `[DECISION]` |
| 2026-09-19 | [Phase 2 Plan 3: Retire D-16 Source Repoint After Production Measurement Disproved Its Premise](2026-09-19-1328_02-03-retire-d16-source-repoint.md) | `[PLANNING]` `[DOCUMENTATION]` `[DATABASE]` |
| 2026-09-19 | [Phase 2 Plan 2 Complete: Chunked Reprocess Reset and Prettier Cleanup](2026-09-19-1230_02-02-complete-chunked-reprocess-reset-and-prettier-cleanup.md) | `[PLANNING]` `[DOCUMENTATION]` `[DATABASE]` `[TESTING]` |
| 2026-09-19 | [Phase 2 Wave 1 complete: toolchain, D1 access, FIX-01/02/03](2026-09-19-1227_phase-02-update-tracking-after-wave-1.md) | `[TRACKING]` `[PHASE-02]` `[DEPENDENCIES]` `[BUGFIX]` |
| 2026-09-19 | [Phase 2 Plan 1 Complete: wrangler Dependency Fix and Production D1 Access Proof](2026-09-19-1213_02-01-complete-wrangler-fix-and-d1-access-proof.md) | `[PLANNING]` `[DOCUMENTATION]` `[INFRA]` `[DATABASE]` |
| 2026-09-19 | [docs(02): create phase plan](2026-09-19-1122_02-create-phase-plan.md) | `[docs]` `[auto-generated]` |
| 2026-09-19 | [Phase 2 planned: ten plans across eight waves for content quality & grounding](2026-09-19-1114_phase-2-plan-content-quality-grounding.md) | `[PLANNING]` `[DOCUMENTATION]` `[BACKEND]` `[SECURITY]` |
| 2026-09-19 | [docs(phase-2): add validation strategy](2026-09-19-1035_phase-2-add-validation-strategy.md) | `[docs]` `[auto-generated]` |
| 2026-09-19 | [Phase 2 Context: Content Quality & Grounding](2026-09-19-1015_02-capture-phase-context.md) | `[DOCUMENTATION]` `[PLANNING]` `[CONTENT]` `[AI]` |
| 2026-09-19 | [Record Phase 2 Context Session in STATE.md](2026-09-19-1014_state-record-phase-2-context-session.md) | `[DOCUMENTATION]` `[PLANNING]` |
| 2026-09-17 | [Phase 1 Complete: Design Sketch & Editorial Identity](2026-09-17-2339_phase-1-complete.md) | `[DOCUMENTATION]` `[DESIGN]` `[ACCESSIBILITY]` `[PLANNING]` |
| 2026-09-17 | [Phase 1 Approved: Owner Sign-Off Recorded](2026-09-17-2335_phase-1-owner-sign-off.md) | `[DOCUMENTATION]` `[DESIGN]` |
| 2026-09-17 | [Record owner's APPROVED decision, capture two Phase-8 follow-ups (Tasks 2/3)](2026-09-17-1948_01-23-record-owner-s-approved-decision-capture-two.md) | `[DOCUMENTATION]` `[PLANNING]` |
| 2026-09-17 | [Record Task 1 summary — plan halted pending owner review (Task 2/3)](2026-09-17-1742_01-23-record-task-1-summary-plan-halted-pending-ow.md) | `[DOCUMENTATION]` `[PLANNING]` |
| 2026-09-17 | [Strict D-16 gate restored, unscoped 5/5 run, round-2 approval packet (Task 1)](2026-09-17-1739_01-23-strict-d-16-gate-restored-unscoped-5-5-run-r.md) | `[FEATURE]` `[TESTING]` `[BUG_FIX]` `[DOCUMENTATION]` |
| 2026-09-17 | [Phase 1 Plan 22 complete: feed-expansion gap-closure](2026-09-17-1727_01-22-complete-feed-expansion-gap-closure-plan.md) | `[DOCUMENTATION]` `[PLANNING]` |
| 2026-09-17 | [Glyph Coverage for Feed Text and Status Messages (Task 3)](2026-09-17-1721_01-22-glyph-coverage-for-feed-text-and-status-mess.md) | `[FEATURE]` `[TESTING]` `[PERFORMANCE]` |
| 2026-09-17 | [Criterion 4 on the Fully Loaded Homepage, Spanish for Load More Controls (Task 2)](2026-09-17-1717_01-22-criterion-4-on-the-fully-loaded-homepage-spa.md) | `[FEATURE]` `[TESTING]` `[ACCESSIBILITY]` `[BUG_FIX]` |
| 2026-09-17 | [Phase 1 Plan 11 complete: D-GAP-D pnpm closed, STATE/ROADMAP updated](2026-09-17-1715_01-11-complete-plan-summary-state-roadmap.md) | `[DOCUMENTATION]` `[PLANNING]` |
| 2026-09-17 | [Feed-Expansion Helper, Content + Structure Coverage of the Full 33-Card Feed (Task 1)](2026-09-17-1712_01-22-feed-expansion-helper-content-structure-cove.md) | `[FEATURE]` `[TESTING]` `[ACCESSIBILITY]` |
| 2026-09-17 | [pnpm wording in tool output; 01-10-SUMMARY.md records "not approved"](2026-09-17-1710_pnpm-wording-and-01-10-record.md) | `[DOCUMENTATION]` `[CONFIG]` `[TESTING]` |
| 2026-09-17 | [Retire package-lock.json from git; move 01-VALIDATION.md to pnpm wording](2026-09-17-1705_retire-npm-lockfile-pnpm-validation-wording.md) | `[CONFIG]` `[DOCUMENTATION]` `[DEPENDENCIES]` |
| 2026-09-17 | [Phase 1 Plan 21 complete: homepage load-more closed](2026-09-17-1705_01-21-complete-homepage-load-more-plan.md) | `[DOCUMENTATION]` `[PLANNING]` |
| 2026-09-17 | [pnpm end to end: lockfile parity, local Playwright CLI launcher, packageManager pin](2026-09-17-1700_pnpm-lockfile-parity-local-cli-launcher.md) | `[TESTING]` `[DEPENDENCIES]` `[CONFIG]` `[FEATURE]` |
| 2026-09-17 | [Load-more styling, keyboard coverage, feed:build script, D-05/D-12 amendments (Task 3)](2026-09-17-1659_01-21-load-more-styling-keyboard-coverage-feed-bui.md) | `[FEATURE]` `[TESTING]` `[STYLING]` `[ACCESSIBILITY]` `[DOCUMENTATION]` |
| 2026-09-17 | [Shared load-more script on all five pages, runner checks the feed (Task 2)](2026-09-17-1654_01-21-shared-load-more-script-on-all-five-pages-ru.md) | `[FEATURE]` `[TESTING]` |
| 2026-09-17 | [Homepage load more: static feed pages, first 6 cards on load (Task 1)](2026-09-17-1651_01-21-homepage-load-more-static-feed-pages-first-6.md) | `[FEATURE]` `[TESTING]` `[SECURITY]` `[STYLING]` |
| 2026-09-17 | [Phase 1 Plan 20 complete: changelog layout fix and contact centring closed](2026-09-17-1637_01-20-complete-changelog-layout-fix-and-contact-ce.md) | `[DOCUMENTATION]` `[PLANNING]` |
| 2026-09-17 | [Contact page centred, full width at tablet, spacing bug fixed (revision request 5, Task 2)](2026-09-17-1635_01-20-contact-page-centred-full-width-at-tablet-sp.md) | `[FEATURE]` `[BUG_FIX]` `[TESTING]` `[STYLING]` |
| 2026-09-17 | [Changelog dispatch placement fixed, adopts rail layout (revision request 4, Task 1)](2026-09-17-1631_01-20-changelog-dispatch-placement-fixed-adopts-ra.md) | `[FEATURE]` `[BUG_FIX]` `[TESTING]` `[STYLING]` |
| 2026-09-17 | [docs(01-19): complete right rail plan](2026-09-17-1625_01-19-complete-right-rail-plan.md) | `[docs]` `[auto-generated]` |
| 2026-09-17 | [Rail content integrity and the Spanish rail heading (Task 2)](2026-09-17-1623_01-19-rail-content-integrity-and-the-spanish-rail-.md) | `[FEATURE]` `[TESTING]` |
| 2026-09-17 | [Right rail on the article page (revision request 3, Task 1)](2026-09-17-1620_01-19-right-rail-on-the-article-page-revision-requ.md) | `[FEATURE]` `[TESTING]` `[STYLING]` |
| 2026-09-17 | [Phase 1 Plan 18 complete: summary markdown and category lead fallback closed](2026-09-17-1614_01-18-complete-summary-markdown-and-category-lead-.md) | `[DOCUMENTATION]` `[PLANNING]` |
| 2026-09-17 | [Category lead is image-led only with a usable image (revision request 2, Task 3)](2026-09-17-1611_01-18-category-lead-image-led-only-with-a-usable-i.md) | `[FEATURE]` `[TESTING]` `[STYLING]` |
| 2026-09-17 | [Convert summary markdown on the remaining four pages (defect 9, Task 2)](2026-09-17-1604_01-18-convert-summary-markdown-on-remaining-four-p.md) | `[FEATURE]` `[TESTING]` `[DOCUMENTATION]` |
| 2026-09-17 | [Summary markdown renders as real HTML on index (defect 9, Task 1)](2026-09-17-1602_01-18-render-summary-markdown-as-real-html-on-inde.md) | `[FEATURE]` `[BUG_FIX]` `[TESTING]` `[STYLING]` |
| 2026-09-17 | [Phase 1 Plan 17 complete: header rule, toggle position, and new-tab links closed](2026-09-17-1554_01-17-complete-header-rule-toggle-position-and-new.md) | `[DOCUMENTATION]` `[PLANNING]` |
| 2026-09-17 | [New-tab activation proven safe in both engines; the cue is localised into Spanish](2026-09-17-1548_01-17-prove-new-tab-activation-is-safe-in-both-eng.md) | `[FEATURE]` `[TESTING]` `[SECURITY]` |
| 2026-09-17 | [External links open in a new tab with an accessible cue (revision request 6)](2026-09-17-1543_01-17-external-links-open-in-a-new-tab-with-an-acc.md) | `[FEATURE]` `[TESTING]` `[STYLING]` |
| 2026-09-17 | [Header rule removed, theme toggle aligned to the content column (revision request 1, defect 10)](2026-09-17-1540_01-17-remove-header-bottom-border-align-theme-togg.md) | `[FEATURE]` `[BUG_FIX]` `[TESTING]` `[STYLING]` |
| 2026-09-17 | [Phase 1 Plan 16 Complete: D-GAP-C Closed, Business No Longer Reads as Brown](2026-09-17-1520_01-16-complete-business-hue-re-sample-plan-d-gap-c.md) | `[DOCUMENTATION]` `[PLANNING]` |
| 2026-09-17 | [Swatch Evidence Regenerated, Nav-Stripe Distinctness Verified, WINDOWS Entry 3 Closed](2026-09-17-1516_01-16-regenerate-swatch-evidence-verify-nav-stripe.md) | `[FEATURE]` `[TESTING]` `[DOCUMENTATION]` |
| 2026-09-17 | [Business's Palette Hue Re-Sampled From a Real Juárez Neon Sign](2026-09-17-1512_01-16-re-sample-business-hue-from-a-real-ju-rez-ne.md) | `[FEATURE]` `[BUG_FIX]` |
| 2026-09-17 | [Phase 1 Plan 15 Complete: D-15/I18N-07 Closed, Spanish Calibration Made More Robust](2026-09-17-1443_01-15-complete-plan-summary-state-roadmap-windows-.md) | `[DOCUMENTATION]` `[PLANNING]` |
| 2026-09-17 | [Every Spanish Stress String Recalibrated; a Real Small-Size Measurement Gap Fixed](2026-09-17-1440_01-15-recalibrate-every-spanish-component-widen-hi.md) | `[FEATURE]` `[TESTING]` `[BUG_FIX]` |
| 2026-09-17 | [One Headline Recalibrated in the New Type System, Proven in Both Engines](2026-09-17-1431_01-15-recalibrate-one-headline-in-the-post-01-14-t.md) | `[FEATURE]` `[TESTING]` `[BUG_FIX]` |
| 2026-09-17 | [Phase 1 Plan 14 Complete: Source Serif 4 Bold Headlines, Wordmark Only, Font Subset Shrink](2026-09-17-1306_01-14-complete-plan-summary-state-roadmap-windows-.md) | `[DOCUMENTATION]` `[PLANNING]` |
| 2026-09-17 | [Source Serif 4 Shrinks by More Than Half, Instrument Serif Italic Retired](2026-09-17-1301_01-14-shrink-source-serif-4-retire-instrument-seri.md) | `[PERFORMANCE]` `[FEATURE]` `[TESTING]` `[DOCUMENTATION]` |
| 2026-09-17 | [GREEN: Implement the Font Variation-Axis Reader](2026-09-17-1254_01-14-implement-the-fvar-axis-reader-task-2-green.md) | `[FEATURE]` `[TESTING]` |
| 2026-09-17 | [RED: Failing Test for the Font Variation-Axis Reader](2026-09-17-1252_01-14-add-failing-test-for-the-fvar-axis-reader-ta.md) | `[TESTING]` `[FEATURE]` |
| 2026-09-17 | [Headlines Move to Source Serif 4 Bold, Instrument Serif Kept Only for the Wordmark](2026-09-17-1250_01-14-source-serif-4-bold-headlines-instrument-ser.md) | `[FEATURE]` `[STYLING]` `[BUG_FIX]` `[TESTING]` `[DOCUMENTATION]` |
| 2026-09-17 | [Phase 1 Plan 13 Complete: Advanced to Plan 14](2026-09-17-1240_01-13-complete-plan-advance-plan-counter-record-de.md) | `[DOCUMENTATION]` `[PLANNING]` |
| 2026-09-17 | [Rewrote 01-13's Summary to Tell the Real Story, Including Getting It Wrong Twice First](2026-09-17-1239_01-13-rewrite-summary-to-reflect-the-corrected-dia.md) | `[DOCUMENTATION]` `[PLANNING]` |
| 2026-09-17 | [Spanish Text-Width Checks Now Refuse to Measure the Wrong Font, and the PRD Catches Up](2026-09-17-1235_01-13-guard-spanish-width-measurements-amend-prd-6.md) | `[FEATURE]` `[TESTING]` `[DOCUMENTATION]` |
| 2026-09-17 | [Full Font-Swap Matrix Passes Cleanly, With a Built-In Check That the Test Itself Still Works](2026-09-17-1234_01-13-full-matrix-positive-control-and-strict-crit.md) | `[FEATURE]` `[TESTING]` `[PERFORMANCE]` `[BUG_FIX]` |
| 2026-09-17 | [Fixed the Real Bugs Behind the Chrome Font-Swap Scare, Reversing Yesterday's Diagnosis](2026-09-17-1233_01-13-correct-the-chromium-swap-misdiagnosis-fontc.md) | `[BUG_FIX]` `[TESTING]` `[PERFORMANCE]` `[CONFIG]` |
| 2026-09-17 | [Recorded the Diagnosis Session and Updated Progress Tracking](2026-09-17-1147_01-13-record-diagnosis-session-progress-and-roadma.md) | `[DOCUMENTATION]` `[PLANNING]` |
| 2026-09-17 | [Root-Caused the Chrome Font-Swap Finding: It's a Real Chrome Bug, Not Our Test](2026-09-17-1146_01-13-diagnose-chromium-font-display-optional-swap.md) | `[DOCUMENTATION]` `[TESTING]` `[PERFORMANCE]` `[BUG_FIX]` |
| 2026-09-17 | [Logged the Chrome Font-Swap Finding to the Project's Defect Ledger](2026-09-17-1121_01-13-record-chromium-optional-swap-finding-in-win.md) | `[DOCUMENTATION]` `[PLANNING]` |
| 2026-09-17 | [Flagged the Chrome Font Finding as a Blocker for the Next Session](2026-09-17-1121_01-13-record-blocker-chromium-optional-swap-findin.md) | `[DOCUMENTATION]` `[PLANNING]` |
| 2026-09-17 | [Switched Fonts to `font-display: optional`, Built a Swap-Path Instrument, Found It Doesn't Fully Work in Chrome](2026-09-17-1119_01-13-font-display-optional-generator-classified-s.md) | `[FEATURE]` `[TESTING]` `[PERFORMANCE]` `[BUG_FIX]` |
| 2026-09-17 | [Phase 1 Plan 12: STATE/ROADMAP advanced](2026-09-17-1107_01-12-state-roadmap-update.md) | `[DOCUMENTATION]` `[PLANNING]` |
| 2026-09-17 | [Phase 1 Plan 12 complete: summary-markdown conversion library, SUMMARY written](2026-09-17-1104_01-12-complete-plan-summary.md) | `[DOCUMENTATION]` `[PLANNING]` `[TESTING]` |
| 2026-09-17 | [summary-markdown implementation, suite green (D-GAP revision 9, GREEN)](2026-09-17-1102_summary-markdown-green-implementation.md) | `[FEATURE]` `[TESTING]` |
| 2026-09-17 | [Failing summary-markdown test suite (D-GAP revision 9, RED)](2026-09-17-1057_summary-markdown-red-suite.md) | `[TESTING]` `[FEATURE]` |
| 2026-09-17 | [Track docs/PRD.md in Git](2026-09-17-1052_track-prd-in-git.md) | `[DOCUMENTATION]` `[PLANNING]` |
| 2026-09-17 | [Record Phase 1 Gap-Closure Planning in STATE](2026-09-17-1040_record-gap-closure-planning-in-state.md) | `[PLANNING]` `[DOCUMENTATION]` |
| 2026-09-17 | [Phase 1 Gap-Closure Plans 01-11 to 01-23 (Round-1 Owner Review)](2026-09-17-1034_gap-closure-plans-01-11-to-01-23.md) | `[DOCUMENTATION]` `[DESIGN]` `[ACCESSIBILITY]` `[PERFORMANCE]` `[TESTING]` |
| 2026-09-17 | [Phase 1 Owner Review Recorded: Revisions Requested](2026-09-17-0942_owner-review-revisions-requested.md) | `[DOCUMENTATION]` `[DESIGN]` `[ACCESSIBILITY]` `[PERFORMANCE]` |
| 2026-09-17 | [D-16 approval packet generator and verifier, full unscoped evidence run](2026-09-17-0810_approval-packet-generator-and-verifier-d16.md) | `[TESTING]` `[FEATURE]` `[DOCUMENTATION]` |
| 2026-09-17 | [Full Font-Swap CLS Matrix and Evidence Report (D-08, Criterion 5)](2026-09-17-0715_font-swap-matrix-and-evidence-report-c5.md) | `[TESTING]` `[PERFORMANCE]` `[BUG_FIX]` `[ACCESSIBILITY]` |
| 2026-09-17 | [Geometry instrument now measures per-line fragments, not element envelopes](2026-09-17-0700_geometry-fragment-based-layout-shift-fix.md) | `[BUGFIX]` `[TESTING]` `[ACCESSIBILITY]` |
| 2026-09-17 | [feat(01-09): Spanish +25% overflow, drawn-Spanish, null-summary and 320px/200%-zoom reflow spec (D-07, D-15, criterion 4)](2026-09-17-0610_spanish-overflow-injection-spec-c4.md) | `[TESTING]` `[FEATURE]` `[BUG_FIX]` `[I18N]` |
| 2026-09-17 | [content.spec.ts: Nav Order, Fixture-Uuid Fidelity, Changelog Dispatch Verification (D-01, D-06, D-10, D-11, D-12)](2026-09-17-0545_content-spec-nav-order-uuid-fidelity-changelog-dispatches.md) | `[FEATURE]` `[TESTING]` `[BUG_FIX]` `[DATABASE]` `[ACCESSIBILITY]` |
| 2026-09-17 | [Extend structure.spec.ts: Landmarks, DSGN-05, Reduced Motion, Fonts, Head-Script Drift, Page Evidence](2026-09-17-0533_structure-spec-landmarks-tokens-fonts-drift-guard.md) | `[FEATURE]` `[TESTING]` `[ACCESSIBILITY]` `[BUG_FIX]` `[STYLING]` |
| 2026-09-17 | [Scripted Keyboard Walk (D-14), and a Real WebKit Focus-Obscuring Bug It Caught](2026-09-17-0521_keyboard-walk-webkit-scroll-into-view-fix.md) | `[FEATURE]` `[TESTING]` `[ACCESSIBILITY]` `[BUG_FIX]` `[STYLING]` |
| 2026-09-17 | [docs(01-09): complete plan — SUMMARY, STATE, ROADMAP](2026-09-17-0411_01-09-complete-plan-summary-state-roadmap.md) | `[docs]` `[auto-generated]` |
| 2026-09-16 | [docs(01-08): complete plan — SUMMARY, STATE, ROADMAP](2026-09-16-2349_01-08-complete-plan-summary-state-roadmap.md) | `[docs]` `[auto-generated]` |
| 2026-09-16 | [Phase 1 Plan 7 Complete: Article, Changelog, Contact Pages](2026-09-16-1924_01-07-complete-plan-summary-state-roadmap.md) | `[DOCUMENTATION]` `[TESTING]` `[STYLING]` `[DESIGN]` `[ACCESSIBILITY]` |
| 2026-09-16 | [Rebuild Font Subset, Fix a Font-Swap CLS Regression, Verify All Five Pages](2026-09-16-1920_rebuild-font-subset-fix-cls-regression-five-page-verify.md) | `[BUG_FIX]` `[TESTING]` `[STYLING]` `[ACCESSIBILITY]` `[PERFORMANCE]` |
| 2026-09-16 | [Phase 1 Plan 6 Complete: Final Home and Category Mockups](2026-09-16-1902_01-06-complete-plan-summary-state-roadmap-windows.md) | `[DOCUMENTATION]` `[TESTING]` `[STYLING]` `[DESIGN]` `[ACCESSIBILITY]` |
| 2026-09-16 | [Changelog as Dated Dispatches, and the Contact Page](2026-09-16-1901_changelog-dispatches-and-contact-page.md) | `[FEATURE]` `[STYLING]` `[UI]` `[DESIGN]` `[ACCESSIBILITY]` |
| 2026-09-16 | [Category Page: Business Masthead Block and Image-Led Lead](2026-09-16-1858_category-page-masthead-block-image-lead.md) | `[FEATURE]` `[STYLING]` `[UI]` `[DESIGN]` `[ACCESSIBILITY]` |
| 2026-09-16 | [Article Page: Standfirst Deck, AI Disclosure, and Removable Tags Section](2026-09-16-1856_article-page-standfirst-deck-and-ai-disclosure.md) | `[FEATURE]` `[STYLING]` `[UI]` `[DESIGN]` `[ACCESSIBILITY]` |
| 2026-09-16 | [Final Chrome and Home Page: Typographic Lead Plus Full Stress Grid](2026-09-16-1843_home-page-final-chrome-and-stress-grid.md) | `[FEATURE]` `[STYLING]` `[UI]` `[DESIGN]` `[ACCESSIBILITY]` `[TESTING]` |
| 2026-09-16 | [docs(01-05): complete plan — SUMMARY, STATE, ROADMAP](2026-09-16-1817_01-05-complete-plan-summary-state-roadmap.md) | `[docs]` `[auto-generated]` |
| 2026-09-16 | [GREEN: Implement the Hardened D-13 Contrast Gate](2026-09-16-1814_green-contrast-gate-hardening.md) | `[FEATURE]` `[STYLING]` `[ACCESSIBILITY]` `[TESTING]` `[DESIGN]` |
| 2026-09-16 | [RED: Failing Suite and Fixtures for the Hardened D-13 Contrast Gate](2026-09-16-1804_red-contrast-gate-hardening-tests.md) | `[TESTING]` `[STYLING]` `[ACCESSIBILITY]` `[BUG_FIX]` |
| 2026-09-16 | [Render Swatch Evidence for Both Themes (D-01, C-01)](2026-09-16-1548_render-palette-swatches.md) | `[FEATURE]` `[STYLING]` `[TESTING]` `[DESIGN]` |
| 2026-09-16 | [Phase 1 Plan 4 Complete: D-06 Stress Set + D-15 Spanish Calibration](2026-09-16-1510_01-04-complete-plan-summary-state-roadmap-requirem.md) | `[DOCUMENTATION]` `[TESTING]` `[DATABASE]` `[ACCESSIBILITY]` `[DESIGN]` |
| 2026-09-16 | [Author Real Spanish Copy and Calibrate the Synthetic +25% Floor in the Real Fonts (D-15)](2026-09-16-1507_spanish-copy-and-width-calibration.md) | `[FEATURE]` `[STYLING]` `[TESTING]` `[ACCESSIBILITY]` `[DESIGN]` |
| 2026-09-16 | [Generate the Photo-Sampled Palette and Pass the Contrast Gate (D-01, D-02, D-03, D-04, D-13)](2026-09-16-1502_build-palette-contrast-gate.md) | `[FEATURE]` `[STYLING]` `[ACCESSIBILITY]` `[DESIGN]` |
| 2026-09-16 | [Fetch the Full D-06 Stress Set, Feeds and Category Counts; Copy the Public Changelog](2026-09-16-1457_fetch-d06-stress-set-and-changelog-copy.md) | `[FEATURE]` `[DATABASE]` `[SECURITY]` `[BUG_FIX]` `[DESIGN]` |
| 2026-09-16 | [docs(01-03): record 2 owner-review deviations in WINDOWS ledger](2026-09-16-1449_01-03-record-2-owner-review-deviations-in-windows-.md) | `[docs]` `[auto-generated]` |
| 2026-09-16 | [docs(01-03): complete plan — SUMMARY, STATE, ROADMAP, REQUIREMENTS](2026-09-16-1448_01-03-complete-plan-summary-state-roadmap-requirem.md) | `[docs]` `[auto-generated]` |
| 2026-09-16 | [Source Real Photos and Sample One Hue Per Category (D-02, C-01)](2026-09-16-1421_source-photos-sample-hues.md) | `[FEATURE]` `[SECURITY]` `[DESIGN]` |
| 2026-09-16 | [Phase 1 Plan 2 Complete: Tracer + Font Subset/Fallback/CLS Measurement](2026-09-16-1333_complete-01-02-plan.md) | `[DOCUMENTATION]` `[TESTING]` `[STYLING]` `[PERFORMANCE]` |
| 2026-09-16 | [Phase 1 Plan 2 Task 2: Self-Hosted Subset Fonts, Metric-Compatible Fallbacks, Font-Swap CLS Measurement](2026-09-16-1328_font-subset-fallback-cls-measurement.md) | `[FEATURE]` `[STYLING]` `[TESTING]` `[PERFORMANCE]` `[ACCESSIBILITY]` |
| 2026-09-16 | [Phase 1 Plan 2 Task 1: Tracer — Real D1 Row to Mockup to Contrast Gate](2026-09-16-1258_tracer-d1-to-mockup-to-contrast-gate.md) | `[FEATURE]` `[TESTING]` `[STYLING]` `[DATABASE]` `[ACCESSIBILITY]` `[SECURITY]` |
| 2026-09-16 | [Phase 1 Plan 1 Complete: Toolchain, WebKit, Test Harness](2026-09-16-1237_complete-01-01-plan.md) | `[PLANNING]` `[DOCUMENTATION]` `[TESTING]` |
| 2026-09-16 | [Static Server, Playwright Config, and Test Harness (TDD)](2026-09-16-1233_static-server-playwright-harness.md) | `[TESTING]` `[INFRA]` `[SECURITY]` `[CONFIG]` |
| 2026-09-16 | [Harness Spec Written (TDD Red)](2026-09-16-1231_harness-spec-red.md) | `[TESTING]` `[CONFIG]` |
| 2026-09-16 | [Install Pinned Toolchain, Prove WebKit via Docker Fallback](2026-09-16-1230_install-toolchain-webkit-docker-fallback.md) | `[DEPENDENCIES]` `[TESTING]` `[INFRA]` `[CONFIG]` |
| 2026-09-16 | [Phase 1 Plans Created](2026-09-16-1142_phase-1-plans.md) | `[PLANNING]` `[DOCUMENTATION]` `[TESTING]` `[ACCESSIBILITY]` `[DESIGN]` |
| 2026-09-16 | [Phase 1 Design Sketch Research](2026-09-16-1051_phase-1-design-research.md) | `[DOCUMENTATION]` `[STYLING]` `[TESTING]` `[ENHANCEMENT]` |
| 2026-09-16 | [Phase 1 Context Captured and Per-Phase Branch Convention Set](2026-09-16-1009_phase-1-context-and-branch-convention.md) | `[PLANNING]` `[DESIGN]` `[DOCUMENTATION]` `[CONFIG]` `[ACCESSIBILITY]` |
