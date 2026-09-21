# Phase 2 — External API Coverage Matrix

**Surface:** OpenAI API, as used by `915tldr.com2`'s pipeline.
**Detector:** `api-coverage.cjs --json` returned `detected: true` on the Phase 2 scope.
**Scope rule:** this matrix enumerates the capabilities *this project uses or could reasonably
be expected to use for this phase's work* — the summarisation call, the grounding-check call,
and the Batch API lifecycle. It does not enumerate all of OpenAI; capabilities outside this
phase's integration (assistants, embeddings, images, audio, fine-tuning, realtime) are not part
of this surface and are covered by their own phases where relevant (embeddings are Workers AI,
not OpenAI, per the resolved Phase 9 constraint; images are Phase 7).

**Default is `INTEGRATE`.** This table is the subtraction record. Every `OPT-OUT` carries a
one-line reason.

| capability | decision | reason |
|---|---|---|
| `chat.completions.create` — summarisation (live ingest) | INTEGRATE | CONT-08 / D-05 / D-06 / D-07; plan 02-06 |
| `chat.completions.create` — grounding judge (live ingest, `mode: 'live'`) | INTEGRATE | CONT-04 / D-08 / D-11; plans 02-04 and 02-07 |
| `chat.completions.create` — grounding judge (backfill, `mode: 'backfill'`) | INTEGRATE | D-08's split policy: deterministic sweep first, judge only what it flags; plans 02-07 and 02-10 |
| `chat.completions.create` — stricter retry after a grounding flag | INTEGRATE | D-09's one retry against a stricter prompt; plan 02-08 |
| `response_format: json_object` / structured output | INTEGRATE | Already in use for the summarisation call; extended to the judge call so its verdict parses as a known shape; plans 02-06 and 02-07 |
| `usage` on a completion response (`prompt_tokens`, `completion_tokens`) | INTEGRATE | CONT-09 needs the estimator validated against real billed usage before a full-corpus projection is trusted; plan 02-09 Task 1 |
| `files.create` (purpose `batch`) — JSONL upload | INTEGRATE | CONT-10; plan 02-10 |
| `batches.create` — submit against the chat-completions endpoint | INTEGRATE | CONT-10; plan 02-10 |
| `batches.retrieve` — poll for terminal status | INTEGRATE | CONT-10 / CONT-11; plan 02-10 |
| `files.content` on `output_file_id` — download completed results | INTEGRATE | CONT-10, and required even for an expired batch because completed work lands there; plan 02-10 |
| `files.content` on `error_file_id` — download failures and expiries | INTEGRATE | CONT-11 — the expired remainder is computed from these records; plan 02-10 |
| Expired-batch resubmission of the unfinished remainder | INTEGRATE | CONT-11 is explicit that unfinished work is detected and resubmitted, not silently lost; plan 02-10 |
| `batches.cancel` | INTEGRATE | The owner-approved run may need stopping mid-flight; the execute script exposes a cancel path that records the cancellation in the run manifest. Without it, an approved run cannot be withdrawn once submitted, which is a gap the owner would reasonably expect not to exist |
| `batches.list` | OPT-OUT | The run manifest records every batch id this phase creates, so listing the account's batches adds nothing the manifest does not already hold authoritatively |
| `files.list` / `files.delete` | OPT-OUT | Batch input and output files are referenced by the ids recorded in the run manifest; no enumeration or lifecycle management is needed for a one-time archive run |
| Streaming responses (`stream: true`) | OPT-OUT | Not needed: every call in this pipeline is a cron-side or batch-side call whose full response is consumed at once; there is no user-facing token stream |
| Tool / function calling | OPT-OUT | Not needed: the summariser and the judge both return a single JSON document; there is no tool the model should invoke |
| Prompt caching (`cached_input` pricing tier) | OPT-OUT | Not needed yet: the shared system prompt is small relative to the per-article body, so the cached-input saving is immaterial against this phase's projected spend. Revisit if the system prompt grows or if the per-article input shrinks |
| Embeddings | OPT-OUT | Explicitly out of scope: `articles-semantic` is populated by Workers AI (`@cf/baai/bge-base-en-v1.5`), billed separately, and rewriting embeddings is a Phase 9 decision |
| Images | OPT-OUT | Explicitly out of scope for this phase — imagery is Phase 7 |
| Assistants / threads / realtime / audio / fine-tuning | OPT-OUT | Explicitly out of scope: none of these appear in this project's architecture, in this phase or in any planned phase |
| Moderation endpoint | OPT-OUT | Not needed: the content being processed is published local-news reporting from three named outlets, and the grounding check — not a moderation classifier — is what this phase's quality bar requires |
| Organisation / billing / usage API | OPT-OUT | Not needed programmatically: the OPS-11 gate is a human approval against a written estimate, and the account balance is a monitored line in the owner's daily routine (PROJECT.md), checked at the approval checkpoint in plan 02-10 |

## Notes

- **`batches.cancel` was nearly an opt-out and is deliberately not.** The default is INTEGRATE,
  and the argument for opting out ("we do not expect to cancel") is precisely the assumption
  this gate exists to catch. An approved run that cannot be withdrawn once submitted is an
  invisible hole, and the 24-hour completion window makes an un-cancellable mistake expensive to
  wait out.
- **Prompt caching is the opt-out most likely to be revisited.** It is a cost lever, not a
  capability gap, and the reason given is a measurement ("immaterial against this phase's
  projected spend") that plan 02-09's report will make checkable.
