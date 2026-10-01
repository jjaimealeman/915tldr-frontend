// 05-04 Task 3: ARCH-08's live KV-reads/Worker-CPU measurement — summarizeWorkerWindow's
// microsecond-to-millisecond conversion, decideArch08Verdict's budget lines, and the live dataset
// field filters (namespace, scriptName). No network access — every GraphQL call is driven by a
// fake `fetchImpl`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  RENDER_MANIFEST_NAMESPACE_ID,
  PUBLIC_WORKER_SCRIPT,
  CPU_BUDGET_MS,
  CPU_HARD_FAIL_MS,
  summarizeWorkerWindow,
  decideArch08Verdict,
  fetchWorkerInvocations,
  fetchKvReadOperations,
  detectBuildOverlap,
  runMeasurement,
} from '../../tools/measure-worker-kv-cpu.mjs';

const invocationsFixture = JSON.parse(
  readFileSync(new URL('../fixtures/graphql/workers-invocations.json', import.meta.url))
);
const kvFixture = JSON.parse(readFileSync(new URL('../fixtures/graphql/kv-operations.json', import.meta.url)));

function jsonResponse(body, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

// ---------------------------------------------------------------------------
// summarizeWorkerWindow
// ---------------------------------------------------------------------------

test('summarizeWorkerWindow: converts the recorded fixture (microseconds) into { invocations, kvReads, cpuP50Ms, cpuP99Ms, cpuMaxMs }', () => {
  const summary = summarizeWorkerWindow(invocationsFixture.group, kvFixture.group);
  assert.equal(summary.invocations, 94);
  assert.equal(summary.kvReads, 102);
  assert.equal(summary.cpuP50Ms, 830 / 1000);
  assert.equal(summary.cpuP99Ms, 1883 / 1000);
  assert.equal(summary.cpuMaxMs, 1883 / 1000);
});

test('summarizeWorkerWindow: a missing group summarizes to all-zero, not a throw', () => {
  const summary = summarizeWorkerWindow(null, null);
  assert.deepEqual(summary, { invocations: 0, kvReads: 0, cpuP50Ms: 0, cpuP99Ms: 0, cpuMaxMs: 0 });
});

// ---------------------------------------------------------------------------
// decideArch08Verdict
// ---------------------------------------------------------------------------

test('decideArch08Verdict: kvReads <= invocations -> KV_READS_WITHIN_BUDGET', () => {
  const result = decideArch08Verdict({ invocations: 100, kvReads: 100, cpuP99Ms: 1, cpuMaxMs: 2 });
  assert.equal(result.kv, 'KV_READS_WITHIN_BUDGET');
});

test('decideArch08Verdict: kvReads > invocations -> KV_READS_OVER_BUDGET', () => {
  const result = decideArch08Verdict({ invocations: 100, kvReads: 101, cpuP99Ms: 1, cpuMaxMs: 2 });
  assert.equal(result.kv, 'KV_READS_OVER_BUDGET');
});

test(`decideArch08Verdict: p99 < ${CPU_BUDGET_MS}ms and max < ${CPU_HARD_FAIL_MS}ms -> CPU_WITHIN_BUDGET`, () => {
  const result = decideArch08Verdict({ invocations: 100, kvReads: 50, cpuP99Ms: 4.9, cpuMaxMs: 19.9 });
  assert.equal(result.cpu, 'CPU_WITHIN_BUDGET');
});

test('decideArch08Verdict: p99 >= budget -> CPU_OVER_BUDGET', () => {
  const result = decideArch08Verdict({ invocations: 100, kvReads: 50, cpuP99Ms: 5, cpuMaxMs: 2 });
  assert.equal(result.cpu, 'CPU_OVER_BUDGET');
});

test('decideArch08Verdict: max >= hard-fail -> CPU_OVER_BUDGET even if p99 is fine', () => {
  const result = decideArch08Verdict({ invocations: 100, kvReads: 50, cpuP99Ms: 1, cpuMaxMs: 20 });
  assert.equal(result.cpu, 'CPU_OVER_BUDGET');
});

test('decideArch08Verdict: a window flagged as overlapping a build -> INCONCLUSIVE on both axes', () => {
  const result = decideArch08Verdict({ invocations: 100, kvReads: 50, cpuP99Ms: 1, cpuMaxMs: 2, buildOverlap: true });
  assert.equal(result.verdict, 'INCONCLUSIVE');
  assert.equal(result.kv, 'INCONCLUSIVE');
  assert.equal(result.cpu, 'INCONCLUSIVE');
});

test('decideArch08Verdict: zero invocations -> INCONCLUSIVE (nothing measured)', () => {
  const result = decideArch08Verdict({ invocations: 0, kvReads: 0, cpuP99Ms: 0, cpuMaxMs: 0 });
  assert.equal(result.verdict, 'INCONCLUSIVE');
  assert.match(result.reason, /nothing measured/);
});

test('decideArch08Verdict: PASS only when both axes are within budget', () => {
  const pass = decideArch08Verdict({ invocations: 94, kvReads: 94, cpuP99Ms: 1.8, cpuMaxMs: 1.9 });
  assert.equal(pass.verdict, 'PASS');
  const fail = decideArch08Verdict({ invocations: 94, kvReads: 95, cpuP99Ms: 1.8, cpuMaxMs: 1.9 });
  assert.equal(fail.verdict, 'FAIL');
});

// ---------------------------------------------------------------------------
// fetchWorkerInvocations / fetchKvReadOperations — field filters + introspection
// ---------------------------------------------------------------------------

test('fetchWorkerInvocations: the query filters on scriptName PUBLIC_WORKER_SCRIPT and confirms quantile/max fields by introspection first', async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    const body = JSON.parse(opts.body);
    calls.push(body.variables?.name ?? body.variables?.scriptName ?? 'query');
    if (body.variables?.name === 'AccountWorkersInvocationsAdaptiveQuantiles') {
      return jsonResponse({ data: { __type: { fields: [{ name: 'cpuTimeP50' }, { name: 'cpuTimeP99' }] } } });
    }
    if (body.variables?.name === 'AccountWorkersInvocationsAdaptiveMax') {
      return jsonResponse({ data: { __type: { fields: [{ name: 'cpuTime' }] } } });
    }
    assert.equal(body.variables.scriptName, PUBLIC_WORKER_SCRIPT);
    return jsonResponse(invocationsFixture.response);
  };
  const group = await fetchWorkerInvocations(
    { from: '2026-09-30T00:00:00Z', to: '2026-10-01T00:00:00Z' },
    { fetchImpl, env: { CLOUDFLARE_API_TOKEN: 'tok', CLOUDFLARE_ACCOUNT_ID: 'acct' } }
  );
  assert.equal(group.sum.requests, 94);
  assert.deepEqual(calls.slice(0, 2), ['AccountWorkersInvocationsAdaptiveQuantiles', 'AccountWorkersInvocationsAdaptiveMax']);
});

