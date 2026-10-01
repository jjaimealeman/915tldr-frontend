#!/usr/bin/env node
// 05-04 Task 3: ARCH-08's live measurement — KV reads per request and Worker CPU time, read off
// the deployed Worker (`915tldr-v2`) rather than estimated. Mirrors
// `tools/load-test-zero-reads.mjs`'s own conventions: credentials via `./lib/cf-graphql.mjs`
// only, every network/clock boundary injectable, every dataset's field names confirmed by live
// introspection before being queried (not guessed).
//
// CPU time fields on `workersInvocationsAdaptive` are reported in MICROSECONDS, confirmed via the
// live GraphQL schema's own field descriptions (`"CPU time 50th percentile - microseconds"`,
// `"Maximum CPU time for one request - microseconds"`) — this file converts to milliseconds at
// the one point `summarizeWorkerWindow` reads them, so every other function in this file and
// every test works in milliseconds, matching PROJECT.md's own `<5ms Worker CPU` budget.

import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { queryCloudflareGraphql, introspectType, redact } from './lib/cf-graphql.mjs';

export const RENDER_MANIFEST_NAMESPACE_ID = '3c92531f94294fcc94006455f433885f';
export const PUBLIC_WORKER_SCRIPT = '915tldr-v2';
export const CPU_BUDGET_MS = 5;
export const CPU_HARD_FAIL_MS = 20;
export const KV_READS_PER_REQUEST_MAX = 1;

function requireEnv(env, name) {
  const value = env[name];
  if (!value) throw new Error(`measure-worker-kv-cpu: ${name} is not set in the environment`);
  return value;
}

// ---------------------------------------------------------------------------
// Pure summarize + verdict
// ---------------------------------------------------------------------------

/**
 * Converts a `workersInvocationsAdaptive` group fixture (microsecond CPU fields, per the live
 * schema's own field descriptions) and a `kvOperationsAdaptiveGroups` `read`-only group fixture
 * into `{ invocations, kvReads, cpuP50Ms, cpuP99Ms, cpuMaxMs }`, all CPU figures in milliseconds.
 * A missing group (no invocations/no reads in the window) summarizes to zero, not a thrown error
 * — `decideArch08Verdict` is what turns "zero invocations" into INCONCLUSIVE.
 */
export function summarizeWorkerWindow(invocationsGroup, kvGroup) {
  const invocations = invocationsGroup?.sum?.requests ?? 0;
  const cpuP50Us = invocationsGroup?.quantiles?.cpuTimeP50 ?? 0;
  const cpuP99Us = invocationsGroup?.quantiles?.cpuTimeP99 ?? 0;
  const cpuMaxUs = invocationsGroup?.max?.cpuTime ?? 0;
  const kvReads = kvGroup?.sum?.requests ?? 0;

  return {
    invocations,
    kvReads,
    cpuP50Ms: cpuP50Us / 1000,
    cpuP99Ms: cpuP99Us / 1000,
    cpuMaxMs: cpuMaxUs / 1000,
  };
}

/**
 * decideArch08Verdict: `kvReads <= invocations` → `KV_READS_WITHIN_BUDGET`, else
 * `KV_READS_OVER_BUDGET`; `cpuP99Ms < 5 AND cpuMaxMs < 20` → `CPU_WITHIN_BUDGET`, else
 * `CPU_OVER_BUDGET`. A window flagged `buildOverlap` or with zero `invocations` is `INCONCLUSIVE`
 * on both axes — a build reads the same KV namespace (RESEARCH.md), and zero invocations means
 * nothing was measured, not that the budget was met.
 */
export function decideArch08Verdict({ invocations, kvReads, cpuP99Ms, cpuMaxMs, buildOverlap = false }) {
  if (buildOverlap) {
    return {
      verdict: 'INCONCLUSIVE',
      kv: 'INCONCLUSIVE',
      cpu: 'INCONCLUSIVE',
      reason: 'the window overlaps a build — the build reads the same KV namespace',
    };
  }
  if (!invocations) {
    return {
      verdict: 'INCONCLUSIVE',
      kv: 'INCONCLUSIVE',
      cpu: 'INCONCLUSIVE',
      reason: 'zero invocations in the window — nothing measured',
    };
  }

  const kv = kvReads <= invocations ? 'KV_READS_WITHIN_BUDGET' : 'KV_READS_OVER_BUDGET';
  const cpu = cpuP99Ms < CPU_BUDGET_MS && cpuMaxMs < CPU_HARD_FAIL_MS ? 'CPU_WITHIN_BUDGET' : 'CPU_OVER_BUDGET';
  const verdict = kv === 'KV_READS_WITHIN_BUDGET' && cpu === 'CPU_WITHIN_BUDGET' ? 'PASS' : 'FAIL';

  return { verdict, kv, cpu, invocations, kvReads, cpuP99Ms, cpuMaxMs };
}

// ---------------------------------------------------------------------------
// Live fetch
// ---------------------------------------------------------------------------

