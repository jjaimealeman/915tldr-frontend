// 03-06 Task 2 (D-01 measurement #1 of 3, per-page render cost): the harness-mode state and
// exit-write hook for `src/pages/[category]/[slug].astro`, extracted into its own module.
//
// Extraction reason (Rule 1 bug, found running this task): a top-level `const`/function
// declared directly in `[slug].astro`'s frontmatter and referenced only from inside
// `getStaticPaths` was silently dropped by Astro 7.3.3's rolldown-based bundler — the compiled
// chunk kept the `getStaticPaths` export and its call site intact but omitted the declaration
// itself, producing a runtime `ReferenceError: HARNESS_MODE is not defined` during static-path
// generation. This is the SAME bundler defect 03-01-SUMMARY.md documented for a frontmatter-
// local `slugify()` function (see that summary's Deviation #8) — not a new bug, a recurrence of
// an already-known one. The established fix there was the same one applied here: move the
// declaration into its own module and import it normally.
//
// `MEASURE_RENDER_COST` is set ONLY by `tools/measure-render-cost.mjs`'s own child `astro build`
// invocation — never by a developer, CI, or a normal `pnpm build`. Absent in every other case,
// so this module changes nothing about a normal build.

import { writeFileSync } from 'node:fs';

export interface HarnessSample {
  id: string;
  d1ReadMs: number;
  manifestBuildMs: number;
  manifestWriteMs: number;
  renderMs: number | null;
}

export const HARNESS_MODE: boolean = Boolean(process.env.MEASURE_RENDER_COST);

export const harnessSamples: HarnessSample[] = [];

let harnessExitRegistered = false;

/**
 * Registers a `process.on('exit')` handler (once) that writes `harnessSamples` to
 * `MEASURE_RENDER_COST_OUT` — the harness script's only channel out of the Astro build process.
 * Follows the same pattern `tools/assert-no-d1.mjs` already established in this repo for its own
 * whole-build "zero candidates" guard.
 */
export function registerHarnessExit(): void {
  if (harnessExitRegistered) return;
  harnessExitRegistered = true;
  process.on('exit', () => {
    const outPath = process.env.MEASURE_RENDER_COST_OUT;
    if (!outPath) return;
    try {
      writeFileSync(outPath, JSON.stringify(harnessSamples));
    } catch {
      // Best-effort — the harness script treats a missing/short output file as its own
      // failure and reports that, rather than this module swallowing a write error.
    }
  });
}