test('fetchWorkerInvocations: throws when introspection reveals cpuTimeP50/cpuTimeP99 are gone', async () => {
  const fetchImpl = async (url, opts) => {
    const body = JSON.parse(opts.body);
    if (body.variables?.name === 'AccountWorkersInvocationsAdaptiveQuantiles') {
      return jsonResponse({ data: { __type: { fields: [{ name: 'durationP50' }] } } });
    }
    return jsonResponse({ data: { __type: { fields: [{ name: 'cpuTime' }] } } });
  };
  await assert.rejects(
    () =>
      fetchWorkerInvocations(
        { from: '2026-09-30T00:00:00Z', to: '2026-10-01T00:00:00Z' },
        { fetchImpl, env: { CLOUDFLARE_API_TOKEN: 'tok', CLOUDFLARE_ACCOUNT_ID: 'acct' } }
      ),
    /cpuTimeP50/
  );
});

test('fetchKvReadOperations: the query filters on namespaceId RENDER_MANIFEST_NAMESPACE_ID and read operations only', async () => {
  const fetchImpl = async (url, opts) => {
    const body = JSON.parse(opts.body);
    if (body.variables?.name === 'AccountKvOperationsAdaptiveGroupsSum') {
      return jsonResponse({ data: { __type: { fields: [{ name: 'requests' }] } } });
    }
    if (body.variables?.name === 'AccountKvOperationsAdaptiveGroupsDimensions') {
      return jsonResponse({ data: { __type: { fields: [{ name: 'actionType' }, { name: 'namespaceId' }] } } });
    }
    assert.equal(body.variables.namespaceId, RENDER_MANIFEST_NAMESPACE_ID);
    assert.match(body.query, /actionType: "read"/);
    return jsonResponse(kvFixture.response);
  };
  const group = await fetchKvReadOperations(
    { from: '2026-09-30T00:00:00Z', to: '2026-10-01T00:00:00Z' },
    { fetchImpl, env: { CLOUDFLARE_API_TOKEN: 'tok', CLOUDFLARE_ACCOUNT_ID: 'acct' } }
  );
  assert.equal(group.sum.requests, 102);
});

