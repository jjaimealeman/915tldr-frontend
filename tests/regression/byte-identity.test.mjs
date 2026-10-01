#!/usr/bin/env node
// REND-05/criterion 3 (04-11): two consecutive `pnpm run build` runs against the SAME commit and
// (in the overwhelmingly common case) the SAME live production D1 data must leave every
// unchanged article's rendered HTML byte-identical — whether or not `experimental.incrementalBuild`
// is on (04-11 turned it ON by default; docs/phase-04/build-pipeline-decision.md). This is a REAL
// end-to-end replay (two real `astro build` invocations against real production D1/KV), not a
// synthetic fixture — matching this project's established pattern for regression tests that
// replay a real historical/measured risk (see tests/regression/changelog-empty-state.test.mjs
// Section 2).
//
// Live production D1 changes continuously (the ingest cron runs every 2 hours, ~15
// articles/cycle mean per docs/phase-03/render-step-location.md) — the two builds below are
// typically only a couple of minutes apart, so a genuine mid-test ingest is possible but rare.
// This test does not assume zero drift: it parses each build's own
// `[d1-articles] mode=... changed=N` log line (the loader's own accounting of what changed) and
// tolerates AT MOST as many changed article files as `changed` newly-touched articles could
// explain, INCLUDING their rail neighbours — an article whose own digest is unchanged can still
// re-render if a neighbour listed in its "More in <Category>" / "Earlier" rail (src/lib/rail.ts,
// computeRails()'s own moreCount=3/secondCount=5 defaults) changed, since railFingerprint() folds
// each neighbour's title/slug/category/publishedAt into this article's own cacheKey
// (src/pages/[category]/[slug].astro). Each newly-changed/added article can therefore force at
// most itself + up to 3 same-category "more" listers + up to 5 site-wide "second" listers = 9
// article files to differ.
//
// KNOWN APPROXIMATION (disclosed in 04-11-SUMMARY.md): the loader logs only a COUNT of changed
// articles, not their ids, so this test cannot verify the EXACT set of files expected to differ —
// only that the NUMBER of differing article files stays within what that count could possibly
// explain via rail fan-out. If `changed=0` on the second build (the expected steady-state case,
// and the only case this test can check exactly), the bound collapses to 0: every article file
// must be byte-identical, no tolerance.
//
// Both builds in this test check out the SAME commit (no push happens mid-test), so the footer's
// BUILD_HASH (src/lib/build-info.ts) is identical across both snapshots regardless of the
// unrelated, separately-tracked footer-stamp finding recorded in
// docs/phase-04/build-pipeline-decision.md's "Out of scope for this plan" section — this test
// does not need to strip or account for that field.
//
// 05-06 (Task 3, REND-07): the regression now covers BOTH tiers. `tools/compare-builds.mjs`'s
// `snapshot()` walks `dist/archive` as well as `dist/client` (prefixed `archive/`), and its
// `isArticleFile` counts an archived article file the same as a static one — so an archive-tier
// page that changed without a corresponding `changed=N` from the loader fails this test exactly
// the same way a static one would. The bound below (`changedB * RAIL_FANOUT`) therefore applies
// identically regardless of which tier a changed article page lives in.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { snapshot, diff } from '../../tools/compare-builds.mjs';

const REPO_ROOT = new URL('../..', import.meta.url).pathname;
// Comfortably above every measured warm/cold build in docs/phase-04/build-measurements.md
// (slowest local figure: ~65s cold; slowest real Workers Builds figure: 649s).
const BUILD_TIMEOUT_MS = 300_000;

// src/lib/rail.ts's own computeRails() defaults — kept as plain numbers here (not imported) so
// this test has no runtime dependency on a .ts module. If rail.ts's defaults ever change, this
// bound must be updated too (see this file's own top comment).
const RAIL_MORE_COUNT = 3;
const RAIL_SECOND_COUNT = 5;
const RAIL_FANOUT = 1 + RAIL_MORE_COUNT + RAIL_SECOND_COUNT; // itself + every rail slot that could list it

// A full build logs one line per generated page (~60,000 pages, including a "(restored)"/timing
// suffix per tag/article route) — comfortably over Node's execFileSync default maxBuffer (1MB),
// which crashes with ENOBUFS rather than truncating. 256MB is a generous ceiling, not a tuned
// figure — this build's own real stdout size (measured empirically) is well under it.
const MAX_BUFFER_BYTES = 256 * 1024 * 1024;

function runBuild() {
  return execFileSync('pnpm', ['run', 'build'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: BUILD_TIMEOUT_MS,
    maxBuffer: MAX_BUFFER_BYTES,
  });
}

/** Parses the D1 articles loader's own summary line — e.g.
 * `[d1-articles] mode=warm public=40449 changed=0 removed=0 explained=0 rowsRead=5928 budget=25000`
 * — and returns the `changed` count. Throws if the line is missing (the loader always logs
 * exactly one such line per successful build; its absence means the build did not reach the
 * loader at all, a build failure this test should surface loudly rather than swallow). */
function parseChangedCount(buildOutput) {
  const match = buildOutput.match(/\[d1-articles]\s+mode=\S+\s+public=\d+\s+changed=(\d+)/);
  assert.ok(match, 'expected a "[d1-articles] mode=... changed=N" line in build output');
  return Number(match[1]);
}

test('criterion 3: two consecutive builds leave unchanged articles byte-identical', async () => {
  const outputA = runBuild();
  parseChangedCount(outputA); // sanity check: the loader ran on build A too
  await snapshot('byte-identity-a');

  const outputB = runBuild();
  const changedB = parseChangedCount(outputB);
  await snapshot('byte-identity-b');

  const result = await diff('byte-identity-a', 'byte-identity-b');
  const bound = changedB * RAIL_FANOUT;

  assert.ok(
    result.article.changed <= bound,
    `unexplained article byte differences: ${result.article.changed} article file(s) changed, ` +
      `but the second build's loader reported changed=${changedB} (bound: ${bound} = ${changedB} x ` +
      `rail fan-out of ${RAIL_FANOUT}). Changed paths: ${result.article.changedPaths.join(', ')}` +
      (result.article.changedPathsTruncated ? ' (truncated to first 20)' : '')
  );
});
