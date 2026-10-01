# 2026-09-30 - R2 build-time client installed, live round trip proven against the private archive bucket

**Keywords:** [BACKEND] [DEPENDENCIES] [SECURITY] [TESTING] [ARCHITECTURE]
**Session:** Late evening, Duration (~15 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-30-2328_r2-client-install-sdk-live-roundtrip.md`

## What Changed

- File: `package.json`
  - Added `@aws-sdk/client-s3` as a devDependency, pinned exactly at `3.1144.0` (no caret) —
    install happened only after the owner approved Task 1's package-legitimacy checkpoint.
- File: `pnpm-lock.yaml`
  - Updated for the new devDependency.
- File: `pnpm-workspace.yaml`
  - pnpm's own supply-chain "minimumReleaseAgeExclude" policy required adding an entry for
    `@aws-sdk/client-s3@3.1144.0` (published the same day) before the install would proceed —
    this is pnpm's install-time gate reacting to the install, not a manual policy edit.
- File: `src/lib/server/r2-client.ts` (new)
  - Build-time-only R2 client living inside the D1/KV chokepoint directory (`src/lib/server/`)
    on purpose, so `tools/assert-no-d1.mjs`'s existing module-graph guard keeps it (and the
    write credential it holds) out of any Worker or page graph, with no new guard code needed.
  - Exports `ARCHIVE_BUCKET_NAME` (`'915tldr-archive'`, hardcoded like `d1-client.ts`'s database
    id), `R2_CREDENTIAL_ENV_KEYS`, `hasR2Credentials`, `assertArchiveKey` (rejects any key
    outside the four allowed archive key shapes — `articles/<uuid>.html`, `tags/<slug>.html`,
    `_meta/<name>.json`, `_probe/<name>.txt` — before any request is built), and
    `createArchiveStore` (an `S3Client` with `region: 'auto'` against the account's
    `r2.cloudflarestorage.com` endpoint, or an injected test-fake client; exposes `putObject`,
    `headObject`, `getText`, `getJson`, `putJson`, `deleteObjects` (batched at 1,000),
    `listKeys` (paginated)).
  - Every thrown error is built from the SDK error's `name`/`Code`/`$metadata.httpStatusCode`
    only — never `err.message` — so a thrown error can never echo request or credential detail.
- File: `tools/r2-roundtrip.mjs` (new)
  - Live probe tool: dynamically imports `r2-client.ts` (mirroring `tools/ci-build.mjs`'s own
    dynamic import of `build-state.ts`), puts a probe object with sha256 metadata, heads it,
    gets it, deletes it, heads again to confirm absence, and prints per-operation timings.

## Why

Phase 5's REND-07 needs somewhere to render archive-tier pages once. The Workers Builds process
has no live Cloudflare bindings at build time (the same situation D1 access was already in), so
the archive write path goes through R2's S3-compatible API via AWS's own SDK rather than a
hand-rolled SigV4 signer.

## Issues Encountered

No major issues encountered — `pnpm add` surfaced pnpm's own release-age gate (expected, not a
bug) and the install otherwise went cleanly. The live round trip against the real bucket passed
on the first run.

## Dependencies

Added: `@aws-sdk/client-s3@3.1144.0` (devDependency — build-time R2 writes only; never bundled
into the deployed Worker)

## Testing Notes

- What was tested: a full live round trip against the real, private `915tldr-archive` R2
  bucket — put (with sha256 metadata) → head (metadata match) → get (byte match) → delete →
  head again (confirmed absent). Also confirmed live via `wrangler r2 bucket dev-url get` /
  `domain list` that the bucket has no public r2.dev URL and no custom domain.
- What wasn't tested yet: `assertArchiveKey`'s full accept/reject matrix, `headObject`'s
  not-found/error branches, `deleteObjects`' 1,000-key batching, and the secret-hygiene
  (never-leak-the-secret-in-an-error) guarantee — all deferred to this same plan's Task 4
  (TDD unit tests + the build-gate fixture case), not yet written as of this commit.
- Edge cases: n/a for this commit — covered by Task 4.

## Next Steps

- [ ] Task 4: TDD unit tests for `assertArchiveKey`/`headObject`/`deleteObjects`/secret hygiene,
      plus a new `tests/ci-fixtures` case proving a Worker-shaped fixture reaching
      `r2-client.ts` is rejected by the existing build-gate guard.
- [ ] 05-07 (later in this phase): the archive sync that actually calls `createArchiveStore` to
      write real archived pages.

---

**Branch:** feature/phase-05
**Issue:** N/A
**Impact:** MEDIUM - new build-time dependency and a new credentialed module, but no runtime
(Worker-bundled) surface and no production content exists in R2 yet.