// ---------------------------------------------------------------------------
// detectBuildOverlap
// ---------------------------------------------------------------------------

test('detectBuildOverlap: --assume-no-build mode is documented as weaker and never fetches', async () => {
  let fetchCalled = false;
  const result = await detectBuildOverlap({
    baseUrl: 'https://dev.915tldr.com',
    assumeNoBuild: true,
    fetchImpl: async () => {
      fetchCalled = true;
      return jsonResponse({ commit: 'a', builtAt: '1' });
    },
  });
  assert.equal(result.overlap, false);
  assert.match(result.method, /assume-no-build/);
  assert.equal(fetchCalled, false);
});

test('detectBuildOverlap: version.json before/after mode detects a build when commit or builtAt changed', async () => {
  let call = 0;
  const fetchImpl = async () => {
    call += 1;
    return jsonResponse(call === 1 ? { commit: 'abc1234', builtAt: 't1' } : { commit: 'def5678', builtAt: 't2' });
  };
  const result = await detectBuildOverlap({ baseUrl: 'https://dev.915tldr.com', fetchImpl });
  assert.equal(result.overlap, true);
  assert.match(result.method, /version\.json/);
});

test('detectBuildOverlap: version.json before/after mode reports no overlap when both reads match', async () => {
  const fetchImpl = async () => jsonResponse({ commit: 'abc1234', builtAt: 't1' });
  const result = await detectBuildOverlap({ baseUrl: 'https://dev.915tldr.com', fetchImpl });
  assert.equal(result.overlap, false);
});

// ---------------------------------------------------------------------------
// runMeasurement — end-to-end with injected deps
// ---------------------------------------------------------------------------

test('runMeasurement: end-to-end with the recorded fixtures reports the real measured verdict (KV over budget, CPU within budget — the live fixture genuinely shows 102 reads against 94 invocations)', async () => {
  const fetchImpl = async (url, opts) => {
    if (url.includes('/version.json')) return jsonResponse({ commit: 'abc1234', builtAt: 't1' });
    const body = JSON.parse(opts.body);
    if (body.variables?.name === 'AccountWorkersInvocationsAdaptiveQuantiles') {
      return jsonResponse({ data: { __type: { fields: [{ name: 'cpuTimeP50' }, { name: 'cpuTimeP99' }] } } });
    }
    if (body.variables?.name === 'AccountWorkersInvocationsAdaptiveMax') {
      return jsonResponse({ data: { __type: { fields: [{ name: 'cpuTime' }] } } });
    }
    if (body.variables?.name === 'AccountKvOperationsAdaptiveGroupsSum') {
      return jsonResponse({ data: { __type: { fields: [{ name: 'requests' }] } } });
    }
    if (body.variables?.name === 'AccountKvOperationsAdaptiveGroupsDimensions') {
      return jsonResponse({ data: { __type: { fields: [{ name: 'actionType' }, { name: 'namespaceId' }] } } });
    }
    if (body.query.includes('workersInvocationsAdaptive')) return jsonResponse(invocationsFixture.response);
    return jsonResponse(kvFixture.response);
  };
  const { exitCode, result } = await runMeasurement({
    from: '2026-09-30T00:00:00Z',
    to: '2026-10-01T00:00:00Z',
    assumeNoBuild: true,
    deps: { fetchImpl, env: { CLOUDFLARE_API_TOKEN: 'tok', CLOUDFLARE_ACCOUNT_ID: 'acct' } },
  });
  // 102 KV reads against 94 invocations in this real 24h window is a genuine, if mild, over-budget
  // reading (not a fixture bug) — likely window-edge skew between the two datasets' own bucketing.
  // decideArch08Verdict reports it honestly rather than rounding it into a PASS. This is a
  // measurement/reporting tool, not a go/no-go gate, so a successful measurement still exits 0 —
  // the real verdict is in `result.verdict`, not the process exit code.
  assert.equal(exitCode, 0);
  assert.equal(result.verdict, 'FAIL');
  assert.equal(result.kv, 'KV_READS_OVER_BUDGET');
  assert.equal(result.cpu, 'CPU_WITHIN_BUDGET');
  assert.equal(result.invocations, 94);
  assert.equal(result.kvReads, 102);
});
