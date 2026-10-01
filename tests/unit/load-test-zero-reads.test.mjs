// 05-04 Tasks 1-2: ARCH-01's zero-reads gate instrument — comparable-window baseline statistics,
// the deployed-binding check (leg 1b), the request mix, and every INCONCLUSIVE validity rule
// from must_haves.truths. Node's built-in `node --test` runner, no network access — every
// GraphQL/HTTP boundary is exercised via an injected `fetchImpl` fake, matching this project's own
// `tools/ci-build.mjs` testing convention.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PRODUCTION_D1_DATABASE_ID,
  PUBLIC_WORKER_SCRIPT,
  comparableWindows,
  summarizeBaseline,
  detectionFloor,
  fetchD1RowsRead,
  checkD1AnalyticsCaughtUp,
  parseDeployedBindings,
  fetchDeployedBindings,
  buildRequestMix,
  windowTouchesIngestSlot,
  decideZeroReadsVerdict,
  runPreflight,
  runPass,
  runLoadTest,
  HOT_ARTICLE_SAMPLE,
  ARCHIVED_ARTICLE_SAMPLE,
  STATIC_TAG_SAMPLE,
  ARCHIVED_TAG_SAMPLE,
} from '../../tools/load-test-zero-reads.mjs';

const d1BaselineFixture = JSON.parse(
  readFileSync(new URL('../fixtures/graphql/d1-baseline-windows.json', import.meta.url))
);

function jsonResponse(body, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

// ---------------------------------------------------------------------------
// comparableWindows
// ---------------------------------------------------------------------------

test('comparableWindows: returns 7 windows at the same UTC clock time on each of the previous 7 days, aligned outward to 5-minute boundaries', () => {
  const windows = comparableWindows({ start: '2026-09-30T04:07:00.000Z', end: '2026-09-30T04:13:00.000Z' }, 7);
  assert.equal(windows.length, 7);
  // start floored to :05, end ceiled to :15 -> 10-minute aligned window.
  // Oldest first: windows[0] is 7 days ago, windows[last] is 1 day ago.
  assert.equal(windows[0].start, '2026-09-23T04:05:00.000Z');
  assert.equal(windows[0].end, '2026-09-23T04:15:00.000Z');
  assert.equal(windows[windows.length - 1].start, '2026-09-29T04:05:00.000Z');
  assert.equal(windows[windows.length - 1].end, '2026-09-29T04:15:00.000Z');
  for (const w of windows) {
    const durationMs = new Date(w.end).getTime() - new Date(w.start).getTime();
    assert.equal(durationMs, 10 * 60 * 1000);
  }
});

test('comparableWindows: throws on an invalid or inverted range', () => {
  assert.throws(() => comparableWindows({ start: 'not-a-date', end: '2026-09-30T04:13:00.000Z' }, 7));
  assert.throws(() => comparableWindows({ start: '2026-09-30T04:13:00.000Z', end: '2026-09-30T04:07:00.000Z' }, 7));
});

// ---------------------------------------------------------------------------
// summarizeBaseline
// ---------------------------------------------------------------------------

test('summarizeBaseline: returns mean, sample standard deviation, median and n', () => {
  const stats = summarizeBaseline([10, 12, 11, 13, 12, 11, 12]);
  assert.equal(stats.n, 7);
  assert.equal(stats.mean, (10 + 12 + 11 + 13 + 12 + 11 + 12) / 7);
  assert.equal(stats.median, 12);
  // sample (n-1) variance, not population (n) variance
  const mean = stats.mean;
  const sampleVariance =
    [10, 12, 11, 13, 12, 11, 12].reduce((acc, v) => acc + (v - mean) ** 2, 0) / (7 - 1);
  assert.ok(Math.abs(stats.stdDev - Math.sqrt(sampleVariance)) < 1e-9);
});

test('summarizeBaseline: throws on an empty array', () => {
  assert.throws(() => summarizeBaseline([]));
});

// ---------------------------------------------------------------------------
// detectionFloor
// ---------------------------------------------------------------------------

test('detectionFloor: equals 3 * sigma / requests', () => {
  assert.equal(detectionFloor(100, 3000), (3 * 100) / 3000);
  assert.equal(detectionFloor(0, 3000), 0);
});

test('detectionFloor: throws when requests is not positive', () => {
  assert.throws(() => detectionFloor(100, 0));
  assert.throws(() => detectionFloor(100, -1));
});

// ---------------------------------------------------------------------------
// queryCloudflareGraphql error handling (re-exercised through fetchD1RowsRead's own call site)
// ---------------------------------------------------------------------------

test('fetchD1RowsRead: a GraphQL errors response throws "cf-graphql: <first error message>" with the token redacted', async () => {
  const token = 'a'.repeat(50);
  let call = 0;
  const fetchImpl = async () => {
    call += 1;
    if (call <= 2) {
      // introspection calls succeed first
      return jsonResponse({ data: { __type: { fields: [{ name: 'rowsRead' }, { name: 'datetimeFiveMinutes' }] } } });
    }
    return jsonResponse({ errors: [{ message: `D1 query failed for token ${token}` }] });
  };
  await assert.rejects(
    () =>
      fetchD1RowsRead(
        { start: '2026-09-30T00:00:00.000Z', end: '2026-09-30T00:10:00.000Z' },
        { fetchImpl, env: { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: 'acct' } }
      ),
    (err) => {
      assert.match(err.message, /^cf-graphql: D1 query failed for token \[REDACTED\]$/);
      assert.ok(!err.message.includes(token));
      return true;
    }
  );
});

test('fetchD1RowsRead: confirms via introspection that the D1 dataset exposes rowsRead and datetimeFiveMinutes before querying it', async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    const body = JSON.parse(opts.body);
    calls.push(body.variables?.name ?? 'query');
    if (body.variables?.name === 'AccountD1AnalyticsAdaptiveGroupsSum') {
      return jsonResponse({ data: { __type: { fields: [{ name: 'rowsRead' }] } } });
    }
    if (body.variables?.name === 'AccountD1AnalyticsAdaptiveGroupsDimensions') {
      return jsonResponse({ data: { __type: { fields: [{ name: 'datetimeFiveMinutes' }] } } });
    }
    return jsonResponse({
      data: { viewer: { accounts: [{ d1AnalyticsAdaptiveGroups: [{ sum: { rowsRead: 500000 } }] }] } },
    });
  };
  const total = await fetchD1RowsRead(
    { start: '2026-09-30T00:00:00.000Z', end: '2026-09-30T00:10:00.000Z' },
    { fetchImpl, env: { CLOUDFLARE_API_TOKEN: 'tok', CLOUDFLARE_ACCOUNT_ID: 'acct' } }
  );
  assert.equal(total, 500000);
  assert.deepEqual(calls.slice(0, 2), ['AccountD1AnalyticsAdaptiveGroupsSum', 'AccountD1AnalyticsAdaptiveGroupsDimensions']);
});

