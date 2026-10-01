// 05-01 Task 2: TDD RED/GREEN suite for src/lib/archive/tiering.ts — pins the D-08 tag threshold
// (9/10/11 boundary) and the article hot-cutoff boundary (cutoffEpoch -1/+1) exactly, plus the
// throw-on-invalid-input discipline every pure tiering function must have. Mirrors
// tests/unit/article-redirect.test.mjs's node:test + assert/strict + table-driven style.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HOT_TAG_MIN_ARTICLES,
  SECONDS_PER_DAY,
  isHotTag,
  hotCutoffEpoch,
  isHotArticle,
  classifyArticles,
  classifyTags,
  projectStaticCount,
} from '../../src/lib/archive/tiering.ts';

// ---------------------------------------------------------------------------
// isHotTag — D-08 boundary: 9/10/11
// ---------------------------------------------------------------------------

test('isHotTag: 9 articles is archive-tier (false)', () => {
  assert.equal(isHotTag(9), false);
});

test('isHotTag: exactly 10 articles is hot (true) — the D-08 threshold is inclusive', () => {
  assert.equal(isHotTag(10), true);
  assert.equal(HOT_TAG_MIN_ARTICLES, 10);
});

test('isHotTag: 11 articles is hot (true)', () => {
  assert.equal(isHotTag(11), true);
});

test('isHotTag: 0 throws a tiering: error', () => {
  assert.throws(() => isHotTag(0), /^Error: tiering:/);
});

test('isHotTag: a negative count throws a tiering: error', () => {
  assert.throws(() => isHotTag(-1), /^Error: tiering:/);
});

test('isHotTag: a non-integer count throws a tiering: error', () => {
  assert.throws(() => isHotTag(1.5), /^Error: tiering:/);
});

test('isHotTag: NaN throws a tiering: error', () => {
  assert.throws(() => isHotTag(NaN), /^Error: tiering:/);
});

// ---------------------------------------------------------------------------
// hotCutoffEpoch — UTC-day-floored
// ---------------------------------------------------------------------------

test('hotCutoffEpoch: result is a multiple of SECONDS_PER_DAY and equals the UTC-day floor minus days*SECONDS_PER_DAY', () => {
  const nowEpoch = 1_759_300_000;
  const days = 90;
  const expected = Math.floor(nowEpoch / SECONDS_PER_DAY) * SECONDS_PER_DAY - days * SECONDS_PER_DAY;
  const result = hotCutoffEpoch(nowEpoch, days);
  assert.equal(result, expected);
  assert.equal(result % SECONDS_PER_DAY, 0);
});

test('hotCutoffEpoch: two "now" values in the same UTC day give the same cutoff', () => {
  const dayStart = 1_759_300_800; // some UTC day boundary-ish second
  const a = hotCutoffEpoch(dayStart, 30);
  const b = hotCutoffEpoch(dayStart + 3600, 30); // 1 hour later, same UTC day
  assert.equal(a, b);
});

// ---------------------------------------------------------------------------
// isHotArticle — inclusive cutoff boundary
// ---------------------------------------------------------------------------

test('isHotArticle: publishedAt === cutoffEpoch is hot (inclusive)', () => {
  const cutoff = 1_700_000_000;
  assert.equal(isHotArticle(cutoff, cutoff), true);
});

test('isHotArticle: publishedAt === cutoffEpoch - 1 is archive', () => {
  const cutoff = 1_700_000_000;
  assert.equal(isHotArticle(cutoff - 1, cutoff), false);
});

test('isHotArticle: publishedAt === cutoffEpoch + 1 is hot', () => {
  const cutoff = 1_700_000_000;
  assert.equal(isHotArticle(cutoff + 1, cutoff), true);
});

test('isHotArticle: a non-integer publishedAt throws a tiering: error', () => {
  assert.throws(() => isHotArticle(1_700_000_000.5, 1_700_000_000), /^Error: tiering:/);
});

// ---------------------------------------------------------------------------
// classifyArticles / classifyTags
// ---------------------------------------------------------------------------

test('classifyTags: a 9-article tag lands in archive, a 10-article tag lands in hot, every input lands in exactly one list', () => {
  const facts = [
    { slug: 'a', count: 9 },
    { slug: 'b', count: 10 },
  ];
  const { hot, archive } = classifyTags(facts);
  assert.deepEqual(hot.map((f) => f.slug), ['b']);
  assert.deepEqual(archive.map((f) => f.slug), ['a']);
  assert.equal(hot.length + archive.length, facts.length);
});

test('classifyArticles: partitions by isHotArticle, every input lands in exactly one list', () => {
  const cutoff = 1_700_000_000;
  const facts = [
    { uuid: 'hot-1', publishedAt: cutoff + 10 },
    { uuid: 'archive-1', publishedAt: cutoff - 10 },
    { uuid: 'hot-2', publishedAt: cutoff },
  ];
  const { hot, archive } = classifyArticles(facts, cutoff);
  assert.deepEqual(hot.map((f) => f.uuid).sort(), ['hot-1', 'hot-2']);
  assert.deepEqual(archive.map((f) => f.uuid), ['archive-1']);
  assert.equal(hot.length + archive.length, facts.length);
});

// ---------------------------------------------------------------------------
// projectStaticCount
// ---------------------------------------------------------------------------

test('projectStaticCount: total = hotArticles + staticTags + otherFiles; phase6Total = 2*(hotArticles+staticTags) + otherFiles', () => {
  const nowEpoch = 1_759_300_000;
  const cutoff = hotCutoffEpoch(nowEpoch, 90);
  const articleFacts = [
    { publishedAt: cutoff + 100 }, // hot
    { publishedAt: cutoff - 100 }, // archive
    { publishedAt: cutoff + 200 }, // hot
  ];
  const tagFacts = [
    { count: 9 }, // archive
    { count: 10 }, // hot
    { count: 25 }, // hot
  ];
  const otherFiles = 500;

  const result = projectStaticCount({ articleFacts, tagFacts, days: 90, nowEpoch, otherFiles });

  assert.equal(result.hotArticles, 2);
  assert.equal(result.staticTags, 2);
  assert.equal(result.otherFiles, otherFiles);
  assert.equal(result.total, result.hotArticles + result.staticTags + result.otherFiles);
  assert.equal(result.phase6Total, 2 * (result.hotArticles + result.staticTags) + result.otherFiles);
});
