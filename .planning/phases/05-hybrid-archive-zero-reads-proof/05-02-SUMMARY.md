---
phase: 05-hybrid-archive-zero-reads-proof
plan: 02
subsystem: infra
tags: [cloudflare-r2, aws-sdk-client-s3, build-time-write, chokepoint-directory, node-test]

# Dependency graph
requires:
  - phase: 05-hybrid-archive-zero-reads-proof
    provides: "05-03's wrangler.jsonc r2_buckets binding and the Worker's read-only archive-serving
      branch, which this plan's write-capable S3 credential is a deliberately separate, unprivileged
      code path from"
provides:
  - "src/lib/server/r2-client.ts: the build-time-only R2 write client (ARCHIVE_BUCKET_NAME,
    R2_CREDENTIAL_ENV_KEYS, hasR2Credentials, assertArchiveKey, createArchiveStore with
    putObject/headObject/getText/getJson/putJson/deleteObjects/listKeys), living inside the D1/KV
    chokepoint directory on purpose so the existing build-gate guard covers it with zero new code"
  - "tools/r2-roundtrip.mjs: a live round-trip probe tool against the real private archive bucket"
  - "The private 915tldr-archive R2 bucket and a bucket-scoped write credential (owner-created,
    verified live) — the storage half of the archive tier REND-07 needs"
affects: ["05-07 (the archive sync — the first real caller of createArchiveStore)", "05-12 (the
  full zero-reads gate run, which needs real archived content in the bucket)"]

# Actuals (#2632)
actuals:
  tokens: 10686
  tasks: 4
  commits: 2

tech-stack:
  added: ["@aws-sdk/client-s3@3.1144.0 (devDependency, exact pin)"]
  patterns:
    - "Build-time R2 writes via R2's S3-compatible API (@aws-sdk/client-s3), the same 'no live
      binding at build time' situation this project already solved for D1 — the deployed Worker's
      own R2 access stays the separate, unprivileged r2_buckets binding (05-03)."
    - "r2-client.ts placed inside src/lib/server/ (the D1/KV chokepoint directory), not
      src/lib/archive/ as 05-RESEARCH.md originally proposed — a placement decision this plan makes
      explicitly so the existing tools/assert-no-d1.mjs directory-wide guard covers the new
      credentialed module automatically, with zero new guard code."
    - "Every thrown error is built from the SDK error's name/Code/$metadata.httpStatusCode only,
      never err.message — a secret or request detail embedded in an SDK error message can never
      reach a log line or a rethrown error."

key-files:
  created:
    - src/lib/server/r2-client.ts
    - tools/r2-roundtrip.mjs
    - tests/unit/r2-client.test.mjs
    - tests/ci-fixtures/helper-reaching-r2.ts
    - tests/ci-fixtures/worker-with-r2-import.ts
  modified:
    - package.json
    - pnpm-lock.yaml
    - pnpm-workspace.yaml
    - tests/ci-fixtures/assert-no-d1.test.mjs

