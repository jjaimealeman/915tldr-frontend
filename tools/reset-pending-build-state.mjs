#!/usr/bin/env node
// quick 261002-tl2: the FIRST step of `pnpm run build`. Clears whatever
// `.astro/build-state.pending.json` (and any stray write-temp file) survived from an earlier
// run — Workers Builds caches `.astro/` between builds (D-06), so a corrupt or stale pending
// file can otherwise carry over into a new build and either crash it outright (the real
// 2026-10-02 incident: `build-state: failed to read pending build state: Unexpected
// non-whitespace character after JSON at position 1867519`) or, worse, silently satisfy
// `commitLastGood`'s D-14 required-section check with a section LEFT OVER from a previous
// build rather than one the current build actually wrote.
//
// Runs as the first command in `pnpm run build`, ahead of `guard:config`, so that every exit
// path of a build — even one that fails at `guard:config` — leaves either no pending file or one
// written entirely by this build. `pnpm run build` is the one entry point shared by Workers
// Builds (`tools/ci-build.mjs`'s build step spawns it), `pnpm run test:regression`, and local
// builds, so this is the one place a reset can run before ANY of them, without ever discarding
// state the CURRENT build is in the middle of writing (see 261002-tl2-PLAN.md's objective for
// the full reset-point rationale and the rejected alternatives).
//
// Reads no env, no credentials — this is a pure filesystem cleanup step.
import { resetPendingBuildState } from '../src/lib/server/build-state.ts';

try {
  const { removed, bytes, strayTempFiles } = await resetPendingBuildState();
  const strayPart = strayTempFiles > 0 ? `, ${strayTempFiles} stray temp file(s)` : '';
  if (removed) {
    console.log(`[build-state] reset pending build state: removed previous file (${bytes} bytes)${strayPart}`);
  } else {
    console.log(`[build-state] reset pending build state: no previous file${strayPart}`);
  }
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