test('fetchD1RowsRead: throws when introspection reveals the schema no longer has rowsRead or datetimeFiveMinutes', async () => {
  const fetchImplMissingSum = async (url, opts) => {
    const body = JSON.parse(opts.body);
    if (body.variables?.name === 'AccountD1AnalyticsAdaptiveGroupsSum') {
      return jsonResponse({ data: { __type: { fields: [{ name: 'rowsWritten' }] } } });
    }
    return jsonResponse({ data: { __type: { fields: [{ name: 'datetimeFiveMinutes' }] } } });
  };
  await assert.rejects(
    () =>
      fetchD1RowsRead(
        { start: '2026-09-30T00:00:00.000Z', end: '2026-09-30T00:10:00.000Z' },
        { fetchImpl: fetchImplMissingSum, env: { CLOUDFLARE_API_TOKEN: 'tok', CLOUDFLARE_ACCOUNT_ID: 'acct' } }
      ),
    /no rowsRead field/
  );
});

test('fetchD1RowsRead: sums rowsRead from the recorded fixture response across all returned 5-minute groups', async () => {
  const sample = d1BaselineFixture.windows[0];
  let call = 0;
  const fetchImpl = async () => {
    call += 1;
    if (call === 1) return jsonResponse({ data: { __type: { fields: [{ name: 'rowsRead' }] } } });
    if (call === 2) return jsonResponse({ data: { __type: { fields: [{ name: 'datetimeFiveMinutes' }] } } });
    return jsonResponse(sample.response);
  };
  const total = await fetchD1RowsRead(sample.window, {
    fetchImpl,
    env: { CLOUDFLARE_API_TOKEN: 'tok', CLOUDFLARE_ACCOUNT_ID: 'acct' },
  });
  assert.equal(total, sample.totalRowsRead);
});

test('fetchD1RowsRead: the query filters on PRODUCTION_D1_DATABASE_ID and no other database id appears', async () => {
  let queryBody;
  const fetchImpl = async (url, opts) => {
    const body = JSON.parse(opts.body);
    if (body.variables?.name) {
      return jsonResponse({ data: { __type: { fields: [{ name: 'rowsRead' }, { name: 'datetimeFiveMinutes' }] } } });
    }
    queryBody = body;
    return jsonResponse({ data: { viewer: { accounts: [{ d1AnalyticsAdaptiveGroups: [] }] } } });
  };
  await fetchD1RowsRead(
    { start: '2026-09-30T00:00:00.000Z', end: '2026-09-30T00:10:00.000Z' },
    { fetchImpl, env: { CLOUDFLARE_API_TOKEN: 'tok', CLOUDFLARE_ACCOUNT_ID: 'acct' } }
  );
  assert.equal(queryBody.variables.databaseId, PRODUCTION_D1_DATABASE_ID);
  assert.equal(PRODUCTION_D1_DATABASE_ID, '552ba1d1-024a-4dee-bdaa-3ffd4bdb1f77');
});