/** Fetches the `workersInvocationsAdaptive` group for `PUBLIC_WORKER_SCRIPT` over `[from, to)`,
 * confirming the dataset's own field names by introspection first. */
export async function fetchWorkerInvocations({ from, to }, deps = {}) {
  const { fetchImpl = fetch, env = process.env } = deps;

  const quantileFields = await introspectType('AccountWorkersInvocationsAdaptiveQuantiles', { fetchImpl, env });
  if (!quantileFields.includes('cpuTimeP50') || !quantileFields.includes('cpuTimeP99')) {
    throw new Error('measure-worker-kv-cpu: Workers invocations quantiles type is missing cpuTimeP50/cpuTimeP99 — schema has changed');
  }
  const maxFields = await introspectType('AccountWorkersInvocationsAdaptiveMax', { fetchImpl, env });
  if (!maxFields.includes('cpuTime')) {
    throw new Error('measure-worker-kv-cpu: Workers invocations max type is missing cpuTime — schema has changed');
  }

  const accountId = requireEnv(env, 'CLOUDFLARE_ACCOUNT_ID');
  const query = `query($accountTag: string!, $scriptName: string!, $start: Time!, $end: Time!) {
    viewer {
      accounts(filter: { accountTag: $accountTag }) {
        workersInvocationsAdaptive(
          limit: 10
          filter: { scriptName: $scriptName, datetime_geq: $start, datetime_lt: $end }
        ) {
          sum { requests }
          quantiles { cpuTimeP50 cpuTimeP99 }
          max { cpuTime }
        }
      }
    }
  }`;
  const data = await queryCloudflareGraphql(
    { query, variables: { accountTag: accountId, scriptName: PUBLIC_WORKER_SCRIPT, start: from, end: to } },
    { fetchImpl, env }
  );
  const groups = data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive ?? [];
  // Collapse multiple returned groups (the query sets no extra group-by dimension beyond the
  // scriptName filter, but Cloudflare's adaptive datasets can still return >1 row) into one
  // summary by summing requests and taking the max across max/quantile figures — conservative,
  // never understates either budget.
  if (groups.length === 0) return { sum: { requests: 0 }, quantiles: { cpuTimeP50: 0, cpuTimeP99: 0 }, max: { cpuTime: 0 } };
  if (groups.length === 1) return groups[0];
  return groups.reduce((acc, g) => ({
    sum: { requests: acc.sum.requests + (g.sum?.requests ?? 0) },
    quantiles: {
      cpuTimeP50: Math.max(acc.quantiles.cpuTimeP50, g.quantiles?.cpuTimeP50 ?? 0),
      cpuTimeP99: Math.max(acc.quantiles.cpuTimeP99, g.quantiles?.cpuTimeP99 ?? 0),
    },
    max: { cpuTime: Math.max(acc.max.cpuTime, g.max?.cpuTime ?? 0) },
  }));
}

/** Fetches the `kvOperationsAdaptiveGroups` `read`-only group for `RENDER_MANIFEST_NAMESPACE_ID`
 * over `[from, to)`, confirming the dataset's own field names by introspection first. */
export async function fetchKvReadOperations({ from, to }, deps = {}) {
  const { fetchImpl = fetch, env = process.env } = deps;

  const sumFields = await introspectType('AccountKvOperationsAdaptiveGroupsSum', { fetchImpl, env });
  if (!sumFields.includes('requests')) {
    throw new Error('measure-worker-kv-cpu: KV operations sum type is missing requests — schema has changed');
  }
  const dimFields = await introspectType('AccountKvOperationsAdaptiveGroupsDimensions', { fetchImpl, env });
  if (!dimFields.includes('actionType') || !dimFields.includes('namespaceId')) {
    throw new Error('measure-worker-kv-cpu: KV operations dimensions type is missing actionType/namespaceId — schema has changed');
  }

  const accountId = requireEnv(env, 'CLOUDFLARE_ACCOUNT_ID');
  const query = `query($accountTag: string!, $namespaceId: string!, $start: Time!, $end: Time!) {
    viewer {
      accounts(filter: { accountTag: $accountTag }) {
        kvOperationsAdaptiveGroups(
          limit: 10
          filter: { namespaceId: $namespaceId, actionType: "read", datetime_geq: $start, datetime_lt: $end }
        ) {
          sum { requests }
        }
      }
    }
  }`;
  const data = await queryCloudflareGraphql(
    { query, variables: { accountTag: accountId, namespaceId: RENDER_MANIFEST_NAMESPACE_ID, start: from, end: to } },
    { fetchImpl, env }
  );
  const groups = data?.viewer?.accounts?.[0]?.kvOperationsAdaptiveGroups ?? [];
  const totalReads = groups.reduce((sum, g) => sum + (g?.sum?.requests ?? 0), 0);
  return { sum: { requests: totalReads } };
}

// ---------------------------------------------------------------------------
// Build-overlap check (same /version.json before/after rule as the load test)
// ---------------------------------------------------------------------------

/** Reads `/version.json` and returns its `{ commit, builtAt }` — the same signal
 * `tools/load-test-zero-reads.mjs` uses to detect a build happening mid-window. */
