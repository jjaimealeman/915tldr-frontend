// 05-07 Task 2: pins every must_haves/behavior bullet for the pre/post archive-sync phases
// against a fake store (in-memory, implementing src/lib/server/r2-client.ts's ArchiveStore
// surface) and temp dist directories — no real R2 access in this file (that's Tasks 1/3's live
// tracer runs, against the real bucket).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';

import {
  ARCHIVE_INDEX_KEY,
  ARCHIVE_STATE_KEY,
  FORCE_FULL_KEY,
  DAILY_REPORT_KEY,
  BACKLOG_ALERT_HOURS,
  diffAgainstIndex,
  runPreSync,
  runPostSync,
  requestFullReupload,
  isR2WriteBlocked,
  wrapStoreForBranchGuard,
  checkLiveDeployment,
} from '../../tools/archive-sync.mjs';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function sha256Of(body) {
  return createHash('sha256').update(body).digest('hex');
}

/** In-memory fake implementing the same call surface as `src/lib/server/r2-client.ts`'s
 * `ArchiveStore`. `failPutKeys`/`failGetJsonKeys` let a test force a specific key to reject,
 * matching the real client's own per-key failure shape. `calls` records every method
 * invocation (name + first arg) so a test can assert "no R2 calls made" when a guard should
 * have short-circuited before the store was ever touched. */
function makeFakeStore({
  seed = {},
  failPutKeys = new Set(),
  failGetJsonKeys = new Set(),
  failDeleteObjects = false,
} = {}) {
  const objects = new Map(Object.entries(seed));
  const calls = [];
  return {
    objects,
    calls,
    async putObject(key, body, opts) {
      calls.push(['putObject', key]);
      if (failPutKeys.has(key)) throw new Error(`fake putObject failure for ${key}`);
      objects.set(key, { body, contentType: opts.contentType, sha256: opts.sha256 });
    },
    async headObject(key) {
      calls.push(['headObject', key]);
      const o = objects.get(key);
      if (!o) return null;
      return { sha256: o.sha256 ?? null, size: Buffer.byteLength(o.body ?? ''), etag: '"fake-etag"' };
    },
    async getText(key) {
      calls.push(['getText', key]);
      const o = objects.get(key);
      return o ? String(o.body) : null;
    },
    async getJson(key) {
      calls.push(['getJson', key]);
      if (failGetJsonKeys.has(key)) throw new Error(`fake getJson failure for ${key}`);
      const o = objects.get(key);
      if (!o) return null;
      return JSON.parse(String(o.body));
    },
    async putJson(key, value) {
      calls.push(['putJson', key]);
      if (failPutKeys.has(key)) throw new Error(`fake putJson failure for ${key}`);
      objects.set(key, { body: JSON.stringify(value) });
    },
    async deleteObjects(keys) {
      calls.push(['deleteObjects', keys]);
      if (failDeleteObjects) throw new Error('fake deleteObjects failure');
      let deleted = 0;
      const errors = [];
      for (const key of keys) {
        if (objects.has(key)) {
          objects.delete(key);
          deleted += 1;
        } else {
          errors.push({ key, code: 'NoSuchKey' });
        }
      }
      return { deleted, errors };
    },
    async listKeys(prefix) {
      calls.push(['listKeys', prefix]);
      return [...objects.keys()].filter((k) => k.startsWith(prefix));
    },
  };
}

/** Creates a temp build root with `dist/client`, `dist/archive`, and `dist/archive-plan.json`
 * populated from `entries` (each `{ kind, key, path }` — `sha256`/`bytes` are computed from
 * real written bytes, matching what `tools/partition-archive.mjs` itself writes). Returns the
 * root path and the finalized plan. Caller is responsible for `rmSync(root, { recursive: true,
 * force: true })` in a `finally`/`after` — done via the `withTempRoot` wrapper below. */
function makeTempRoot(entries, { planOverrides = {}, writeArchiveFiles = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'archive-sync-test-'));
  mkdirSync(join(root, 'dist', 'client'), { recursive: true });
  mkdirSync(join(root, 'dist', 'archive'), { recursive: true });

  const finalizedEntries = entries.map((entry) => {
    const body = entry.body ?? `<html>${entry.key}</html>`;
    if (writeArchiveFiles) {
      const archiveAbs = join(root, 'dist', 'archive', entry.key);
      mkdirSync(dirname(archiveAbs), { recursive: true });
      writeFileSync(archiveAbs, body);
    }
    return {
      kind: entry.kind,
      key: entry.key,
      path: entry.path,
      sourceRel: `dist/client${entry.path}.html`,
      sha256: sha256Of(body),
      bytes: Buffer.byteLength(body),
    };
  });

  const plan = {
    version: 1,
    generatedAt: new Date().toISOString(),
    hotWindow: { status: 'derived', days: 202, provisional: false },
    cutoffEpoch: 0,
    counts: {
      hotArticles: 0,
      archivedArticles: finalizedEntries.filter((e) => e.kind === 'article').length,
      hotTags: 0,
      archivedTags: finalizedEntries.filter((e) => e.kind === 'tag').length,
    },
    entries: finalizedEntries,
    ...planOverrides,
  };

  writeFileSync(join(root, 'dist', 'archive-plan.json'), JSON.stringify(plan));
  return { root, plan };
}

function withTempRoot(entries, opts, fn) {
  const { root, plan } = makeTempRoot(entries, opts);
  return Promise.resolve()
    .then(() => fn(root, plan))
    .finally(() => rmSync(root, { recursive: true, force: true }));
}

function clientFileFor(root, path) {
  return join(root, 'dist', 'client', `${path.replace(/^\/+/, '')}.html`);
}

function archiveFileFor(root, key) {
  return join(root, 'dist', 'archive', key);
}

const trueCreds = async () => true;
const falseCreds = async () => false;

/** Every pre-existing `runPostSync(` call below describes a LIVE build (05-14) — without this
 * stub injected, those calls would hit the real default `checkLiveDeployment` and attempt a
 * genuine network fetch against dev.915tldr.com inside a unit test. */
const liveOk = async () => ({ live: true, local: null, remote: null, attempts: 1, reason: null });

// ---------------------------------------------------------------------------
// diffAgainstIndex
// ---------------------------------------------------------------------------