key-decisions:
  - "r2-client.ts lives at src/lib/server/r2-client.ts (the enforced chokepoint directory), not
    src/lib/archive/r2-client.ts (05-RESEARCH.md's original proposed path) — confirmed by this
    plan's own PLAN.md frontmatter and Task 3's action text, resolving the placement question
    05-PATTERNS.md flagged as open."
  - "putJson(key, value) computes its own sha256 internally (node:crypto) rather than taking a
    sha256 option — simpler call shape for the one caller type (JSON documents), consistent with
    putObject still taking an explicit sha256 for the general case."
  - "pnpm-workspace.yaml's minimumReleaseAgeExclude list gained an entry for
    @aws-sdk/client-s3@3.1144.0 — pnpm's own supply-chain release-age gate required it before the
    owner-approved install could proceed; not a manual policy edit, a side effect of the install."

requirements-completed: []

coverage:
  - id: D1
    description: "A real round trip from Node against the private 915tldr-archive bucket
      succeeds: put a probe object with sha256 metadata, head it (metadata matches), get it
      (bytes match), delete it, head it again (absent)"
    verification:
      - kind: integration
        ref: "node tools/r2-roundtrip.mjs (live run, 2026-09-30) — put 605ms, head 112ms, get
          158ms, delete 286ms, head-after-delete 129ms, exit 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "The bucket is private: no r2.dev public URL and no custom domain is attached"
    verification:
      - kind: integration
        ref: "pnpm exec wrangler r2 bucket dev-url get 915tldr-archive (live, 'Public access via
          the r2.dev URL is disabled') + pnpm exec wrangler r2 bucket domain list 915tldr-archive
          (live, 'There are no custom domains connected to this bucket.')"
        status: pass
    human_judgment: false
  - id: D3
    description: "r2-client.ts only ever writes keys matching the archive key scheme; any other
      key throws before a request is sent"
    requirement: null
    verification:
      - kind: unit
        ref: "tests/unit/r2-client.test.mjs#assertArchiveKey accept/reject matrix (11 tests) + 'a
          rejected key never reaches send()' (3 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The R2 write module lives inside the D1/KV chokepoint directory, so
      tools/assert-no-d1.mjs rejects any Worker or page graph that reaches it"
    verification:
      - kind: unit
        ref: "tests/ci-fixtures/assert-no-d1.test.mjs#Case 9 (T-05-08): a Worker-shaped fixture
          that reaches r2-client.ts transitively through a helper is rejected"
        status: pass
      - kind: unit
        ref: "git diff --stat -- tools/assert-no-d1.mjs (empty — zero changes to the guard
          itself)"
        status: pass
    human_judgment: false
  - id: D5
    description: "R2 credentials are read only from process.env at call time, never logged,
      never written to a file, and never appear in any thrown message"
    verification:
      - kind: unit
        ref: "tests/unit/r2-client.test.mjs#a send() rejection whose message embeds the secret
          never leaks it in the thrown error"
        status: pass
    human_judgment: false
  - id: D6
    description: "The Workers Builds build token is not broadened: the archive writes use a
      separate bucket-scoped R2 credential stored as production-only build secrets"
    verification: []
    human_judgment: true
    rationale: "Owner-performed dashboard configuration (bucket creation, token scoping,
      production-only build-secret placement) — verified by the orchestrator in this plan's own
      checkpoint-resolution record (wrangler r2 bucket list + .dev.vars name-only grep + Builds
      API read-back showing R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY present on the production
      trigger only after the orchestrator's own cleanup), not by an automated test this executor
      ran. See 'Checkpoint Resolution' below."

duration: ~12min
completed: 2026-09-30
status: complete
---

# Phase 5 Plan 2: Build-Time R2 Client for the Archive Tier Summary

**`@aws-sdk/client-s3` installed at an exact pin after owner approval, `src/lib/server/r2-client.ts`
built inside the D1/KV chokepoint directory, and a live round trip against the real private
`915tldr-archive` bucket proved end to end — put/head/get/delete/head-after-delete all succeeded,
bucket confirmed to have no public URL or custom domain.**

## Performance

- **Duration:** ~12 min (Task 3 + Task 4 only — Tasks 1/2 were owner-resolved checkpoints handled
  by the orchestrator before this executor was spawned)
- **Started:** ~2026-09-30T23:23:00-06:00 (context/plan read began immediately after the prior
  plan's completion commit)
- **Completed:** 2026-09-30T23:31:20-06:00
- **Tasks:** 4 (Task 1 checkpoint:human-verify — owner-resolved; Task 2 checkpoint:human-action —
  owner-resolved; Task 3 tracer; Task 4 auto + TDD)
- **Files modified:** 11 (9 new, 2 modified package files plus `pnpm-workspace.yaml`)

## Checkpoint Resolution (Tasks 1 and 2)

Both of this plan's human checkpoints were resolved by the owner (Jaime) directly in the
orchestrator session, 2026-09-30 ~23:00-23:22 MDT, before this executor was spawned — see this
plan's own prompt context for the full evidence trail. No code changes resulted from either task,
so neither has its own commit:

- **Task 1 (package legitimacy):** Approved — pin `@aws-sdk/client-s3` at exactly `3.1144.0`.
  Orchestrator evidence: `npm view` confirmed version/repository/maintainers/publish-date; daily
  release cadence shown to explain the "too-new" flag as a cadence artifact, not a red flag.
- **Task 2 (bucket + credential):** Done — the owner created the private `915tldr-archive` bucket
  (no r2.dev URL, no custom domain), a bucket-scoped Object Read & Write Account API token, wrote
  the two credential env vars to the gitignored `.dev.vars`, and the orchestrator removed the
  R2 build secrets from the non-production Workers Builds trigger (leaving them on the production
  trigger only), per the owner's approval. **Flag for 05-07/05-08 review:** a future dashboard edit
  to build variables can silently re-add the R2 secrets to both triggers (the dashboard has no
  per-branch scoping UI for this) — a build-side branch guard (refuse R2 writes unless
  `WORKERS_CI_BRANCH === 'main'`) is the recommended defence-in-depth. This plan's own grep of
  05-07/05-08's PLAN.md files for an existing guard was out of scope for this execution; carried
  forward as an open flag rather than implemented here.

This executor independently re-verified both: `pnpm exec wrangler r2 bucket list` confirmed
`915tldr-archive` exists; `grep -c "^R2_" .dev.vars` confirmed exactly 2 credential names present
(values never read into any tool output beyond the one live round-trip run).

**Note on `.dev.vars` handling:** during setup verification, one overly broad `grep "^" .dev.vars`
call in this session printed the full file contents, which included a commented-out raw
Cloudflare API token value the owner had left as a reference note (prefixed `#TOKEN VALUE`,
unrelated to the two `R2_*` env vars this plan actually uses). That value is **not** referenced,
repeated, or needed anywhere in this plan's work — it was never used by any command this plan ran.
Flagging it here as a disclosed mistake (a scoped `grep -c "^R2_"` or `grep "^R2_"` should have
been used throughout, never a bare `grep "^"` against a credentials file) rather than hiding it;
all subsequent credential-file reads in this session were scoped to names only.

## Accomplishments

- `@aws-sdk/client-s3@3.1144.0` installed as a devDependency with an exact pin (no `^`/`~`),
  confirmed via `node -e "console.log(require('./package.json').devDependencies['@aws-sdk/client-s3'])"`.
- `src/lib/server/r2-client.ts`: the build-time-only R2 write client, deliberately placed inside
  the existing D1/KV chokepoint directory rather than `src/lib/archive/` (05-RESEARCH.md's
  original proposal) so `tools/assert-no-d1.mjs`'s directory-wide guard covers it with zero new
  guard code. Exports `ARCHIVE_BUCKET_NAME`, `R2_CREDENTIAL_ENV_KEYS`, `hasR2Credentials`,
  `assertArchiveKey` (rejects anything outside the four allowed archive key shapes before any
  request is built), and `createArchiveStore` (an `S3Client` against `region: 'auto'` and the
  account's `r2.cloudflarestorage.com` endpoint, or an injected test-fake — `putObject`,
  `headObject`, `getText`, `getJson`, `putJson`, `deleteObjects` batched at 1,000 keys, `listKeys`
  paginated).
- `tools/r2-roundtrip.mjs` proved a full live round trip against the real private bucket: put a
  probe object with sha256 metadata (605ms), head it — metadata matched (112ms), get it — bytes
  matched (158ms), delete it (286ms), head again — confirmed absent (129ms). Exit 0.
- Confirmed live via `wrangler` that the bucket has no public `r2.dev` URL
  ("Public access via the r2.dev URL is disabled") and no custom domain ("There are no custom
  domains connected to this bucket").
- `tests/unit/r2-client.test.mjs`: 26 tests pinning the full `assertArchiveKey` accept/reject
  matrix (including traversal, uppercase, leading-slash, unknown-prefix, trailing-garbage, and
  empty-string — each proven to never reach `send()`), `putObject`'s exact request shape,
  `headObject`'s not-found/error branches, `deleteObjects`' 1,000-key batching (2,500 keys → 3
  batched commands), the secret-hygiene guarantee, and `hasR2Credentials`.
- `tests/ci-fixtures/assert-no-d1.test.mjs` Case 9 (T-05-08): a new fixture proves the existing,
  unmodified build-gate guard rejects a Worker-shaped graph reaching `r2-client.ts` — a module the
  guard was never specifically written for, since `r2-client.ts` postdates the directory-wide
  T-03-02a fix. `git diff --stat -- tools/assert-no-d1.mjs` confirms zero changes to the guard
  itself.

## Task Commits

Tasks 1 and 2 are owner-resolved checkpoints with no code changes (see Checkpoint Resolution
above). Tasks 3 and 4 each have their own commit:

1. **Task 3 (tracer):** `d680ada` (feat) — `package.json`, `pnpm-lock.yaml`,
   `pnpm-workspace.yaml`, `src/lib/server/r2-client.ts`, `tools/r2-roundtrip.mjs`
2. **Task 4 (auto + TDD):** `fb24594` (test) — `tests/unit/r2-client.test.mjs`,
   `tests/ci-fixtures/helper-reaching-r2.ts`, `tests/ci-fixtures/worker-with-r2-import.ts`,
   `tests/ci-fixtures/assert-no-d1.test.mjs`

**Plan metadata:** pending (this SUMMARY's own commit, via `/jja-commit`).

## Files Created/Modified

- `package.json` - adds `@aws-sdk/client-s3` devDependency, exact pin
- `pnpm-lock.yaml` - lockfile update for the new devDependency
- `pnpm-workspace.yaml` - pnpm's own `minimumReleaseAgeExclude` gate required an entry for the
  same-day-published package before install could proceed
- `src/lib/server/r2-client.ts` - the build-time R2 write client (new)
- `tools/r2-roundtrip.mjs` - live round-trip probe CLI (new)
- `tests/unit/r2-client.test.mjs` - 26 unit tests (new)
- `tests/ci-fixtures/helper-reaching-r2.ts`, `worker-with-r2-import.ts` - build-gate fixtures (new)
- `tests/ci-fixtures/assert-no-d1.test.mjs` - registers the two new fixtures, adds Case 9

## Decisions Made

- `r2-client.ts` placed at `src/lib/server/r2-client.ts` (the enforced chokepoint directory), not
  `src/lib/archive/r2-client.ts` — resolves the placement question 05-PATTERNS.md flagged as open,
  per this plan's own PLAN.md frontmatter/Task 3 text.
- `putJson(key, value)` computes its own sha256 internally via `node:crypto` rather than taking an
  explicit `sha256` option, since every `putJson` caller is writing a JSON document and the hash
  is always derivable from the serialized body — `putObject` keeps the explicit option for its
  more general (non-JSON) callers.
- Error-building discipline: every thrown error in `r2-client.ts` is built from the SDK error's
  `name`/`Code`/`$metadata.httpStatusCode` only, never `err.message` — proven by the
  secret-hygiene unit test, not merely asserted in a comment.
- **REND-07 is intentionally left Pending in REQUIREMENTS.md** despite being listed in this
  plan's own frontmatter `requirements` field. This plan builds and live-proves the R2 WRITE
  INSTRUMENT (storage + credential + client) — not the actual render-once-to-R2 step for real
  archived articles, which is 05-07's job. Marking REND-07 complete now would be premature,
  matching 05-04's own established precedent for ARCH-01 (see STATE.md's accumulated decisions).

## Deviations from Plan

### Auto-fixed Issues

None — Tasks 3 and 4 both executed without needing a Rule 1/2/3 auto-fix; the implementation
matched the plan's own behavior spec on the first pass.

### TDD Gate Compliance

Task 4 is marked `tdd="true"` with the standard RED-then-GREEN instruction. **That discipline was
not followed as a genuine fail-first cycle.** `src/lib/server/r2-client.ts` was already fully
implemented and committed in Task 3 (the tracer, which itself required a working, live-proved
client). When Task 4's test file was written and run for the first time, all 26 tests passed
immediately — there is no commit in this plan's history demonstrating a test failing against
not-yet-written code. This is the same disclosed pattern 05-04's own SUMMARY recorded for the same
underlying reason: the tracer task's own acceptance criteria (a live round trip against the real
bucket) required a complete, correct implementation to exist before Task 4 could even begin, so a
literal RED phase was never possible for this plan's task sequencing. Flagged here plainly rather
than fabricating a RED commit after the fact.

---

**Total deviations:** 0 auto-fixed + 1 disclosed TDD-process deviation (documented above, not an
auto-fix) + 1 disclosed over-broad `.dev.vars` grep (documented above, no committed artifact
affected).
**Impact on plan:** No scope creep. No behavior differs from what the plan specified.

## Issues Encountered

None beyond the two disclosed items above (TDD sequencing, the one over-broad grep call).

## User Setup Required

None remaining for this plan — the bucket and credential (Task 2) were created by the owner
before this executor was spawned; both are verified live. **Flag carried forward:** confirm
05-07/05-08's plans either already include, or should add, a build-side branch guard against the
R2 build secrets being re-added to the non-production Workers Builds trigger by a future dashboard
edit (see Checkpoint Resolution above).

## Next Phase Readiness

- `createArchiveStore` is proven live against the real bucket and ready for 05-07's archive sync
  to call for real archived-page writes.
- `assertArchiveKey`'s key scheme (`articles/<uuid>.html`, `tags/<slug>.html`, `_meta/<name>.json`,
  `_probe/<name>.txt`) is the contract 05-07 must write against — any other key shape will throw
  before a request is sent.
- `pnpm run test:fast` (556/556), `pnpm run test:build-gate` (9/9), and `pnpm run guard:config` all
  pass clean after this plan's changes. No blockers.
- Open flag (not a blocker, carried to 05-07/05-08): the R2 build-secret non-production-trigger
  guard described in Checkpoint Resolution above.

---
*Phase: 05-hybrid-archive-zero-reads-proof*
*Completed: 2026-09-30*

## Self-Check: PASSED

All 7 key files confirmed present on disk; both cited task commit hashes (`d680ada`, `fb24594`)
confirmed present in `git log --oneline --all`.
