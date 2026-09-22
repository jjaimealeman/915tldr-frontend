// OPS-05 / OPS-06 / T-03-07: the single build-time source of truth for the deployed build's
// identity. `/version.json` (src/pages/version.json.ts) and the public footer
// (src/layouts/Base.astro) both import these three constants — neither computes its own hash or
// timestamp. That is the whole point of this module: a hash from `git rev-parse` in a shallow CI
// checkout can name a commit that was never deployed, and a footer with its own `new Date()`
// call drifts from whatever `/version.json` reports for the same build. One resolution, read
// twice by two surfaces, is the only way they cannot disagree (tests/unit/build-stamp.test.mjs
// proves the two *emitted artifacts* agree, not just that both import this file).
//
// Resolution order (T-03-07 mitigation):
//   1. `WORKERS_CI_COMMIT_SHA` — Cloudflare Workers Builds' own injected variable. The platform
//      vouches for this value; it cannot be wrong about what it deployed.
//   2. `git rev-parse --short=7 HEAD` — ONLY when neither `CI` nor `WORKERS_CI` is set. A
//      shallow CI checkout can make this command return a hash that was never the deploy target,
//      so the fallback is refused the instant either CI marker is present, even though the git
//      command itself would still "succeed" and return *something*.
//   3. `'unknown'` — no source available. An unknown build must look unknown: never a
//      zero-filled, empty, or carried-over-from-last-build value.
//
// Honesty note (see 03-03-SUMMARY.md for how this was established): this project's own deploy
// path is local `wrangler deploy` from a developer machine, not git-connected Cloudflare
// Workers Builds CI — the account's two existing Workers (`915tldr`, `915tldr-dev`) both show
// zero build history against the Workers Builds API, and this app has no `.github/` directory
// and no configured git remote. So in this project's actual practice, path 2 (`local-git`) is
// what fires, and `hashSource: "local-git"` on a real deployed build means "the hash of whatever
// commit was checked out on the machine that ran `wrangler deploy`" — not a CI-attested value.
// Path 1 is implemented in full per the plan (and exercised by Task 2's test) so nothing has to
// change here if this account's deploy pipeline ever moves to Workers Builds.
import { execSync } from 'node:child_process';

export type BuildHashSource = 'workers-ci' | 'local-git' | 'unknown';

export interface ResolvedBuildHash {
  hash: string;
  source: BuildHashSource;
}

/**
 * Pure function so the resolution order is a testable contract, not a side effect buried inside
 * module evaluation. Exported per 03-03-PLAN.md Task 2's preferred approach — tests call this
 * directly with a synthetic env object rather than mutating `process.env` and re-importing a
 * cached module.
 */
export function resolveBuildHash(
  env: Record<string, string | undefined> = process.env
): ResolvedBuildHash {
  const workersCiSha = env.WORKERS_CI_COMMIT_SHA;
  if (workersCiSha) {
    return { hash: workersCiSha.slice(0, 7), source: 'workers-ci' };
  }

  // A shallow CI checkout's `git rev-parse` can name a commit that was never deployed. Refuse
  // the fallback entirely the moment either CI marker is present — do not attempt git first and
  // validate after; the shape of a bad shallow-clone hash is indistinguishable from a good one.
  const inCi = Boolean(env.CI) || Boolean(env.WORKERS_CI);
  if (inCi) {
    return { hash: 'unknown', source: 'unknown' };
  }

  try {
    const hash = execSync('git rev-parse --short=7 HEAD', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (/^[0-9a-f]{7}$/i.test(hash)) {
      return { hash, source: 'local-git' };
    }
    return { hash: 'unknown', source: 'unknown' };
  } catch {
    return { hash: 'unknown', source: 'unknown' };
  }
}

/**
 * Captured once at module evaluation. This module is imported by prerendered pages, so its
 * top-level code runs during `astro build` in Node, and this value is inlined into every
 * consumer's output — never recomputed by a consumer with its own `new Date()` call.
 */
export const BUILD_TIMESTAMP: string = new Date().toISOString();

const resolved = resolveBuildHash();

export const BUILD_HASH: string = resolved.hash;
export const BUILD_HASH_SOURCE: BuildHashSource = resolved.source;