test('archive-sync: diffAgainstIndex classifies new / changed / unchanged plan keys, and index-only keys as promoted or vanished orphans', () => {
  const planEntries = [
    { key: 'articles/new.html', path: '/a/new-uuid', sha256: 'new-sha' },
    { key: 'articles/changed.html', path: '/a/changed-uuid', sha256: 'changed-sha-v2' },
    { key: 'articles/same.html', path: '/a/same-uuid', sha256: 'same-sha' },
  ];
  const index = {
    entries: {
      'articles/changed.html': { sha256: 'changed-sha-v1', path: '/a/changed-uuid' },
      'articles/same.html': { sha256: 'same-sha', path: '/a/same-uuid' },
      'articles/promoted.html': { sha256: 'x', path: '/a/promoted-uuid' },
      'articles/vanished.html': { sha256: 'y', path: '/a/vanished-uuid' },
    },
  };
  const diff = diffAgainstIndex({
    planEntries,
    index,
    forceFull: false,
    pathExists: (entry) => entry.key === 'articles/promoted.html',
  });

  assert.deepEqual(diff.newKeys.map((e) => e.key), ['articles/new.html']);
  assert.deepEqual(diff.changedKeys.map((e) => e.key), ['articles/changed.html']);
  assert.deepEqual(diff.unchangedKeys.map((e) => e.key), ['articles/same.html']);
  assert.deepEqual(diff.promotedOrphans.map((o) => o.key), ['articles/promoted.html']);
  assert.deepEqual(diff.vanishedOrphans.map((o) => o.key), ['articles/vanished.html']);
});

test('archive-sync: diffAgainstIndex — forceFull promotes every already-indexed plan key to changed, even when its sha matches', () => {
  const planEntries = [{ key: 'articles/same.html', path: '/a/same-uuid', sha256: 'same-sha' }];
  const index = { entries: { 'articles/same.html': { sha256: 'same-sha', path: '/a/same-uuid' } } };
  const diff = diffAgainstIndex({ planEntries, index, forceFull: true, pathExists: () => false });
  assert.deepEqual(diff.changedKeys.map((e) => e.key), ['articles/same.html']);
  assert.deepEqual(diff.unchangedKeys, []);
});

// ---------------------------------------------------------------------------
// runPreSync
// ---------------------------------------------------------------------------

test('archive-sync: runPreSync — a store whose putObject fails for 2 of 10 new keys moves exactly those 2 back and records 8 in the index', async () => {
  const entries = Array.from({ length: 10 }, (_, i) => ({
    kind: 'article',
    key: `articles/item-${i}.html`,
    path: `/cat/item-${i}-uuid`,
  }));

  await withTempRoot(entries, {}, async (root) => {
    const failKeys = new Set(['articles/item-3.html', 'articles/item-7.html']);
    const store = makeFakeStore({ failPutKeys: failKeys });

    const { result, exitCode } = await runPreSync({
      root,
      env: {},
      hasR2CredentialsFn: trueCreds,
      createStore: async () => store,
    });

    assert.equal(exitCode, 0);
    assert.equal(result.uploaded, 8);
    assert.equal(result.failed, 2);
    assert.equal(result.movedBack, 2);
    assert.equal(result.disabled, false);

    for (const key of failKeys) {
      const entry = entries.find((e) => e.key === key);
      assert.equal(existsSync(archiveFileFor(root, key)), false, `${key} should have left dist/archive`);
      assert.equal(existsSync(clientFileFor(root, entry.path)), true, `${key} should be back in dist/client`);
    }

    const index = JSON.parse(store.objects.get(ARCHIVE_INDEX_KEY).body);
    assert.equal(Object.keys(index.entries).length, 8);
    for (const key of failKeys) {
      assert.equal(key in index.entries, false);
    }
  });
});

test('archive-sync: runPreSync — missing credentials moves all planned pages back and returns disabled with an alert', async () => {
  const entries = [
    { kind: 'article', key: 'articles/a.html', path: '/cat/a-uuid' },
    { kind: 'tag', key: 'tags/b.html', path: '/tag/b' },
  ];
  await withTempRoot(entries, {}, async (root) => {
    let storeCreated = false;
    const { result, exitCode } = await runPreSync({
      root,
      env: {},
      hasR2CredentialsFn: falseCreds,
      createStore: async () => {
        storeCreated = true;
        return makeFakeStore();
      },
    });

    assert.equal(exitCode, 0);
    assert.equal(result.disabled, true);
    assert.equal(result.movedBack, 2);
    assert.equal(result.uploaded, 0);
    assert.ok(result.alerts.length >= 1);
    assert.match(result.alerts[0], /archive-sync:.*disabled/);
    assert.equal(storeCreated, false, 'the store must never be created when credentials are missing');

    for (const entry of entries) {
      assert.equal(existsSync(clientFileFor(root, entry.path)), true);
      assert.equal(existsSync(archiveFileFor(root, entry.key)), false);
    }
  });
});

test('archive-sync: runPreSync — an index read that throws moves all planned pages back, returns an alert, exit code 0', async () => {
  const entries = [{ kind: 'article', key: 'articles/a.html', path: '/cat/a-uuid' }];
  await withTempRoot(entries, {}, async (root) => {
    const store = makeFakeStore({ failGetJsonKeys: new Set([ARCHIVE_INDEX_KEY]) });
    const { result, exitCode } = await runPreSync({
      root,
      env: {},
      hasR2CredentialsFn: trueCreds,
      createStore: async () => store,
    });

    assert.equal(exitCode, 0);
    assert.equal(result.movedBack, 1);
    assert.ok(result.alerts.some((a) => /index unreadable/.test(a)));
    assert.equal(existsSync(clientFileFor(root, entries[0].path)), true);
  });
});

