#!/usr/bin/env node
// 05-05: replaces the D-07 bootstrap age fallback with the D-04/D-05/D-06/D-07b hot window —
// derived live from 30 full UTC days of v1's own HUMAN article/tag traffic on 915tldr.com
// (zone 70a6176e850ecde50ab6f41d56ffddb4, Free plan, 31-day retention measured 2026-09-30).
//
// Live schema probe this session (recorded here, not guessed): this zone's
// `ZoneHttpRequestsAdaptiveGroupsDimensions` exposes `requestSource`, `verifiedBotCategory` and
// `userAgent`, but a live query selecting `botScore`/`botScoreBucketBy10` fails with "zone ...
// does not have access to the field" — Bot Management is a paid add-on this Free-plan zone does
// not have, so that signal is NOT populated here and is never used. `verifiedBotCategory` IS
// populated with real values even inside `requestSource: "eyeball"` traffic (observed live:
// "AI Search", "Search Engine Optimization", "Search Engine Crawler", "AI Crawler", "Security")
// — this is the strongest exclusion this zone actually has, so the chosen bot filter is
// `requestSource: "eyeball"` AND `verifiedBotCategory: ""`, with `userAgent` token exclusions
// (several case variants each, since this dataset's filter type has `_notlike` but no
// case-insensitive `_notilike` negation) applied as a floor on top, exactly as this plan's own
// context instructs. The filter is passed as a single GraphQL *variable* (not inlined query
// text) — confirmed live this session that Cloudflare's GraphQL API accepts a nested `AND: [...]`
// array of sub-filter objects this way, which is otherwise impossible to express as literal
// query-text syntax with a repeated field name.
//
// Credential handling mirrors `tools/load-test-zero-reads.mjs`/`tools/measure-worker-kv-cpu.mjs`:
// CLOUDFLARE_API_TOKEN read from `process.env` only via `./lib/cf-graphql.mjs`, never logged.
// Zone-scoped queries need no account id at all (`viewer { zones(filter: { zoneTag }) { ... } }`),
// so no account identifier ever appears in this tool's evidence output either.
//
// Only article/tag URL shapes count toward the derivation (D-07b point 4) — every other path
// (`/cdn-cgi/rum`, `/_payload.json`, `/api/_nuxt_icon/*`, `/_nuxt/*`, category listing pages, a
// crafted path with no uuid at all) is excluded by construction: `parseArticleRequestPath`/
// `parseTagRequestPath` simply don't match it, and `classifyPayloadPath` buckets per-article
// Nuxt client-navigation payload requests separately so they're visible but never double-counted.

