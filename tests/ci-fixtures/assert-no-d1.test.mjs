// D-06 permanent negative + control fixtures for tools/assert-no-d1.mjs (ARCH-02 / ARCH-03 /
// T-03-04 / T-03-06). Phase 2's CONT-06 defect is the precedent this file exists to prevent:
// 248 tests passed while 253 production rows violated the requirement, because a check existed
// but had silently stopped gating. A tool that exists is not a guard; a tool proven to reject a
// real violation, on every commit, is.
//
// Drives the REAL checker (`assertNoD1Plugin().buildEnd`) by importing it directly and invoking
// its `buildEnd` hook against a synthesised Rollup PluginContext stub (`getModuleIds` /
// `getModuleInfo` / `error`). The module graph fed to that stub is built by reading the ACTUAL
// import statements out of the fixture files on disk below (`buildGraph`) — not a hand-typed
// stand-in graph — so an edit to a fixture's own import line is reflected here automatically.
// Invoking the plugin hook directly (rather than shelling out to a full `astro build`) keeps
// this suite inside 03-VALIDATION.md's 90-second feedback ceiling; see 03-02-SUMMARY.md for the
// recorded decision not to fall back to a real build.
//
// Case 3 (the clean control) exists so a checker that rejected every input it was given could
// not pass this suite (T-03-06) — see 03-02-SUMMARY.md for the one-time manual inversion that
// confirms Case 3's PASS is caused by the clean import, not by the checker accepting everything.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assertNoD1Plugin } from '../../tools/assert-no-d1.mjs';

const FIXTURES_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(FIXTURES_DIR, '../..');

// Maps a fixture's physical filename to the synthetic project-relative module id Astro's real
// build would assign it. Necessary because these fixtures deliberately live outside `src/`
// (Action's own requirement: never reachable from a production build), so the checker's real
// path-matching (`src/pages/`, `src/islands/`) has to be modelled explicitly here rather than
// inferred from the fixtures' actual on-disk location under `tests/ci-fixtures/`.
const FIXTURE_ID_MAP = {
  'page-with-d1-import.astro': 'src/pages/page-with-d1-import.astro',
  'clean-page.astro': 'src/pages/clean-page.astro',
  'island-wrapper.astro': 'src/islands/island-wrapper.astro',
  'island-with-d1-import.vue': 'src/islands/island-with-d1-import.vue',
  'helper-reaching-d1.ts': 'src/lib/helper-reaching-d1.ts',
  'harmless-helper.ts': 'src/lib/harmless-helper.ts',
  // T-03-02a fixtures (Cases 5-6): prove the guard rejects a transitive reach into
  // `src/lib/server/kv-manifest.ts`, not only `d1-client.ts`.
  'page-with-kv-import.astro': 'src/pages/page-with-kv-import.astro',
  'island-wrapper-kv.astro': 'src/islands/island-wrapper-kv.astro',
  'island-with-kv-import.vue': 'src/islands/island-with-kv-import.vue',
  'helper-reaching-kv.ts': 'src/lib/helper-reaching-kv.ts',
  // T-04-26 (04-06) fixture: proves the guard's `ENTRYPOINT_EXACT_FILES` treatment of
  // `src/worker.ts` catches a transitive reach into the D1/KV chokepoint directory exactly like
  // any other entrypoint kind.
  'worker-with-kv-import.ts': 'src/worker.ts',
  // T-05-08 (05-02) fixture: proves the same Worker-entrypoint coverage extends to
  // `src/lib/server/r2-client.ts` — a module the guard was never specifically written for
  // (r2-client.ts postdates the directory-wide T-03-02a fix), demonstrating the guard's
  // whole-directory scope covers it automatically. Mapped to the same synthetic
  // `src/worker.ts` id as `worker-with-kv-import.ts` above — safe because each scenario builds
  // its own fresh module graph from its own seed file, never both at once.
  'worker-with-r2-import.ts': 'src/worker.ts',
};

function idFor(absPath) {
  const dir = path.dirname(absPath);
  const base = path.basename(absPath);
  if (dir === FIXTURES_DIR && FIXTURE_ID_MAP[base]) return FIXTURE_ID_MAP[base];
  return path.relative(REPO_ROOT, absPath).replaceAll('\\', '/');
}

/** Frontmatter of a `.astro` file (between the first two `---` fences), or a `.vue` file's
 * `<script>` block content, or a plain file's full source — the region real imports live in. */
