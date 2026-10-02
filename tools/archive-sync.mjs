#!/usr/bin/env node
// 05-07: uploads the archive tier to R2 safely and on time. Two phases, both run from
// `tools/ci-build.mjs`'s deploy step (05-08):
//
//   pre  — uploads pages that are NEW to the archive (never indexed before). Anything that
//          fails, doesn't start in time, or is held back by `--limit` is moved BACK into
//          `dist/client` before `wrangler deploy` runs, so a page that isn't confirmed in R2
//          never leaves the static tier this cycle (REND-08's no-404-window invariant).
//   post — re-uploads already-archived pages whose content changed (sha256 differs, or the
//          force-full marker is set), deletes R2 copies of pages that were promoted back to
//          static or vanished from the site entirely (capped), and reports a backlog/alerts/
//          daily file-count line. Never blocks or fails the deploy (D-10, D-12) — every failure
//          path here ends in an alert, never a non-zero exit (except pre's own plan-missing
//          case, which can't do anything at all).
//
// R2 writes (`putObject`/`putJson`/`deleteObjects`) are refused — fail closed, before any
// request is built — whenever `WORKERS_CI` is set and `WORKERS_CI_BRANCH` is not `main`
// (orchestrator-directed defense-in-depth, 2026-09-30/10-01): the Workers Builds dashboard has
// twice silently written the R2 build secrets to the non-production trigger as well as
// production, and a leaked credential on a feature-branch build must never be ABLE to write,
// not merely be expected not to. The guard lives at `wrapStoreForBranchGuard` — the one place
// every write call in this file passes through — not just as an early return in `runPreSync`/
// `runPostSync`, so a future caller that reaches for the store directly still can't bypass it.
// Local runs (no `WORKERS_CI`) are unaffected; this is a CI-only guard.
//
// Every thrown message is prefixed `archive-sync:` (the `tools/ci-build.mjs` classifyFailure
// convention). Credential handling follows OPS-11 (same as `src/lib/server/r2-client.ts`):
// read from `process.env` only, never logged, never embedded in a thrown message.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { runPool } from './lib/run-pool.mjs';
import { ARCHIVE_DIR, PARTITION_PLAN_PATH } from './partition-archive.mjs';

export const ARCHIVE_INDEX_KEY = '_meta/archive-index.json';
export const ARCHIVE_STATE_KEY = '_meta/archive-state.json';
export const FORCE_FULL_KEY = '_meta/force-full.json';
export const DAILY_REPORT_KEY = '_meta/daily-report.json';
export const RESULT_LINE_PREFIX = 'ARCHIVE_SYNC_RESULT ';
export const BUILD_STARTED_AT_PATH = '.astro/ci-build-started-at';
export const PRE_DEADLINE_SECONDS = 840;
export const POST_DEADLINE_SECONDS = 1020;
export const BACKLOG_ALERT_HOURS = 20;
// CR-02 (05-20): the marker `tools/assert-archive-synced.mjs` reads before `wrangler deploy`
// runs — proof that `runPreSync` has confirmed THIS build's partition (uploaded or moved back
// every archive-tier page) before a partitioned `dist/` is allowed to ship. Lives inside `dist/`
// but outside `dist/client` (never deployed) — see `writeSyncedMarker` below.
export const ARCHIVE_SYNCED_MARKER_PATH = 'dist/archive-synced.json';
// IN-06 (05-20): a `.astro/ci-build-started-at` marker older than this (or more than 60s in the
// future) is never trusted — `getBuildStartEpochSeconds` falls back to this process's own start
// instead. A standalone `ci-build deploy` previously inherited a stale marker from an earlier
// `pnpm run build`, making both deadlines (PRE_DEADLINE_SECONDS/POST_DEADLINE_SECONDS) look
// already past: pre moved every new page back, post deferred every change and raised false
// backlog alerts. 1,800s exceeds Workers Builds' 1,200s (20min) hard ceiling, so a live CI marker
// is never the one this ignores — only a stale leftover from an earlier local build is.
export const BUILD_START_MARKER_MAX_AGE_SECONDS = 1800;
export const ARCHIVE_SYNC_CONCURRENCY = 32;
export const LIVE_ORIGIN_DEFAULT = 'https://dev.915tldr.com';
export const LIVE_CHECK_ATTEMPTS = 6;
export const LIVE_CHECK_INTERVAL_MS = 10_000;
export const LOCAL_VERSION_PATH = 'dist/client/version.json';

const DIST_CLIENT_DIR = 'dist/client';
const ARCHIVE_CONTENT_TYPE = 'text/html'; // measured live against dev.915tldr.com — 05-03-SUMMARY.md

// This module's own load time — the "weaker local behavior" fallback for deadline measurement
// when `.astro/ci-build-started-at` (written by 05-08's build step) isn't present.
const PROCESS_START_EPOCH_SECONDS = Math.floor(Date.now() / 1000);

function fail(message) {
  throw new Error(`archive-sync: ${message}`);
}

/** T-04-38's own convention (tools/ci-build.mjs's `isTruthyFlag`), duplicated here rather than
 * imported — this module has no other dependency on ci-build.mjs and shouldn't acquire one just
 * for a three-line predicate. */
function isTruthyFlag(value) {
  return Boolean(value) && value !== '0' && value !== 'false';
}

/** Orchestrator-directed defense-in-depth (2026-09-30/10-01): true whenever this process is
 * running under Workers Builds CI on any branch other than `main`. Local runs (no `WORKERS_CI`)
 * are never blocked. */