import { readFile, writeFile, rename, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { queryCloudflareGraphql, introspectType, redact } from './lib/cf-graphql.mjs';
import { isKnownCategory, CATEGORIES } from '../src/lib/categories.ts';
import { UUID_RE } from '../src/lib/article-url.ts';
import { readTierFacts } from '../src/lib/archive/tier-facts.ts';
import { isHotTag, projectStaticCount } from '../src/lib/archive/tiering.ts';
import { parseHotWindow, HOT_WINDOW_PATH, describeHotWindow } from '../src/lib/archive/hot-window.ts';
import { ARCHIVE_DIR } from './partition-archive.mjs';

export const ZONE_TAG_915TLDR = '70a6176e850ecde50ab6f41d56ffddb4'; // 915tldr.com, v1 production, Free plan
export const WINDOW_DAYS = 30; // D-05
export const HOT_COVERAGE_TARGET = 0.95;
export const HOT_WINDOW_STATIC_CAP = 60_000; // 75% of the 80,000 fail line, post-Phase-6
export const SECONDS_PER_DAY = 86_400;
export const DEFAULT_DIST_CLIENT = 'dist/client';
// WR-08 (05-15): since 05-06 every `pnpm run build` partitions archive-tier pages out of
// `dist/client` into `dist/archive` (`tools/partition-archive.mjs`'s own `ARCHIVE_DIR`,
// re-exported here so this tool never hardcodes a second copy of that path).
export const DEFAULT_DIST_ARCHIVE = ARCHIVE_DIR;

const DEFAULT_PACING_MS = 1000; // "paced at no more than 1 per second" (project rule)
const ROW_LIMIT = 9999;
const BOT_UA_TOKENS = ['bot', 'crawl', 'spider', 'slurp', 'facebookexternalhit', 'preview', 'monitor', 'headless'];

function fail(message) {
  throw new Error(`derive-hot-window: ${message}`);
}

// ---------------------------------------------------------------------------
// Path parsers (Task 1)
// ---------------------------------------------------------------------------

const UUID_SRC = UUID_RE.source.slice(1, -1); // strip the ^...$ anchors so it can be embedded
const ARTICLE_PATH_RE = new RegExp(`^/([a-z0-9-]+)/([a-z0-9-]{1,100})-(${UUID_SRC})/?$`);
const PAYLOAD_PATH_RE = new RegExp(`^/([a-z0-9-]+)/([a-z0-9-]{1,100})-(${UUID_SRC})/_payload\\.json$`);
const TAG_PATH_RE = /^\/tag\/([a-z0-9-]+)\/?$/;

/**
 * Matches `/<known-category>/<slug>-<uuid>` (one optional trailing slash). Returns `{ uuid,
 * category, slug }` or `null` — a category not in `CATEGORIES`, a missing slug prefix, or any
 * other shape (a payload path, a bare asset path, a crafted path with no uuid at all) is `null`.
 */
export function parseArticleRequestPath(requestPath) {
  if (typeof requestPath !== 'string') return null;
  const match = requestPath.match(ARTICLE_PATH_RE);
  if (!match) return null;
  const [, categorySlug, slug, uuid] = match;
  if (!isKnownCategory(categorySlug)) return null;
  return { uuid, category: categorySlug, slug };
}

/**
 * Matches the Nuxt client-navigation payload shape `/<category>/<slug>-<uuid>/_payload.json`.
 * Reported separately from the article count it shadows — never counted toward the hot window.
 */
export function classifyPayloadPath(requestPath) {
  if (typeof requestPath !== 'string') return null;
  const match = requestPath.match(PAYLOAD_PATH_RE);
  if (!match) return null;
  const [, categorySlug, , uuid] = match;
  if (!isKnownCategory(categorySlug)) return null;
  return { uuid };
}

/** Matches `/tag/<slug>` (one optional trailing slash). `/tags` and an uppercase/underscore slug
 * are both `null` — `TAG_SLUG_RE`'s own `[a-z0-9-]+` shape, repeated here rather than imported
 * (this module never imports from `src/lib/server/`; `TAG_SLUG_RE` lives in `article-url.ts`,
 * which has no such restriction, but duplicating one regex literal is simpler than adding a
 * cross-module dependency for it). */
export function parseTagRequestPath(requestPath) {
  if (typeof requestPath !== 'string') return null;
  const match = requestPath.match(TAG_PATH_RE);
  return match ? match[1] : null;
}

// ---------------------------------------------------------------------------
// Age math (Task 1)
// ---------------------------------------------------------------------------

/** Whole-UTC-day age: `floor(requestDay) - floor(publishedDay)`, in days. Negative (published
 * after the request day — a clock skew or a late-correcting publishedAt) clamps to `0` and is
 * flagged `anomaly: true` rather than silently producing a negative age. */
export function requestAgeDays(requestDayEpoch, publishedAtEpoch) {
  if (typeof requestDayEpoch !== 'number' || !Number.isFinite(requestDayEpoch)) {
    fail(`invalid requestDayEpoch: ${JSON.stringify(requestDayEpoch)}`);
  }
  if (typeof publishedAtEpoch !== 'number' || !Number.isFinite(publishedAtEpoch)) {
    fail(`invalid publishedAtEpoch: ${JSON.stringify(publishedAtEpoch)}`);
  }
  const requestDayFloor = Math.floor(requestDayEpoch / SECONDS_PER_DAY) * SECONDS_PER_DAY;
  const publishedDayFloor = Math.floor(publishedAtEpoch / SECONDS_PER_DAY) * SECONDS_PER_DAY;
  const rawDays = Math.round((requestDayFloor - publishedDayFloor) / SECONDS_PER_DAY);
  if (rawDays < 0) return { days: 0, anomaly: true };
  return { days: rawDays, anomaly: false };
}

/** Sums `count` by whole-day age across `entries` (`{ requestDayEpoch, publishedAtEpoch, count
 * }`) via `requestAgeDays`. Returns a plain `{ [age: number]: count }` record — the shape
 * `pickCutoffDays`/`coverageCurve` consume. */
export function requestAgeHistogram(entries) {
  const histogram = {};
  for (const { requestDayEpoch, publishedAtEpoch, count } of entries) {
    const { days } = requestAgeDays(requestDayEpoch, publishedAtEpoch);
    histogram[days] = (histogram[days] ?? 0) + count;
  }
  return histogram;
}

// ---------------------------------------------------------------------------
// Per-day row classification (shared by --probe-day and the full 30-day run)
// ---------------------------------------------------------------------------

/**
 * Classifies one day's raw `{ path, count }` rows (already bot-filtered) against the build's own
 * tier facts. Every row lands in exactly one of: a matched article age bucket, an unmatched
 * article request (uuid not in the corpus — T-05-20's tamper guard), a payload-path request, a
 * matched tag request (further split static/archive under D-08), an unmatched tag request, or
 * neither shape at all (category/tag listing pages, a crafted path with no uuid — silently
 * excluded by construction, not reported as a separate bucket).
 */
export function summarizeDayRows({ rows, dayEpoch, publishedByUuid, tagCountBySlug }) {
  if (!Array.isArray(rows)) fail('summarizeDayRows requires an array of rows');
  const histogram = {};
  const perArticle = new Map();
  let matchedArticleRequests = 0;
  let unmatchedArticleRequests = 0;
  let payloadRequests = 0;
  let matchedTagRequests = 0;
  let unmatchedTagRequests = 0;
  let staticTagRequests = 0;
  let archiveTagRequests = 0;
  let anomalies = 0;

  for (const { path: requestPath, count } of rows) {
    const article = parseArticleRequestPath(requestPath);
    if (article) {
      const publishedAt = publishedByUuid.get(article.uuid);
      if (typeof publishedAt === 'number') {
        const { days, anomaly } = requestAgeDays(dayEpoch, publishedAt);
        histogram[days] = (histogram[days] ?? 0) + count;
        matchedArticleRequests += count;
        if (anomaly) anomalies += count;
        const entry = perArticle.get(article.uuid) ?? { path: requestPath, count: 0, ages: [] };
        entry.count += count;
        entry.ages.push(days);
        perArticle.set(article.uuid, entry);
      } else {
        unmatchedArticleRequests += count;
      }
      continue;
    }
    const payload = classifyPayloadPath(requestPath);
    if (payload) {
      payloadRequests += count;
      continue;
    }
    const tagSlug = parseTagRequestPath(requestPath);
    if (tagSlug) {
      const tagCount = tagCountBySlug.get(tagSlug);
      if (typeof tagCount === 'number') {
        matchedTagRequests += count;
        if (isHotTag(tagCount)) staticTagRequests += count;
        else archiveTagRequests += count;
      } else {
        unmatchedTagRequests += count;
      }
    }
    // Everything else (category/tag listing pages, a crafted path with no uuid shape at all) is
    // excluded by construction — it never matched an article/payload/tag shape.
  }

  return {
    histogram,
    perArticle,
    matchedArticleRequests,
    unmatchedArticleRequests,
    payloadRequests,
    matchedTagRequests,
    unmatchedTagRequests,
    staticTagRequests,
    archiveTagRequests,
    anomalies,
  };
}

// ---------------------------------------------------------------------------
// Coverage cutoff + file-budget cap (Task 2)
// ---------------------------------------------------------------------------

function sortedHistogramEntries(histogram) {
  return Object.entries(histogram)
    .map(([age, count]) => [Number(age), count])
    .sort((a, b) => a[0] - b[0]);
}

/** The smallest whole-day age `N` whose cumulative share of `histogram`'s total reaches `target`
 * (inclusive — a tie at exactly `target` counts). Throws on an empty/all-zero histogram. */
export function pickCutoffDays(histogram, target) {
  const entries = sortedHistogramEntries(histogram);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  if (total === 0) fail('no matched human article requests');
  let cumulative = 0;
  for (const [age, count] of entries) {
    cumulative += count;
    if (cumulative / total >= target) return age;
  }
  return entries[entries.length - 1][0];
}

/** The actual share of `histogram`'s total with age `<= days` — the coverage a given cutoff
 * REALLY achieves, independent of whatever target picked that cutoff in the first place. Used to
 * recompute `achievedCoverage` after `applyStaticCap` has possibly lowered the chosen cutoff — a
 * cap-lowered N almost always covers LESS than the original target, and the record must say so,
 * not repeat the pre-cap figure under a post-cap label. */
export function coverageAtDays(histogram, days) {
  const entries = sortedHistogramEntries(histogram);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  if (total === 0) fail('no matched human article requests');
  return entries.reduce((sum, [age, count]) => (age <= days ? sum + count : sum), 0) / total;
}

/** For each target in `targets`, the chosen `days` (via `pickCutoffDays`) and the coverage
 * actually achieved at that cutoff (>= target, since `pickCutoffDays` is inclusive). */
export function coverageCurve(histogram, targets = [0.8, 0.9, 0.95, 0.99]) {
  return targets.map((target) => {
    const days = pickCutoffDays(histogram, target);
    return { target, days, achievedCoverage: coverageAtDays(histogram, days) };
  });
}

/** Steps `uncappedDays` down (never below 0) until `projectFn(days).phase6Total <= cap`. Returns
 * `{ days, capped, uncappedDays }` — `capped: false` when the uncapped N already fits. */
export function applyStaticCap(uncappedDays, projectFn, cap) {
  if (typeof uncappedDays !== 'number' || !Number.isInteger(uncappedDays) || uncappedDays < 0) {
    fail(`invalid uncappedDays: ${JSON.stringify(uncappedDays)}`);
  }
  if (projectFn(uncappedDays).phase6Total <= cap) {
    return { days: uncappedDays, capped: false, uncappedDays };
  }
  let days = uncappedDays;
  while (days > 0 && projectFn(days).phase6Total > cap) {
    days -= 1;
  }
  return { days, capped: true, uncappedDays };
}

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function isoDate(dayEpoch) {
  return new Date(dayEpoch * 1000).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Atomic write + fallback writer (Task 2)
// ---------------------------------------------------------------------------

/** Validates `record` via `parseHotWindow` FIRST (writes nothing on an invalid record), then
 * writes to a temp file in the same directory and renames it into place (D-07b concurrency: a
 * failed, saturated or interrupted run leaves the previous file untouched; two runs over the same
 * window produce the same result). `deps.simulateFailureBeforeRename` lets a test prove the
 * rename step is really the only thing that can change the file on disk. */
export async function writeHotWindowAtomic(record, filePath = HOT_WINDOW_PATH, deps = {}) {
  const parsed = parseHotWindow(record);
  const {
    writeFileImpl = writeFile,
    renameImpl = rename,
    simulateFailureBeforeRename = false,
  } = deps;
  const dir = path.dirname(filePath);
  const tmpPath = path.join(dir, `.${path.basename(filePath)}.tmp-${process.pid}-${Date.now()}`);
  await writeFileImpl(tmpPath, `${JSON.stringify(parsed, null, 2)}\n`);
  if (simulateFailureBeforeRename) {
    fail('simulated failure before rename');
  }
  await renameImpl(tmpPath, filePath);
  return parsed;
}

/** Writes the D-07 age-based fallback (90 days, `fallback-provisional`) — only ever the launch
 * mechanism when the live derivation genuinely failed, per D-07b point 3. Refuses an empty
 * `reason` — a fallback with no stated cause is not acceptable to ship. */
export async function writeFallback({ reason }, filePath = HOT_WINDOW_PATH, deps = {}) {
  if (typeof reason !== 'string' || reason.trim().length === 0) {
    fail('writeFallback requires a non-empty reason');
  }
  const record = {
    status: 'fallback-provisional',
    provisional: true,
    days: 90,
    basis: 'age-fallback',
    decision: 'D-07',
    reason,
    decidedAt: new Date().toISOString(),
  };
  return writeHotWindowAtomic(record, filePath, deps);
}

// ---------------------------------------------------------------------------
// deriveHotWindow (Task 2 math + Task 1 live fetch, wired together)
// ---------------------------------------------------------------------------

/**
 * Runs the full WINDOW_DAYS-day derivation. `deps.fetchDay(dayEpoch)` is the injectable seam
 * (returns `{ eyeballTotal, humanTotal, articleRows, tagRows }` for that UTC day) — tests supply a
 * fixture-backed fake; the live CLI path supplies `buildLiveFetchDay`. Aborts (throws, writes
 * nothing) if any day's fetch fails or is flagged saturated — every day must succeed before any
 * result is returned (REND-10 concurrency: a failed run leaves the previous file untouched).
 */
export async function deriveHotWindow({
  days = WINDOW_DAYS,
  coverage = HOT_COVERAGE_TARGET,
  now = Date.now(),
  deps = {},
} = {}) {
  const {
    fetchDay,
    readTierFacts: readFacts = readTierFacts,
    projectStaticCount: projectFn = projectStaticCount,
    staticCap = HOT_WINDOW_STATIC_CAP,
    otherFiles,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    pacingMs = DEFAULT_PACING_MS,
  } = deps;

  if (typeof fetchDay !== 'function') fail('deriveHotWindow requires deps.fetchDay');
  if (typeof otherFiles !== 'number' || !Number.isInteger(otherFiles) || otherFiles < 0) {
    fail(`deriveHotWindow requires a non-negative integer deps.otherFiles, got ${JSON.stringify(otherFiles)}`);
  }

  const facts = readFacts();
  const publishedByUuid = new Map(facts.articles.map((a) => [a.uuid, a.publishedAt]));
  const tagCountBySlug = new Map(facts.tags.map((t) => [t.slug, t.count]));

  const nowEpoch = Math.floor(now / 1000);
  const todayFloor = Math.floor(nowEpoch / SECONDS_PER_DAY) * SECONDS_PER_DAY;
  const windowEndDay = todayFloor - SECONDS_PER_DAY; // the window ends the day BEFORE the derivation runs
  const windowStartDay = windowEndDay - (days - 1) * SECONDS_PER_DAY;

  const histogram = {};
  const perArticle = new Map();
  const dayResults = [];
  let articleRequestsCounted = 0;
  let unmatchedArticleRequests = 0;
  let payloadRequests = 0;
  let tagRequestsStatic = 0;
  let tagRequestsArchive = 0;
  let tagRequestsUnmatched = 0;
  let anomalies = 0;
  let eyeballTotal = 0;
  let humanTotal = 0;

  for (let dayEpoch = windowStartDay; dayEpoch <= windowEndDay; dayEpoch += SECONDS_PER_DAY) {
    const dayLabel = isoDate(dayEpoch);
    let dayResult;
    try {
      dayResult = await fetchDay(dayEpoch);
    } catch (err) {
      fail(`day ${dayLabel} failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (!dayResult || dayResult.saturated) {
      fail(`day ${dayLabel} saturated or returned no result — aborting without writing anything`);
    }

    const summary = summarizeDayRows({
      rows: [...(dayResult.articleRows ?? []), ...(dayResult.tagRows ?? [])],
      dayEpoch,
      publishedByUuid,
      tagCountBySlug,
    });

    for (const [age, count] of Object.entries(summary.histogram)) {
      histogram[age] = (histogram[age] ?? 0) + count;
    }
    for (const [uuid, entry] of summary.perArticle) {
      const existing = perArticle.get(uuid) ?? { path: entry.path, count: 0, ages: [] };
      existing.count += entry.count;
      existing.ages.push(...entry.ages);
      perArticle.set(uuid, existing);
    }

    articleRequestsCounted += summary.matchedArticleRequests;
    unmatchedArticleRequests += summary.unmatchedArticleRequests;
    payloadRequests += summary.payloadRequests;
    tagRequestsStatic += summary.staticTagRequests;
    tagRequestsArchive += summary.archiveTagRequests;
    tagRequestsUnmatched += summary.unmatchedTagRequests;
    anomalies += summary.anomalies;
    eyeballTotal += dayResult.eyeballTotal ?? 0;
    humanTotal += dayResult.humanTotal ?? 0;

    dayResults.push({
      day: dayLabel,
      matchedArticleRequests: summary.matchedArticleRequests,
      eyeballTotal: dayResult.eyeballTotal ?? null,
      humanTotal: dayResult.humanTotal ?? null,
    });

    if (dayEpoch < windowEndDay) {
      await sleep(pacingMs);
    }
  }

  if (articleRequestsCounted === 0) {
    fail('no matched human article requests across the window');
  }

  const chosenDays = pickCutoffDays(histogram, coverage);
  const curve = coverageCurve(histogram, [0.8, 0.9, 0.95, 0.99]);
  // Coverage at the UNCAPPED cutoff — what `coverage` alone would have achieved before any
  // file-budget reduction. This is NOT the final `achievedCoverage` once `applyStaticCap` lowers
  // the day count below; it's kept separately (`uncappedCoverage`) so the record never reports a
  // pre-cap coverage figure under the post-cap `days` value.
  const uncappedCoverage = coverageAtDays(histogram, chosenDays);

  const capResult = applyStaticCap(
    chosenDays,
    (candidateDays) =>
      projectFn({
        articleFacts: facts.articles,
        tagFacts: facts.tags,
        days: candidateDays,
        nowEpoch,
        otherFiles,
      }),
    staticCap
  );

  // `achievedCoverage` MUST describe what `capResult.days` (the days value actually shipped in
  // this record) covers — recomputed here, not reused from the uncapped cutoff above. When
  // `capResult.capped` is false the two are identical (capResult.days === chosenDays).
  const achievedCoverage = coverageAtDays(histogram, capResult.days);

  const topArticles = [...perArticle.entries()]
    .map(([uuid, entry]) => ({
      uuid,
      path: entry.path,
      requests: entry.count,
      medianAgeDays: median(entry.ages),
    }))
    .sort((a, b) => b.requests - a.requests)
    .slice(0, 20);

  const tagRequestsTotal = tagRequestsStatic + tagRequestsArchive + tagRequestsUnmatched;
  const botFilteredShare = eyeballTotal > 0 ? 1 - humanTotal / eyeballTotal : null;

  return {
    status: 'derived',
    provisional: false,
    days: capResult.days,
    basis: 'request-age-coverage',
    decision: 'D-07b',
    window: { from: isoDate(windowStartDay), to: isoDate(windowEndDay) },
    coverageTarget: coverage,
    achievedCoverage,
    articleRequestsCounted,
    derivedAt: new Date(now).toISOString(),
    cappedByFileBudget: capResult.capped,
    uncappedDays: capResult.uncappedDays,
    uncappedCoverage,
    botFilter:
      'requestSource:eyeball AND verifiedBotCategory:"" AND userAgent NOT LIKE bot/crawl/spider/slurp/' +
      'facebookexternalhit/preview/monitor/headless (case variants) — botScore/botScoreBucketBy10 are ' +
      'not accessible on this Free-plan zone (no Bot Management), confirmed by a live query error',
    botFilteredShare,
    unmatchedArticleRequests,
    payloadRequests,
    anomalies,
    tagRequestsTotal,
    tagRequestsStatic,
    tagRequestsArchive,
    tagRequestsUnmatched,
    coverageCurve: curve,
    topArticles,
    dayResults,
  };
}

// ---------------------------------------------------------------------------
// Live Cloudflare fetch (Task 1 + Task 3)
// ---------------------------------------------------------------------------

function userAgentExclusionClauses(tokens = BOT_UA_TOKENS) {
  const clauses = [];
  for (const token of tokens) {
    const variants = new Set([token, token[0].toUpperCase() + token.slice(1), token.toUpperCase()]);
    for (const variant of variants) {
      clauses.push({ userAgent_notlike: `%${variant}%` });
    }
  }
  return clauses;
}

/** The chosen bot filter (module header comment) as a GraphQL filter fragment, merged with a
 * caller-supplied base (the datetime range, optionally a `clientRequestPath_like` prefix). */
function humanFilter(base) {
  return { ...base, requestSource: 'eyeball', verifiedBotCategory: '', AND: userAgentExclusionClauses() };
}

async function queryZoneGroup({ zoneTag, filter, limit, selectPath, fetchImpl, env }) {
  const query = selectPath
    ? `query($zoneTag: String!, $filter: ZoneHttpRequestsAdaptiveGroupsFilter_InputObject, $limit: Int!) {
        viewer {
          zones(filter: { zoneTag: $zoneTag }) {
            httpRequestsAdaptiveGroups(limit: $limit, filter: $filter) {
              count
              dimensions { clientRequestPath }
            }
          }
        }
      }`
    : `query($zoneTag: String!, $filter: ZoneHttpRequestsAdaptiveGroupsFilter_InputObject, $limit: Int!) {
        viewer {
          zones(filter: { zoneTag: $zoneTag }) {
            httpRequestsAdaptiveGroups(limit: $limit, filter: $filter) {
              count
            }
          }
        }
      }`;
  const data = await queryCloudflareGraphql(
    { query, variables: { zoneTag, filter, limit } },
    { fetchImpl, env }
  );
  return data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups ?? [];
}

/** One day's aggregate total (no path filter, no grouping) for a given filter fragment. */
async function fetchAggregateTotal({ zoneTag, start, end, human, deps }) {
  const { fetchImpl = fetch, env = process.env } = deps;
  const filter = human
    ? humanFilter({ datetime_geq: start, datetime_lt: end })
    : { datetime_geq: start, datetime_lt: end, requestSource: 'eyeball' };
  const groups = await queryZoneGroup({ zoneTag, filter, limit: 1, selectPath: false, fetchImpl, env });
  return groups.reduce((sum, g) => sum + (g?.count ?? 0), 0);
}

/** Per-path counts for one day under a `clientRequestPath_like` prefix, with the human filter
 * applied. Splits into 24 hourly queries if the day saturates `ROW_LIMIT`; throws if an hour still
 * saturates (T-05-saturation: never silently truncate a day's data). */
async function fetchPathGroupRows({ zoneTag, start, end, prefix, deps }) {
  const { fetchImpl = fetch, env = process.env, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), pacingMs = DEFAULT_PACING_MS } = deps;
  const filter = humanFilter({ datetime_geq: start, datetime_lt: end, clientRequestPath_like: prefix });
  const groups = await queryZoneGroup({ zoneTag, filter, limit: ROW_LIMIT, selectPath: true, fetchImpl, env });
  const rows = groups.map((g) => ({ path: g.dimensions.clientRequestPath, count: g.count }));
  if (rows.length < ROW_LIMIT) return rows;

  const merged = new Map();
  const startMs = new Date(start).getTime();
  for (let hour = 0; hour < 24; hour++) {
    const hourStart = new Date(startMs + hour * 60 * 60 * 1000).toISOString();
    const hourEnd = new Date(startMs + (hour + 1) * 60 * 60 * 1000).toISOString();
    const hourFilter = humanFilter({ datetime_geq: hourStart, datetime_lt: hourEnd, clientRequestPath_like: prefix });
    // eslint-disable-next-line no-await-in-loop
    const hourGroups = await queryZoneGroup({ zoneTag, filter: hourFilter, limit: ROW_LIMIT, selectPath: true, fetchImpl, env });
    if (hourGroups.length >= ROW_LIMIT) {
      fail(`saturated even at hourly granularity for prefix ${prefix}, hour starting ${hourStart}`);
    }
    for (const g of hourGroups) {
      const p = g.dimensions.clientRequestPath;
      merged.set(p, (merged.get(p) ?? 0) + g.count);
    }
    if (hour < 23) {
      // eslint-disable-next-line no-await-in-loop
      await sleep(pacingMs);
    }
  }
  return [...merged.entries()].map(([requestPath, count]) => ({ path: requestPath, count }));
}

/** Builds the `deps.fetchDay` function `deriveHotWindow`/`--probe-day` call for one UTC day:
 * aggregate eyeball/human totals, plus per-path rows for all 8 categories and `/tag/`. Confirms
 * live, via introspection, that the dimensions this filter needs still exist (this project's own
 * `cf-graphql.mjs` convention — query the real schema, never assume it's stable forever). */
export function buildLiveFetchDay({ zoneTag = ZONE_TAG_915TLDR, deps = {} } = {}) {
  const { fetchImpl = fetch, env = process.env, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), pacingMs = DEFAULT_PACING_MS } = deps;

  return async function fetchDay(dayEpoch) {
    const start = new Date(dayEpoch * 1000).toISOString();
    const end = new Date((dayEpoch + SECONDS_PER_DAY) * 1000).toISOString();

    const eyeballTotal = await fetchAggregateTotal({ zoneTag, start, end, human: false, deps: { fetchImpl, env } });
    await sleep(pacingMs);
    const humanTotal = await fetchAggregateTotal({ zoneTag, start, end, human: true, deps: { fetchImpl, env } });
    await sleep(pacingMs);

    const articleRows = [];
    for (const category of CATEGORIES) {
      // eslint-disable-next-line no-await-in-loop
      const rows = await fetchPathGroupRows({ zoneTag, start, end, prefix: `/${category.slug}/%`, deps: { fetchImpl, env, sleep, pacingMs } });
      articleRows.push(...rows);
      // eslint-disable-next-line no-await-in-loop
      await sleep(pacingMs);
    }
    const tagRows = await fetchPathGroupRows({ zoneTag, start, end, prefix: '/tag/%', deps: { fetchImpl, env, sleep, pacingMs } });

    return { eyeballTotal, humanTotal, articleRows, tagRows };
  };
}

/** Confirms, via live introspection, that this zone's dimensions type exposes the fields the
 * chosen filter needs. Throws (naming the missing field) if the schema has drifted. */
async function confirmSchema(deps) {
  const { fetchImpl = fetch, env = process.env } = deps;
  const dims = await introspectType('ZoneHttpRequestsAdaptiveGroupsDimensions', { fetchImpl, env });
  for (const required of ['requestSource', 'verifiedBotCategory', 'userAgent', 'clientRequestPath']) {
    if (!dims.includes(required)) {
      fail(`live schema is missing dimension "${required}" — ZoneHttpRequestsAdaptiveGroupsDimensions has changed`);
    }
  }
}

// ---------------------------------------------------------------------------
// otherFiles (the build's non-article/non-tag static file count)
// ---------------------------------------------------------------------------

async function walkFileCount(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err?.code === 'ENOENT') return 0;
    throw err;
  }
  let count = 0;
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // eslint-disable-next-line no-await-in-loop
      count += await walkFileCount(full);
    } else if (entry.isFile()) {
      count += 1;
    }
  }
  return count;
}

/** `otherFiles` for `projectStaticCount` — every file under BOTH `dist/client` AND `dist/archive`
 * that is neither an article page nor a tag page (one HTML file per tier-facts entry, counted
 * from the last build, so `clientCount + archiveCount - articles - tags` is exact, not an
 * estimate). Both trees must be counted together (WR-08): since 05-06, `pnpm run build` +
 * `tools/partition-archive.mjs` moves archive-tier pages OUT of `dist/client` into `dist/archive`
 * — walking `dist/client` alone undercounts by exactly the number of archived pages (reproduced
 * live as -30,467 against the real partitioned build). Counting both trees means a page is
 * counted exactly once wherever it currently sits — including mid-move-back (archive-sync pre's
 * move-back, or a half-finished partition), since the page simply shifts from one tree's count to
 * the other with no change to the sum. `archiveDir` need not exist (an unpartitioned tree, or a
 * build that predates partitioning) — `walkFileCount` already returns 0 on ENOENT. Throws
 * (never returns a negative) if the facts claim more pages than both trees together hold — that
 * means the build output and the tier facts disagree, not that otherFiles is legitimately
 * negative. */
export async function countOtherFiles(
  distDir = DEFAULT_DIST_CLIENT,
  facts = readTierFacts(),
  archiveDir = DEFAULT_DIST_ARCHIVE
) {
  if (!existsSync(distDir)) {
    fail(`${distDir} does not exist — run \`pnpm run build\` first`);
  }
  const clientCount = await walkFileCount(distDir);
  const archiveCount = await walkFileCount(archiveDir);
  const otherFiles = clientCount + archiveCount - facts.articles.length - facts.tags.length;
  if (otherFiles < 0) {
    fail(
      `countOtherFiles went negative (${otherFiles}): ${distDir} has ${clientCount} files, ` +
        `${archiveDir} has ${archiveCount} files, facts list ${facts.articles.length} articles ` +
        `and ${facts.tags.length} tags — the build output and the tier facts disagree — ` +
        'rebuild with `pnpm run build`'
    );
  }
  return otherFiles;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    probeDay: false,
    coverage: HOT_COVERAGE_TARGET,
    write: false,
    fallback: false,
    reason: null,
    json: false,
    evidence: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--probe-day') { args.probeDay = true; continue; }
    if (arg === '--coverage') { args.coverage = Number(argv[++i]); continue; }
    if (arg.startsWith('--coverage=')) { args.coverage = Number(arg.slice('--coverage='.length)); continue; }
    if (arg === '--write') { args.write = true; continue; }
    if (arg === '--fallback') { args.fallback = true; continue; }
    if (arg === '--reason') { args.reason = argv[++i]; continue; }
    if (arg.startsWith('--reason=')) { args.reason = arg.slice('--reason='.length); continue; }
    if (arg === '--json') { args.json = true; continue; }
    if (arg === '--evidence') { args.evidence = argv[++i]; continue; }
    if (arg.startsWith('--evidence=')) { args.evidence = arg.slice('--evidence='.length); continue; }
  }
  if (!Number.isFinite(args.coverage) || args.coverage <= 0 || args.coverage > 1) {
    throw new Error(`derive-hot-window: --coverage must be a number in (0,1], got ${args.coverage}`);
  }
  return args;
}

async function writeEvidence(dir, name, data) {
  if (!dir) return;
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), JSON.stringify(data, null, 2));
}

