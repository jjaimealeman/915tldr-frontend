#!/usr/bin/env node
// Fetches real, read-only D1 rows into design/fixtures/stress-set.json for use
// by the mockups. Every query is a constant defined in QUERIES below — no
// query is ever built from user input. See design/scripts/lib/d1-read.mjs for
// the read-only enforcement this script relies on.
//
// Usage:
//   node design/scripts/fetch-stress-set.mjs [--only=id1,id2]

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { d1Query } from './lib/d1-read.mjs';

const WRANGLER_VERSION = '4.130.0';
const FIXTURE_PATH = path.resolve('design/fixtures/stress-set.json');

// Case id -> constant SQL string. This phase (01-02, tracer scope) defines
// only `tracer-pair`; later plans (01-06 onward) add the full D-06 stress
// cases under the same shape.
export const QUERIES = {
  'tracer-pair': `SELECT a.uuid, a.title, a.summary, a.image_url, a.url, a.published_at, a.status, a.is_duplicate, s.name AS source_name, c.slug AS category_slug, c.name AS category_name FROM articles a JOIN sources s ON s.id = a.source_id JOIN article_categories ac ON ac.article_id = a.id AND ac.is_primary = 1 JOIN categories c ON c.id = ac.category_id WHERE a.status = 'processed' AND (a.is_duplicate = 0 OR a.is_duplicate IS NULL) ORDER BY a.published_at DESC LIMIT 2`,
};

function parseOnlyArg(argv) {
  const arg = argv.find((a) => a.startsWith('--only='));
  if (!arg) return null;
  return arg
    .slice('--only='.length)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Converts a unix-seconds timestamp to an ISO string carrying the
 * America/Denver offset (not UTC) so downstream copy reads in local time.
 */
function toDenverIso(unixSeconds) {
  const date = new Date(unixSeconds * 1000);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Denver',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'shortOffset',
  }).formatToParts(date);

  const get = (type) => parts.find((p) => p.type === type)?.value;
  const offsetRaw = get('timeZoneName') ?? 'GMT+0';
  const offsetMatch = offsetRaw.match(/GMT([+-]\d+)(?::?(\d+))?/);
  let offset = '+00:00';
  if (offsetMatch) {
    const sign = offsetMatch[1].startsWith('-') ? '-' : '+';
    const hours = String(Math.abs(Number(offsetMatch[1]))).padStart(2, '0');
    const minutes = String(offsetMatch[2] ?? '0').padStart(2, '0');
    offset = `${sign}${hours}:${minutes}`;
  }

  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}${offset}`;
}

function assertProcessedNonDuplicate(rows, caseId) {
  for (const row of rows) {
    if (row.status !== 'processed' || row.is_duplicate) {
      console.error(
        `fetch-stress-set: case "${caseId}" returned a row that is not processed/non-duplicate (uuid=${row.uuid}, status=${row.status}, is_duplicate=${row.is_duplicate})`
      );
      process.exit(1);
    }
  }
}

async function loadExistingFixture() {
  try {
    const raw = await readFile(FIXTURE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { cases: {}, _meta: { queries: [], rowsReadTotal: 0 } };
  }
}

async function main() {
  const only = parseOnlyArg(process.argv.slice(2));
  const caseIds = only ?? Object.keys(QUERIES);

  const fixture = await loadExistingFixture();
  fixture.cases ??= {};
  fixture._meta ??= { queries: [], rowsReadTotal: 0 };
  fixture._meta.queries ??= [];

  const queryLog = new Map(fixture._meta.queries.map((q) => [q.id, q]));
  let rowsReadTotal = 0;

  for (const caseId of caseIds) {
    const sql = QUERIES[caseId];
    if (!sql) {
      console.error(`fetch-stress-set: unknown case id "${caseId}"`);
      process.exit(1);
    }

    const { rows, rowsRead } = await d1Query(sql, { label: caseId });
    assertProcessedNonDuplicate(rows, caseId);

    const rowsWithLocalTime = rows.map((row) => ({
      ...row,
      published_at: toDenverIso(row.published_at),
    }));

    fixture.cases[caseId] = rowsWithLocalTime;

    const fetchedAt = new Date().toISOString();
    queryLog.set(caseId, { id: caseId, rowsRead, fetchedAt });
  }

  fixture._meta.fetchedAt = new Date().toISOString();
  fixture._meta.wranglerVersion = WRANGLER_VERSION;
  fixture._meta.queries = Array.from(queryLog.values());
  fixture._meta.rowsReadTotal = fixture._meta.queries.reduce((sum, q) => sum + (q.rowsRead ?? 0), 0);
  rowsReadTotal = fixture._meta.rowsReadTotal;

  await mkdir(path.dirname(FIXTURE_PATH), { recursive: true });
  await writeFile(FIXTURE_PATH, JSON.stringify(fixture, null, 2) + '\n', 'utf8');

  console.log(`fetch-stress-set: wrote ${caseIds.length} case(s) to ${FIXTURE_PATH}`);
  console.log(`fetch-stress-set: rowsReadTotal = ${rowsReadTotal}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