export function isR2WriteBlocked(env = process.env) {
  return isTruthyFlag(env.WORKERS_CI) && env.WORKERS_CI_BRANCH !== 'main';
}

/** Wraps `store`'s three write methods so each one throws `archive-sync: refusing R2 write ...`
 * BEFORE building any request, whenever `isR2WriteBlocked(env)` — the one choke point every
 * write call in this file passes through, so a future caller reaching for the store directly
 * (not through `runPreSync`/`runPostSync`'s own early-return) still can't write on a non-main CI
 * branch. Read methods (`getJson`/`getText`/`headObject`/`listKeys`) pass through unchanged —
 * reads are harmless and `runPostSync` still needs them even when writes are blocked by a
 * caller that skips the early return. Fail-closed-with-a-throw (not a silent no-op) was chosen
 * to match this project's own chokepoint-module convention (`r2-client.ts`'s `assertArchiveKey`,
 * `tier-facts.ts`'s validation) — every other invariant violation in this codebase throws loud
 * rather than silently degrading; a write that silently no-ops here would look identical to a
 * write that succeeded to any caller that doesn't check a return value. */
export function wrapStoreForBranchGuard(store, env = process.env) {
  if (!isR2WriteBlocked(env)) return store;
  const reason = `WORKERS_CI is set and WORKERS_CI_BRANCH is ${JSON.stringify(env.WORKERS_CI_BRANCH ?? null)}, not "main"`;
  const refuse = async () => fail(`refusing R2 write — ${reason}`);
  return { ...store, putObject: refuse, putJson: refuse, deleteObjects: refuse };
}

/** IN-06 (05-20): a marker older than `BUILD_START_MARKER_MAX_AGE_SECONDS`, or more than 60s in
 * the future (clock skew, not a real future build start), is never trusted — both deadlines must
 * be measured from THIS build's own start, not a stale leftover from an earlier one. Falls back
 * to `PROCESS_START_EPOCH_SECONDS` (this module's own load time) exactly as the missing-marker
 * case already did, with one stderr line naming the age so a stale marker is never silently
 * ignored. */
function getBuildStartEpochSeconds(root) {
  const abs = resolve(root, BUILD_STARTED_AT_PATH);
  if (existsSync(abs)) {
    const raw = readFileSync(abs, 'utf8').trim();
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) {
      const ageSeconds = PROCESS_START_EPOCH_SECONDS - n;
      if (ageSeconds <= BUILD_START_MARKER_MAX_AGE_SECONDS && ageSeconds >= -60) {
        return n;
      }
      console.error(
        `[archive-sync] ignoring stale build-start marker (age ${ageSeconds}s > ${BUILD_START_MARKER_MAX_AGE_SECONDS}s) — measuring deadlines from this process's own start`
      );
    }
  }
  return PROCESS_START_EPOCH_SECONDS;
}

function getDeadlineMs(root, deadlineSeconds) {
  return (getBuildStartEpochSeconds(root) + deadlineSeconds) * 1000;
}

function nowIso() {
  return new Date().toISOString();
}

/** CR-02 (05-20): writes `ARCHIVE_SYNCED_MARKER_PATH` — called immediately before every
 * `exitCode: 0` return of `runPreSync` (success, disabled, index-unreadable), after any
 * move-back has already completed, and NEVER on the plan-missing `exitCode: 1` path (there is no
 * plan to vouch for there). Keyed to `plan.generatedAt` (set by `tools/partition-archive.mjs`'s
 * `planPartition`) rather than a boolean, so a marker written for an older partition can never be
 * mistaken for proof that a newer one was synced. Lives at `dist/archive-synced.json` — inside
 * `dist/` but never inside `dist/client`, so it is never itself deployed. */
function writeSyncedMarker(root, plan) {
  const abs = resolve(root, ARCHIVE_SYNCED_MARKER_PATH);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, JSON.stringify({ planGeneratedAt: plan?.generatedAt ?? null, syncedAt: nowIso(), phase: 'pre' }));
}

/** `en-CA` formats as `YYYY-MM-DD` directly — the one locale/format combination that avoids
 * manually joining `Intl.DateTimeFormat` parts back together. */