// ---------------------------------------------------------------------------
// checkD1AnalyticsCaughtUp — the live analytics-freshness poll (05-12 fix)
// ---------------------------------------------------------------------------

test('checkD1AnalyticsCaughtUp: true when at least one data point exists at or after the given instant', async () => {
  let queryBody;
  const fetchImpl = async (url, opts) => {
    queryBody = JSON.parse(opts.body);
    return jsonResponse({
      data: {
        viewer: {
          accounts: [
            {
              d1AnalyticsAdaptiveGroups: [
                { dimensions: { datetimeFiveMinutes: '2026-09-30T05:15:00Z' } },
              ],
            },
          ],
        },
      },
    });
  };
  const caughtUp = await checkD1AnalyticsCaughtUp('2026-09-30T05:15:00.000Z', {
    fetchImpl,
    env: { CLOUDFLARE_API_TOKEN: 'tok', CLOUDFLARE_ACCOUNT_ID: 'acct' },
  });
  assert.equal(caughtUp, true);
  assert.equal(queryBody.variables.databaseId, PRODUCTION_D1_DATABASE_ID);
  assert.equal(queryBody.variables.at, '2026-09-30T05:15:00.000Z');
});

test('checkD1AnalyticsCaughtUp: false when no data point exists yet at or after the given instant', async () => {
  const fetchImpl = async () =>
    jsonResponse({ data: { viewer: { accounts: [{ d1AnalyticsAdaptiveGroups: [] }] } } });
  const caughtUp = await checkD1AnalyticsCaughtUp('2026-09-30T05:15:00.000Z', {
    fetchImpl,
    env: { CLOUDFLARE_API_TOKEN: 'tok', CLOUDFLARE_ACCOUNT_ID: 'acct' },
  });
  assert.equal(caughtUp, false);
});

// ---------------------------------------------------------------------------
// parseDeployedBindings / fetchDeployedBindings
// ---------------------------------------------------------------------------

test('parseDeployedBindings: returns the binding type list', () => {
  const types = parseDeployedBindings({
    result: { bindings: [{ name: 'ASSETS', type: 'assets' }, { name: 'RENDER_MANIFEST', type: 'kv_namespace' }] },
  });
  assert.deepEqual(types, ['assets', 'kv_namespace']);
});

test('parseDeployedBindings: hasD1Binding is true only when a D1-typed binding is present', async () => {
  const withoutD1 = parseDeployedBindings({ result: { bindings: [{ type: 'assets' }, { type: 'kv_namespace' }] } });
  assert.equal(withoutD1.includes('d1'), false);
  const withD1 = parseDeployedBindings({ result: { bindings: [{ type: 'assets' }, { type: 'd1' }] } });
  assert.equal(withD1.includes('d1'), true);
});

test('parseDeployedBindings: throws when the response is missing result.bindings', () => {
  assert.throws(() => parseDeployedBindings({}));
  assert.throws(() => parseDeployedBindings({ result: {} }));
});

test('fetchDeployedBindings: reports hasD1Binding false for the real 915tldr-v2 binding shape (no D1)', async () => {
  const fetchImpl = async (url) => {
    assert.match(url, new RegExp(`/workers/scripts/${PUBLIC_WORKER_SCRIPT}/settings$`));
    return jsonResponse({
      success: true,
      result: { bindings: [{ name: 'ASSETS', type: 'assets' }, { name: 'RENDER_MANIFEST', type: 'kv_namespace' }] },
    });
  };
  const result = await fetchDeployedBindings({ fetchImpl, env: { CLOUDFLARE_API_TOKEN: 'tok', CLOUDFLARE_ACCOUNT_ID: 'acct' } });
  assert.equal(result.hasD1Binding, false);
});

test('fetchDeployedBindings: reports hasD1Binding true when a d1-typed binding is present', async () => {
  const fetchImpl = async () =>
    jsonResponse({ success: true, result: { bindings: [{ type: 'assets' }, { type: 'd1' }] } });
  const result = await fetchDeployedBindings({ fetchImpl, env: { CLOUDFLARE_API_TOKEN: 'tok', CLOUDFLARE_ACCOUNT_ID: 'acct' } });
  assert.equal(result.hasD1Binding, true);
});

// ---------------------------------------------------------------------------
// buildRequestMix
// ---------------------------------------------------------------------------

