// 05-06 Task 2: pins REND-11/D-13's boundary thresholds and countStaticFiles's superset-counting
// contract — temp-directory fixtures throughout (`fs.mkdtempSync` under the OS temp dir, matching
// tests/unit/derive-hot-window.test.mjs's own convention), never the real dist/client or clock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  FILE_COUNT_FAIL_THRESHOLD,
  FILE_COUNT_WARN_THRESHOLD,
  STATIC_ASSET_CEILING,
  STATIC_BUDGET_FILE,
  countStaticFiles,
  evaluateFileCount,
  assertFileCount,
} from '../../tools/assert-file-count.mjs';

function tempDistDir() {
  return mkdtempSync(path.join(tmpdir(), 'assert-file-count-test-'));
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

test('constants: FILE_COUNT_FAIL_THRESHOLD/FILE_COUNT_WARN_THRESHOLD/STATIC_ASSET_CEILING are the pinned values', () => {
  assert.equal(FILE_COUNT_FAIL_THRESHOLD, 80_000);
  assert.equal(FILE_COUNT_WARN_THRESHOLD, 70_000);
  assert.equal(STATIC_ASSET_CEILING, 100_000);
  assert.equal(STATIC_BUDGET_FILE, 'static-budget.json');
});

// ---------------------------------------------------------------------------
// evaluateFileCount boundaries
// ---------------------------------------------------------------------------

test('evaluateFileCount: 69999 is ok', () => {
  assert.equal(evaluateFileCount(69999).status, 'ok');
});

test('evaluateFileCount: 70000 is warn', () => {
  assert.equal(evaluateFileCount(70000).status, 'warn');
});

test('evaluateFileCount: 79999 is warn', () => {
  assert.equal(evaluateFileCount(79999).status, 'warn');
});

test('evaluateFileCount: 80000 is fail', () => {
  assert.equal(evaluateFileCount(80000).status, 'fail');
});

test('evaluateFileCount: 0 is fail with reason "zero files counted — broken check"', () => {
  const result = evaluateFileCount(0);
  assert.equal(result.status, 'fail');
  assert.equal(result.reason, 'zero files counted — broken check');
});

test('evaluateFileCount: throws on a negative or non-integer count', () => {
  assert.throws(() => evaluateFileCount(-1), /assert-file-count:/);
  assert.throws(() => evaluateFileCount(1.5), /assert-file-count:/);
  assert.throws(() => evaluateFileCount('80000'), /assert-file-count:/);
});

// ---------------------------------------------------------------------------
// countStaticFiles
// ---------------------------------------------------------------------------

test('countStaticFiles: counts every regular file in a nested tree, including dotfiles, ignoring directories', () => {
  const dir = tempDistDir();
  try {
    mkdirSync(path.join(dir, 'crime'), { recursive: true });
    mkdirSync(path.join(dir, 'tag', 'nested'), { recursive: true });
    writeFileSync(path.join(dir, 'index.html'), 'x');
    writeFileSync(path.join(dir, '.hidden'), 'x');
    writeFileSync(path.join(dir, 'crime', 'a.html'), 'x');
    writeFileSync(path.join(dir, 'tag', 'nested', 'b.html'), 'x');

    // 6 files total: index.html, .hidden, crime/a.html, tag/nested/b.html = 4 files, plus the
    // two empty directories (crime, tag, tag/nested) contribute 0 — directories are never
    // counted. Recount explicitly: 4 files.
    assert.equal(countStaticFiles(dir), 4);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('countStaticFiles: a missing directory counts as zero', () => {
  assert.equal(countStaticFiles(path.join(tmpdir(), 'assert-file-count-does-not-exist-xyz')), 0);
});

// ---------------------------------------------------------------------------
// assertFileCount: writes static-budget.json, recounts, staticFileCount includes itself
// ---------------------------------------------------------------------------

test('assertFileCount: staticFileCount includes static-budget.json itself and matches the post-write recount', () => {
  const dir = tempDistDir();
  try {
    writeFileSync(path.join(dir, 'index.html'), 'x');
    writeFileSync(path.join(dir, 'about.html'), 'x');

    const { count, budget } = assertFileCount({ root: dir, distClientDir: '.' });

    // 2 real files + static-budget.json itself = 3.
    assert.equal(count, 3);
    assert.equal(budget.staticFileCount, 3);

    const onDisk = JSON.parse(readFileSync(path.join(dir, 'static-budget.json'), 'utf8'));
    assert.equal(onDisk.staticFileCount, 3);
    assert.equal(countStaticFiles(dir), 3);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('assertFileCount: records the evaluation status and the ceiling/threshold fields', () => {
  const dir = tempDistDir();
  try {
    for (let i = 0; i < 5; i += 1) {
      writeFileSync(path.join(dir, `page-${i}.html`), 'x');
    }
    const { evaluation, budget } = assertFileCount({ root: dir, distClientDir: '.' });
    assert.equal(evaluation.status, 'ok');
    assert.equal(budget.ceiling, STATIC_ASSET_CEILING);
    assert.equal(budget.failAt, FILE_COUNT_FAIL_THRESHOLD);
    assert.equal(budget.warnAt, FILE_COUNT_WARN_THRESHOLD);
    assert.equal(budget.status, 'ok');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('assertFileCount: throws when a forced post-write mismatch occurs (a concurrent write landed in dist/client)', () => {
  const dir = tempDistDir();
  try {
    writeFileSync(path.join(dir, 'index.html'), 'x');
    assert.throws(
      () =>
        assertFileCount({
          root: dir,
          distClientDir: '.',
          afterWriteForTest: (distAbs) => writeFileSync(path.join(distAbs, 'concurrent.html'), 'x'),
        }),
      /assert-file-count:.*recount/
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('assertFileCount: passes archivedPages and hotWindow through unchanged onto the written budget', () => {
  const dir = tempDistDir();
  try {
    writeFileSync(path.join(dir, 'index.html'), 'x');
    const archivedPages = { articles: 10, tags: 2 };
    const hotWindow = { status: 'derived', days: 202 };
    const { budget } = assertFileCount({ root: dir, distClientDir: '.', archivedPages, hotWindow });
    assert.deepEqual(budget.archivedPages, archivedPages);
    assert.deepEqual(budget.hotWindow, hotWindow);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
