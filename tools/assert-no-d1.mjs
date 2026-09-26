#!/usr/bin/env node
// ARCH-02 / ARCH-03 / D-05 / D-06: the D1-import assertion.
//
// Walks Astro's own resolved Rollup/Vite module graph — via `this.getModuleIds()` /
// `this.getModuleInfo(id).importedIds` / `.dynamicallyImportedIds`, from the `buildEnd` hook,
// where Rollup's own plugin-development docs guarantee those fields no longer change after
// `buildEnd` (rollupjs.org/plugin-development/) — from every public entrypoint (pages, islands,
// middleware) and fails the build (`this.error()`) if any entrypoint's transitive module graph
// reaches ANY module under `src/lib/server/` — the directory reserved for build-time-only,
// credential-holding code (D1 access via `d1-client.ts`, render-manifest KV access via
// `kv-manifest.ts`, and anything added there later) (Pattern 2, 03-RESEARCH.md).
//
// T-03-02a correction (security remediation, post-03-07): this guard originally forbade exactly
// one FILE by exact suffix match (`src/lib/server/d1-client.ts`), not the directory. An external
// security audit found that `src/lib/kv-manifest.ts` sat OUTSIDE `src/lib/server/` at the time,
// read `CLOUDFLARE_API_TOKEN` directly (four call sites), and was accepted by this guard when
// imported from a synthetic on-demand page/island fixture — the guard's own control case (an
// entrypoint importing `d1-client.ts`) was correctly rejected, proving the gap was the forbidden
// set's scope, not a broken walk. No production exposure existed at audit time (no real
// on-demand route or island imported it yet), but it would have opened silently with Phase 4's
// server islands. Fixed by (1) moving `kv-manifest.ts` to `src/lib/server/kv-manifest.ts` and
// (2) widening the forbidden target from one filename to the whole directory, so any future
// module placed there inherits the same structural protection without a guard edit.
//
// This is the structural enforcement behind PROJECT.md's "zero D1 reads on the public request
// path": a grep/AST scan of file trees cannot catch a *transitive* import through an
// intermediate helper module (D-05), and cannot distinguish a real import from a mention in a
// comment or docstring — this repo's own planning docs quote the forbidden path verbatim, which
// a naive grep would false-positive on.
//
// A matcher that matches zero entrypoints must fail loudly (`this.error`), never pass silently.
// That is the exact Phase 2 CONT-06 failure mode this project already shipped once: 248 tests
// passed while 253 production rows violated the requirement, because a check existed but had
// silently stopped gating. D-06's permanent CI fixtures (03-02, extended by T-03-02a) exist to
// keep this guard honest on every commit, not just once.
//
// KNOWN LIMITATION (flagged by the same audit, not fixed here — recorded for Phase 4): the
// page-exemption check (`isPrerenderExempt` below) fails OPEN — a `.astro` page is treated as
// prerendered (and therefore exempt) unless it contains the literal text
// `export const prerender = false`. A page that sets `prerender = false` through any other
// mechanism (a spread config object, a re-exported constant, a future Astro API) would be
// silently exempted rather than checked. Phase 4, which introduces real on-demand pages, should
// re-examine this before relying on it further.

import fs from 'node:fs';

const FORBIDDEN_TARGET_DIR = 'src/lib/server/';

// ARCH-03: island component files are in scope, not only `.astro` pages — islands compile from
// ordinary `.vue`/`.astro` wrapper files into server-rendered endpoints, so a page-only scan
// would miss them entirely.
const ENTRYPOINT_DIR_PREFIXES = ['src/pages/', 'src/islands/'];
const ENTRYPOINT_EXACT_FILES = ['src/middleware.ts'];
const ENTRYPOINT_EXTENSIONS = ['.astro', '.vue', '.ts', '.js'];

