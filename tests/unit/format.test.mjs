// 04-02 (Task 1, RED-first): pins deterministic, timezone-independent date formatting for the
// byline, dateline and ISO-with-offset strings every article/card uses. Follows this repo's
// `node:test` + `assert/strict` convention (tests/unit/d1-client.test.mjs,
// tests/unit/manifest-schema.test.mjs) — no Jest, no Vitest.
//
// TZ-independence is proven by spawning a real child process with `process.env.TZ` set to two
// different zones (UTC and Asia/Tokyo) — same pattern `tests/unit/astro-config.test.mjs` uses for
// spawning `node` with a controlled environment — and asserting identical output. A test that only
// checked the current process's output would say nothing about the host machine's zone at all.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { formatBylineTime, formatDateline, isoWithOffset, TIME_ZONE } from '../../src/lib/format.ts';

const REPO_ROOT = path.resolve(import.meta.dirname, '../..');
const FORMAT_MODULE = path.join(REPO_ROOT, 'src/lib/format.ts');

// Epoch seconds fixtures (all from the plan's own behavior spec).
const SEPT_16_2026_1906_UTC = 1789592808; // 2026-09-16T19:06:48Z
const DEC_15_2025_2000_UTC = 1765828800; // 2025-12-15T20:00:00Z
const SEPT_16_2026_1800_UTC = 1789588800; // 2026-09-16T18:00:00Z

test('TIME_ZONE is America/Denver', () => {
  assert.equal(TIME_ZONE, 'America/Denver');
});

test('formatBylineTime: MDT afternoon instant renders AP-style "Sept. 16, 1:06 p.m."', () => {
  assert.equal(formatBylineTime(SEPT_16_2026_1906_UTC), 'Sept. 16, 1:06 p.m.');
});

test('formatBylineTime: MST winter instant renders "Dec. 15, 1:00 p.m." (winter offset)', () => {
  assert.equal(formatBylineTime(DEC_15_2025_2000_UTC), 'Dec. 15, 1:00 p.m.');
});

test('formatBylineTime: noon-hour instant renders "Sept. 16, 12:00 p.m."', () => {
  assert.equal(formatBylineTime(SEPT_16_2026_1800_UTC), 'Sept. 16, 12:00 p.m.');
});

test('formatBylineTime: AP month abbreviation table — March/April/May/June/July spelled out, others abbreviated', () => {
  const monthCases = [
    ['2026-01-15T19:00:00Z', 'Jan.'],
    ['2026-02-15T19:00:00Z', 'Feb.'],
    ['2026-03-15T19:00:00Z', 'March'],
    ['2026-04-15T19:00:00Z', 'April'],
    ['2026-05-15T19:00:00Z', 'May'],
    ['2026-06-15T19:00:00Z', 'June'],
    ['2026-07-15T19:00:00Z', 'July'],
    ['2026-08-15T19:00:00Z', 'Aug.'],
    ['2026-09-15T19:00:00Z', 'Sept.'],
    ['2026-10-15T19:00:00Z', 'Oct.'],
    ['2026-11-15T19:00:00Z', 'Nov.'],
    ['2026-12-15T19:00:00Z', 'Dec.'],
  ];
  for (const [iso, expectedMonth] of monthCases) {
    const epoch = Math.floor(new Date(iso).getTime() / 1000);
    const result = formatBylineTime(epoch);
    assert.ok(
      result.startsWith(expectedMonth),
      `expected ${iso} to render month "${expectedMonth}", got "${result}"`
    );
  }
});

test('formatBylineTime: withYear appends the year between day and time', () => {
  assert.equal(
    formatBylineTime(DEC_15_2025_2000_UTC, { withYear: true }),
    'Dec. 15, 2025, 1:00 p.m.'
  );
});

test('formatDateline: full weekday/month/day/year', () => {
  assert.equal(formatDateline(SEPT_16_2026_1906_UTC), 'Wednesday, September 16, 2026');
});

test('isoWithOffset: MDT instant renders local wall time with -06:00 offset', () => {
  assert.equal(isoWithOffset(SEPT_16_2026_1906_UTC), '2026-09-16T13:06:48-06:00');
});

test('isoWithOffset: winter instant renders -07:00 offset', () => {
  const result = isoWithOffset(DEC_15_2025_2000_UTC);
  assert.ok(result.endsWith('-07:00'), `expected a -07:00 suffix, got "${result}"`);
});

test('formatBylineTime/formatDateline/isoWithOffset are identical regardless of process.env.TZ (UTC vs Asia/Tokyo)', () => {
  const script = `
    const { formatBylineTime, formatDateline, isoWithOffset } = await import(${JSON.stringify(
      'file://' + FORMAT_MODULE
    )});
    const epoch = ${SEPT_16_2026_1906_UTC};
    console.log(JSON.stringify({
      byline: formatBylineTime(epoch),
      dateline: formatDateline(epoch),
      iso: isoWithOffset(epoch),
    }));
  `;

  function runWithTz(tz) {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      encoding: 'utf8',
      env: { ...process.env, TZ: tz },
    });
    assert.equal(result.status, 0, `node exited non-zero under TZ=${tz}: ${result.stderr}`);
    return JSON.parse(result.stdout.trim());
  }

  const underUtc = runWithTz('UTC');
  const underTokyo = runWithTz('Asia/Tokyo');
  assert.deepEqual(underUtc, underTokyo);
  assert.equal(underUtc.byline, 'Sept. 16, 1:06 p.m.');
});