test('archive-sync: runPreSync — pre exits 1 only when the plan is missing or invalid', async () => {
  const root = mkdtempSync(join(tmpdir(), 'archive-sync-test-'));
  try {
    const { result, exitCode } = await runPreSync({ root, env: {}, hasR2CredentialsFn: trueCreds });
    assert.equal(exitCode, 1);
    assert.ok(result.alerts[0].includes('archive-plan.json'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('archive-sync: runPreSync — --limit treats keys beyond n as not started (moved back), never uploaded', async () => {
  const entries = Array.from({ length: 5 }, (_, i) => ({
    kind: 'article',
    key: `articles/item-${i}.html`,
    path: `/cat/item-${i}-uuid`,
  }));
  await withTempRoot(entries, {}, async (root) => {
    const store = makeFakeStore();
    const { result } = await runPreSync({
      root,
      env: {},
      hasR2CredentialsFn: trueCreds,
      createStore: async () => store,
      limit: 2,
    });
    assert.equal(result.uploaded, 2);
    assert.equal(result.movedBack, 3);
  });
});

// ---------------------------------------------------------------------------
// runPostSync — changed keys, failures, orphan deletion
// ---------------------------------------------------------------------------

test('archive-sync: runPostSync — uploads changed keys; a failed re-upload is not written to the index, counts in failed, and alerts naming the count', async () => {
  const entries = [
    { kind: 'article', key: 'articles/ok.html', path: '/cat/ok-uuid', body: '<html>v2-ok</html>' },
    { kind: 'article', key: 'articles/bad.html', path: '/cat/bad-uuid', body: '<html>v2-bad</html>' },
  ];
  await withTempRoot(entries, {}, async (root, plan) => {
    const oldShaOk = sha256Of('<html>v1-ok</html>');
    const oldShaBad = sha256Of('<html>v1-bad</html>');
    const store = makeFakeStore({
      seed: {
        [ARCHIVE_INDEX_KEY]: {
          body: JSON.stringify({
            version: 1,
            entries: {
              'articles/ok.html': { sha256: oldShaOk, path: '/cat/ok-uuid' },
              'articles/bad.html': { sha256: oldShaBad, path: '/cat/bad-uuid' },
            },
          }),
        },
      },
      failPutKeys: new Set(['articles/bad.html']),
    });

    const { result } = await runPostSync({
      root,
      env: {},
      hasR2CredentialsFn: trueCreds,
      checkLiveDeploymentFn: liveOk,
      createStore: async () => store,
    });

    assert.equal(result.uploaded, 1);
    assert.equal(result.failed, 1);
    assert.ok(result.alerts.some((a) => /1 page\(s\) failed to re-upload/.test(a)));

    const index = JSON.parse(store.objects.get(ARCHIVE_INDEX_KEY).body);
    assert.equal(index.entries['articles/ok.html'].sha256, sha256Of('<html>v2-ok</html>'));
    assert.equal(index.entries['articles/bad.html'].sha256, oldShaBad, 'the failed re-upload must keep the OLD sha256 — the previous object is still what serves');
  });
});

test('archive-sync: runPostSync — deletes promoted orphans freely; vanished orphans only when under the cap, else none deleted and an alert fires', async () => {
  await withTempRoot([], {}, async (root) => {
    // 200 index entries so 1% = 2, but the floor is max(50, 1%) = 50 — put exactly 51 vanished
    // keys (over the cap) and 1 promoted orphan (always deletable, uncapped).
    const indexEntries = {};
    for (let i = 0; i < 51; i += 1) {
      indexEntries[`articles/vanished-${i}.html`] = { sha256: 'x', path: `/cat/vanished-${i}-uuid` };
    }
    indexEntries['articles/promoted.html'] = { sha256: 'y', path: '/cat/promoted-uuid' };
    // Pad the index so Object.keys().length is a round number making max(50, 1%) obviously 50.
    for (let i = 0; i < 100; i += 1) {
      indexEntries[`articles/filler-${i}.html`] = { sha256: 'z', path: `/cat/filler-${i}-uuid` };
    }

    // The promoted orphan's canonical path now exists as a real static file.
    mkdirSync(dirname(clientFileFor(root, '/cat/promoted-uuid')), { recursive: true });
    writeFileSync(clientFileFor(root, '/cat/promoted-uuid'), '<html>now hot</html>');

    const store = makeFakeStore({
      seed: { [ARCHIVE_INDEX_KEY]: { body: JSON.stringify({ version: 1, entries: indexEntries }) } },
    });

    const { result } = await runPostSync({
      root,
      env: {},
      hasR2CredentialsFn: trueCreds,
      checkLiveDeploymentFn: liveOk,
      createStore: async () => store,
    });

    assert.equal(result.deleted, 0, 'vanished orphans exceed the cap — only the promoted orphan would be deletable, but it was never actually stored in the fake, so deleteObjects reports 0 deleted');
    assert.ok(result.alerts.some((a) => /exceed the deletion cap/.test(a)));

    const index = JSON.parse(store.objects.get(ARCHIVE_INDEX_KEY).body);
    assert.equal(Object.keys(index.entries).length, 152, 'nothing was removed from the index — the vanished deletion was skipped entirely');
  });
});

test('archive-sync: runPostSync — promoted orphans delete even when vanished orphans are capped out', async () => {
  await withTempRoot([], {}, async (root) => {
    const indexEntries = { 'articles/promoted.html': { sha256: 'y', path: '/cat/promoted-uuid' } };
    const store = makeFakeStore({
      seed: {
        [ARCHIVE_INDEX_KEY]: { body: JSON.stringify({ version: 1, entries: indexEntries }) },
        'articles/promoted.html': { body: '<html>archived copy</html>', sha256: 'y' },
      },
    });
    mkdirSync(dirname(clientFileFor(root, '/cat/promoted-uuid')), { recursive: true });
    writeFileSync(clientFileFor(root, '/cat/promoted-uuid'), '<html>now hot</html>');

    const { result } = await runPostSync({
      root,
      env: {},
      hasR2CredentialsFn: trueCreds,
      checkLiveDeploymentFn: liveOk,
      createStore: async () => store,
    });

    assert.equal(result.deleted, 1);
    assert.equal(store.objects.has('articles/promoted.html'), false);
    const index = JSON.parse(store.objects.get(ARCHIVE_INDEX_KEY).body);
    assert.equal('articles/promoted.html' in index.entries, false);
  });
});

// ---------------------------------------------------------------------------
// runPostSync — deadline / backlog
// ---------------------------------------------------------------------------

function writePastBuildStart(root, secondsAgoBeyondDeadline) {
  // POST_DEADLINE_SECONDS is 1020 — set the build start far enough in the past that "now" is
  // already past the deadline, so no new upload starts and every changed key lands in
  // `notStarted` (deferred).
  mkdirSync(join(root, '.astro'), { recursive: true });
  const epoch = Math.floor(Date.now() / 1000) - secondsAgoBeyondDeadline;
  writeFileSync(join(root, '.astro', 'ci-build-started-at'), String(epoch));
}

test('archive-sync: runPostSync — a deadline already passed defers every changed key and records a fresh backlog', async () => {
  const entries = [{ kind: 'article', key: 'articles/a.html', path: '/cat/a-uuid', body: '<html>v2</html>' }];
  await withTempRoot(entries, {}, async (root) => {
    writePastBuildStart(root, 1020 + 5); // 5s past the 1020s post deadline
    const store = makeFakeStore({
      seed: {
        [ARCHIVE_INDEX_KEY]: {
          body: JSON.stringify({
            version: 1,
            entries: { 'articles/a.html': { sha256: sha256Of('<html>v1</html>'), path: '/cat/a-uuid' } },
          }),
        },
      },
    });

    const { result } = await runPostSync({ root, env: {}, hasR2CredentialsFn: trueCreds, checkLiveDeploymentFn: liveOk, createStore: async () => store });

    assert.equal(result.uploaded, 0);
    assert.equal(result.deferred, 1);
    assert.equal(result.backlog.count, 1);
    assert.ok(result.backlog.since, 'a fresh backlogSince timestamp must be set');

    const state = JSON.parse(store.objects.get(ARCHIVE_STATE_KEY).body);
    assert.equal(state.backlogCount, 1);
    assert.ok(state.backlogSince);
    assert.equal(state.lastConvergedAt, null);
  });
});

test('archive-sync: runPostSync — backlogSince is kept from the earlier value when a backlog already existed', async () => {
  const entries = [{ kind: 'article', key: 'articles/a.html', path: '/cat/a-uuid', body: '<html>v2</html>' }];
  await withTempRoot(entries, {}, async (root) => {
    writePastBuildStart(root, 1020 + 5);
    const oldBacklogSince = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
    const store = makeFakeStore({
      seed: {
        [ARCHIVE_INDEX_KEY]: {
          body: JSON.stringify({
            version: 1,
            entries: { 'articles/a.html': { sha256: sha256Of('<html>v1</html>'), path: '/cat/a-uuid' } },
          }),
        },
        [ARCHIVE_STATE_KEY]: {
          body: JSON.stringify({ backlogCount: 3, backlogSince: oldBacklogSince, lastConvergedAt: null }),
        },
      },
    });

    const { result } = await runPostSync({ root, env: {}, hasR2CredentialsFn: trueCreds, checkLiveDeploymentFn: liveOk, createStore: async () => store });
    assert.equal(result.backlog.since, oldBacklogSince);
  });
});

test('archive-sync: runPostSync — a later run that clears the backlog sets backlogCount 0, clears backlogSince, sets lastConvergedAt', async () => {
  const entries = [{ kind: 'article', key: 'articles/a.html', path: '/cat/a-uuid', body: '<html>v2</html>' }];
  await withTempRoot(entries, {}, async (root) => {
    // No build-start file this time — falls back to this process's own start, far from any
    // deadline, so the upload actually runs and the backlog clears.
    const oldBacklogSince = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
    const store = makeFakeStore({
      seed: {
        [ARCHIVE_INDEX_KEY]: {
          body: JSON.stringify({
            version: 1,
            entries: { 'articles/a.html': { sha256: sha256Of('<html>v1</html>'), path: '/cat/a-uuid' } },
          }),
        },
        [ARCHIVE_STATE_KEY]: {
          body: JSON.stringify({ backlogCount: 1, backlogSince: oldBacklogSince, lastConvergedAt: null }),
        },
      },
    });

    const { result } = await runPostSync({ root, env: {}, hasR2CredentialsFn: trueCreds, checkLiveDeploymentFn: liveOk, createStore: async () => store });

    assert.equal(result.deferred, 0);
    assert.equal(result.backlog.count, 0);
    assert.equal(result.backlog.since, null);

    const state = JSON.parse(store.objects.get(ARCHIVE_STATE_KEY).body);
    assert.equal(state.backlogCount, 0);
    assert.equal(state.backlogSince, null);
    assert.ok(state.lastConvergedAt, 'lastConvergedAt must be set the run the backlog clears');
  });
});

test(`archive-sync: runPostSync — a backlogSince older than ${BACKLOG_ALERT_HOURS}h adds the D-10 alert`, async () => {
  const entries = [{ kind: 'article', key: 'articles/a.html', path: '/cat/a-uuid', body: '<html>v2</html>' }];
  await withTempRoot(entries, {}, async (root) => {
    writePastBuildStart(root, 1020 + 5); // keep this run deferred too, so backlogSince stays old
    const oldBacklogSince = new Date(Date.now() - (BACKLOG_ALERT_HOURS + 1) * 3600 * 1000).toISOString();
    const store = makeFakeStore({
      seed: {
        [ARCHIVE_INDEX_KEY]: {
          body: JSON.stringify({
            version: 1,
            entries: { 'articles/a.html': { sha256: sha256Of('<html>v1</html>'), path: '/cat/a-uuid' } },
          }),
        },
        [ARCHIVE_STATE_KEY]: {
          body: JSON.stringify({ backlogCount: 1, backlogSince: oldBacklogSince, lastConvergedAt: null }),
        },
      },
    });

    const { result } = await runPostSync({ root, env: {}, hasR2CredentialsFn: trueCreds, checkLiveDeploymentFn: liveOk, createStore: async () => store });
    assert.ok(result.alerts.some((a) => /backlog older than 20h \(D-10\)/.test(a)));
  });
});

// ---------------------------------------------------------------------------
// runPostSync — force-full
// ---------------------------------------------------------------------------

test('archive-sync: runPostSync — with the force-full marker present, every indexed plan key is re-uploaded; the marker is deleted only when the run ends with zero backlog', async () => {
  const entries = [
    { kind: 'article', key: 'articles/a.html', path: '/cat/a-uuid', body: '<html>same</html>' },
    { kind: 'tag', key: 'tags/b.html', path: '/tag/b', body: '<html>same-tag</html>' },
  ];
  await withTempRoot(entries, {}, async (root) => {
    const store = makeFakeStore({
      seed: {
        [ARCHIVE_INDEX_KEY]: {
          body: JSON.stringify({
            version: 1,
            entries: {
              'articles/a.html': { sha256: sha256Of('<html>same</html>'), path: '/cat/a-uuid' },
              'tags/b.html': { sha256: sha256Of('<html>same-tag</html>'), path: '/tag/b' },
            },
          }),
        },
        [FORCE_FULL_KEY]: { body: JSON.stringify({ requestedAt: new Date().toISOString(), reason: 'template change' }) },
      },
    });

    const { result } = await runPostSync({ root, env: {}, hasR2CredentialsFn: trueCreds, checkLiveDeploymentFn: liveOk, createStore: async () => store });

    assert.equal(result.uploaded, 2, 'both keys re-uploaded even though their sha256 matched the index');
    assert.equal(result.deferred, 0);
    assert.equal(store.objects.has(FORCE_FULL_KEY), false, 'the marker is cleared once the run ends with zero backlog');
  });
});

test('archive-sync: runPostSync — the force-full marker is kept when the run still has a backlog', async () => {
  const entries = [{ kind: 'article', key: 'articles/a.html', path: '/cat/a-uuid', body: '<html>same</html>' }];
  await withTempRoot(entries, {}, async (root) => {
    writePastBuildStart(root, 1020 + 5); // force a deferred backlog this run
    const store = makeFakeStore({
      seed: {
        [ARCHIVE_INDEX_KEY]: {
          body: JSON.stringify({
            version: 1,
            entries: { 'articles/a.html': { sha256: sha256Of('<html>same</html>'), path: '/cat/a-uuid' } },
          }),
        },
        [FORCE_FULL_KEY]: { body: JSON.stringify({ requestedAt: new Date().toISOString(), reason: 'template change' }) },
      },
    });

    const { result } = await runPostSync({ root, env: {}, hasR2CredentialsFn: trueCreds, checkLiveDeploymentFn: liveOk, createStore: async () => store });
    assert.equal(result.deferred, 1);
    assert.equal(store.objects.has(FORCE_FULL_KEY), true, 'the marker must survive a run that still has a backlog');
  });
});

// ---------------------------------------------------------------------------
// WR-01 / CR-01 (05-14): post refuses a build that is not live
// ---------------------------------------------------------------------------

function writeLocalVersionJson(root, { commit = 'aaa1234', builtAt = '2026-10-02T00:00:00.000Z' } = {}) {
  mkdirSync(join(root, 'dist', 'client'), { recursive: true });
  writeFileSync(join(root, 'dist', 'client', 'version.json'), JSON.stringify({ commit, builtAt }));
}

test('archive-sync: runPostSync (05-14) — a non-live build refuses before createStore is ever called; zero uploads, zero deletions, one alert naming both versions', async () => {
  const entries = [{ kind: 'article', key: 'articles/a.html', path: '/cat/a-uuid' }];
  await withTempRoot(entries, {}, async (root) => {
    let createStoreCalled = false;
    const nonLive = async () => ({
      live: false,
      local: { commit: 'aaa', builtAt: 'L' },
      remote: { commit: 'bbb', builtAt: 'R' },
      reason: 'mismatch',
    });

    const { result, exitCode } = await runPostSync({
      root,
      env: {},
      hasR2CredentialsFn: trueCreds,
      checkLiveDeploymentFn: nonLive,
      createStore: async () => {
        createStoreCalled = true;
        return makeFakeStore();
      },
    });

    assert.equal(createStoreCalled, false, 'createStore must never be called when the live deployment is not this build');
    assert.equal(result.uploaded, 0);
    assert.equal(result.deleted, 0);
    assert.equal(exitCode, 0);
    assert.equal(result.alerts.length, 1);
    assert.match(result.alerts[0], /live deployment is not this build/);
    assert.match(result.alerts[0], /aaa/, 'the alert must name the local commit');
    assert.match(result.alerts[0], /bbb/, 'the alert must name the remote (live) commit');
  });
});

test('archive-sync: runPostSync (05-14) — WR-01 overlapping-build regression: key K (in the index, absent from this build\'s plan, present in this build\'s dist/client) survives a non-live run untouched in R2 and in the index', async () => {
  // Build A's plan has no entries at all — K was never part of build A's own content. But K is
  // present as a real static file in build A's dist/client (the review's 4-step scenario), and K
  // is still listed in the index and still stored in R2 because build B (now live) archived it.
  await withTempRoot([], {}, async (root) => {
    mkdirSync(dirname(clientFileFor(root, '/cat/k-uuid')), { recursive: true });
    writeFileSync(clientFileFor(root, '/cat/k-uuid'), '<html>K is static in build A</html>');

    const store = makeFakeStore({
      seed: {
        [ARCHIVE_INDEX_KEY]: {
          body: JSON.stringify({ version: 1, entries: { 'articles/k.html': { sha256: 'k-sha', path: '/cat/k-uuid' } } }),
        },
        'articles/k.html': { body: '<html>K archived by build B</html>', sha256: 'k-sha' },
      },
    });

    const nonLive = async () => ({
      live: false,
      local: { commit: 'aaa', builtAt: 'L' },
      remote: { commit: 'bbb', builtAt: 'R' },
      reason: 'mismatch',
    });

    const { result } = await runPostSync({
      root,
      env: {},
      hasR2CredentialsFn: trueCreds,
      checkLiveDeploymentFn: nonLive,
      createStore: async () => store,
    });

    assert.equal(result.deleted, 0, 'a non-live run must delete nothing');
    assert.equal(store.objects.has('articles/k.html'), true, 'K must remain in R2 — a non-live build must never delete it');
    const index = JSON.parse(store.objects.get(ARCHIVE_INDEX_KEY).body);
    assert.equal('articles/k.html' in index.entries, true, 'K must remain indexed');
    assert.equal(store.calls.some((c) => c[0] === 'deleteObjects'), false, 'deleteObjects must never appear in store.calls on a non-live run');
  });
});

test('archive-sync: runPostSync (05-14) — a live build behaves exactly as before (covered by every other post test via the liveOk stub)', async () => {
  const entries = [{ kind: 'article', key: 'articles/a.html', path: '/cat/a-uuid', body: '<html>v2</html>' }];
  await withTempRoot(entries, {}, async (root) => {
    const store = makeFakeStore({
      seed: {
        [ARCHIVE_INDEX_KEY]: {
          body: JSON.stringify({ version: 1, entries: { 'articles/a.html': { sha256: sha256Of('<html>v1</html>'), path: '/cat/a-uuid' } } }),
        },
      },
    });

    const { result } = await runPostSync({
      root,
      env: {},
      hasR2CredentialsFn: trueCreds,
      checkLiveDeploymentFn: liveOk,
      createStore: async () => store,
    });

    assert.equal(result.uploaded, 1);
  });
});

test('archive-sync: checkLiveDeployment — a single attempt returns live:true only when both commit and builtAt match, and the requested URL is the dev.915tldr.com default with a cache-busting query', async () => {
  await withTempRoot([], {}, async (root) => {
    writeLocalVersionJson(root, { commit: 'abc1234', builtAt: '2026-10-02T00:00:00.000Z' });
    let requestedUrl = null;
    const fetchImpl = async (url) => {
      requestedUrl = String(url);
      return { ok: true, status: 200, json: async () => ({ commit: 'abc1234', builtAt: '2026-10-02T00:00:00.000Z' }) };
    };

    const result = await checkLiveDeployment({ root, env: {}, fetchImpl, attempts: 1 });

    assert.equal(result.live, true);
    assert.equal(result.local.commit, 'abc1234');
    assert.equal(result.remote.commit, 'abc1234');
    assert.ok(requestedUrl.startsWith('https://dev.915tldr.com/version.json?'), `expected the default live origin, got ${requestedUrl}`);
  });
});

test('archive-sync: checkLiveDeployment — a single attempt returns live:false when builtAt differs (same commit)', async () => {
  await withTempRoot([], {}, async (root) => {
    writeLocalVersionJson(root, { commit: 'abc1234', builtAt: '2026-10-02T00:00:00.000Z' });
    const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ commit: 'abc1234', builtAt: '2026-10-02T05:00:00.000Z' }) });

    const result = await checkLiveDeployment({ root, env: {}, fetchImpl, attempts: 1 });

    assert.equal(result.live, false);
    assert.equal(result.local.commit, 'abc1234');
    assert.equal(result.remote.builtAt, '2026-10-02T05:00:00.000Z');
    assert.ok(result.reason);
  });
});

// ---------------------------------------------------------------------------
// Task 2 (05-14): dry-run refusal, propagation polling, pre-delete re-check
// ---------------------------------------------------------------------------

test('archive-sync: runPostSync — CI_BUILD_DEPLOY_DRY_RUN=1 refuses before checkLiveDeploymentFn is ever called; createStore never called, disabled:true, alert names the flag', async () => {
  const entries = [{ kind: 'article', key: 'articles/a.html', path: '/cat/a-uuid' }];
  await withTempRoot(entries, {}, async (root) => {
    let createStoreCalled = false;
    let livenessCalled = false;
    const { result, exitCode } = await runPostSync({
      root,
      env: { CI_BUILD_DEPLOY_DRY_RUN: '1' },
      hasR2CredentialsFn: trueCreds,
      checkLiveDeploymentFn: async () => {
        livenessCalled = true;
        return { live: true };
      },
      createStore: async () => {
        createStoreCalled = true;
        return makeFakeStore();
      },
    });

    assert.equal(createStoreCalled, false);
    assert.equal(livenessCalled, false, 'a dry run must refuse before the liveness check is ever invoked');
    assert.equal(result.disabled, true);
    assert.equal(exitCode, 0);
    assert.match(result.alerts[0], /CI_BUILD_DEPLOY_DRY_RUN/);
  });
});

test('archive-sync: checkLiveDeployment — polls up to `attempts` times, returning live:true on the first match; sleep is called once per non-matching attempt', async () => {
  await withTempRoot([], {}, async (root) => {
    writeLocalVersionJson(root, { commit: 'abc1234', builtAt: '2026-10-02T03:00:00.000Z' });
    let call = 0;
    const fetchImpl = async () => {
      call += 1;
      const builtAt = call < 3 ? '2026-10-02T00:00:00.000Z' : '2026-10-02T03:00:00.000Z';
      return { ok: true, status: 200, json: async () => ({ commit: 'abc1234', builtAt }) };
    };
    const sleepCalls = [];
    const sleep = async (ms) => {
      sleepCalls.push(ms);
    };

    const result = await checkLiveDeployment({ root, env: {}, fetchImpl, sleep, attempts: 6, intervalMs: 10_000 });

    assert.equal(result.live, true);
    assert.equal(result.attempts, 3);
    assert.deepEqual(sleepCalls, [10_000, 10_000], 'sleep must be called exactly twice — once after each non-matching attempt, never after the match');
  });
});

test('archive-sync: checkLiveDeployment — never live after exhausting `attempts`; a rejecting fetch never throws; a non-https origin never calls fetch', async () => {
  await withTempRoot([], {}, async (root) => {
    writeLocalVersionJson(root, { commit: 'abc1234', builtAt: '2026-10-02T00:00:00.000Z' });

    let alwaysMismatchedCalls = 0;
    const alwaysMismatched = async () => {
      alwaysMismatchedCalls += 1;
      return { ok: true, status: 200, json: async () => ({ commit: 'abc1234', builtAt: 'never-matches' }) };
    };
    const neverLive = await checkLiveDeployment({ root, env: {}, fetchImpl: alwaysMismatched, sleep: async () => {}, attempts: 4 });
    assert.equal(neverLive.live, false);
    assert.equal(alwaysMismatchedCalls, 4);

    const rejecting = async () => {
      throw new Error('ECONNREFUSED');
    };
    const rejected = await checkLiveDeployment({ root, env: {}, fetchImpl: rejecting, sleep: async () => {}, attempts: 1 });
    assert.equal(rejected.live, false);
    assert.ok(rejected.reason);

    let insecureFetchCalled = false;
    const insecureResult = await checkLiveDeployment({
      root,
      env: { ARCHIVE_SYNC_LIVE_ORIGIN: 'http://dev.915tldr.com' },
      fetchImpl: async () => {
        insecureFetchCalled = true;
        return { ok: true, status: 200, json: async () => ({ commit: 'abc1234', builtAt: '2026-10-02T00:00:00.000Z' }) };
      },
      attempts: 1,
    });
    assert.equal(insecureResult.live, false);
    assert.equal(insecureFetchCalled, false, 'a non-https origin must never be fetched');
  });
});

test('archive-sync: runPostSync — the live deployment changing during post-sync skips deletions, keeps the orphan indexed, but still uploads/indexes the changed key', async () => {
  const entries = [{ kind: 'article', key: 'articles/changed.html', path: '/cat/changed-uuid', body: '<html>v2</html>' }];
  await withTempRoot(entries, {}, async (root) => {
    const indexEntries = {
      'articles/changed.html': { sha256: sha256Of('<html>v1</html>'), path: '/cat/changed-uuid' },
      'articles/orphan.html': { sha256: 'x', path: '/cat/orphan-uuid' },
    };
    mkdirSync(dirname(clientFileFor(root, '/cat/orphan-uuid')), { recursive: true });
    writeFileSync(clientFileFor(root, '/cat/orphan-uuid'), '<html>now hot</html>'); // promoted orphan

    const store = makeFakeStore({
      seed: {
        [ARCHIVE_INDEX_KEY]: { body: JSON.stringify({ version: 1, entries: indexEntries }) },
        'articles/orphan.html': { body: '<html>archived copy</html>', sha256: 'x' },
      },
    });

    let livenessCalls = 0;
    const flakyLiveness = async () => {
      livenessCalls += 1;
      return livenessCalls === 1 ? { live: true } : { live: false, local: { commit: 'a', builtAt: '1' }, remote: { commit: 'b', builtAt: '2' }, reason: 'deploy landed mid-run' };
    };

    const { result } = await runPostSync({
      root,
      env: {},
      hasR2CredentialsFn: trueCreds,
      checkLiveDeploymentFn: flakyLiveness,
      createStore: async () => store,
    });

    assert.equal(result.uploaded, 1, 'the changed key must still be uploaded — only deletions are gated by the re-check');
    assert.equal(result.deleted, 0);
    assert.equal(store.calls.some((c) => c[0] === 'deleteObjects'), false, 'deleteObjects must never be called once the re-check reports non-live');
    assert.ok(result.alerts.some((a) => /live deployment changed during post-sync/.test(a)));

    const index = JSON.parse(store.objects.get(ARCHIVE_INDEX_KEY).body);
    assert.equal(index.entries['articles/changed.html'].sha256, sha256Of('<html>v2</html>'), 'the changed key must be re-indexed with its new sha256');
    assert.equal('articles/orphan.html' in index.entries, true, 'the orphan must remain indexed — its deletion was skipped');
  });
});

test('archive-sync: runPostSync — a non-live run at the initial gate leaves the force-full marker untouched and writes neither archive-state.json nor daily-report.json', async () => {
  const entries = [{ kind: 'article', key: 'articles/a.html', path: '/cat/a-uuid' }];
  await withTempRoot(entries, {}, async (root) => {
    const store = makeFakeStore({
      seed: {
        [ARCHIVE_INDEX_KEY]: { body: JSON.stringify({ version: 1, entries: {} }) },
        [FORCE_FULL_KEY]: { body: JSON.stringify({ requestedAt: new Date().toISOString(), reason: 'template change' }) },
      },
    });
    const nonLive = async () => ({ live: false, local: { commit: 'aaa', builtAt: 'L' }, remote: { commit: 'bbb', builtAt: 'R' }, reason: 'mismatch' });

    await runPostSync({
      root,
      env: {},
      hasR2CredentialsFn: trueCreds,
      checkLiveDeploymentFn: nonLive,
      createStore: async () => store,
    });

    assert.equal(store.objects.has(FORCE_FULL_KEY), true, 'the force-full marker must survive a non-live run');
    assert.equal(store.calls.some((c) => c[0] === 'putJson' && c[1] === ARCHIVE_STATE_KEY), false);
    assert.equal(store.calls.some((c) => c[0] === 'putJson' && c[1] === DAILY_REPORT_KEY), false);
  });
});

// ---------------------------------------------------------------------------
// WR-02 (05-18): a failed index write can never become a 404
// ---------------------------------------------------------------------------

test('archive-sync: WR-02 (05-18): a failed index write can never become a 404 — post survives, pre self-heals', async () => {
  const kBody = '<html>K archived content</html>';
  const kSha = sha256Of(kBody);
  const failPutKeys = new Set([ARCHIVE_INDEX_KEY]);
  const store = makeFakeStore({
    seed: {
      [ARCHIVE_INDEX_KEY]: {
        body: JSON.stringify({ version: 1, entries: { 'articles/k.html': { sha256: kSha, path: '/cat/k-uuid' } } }),
      },
      'articles/k.html': { body: kBody, sha256: kSha },
    },
    failPutKeys,
  });

  // Step 1 (post): plan omits K; K is a promoted orphan (now static in dist/client); the fake
  // store holds K; the index write (mergeWriteIndex's putJson) fails.
  await withTempRoot([], {}, async (postRoot) => {
    mkdirSync(dirname(clientFileFor(postRoot, '/cat/k-uuid')), { recursive: true });
    writeFileSync(clientFileFor(postRoot, '/cat/k-uuid'), '<html>K is static now</html>');

    const { result, exitCode } = await runPostSync({
      root: postRoot,
      env: {},
      hasR2CredentialsFn: trueCreds,
      checkLiveDeploymentFn: liveOk,
      createStore: async () => store,
    });

    assert.equal(exitCode, 0, 'post must resolve, not throw, on a failed index write');
    assert.equal(result.deleted, 1, 'K was actually deleted from R2');
    assert.equal(store.objects.has('articles/k.html'), false, 'K is gone from the fake R2 store');
    const indexAfterPost = JSON.parse(store.objects.get(ARCHIVE_INDEX_KEY).body);
    assert.ok('articles/k.html' in indexAfterPost.entries, 'the stored index still lists K — the write failed');
    assert.ok(
      result.alerts.some((a) => /index write failed after post-sync/.test(a)),
      `expected an alert naming the failed index write, got: ${JSON.stringify(result.alerts)}`
    );
  });

  // Step 2 (pre): a NEW build whose plan includes K again (same sha as the stale index entry),
  // the SAME store (index write no longer failing) — self-heal must detect K missing from R2
  // and re-upload it as new, rather than trusting the stale "unchanged" index entry.
  failPutKeys.delete(ARCHIVE_INDEX_KEY);
  await withTempRoot(
    [{ kind: 'article', key: 'articles/k.html', path: '/cat/k-uuid', body: kBody }],
    {},
    async (preRoot) => {
      const { result } = await runPreSync({
        root: preRoot,
        env: {},
        hasR2CredentialsFn: trueCreds,
        createStore: async () => store,
      });

      assert.ok(
        store.calls.some((c) => c[0] === 'putObject' && c[1] === 'articles/k.html'),
        'K must be re-uploaded — self-heal must classify it as new, not unchanged'
      );
      assert.equal(result.uploaded, 1);
      assert.equal(
        existsSync(clientFileFor(preRoot, '/cat/k-uuid')),
        false,
        'K must NOT be moved back to static — the upload succeeded'
      );
      assert.ok(
        result.alerts.some(
          (a) => /indexed page\(s\) were missing from R2/.test(a) && /index self-heal/.test(a)
        ),
        `expected a self-heal alert, got: ${JSON.stringify(result.alerts)}`
      );
    }
  );
});

// ---------------------------------------------------------------------------
// requestFullReupload
// ---------------------------------------------------------------------------

test('archive-sync: requestFullReupload writes the marker; an empty reason is refused', async () => {
  const store = makeFakeStore();
  await requestFullReupload({ reason: 'owner-requested re-render', env: {}, createStore: async () => store });
  const marker = JSON.parse(store.objects.get(FORCE_FULL_KEY).body);
  assert.equal(marker.reason, 'owner-requested re-render');
  assert.ok(marker.requestedAt);

  await assert.rejects(
    requestFullReupload({ reason: '', env: {}, createStore: async () => store }),
    /archive-sync: requestFullReupload requires a non-empty reason/
  );
  await assert.rejects(
    requestFullReupload({ reason: '   ', env: {}, createStore: async () => store }),
    /archive-sync: requestFullReupload requires a non-empty reason/
  );
});

// ---------------------------------------------------------------------------
// Daily report
// ---------------------------------------------------------------------------

test('archive-sync: runPostSync — dailyReport.due is true exactly once per America/Denver calendar date', async () => {
  await withTempRoot([], {}, async (root) => {
    mkdirSync(join(root, 'dist', 'client'), { recursive: true });
    writeFileSync(
      join(root, 'dist', 'client', 'static-budget.json'),
      JSON.stringify({ staticFileCount: 29937, ceiling: 100000, failAt: 80000 })
    );
    const store = makeFakeStore();

    const first = await runPostSync({ root, env: {}, hasR2CredentialsFn: trueCreds, checkLiveDeploymentFn: liveOk, createStore: async () => store });
    assert.equal(first.result.dailyReport.due, true);
    assert.equal(first.result.dailyReport.body.staticFileCount, 29937);
    assert.equal(first.result.dailyReport.body.ceiling, 100000);

    const second = await runPostSync({ root, env: {}, hasR2CredentialsFn: trueCreds, checkLiveDeploymentFn: liveOk, createStore: async () => store });
    assert.equal(second.result.dailyReport.due, false);
  });
});

// ---------------------------------------------------------------------------
// Disabled / exit-code contract
// ---------------------------------------------------------------------------

test('archive-sync: runPostSync — post never exits non-zero, even when the plan is missing', async () => {
  const root = mkdtempSync(join(tmpdir(), 'archive-sync-test-'));
  try {
    const { result, exitCode } = await runPostSync({ root, env: {}, hasR2CredentialsFn: trueCreds, checkLiveDeploymentFn: liveOk });
    assert.equal(exitCode, 0);
    assert.ok(result.alerts[0].includes('archive-plan.json'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('archive-sync: runPostSync — missing credentials returns disabled:true with an alert, never touching the store', async () => {
  const entries = [{ kind: 'article', key: 'articles/a.html', path: '/cat/a-uuid' }];
  await withTempRoot(entries, {}, async (root) => {
    let created = false;
    const { result, exitCode } = await runPostSync({
      root,
      env: {},
      hasR2CredentialsFn: falseCreds,
      checkLiveDeploymentFn: liveOk,
      createStore: async () => {
        created = true;
        return makeFakeStore();
      },
    });
    assert.equal(exitCode, 0);
    assert.equal(result.disabled, true);
    assert.equal(created, false);
  });
});

// ---------------------------------------------------------------------------
// Branch guard — defense in depth against the R2 build secrets leaking onto a non-prod trigger
// ---------------------------------------------------------------------------

test('archive-sync: isR2WriteBlocked — true only when WORKERS_CI is set and the branch is not main', () => {
  assert.equal(isR2WriteBlocked({ WORKERS_CI: '1', WORKERS_CI_BRANCH: 'main' }), false);
  assert.equal(isR2WriteBlocked({ WORKERS_CI: '1', WORKERS_CI_BRANCH: 'develop' }), true);
  assert.equal(isR2WriteBlocked({ WORKERS_CI: '1', WORKERS_CI_BRANCH: 'feature/phase-05' }), true);
  assert.equal(isR2WriteBlocked({ WORKERS_CI: '0', WORKERS_CI_BRANCH: 'develop' }), false);
  assert.equal(isR2WriteBlocked({}), false, 'a local run with no WORKERS_CI is never blocked');
});

test('archive-sync: wrapStoreForBranchGuard — refuses every write method before any request is built, on a non-main CI branch', async () => {
  const store = makeFakeStore();
  const guarded = wrapStoreForBranchGuard(store, { WORKERS_CI: '1', WORKERS_CI_BRANCH: 'feature/x' });

  await assert.rejects(guarded.putObject('articles/a.html', 'x', { contentType: 'text/html', sha256: 'x' }), /archive-sync: refusing R2 write/);
  await assert.rejects(guarded.putJson(ARCHIVE_INDEX_KEY, {}), /archive-sync: refusing R2 write/);
  await assert.rejects(guarded.deleteObjects(['articles/a.html']), /archive-sync: refusing R2 write/);

  assert.equal(store.calls.length, 0, 'no call ever reached the underlying store');

  // Reads pass through unaffected — post still needs to read the index/state even if a caller
  // reached for the store directly on a blocked branch.
  await guarded.getJson(ARCHIVE_INDEX_KEY);
  assert.equal(store.calls.length, 1);
});

test('archive-sync: wrapStoreForBranchGuard — writes pass through unchanged on main or in a local run', async () => {
  const mainStore = makeFakeStore();
  const guardedMain = wrapStoreForBranchGuard(mainStore, { WORKERS_CI: '1', WORKERS_CI_BRANCH: 'main' });
  await guardedMain.putObject('articles/a.html', 'x', { contentType: 'text/html', sha256: sha256Of('x') });
  assert.equal(mainStore.objects.has('articles/a.html'), true);

  const localStore = makeFakeStore();
  const guardedLocal = wrapStoreForBranchGuard(localStore, {});
  await guardedLocal.putObject('articles/a.html', 'x', { contentType: 'text/html', sha256: sha256Of('x') });
  assert.equal(localStore.objects.has('articles/a.html'), true);
});

test('archive-sync: runPreSync — on a non-main CI branch, no R2 calls are made at all (treated as disabled)', async () => {
  const entries = [{ kind: 'article', key: 'articles/a.html', path: '/cat/a-uuid' }];
  await withTempRoot(entries, {}, async (root) => {
    let created = false;
    const { result } = await runPreSync({
      root,
      env: { WORKERS_CI: '1', WORKERS_CI_BRANCH: 'develop' },
      hasR2CredentialsFn: trueCreds, // credentials ARE present (the leaked-secret scenario) — guard must still block
      createStore: async () => {
        created = true;
        return makeFakeStore();
      },
    });
    assert.equal(result.disabled, true);
    assert.match(result.alerts[0], /WORKERS_CI branch guard/);
    assert.equal(created, false);
    assert.equal(existsSync(clientFileFor(root, entries[0].path)), true);
  });
});

test('archive-sync: runPreSync — on the main CI branch, writes proceed normally', async () => {
  const entries = [{ kind: 'article', key: 'articles/a.html', path: '/cat/a-uuid' }];
  await withTempRoot(entries, {}, async (root) => {
    const store = makeFakeStore();
    const { result } = await runPreSync({
      root,
      env: { WORKERS_CI: '1', WORKERS_CI_BRANCH: 'main' },
      hasR2CredentialsFn: trueCreds,
      createStore: async () => store,
    });
    assert.equal(result.disabled, false);
    assert.equal(result.uploaded, 1);
  });
});

test('archive-sync: runPreSync — a local run (no WORKERS_CI) proceeds normally', async () => {
  const entries = [{ kind: 'article', key: 'articles/a.html', path: '/cat/a-uuid' }];
  await withTempRoot(entries, {}, async (root) => {
    const store = makeFakeStore();
    const { result } = await runPreSync({
      root,
      env: {},
      hasR2CredentialsFn: trueCreds,
      createStore: async () => store,
    });
    assert.equal(result.disabled, false);
    assert.equal(result.uploaded, 1);
  });
});

// ---------------------------------------------------------------------------
// Result-line shape and r2-client/wrangler.jsonc bucket-name agreement
// ---------------------------------------------------------------------------

test('archive-sync: the result object is JSON-serializable and carries every ARCHIVE_SYNC_RESULT field', async () => {
  const entries = [{ kind: 'article', key: 'articles/a.html', path: '/cat/a-uuid' }];
  await withTempRoot(entries, {}, async (root) => {
    const store = makeFakeStore();
    const { result } = await runPreSync({ root, env: {}, hasR2CredentialsFn: trueCreds, createStore: async () => store });
    const roundTripped = JSON.parse(JSON.stringify(result));
    for (const field of ['phase', 'uploaded', 'failed', 'deferred', 'movedBack', 'deleted', 'backlog', 'alerts', 'dailyReport', 'disabled']) {
      assert.ok(field in roundTripped, `missing field: ${field}`);
    }
  });
});

test("archive-sync: r2-client's ARCHIVE_BUCKET_NAME equals the bucket_name of the ARCHIVE_BUCKET binding in wrangler.jsonc", async () => {
  const wranglerRaw = readFileSync(resolve(process.cwd(), 'wrangler.jsonc'), 'utf8');
  const match = wranglerRaw.match(/"binding":\s*"ARCHIVE_BUCKET"[\s\S]{0,200}?"bucket_name":\s*"([^"]+)"/);
  assert.ok(match, 'ARCHIVE_BUCKET binding not found in wrangler.jsonc');
  const { ARCHIVE_BUCKET_NAME } = await import('../../src/lib/server/r2-client.ts');
  assert.equal(ARCHIVE_BUCKET_NAME, match[1]);
});
