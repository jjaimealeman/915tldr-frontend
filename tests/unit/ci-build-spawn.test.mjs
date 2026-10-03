#!/usr/bin/env node
// Task 3 (quick 261002-s2r): the one file in this suite allowed to spawn a REAL process — proves
// `spawnTee`'s page-line filter against an actual child_process, not a fake. Deliberately spawns
// `process.execPath` (this machine's own node binary) running a short inline script via `-e`,
// keeping tests/unit/ci-build.test.mjs's own "never spawns a real process" invariant intact (that
// file only ever exercises `spawnTee` indirectly through injected fakes).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnTee } from '../../tools/ci-build.mjs';

const SCRIPT = `
process.stdout.write('normal line\\n');
process.stdout.write('00:07:06   ├─ /a.html (+1ms)\\n');
process.stdout.write('00:07:07   ├─ /b.html (+2ms)\\n');
process.stdout.write('00:07:08   ├─ /c.html (+3ms)\\n');
process.stdout.write('00:07:09   ├─ /d.html (+3ms) (file not created, response body was empty)\\n');
process.stderr.write('00:06:51 [WARN] [vite] something\\n');
process.exitCode = 3;
`;

test('S1: spawnTee with filterPageLines true preserves exit code, stderr, and the file-not-created notice, while suppressing plain page lines', async () => {
  let stdout = '';
  let stderr = '';
  const result = await spawnTee(process.execPath, ['-e', SCRIPT], {
    filterPageLines: true,
    writeStdout: (text) => {
      stdout += text;
    },
    writeStderr: (text) => {
      stderr += text;
    },
  });

  assert.equal(result.code, 3, 'the child\'s real exit code must survive filtering');
  assert.ok(stdout.includes('normal line\n'), 'a non-page stdout line must pass through verbatim');
  assert.ok(
    stdout.includes('(file not created, response body was empty)'),
    'a page line with extra trailing text must survive — it is not an exact page-line match'
  );
  assert.ok(!/├─ \/a\.html \(\+1ms\)/.test(stdout), 'a plain suppressed page line must not appear verbatim');
  assert.ok(!/├─ \/b\.html \(\+2ms\)/.test(stdout));
  assert.ok(!/├─ \/c\.html \(\+3ms\)\n/.test(stdout));
  assert.ok(
    stdout.includes('[ci-build] astro build: suppressed 3 per-page output lines (CI_BUILD_FULL_LOG=1 shows them)'),
    `expected the suppression summary line naming 3, got stdout: ${JSON.stringify(stdout)}`
  );
  assert.ok(stderr.includes('00:06:51 [WARN] [vite] something\n'), 'stderr must never be filtered');
  assert.ok(result.tail.includes('/a.html (+1ms)'), 'result.tail must still contain the raw page lines for classifyFailure');
});

test('S2: spawnTee with filterPageLines false echoes every page line and emits no astro-build summary line', async () => {
  let stdout = '';
  const result = await spawnTee(process.execPath, ['-e', SCRIPT], {
    filterPageLines: false,
    writeStdout: (text) => {
      stdout += text;
    },
    writeStderr: () => {},
  });

  assert.equal(result.code, 3);
  assert.ok(stdout.includes('/a.html (+1ms)'));
  assert.ok(stdout.includes('/b.html (+2ms)'));
  assert.ok(stdout.includes('/c.html (+3ms)'));
  assert.ok(!stdout.includes('[ci-build] astro build:'), 'no astro-build filter line may appear when filtering is off');
});