function importableRegion(absPath) {
  const src = fs.readFileSync(absPath, 'utf8');
  if (absPath.endsWith('.astro')) {
    const parts = src.split('---');
    return parts.length >= 3 ? parts[1] : '';
  }
  if (absPath.endsWith('.vue')) {
    const match = src.match(/<script[^>]*>([\s\S]*?)<\/script>/);
    return match ? match[1] : '';
  }
  return src;
}

function resolveSpecifier(fromAbsPath, specifier) {
  const base = path.resolve(path.dirname(fromAbsPath), specifier);
  for (const candidate of [base, `${base}.ts`, `${base}.js`, `${base}.astro`, `${base}.vue`]) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`fixture graph: cannot resolve "${specifier}" imported from ${fromAbsPath}`);
}

/**
 * Builds a real module graph — `{ allIds, moduleInfo }`, shaped exactly like the surface
 * `assertNoD1Plugin()`'s `buildEnd` hook reads via a Rollup PluginContext (`getModuleIds()` /
 * `getModuleInfo(id).importedIds`) — by reading the real `import ... from '...'` statements out
 * of the fixture files on disk, starting from `seedFilenames` and following relative imports
 * transitively. A resolved import landing outside `tests/ci-fixtures/` (i.e. the real
 * `src/lib/server/d1-client.ts`) is recorded as a leaf and not parsed further — its own imports
 * are irrelevant to this suite, only its reachability is under test.
 */
function buildGraph(seedFilenames) {
  const moduleInfo = new Map();
  const stack = seedFilenames.map((f) => ({ absPath: path.join(FIXTURES_DIR, f) }));

  while (stack.length > 0) {
    const { absPath } = stack.pop();
    const id = idFor(absPath);
    if (moduleInfo.has(id)) continue;

    const insideFixtures = absPath.startsWith(FIXTURES_DIR + path.sep);
    if (!insideFixtures) {
      moduleInfo.set(id, { importedIds: [], dynamicallyImportedIds: [] });
      continue;
    }

    const region = importableRegion(absPath);
    const importedIds = [];
    const importRe = /from\s+['"](\.[^'"]+)['"]/g;
    let match;
    while ((match = importRe.exec(region))) {
      const resolvedAbs = resolveSpecifier(absPath, match[1]);
      importedIds.push(idFor(resolvedAbs));
      stack.push({ absPath: resolvedAbs });
    }
    moduleInfo.set(id, { importedIds, dynamicallyImportedIds: [] });
  }

  return { allIds: [...moduleInfo.keys()], moduleInfo };
}

class StubBuildError extends Error {}

/** Runs the real checker against an already-built `{ allIds, moduleInfo }` graph, capturing both
 * its `this.error(...)` message(s) and its `console.log` diagnostics (the entrypoint/candidate
 * count line), the same way a real Rollup build would surface them. Shared by both the
 * fixture-seeded scenarios (`runScenario`) and the real-repo-file scenario (`runRealGraphScenario`,
 * 04-06) below. */
function runAgainstGraph({ allIds, moduleInfo }) {
  const messages = [];
  const ctx = {
    getModuleIds: () => allIds,
    getModuleInfo: (id) => moduleInfo.get(id) ?? null,
    error(message) {
      messages.push(message);
      throw new StubBuildError(message);
    },
  };

  const originalLog = console.log;
  const logs = [];
  console.log = (...args) => logs.push(args.join(' '));

  let threw = false;
  try {
    assertNoD1Plugin().buildEnd.call(ctx);
  } catch (err) {
    if (!(err instanceof StubBuildError)) throw err;
    threw = true;
  } finally {
    console.log = originalLog;
  }

  return { threw, messages, logs };
}

/** Runs the real checker against the graph built from `seedFilenames` (fixture files, resolved
 * relative to `FIXTURES_DIR` and re-mapped to their synthetic project-relative id via
 * `FIXTURE_ID_MAP`). */
function runScenario(seedFilenames) {
  return runAgainstGraph(buildGraph(seedFilenames));
}

/**
 * 04-06 (T-04-26): builds a real module graph — same shape as `buildGraph` above, but seeded from
 * REAL project files by absolute path, with ids computed as their actual repo-relative path (no
 * `FIXTURE_ID_MAP` substitution). Used to prove the checker's behavior against the Worker's ACTUAL
 * import graph (`src/worker.ts` -> `src/lib/article-redirect.ts` -> `src/lib/article-url.ts`), not
 * a synthesized stand-in — an edit to any of those three files' own import lines is reflected here
 * automatically, the same non-staleness guarantee `buildGraph` gives the fixture-seeded cases.
 */
