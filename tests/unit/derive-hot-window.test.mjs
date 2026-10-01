// 05-05: TDD RED/GREEN suite for tools/derive-hot-window.mjs — the path parsers and age math
// (Task 1, pinned against this plan's own behavior bullets and a real captured live-traffic
// fixture), then the coverage-cutoff math, file-budget cap, atomic write and fallback writer
// (Task 2). Every network boundary is injected (`deps.fetchDay`) — this suite performs no live
// Cloudflare calls, matching this project's own `tools/load-test-zero-reads.mjs` testing
// convention.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  ZONE_TAG_915TLDR,
  WINDOW_DAYS,
  HOT_COVERAGE_TARGET,
  HOT_WINDOW_STATIC_CAP,
  parseArticleRequestPath,
  classifyPayloadPath,
  parseTagRequestPath,
  requestAgeDays,
  requestAgeHistogram,
  summarizeDayRows,
  pickCutoffDays,
  coverageCurve,
  applyStaticCap,
  deriveHotWindow,
  writeHotWindowAtomic,
  writeFallback,
} from '../../tools/derive-hot-window.mjs';
import { parseHotWindow } from '../../src/lib/archive/hot-window.ts';
import { readTierFacts } from '../../src/lib/archive/tier-facts.ts';

const daySampleFixture = JSON.parse(
  readFileSync(new URL('../fixtures/zone-analytics/day-sample.json', import.meta.url))
);

// ---------------------------------------------------------------------------
// Sanity
// ---------------------------------------------------------------------------

test('constants: ZONE_TAG_915TLDR/WINDOW_DAYS/HOT_COVERAGE_TARGET/HOT_WINDOW_STATIC_CAP are the pinned values', () => {
  assert.equal(ZONE_TAG_915TLDR, '70a6176e850ecde50ab6f41d56ffddb4');
  assert.equal(WINDOW_DAYS, 30);
  assert.equal(HOT_COVERAGE_TARGET, 0.95);
  assert.equal(HOT_WINDOW_STATIC_CAP, 60_000);
});

// ---------------------------------------------------------------------------
// parseArticleRequestPath
// ---------------------------------------------------------------------------

const REAL_UUID = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';

test('parseArticleRequestPath: matches /<category>/<slug>-<uuid>, with or without a trailing slash', () => {
  const noSlash = parseArticleRequestPath(`/crime/man-arrested-${REAL_UUID}`);
  assert.deepEqual(noSlash, { uuid: REAL_UUID, category: 'crime', slug: 'man-arrested' });
  const withSlash = parseArticleRequestPath(`/crime/man-arrested-${REAL_UUID}/`);
  assert.deepEqual(withSlash, { uuid: REAL_UUID, category: 'crime', slug: 'man-arrested' });
});

test('parseArticleRequestPath: returns null for an unknown category, a bare uuid (no slug), and non-article shapes', () => {
  assert.equal(parseArticleRequestPath(`/unknown-category/x-${REAL_UUID}`), null);
  assert.equal(parseArticleRequestPath(`/crime/${REAL_UUID}`), null); // no slug prefix
  assert.equal(parseArticleRequestPath(`/article/x-${REAL_UUID}`), null); // "article" is not a real category
  assert.equal(parseArticleRequestPath(`/crime/x-${REAL_UUID}/_payload.json`), null);
  assert.equal(parseArticleRequestPath('/_payload.json'), null);
  assert.equal(parseArticleRequestPath('/cdn-cgi/rum'), null);
  assert.equal(parseArticleRequestPath('/_nuxt/a.js'), null);
  assert.equal(parseArticleRequestPath('/api/_nuxt_icon/x'), null);
  assert.equal(parseArticleRequestPath(42), null);
});

// ---------------------------------------------------------------------------
// classifyPayloadPath
// ---------------------------------------------------------------------------

test('classifyPayloadPath: matches the Nuxt per-article payload shape, reported separately', () => {
  const result = classifyPayloadPath(`/crime/x-${REAL_UUID}/_payload.json`);
  assert.deepEqual(result, { uuid: REAL_UUID });
  assert.equal(classifyPayloadPath(`/crime/x-${REAL_UUID}`), null); // the article itself, not its payload
  assert.equal(classifyPayloadPath('/_payload.json'), null);
});

// ---------------------------------------------------------------------------
// parseTagRequestPath
// ---------------------------------------------------------------------------