async function fetchVersion(baseUrl, fetchImpl) {
  const res = await fetchImpl(`${baseUrl}/version.json`, { redirect: 'manual' });
  return res.json();
}

/** `--assume-no-build` is the documented WEAKER path for historical windows where before/after
 * polling isn't possible — flagged explicitly in every result it produces. */
export async function detectBuildOverlap({ baseUrl, assumeNoBuild = false, fetchImpl = fetch, before = null }) {
  if (assumeNoBuild) return { overlap: false, method: 'assume-no-build (weaker — not independently verified)' };
  const beforeVersion = before ?? (await fetchVersion(baseUrl, fetchImpl));
  const afterVersion = await fetchVersion(baseUrl, fetchImpl);
  const overlap = beforeVersion.commit !== afterVersion.commit || beforeVersion.builtAt !== afterVersion.builtAt;
  return { overlap, method: 'version.json before/after' };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = { from: null, to: null, evidence: null, json: false, assumeNoBuild: false, baseUrl: 'https://dev.915tldr.com' };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--from') { args.from = argv[++i]; continue; }
    if (arg.startsWith('--from=')) { args.from = arg.slice('--from='.length); continue; }
    if (arg === '--to') { args.to = argv[++i]; continue; }
    if (arg.startsWith('--to=')) { args.to = arg.slice('--to='.length); continue; }
    if (arg === '--evidence') { args.evidence = argv[++i]; continue; }
    if (arg.startsWith('--evidence=')) { args.evidence = arg.slice('--evidence='.length); continue; }
    if (arg === '--json') { args.json = true; continue; }
    if (arg === '--assume-no-build') { args.assumeNoBuild = true; continue; }
    if (arg === '--base-url') { args.baseUrl = argv[++i]; continue; }
    if (arg.startsWith('--base-url=')) { args.baseUrl = arg.slice('--base-url='.length); continue; }
  }
  if (!args.from || !args.to) {
    throw new Error('measure-worker-kv-cpu: --from and --to are required (ISO 8601 timestamps)');
  }
  return args;
}

async function writeEvidence(dir, name, data) {
  if (!dir) return;
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), JSON.stringify(data, null, 2));
}

export async function runMeasurement(opts = {}) {
  const { from, to, evidence = null, assumeNoBuild = false, baseUrl = 'https://dev.915tldr.com', deps = {} } = opts;
  const resolvedDeps = { fetchImpl: deps.fetchImpl ?? fetch, env: deps.env ?? process.env };

  const overlapResult = await detectBuildOverlap({
    baseUrl,
    assumeNoBuild,
    fetchImpl: resolvedDeps.fetchImpl,
  });

  const invocationsGroup = await fetchWorkerInvocations({ from, to }, resolvedDeps);
  const kvGroup = await fetchKvReadOperations({ from, to }, resolvedDeps);
  const summary = summarizeWorkerWindow(invocationsGroup, kvGroup);
  const verdict = decideArch08Verdict({ ...summary, buildOverlap: overlapResult.overlap });

  await writeEvidence(evidence, 'workers-invocations.json', invocationsGroup);
  await writeEvidence(evidence, 'kv-operations.json', kvGroup);

  const result = { window: { from, to }, buildOverlap: overlapResult, ...summary, ...verdict };

  console.log(
    `[measure-worker-kv-cpu] window ${from}..${to}: invocations=${summary.invocations} kvReads=${summary.kvReads} ` +
      `cpuP50=${summary.cpuP50Ms.toFixed(3)}ms cpuP99=${summary.cpuP99Ms.toFixed(3)}ms cpuMax=${summary.cpuMaxMs.toFixed(3)}ms ` +
      `(build-overlap check: ${overlapResult.method})`
  );
  console.log(`[measure-worker-kv-cpu] verdict: ${verdict.verdict} (kv: ${verdict.kv}, cpu: ${verdict.cpu})`);

  // This is a MEASUREMENT/reporting tool, not a go/no-go gate (that distinction belongs to
  // `tools/load-test-zero-reads.mjs`'s documented 0/2/3 exit codes for the zero-reads gate
  // itself) — a successful measurement always exits 0 regardless of the verdict it reports;
  // `advisoryExitCode` is kept on the return value for a future caller that DOES want to gate on
  // it, but the CLI's own process exit code is intentionally not it.
  const advisoryExitCode = verdict.verdict === 'INCONCLUSIVE' ? 3 : verdict.verdict === 'FAIL' ? 2 : 0;
  return { exitCode: 0, advisoryExitCode, result };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  try {
    const { exitCode, result } = await runMeasurement({
      from: args.from,
      to: args.to,
      evidence: args.evidence,
      assumeNoBuild: args.assumeNoBuild,
      baseUrl: args.baseUrl,
    });
    if (args.json) {
      console.log(JSON.stringify(result, null, 2));
    }
    process.exitCode = exitCode;
  } catch (err) {
    console.error(redact(`measure-worker-kv-cpu: ${err instanceof Error ? err.message : String(err)}`, process.env));
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