function denverDateString(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Denver',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function readPlanFile(root) {
  const abs = resolve(root, PARTITION_PLAN_PATH);
  if (!existsSync(abs)) {
    fail(`${PARTITION_PLAN_PATH} is missing — run \`pnpm run build\` first`);
  }
  let raw;
  try {
    raw = readFileSync(abs, 'utf8');
  } catch (err) {
    fail(`could not read ${PARTITION_PLAN_PATH}: ${err instanceof Error ? err.message : String(err)}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    fail(`${PARTITION_PLAN_PATH} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!parsed || !Array.isArray(parsed.entries)) {
    fail(`${PARTITION_PLAN_PATH} must be an object with an "entries" array`);
  }
  return parsed;
}

function readStaticBudget(root) {
  const abs = resolve(root, DIST_CLIENT_DIR, 'static-budget.json');
  if (!existsSync(abs)) return null;
  try {
    return JSON.parse(readFileSync(abs, 'utf8'));
  } catch {
    return null;
  }
}

/** Mirrors `tools/partition-archive.mjs`'s own `resolveWithinBoundary` (T-05-22's discipline):
 * resolves `relPath` under `root` and asserts the result stays inside `boundaryDir` — rejects
 * any path that traverses outside its owning directory, whether via a malicious `..` segment or
 * a malformed plan/index entry. Not imported from `partition-archive.mjs` (not exported there)
 * — duplicated at the same small scope rather than widening that module's public surface for a
 * second caller. */
function resolveWithinBoundary(root, relPath, boundaryDir, label) {
  const boundaryAbs = resolve(root, boundaryDir);
  const resolved = resolve(root, relPath);
  if (resolved !== boundaryAbs && !resolved.startsWith(`${boundaryAbs}/`)) {
    fail(`${label} path escapes ${boundaryDir}: ${relPath}`);
  }
  return resolved;
}

function readArchiveFileBytes(key, root) {
  const abs = resolveWithinBoundary(root, join(ARCHIVE_DIR, key), ARCHIVE_DIR, 'source');
  return readFileSync(abs);
}

/** Moves every entry's `dist/archive/<key>` file back to `dist/client<path>.html` (the REND-08
 * no-404-window invariant: a page that isn't confirmed in R2 stays static). A source file that's
 * already missing (already moved back, or never partitioned) is silently skipped — not counted
 * as moved, not an error — rather than crashing the whole pre-sync over one already-handled
 * entry. Returns the subset actually moved. */
function moveEntriesBack(entries, root) {
  const moved = [];
  for (const entry of entries) {
    const sourceAbs = resolveWithinBoundary(root, join(ARCHIVE_DIR, entry.key), ARCHIVE_DIR, 'source');
    if (!existsSync(sourceAbs)) continue;
    const destRel = `${DIST_CLIENT_DIR}${entry.path}.html`;
    const destAbs = resolveWithinBoundary(root, destRel, DIST_CLIENT_DIR, 'destination');
    mkdirSync(dirname(destAbs), { recursive: true });
    renameSync(sourceAbs, destAbs);
    moved.push(entry);
  }
  return moved;
}

/**
 * Pure classification (no I/O beyond what `pathExists` does): every `planEntries` item is
 * `new` (absent from the index), `changed` (sha256 differs from the index, or `forceFull`
 * promotes an already-matching entry), or `unchanged`. Every index-only key (in the index, not
 * in this build's plan) is a `promotedOrphan` (its canonical path now exists as a real static
 * file — it was promoted to hot) or a `vanishedOrphan` (neither archived nor static — the page
 * is gone entirely). `pathExists(indexEntry)` is the injectable seam (`src/lib/server/
 * d1-client.ts`'s `fetchImpl` convention, applied to filesystem checks): production passes a
 * real `existsSync` check against `dist/client`; tests pass a fixture-backed fake.
 */
export function diffAgainstIndex({ planEntries, index, forceFull = false, pathExists }) {
  if (!Array.isArray(planEntries)) fail('planEntries must be an array');
  if (typeof pathExists !== 'function') fail('pathExists must be a function');
  const entries = index && typeof index === 'object' && index.entries ? index.entries : {};

  const planByKey = new Map(planEntries.map((e) => [e.key, e]));
  const newKeys = [];
  const changedKeys = [];
  const unchangedKeys = [];

  for (const entry of planEntries) {
    const existing = entries[entry.key];
    if (!existing) {
      newKeys.push(entry);
    } else if (forceFull || existing.sha256 !== entry.sha256) {
      changedKeys.push(entry);
    } else {
      unchangedKeys.push(entry);
    }
  }

  const promotedOrphans = [];
  const vanishedOrphans = [];
  for (const [key, existing] of Object.entries(entries)) {
    if (planByKey.has(key)) continue;
    const orphan = { key, ...existing };
    if (pathExists(orphan)) {
      promotedOrphans.push(orphan);
    } else {
      vanishedOrphans.push(orphan);
    }
  }

  return { newKeys, changedKeys, unchangedKeys, promotedOrphans, vanishedOrphans };
}

/** Re-reads the index immediately before writing (merge-on-write) and applies ONLY this run's
 * own `add`/`remove` — a concurrent build's own write in between is never clobbered, at worst
 * causing a redundant re-upload later (the documented, accepted race per 05-07-PLAN.md's own
 * R2-bookkeeping contract). */
async function mergeWriteIndex(store, { add = {}, remove = [] }) {
  const fresh = (await store.getJson(ARCHIVE_INDEX_KEY)) ?? { version: 1, entries: {} };
  const entries = { ...(fresh.entries ?? {}) };
  for (const key of remove) delete entries[key];
  for (const [key, value] of Object.entries(add)) entries[key] = value;
  const updated = { version: 1, updatedAt: nowIso(), entries };
  await store.putJson(ARCHIVE_INDEX_KEY, updated);
  return updated;
}

function buildResult(fields) {
  return {
    phase: fields.phase,
    uploaded: fields.uploaded,
    failed: fields.failed,
    deferred: fields.deferred,
    movedBack: fields.movedBack,
    deleted: fields.deleted,
    backlog: fields.backlog,
    alerts: fields.alerts,
    dailyReport: fields.dailyReport,
    disabled: fields.disabled,
  };
}

/** Shared by `runPreSync`/`runPostSync`: returns a non-null `{ disabled, reason }` the moment
 * either the branch guard or missing credentials means this run must not touch R2 at all.
 * `hasR2CredentialsFn` may be sync or async (the default implementation dynamically imports
 * `r2-client.ts`, so it's async; a test-injected replacement may be either) — always awaited. */
async function checkDisabled(env, hasR2CredentialsFn) {
  if (isR2WriteBlocked(env)) {
    return { disabled: true, reason: `WORKERS_CI branch guard — branch is ${JSON.stringify(env.WORKERS_CI_BRANCH ?? null)}, not "main"` };
  }
  if (!(await hasR2CredentialsFn(env))) {
    return { disabled: true, reason: 'R2 credentials are not set in the environment' };
  }
  return { disabled: false, reason: null };
}

async function defaultCreateStore(env) {
  const { createArchiveStore } = await import('../src/lib/server/r2-client.ts');
  return createArchiveStore({ env });
}

async function defaultHasR2Credentials(env) {
  const { hasR2Credentials } = await import('../src/lib/server/r2-client.ts');
  return hasR2Credentials(env);
}

/** CR-01/WR-01 (05-14): the one check standing between `runPostSync` and every R2 mutation it
 * can make. Reads this build's own `dist/client/version.json`, compares it against the live
 * deployment's `/version.json` (commit AND builtAt — `builtAt` differs between a local build and
 * the deployed build of the same commit, so commit alone would under-detect), and reports
 * `live: true` only on an exact match of both fields. Never throws — a missing/unparseable local
 * file, an unreachable origin, a non-2xx response or a malformed remote body all fold into
 * `live: false` with a `reason`, because this function's caller (`runPostSync`) itself must never
 * fail a deploy (D-10/D-12's existing contract, extended to this new gate): an uncertain answer
 * must be treated as "not live," not thrown. Polls up to `attempts` times (default 6, 10s apart)
 * to absorb post-deploy propagation delay, awaiting `sleep(intervalMs)` between non-matching
 * attempts — never after the final attempt, and never after a match. `attempts` in the returned
 * object is however many fetches were actually made (1 on the first-attempt match or on an
 * unreachable origin/missing local file, up to the full `attempts` count otherwise). */
export async function checkLiveDeployment({
  root = process.cwd(),
  env = process.env,
  fetchImpl = fetch,
  sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms)),
  attempts = LIVE_CHECK_ATTEMPTS,
  intervalMs = LIVE_CHECK_INTERVAL_MS,
} = {}) {
  const localAbs = resolve(root, LOCAL_VERSION_PATH);
  let local = null;
  if (existsSync(localAbs)) {
    try {
      const parsed = JSON.parse(readFileSync(localAbs, 'utf8'));
      if (parsed && typeof parsed.commit === 'string' && typeof parsed.builtAt === 'string') {
        local = { commit: parsed.commit, builtAt: parsed.builtAt };
      }
    } catch {
      local = null;
    }
  }
  if (!local) {
    return { live: false, local: null, remote: null, attempts: 0, reason: `${LOCAL_VERSION_PATH} is missing or unparseable` };
  }

  const origin = env.ARCHIVE_SYNC_LIVE_ORIGIN || LIVE_ORIGIN_DEFAULT;
  if (!origin.startsWith('https://')) {
    return {
      live: false,
      local,
      remote: null,
      attempts: 0,
      reason: `ARCHIVE_SYNC_LIVE_ORIGIN must be an https origin — got ${JSON.stringify(origin)}`,
    };
  }

  const totalAttempts = Math.max(1, Number(attempts) || 1);
  let remote = null;
  let reason = null;
  let madeAttempts = 0;

  for (let i = 0; i < totalAttempts; i += 1) {
    madeAttempts += 1;
    const url = `${origin}/version.json?archive-sync=${Date.now()}`;
    try {
      const res = await fetchImpl(url, { headers: { 'cache-control': 'no-cache' } });
      if (res && res.ok) {
        const body = await res.json();
        if (body && typeof body.commit === 'string' && typeof body.builtAt === 'string') {
          remote = { commit: body.commit, builtAt: body.builtAt };
          reason = null;
        } else {
          remote = null;
          reason = 'remote /version.json response is missing commit/builtAt';
        }
      } else {
        remote = null;
        reason = `remote /version.json returned status ${res ? res.status : 'unknown'}`;
      }
    } catch (err) {
      remote = null;
      reason = `remote /version.json fetch failed — ${err instanceof Error ? err.message : String(err)}`;
    }

    if (remote && remote.commit === local.commit && remote.builtAt === local.builtAt) {
      return { live: true, local, remote, attempts: madeAttempts, reason: null };
    }

    if (i < totalAttempts - 1) {
      await sleep(intervalMs);
    }
  }

  return { live: false, local, remote, attempts: madeAttempts, reason: reason ?? 'commit/builtAt mismatch' };
}