test('parseTagRequestPath: matches /tag/<slug>, with or without a trailing slash; rejects /tags and uppercase/underscore slugs', () => {
  assert.equal(parseTagRequestPath('/tag/el-paso'), 'el-paso');
  assert.equal(parseTagRequestPath('/tag/el-paso/'), 'el-paso');
  assert.equal(parseTagRequestPath('/tags'), null);
  assert.equal(parseTagRequestPath('/tag/El_Paso'), null);
});

// ---------------------------------------------------------------------------
// requestAgeDays
// ---------------------------------------------------------------------------

const DAY_2026_09_20 = Date.UTC(2026, 8, 20) / 1000;
const DAY_2026_09_17 = Date.UTC(2026, 8, 17) / 1000;

test('requestAgeDays: age 0 when published the same UTC day as the request', () => {
  const publishedDuringSameDay = DAY_2026_09_20 + 12 * 3600; // noon that day
  assert.deepEqual(requestAgeDays(DAY_2026_09_20, publishedDuringSameDay), { days: 0, anomaly: false });
});

test('requestAgeDays: age 3 when published 3 UTC days earlier', () => {
  assert.deepEqual(requestAgeDays(DAY_2026_09_20, DAY_2026_09_17), { days: 3, anomaly: false });
});

test('requestAgeDays: published after the request day clamps to 0 and is flagged an anomaly', () => {
  const publishedTomorrow = DAY_2026_09_20 + 2 * 86_400;
  assert.deepEqual(requestAgeDays(DAY_2026_09_20, publishedTomorrow), { days: 0, anomaly: true });
});

test('requestAgeDays: throws on non-finite input', () => {
  assert.throws(() => requestAgeDays(NaN, DAY_2026_09_20), /^Error: derive-hot-window:/);
  assert.throws(() => requestAgeDays(DAY_2026_09_20, 'nope'), /^Error: derive-hot-window:/);
});

// ---------------------------------------------------------------------------
// requestAgeHistogram
// ---------------------------------------------------------------------------

test('requestAgeHistogram: sums count by whole-day age across entries', () => {
  const histogram = requestAgeHistogram([
    { requestDayEpoch: DAY_2026_09_20, publishedAtEpoch: DAY_2026_09_20, count: 5 },
    { requestDayEpoch: DAY_2026_09_20, publishedAtEpoch: DAY_2026_09_17, count: 3 },
    { requestDayEpoch: DAY_2026_09_20, publishedAtEpoch: DAY_2026_09_17, count: 2 },
  ]);
  assert.deepEqual(histogram, { 0: 5, 3: 5 });
});

// ---------------------------------------------------------------------------
// summarizeDayRows — fixture-driven, against this build's REAL tier facts
// ---------------------------------------------------------------------------

test('summarizeDayRows: the real day-sample fixture reproduces the exact matched/unmatched/payload counts the live probe-day run printed', () => {
  if (!existsSync('.astro/tier-facts-articles.json') || !existsSync('.astro/tier-facts-tags.json')) {
    // This fixture-driven test is a cross-check against THIS build's own tier facts (same pattern
    // as tests/unit/tier-facts.test.mjs) — skip rather than fail if no build has run yet.
    return;
  }
  const facts = readTierFacts();
  const publishedByUuid = new Map(facts.articles.map((a) => [a.uuid, a.publishedAt]));
  const tagCountBySlug = new Map(facts.tags.map((t) => [t.slug, t.count]));

  const summary = summarizeDayRows({
    rows: daySampleFixture.rows,
    dayEpoch: daySampleFixture.dayEpoch,
    publishedByUuid,
    tagCountBySlug,
  });

  // Recorded live this session: tools/derive-hot-window.mjs's own query, for /crime/ on
  // 2026-09-30, with the chosen bot filter applied, against this build's real tier facts.
  assert.equal(summary.matchedArticleRequests, 174);
  assert.equal(summary.unmatchedArticleRequests, 0);
  assert.equal(summary.payloadRequests, 33);
});