async function runProbeDay({ evidence }) {
  await confirmSchema({});
  const facts = readTierFacts();
  const publishedByUuid = new Map(facts.articles.map((a) => [a.uuid, a.publishedAt]));
  const tagCountBySlug = new Map(facts.tags.map((t) => [t.slug, t.count]));

  const now = Date.now();
  const todayFloor = Math.floor(Math.floor(now / 1000) / SECONDS_PER_DAY) * SECONDS_PER_DAY;
  const dayEpoch = todayFloor - SECONDS_PER_DAY; // yesterday

  const fetchDay = buildLiveFetchDay({});
  const dayResult = await fetchDay(dayEpoch);
  const summary = summarizeDayRows({
    rows: [...dayResult.articleRows, ...dayResult.tagRows],
    dayEpoch,
    publishedByUuid,
    tagCountBySlug,
  });

  await writeEvidence(evidence, `probe-day-${isoDate(dayEpoch)}.json`, {
    day: isoDate(dayEpoch),
    eyeballTotal: dayResult.eyeballTotal,
    humanTotal: dayResult.humanTotal,
    articleRows: dayResult.articleRows,
    tagRows: dayResult.tagRows,
  });

  const botFilteredShare = dayResult.eyeballTotal > 0 ? 1 - dayResult.humanTotal / dayResult.eyeballTotal : null;

  return {
    mode: 'probe-day',
    day: isoDate(dayEpoch),
    eyeballTotal: dayResult.eyeballTotal,
    humanTotal: dayResult.humanTotal,
    botFilteredShare,
    botFilter:
      'requestSource:eyeball AND verifiedBotCategory:"" AND userAgent NOT LIKE bot/crawl/spider/slurp/' +
      'facebookexternalhit/preview/monitor/headless (case variants); botScore not accessible (no Bot Management)',
    articleRequestsCounted: summary.matchedArticleRequests,
    unmatchedArticleRequests: summary.unmatchedArticleRequests,
    payloadRequests: summary.payloadRequests,
    matchedTagRequests: summary.matchedTagRequests,
  };
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
    return;
  }

  try {
    if (args.fallback) {
      const record = await writeFallback({ reason: args.reason });
      console.log(describeHotWindow(record));
      if (args.json) console.log(JSON.stringify(record, null, 2));
      console.warn('[derive-hot-window] WARNING: REND-10 is NOT met while the fallback is in effect — escalate to the owner.');
      process.exitCode = 0;
      return;
    }

    if (args.probeDay) {
      const result = await runProbeDay({ evidence: args.evidence });
      if (args.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(
          `[derive-hot-window] probe-day ${result.day}: matched=${result.articleRequestsCounted} ` +
            `botFilteredShare=${(result.botFilteredShare * 100).toFixed(1)}%`
        );
      }
      process.exitCode = 0;
      return;
    }

    await confirmSchema({});
    const facts = readTierFacts();
    const otherFiles = await countOtherFiles(DEFAULT_DIST_CLIENT, facts, DEFAULT_DIST_ARCHIVE);
    const fetchDay = buildLiveFetchDay({});

    const record = await deriveHotWindow({
      days: WINDOW_DAYS,
      coverage: args.coverage,
      deps: { fetchDay, otherFiles },
    });

    if (args.evidence) {
      for (const day of record.dayResults) {
        await writeEvidence(args.evidence, `day-${day.day}.json`, day);
      }
    }

    if (args.write) {
      await writeHotWindowAtomic(record);
      console.log(`[derive-hot-window] wrote: ${describeHotWindow(record)}`);
    } else {
      console.log(`[derive-hot-window] preview (pass --write to commit): ${describeHotWindow(record)}`);
    }
    if (args.json) console.log(JSON.stringify(record, null, 2));
    process.exitCode = 0;
  } catch (err) {
    console.error(redact(`derive-hot-window: ${err instanceof Error ? err.message : String(err)}`, process.env));
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