// A1 finding (proven against a real Astro 7.3.3 build, 03-01 tracer task): a page under
// `src/pages/**` that is prerendered (the `output: 'static'` default — no
// `export const prerender = false`) legitimately reaches `d1-client.ts` from its own
// frontmatter/`getStaticPaths`, because that code runs once, at build time, in Node, and is
// NEVER bundled into the deployed Worker (Pattern 2, 03-RESEARCH.md). A blanket "every page
// under src/pages/** is forbidden" check — the plan's Pattern 1 skeleton read literally — was
// tried first and produced a false positive against this tracer's own prerendered article page.
// The Pattern 1 skeleton's own prose already anticipated this ("every `.astro` file under
// `src/pages/**` **not exporting `prerender = true`**"); this constant implements that carve-out
// by reading the source file directly (simpler and more robust here than inspecting bundler
// internals) rather than trusting a module-graph signal that doesn't distinguish build-time-only
// code from Worker-bundled code. Islands and middleware get no such exemption — they are always
// on-demand by construction.
const PRERENDER_EXEMPT_SIGNAL = /export\s+const\s+prerender\s*=\s*false/;

function isPrerenderExempt(normalizedId) {
  if (!normalizedId.includes('/src/pages/') && !normalizedId.startsWith('src/pages/')) return false;
  if (!normalizedId.endsWith('.astro')) return false;
  try {
    const source = fs.readFileSync(normalizedId, 'utf8');
    // Prerendered (no explicit `prerender = false`) => exempt, its D1 access is build-time-only.
    return !PRERENDER_EXEMPT_SIGNAL.test(source);
  } catch {
    // File unreadable (already virtual/compiled id) — do not exempt; fail safe by keeping it
    // in the entrypoint set rather than silently excluding an unrecognised id.
    return false;
  }
}

/**
 * Astro's resolved module ids carry virtual-module null-byte prefixes (`\0virtual:...`) and
 * Vite query suffixes (`?astro&type=script&index=0&lang.ts`) that a raw path comparison would
 * miss — this is 03-RESEARCH.md's assumption A1, the single most likely thing to be wrong here.
 * Normalise before every comparison: strip the leading null byte and everything from the first
 * `?` onward, and use forward slashes regardless of platform.
 */
export function normalizeId(id) {
  if (!id) return '';
  let normalized = id.startsWith('\0') ? id.slice(1) : id;
  const queryIndex = normalized.indexOf('?');
  if (queryIndex !== -1) normalized = normalized.slice(0, queryIndex);
  return normalized.replaceAll('\\', '/');
}

/**
 * A "candidate" is any module id that structurally lives where a public entrypoint could live
 * (path + extension match), with NO prerender exemption applied. This is the set the
 * zero-matches fail-loud check runs against (D-06) — it answers "did the path/extension matcher
 * find anything at all", which is the failure mode a broken glob/path check produces. It is
 * deliberately a different, larger set than `isEntrypoint` below.
 */
export function isCandidate(normalizedId) {
  if (!ENTRYPOINT_EXTENSIONS.some((ext) => normalizedId.endsWith(ext))) return false;
  if (ENTRYPOINT_EXACT_FILES.some((file) => normalizedId.endsWith(file))) return true;
  return ENTRYPOINT_DIR_PREFIXES.some(
    (prefix) => normalizedId.includes(`/${prefix}`) || normalizedId.startsWith(prefix)
  );
}

/**
 * A "checked" entrypoint is a candidate that is NOT prerender-exempt — i.e. the module graph
 * this file's D1-import walk actually runs from. A tracer/project with only prerendered pages
 * and no islands/middleware/non-prerendered routes yet can legitimately have zero of these
 * while still having candidates > 0 — that is not a broken matcher, it means nothing dangerous
 * exists yet. See `isCandidate` above for the distinction the zero-matches check relies on.
 */
export function isEntrypoint(normalizedId) {
  if (!isCandidate(normalizedId)) return false;
  return !isPrerenderExempt(normalizedId);
}

// T-03-02a: forbids the whole directory, not one filename — mirrors `isCandidate`'s own
// path-matching shape (`/${dir}` mid-path OR a leading match) so a module reached via an
// absolute Rollup module id or a project-relative one is caught identically.
export function isForbidden(normalizedId) {
  return (
    normalizedId.includes(`/${FORBIDDEN_TARGET_DIR}`) || normalizedId.startsWith(FORBIDDEN_TARGET_DIR)
  );
}

export const FORBIDDEN_TARGET = FORBIDDEN_TARGET_DIR;
export const ENTRYPOINTS = { ENTRYPOINT_DIR_PREFIXES, ENTRYPOINT_EXACT_FILES };