/**
 * Pre-deploy phase: uploads pages new to the archive; anything that fails, times out at the
 * deadline, or sits beyond `--limit` is moved back into `dist/client` before this returns.
 * Exits (via the returned `exitCode`) 1 ONLY when the plan is missing or invalid — every other
 * outcome (disabled, index unreadable, partial upload failure) is exitCode 0, matching D-10's
 * "never blocks a deploy" guarantee at the pre-deploy phase too.
 *
 * CR-02 (05-20): writes `ARCHIVE_SYNCED_MARKER_PATH` on every `exitCode: 0` return (success,
 * disabled, index-unreadable) — proof `tools/assert-archive-synced.mjs` accepts as "this build's
 * partition has been confirmed" before `wrangler deploy` is allowed to run. Never written on the
 * plan-missing `exitCode: 1` path, since there's no plan's `generatedAt` to key the marker to.
 */
export async function runPreSync(opts = {}) {
  const {
    root = process.cwd(),
    env = process.env,
    now = () => Date.now(),
    createStore = defaultCreateStore,
    hasR2CredentialsFn = defaultHasR2Credentials,
    limit = null,
  } = opts;

  let plan;
  try {
    plan = readPlanFile(root);
  } catch (err) {
    return {
      result: buildResult({
        phase: 'pre',
        uploaded: 0,
        failed: 0,
        deferred: 0,
        movedBack: 0,
        deleted: 0,
        backlog: null,
        alerts: [err instanceof Error ? err.message : String(err)],
        dailyReport: null,
        disabled: false,
      }),
      exitCode: 1,
    };
  }
  const planEntries = plan.entries;

  const { disabled, reason } = await checkDisabled(env, hasR2CredentialsFn);
  if (disabled) {
    const moved = moveEntriesBack(planEntries, root);
    writeSyncedMarker(root, plan);
    return {
      result: buildResult({
        phase: 'pre',
        uploaded: 0,
        failed: 0,
        deferred: 0,
        movedBack: moved.length,
        deleted: 0,
        backlog: null,
        alerts: [`archive-sync: archive tier disabled for this build — ${reason}`],
        dailyReport: null,
        disabled: true,
      }),
      exitCode: 0,
    };
  }

  const rawStore = await createStore(env);
  const store = wrapStoreForBranchGuard(rawStore, env);

  let index;
  try {
    index = (await store.getJson(ARCHIVE_INDEX_KEY)) ?? { version: 1, entries: {} };
  } catch (err) {
    const moved = moveEntriesBack(planEntries, root);
    writeSyncedMarker(root, plan);
    return {
      result: buildResult({
        phase: 'pre',
        uploaded: 0,
        failed: 0,
        deferred: 0,
        movedBack: moved.length,
        deleted: 0,
        backlog: null,
        alerts: [`archive-sync: archive index unreadable — ${err instanceof Error ? err.message : String(err)}`],
        dailyReport: null,
        disabled: false,
      }),
      exitCode: 0,
    };
  }

  // WR-02 (05-18) index self-heal: a post-sync run whose deletion succeeded but whose index write
  // then failed leaves the index claiming an object R2 no longer holds. If that key later re-enters
  // the archive tier, trusting the stale index entry here would classify it as `unchanged`/`changed`
  // (not `new`), skip the upload, and the deploy would remove it from static — a permanent 404 for
  // unchanged content. Once per run, list what R2 actually holds under the two archive prefixes and
  // treat any indexed-but-missing plan key as `new` instead, so it uploads before the deploy relies
  // on it. A listing failure is not fatal — the index-only diff runs exactly as it did before this
  // fix, with its own alert, rather than blocking the deploy over a transient R2 read.
  let diffIndex = index;
  const selfHealAlerts = [];
  try {
    const [articleKeys, tagKeys] = await Promise.all([store.listKeys('articles/'), store.listKeys('tags/')]);
    const r2Keys = new Set([...articleKeys, ...tagKeys]);
    const indexEntries = index.entries ?? {};
    const missingFromR2 = planEntries
      .map((entry) => entry.key)
      .filter((key) => key in indexEntries && !r2Keys.has(key));
    if (missingFromR2.length > 0) {
      const healedEntries = { ...indexEntries };
      for (const key of missingFromR2) delete healedEntries[key];
      diffIndex = { ...index, entries: healedEntries };
      selfHealAlerts.push(
        `archive-sync: ${missingFromR2.length} indexed page(s) were missing from R2 — re-uploading as new (index self-heal)`
      );
    }
  } catch (err) {
    selfHealAlerts.push(
      `archive-sync: could not list R2 keys — index trusted without self-heal this run (${err instanceof Error ? err.message : String(err)})`
    );
  }

  const diff = diffAgainstIndex({ planEntries, index: diffIndex, forceFull: false, pathExists: () => false });
  let candidates = diff.newKeys;
  let beyondLimit = [];
  if (typeof limit === 'number' && Number.isFinite(limit) && candidates.length > limit) {
    beyondLimit = candidates.slice(Math.max(0, limit));
    candidates = candidates.slice(0, Math.max(0, limit));
  }

  const concurrency = Number(env.ARCHIVE_SYNC_CONCURRENCY) > 0 ? Number(env.ARCHIVE_SYNC_CONCURRENCY) : ARCHIVE_SYNC_CONCURRENCY;
  const deadlineAt = getDeadlineMs(root, PRE_DEADLINE_SECONDS);

  const { done, failed, notStarted } = await runPool(candidates, {
    concurrency,
    deadlineAt,
    now,
    worker: async (entry) => {
      const bytes = readArchiveFileBytes(entry.key, root);
      await store.putObject(entry.key, bytes, { contentType: ARCHIVE_CONTENT_TYPE, sha256: entry.sha256 });
      return entry;
    },
  });

  const add = {};
  for (const { item } of done) {
    add[item.key] = { sha256: item.sha256, bytes: item.bytes, path: item.path, uploadedAt: nowIso() };
  }
  const alerts = [...selfHealAlerts];
  if (Object.keys(add).length > 0) {
    try {
      await mergeWriteIndex(store, { add, remove: [] });
    } catch (err) {
      alerts.push(
        `archive-sync: index write failed after ${Object.keys(add).length} upload(s) — those pages are in R2 and deploy safely; the next run re-uploads them as new (${err instanceof Error ? err.message : String(err)})`
      );
    }
  }

  const toMoveBack = [...failed.map((f) => f.item), ...notStarted.map((n) => n.item), ...beyondLimit];
  const moved = moveEntriesBack(toMoveBack, root);

  if (failed.length > 0) {
    alerts.push(`archive-sync: ${failed.length} page(s) failed to upload — previous state (static) still serving`);
  }

  writeSyncedMarker(root, plan);

  return {
    result: buildResult({
      phase: 'pre',
      uploaded: done.length,
      failed: failed.length,
      deferred: 0,
      movedBack: moved.length,
      deleted: 0,
      backlog: null,
      alerts,
      dailyReport: null,
      disabled: false,
    }),
    exitCode: 0,
  };
}