function buildRealGraph(seedAbsPaths) {
  const moduleInfo = new Map();
  const stack = seedAbsPaths.map((absPath) => ({ absPath }));

  while (stack.length > 0) {
    const { absPath } = stack.pop();
    const id = path.relative(REPO_ROOT, absPath).replaceAll('\\', '/');
    if (moduleInfo.has(id)) continue;

    const region = importableRegion(absPath);
    const importedIds = [];
    const importRe = /from\s+['"](\.[^'"]+)['"]/g;
    let match;
    while ((match = importRe.exec(region))) {
      const resolvedAbs = resolveSpecifier(absPath, match[1]);
      importedIds.push(path.relative(REPO_ROOT, resolvedAbs).replaceAll('\\', '/'));
      stack.push({ absPath: resolvedAbs });
    }
    moduleInfo.set(id, { importedIds, dynamicallyImportedIds: [] });
  }

  return { allIds: [...moduleInfo.keys()], moduleInfo };
}

function runRealGraphScenario(seedAbsPaths) {
  return runAgainstGraph(buildRealGraph(seedAbsPaths));
}

test('Case 1 (ARCH-02): a page-shaped fixture that reaches d1-client.ts transitively through a helper is rejected', () => {
  const { threw, messages, logs } = runScenario(['page-with-d1-import.astro']);
  assert.equal(threw, true, 'checker must reject a transitive page violation');
  const combined = messages.join('\n');
  assert.match(combined, /page-with-d1-import\.astro/, 'message must name the violating entrypoint');
  assert.match(combined, /d1-client\.ts/, 'message must name the forbidden module reached');
  assert.match(
    logs.join('\n'),
    /entrypoints found: [1-9]/,
    'non-vacuity: this fixture tree must match at least one entrypoint, not zero'
  );
});

test('Case 2 (ARCH-03): an island-shaped fixture that reaches d1-client.ts transitively through a .vue component is rejected', () => {
  const { threw, messages, logs } = runScenario(['island-wrapper.astro']);
  assert.equal(threw, true, 'checker must reject a transitive island violation');
  const combined = messages.join('\n');
  assert.match(
    combined,
    /island-with-d1-import\.vue/,
    'message must name the intermediate .vue file the violation crosses into (ARCH-03), not only the wrapper and the target'
  );
  assert.match(combined, /island-wrapper\.astro/, 'message must name the violating entrypoint');
  assert.match(combined, /d1-client\.ts/, 'message must name the forbidden module reached');
  assert.match(
    logs.join('\n'),
    /entrypoints found: [1-9]/,
    'non-vacuity: this fixture tree must match at least one entrypoint, not zero'
  );
});

test('Case 5 (T-03-02a): a page-shaped fixture that reaches kv-manifest.ts transitively through a helper is rejected', () => {
  // This is the exact shape the T-03-02a security audit found ACCEPTED before the fix — the
  // guard forbade only `src/lib/server/d1-client.ts` by exact filename, and `kv-manifest.ts`
  // lived outside `src/lib/server/` entirely at the time. Both conditions are now different
  // (the file moved under `src/lib/server/`, and the guard forbids the whole directory), and
  // this case proves it: it MUST be rejected, or this suite would repeat the exact silent-pass
  // failure mode D-06 exists to catch.
  const { threw, messages, logs } = runScenario(['page-with-kv-import.astro']);
  assert.equal(threw, true, 'checker must reject a transitive KV-module page violation');
  const combined = messages.join('\n');
  assert.match(combined, /page-with-kv-import\.astro/, 'message must name the violating entrypoint');
  assert.match(combined, /kv-manifest\.ts/, 'message must name the forbidden module reached');
  assert.match(
    logs.join('\n'),
    /entrypoints found: [1-9]/,
    'non-vacuity: this fixture tree must match at least one entrypoint, not zero'
  );
});

test('Case 6 (T-03-02a): an island-shaped fixture that reaches kv-manifest.ts transitively through a .vue component is rejected', () => {
  const { threw, messages, logs } = runScenario(['island-wrapper-kv.astro']);
  assert.equal(threw, true, 'checker must reject a transitive KV-module island violation');
  const combined = messages.join('\n');
  assert.match(
    combined,
    /island-with-kv-import\.vue/,
    'message must name the intermediate .vue file the violation crosses into, not only the wrapper and the target'
  );
  assert.match(combined, /island-wrapper-kv\.astro/, 'message must name the violating entrypoint');
  assert.match(combined, /kv-manifest\.ts/, 'message must name the forbidden module reached');
  assert.match(
    logs.join('\n'),
    /entrypoints found: [1-9]/,
    'non-vacuity: this fixture tree must match at least one entrypoint, not zero'
  );
});