// A2 finding (proven against a real Astro 7.3.3 + @astrojs/cloudflare build, 03-01 tracer
// task): `astro build` runs this plugin across MULTIPLE separate Rollup/rolldown build passes
// internally (observed here: an initial empty pass, the "Building static entrypoints" pass that
// prerenders pages, and a further Cloudflare-adapter worker-entry pass) — each with its own
// module universe. A page under `src/pages/**` is only a candidate in the pass that actually
// touches it; the Cloudflare adapter's own worker-entry bundling pass legitimately has ZERO
// page-shaped candidates in a project with no islands/middleware/non-prerendered routes yet.
// A per-pass "zero candidates = broken matcher" check is therefore wrong for a multi-pass build
// — it would fail a build that is working correctly. The zero-matches protection (D-06) instead
// accumulates candidates across every pass of the whole `astro build` process and only fails if
// the TOTAL across the entire run is zero, via a `process.on('exit')` guard, since Rollup gives
// no hook that fires only once after the last internal pass.
let totalCandidatesSeenAcrossBuild = 0;
let zeroCandidateGuardRegistered = false;

function registerZeroCandidateGuard() {
  if (zeroCandidateGuardRegistered) return;
  zeroCandidateGuardRegistered = true;
  process.on('exit', () => {
    if (totalCandidatesSeenAcrossBuild === 0) {
      // eslint-disable-next-line no-console
      console.error(
        '[assert-no-d1] matched zero candidate files under src/pages/**, src/islands/**, or ' +
          'src/middleware.ts across the ENTIRE build (all internal passes) — the matcher is ' +
          'broken, not necessarily the codebase. A guard that matches nothing must fail the ' +
          'build, never pass silently (D-06 / the Phase 2 CONT-06 failure mode).'
      );
      process.exitCode = 1;
    }
  });
}

/**
 * Returns a Vite/Rollup plugin. Register it via `vite.plugins` in `astro.config.mjs` so it runs
 * inside `astro build`'s own Rollup pipeline (ARCH-02).
 */
export function assertNoD1Plugin() {
  return {
    name: 'assert-no-d1-import',
    buildEnd() {
      const allIds = this.getModuleIds ? [...this.getModuleIds()] : [];
      const candidates = allIds.filter((id) => isCandidate(normalizeId(id)));
      const entrypoints = allIds.filter((id) => isEntrypoint(normalizeId(id)));

      totalCandidatesSeenAcrossBuild += candidates.length;
      registerZeroCandidateGuard();

      // eslint-disable-next-line no-console
      console.log(
        `[assert-no-d1] entrypoints found: ${entrypoints.length} (candidates: ${candidates.length}, ` +
          `${candidates.length - entrypoints.length} prerender-exempt)`
      );

      for (const entry of entrypoints) {
        const seen = new Set();
        // 03-02 D-06 finding: the original message named only the entry and the terminal
        // forbidden module, which is silent about *how* the two connect. For an ARCH-03
        // island violation the interesting fact is which intermediate `.vue`/`.ts` file the
        // walk passed through to get there — that's exactly the boundary-crossing coverage
        // ARCH-03 exists to prove, and 03-02's permanent fixture suite asserts the reported
        // message names that intermediate file, not just the two endpoints. `parent` records
        // the first discovery edge for each id so the full chain can be reconstructed once a
        // forbidden id is reached.
        const parent = new Map();
        const queue = [entry];
        while (queue.length > 0) {
          const id = queue.pop();
          if (seen.has(id)) continue;
          seen.add(id);

          if (isForbidden(normalizeId(id))) {
            const chain = [id];
            let cursor = id;
            while (parent.has(cursor)) {
              cursor = parent.get(cursor);
              chain.unshift(cursor);
            }
            this.error(
              `[assert-no-d1] D1-import assertion violated: public entrypoint "${entry}" ` +
                `reaches ${chain[chain.length - 1]} — forbidden: any module under ` +
                `${FORBIDDEN_TARGET_DIR} — via ${chain.join(' -> ')}. Public entrypoints must ` +
                'never reach a module under the D1/KV chokepoint directory ' +
                '(ARCH-02 / ARCH-03 / D-05 / T-03-02a).'
            );
            return;
          }

          const info = this.getModuleInfo(id);
          if (!info) continue;
          for (const next of [...(info.importedIds ?? []), ...(info.dynamicallyImportedIds ?? [])]) {
            if (!seen.has(next) && !parent.has(next)) parent.set(next, id);
            queue.push(next);
          }
        }
      }
    },
  };
}