test('summarizeDayRows: every row lands in exactly one bucket or none (never double-counted)', () => {
  const dayEpoch = DAY_2026_09_20;
  const publishedByUuid = new Map([[REAL_UUID, DAY_2026_09_17]]);
  const tagCountBySlug = new Map([['el-paso', 12], ['thin-tag', 2]]);
  const rows = [
    { path: `/crime/man-arrested-${REAL_UUID}`, count: 10 },
    { path: `/crime/man-arrested-${REAL_UUID}/_payload.json`, count: 4 },
    { path: '/crime/some-unknown-article-00000000-0000-0000-0000-000000000000', count: 2 },
    { path: '/tag/el-paso', count: 6 },
    { path: '/tag/thin-tag', count: 1 },
    { path: '/tag/unmatched-tag', count: 3 },
    { path: '/crime/', count: 5 }, // category listing — matches nothing
  ];
  const summary = summarizeDayRows({ rows, dayEpoch, publishedByUuid, tagCountBySlug });
  assert.equal(summary.matchedArticleRequests, 10);
  assert.equal(summary.payloadRequests, 4);
  assert.equal(summary.unmatchedArticleRequests, 2);
  assert.equal(summary.staticTagRequests, 6);
  assert.equal(summary.archiveTagRequests, 1);
  assert.equal(summary.unmatchedTagRequests, 3);
});

// ---------------------------------------------------------------------------
// pickCutoffDays
// ---------------------------------------------------------------------------

test('pickCutoffDays: smallest age whose cumulative share reaches the target, inclusive at ties', () => {
  const histogram = { 0: 50, 1: 30, 2: 10, 3: 5, 10: 5 };
  assert.equal(pickCutoffDays(histogram, 0.95), 3);
  assert.equal(pickCutoffDays(histogram, 0.8), 1);
});

test('pickCutoffDays: throws on an empty histogram', () => {
  assert.throws(() => pickCutoffDays({}, 0.95), /^Error: derive-hot-window: no matched human article requests$/);
});

// ---------------------------------------------------------------------------
// coverageCurve
// ---------------------------------------------------------------------------

test('coverageCurve: returns N and achieved coverage for 80/90/95/99%', () => {
  const histogram = { 0: 50, 1: 30, 2: 10, 3: 5, 10: 5 };
  const curve = coverageCurve(histogram, [0.8, 0.9, 0.95, 0.99]);
  assert.deepEqual(curve.map((c) => c.target), [0.8, 0.9, 0.95, 0.99]);
  assert.equal(curve.find((c) => c.target === 0.8).days, 1);
  assert.equal(curve.find((c) => c.target === 0.95).days, 3);
  assert.equal(curve.find((c) => c.target === 0.99).days, 10);
  for (const c of curve) {
    assert.ok(c.achievedCoverage >= c.target);
  }
});

// ---------------------------------------------------------------------------
// applyStaticCap
// ---------------------------------------------------------------------------

function fakeProjection(days) {
  // 100 "hot" units per day of window, cap applied to 2x that (phase6Total).
  return { phase6Total: days * 200 };
}

test('applyStaticCap: lowers N until phase6Total fits the cap, flags capped and keeps uncappedDays', () => {
  const result = applyStaticCap(400, fakeProjection, 60_000);
  assert.equal(result.capped, true);
  assert.equal(result.uncappedDays, 400);
  assert.ok(fakeProjection(result.days).phase6Total <= 60_000);
  assert.ok(fakeProjection(result.days + 1).phase6Total > 60_000);
});

test('applyStaticCap: capped is false when the uncapped N already fits', () => {
  const result = applyStaticCap(30, fakeProjection, 60_000);
  assert.deepEqual(result, { days: 30, capped: false, uncappedDays: 30 });
});

// ---------------------------------------------------------------------------
// deriveHotWindow — fixture-backed deps.fetchDay, no live network
// ---------------------------------------------------------------------------

function fixtureDeps({ failOnDay = null, saturateOnDay = null } = {}) {
  const published = DAY_2026_09_17; // every fixture article "published" 3 days before a clustered age-3 day
  const articleUuid = '11111111-1111-1111-1111-111111111111';
  let dayIndex = -1;
  return {
    fetchDay: async (dayEpoch) => {
      dayIndex += 1;
      const label = new Date(dayEpoch * 1000).toISOString().slice(0, 10);
      if (failOnDay === dayIndex) throw new Error('simulated fetch failure');
      if (saturateOnDay === dayIndex) return { saturated: true };
      return {
        eyeballTotal: 100,
        humanTotal: 60,
        articleRows: [{ path: `/crime/x-${articleUuid}`, count: 10 }],
        tagRows: [],
      };
    },
    readTierFacts: () => ({
      articles: [{ uuid: articleUuid, path: `/crime/x-${articleUuid}`, publishedAt: published }],
      tags: [],
    }),
    projectStaticCount: ({ days }) => ({ phase6Total: 100 + days }),
    otherFiles: 100,
    sleep: async () => {},
    pacingMs: 0,
  };
}