/**
 * Post-deploy phase: re-uploads already-archived pages whose content changed (or every indexed
 * page, if the force-full marker/flag is set), deletes orphaned R2 copies (capped for vanished
 * pages), tracks a backlog when the deadline cuts a run short, and reports once a day. Never
 * returns a non-zero exit — a failed/partial/backlogged run is an alert, never a build failure.
 */
export async function runPostSync(opts = {}) {
  const {
    root = process.cwd(),
    env = process.env,
    now = () => Date.now(),
    createStore = defaultCreateStore,
    hasR2CredentialsFn = defaultHasR2Credentials,
    forceFullFlag = false,
    checkLiveDeploymentFn = (liveOpts) => checkLiveDeployment({ root, env, ...liveOpts }),
  } = opts;

  let plan;
  try {
    plan = readPlanFile(root);
  } catch (err) {
    return {
      result: buildResult({
        phase: 'post',
        uploaded: 0,
        failed: 0,
        deferred: 0,
        movedBack: 0,
        deleted: 0,
        backlog: null,
        alerts: [err instanceof Error ? err.message : String(err)],
        dailyReport: null,
        disabled: false,
      }),
      exitCode: 0,
    };
  }
  const planEntries = plan.entries;
  const alerts = [];

  // CR-01 (05-14 Task 2): a dry-run deploy ships nothing, so a direct `post` invocation during
  // one (e.g. `CI_BUILD_DEPLOY_DRY_RUN=1 node tools/archive-sync.mjs post`, bypassing 05-13's
  // ci-build-side guard) must refuse before even checking credentials or the live deployment —
  // zero R2 calls, zero network calls, period.
  if (isTruthyFlag(env.CI_BUILD_DEPLOY_DRY_RUN)) {
    return {
      result: buildResult({
        phase: 'post',
        uploaded: 0,
        failed: 0,
        deferred: 0,
        movedBack: 0,
        deleted: 0,
        backlog: null,
        alerts: [
          'archive-sync: post-deploy sync skipped — CI_BUILD_DEPLOY_DRY_RUN is set (a dry run deployed nothing; the production bucket is not touched)',
        ],
        dailyReport: { due: false },
        disabled: true,
      }),
      exitCode: 0,
    };
  }

  const { disabled, reason } = await checkDisabled(env, hasR2CredentialsFn);
  if (disabled) {
    return {
      result: buildResult({
        phase: 'post',
        uploaded: 0,
        failed: 0,
        deferred: 0,
        movedBack: 0,
        deleted: 0,
        backlog: null,
        alerts: [`archive-sync: archive tier disabled for this build — ${reason}`],
        dailyReport: null,
        disabled: true,
      }),
      exitCode: 0,
    };
  }

  // CR-01/WR-01 (05-14): refuse every path below — uploads, deletions, state, daily report,
  // force-full clearing — unless the live deployment is THIS build. Checked before `createStore`
  // so a non-live run makes exactly one read-only GET and zero R2 calls.
  const liveness = await checkLiveDeploymentFn();
  if (!liveness.live) {
    const localDesc = liveness.local ? `${liveness.local.commit}@${liveness.local.builtAt}` : 'unknown';
    const remoteDesc = liveness.remote ? `${liveness.remote.commit}@${liveness.remote.builtAt}` : 'unknown';
    return {
      result: buildResult({
        phase: 'post',
        uploaded: 0,
        failed: 0,
        deferred: 0,
        movedBack: 0,
        deleted: 0,
        backlog: null,
        alerts: [
          `archive-sync: post-deploy sync skipped — live deployment is not this build (live ${remoteDesc}, local ${localDesc}; ${liveness.reason}); no R2 changes made, daily report not evaluated this run`,
        ],
        dailyReport: { due: false },
        disabled: false,
      }),
      exitCode: 0,
    };
  }

  const rawStore = await createStore(env);
  const store = wrapStoreForBranchGuard(rawStore, env);

  let index;
  try {
    index = (await store.getJson(ARCHIVE_INDEX_KEY)) ?? { version: 1, entries: {} };
  } catch (err) {
    return {
      result: buildResult({
        phase: 'post',
        uploaded: 0,
        failed: 0,
        deferred: 0,
        movedBack: 0,
        deleted: 0,
        backlog: null,
        alerts: [`archive-sync: archive index unreadable — ${err instanceof Error ? err.message : String(err)}`],
        dailyReport: null,
        disabled: false,
      }),
      exitCode: 0,
    };
  }

  let forceFullMarker = null;
  try {
    forceFullMarker = await store.getJson(FORCE_FULL_KEY);
  } catch {
    forceFullMarker = null; // an unreadable marker is treated as absent, not a hard failure
  }
  const forceFull = Boolean(forceFullMarker) || Boolean(forceFullFlag);

  const pathExists = (entry) =>
    existsSync(resolve(root, DIST_CLIENT_DIR, `${String(entry.path).replace(/^\/+/, '')}.html`));

  const diff = diffAgainstIndex({ planEntries, index, forceFull, pathExists });

  const concurrency = Number(env.ARCHIVE_SYNC_CONCURRENCY) > 0 ? Number(env.ARCHIVE_SYNC_CONCURRENCY) : ARCHIVE_SYNC_CONCURRENCY;
  const deadlineAt = getDeadlineMs(root, POST_DEADLINE_SECONDS);

  const { done, failed, notStarted } = await runPool(diff.changedKeys, {
    concurrency,
    deadlineAt,
    now,
    worker: async (entry) => {
      const bytes = readArchiveFileBytes(entry.key, root);
      await store.putObject(entry.key, bytes, { contentType: ARCHIVE_CONTENT_TYPE, sha256: entry.sha256 });
      return entry;
    },
  });

  const add = {};
  for (const { item } of done) {
    add[item.key] = { sha256: item.sha256, bytes: item.bytes, path: item.path, uploadedAt: nowIso() };
  }
  if (failed.length > 0) {
    alerts.push(`archive-sync: ${failed.length} page(s) failed to re-upload — previous copies still serving`);
  }

  // Deletions: promoted orphans delete freely; vanished orphans are capped at max(50, 1% of the
  // index) per run (D-13's own file-count discipline extended to the deletion side) — above the
  // cap, none are deleted this run and an alert is raised instead of a partial delete.
  const indexEntryCount = Object.keys(index.entries ?? {}).length;
  const vanishedCap = Math.max(50, Math.floor(indexEntryCount * 0.01));
  const promotedKeys = diff.promotedOrphans.map((o) => o.key);
  let vanishedKeys = diff.vanishedOrphans.map((o) => o.key);
  if (vanishedKeys.length > vanishedCap) {
    alerts.push(
      `archive-sync: ${vanishedKeys.length} vanished page(s) exceed the deletion cap (${vanishedCap}) — none deleted this run`
    );
    vanishedKeys = [];
  }
  const toDelete = [...promotedKeys, ...vanishedKeys];
  let deletedCount = 0;
  let actuallyDeleted = [];
  if (toDelete.length > 0) {
    // WR-01 (05-14 Task 2): re-check liveness ONE more time, immediately before the delete call —
    // if a deploy landed during the upload phase above, the live deployment may no longer be this
    // build, and deleting now would repeat the exact overlapping-build bug the initial gate exists
    // to prevent. On a mid-run change, skip the delete entirely (not a partial delete) and keep
    // every orphan's index entry — this run's uploads/index-adds above still stand.
    const preDeleteLiveness = await checkLiveDeploymentFn({ attempts: 1 });
    if (!preDeleteLiveness.live) {
      alerts.push(
        `archive-sync: live deployment changed during post-sync — skipping ${toDelete.length} deletion(s); index entries kept`
      );
    } else {
      try {
        const delResult = await store.deleteObjects(toDelete);
        deletedCount = delResult.deleted;
        if (delResult.errors?.length > 0) {
          alerts.push(`archive-sync: ${delResult.errors.length} object(s) failed to delete`);
        }
        // Only drop an index entry for a key that `deleteObjects` actually confirmed deleted — a
        // key that errored (R2 outage, NoSuchKey, anything else) must keep its index entry, or the
        // next run would never retry it and the index would silently lie about what's really in R2.
        const erroredKeys = new Set((delResult.errors ?? []).map((e) => e.key));
        actuallyDeleted = toDelete.filter((key) => !erroredKeys.has(key));
      } catch (err) {
        // WR-02 (05-18): r2-client's own deleteObjects no longer throws mid-batch, but this call
        // must stay defensive regardless of the caller — an unexpected throw here must never crash
        // the run; keep every index entry, since whether any key was actually deleted is unknown.
        alerts.push(
          `archive-sync: deleteObjects failed — ${err instanceof Error ? err.message : String(err)}; index entries kept`
        );
        actuallyDeleted = [];
      }
    }
  }

  if (Object.keys(add).length > 0 || actuallyDeleted.length > 0) {
    try {
      await mergeWriteIndex(store, { add, remove: actuallyDeleted });
    } catch (err) {
      // WR-02 (05-18): the deletion(s)/upload(s) above already happened against R2 — only the
      // bookkeeping write failed. Never throw here: the next pre-sync's index self-heal (above)
      // repairs any resulting drift before a deploy relies on the index being truthful.
      alerts.push(
        `archive-sync: index write failed after post-sync — ${actuallyDeleted.length} deletion(s) and ${Object.keys(add).length} upload(s) may be missing from the index; the next pre-sync self-heals (${err instanceof Error ? err.message : String(err)})`
      );
    }
  }

  const deferredCount = notStarted.length;

  // Backlog bookkeeping (D-10): a deadline-truncated run's leftover `changed` keys are tomorrow's
  // (or the next cycle's) problem, tracked here rather than silently dropped.
  let state;
  try {
    state = (await store.getJson(ARCHIVE_STATE_KEY)) ?? { backlogCount: 0, backlogSince: null, lastConvergedAt: null };
  } catch {
    state = { backlogCount: 0, backlogSince: null, lastConvergedAt: null };
  }
  let backlogSince = state.backlogSince ?? null;
  let lastConvergedAt = state.lastConvergedAt ?? null;
  if (deferredCount > 0) {
    if (!(state.backlogCount > 0 && backlogSince)) {
      backlogSince = nowIso();
    }
  } else {
    if (state.backlogCount > 0) {
      lastConvergedAt = nowIso();
    }
    backlogSince = null;
  }
  try {
    await store.putJson(ARCHIVE_STATE_KEY, {
      backlogCount: deferredCount,
      backlogSince,
      lastConvergedAt,
      updatedAt: nowIso(),
    });
  } catch (err) {
    alerts.push(`archive-sync: archive-state write failed — ${err instanceof Error ? err.message : String(err)}`);
  }

  if (backlogSince) {
    const ageMs = now() - Date.parse(backlogSince);
    if (ageMs >= BACKLOG_ALERT_HOURS * 3600 * 1000) {
      alerts.push('archive-sync: archive re-render backlog older than 20h (D-10)');
    }
  }

  // The force-full marker is cleared only once a run ends with zero backlog — a run that's still
  // deferring work must keep forcing the re-upload on the next attempt too.
  if (forceFullMarker && deferredCount === 0) {
    try {
      await store.deleteObjects([FORCE_FULL_KEY]);
    } catch {
      // Non-fatal: a leftover marker just forces one more (harmless, idempotent) full re-upload.
    }
  }

  // Daily report: due at most once per America/Denver calendar date.
  let dailyReportState = null;
  try {
    dailyReportState = await store.getJson(DAILY_REPORT_KEY);
  } catch {
    dailyReportState = null;
  }
  const today = denverDateString(new Date(now()));
  let dailyReport;
  if (!dailyReportState || dailyReportState.lastReportDate !== today) {
    try {
      await store.putJson(DAILY_REPORT_KEY, { lastReportDate: today });
    } catch (err) {
      // A missed marker write means tomorrow's run will see the same stale lastReportDate and
      // report again — a duplicate report is preferred over a missed one, so `due` stays true
      // below regardless of this write's outcome.
      alerts.push(
        `archive-sync: daily-report marker write failed — ${err instanceof Error ? err.message : String(err)}; today's report may repeat`
      );
    }
    const budget = readStaticBudget(root);
    dailyReport = {
      due: true,
      body: {
        staticFileCount: budget?.staticFileCount ?? null,
        ceiling: budget?.ceiling ?? null,
        failAt: budget?.failAt ?? null,
        archivedCount: (plan.counts?.archivedArticles ?? 0) + (plan.counts?.archivedTags ?? 0),
        hotWindowStatus: plan.hotWindow?.status ?? null,
        hotWindowDays: plan.hotWindow?.days ?? null,
        backlog: deferredCount,
      },
    };
  } else {
    dailyReport = { due: false };
  }

  return {
    result: buildResult({
      phase: 'post',
      uploaded: done.length,
      failed: failed.length,
      deferred: deferredCount,
      movedBack: 0,
      deleted: deletedCount,
      backlog: { count: deferredCount, since: backlogSince },
      alerts,
      dailyReport,
      disabled: false,
    }),
    exitCode: 0,
  };
}

