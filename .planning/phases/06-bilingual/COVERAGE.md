# API Coverage — Phase 06 (Bilingual)

> Full coverage by default. Opt-outs are explicit, reasoned decisions.
> Detector (2026-10-03) fired on the phase scope: OpenAI (pipeline), D1 REST (build-time loader).
> Four external surfaces are touched: OpenAI (extended), Cloudflare D1 REST and R2 S3 API
> (extended to Spanish data/keys), and Umami (new). Capability names are prefixed by service so
> each is unique.

| capability | decision | reason |
|---|---|---|
| openai: same-call bilingual summary (json_object, 06-01) | INTEGRATE | |
| openai: usage token accounting for budget and cost delta | INTEGRATE | |
| openai: translation-only prompt (backfill, 06-08) | INTEGRATE | |
| openai: grounding judge call on Spanish summaries (live and backfill, D-04) | INTEGRATE | |
| openai: Batch API file upload (purpose batch) | INTEGRATE | |
| openai: Batch API create / retrieve / output and error file download | INTEGRATE | |
| openai: Batch API expired-line resubmission (CONT-11 precedent) | INTEGRATE | |
| openai: Batch API cancel | OPT-OUT | not needed — the ceiling is enforced before submission; an in-flight batch is allowed to finish rather than cancelled |
| openai: structured outputs (json_schema) | OPT-OUT | not needed — the pipeline's established json_object + explicit validator (validateSpanishFields) is kept for parity with the English path |
| openai: streaming | OPT-OUT | explicitly out of scope — batch and cron processing only, no interactive surface |
| d1-rest: bound-param translation reads at build time (06-06) | INTEGRATE | |
| d1-rest: rows_read meta for the Spanish loader budget | INTEGRATE | |
| d1-cli: additive migration + read-only verification (06-03) | INTEGRATE | |
| d1-cli: escaped upserts for pilot/backfill writes | INTEGRATE | |
| d1: time-travel bookmark before the migration | INTEGRATE | |
| r2-s3: put/list for es/articles and es/tags prefixes (pre-sync, self-heal) | INTEGRATE | |
| r2-s3: delete of orphaned Spanish objects (post-sync, existing mechanism) | INTEGRATE | |
| umami: tracker script on every page (D-11) | INTEGRATE | |
| umami: dashboard language breakdown (I18N-10, checked live by Jaime in 06-16) | INTEGRATE | |
| umami: custom events / goals | OPT-OUT | explicitly deferred by Jaime (CONTEXT Deferred Ideas — separate engagement-setup task) |
| umami: reporting API (programmatic stats export) | OPT-OUT | not needed — D-11 makes the dashboard report the I18N-10 surface; no Worker or build code reads Umami |
| umami: data-domains / data-do-not-track attributes | OPT-OUT | not needed — D-11 specifies the tag verbatim; changing tracking scope is Jaime's call |
