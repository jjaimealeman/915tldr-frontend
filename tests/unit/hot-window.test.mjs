// 05-01 Task 2: TDD RED/GREEN suite for src/lib/archive/hot-window.ts — pins parseHotWindow's
// full validation (accepting a derived window and the bootstrap fallback; rejecting an unknown
// status, non-integer/non-positive days, a fallback not flagged provisional, a derived window
// flagged provisional, and a non-object) and describeHotWindow's PROVISIONAL/derived-window
// output shape.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHotWindow, describeHotWindow, HOT_WINDOW_STATUSES } from '../../src/lib/archive/hot-window.ts';

function fallbackWindow(overrides = {}) {
  return {
    status: 'fallback-provisional',
    provisional: true,
    days: 90,
    basis: 'age-fallback',
    decision: 'D-07',
    reason: 'bootstrap until 05-05 derives the window from 30 days of human traffic (D-07b)',
    decidedAt: '2026-09-30',
    ...overrides,
  };
}

function derivedWindow(overrides = {}) {
  return {
    status: 'derived',
    provisional: false,
    days: 30,
    basis: 'traffic',
    decision: 'D-04/D-05/D-06/D-07b',
    window: { from: '2026-09-01', to: '2026-09-30' },
    coverageTarget: 0.95,
    achievedCoverage: 0.97,
    articleRequestsCounted: 123_456,
    derivedAt: '2026-09-30T12:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// parseHotWindow — accepted shapes
// ---------------------------------------------------------------------------

test('parseHotWindow: accepts the bootstrap fallback window unchanged', () => {
  const window = fallbackWindow();
  assert.deepEqual(parseHotWindow(window), window);
});

test('parseHotWindow: accepts a derived window with all required fields', () => {
  const window = derivedWindow();
  assert.deepEqual(parseHotWindow(window), window);
});

test('parseHotWindow: passes through additional fields unchanged (e.g. cappedByFileBudget)', () => {
  const window = derivedWindow({ cappedByFileBudget: true, uncappedDays: 45 });
  const parsed = parseHotWindow(window);
  assert.equal(parsed.cappedByFileBudget, true);
  assert.equal(parsed.uncappedDays, 45);
});

// ---------------------------------------------------------------------------
// parseHotWindow — rejected shapes
// ---------------------------------------------------------------------------

test('parseHotWindow: rejects a non-object', () => {
  assert.throws(() => parseHotWindow('not-an-object'), /^Error: hot-window:/);
  assert.throws(() => parseHotWindow(null), /^Error: hot-window:/);
  assert.throws(() => parseHotWindow([1, 2, 3]), /^Error: hot-window:/);
});

test('parseHotWindow: rejects an unknown status', () => {
  assert.throws(() => parseHotWindow(fallbackWindow({ status: 'bogus' })), /^Error: hot-window:/);
  // Sanity: HOT_WINDOW_STATUSES is exactly the two known statuses.
  assert.deepEqual([...HOT_WINDOW_STATUSES].sort(), ['derived', 'fallback-provisional']);
});

test('parseHotWindow: rejects days: 0', () => {
  assert.throws(() => parseHotWindow(fallbackWindow({ days: 0 })), /^Error: hot-window:/);
});

test('parseHotWindow: rejects days: 2.5 (non-integer)', () => {
  assert.throws(() => parseHotWindow(fallbackWindow({ days: 2.5 })), /^Error: hot-window:/);
});

test('parseHotWindow: rejects a fallback-provisional window with provisional: false', () => {
  assert.throws(
    () => parseHotWindow(fallbackWindow({ provisional: false })),
    /^Error: hot-window:/
  );
});

test('parseHotWindow: rejects a derived window with provisional: true', () => {
  assert.throws(() => parseHotWindow(derivedWindow({ provisional: true })), /^Error: hot-window:/);
});

test('parseHotWindow: rejects a derived window missing window.from/window.to', () => {
  const window = derivedWindow();
  delete window.window;
  assert.throws(() => parseHotWindow(window), /^Error: hot-window:/);
});

test('parseHotWindow: rejects a derived window with coverageTarget/achievedCoverage outside (0,1]', () => {
  assert.throws(
    () => parseHotWindow(derivedWindow({ coverageTarget: 0 })),
    /^Error: hot-window:/
  );
  assert.throws(
    () => parseHotWindow(derivedWindow({ achievedCoverage: 1.5 })),
    /^Error: hot-window:/
  );
});

test('parseHotWindow: rejects a derived window with a non-ISO derivedAt', () => {
  assert.throws(
    () => parseHotWindow(derivedWindow({ derivedAt: 'not-a-date' })),
    /^Error: hot-window:/
  );
});

test('parseHotWindow: rejects a derived window with a negative articleRequestsCounted', () => {
  assert.throws(
    () => parseHotWindow(derivedWindow({ articleRequestsCounted: -1 })),
    /^Error: hot-window:/
  );
});

// ---------------------------------------------------------------------------
// describeHotWindow
// ---------------------------------------------------------------------------

test('describeHotWindow: the fallback window contains PROVISIONAL and 90', () => {
  const description = describeHotWindow(fallbackWindow());
  assert.match(description, /PROVISIONAL/);
  assert.match(description, /90/);
  assert.match(description, /^\[archive\] hot window:/);
});

test('describeHotWindow: a derived window contains the window dates and coverage, never PROVISIONAL', () => {
  const description = describeHotWindow(derivedWindow());
  assert.match(description, /2026-09-01/);
  assert.match(description, /2026-09-30/);
  assert.match(description, /97%/);
  assert.doesNotMatch(description, /PROVISIONAL/);
  assert.match(description, /^\[archive\] hot window:/);
});