function mixInputFixture(overrides = {}) {
  return {
    categories: ['crime', 'politics', 'sports', 'business', 'education', 'community', 'health', 'weather'],
    hotArticlePaths: Array.from({ length: 25 }, (_, i) => `/crime/hot-${i}-uuid${i}`),
    archivedArticlePaths: Array.from({ length: 25 }, (_, i) => `/crime/archived-${i}-uuid${i}`),
    staticTagPaths: Array.from({ length: 15 }, (_, i) => `/tag/static-${i}`),
    archivedTagPaths: Array.from({ length: 15 }, (_, i) => `/tag/archived-${i}`),
    ...overrides,
  };
}

test('buildRequestMix: returns exactly 71 unique paths in the documented shape', () => {
  const mix = buildRequestMix(mixInputFixture());
  assert.equal(mix.length, 71);
  assert.equal(new Set(mix).size, 71);
  assert.equal(mix[0], '/');
  for (const category of mixInputFixture().categories) {
    assert.ok(mix.includes(`/${category}`));
  }
  assert.ok(mix.includes('/sitemap-index.xml'));
  assert.ok(mix.includes('/rss.xml'));
  const hotCount = mix.filter((p) => p.includes('/crime/hot-')).length;
  const archivedCount = mix.filter((p) => p.includes('/crime/archived-')).length;
  const staticTagCount = mix.filter((p) => p.startsWith('/tag/static-')).length;
  const archivedTagCount = mix.filter((p) => p.startsWith('/tag/archived-')).length;
  assert.equal(hotCount, HOT_ARTICLE_SAMPLE);
  assert.equal(archivedCount, ARCHIVED_ARTICLE_SAMPLE);
  assert.equal(staticTagCount, STATIC_TAG_SAMPLE);
  assert.equal(archivedTagCount, ARCHIVED_TAG_SAMPLE);
});

test('buildRequestMix: selection is deterministic for a given seed', () => {
  const mixA = buildRequestMix(mixInputFixture({ seed: 7 }));
  const mixB = buildRequestMix(mixInputFixture({ seed: 7 }));
  assert.deepEqual(mixA, mixB);
});

test('buildRequestMix: throws when fewer than 20 archived articles are available', () => {
  assert.throws(
    () => buildRequestMix(mixInputFixture({ archivedArticlePaths: Array.from({ length: 19 }, (_, i) => `/a-${i}`) })),
    /at least 20 archived article paths/
  );
});

test('buildRequestMix: throws when fewer than 10 archived tags are available', () => {
  assert.throws(
    () => buildRequestMix(mixInputFixture({ archivedTagPaths: Array.from({ length: 9 }, (_, i) => `/tag/a-${i}`) })),
    /at least 10 archived tag paths/
  );
});

// ---------------------------------------------------------------------------
// windowTouchesIngestSlot
// ---------------------------------------------------------------------------

test('windowTouchesIngestSlot: true for a window inside an even UTC hour before :20', () => {
  assert.equal(windowTouchesIngestSlot('2026-09-30T04:05:00.000Z', '2026-09-30T04:15:00.000Z'), true);
});

test('windowTouchesIngestSlot: false for a window inside an even UTC hour after :20', () => {
  assert.equal(windowTouchesIngestSlot('2026-09-30T04:25:00.000Z', '2026-09-30T04:35:00.000Z'), false);
});

test('windowTouchesIngestSlot: false for a window entirely inside an odd UTC hour', () => {
  assert.equal(windowTouchesIngestSlot('2026-09-30T05:05:00.000Z', '2026-09-30T05:15:00.000Z'), false);
});

// ---------------------------------------------------------------------------
// decideZeroReadsVerdict
// ---------------------------------------------------------------------------

const BASELINE_7 = summarizeBaseline([700000, 750000, 745000, 900000, 1000000, 757000, 900000]);

test('decideZeroReadsVerdict: PASS when the window is valid, load <= mean + 3*sigma, and no D1 binding', () => {
  const result = decideZeroReadsVerdict({
    baseline: BASELINE_7,
    loadRowsRead: BASELINE_7.mean,
    hasD1Binding: false,
    requests: { sent: 3000, completed: 3000 },
  });
  assert.equal(result.verdict, 'PASS');
});

test('decideZeroReadsVerdict: FAIL when the window is valid and load exceeds mean + 3*sigma', () => {
  const result = decideZeroReadsVerdict({
    baseline: BASELINE_7,
    loadRowsRead: BASELINE_7.mean + 10 * BASELINE_7.stdDev,
    hasD1Binding: false,
    requests: { sent: 3000, completed: 3000 },
  });
  assert.equal(result.verdict, 'FAIL');
});