/** Writes the force-full marker (post's next run will re-upload every indexed page). Refuses an
 * empty/whitespace-only reason — a marker with no reason is undebuggable six hours later. */
export async function requestFullReupload({ reason, env = process.env, createStore = defaultCreateStore } = {}) {
  if (typeof reason !== 'string' || reason.trim().length === 0) {
    fail('requestFullReupload requires a non-empty reason');
  }
  const rawStore = await createStore(env);
  const store = wrapStoreForBranchGuard(rawStore, env);
  await store.putJson(FORCE_FULL_KEY, { requestedAt: nowIso(), reason });
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(args) {
  const jsonMode = args.includes('--json');
  const forceFullFlag = args.includes('--force-full');
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : null;
  const reasonIdx = args.indexOf('--reason');
  const reason = reasonIdx >= 0 ? args[reasonIdx + 1] : null;
  return { jsonMode, forceFullFlag, limit, reason };
}

async function main() {
  const args = process.argv.slice(2);
  const sub = args[0];
  const { jsonMode, forceFullFlag, limit, reason } = parseArgs(args);

  if (sub === 'pre') {
    const { result, exitCode } = await runPreSync({ limit });
    if (!jsonMode) {
      console.log(
        `[archive-sync] pre: uploaded=${result.uploaded} failed=${result.failed} movedBack=${result.movedBack} disabled=${result.disabled}`
      );
    }
    console.log(`${RESULT_LINE_PREFIX}${JSON.stringify(result)}`);
    process.exitCode = exitCode;
    return;
  }

  if (sub === 'post') {
    const { result, exitCode } = await runPostSync({ forceFullFlag });
    if (!jsonMode) {
      console.log(
        `[archive-sync] post: uploaded=${result.uploaded} failed=${result.failed} deferred=${result.deferred} deleted=${result.deleted} disabled=${result.disabled}`
      );
    }
    console.log(`${RESULT_LINE_PREFIX}${JSON.stringify(result)}`);
    process.exitCode = exitCode;
    return;
  }

  if (sub === 'request-full') {
    try {
      await requestFullReupload({ reason });
      console.log('archive-sync: full re-upload requested');
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    }
    return;
  }

  console.error(
    'Usage: node tools/archive-sync.mjs <pre|post|request-full --reason "..."> [--limit n] [--force-full] [--json]'
  );
  process.exitCode = 1;
}

/** Prefixes `archive-sync: ` only if the message doesn't already carry it — `fail()`'s own thrown
 * messages already do, and double-prefixing would make the one clean line this exists for look
 * like two. Used only by the CLI's top-level `.catch` below, for an unexpected throw that escapes
 * every other non-fatal handling in `runPreSync`/`runPostSync`. */
function describeTopLevelError(err) {
  const message = err instanceof Error ? err.message : String(err);
  return message.startsWith('archive-sync:') ? message : `archive-sync: ${message}`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(describeTopLevelError(err));
    process.exitCode = 1;
  });
}
