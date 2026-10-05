#!/usr/bin/env node
// CR-02 (05-20): pins assertArchiveSynced's five cases — (1) no plan, empty/absent dist/archive
// -> ok; (2) no plan but a stray file under dist/archive -> refuse, naming the file; (3) plan
// present, marker missing -> refuse ("archive-sync pre has not run"); (4) marker's
// planGeneratedAt doesn't match the plan's generatedAt -> refuse ("stale"); (5) a matching marker
// -> ok — plus the real round trip against `runPreSync` (marker written on success, never on the
// plan-missing exit-1 path). No real R2 access here (a zero-entry fake store is enough to prove
// the marker is written and the guard reads it); the live-tree proof against this repo's actual
// CR-02 state happens in 05-20-PLAN.md Task 1's own <action>, not in this file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

import { assertArchiveSynced } from '../../tools/assert-archive-synced.mjs';
import { ARCHIVE_SYNCED_MARKER_PATH, runPreSync } from '../../tools/archive-sync.mjs';

function makeRoot() {
  return mkdtempSync(join(tmpdir(), 'assert-archive-synced-test-'));
}

function withRoot(fn) {
  const root = makeRoot();
  return Promise.resolve()
    .then(() => fn(root))
    .finally(() => rmSync(root, { recursive: true, force: true }));
}

function writePlan(root, overrides = {}) {
  const plan = { version: 1, generatedAt: '2026-10-02T00:00:00.000Z', entries: [], ...overrides };
  mkdirSync(join(root, 'dist'), { recursive: true });
  writeFileSync(join(root, 'dist', 'archive-plan.json'), JSON.stringify(plan));
  return plan;
}

function writeMarker(root, overrides = {}) {
  const marker = {
    planGeneratedAt: '2026-10-02T00:00:00.000Z',
    syncedAt: '2026-10-02T00:05:00.000Z',
    phase: 'pre',
    ...overrides,
  };
  const abs = join(root, ARCHIVE_SYNCED_MARKER_PATH);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, JSON.stringify(marker));
  return marker;
}

function writeStrayArchiveFile(root, relKey = 'articles/stray-uuid.html') {
  const abs = join(root, 'dist', 'archive', relKey);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, '<html>stray</html>');
}

// ---------------------------------------------------------------------------
// Case 1: no plan, empty/absent dist/archive -> ok
// ---------------------------------------------------------------------------

test('assert-archive-synced: case 1a — no plan at all, dist/archive absent entirely -> ok', () =>
  withRoot((root) => {
    const result = assertArchiveSynced({ root });
    assert.equal(result.ok, true);
  }));

test('assert-archive-synced: case 1b — no plan, dist/archive exists but is empty -> ok', () =>
  withRoot((root) => {
    mkdirSync(join(root, 'dist', 'archive'), { recursive: true });
    const result = assertArchiveSynced({ root });
    assert.equal(result.ok, true);
  }));

// ---------------------------------------------------------------------------
// Case 2: no plan, but a file exists under dist/archive -> refuse, naming it
// ---------------------------------------------------------------------------

test('assert-archive-synced: case 2 — no plan but a stray file under dist/archive -> throws naming the stray file', () =>
  withRoot((root) => {
    writeStrayArchiveFile(root, 'articles/stray-uuid.html');
    assert.throws(
      () => assertArchiveSynced({ root }),
      (err) => {
        assert.match(err.message, /^assert-archive-synced:/);
        assert.match(err.message, /stray-uuid\.html/);
        return true;
      }
    );
  }));

// ---------------------------------------------------------------------------
// Case 3: plan present, marker missing -> refuse "archive-sync pre has not run"
// ---------------------------------------------------------------------------

test('assert-archive-synced: case 3 — plan present, marker missing -> throws "archive-sync pre has not run"', () =>
  withRoot((root) => {
    writePlan(root);
    assert.throws(
      () => assertArchiveSynced({ root }),
      (err) => {
        assert.match(err.message, /^assert-archive-synced:/);
        assert.match(err.message, /archive-sync pre has not run/);
        return true;
      }
    );
  }));

// ---------------------------------------------------------------------------
// Case 4: marker from an earlier plan (generatedAt mismatch) -> refuse "stale"
// ---------------------------------------------------------------------------

test('assert-archive-synced: case 4 — marker from an earlier plan (generatedAt mismatch) -> throws "stale"', () =>
  withRoot((root) => {
    writePlan(root, { generatedAt: '2026-10-02T12:00:00.000Z' });
    writeMarker(root, { planGeneratedAt: '2026-10-01T00:00:00.000Z' });
    assert.throws(
      () => assertArchiveSynced({ root }),
      (err) => {
        assert.match(err.message, /^assert-archive-synced:/);
        assert.match(err.message, /stale/);
        return true;
      }
    );
  }));

// ---------------------------------------------------------------------------
// Case 5: matching marker -> ok
// ---------------------------------------------------------------------------

test('assert-archive-synced: case 5 — marker generatedAt matches the plan -> ok', () =>
  withRoot((root) => {
    const plan = writePlan(root, { generatedAt: '2026-10-02T09:00:00.000Z' });
    writeMarker(root, { planGeneratedAt: plan.generatedAt });
    const result = assertArchiveSynced({ root });
    assert.equal(result.ok, true);
  }));

// ---------------------------------------------------------------------------
// End to end: the guard refuses before pre runs, and passes immediately after;
// the plan-missing (exit 1) path never writes a marker.
// ---------------------------------------------------------------------------

function makeFakeStore() {
  const objects = new Map();
  return {
    async putObject(key, body, opts) {
      objects.set(key, { body, contentType: opts.contentType, sha256: opts.sha256 });
    },
    async headObject() {
      return null;
    },
    async getText() {
      return null;
    },
    async getJson(key) {
      const o = objects.get(key);
      return o ? JSON.parse(String(o.body)) : null;
    },
    async putJson(key, value) {
      objects.set(key, { body: JSON.stringify(value) });
    },
    async deleteObjects(keys) {
      return { deleted: 0, errors: keys.map((key) => ({ key, code: 'NoSuchKey' })) };
    },
    async listKeys() {
      return [];
    },
  };
}

test('assert-archive-synced + runPreSync: the guard refuses before pre runs, and passes immediately after', async () => {
  await withRoot(async (root) => {
    writePlan(root, { generatedAt: '2026-10-02T15:00:00.000Z', entries: [] });

    assert.throws(() => assertArchiveSynced({ root }), /archive-sync pre has not run/);

    const store = makeFakeStore();
    const { exitCode } = await runPreSync({
      root,
      env: {},
      hasR2CredentialsFn: async () => true,
      createStore: async () => store,
    });
    assert.equal(exitCode, 0);

    const result = assertArchiveSynced({ root });
    assert.equal(result.ok, true);
    assert.ok(existsSync(join(root, ARCHIVE_SYNCED_MARKER_PATH)));
  });
});

test('assert-archive-synced + runPreSync: the plan-missing (exit 1) path never writes a marker', async () => {
  await withRoot(async (root) => {
    const store = makeFakeStore();
    const { exitCode } = await runPreSync({
      root,
      env: {},
      hasR2CredentialsFn: async () => true,
      createStore: async () => store,
    });
    assert.equal(exitCode, 1);
    assert.equal(existsSync(join(root, ARCHIVE_SYNCED_MARKER_PATH)), false);
  });
});