test('deriveHotWindow: over 30 fixture days returns a record parseHotWindow accepts', async () => {
  const now = Date.UTC(2026, 9, 1); // 2026-10-01 — window ends 2026-09-30, starts 2026-09-01
  const record = await deriveHotWindow({ days: 30, coverage: 0.95, now, deps: fixtureDeps() });
  const parsed = parseHotWindow(record);
  assert.equal(parsed.status, 'derived');
  assert.equal(parsed.provisional, false);
  assert.equal(parsed.basis, 'request-age-coverage');
  assert.equal(parsed.decision, 'D-07b');
  assert.equal(parsed.window.from, '2026-09-01');
  assert.equal(parsed.window.to, '2026-09-30');
  assert.equal(parsed.coverageTarget, 0.95);
  assert.ok(parsed.articleRequestsCounted > 0);
  assert.ok(Number.isFinite(Date.parse(parsed.derivedAt)));
});

test('deriveHotWindow: throws (writes nothing) when a day fetch fails', async () => {
  await assert.rejects(
    () => deriveHotWindow({ days: 30, coverage: 0.95, now: Date.UTC(2026, 9, 1), deps: fixtureDeps({ failOnDay: 5 }) }),
    /^Error: derive-hot-window:/
  );
});

test('deriveHotWindow: throws when a day is flagged saturated', async () => {
  await assert.rejects(
    () => deriveHotWindow({ days: 30, coverage: 0.95, now: Date.UTC(2026, 9, 1), deps: fixtureDeps({ saturateOnDay: 10 }) }),
    /saturated/
  );
});

// ---------------------------------------------------------------------------
// writeHotWindowAtomic / writeFallback
// ---------------------------------------------------------------------------

function tempHotWindowPath() {
  const dir = mkdtempSync(path.join(tmpdir(), 'derive-hot-window-test-'));
  return { dir, filePath: path.join(dir, 'hot-window.json') };
}

const derivedRecord = {
  status: 'derived',
  provisional: false,
  days: 30,
  basis: 'request-age-coverage',
  decision: 'D-07b',
  window: { from: '2026-09-01', to: '2026-09-30' },
  coverageTarget: 0.95,
  achievedCoverage: 0.97,
  articleRequestsCounted: 1000,
  derivedAt: '2026-10-01T00:00:00Z',
};

test('writeHotWindowAtomic: writes to a temp file and renames it into place', async () => {
  const { dir, filePath } = tempHotWindowPath();
  try {
    await writeHotWindowAtomic(derivedRecord, filePath);
    const onDisk = JSON.parse(readFileSync(filePath, 'utf8'));
    assert.equal(onDisk.status, 'derived');
    assert.equal(onDisk.days, 30);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('writeHotWindowAtomic: a simulated failure before rename leaves the original file byte-identical', async () => {
  const { dir, filePath } = tempHotWindowPath();
  try {
    await writeHotWindowAtomic(derivedRecord, filePath);
    const before = readFileSync(filePath, 'utf8');
    await assert.rejects(
      () => writeHotWindowAtomic({ ...derivedRecord, days: 999 }, filePath, { simulateFailureBeforeRename: true }),
      /simulated failure before rename/
    );
    const after = readFileSync(filePath, 'utf8');
    assert.equal(after, before);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('writeHotWindowAtomic: refuses to write an invalid record (parseHotWindow rejects it first)', async () => {
  const { dir, filePath } = tempHotWindowPath();
  try {
    await assert.rejects(() => writeHotWindowAtomic({ status: 'bogus' }, filePath), /^Error: hot-window:/);
    assert.equal(existsSync(filePath), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('writeFallback: writes the D-07 fallback shape with the given reason', async () => {
  const { dir, filePath } = tempHotWindowPath();
  try {
    const record = await writeFallback({ reason: 'live query failed: permission denied' }, filePath);
    assert.equal(record.status, 'fallback-provisional');
    assert.equal(record.provisional, true);
    assert.equal(record.days, 90);
    assert.equal(record.basis, 'age-fallback');
    assert.equal(record.decision, 'D-07');
    assert.equal(record.reason, 'live query failed: permission denied');
    const onDisk = JSON.parse(readFileSync(filePath, 'utf8'));
    assert.equal(onDisk.status, 'fallback-provisional');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('writeFallback: refuses an empty reason', async () => {
  const { dir, filePath } = tempHotWindowPath();
  try {
    await assert.rejects(() => writeFallback({ reason: '' }, filePath), /non-empty reason/);
    await assert.rejects(() => writeFallback({}, filePath), /non-empty reason/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
