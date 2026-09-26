# 2026-09-23 - `pnpm verify:edge` Loads `.dev.vars` Itself — No More Manual Export Required

**Keywords:** [TESTING] [BACKEND] [BUG_FIX] [DOCUMENTATION]
**Session:** Evening, Duration (~30min, follow-up to the same day's earlier `pnpm verify:edge` hardening)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-23-1930_verify-edge-loads-dev-vars-automatically.md`

## What Changed

- File: `tools/verify-edge-headers.mjs`
  - Added `loadDevVars()`: reads `.dev.vars` (Wrangler's gitignored local-dev vars file, already
    referenced by `wrangler.jsonc`'s own comment) and populates `process.env` for any key not
    already set. Parses plain `KEY=value` lines, skips blank lines and `#` comments, strips one
    layer of matching quotes around the value
  - Called once at module load, before any check runs
  - An already-set `process.env` value is never overwritten — CI (or a developer who deliberately
    exports a different value) can still override without touching `.dev.vars` or this script
  - A missing or unreadable `.dev.vars` is not an error here; it's a silent no-op that falls
    through to `requireEnv()`'s existing specific "X is not set" error the moment a genuinely
    unavailable variable is actually used inside `d1-client.ts`/`kv-manifest.ts`

## Why

The same day's earlier hardening (see `2026-09-23-1840_harden-verify-edge-live-article-discovery.md`)
fixed the false-negative discovery bug but left a second instance of the exact failure class it
was built to prevent: run from a fresh shell with none of the three required Cloudflare/KV
environment variables already exported, check 4 failed with a correct, specific
`RENDER_MANIFEST_KV_NAMESPACE_ID is not set in the environment` message — accurate, but OPS-02's
entire premise is "a command someone actually runs on every deploy," and a command that needs
manual `export` first is a command that gets skipped, landing in the same "guard nobody trusts"
place as a false positive, by a different road. `RENDER_MANIFEST_KV_NAMESPACE_ID` already lives on
disk in `.dev.vars`; the fix was to have the script read it directly instead of assuming the
caller's shell already has it.

## Issues Encountered

No major issues encountered.

## Dependencies

No dependencies added.

## Testing Notes

- What was tested, with real captured output, from a genuinely fresh Bash shell that had never
  sourced `.dev.vars`:
  1. `.dev.vars` present, no env pre-exported (`RENDER_MANIFEST_KV_NAMESPACE_ID` confirmed absent
     via `env | grep`) → `node tools/verify-edge-headers.mjs` passes all 4 checks, discovering
     the live article via the KV manifest exactly as the earlier hardening intended
  2. Inversion against production (`--dev-host=915tldr.com --admin-host=915tldr.com`) → still
     correctly FAILS checks 1/2/4 with exit code 1, while the negative control (check 3) still
     correctly passes
  3. `.dev.vars` temporarily renamed away (simulating an absent/unreadable file, then restored
     immediately after) → the script still fails, but with the same clear
     `RENDER_MANIFEST_KV_NAMESPACE_ID is not set in the environment` message, not a stack trace
  - Also confirmed an already-exported value is never overwritten by `loadDevVars()` (CI-override
    path)
- What wasn't tested: no dedicated unit test exists for `loadDevVars()` — verified only by the
  three live states above
- Edge cases: quoted values and `#`-comment lines in `.dev.vars` are handled by the parser but
  not exercised against a real file containing them (the actual `.dev.vars` has one unquoted line)

## Next Steps

- [ ] Consider a unit test for `loadDevVars()` with a temp fixture file covering quoted values,
      comments, and the already-set-env-var-wins precedence rule

---

**Branch:** feature/phase-03
**Issue:** N/A
**Impact:** MEDIUM - Standing deploy-verification tool now usable from a genuinely fresh shell
with zero manual setup; no production/application code path changed