test('Case 3 (control, T-03-06): a clean fixture that imports only a harmless helper is accepted', () => {
  const { threw, messages, logs } = runScenario(['clean-page.astro']);
  assert.equal(
    threw,
    false,
    'a clean tree must not be rejected — a checker that rejects everything must fail this case'
  );
  assert.deepEqual(messages, []);
  assert.match(
    logs.join('\n'),
    /entrypoints found: [1-9]/,
    'non-vacuity: even the clean control must match a non-zero entrypoint count — proving the ' +
      'checker walked something rather than trivially finding nothing to check'
  );
});

test('Case 4 (D-06 non-vacuity / A1 regression guard): a build matching zero page/island/middleware candidates fails loudly, never silently', () => {
  // Isolated child process, deliberately: `tools/assert-no-d1.mjs` accumulates its candidate
  // count in module-scope state across every `buildEnd` call in a process (03-01's own fix for
  // Astro's multi-pass build), so Cases 1-3 running earlier in THIS process would already have
  // pushed the cumulative total above zero. The zero-candidate guard can only be observed
  // correctly from a process that has never seen a real candidate.
  const assertModuleUrl = pathToFileURL(path.resolve(REPO_ROOT, 'tools/assert-no-d1.mjs')).href;
  const script = [
    `import { assertNoD1Plugin } from ${JSON.stringify(assertModuleUrl)};`,
    'const ctx = { getModuleIds: () => [], getModuleInfo: () => null, error: () => {} };',
    'assertNoD1Plugin().buildEnd.call(ctx);',
  ].join('\n');

  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    encoding: 'utf8',
  });

  assert.notEqual(
    result.status,
    0,
    'a build matching zero candidates across its entire run must exit non-zero, never pass silently'
  );
  assert.match(
    result.stderr,
    /matched zero candidate files/,
    'must fail with the explicit zero-candidate message, not a generic crash'
  );
});

// --- T-04-26 (04-06): the Worker entrypoint (src/worker.ts) is inside the guard's scope ---

test('Case 7 (T-04-26): a Worker-shaped fixture that reaches kv-manifest.ts transitively through a helper is rejected', () => {
  const { threw, messages, logs } = runScenario(['worker-with-kv-import.ts']);
  assert.equal(threw, true, 'checker must reject a transitive Worker-entrypoint violation');
  const combined = messages.join('\n');
  assert.match(combined, /src\/worker\.ts/, 'message must name the violating Worker entrypoint');
  assert.match(combined, /kv-manifest\.ts/, 'message must name the forbidden module reached');
  assert.match(
    logs.join('\n'),
    /entrypoints found: [1-9]/,
    'non-vacuity: this fixture tree must match at least one entrypoint, not zero'
  );
});

test('Case 9 (T-05-08): a Worker-shaped fixture that reaches r2-client.ts transitively through a helper is rejected', () => {
  const { threw, messages, logs } = runScenario(['worker-with-r2-import.ts']);
  assert.equal(threw, true, 'checker must reject a transitive reach into r2-client.ts');
  const combined = messages.join('\n');
  assert.match(combined, /src\/worker\.ts/, 'message must name the violating Worker entrypoint');
  assert.match(combined, /r2-client\.ts/, 'message must name the forbidden module reached');
  assert.match(
    logs.join('\n'),
    /entrypoints found: [1-9]/,
    'non-vacuity: this fixture tree must match at least one entrypoint, not zero'
  );
});

test('Case 8 (T-04-26, control): the REAL src/worker.ts -> article-redirect.ts -> article-url.ts graph is accepted', () => {
  // Drives the checker against the actual repository files (not a synthesized stand-in) — an
  // edit to any of these three files' own import lines is reflected here automatically, matching
  // 03-02's own "reads the ACTUAL import statements" guarantee for the fixture-seeded cases.
  const workerPath = path.resolve(REPO_ROOT, 'src/worker.ts');
  const { threw, messages, logs } = runRealGraphScenario([workerPath]);
  assert.equal(
    threw,
    false,
    `the real Worker's import graph must not be rejected: ${JSON.stringify(messages)}`
  );
  assert.deepEqual(messages, []);
  assert.match(
    logs.join('\n'),
    /entrypoints found: [1-9]/,
    'non-vacuity: the real src/worker.ts graph must match at least one entrypoint, not zero'
  );
});
