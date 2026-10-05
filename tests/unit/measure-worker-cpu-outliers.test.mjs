// 05-17 Task 1/2: per-request CPU-outlier measurement against the Workers Observability
// telemetry API (dataset `cloudflare-workers`), verified live on 2026-10-02 — see
// docs/phase-05/evidence/cpu-outliers-gate-20261001/api-shape.json for the full verification
// record this fixture and tool are built from. No network access in this file — every API call
// is driven by a fake `fetchImpl` returning the fixture's recorded response shapes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  normalizeInvocationEvent,
  summarizeCpuOutliers,
  fetchInvocationEvents,
  fetchPathEventHistory,
  correlateOutliers,
  findColdStartKeys,
} from '../../tools/measure-worker-cpu-outliers.mjs';

const fixture = JSON.parse(
  readFileSync(new URL('../fixtures/observability-telemetry.sample.json', import.meta.url))
);

function jsonResponse(body, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

// ---------------------------------------------------------------------------
// normalizeInvocationEvent
// ---------------------------------------------------------------------------

test('normalizeInvocationEvent: extracts exactly the allow-listed fields from the verified raw shape', () => {
  const raw = fixture.rawEvents[2]; // the 37ms outlier, business/wall-street-outlier-a
  const normalized = normalizeInvocationEvent(raw);
  assert.deepEqual(normalized, {
    timestamp: raw.timestamp,
    path: '/business/wall-street-outlier-a-33333333-3333-3333-3333-333333333333',
    status: 200,
    cpuTimeMs: 37,
    wallTimeMs: 44,
    scriptVersion: '11111111-1111-1111-1111-111111111111',
    colo: 'LAX',
    outcome: 'ok',
    requestId: 'fixture-request-id-2',
  });
});

test('normalizeInvocationEvent: drops the synthetic client IP, user agent, and every header — only the allow-listed keys ever appear', () => {
  const raw = fixture.rawEvents[0];
  const normalized = normalizeInvocationEvent(raw);
  const serialized = JSON.stringify(normalized);
  assert.doesNotMatch(serialized, /192\.0\.2\.10/);
  assert.doesNotMatch(serialized, /SyntheticAgent/);
  assert.deepEqual(Object.keys(normalized).sort(), [
    'colo',
    'cpuTimeMs',
    'outcome',
    'path',
    'requestId',
    'scriptVersion',
    'status',
    'timestamp',
    'wallTimeMs',
  ]);
});

test('normalizeInvocationEvent: a missing field in the raw shape normalizes to null, not a throw', () => {
  const sparse = { timestamp: 1700000000000, dataset: 'cloudflare-workers', '$workers': {}, '$metadata': {} };
  const normalized = normalizeInvocationEvent(sparse);
  assert.equal(normalized.timestamp, 1700000000000);
  assert.equal(normalized.path, null);
  assert.equal(normalized.status, null);
  assert.equal(normalized.cpuTimeMs, null);
  assert.equal(normalized.wallTimeMs, null);
  assert.equal(normalized.scriptVersion, null);
  assert.equal(normalized.colo, null);
  assert.equal(normalized.outcome, null);
  assert.equal(normalized.requestId, null);
});

// ---------------------------------------------------------------------------
// summarizeCpuOutliers
// ---------------------------------------------------------------------------

test('summarizeCpuOutliers: exact counts for the fixture CPU values [49.966, 40, 37, 26, 7, 2.8, 0.7]', () => {
  const events = fixture.rawEvents.map(normalizeInvocationEvent);
  const summary = summarizeCpuOutliers(events, { budgetMs: 5, hardFailMs: 20 });
  assert.equal(summary.total, 7);
  assert.equal(summary.overBudget, 5); // >= 5ms: 49.966, 40, 37, 26, 7
  assert.equal(summary.overHardFail, 4); // >= 20ms: 49.966, 40, 37, 26
  assert.equal(summary.maxMs, 49.966);
  assert.deepEqual(
    summary.outliers.map((o) => o.cpuTimeMs),
    [49.966, 40, 37, 26, 7]
  );
});

test('summarizeCpuOutliers: p99Ms is computed from the per-request data, not an externally supplied aggregate', () => {
  const events = fixture.rawEvents.map(normalizeInvocationEvent);
  const summary = summarizeCpuOutliers(events, { budgetMs: 5, hardFailMs: 20 });
  assert.equal(typeof summary.p99Ms, 'number');
  assert.ok(summary.p99Ms <= summary.maxMs);
});

test('summarizeCpuOutliers: zero events summarizes to all-zero, not a throw', () => {
  const summary = summarizeCpuOutliers([], { budgetMs: 5, hardFailMs: 20 });
  assert.equal(summary.total, 0);
  assert.equal(summary.overBudget, 0);
  assert.equal(summary.overHardFail, 0);
  assert.equal(summary.maxMs, 0);
  assert.equal(summary.p99Ms, 0);
  assert.deepEqual(summary.outliers, []);
});

// ---------------------------------------------------------------------------
// fetchInvocationEvents — pagination completeness + error redaction
// ---------------------------------------------------------------------------

test('fetchInvocationEvents: a page shorter than the requested limit is treated as complete', async () => {
  const fetchImpl = async () => jsonResponse(fixture.eventsViewApiResponse);
  const events = await fetchInvocationEvents(
    { from: fixture.window.from, to: fixture.window.to, minCpuMs: 0, limit: 1000 },
    { fetchImpl, env: { CLOUDFLARE_API_TOKEN: 'tok', CLOUDFLARE_ACCOUNT_ID: 'acct' } }
  );
  assert.equal(events.length, 7);
});

test('fetchInvocationEvents: a page exactly at the requested limit cannot prove completeness and throws', async () => {
  const fetchImpl = async () => jsonResponse(fixture.eventsViewApiResponseFullPage);
  await assert.rejects(
    () =>
      fetchInvocationEvents(
        { from: fixture.window.from, to: fixture.window.to, minCpuMs: 0, limit: 3 },
        { fetchImpl, env: { CLOUDFLARE_API_TOKEN: 'tok', CLOUDFLARE_ACCOUNT_ID: 'acct' } }
      ),
    /measure-worker-cpu-outliers:.*incomplete/
  );
});

test('fetchInvocationEvents: an API error body throws a prefixed, redacted message', async () => {
  const fetchImpl = async () => jsonResponse(fixture.errorApiResponse, false, 403);
  await assert.rejects(
    () =>
      fetchInvocationEvents(
        { from: fixture.window.from, to: fixture.window.to, minCpuMs: 0, limit: 1000 },
        { fetchImpl, env: { CLOUDFLARE_API_TOKEN: 'super-secret-token-value', CLOUDFLARE_ACCOUNT_ID: 'acct' } }
      ),
    (err) => {
      assert.match(err.message, /^measure-worker-cpu-outliers:/);
      assert.doesNotMatch(err.message, /super-secret-token-value/);
      return true;
    }
  );
});

test('fetchInvocationEvents: passes a server-side $workers.cpuTimeMs filter when minCpuMs > 0 (verified supported — see api-shape.json)', async () => {
  let capturedBody = null;
  const fetchImpl = async (url, opts) => {
    capturedBody = JSON.parse(opts.body);
    return jsonResponse(fixture.eventsViewApiResponse);
  };
  await fetchInvocationEvents(
    { from: fixture.window.from, to: fixture.window.to, minCpuMs: 5, limit: 1000 },
    { fetchImpl, env: { CLOUDFLARE_API_TOKEN: 'tok', CLOUDFLARE_ACCOUNT_ID: 'acct' } }
  );
  assert.equal(capturedBody.view, 'events');
  assert.equal(capturedBody.parameters.datasets[0], 'cloudflare-workers');
  const cpuFilter = capturedBody.parameters.filters.find((f) => f.key === '$workers.cpuTimeMs');
  assert.ok(cpuFilter, 'expected a $workers.cpuTimeMs filter to be sent');
  assert.equal(cpuFilter.operation, 'gt');
  assert.equal(cpuFilter.value, 5);
});

test('fetchPathEventHistory: sends a $workers.event.path eq filter alongside scriptName, and returns every match', async () => {
  let capturedBody = null;
  const fetchImpl = async (url, opts) => {
    capturedBody = JSON.parse(opts.body);
    return jsonResponse(fixture.eventsViewApiResponse);
  };
  const history = await fetchPathEventHistory(
    '/business/wall-street-outlier-a-33333333-3333-3333-3333-333333333333',
    { from: fixture.window.from, to: fixture.window.to },
    { fetchImpl, env: { CLOUDFLARE_API_TOKEN: 'tok', CLOUDFLARE_ACCOUNT_ID: 'acct' } }
  );
  assert.equal(capturedBody.view, 'events');
  const pathFilter = capturedBody.parameters.filters.find((f) => f.key === '$workers.event.path');
  assert.ok(pathFilter, 'expected a $workers.event.path filter to be sent');
  assert.equal(pathFilter.operation, 'eq');
  assert.equal(pathFilter.value, '/business/wall-street-outlier-a-33333333-3333-3333-3333-333333333333');
  assert.equal(history.length, 7);
});

test('fetchPathEventHistory: a full page (length === limit) throws rather than under-reporting a repeat count', async () => {
  const fetchImpl = async () => jsonResponse(fixture.eventsViewApiResponseFullPage);
  await assert.rejects(
    () =>
      fetchPathEventHistory(
        '/some/busy-path',
        { from: fixture.window.from, to: fixture.window.to, limit: 3 },
        { fetchImpl, env: { CLOUDFLARE_API_TOKEN: 'tok', CLOUDFLARE_ACCOUNT_ID: 'acct' } }
      ),
    /measure-worker-cpu-outliers:.*incomplete/
  );
});

// ---------------------------------------------------------------------------
// correlateOutliers
// ---------------------------------------------------------------------------

test('correlateOutliers: the first outlier at its colo in the window gets firstInColoInWindow: true', () => {
  const events = fixture.rawEvents.map(normalizeInvocationEvent);
  const summary = summarizeCpuOutliers(events, { budgetMs: 5, hardFailMs: 20 });
  const correlated = correlateOutliers(summary.outliers, events);
  const dfwFirst = correlated.find((c) => c.cpuTimeMs === 26); // first-ever DFW event in the fixture window
  assert.equal(dfwFirst.firstInColoInWindow, true);
});

test('correlateOutliers: a later repeat of the same path at the same colo gets samePathRank: 2 and samePathCount: 2', () => {
  const events = fixture.rawEvents.map(normalizeInvocationEvent);
  const summary = summarizeCpuOutliers(events, { budgetMs: 5, hardFailMs: 20 });
  const correlated = correlateOutliers(summary.outliers, events);
  const repeat = correlated.find((c) => c.cpuTimeMs === 49.966); // 2nd occurrence of the LAX outlier-a path
  assert.equal(repeat.samePathCount, 2);
  assert.equal(repeat.samePathRank, 2);
  assert.equal(repeat.firstInColoInWindow, false); // LAX's first event in the window was the 0.7ms /tag/el-paso request
});

test('correlateOutliers: a unique path with no repeat gets samePathCount: 1, samePathRank: 1', () => {
  const events = fixture.rawEvents.map(normalizeInvocationEvent);
  const summary = summarizeCpuOutliers(events, { budgetMs: 5, hardFailMs: 20 });
  const correlated = correlateOutliers(summary.outliers, events);
  const unique = correlated.find((c) => c.cpuTimeMs === 40);
  assert.equal(unique.samePathCount, 1);
  assert.equal(unique.samePathRank, 1);
});

test('correlateOutliers: every outlier reports wallTimeMs, cpuTimeMs, and a non-negative offsetFromWindowStartS', () => {
  const events = fixture.rawEvents.map(normalizeInvocationEvent);
  const summary = summarizeCpuOutliers(events, { budgetMs: 5, hardFailMs: 20 });
  const correlated = correlateOutliers(summary.outliers, events);
  for (const c of correlated) {
    assert.equal(typeof c.wallTimeMs, 'number');
    assert.equal(typeof c.cpuTimeMs, 'number');
    assert.ok(c.offsetFromWindowStartS >= 0);
  }
});

test('correlateOutliers: coloAvailable is false and firstInColoInWindow is null when colo is absent from the data', () => {
  const noColoEvents = fixture.rawEvents.map((raw) => {
    const normalized = normalizeInvocationEvent(raw);
    return { ...normalized, colo: null };
  });
  const summary = summarizeCpuOutliers(noColoEvents, { budgetMs: 5, hardFailMs: 20 });
  const correlated = correlateOutliers(summary.outliers, noColoEvents);
  for (const c of correlated) {
    assert.equal(c.coloAvailable, false);
    assert.equal(c.firstInColoInWindow, null);
  }
});

// ---------------------------------------------------------------------------
// findColdStartKeys
// ---------------------------------------------------------------------------

test('findColdStartKeys: returns an empty list (not an error) when the verified key set has no cold/isolate/startup/warm key', () => {
  const keyNames = fixture.keysApiResponse.result.map((k) => k.key);
  assert.deepEqual(findColdStartKeys(keyNames), []);
});

test('findColdStartKeys: matches a cold-start-indicating key name case-insensitively when one exists', () => {
  const keyNames = ['$workers.cpuTimeMs', '$workers.isColdStart', '$workers.warmIsolate'];
  assert.deepEqual(findColdStartKeys(keyNames), ['$workers.isColdStart', '$workers.warmIsolate']);
});