test('decideZeroReadsVerdict: FAIL when a D1 binding is present, regardless of the delta', () => {
  const result = decideZeroReadsVerdict({
    baseline: BASELINE_7,
    loadRowsRead: BASELINE_7.mean, // well within bound
    hasD1Binding: true,
    requests: { sent: 3000, completed: 3000 },
  });
  assert.equal(result.verdict, 'FAIL');
  assert.match(result.reason, /D1 binding/);
});

test('decideZeroReadsVerdict: INCONCLUSIVE — build overlap', () => {
  const result = decideZeroReadsVerdict({ baseline: BASELINE_7, loadRowsRead: 1, hasD1Binding: false, buildOverlap: true });
  assert.equal(result.verdict, 'INCONCLUSIVE');
  assert.match(result.rule, /build-overlap/);
});

test('decideZeroReadsVerdict: INCONCLUSIVE — touches the v1 ingest slot', () => {
  const result = decideZeroReadsVerdict({
    baseline: BASELINE_7,
    loadRowsRead: 1,
    hasD1Binding: false,
    touchesIngestSlot: true,
  });
  assert.equal(result.verdict, 'INCONCLUSIVE');
  assert.match(result.rule, /ingest-slot/);
});

test('decideZeroReadsVerdict: INCONCLUSIVE — analytics not caught up past the window end', () => {
  const result = decideZeroReadsVerdict({
    baseline: BASELINE_7,
    loadRowsRead: null,
    hasD1Binding: false,
    analyticsNotCaughtUp: true,
  });
  assert.equal(result.verdict, 'INCONCLUSIVE');
  assert.match(result.rule, /analytics-not-caught-up/);
});

test('decideZeroReadsVerdict: INCONCLUSIVE — fewer than 5 usable baseline samples', () => {
  const thinBaseline = summarizeBaseline([1, 2, 3]);
  const result = decideZeroReadsVerdict({ baseline: thinBaseline, loadRowsRead: 1, hasD1Binding: false });
  assert.equal(result.verdict, 'INCONCLUSIVE');
  assert.match(result.rule, /insufficient-baseline/);
});

test('decideZeroReadsVerdict: INCONCLUSIVE — missing baseline entirely', () => {
  const result = decideZeroReadsVerdict({ baseline: null, loadRowsRead: 1, hasD1Binding: false });
  assert.equal(result.verdict, 'INCONCLUSIVE');
  assert.match(result.rule, /insufficient-baseline/);
});

test('decideZeroReadsVerdict: INCONCLUSIVE — a zero-total window (broken check, not a quiet database)', () => {
  const result = decideZeroReadsVerdict({
    baseline: BASELINE_7,
    loadRowsRead: 500,
    hasD1Binding: false,
    zeroTotalWindow: true,
  });
  assert.equal(result.verdict, 'INCONCLUSIVE');
  assert.match(result.rule, /zero-total-window/);
});

test('decideZeroReadsVerdict: INCONCLUSIVE — fewer than 95% of planned requests completed', () => {
  const result = decideZeroReadsVerdict({
    baseline: BASELINE_7,
    loadRowsRead: 500,
    hasD1Binding: false,
    requestsCompletedRatio: 0.9,
  });
  assert.equal(result.verdict, 'INCONCLUSIVE');
  assert.match(result.rule, /incomplete-pass/);
});

test('decideZeroReadsVerdict: INCONCLUSIVE — an archived URL was not confirmed served via the archive path', () => {
  const result = decideZeroReadsVerdict({
    baseline: BASELINE_7,
    loadRowsRead: 500,
    hasD1Binding: false,
    unconfirmedArchivedUrl: true,
  });
  assert.equal(result.verdict, 'INCONCLUSIVE');
  assert.match(result.rule, /unconfirmed-archive-path/);
});

test('decideZeroReadsVerdict: the result object always includes requests, window, baseline, loadRowsRead, excess, zScore and detectionFloorRowsPerRequest', () => {
  const result = decideZeroReadsVerdict({
    baseline: BASELINE_7,
    loadRowsRead: BASELINE_7.mean,
    hasD1Binding: false,
    requests: { sent: 3000, completed: 3000 },
    window: { start: 'a', end: 'b' },
  });
  assert.ok('requests' in result);
  assert.ok('window' in result);
  assert.ok('baseline' in result);
  assert.ok('loadRowsRead' in result);
  assert.ok('excess' in result);
  assert.ok('zScore' in result);
  assert.ok('detectionFloorRowsPerRequest' in result);
  assert.equal(result.detectionFloorRowsPerRequest, detectionFloor(BASELINE_7.stdDev, 3000));
});

// ---------------------------------------------------------------------------
// runPreflight
// ---------------------------------------------------------------------------

function headerResponse(serverTiming) {
  return {
    headers: { get: (name) => (name.toLowerCase() === 'server-timing' ? serverTiming : null) },
  };
}

