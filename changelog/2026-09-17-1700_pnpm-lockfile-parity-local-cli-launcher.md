# 2026-09-17 - pnpm end to end: lockfile parity, local Playwright CLI launcher, packageManager pin

**Keywords:** [TESTING] [DEPENDENCIES] [CONFIG] [FEATURE]
**Session:** Afternoon, Duration (~30 min)
**Commit:** find with `git log --diff-filter=A -1 --format=%H -- changelog/2026-09-17-1700_pnpm-lockfile-parity-local-cli-launcher.md`

## What Changed

- File: `package.json`
  - Added `"packageManager": "pnpm@11.26.0"` (D-GAP-D, owner decision 2026-09-17) directly after `"type"`. No other field changed — dependencies and scripts are byte-identical.
- File: `design/scripts/pw.mjs`
  - Replaced all three Playwright launch paths (host Chromium, host WebKit native, Docker WebKit) with direct `node node_modules/@playwright/test/cli.js` invocations, dropping the `npx` package-runner calls entirely.
  - Added `requirePlaywrightCli()`: if the local CLI file is missing, exits 2 with "Playwright CLI not found at node_modules/@playwright/test/cli.js — run pnpm install (owner)" instead of letting a package runner silently fetch from the registry.
  - Docker launch now runs `node node_modules/@playwright/test/cli.js test --project=webkit ...` inside the container, path relative to the `/work` mount (pnpm's relative symlinks under `node_modules/.pnpm` resolve correctly there). Every other Docker argument (`--network none`, `--user`, `HOME=/tmp`, `MOCKUP_PAGES`/`PW_JSON_OUT` env, volume, pinned image) is unchanged.
  - Updated the header comment and the missing-webkit-mode message to name `pnpm run probe:webkit`.
- File: `pnpm-lock.yaml` (newly tracked)
  - First commit of the pnpm lockfile. Verified read-only, offline, against the previously owner-approved `package-lock.json`: 16/16 packages identical (name, version, integrity) — no new package entered the dependency tree.

## Why

The owner ran `pnpm install` on 2026-09-17 and chose pnpm as the project's package manager (D-GAP-D). Every later gap-closure plan runs the Playwright harness, and the harness had never been proven under the pnpm `node_modules` layout — particularly the Docker WebKit path, since the pinned Playwright image ships node and npm but not pnpm, and the previous launcher called a package runner that can reach the registry. Calling `node` directly on the local CLI file removes that fetch path entirely: it either finds the local binary or fails loudly, never downloads.

## Issues Encountered

No major issues encountered. Lockfile parity was checked with a throwaway, read-only Node script (kept in the session scratchpad, not committed) that parses both lockfiles' package/integrity triples and diffs the sets — no install command was run at any point.

## Dependencies

No dependencies added. `pnpm-lock.yaml` resolves the same 16 `name@version` pairs, with identical integrity hashes, as the previously-approved `package-lock.json`.

## Testing Notes

- What was tested: `pnpm ls --depth=0 --json` (confirmed all five direct devDependencies at their exact pins); `pnpm run verify:phase-1 --pages=index --criteria=1,2` (SCOPED run, PASS in both Chromium and WebKit (Docker) through the new local-CLI launcher); `node --test design/tests/unit/check-contrast.test.mjs` (17/17 pass).
- What wasn't tested: the CLI-missing exit-2 path (would require moving the real CLI file aside, not exercised to avoid disturbing the working install).
- Edge cases: Docker WebKit launch specifically, since it's the path most exposed to a package-runner registry fetch — proven green under the new launcher.

## Next Steps

- [ ] Task 2: retire `package-lock.json` from git and move `01-VALIDATION.md` to pnpm wording
- [ ] Task 3: pnpm wording in tool output; record 01-10 as `outcome: revise`

---

**Branch:** feature/phase-01
**Issue:** N/A
**Impact:** MEDIUM - toolchain/dependency-manager change; no mockup content touched, but every later gap-closure plan depends on this harness running cleanly under pnpm
