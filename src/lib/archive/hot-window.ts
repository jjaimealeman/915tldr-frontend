// 05-01 Task 1 (minimal — Task 2 adds full derived-window validation): the hot-window config
// parser/loader. `src/lib/archive/hot-window.json` is the single source of the hot-article cutoff
// — D-07's committed bootstrap fallback today, replaced by a traffic-derived window in 05-05.
//
// Reads via node:fs (not a JSON import), so both Node tests and the Astro build resolve the same
// file the same way, relative to `process.cwd()` — both run from the repo root. Every thrown
// message is prefixed `hot-window:` (the convention `tools/ci-build.mjs`'s `classifyFailure`
// anchors on). A missing, malformed, or unflagged-provisional fallback file throws — there is no
// default cutoff to fall back to silently (T-05-02).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const HOT_WINDOW_STATUSES = ['derived', 'fallback-provisional'] as const;
export type HotWindowStatus = (typeof HOT_WINDOW_STATUSES)[number];

export interface HotWindow {
  status: HotWindowStatus;
  provisional: boolean;
  days: number;
  basis: string;
  decision: string;
  [key: string]: unknown;
}

function fail(message: string): never {
  throw new Error(`hot-window: ${message}`);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Validates a number lies in (0, 1] — `coverageTarget`/`achievedCoverage` are fractions, never
 * a percentage or an out-of-range value. */
function assertCoverageFraction(value: unknown, label: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 1) {
    fail(`${label} must be a number in (0,1], got ${JSON.stringify(value)}`);
  }
}

/** Validates the derived-window-only fields (D-04/D-05/D-06/D-07b, the fields 05-05 writes):
 * `window.from`/`window.to` (YYYY-MM-DD), `coverageTarget`/`achievedCoverage` (fractions in
 * (0,1]), `articleRequestsCounted` (non-negative integer), `derivedAt` (ISO string). Additional
 * fields (e.g. `cappedByFileBudget`, `uncappedDays`, `botFilter`, `reason`) are allowed and
 * passed through unchanged by the caller. */
function assertDerivedFields(candidate: Record<string, unknown>): void {
  const window = candidate.window;
  if (!window || typeof window !== 'object' || Array.isArray(window)) {
    fail('a derived window requires a window.from/window.to object');
  }
  const w = window as Record<string, unknown>;
  if (typeof w.from !== 'string' || !DATE_RE.test(w.from)) {
    fail(`window.from must be a YYYY-MM-DD date, got ${JSON.stringify(w.from)}`);
  }
  if (typeof w.to !== 'string' || !DATE_RE.test(w.to)) {
    fail(`window.to must be a YYYY-MM-DD date, got ${JSON.stringify(w.to)}`);
  }
  assertCoverageFraction(candidate.coverageTarget, 'coverageTarget');
  assertCoverageFraction(candidate.achievedCoverage, 'achievedCoverage');
  if (
    typeof candidate.articleRequestsCounted !== 'number' ||
    !Number.isInteger(candidate.articleRequestsCounted) ||
    candidate.articleRequestsCounted < 0
  ) {
    fail(
      `articleRequestsCounted must be a non-negative integer, got ${JSON.stringify(candidate.articleRequestsCounted)}`
    );
  }
  if (typeof candidate.derivedAt !== 'string' || Number.isNaN(Date.parse(candidate.derivedAt))) {
    fail(`derivedAt must be an ISO date string, got ${JSON.stringify(candidate.derivedAt)}`);
  }
}

/** Validates every field of a hot-window config: the fields every status shares (`status`,
 * `provisional`, `days`, `basis`, `decision`), plus (for a `derived` window) the fields 05-05
 * writes (`window.from`/`to`, `coverageTarget`, `achievedCoverage`, `articleRequestsCounted`,
 * `derivedAt`). Additional fields are passed through unchanged. */
export function parseHotWindow(raw: unknown): HotWindow {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    fail(`expected an object, got ${JSON.stringify(raw)}`);
  }
  const candidate = raw as Record<string, unknown>;

  if (
    typeof candidate.status !== 'string' ||
    !HOT_WINDOW_STATUSES.includes(candidate.status as HotWindowStatus)
  ) {
    fail(`unknown status: ${JSON.stringify(candidate.status)}`);
  }
  const status = candidate.status as HotWindowStatus;

  if (typeof candidate.provisional !== 'boolean') {
    fail(`provisional must be a boolean, got ${JSON.stringify(candidate.provisional)}`);
  }
  if (status === 'fallback-provisional' && candidate.provisional !== true) {
    fail('a fallback-provisional window must have provisional: true');
  }
  if (status === 'derived' && candidate.provisional !== false) {
    fail('a derived window must have provisional: false');
  }

  if (typeof candidate.days !== 'number' || !Number.isInteger(candidate.days) || candidate.days <= 0) {
    fail(`days must be a positive integer, got ${JSON.stringify(candidate.days)}`);
  }
  if (typeof candidate.basis !== 'string' || candidate.basis.length === 0) {
    fail(`basis must be a non-empty string, got ${JSON.stringify(candidate.basis)}`);
  }
  if (typeof candidate.decision !== 'string' || candidate.decision.length === 0) {
    fail(`decision must be a non-empty string, got ${JSON.stringify(candidate.decision)}`);
  }

  if (status === 'derived') {
    assertDerivedFields(candidate);
  }

  return candidate as HotWindow;
}

export const HOT_WINDOW_PATH = 'src/lib/archive/hot-window.json';

/** Reads and validates the hot-window config. Throws (never defaults) on a missing file,
 * malformed JSON, or a `parseHotWindow` rejection. */
export function loadHotWindow(path: string = HOT_WINDOW_PATH): HotWindow {
  const absPath = resolve(process.cwd(), path);
  let raw: string;
  try {
    raw = readFileSync(absPath, 'utf8');
  } catch (err) {
    fail(`could not read ${path}: ${err instanceof Error ? err.message : String(err)}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    fail(`${path} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }
  return parseHotWindow(parsed);
}

/** One human-readable log line, always starting with `[archive] hot window:` (later plans grep
 * for this prefix) and containing `PROVISIONAL` whenever `hw.provisional` is true (D-07). */
export function describeHotWindow(hw: HotWindow): string {
  if (hw.provisional) {
    const reason = typeof hw.reason === 'string' ? hw.reason : hw.basis;
    return `[archive] hot window: PROVISIONAL fallback — age-based cutoff, newest ${hw.days} days static (${hw.decision}: ${reason})`;
  }
  const window = hw.window as { from?: unknown; to?: unknown } | undefined;
  const from = typeof window?.from === 'string' ? window.from : '?';
  const to = typeof window?.to === 'string' ? window.to : '?';
  const coverage =
    typeof hw.achievedCoverage === 'number' ? `${Math.round(hw.achievedCoverage * 100)}% coverage` : '';
  return `[archive] hot window: derived from ${from} to ${to}, ${hw.days} days${coverage ? `, ${coverage}` : ''} (${hw.decision})`;
}