test('runPreflight: ok when every hot URL lacks the archive metric and every archived URL has it', async () => {
  const fetchImpl = async (url) => {
    if (url.includes('/hot/')) return headerResponse('cf-cache-status;desc=HIT');
    return headerResponse('archive;desc=r2');
  };
  const result = await runPreflight({
    hotPaths: ['/hot/1', '/hot/2'],
    archivedPaths: ['/archived/1', '/archived/2'],
    baseUrl: 'https://dev.915tldr.com',
    fetchImpl,
  });
  assert.equal(result.ok, true);
});

test('runPreflight: INCONCLUSIVE-shaped failure when an archived URL lacks the archive Server-Timing metric', async () => {
  const fetchImpl = async (url) => {
    if (url.includes('/archived/')) return headerResponse(null);
    return headerResponse(null);
  };
  const result = await runPreflight({
    hotPaths: ['/hot/1'],
    archivedPaths: ['/archived/1'],
    baseUrl: 'https://dev.915tldr.com',
    fetchImpl,
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /lacked the archive Server-Timing metric/);
});

test('runPreflight: failure when a hot URL unexpectedly carries the archive metric', async () => {
  const fetchImpl = async () => headerResponse('archive;desc=r2');
  const result = await runPreflight({
    hotPaths: ['/hot/1'],
    archivedPaths: [],
    baseUrl: 'https://dev.915tldr.com',
    fetchImpl,
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /unexpectedly carried/);
});

// ---------------------------------------------------------------------------
// runPass — schedule, headers, rate
// ---------------------------------------------------------------------------

test('runPass: repeats the mix to reach the requested total, alternating navigation and plain headers, never exceeding the configured rate under a fake clock', async () => {
  const mix = ['/a', '/b', '/c'];
  const sentHeaders = [];
  const sleepCalls = [];
  const fetchImpl = async (url, opts) => {
    sentHeaders.push(opts.headers);
    return { status: 200, headers: { get: () => null } };
  };
  const sleep = async (ms) => {
    sleepCalls.push(ms);
  };
  const result = await runPass({
    mix,
    totalRequests: 10,
    baseUrl: 'https://dev.915tldr.com',
    concurrency: 2,
    ratePerSecond: 10,
    fetchImpl,
    sleep,
  });
  assert.equal(result.sent, 10);
  assert.equal(result.completed, 10);
  assert.equal(result.completionRatio, 1);
  // Alternates navigate ('Sec-Fetch-Mode' present) / plain (empty object) by position.
  assert.ok(sentHeaders[0]['Sec-Fetch-Mode']);
  assert.ok(!sentHeaders[1]['Sec-Fetch-Mode']);
  assert.ok(sleepCalls.length > 0);
  for (const ms of sleepCalls) assert.ok(ms > 0);
});

test('runPass: refuses to exceed MAX_REQUESTS', async () => {
  await assert.rejects(
    () => runPass({ mix: ['/a'], totalRequests: 20_001, baseUrl: 'https://x', fetchImpl: async () => ({ status: 200, headers: { get: () => null } }) }),
    /MAX_REQUESTS/
  );
});

test('runPass: a failed fetch is counted as not-completed, dropping the completion ratio below 1', async () => {
  let call = 0;
  const fetchImpl = async () => {
    call += 1;
    if (call === 2) throw new Error('network blip');
    return { status: 200, headers: { get: () => null } };
  };
  const result = await runPass({
    mix: ['/a', '/b'],
    totalRequests: 4,
    baseUrl: 'https://dev.915tldr.com',
    concurrency: 4,
    fetchImpl,
    sleep: async () => {},
  });
  assert.equal(result.sent, 4);
  assert.equal(result.completed, 3);
  assert.equal(result.completionRatio, 0.75);
});

// ---------------------------------------------------------------------------
// archive-plan fixture + exports sanity
// ---------------------------------------------------------------------------

test('tests/fixtures/archive-plan.sample.json validates against the 05-06 format', () => {
  const plan = JSON.parse(readFileSync(new URL('../fixtures/archive-plan.sample.json', import.meta.url)));
  assert.equal(plan.version, 1);
  assert.ok(plan.generatedAt);
  assert.ok(plan.hotWindow);
  assert.ok(Number.isInteger(plan.cutoffEpoch));
  assert.ok(plan.counts);
  assert.ok(Array.isArray(plan.entries) && plan.entries.length > 0);
  for (const entry of plan.entries) {
    assert.ok(['article', 'tag'].includes(entry.kind));
    assert.ok(typeof entry.key === 'string');
    assert.ok(typeof entry.path === 'string');
    assert.ok(typeof entry.sha256 === 'string');
    assert.ok(typeof entry.bytes === 'number');
  }
  const archivedArticles = plan.entries.filter((e) => e.kind === 'article');
  const archivedTags = plan.entries.filter((e) => e.kind === 'tag');
  assert.ok(archivedArticles.length >= ARCHIVED_ARTICLE_SAMPLE);
  assert.ok(archivedTags.length >= ARCHIVED_TAG_SAMPLE);
});

test('PUBLIC_WORKER_SCRIPT is the real deployed script name', () => {
  assert.equal(PUBLIC_WORKER_SCRIPT, '915tldr-v2');
});

// ---------------------------------------------------------------------------
// runLoadTest — end-to-end with injected deps (no real network)
// ---------------------------------------------------------------------------

test('runLoadTest: baseline-only mode returns a PASS-irrelevant, exit-0 baseline report', async () => {
  let introspectionsLeft = 2;
  const windowTotals = [700000, 750000, 745000, 900000, 1000000, 757000, 900000];
  let windowIndex = 0;
  const fetchImpl = async (url, opts) => {
    if (url.includes('/graphql')) {
      const body = JSON.parse(opts.body);
      if (body.variables?.name) {
        introspectionsLeft -= 1;
        return jsonResponse({
          data: {
            __type: {
              fields:
                body.variables.name === 'AccountD1AnalyticsAdaptiveGroupsSum'
                  ? [{ name: 'rowsRead' }]
                  : [{ name: 'datetimeFiveMinutes' }],
            },
          },
        });
      }
      const total = windowTotals[windowIndex % windowTotals.length];
      windowIndex += 1;
      return jsonResponse({ data: { viewer: { accounts: [{ d1AnalyticsAdaptiveGroups: [{ sum: { rowsRead: total } }] }] } } });
    }
    // deployed-bindings endpoint
    return jsonResponse({ success: true, result: { bindings: [{ type: 'assets' }, { type: 'kv_namespace' }] } });
  };

  const { exitCode, result } = await runLoadTest({
    baselineOnly: true,
    requests: 3000,
    at: '2026-09-30T04:10:00.000Z',
    deps: { fetchImpl, env: { CLOUDFLARE_API_TOKEN: 'tok', CLOUDFLARE_ACCOUNT_ID: 'acct' } },
  });

  assert.equal(exitCode, 0);
  assert.equal(result.mode, 'baseline-only');
  assert.equal(result.baseline.n, 7);
  assert.equal(result.deployedWorkerHasD1Binding, false);
  assert.ok(result.detectionFloorRowsPerRequest > 0);
});

test('runLoadTest: baseline-only mode throws when a window measures zero total rowsRead', async () => {
  let call = 0;
  const fetchImpl = async (url, opts) => {
    const body = JSON.parse(opts.body);
    if (body.variables?.name) {
      return jsonResponse({
        data: {
          __type: {
            fields:
              body.variables.name === 'AccountD1AnalyticsAdaptiveGroupsSum'
                ? [{ name: 'rowsRead' }]
                : [{ name: 'datetimeFiveMinutes' }],
          },
        },
      });
    }
    call += 1;
    return jsonResponse({ data: { viewer: { accounts: [{ d1AnalyticsAdaptiveGroups: [] }] } } });
  };
  await assert.rejects(
    () =>
      runLoadTest({
        baselineOnly: true,
        requests: 3000,
        at: '2026-09-30T04:10:00.000Z',
        deps: { fetchImpl, env: { CLOUDFLARE_API_TOKEN: 'tok', CLOUDFLARE_ACCOUNT_ID: 'acct' } },
      }),
    /zero total rowsRead/
  );
});

// ---------------------------------------------------------------------------
// runLoadTest — full (non-baseline) pass: the live analytics-catch-up default (05-12 fix)
// ---------------------------------------------------------------------------

function fullPassFetchImpl({ archivedServerTiming = true, caughtUpOnFirstPoll = true, rowsReadTotal = 500000 } = {}) {
  let catchUpCalls = 0;
  const fetchImpl = async (url, opts) => {
    // Preflight + paced pass: plain GETs against the base URL, no JSON body.
    if (!opts?.body) {
      const archived = url.includes('/crime/archived-') || url.startsWith('https://dev.915tldr.com/tag/archived-');
      return {
        status: 200,
        headers: { get: (name) => (name === 'server-timing' ? (archived && archivedServerTiming ? 'archive;desc=r2' : null) : null) },
      };
    }
    const body = JSON.parse(opts.body);
    // Introspection (shared by fetchD1RowsRead).
    if (body.variables?.name) {
      return jsonResponse({
        data: {
          __type: {
            fields:
              body.variables.name === 'AccountD1AnalyticsAdaptiveGroupsSum'
                ? [{ name: 'rowsRead' }]
                : [{ name: 'datetimeFiveMinutes' }],
          },
        },
      });
    }
    // checkD1AnalyticsCaughtUp: has `at`, not `start`/`end`.
    if (body.variables?.at && !body.variables?.start) {
      catchUpCalls += 1;
      const caughtUp = caughtUpOnFirstPoll || catchUpCalls > 1;
      return jsonResponse({
        data: {
          viewer: {
            accounts: [
              { d1AnalyticsAdaptiveGroups: caughtUp ? [{ dimensions: { datetimeFiveMinutes: body.variables.at } }] : [] },
            ],
          },
        },
      });
    }
    // fetchD1RowsRead (load window + 7 baseline windows).
    if (body.variables?.start) {
      return jsonResponse({ data: { viewer: { accounts: [{ d1AnalyticsAdaptiveGroups: [{ sum: { rowsRead: rowsReadTotal } }] }] } } });
    }
    // deployed-bindings REST call (no GraphQL body shape at all — reached via the `!opts?.body`
    // branch above in practice, so this is unreachable, kept only as a safety fallback).
    return jsonResponse({ success: true, result: { bindings: [{ type: 'assets' }, { type: 'kv_namespace' }] } });
  };
  // fetchDeployedBindings calls a REST endpoint (no body at all) — give it its own branch ahead of
  // the plain-GET preflight/pass branch by checking the URL shape first.
  return async (url, opts) => {
    if (url.includes('/workers/scripts/')) {
      return jsonResponse({ success: true, result: { bindings: [{ type: 'assets' }, { type: 'kv_namespace' }] } });
    }
    return fetchImpl(url, opts);
  };
}

test('runLoadTest: full pass — with no deps.checkCaughtUp supplied, defaults to a LIVE checkD1AnalyticsCaughtUp poll (not an unconditional true)', async () => {
  let catchUpQueried = false;
  const baseFetch = fullPassFetchImpl({ caughtUpOnFirstPoll: true });
  const fetchImpl = async (url, opts) => {
    if (opts?.body) {
      const body = JSON.parse(opts.body);
      if (body.variables?.at && !body.variables?.start) catchUpQueried = true;
    }
    return baseFetch(url, opts);
  };

  const { exitCode, result } = await runLoadTest({
    requests: 4,
    requestMixInput: mixInputFixture(),
    deps: {
      fetchImpl,
      env: { CLOUDFLARE_API_TOKEN: 'tok', CLOUDFLARE_ACCOUNT_ID: 'acct' },
      sleep: async () => {},
      now: (() => {
        const times = ['2026-09-30T05:25:00.000Z', '2026-09-30T05:25:00.050Z'];
        let i = 0;
        return () => new Date(times[Math.min(i++, times.length - 1)]);
      })(),
    },
  });

  assert.equal(catchUpQueried, true, 'the live default must perform a real checkD1AnalyticsCaughtUp query');
  assert.notEqual(result.rule, 'analytics-not-caught-up');
  assert.ok(exitCode === 0 || exitCode === 2, `expected a judged verdict, got exitCode=${exitCode} rule=${result.rule}`);
});

test('runLoadTest: full pass — gives up and reports analytics-not-caught-up after the capped wait when the live poll never succeeds', async () => {
  const fetchImpl = fullPassFetchImpl({ caughtUpOnFirstPoll: false });
  // caughtUpOnFirstPoll:false plus catchUpCalls > 1 never becoming true in fullPassFetchImpl's
  // closure (it only flips true on a second call) would falsely succeed on retry #2 — override
  // with a fetchImpl variant that NEVER returns a data point, to genuinely exercise the
  // max-wait-exceeded path.
  const neverCaughtUp = async (url, opts) => {
    if (opts?.body) {
      const body = JSON.parse(opts.body);
      if (body.variables?.at && !body.variables?.start) {
        return jsonResponse({ data: { viewer: { accounts: [{ d1AnalyticsAdaptiveGroups: [] }] } } });
      }
    }
    return fetchImpl(url, opts);
  };

  const { exitCode, result } = await runLoadTest({
    requests: 4,
    requestMixInput: mixInputFixture(),
    deps: {
      fetchImpl: neverCaughtUp,
      env: { CLOUDFLARE_API_TOKEN: 'tok', CLOUDFLARE_ACCOUNT_ID: 'acct' },
      sleep: async () => {}, // no-op — the 15 capped retries run instantly in this test
      now: (() => {
        const times = ['2026-09-30T05:25:00.000Z', '2026-09-30T05:25:00.050Z'];
        let i = 0;
        return () => new Date(times[Math.min(i++, times.length - 1)]);
      })(),
    },
  });

  assert.equal(exitCode, 3);
  assert.match(result.rule, /^analytics-not-caught-up:/);
  assert.equal(result.loadRowsRead, null);
});
