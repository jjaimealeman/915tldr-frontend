#!/usr/bin/env node
// Fetches real, read-only D1 rows into design/fixtures/stress-set.json for use
// by the mockups. Every query is a constant defined in QUERIES below — no
// query is ever built from user input (the one exception, the tags lookup,
// interpolates only uuids that have already passed a strict regex check —
// see fetchTagsForUuids). See design/scripts/lib/d1-read.mjs for the
// read-only enforcement this script relies on.
//
// Usage:
//   node design/scripts/fetch-stress-set.mjs [--only=id1,id2]

import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { d1Query } from './lib/d1-read.mjs';

const WRANGLER_VERSION = '4.130.0';
const FIXTURE_PATH = path.resolve('design/fixtures/stress-set.json');
const CHANGELOG_SOURCE = path.resolve(
  '/home/jaime/www/_github/915tldr.com2/public/changelog.json'
);
const CHANGELOG_DEST = path.resolve('design/fixtures/changelog.json');

const MAX_ROWS_READ_PER_QUERY = 500000;
const UUID_RE = /^[0-9a-f-]{36}$/i;

// ---------------------------------------------------------------------------
// D-06 query constants. Every QUERIES value below is composed only from
// these three constants and SQL literals — no interpolation of any runtime
// value (T-01-13).
// ---------------------------------------------------------------------------

export const PUBLIC = `a.status = 'processed' AND (a.is_duplicate = 0 OR a.is_duplicate IS NULL)`;

export const ROW =
  `a.uuid, a.title, a.summary, a.image_url, a.url, a.published_at, a.status, ` +
  `a.is_duplicate, s.name AS source_name, c.slug AS category_slug, c.name AS category_name`;

// Word count of column x: count spaces in the trimmed value, plus one.
export function WC(col) {
  return `(length(trim(${col})) - length(replace(trim(${col}), ' ', '')) + 1)`;
}

const FROM_JOIN =
  `articles a JOIN sources s ON s.id = a.source_id ` +
  `LEFT JOIN article_categories ac ON ac.article_id = a.id AND ac.is_primary = 1 ` +
  `LEFT JOIN categories c ON c.id = ac.category_id`;

export const QUERIES = {
  // 01-02 tracer scope — unchanged.
  'tracer-pair': `SELECT a.uuid, a.title, a.summary, a.image_url, a.url, a.published_at, a.status, a.is_duplicate, s.name AS source_name, c.slug AS category_slug, c.name AS category_name FROM articles a JOIN sources s ON s.id = a.source_id JOIN article_categories ac ON ac.article_id = a.id AND ac.is_primary = 1 JOIN categories c ON c.id = ac.category_id WHERE a.status = 'processed' AND (a.is_duplicate = 0 OR a.is_duplicate IS NULL) ORDER BY a.published_at DESC LIMIT 2`,

  'longest-headline': `SELECT ${ROW} FROM ${FROM_JOIN} WHERE ${PUBLIC} ORDER BY length(a.title) DESC LIMIT 1`,
  'shortest-headline': `SELECT ${ROW} FROM ${FROM_JOIN} WHERE ${PUBLIC} AND length(trim(a.title)) > 0 ORDER BY length(a.title) ASC LIMIT 1`,
  'longest-summary': `SELECT ${ROW} FROM ${FROM_JOIN} WHERE ${PUBLIC} AND a.summary IS NOT NULL ORDER BY ${WC('a.summary')} DESC LIMIT 1`,
  'shortest-summary': `SELECT ${ROW} FROM ${FROM_JOIN} WHERE ${PUBLIC} AND a.summary IS NOT NULL AND trim(a.summary) <> '' ORDER BY ${WC('a.summary')} ASC LIMIT 1`,
  'no-summary': `SELECT ${ROW} FROM ${FROM_JOIN} WHERE ${PUBLIC} AND (a.summary IS NULL OR trim(a.summary) = '') ORDER BY a.published_at DESC LIMIT 1`,
  'five-tags': `SELECT ${ROW} FROM ${FROM_JOIN} WHERE ${PUBLIC} AND (SELECT count(*) FROM article_tags t WHERE t.article_id = a.id) = 5 AND a.summary IS NOT NULL ORDER BY a.published_at DESC LIMIT 1`,
  'max-tags': `SELECT ${ROW} FROM ${FROM_JOIN} WHERE ${PUBLIC} ORDER BY (SELECT count(*) FROM article_tags t WHERE t.article_id = a.id) DESC LIMIT 1`,
  'zero-tags': `SELECT ${ROW} FROM ${FROM_JOIN} WHERE ${PUBLIC} AND NOT EXISTS (SELECT 1 FROM article_tags t WHERE t.article_id = a.id) ORDER BY a.published_at DESC LIMIT 1`,
  'no-image': `SELECT ${ROW} FROM ${FROM_JOIN} WHERE ${PUBLIC} AND (a.image_url IS NULL OR a.image_url = '') ORDER BY a.published_at DESC LIMIT 1`,
  'junk-image': `SELECT ${ROW} FROM ${FROM_JOIN} WHERE ${PUBLIC} AND a.image_url LIKE '%s.w.org/%/emoji/%' ORDER BY a.published_at DESC LIMIT 1`,
  'usable-image': `SELECT ${ROW} FROM ${FROM_JOIN} WHERE ${PUBLIC} AND a.image_url LIKE 'https://%' AND a.image_url NOT LIKE '%s.w.org/%' ORDER BY a.published_at DESC LIMIT 5`,
  'spanish-headline': `SELECT ${ROW} FROM ${FROM_JOIN} WHERE ${PUBLIC} AND (a.title LIKE '% de la %' OR a.title LIKE '% del %' OR a.title LIKE '% para %' OR a.title LIKE '% los %' OR a.title LIKE '% las %') ORDER BY length(a.title) DESC LIMIT 10`,
  'uncategorized': `SELECT ${ROW} FROM ${FROM_JOIN} WHERE ${PUBLIC} AND NOT EXISTS (SELECT 1 FROM article_categories x WHERE x.article_id = a.id AND x.is_primary = 1) ORDER BY a.published_at DESC LIMIT 1`,
  'feed': `SELECT ${ROW} FROM ${FROM_JOIN} WHERE ${PUBLIC} AND c.slug IS NOT NULL ORDER BY a.published_at DESC LIMIT 24`,
  'category-lead': `SELECT ${ROW} FROM ${FROM_JOIN} WHERE ${PUBLIC} AND c.slug = 'business' AND a.image_url LIKE 'https://%' AND a.image_url NOT LIKE '%s.w.org/%' ORDER BY a.published_at DESC LIMIT 3`,
  'category-feed': `SELECT ${ROW} FROM ${FROM_JOIN} WHERE ${PUBLIC} AND c.slug = 'business' ORDER BY a.published_at DESC LIMIT 13`,

  categories: `SELECT c.slug, c.name, c.description, c.sort_order, (SELECT count(*) FROM article_categories ac JOIN articles a ON a.id = ac.article_id WHERE ac.category_id = c.id AND ac.is_primary = 1 AND ${PUBLIC}) AS story_count FROM categories c ORDER BY c.sort_order`,
  'corpus-stats': `SELECT count(*) AS n, avg(length(a.title)) AS avg_title_len, max(length(a.title)) AS max_title_len, avg(${WC('a.summary')}) AS avg_summary_words, min(${WC('a.summary')}) AS min_summary_words, max(${WC('a.summary')}) AS max_summary_words FROM articles a WHERE ${PUBLIC} AND a.summary IS NOT NULL`,
};

const SINGLE_ROW_CASES = [
  'longest-headline',
  'shortest-headline',
  'longest-summary',
  'shortest-summary',
  'no-summary',
  'five-tags',
  'max-tags',
  'zero-tags',
  'no-image',
  'junk-image',
  'uncategorized',
];

const ARRAY_CASES = ['feed', 'category-feed'];
const IMAGE_CANDIDATE_CASES = ['usable-image', 'category-lead'];

const CANONICAL_CATEGORY_SLUGS = [
  'crime',
  'politics',
  'sports',
  'business',
  'education',
  'community',
  'health',
  'weather',
];

// ---------------------------------------------------------------------------
// D-15 manual review of the spanish-headline candidates. Populated by the
// executor after reading the real query results (see main()'s guard below,
// which fails loudly rather than silently defaulting an unreviewed row to
// "not Spanish"). Keyed by uuid.
// ---------------------------------------------------------------------------
const SPANISH_HEADLINE_REVIEW = {
  'f63b5753-90b6-4a54-b78d-160461c08bf8': {
    confirmedSpanish: true,
    note: 'Fully Spanish headline (Ukraine/Russia oil-infrastructure story) — longest genuinely Spanish candidate in this set.',
  },
  '923a6674-6681-42ef-bde0-2825212d8b13': {
    confirmedSpanish: false,
    note: 'English headline. Matched "% de la %" only because "de la Espriella" is a Colombian surname, not Spanish prose.',
  },
  '63d76e51-b69e-4b64-b996-d8559004395f': {
    confirmedSpanish: true,
    note: 'Fully Spanish headline (New Zealand gang-patch ban story).',
  },
  'a1c5e6c9-6dd5-457d-b4b7-4fbe66102b48': {
    confirmedSpanish: false,
    note: 'English headline. "De La Espriella" is the same Colombian surname as the 923a6674 row, not Spanish prose.',
  },
  '442973c4-24ce-48a8-a469-bc47d182fb42': {
    confirmedSpanish: true,
    note: 'Fully Spanish headline (federal employee confidentiality proposal story).',
  },
  '6b85b2ef-e5dd-48f2-9e29-edadd0a79b5a': {
    confirmedSpanish: true,
    note: 'Fully Spanish headline (Florida airport renaming controversy story).',
  },
  '0309da28-3cc7-46d3-9149-3cf7bbff2578': {
    confirmedSpanish: true,
    note: 'Fully Spanish headline (birthright citizenship / Supreme Court story); source capitalized it in an odd title-case style, but every word is genuine Spanish.',
  },
  'a17db148-82b6-4c73-a8ad-8ff9abd995e8': {
    confirmedSpanish: false,
    note: 'English headline with an embedded Spanish concert title in quotes ("Unidos por los Nuestros") — the headline prose itself is English.',
  },
  '88ec8092-509e-4dd4-af70-3e1e9bc9dc22': {
    confirmedSpanish: true,
    note: 'Fully Spanish headline (Dept. of Education investigation into trans-women admissions story).',
  },
  'af6b2002-8d7d-4a35-937b-c8f49d8e4859': {
    confirmedSpanish: true,
    note: 'Fully Spanish headline (TSA agents economic hardship story).',
  },
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

function withDenverTime(row) {
  return { ...row, published_at: toDenverIso(row.published_at) };
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

/**
 * Fetches tags for every distinct, regex-validated uuid, in chunks of at
 * most 50 per query (T-01-13: the only interpolated values here are uuids
 * that have already been checked against UUID_RE). Returns a Map of
 * uuid -> [{ name, slug }].
 */
async function fetchTagsForUuids(uuids, queryLog) {
  for (const uuid of uuids) {
    if (!UUID_RE.test(uuid)) {
      console.error(`fetch-stress-set: refusing to build tags SQL — invalid uuid "${uuid}"`);
      process.exit(1);
    }
  }

  const unique = [...new Set(uuids)];
  const tagsByUuid = new Map();

  for (let i = 0; i < unique.length; i += 50) {
    const chunk = unique.slice(i, i + 50);
    const chunkId = `tags-chunk-${i / 50}`;
    const sql = `SELECT a.uuid, t.name, t.slug FROM article_tags at JOIN tags t ON t.id = at.tag_id JOIN articles a ON a.id = at.article_id WHERE a.uuid IN (${chunk.map((u) => `'${u}'`).join(',')})`;

    const { rows, rowsRead } = await d1Query(sql, { label: chunkId });
    if (rowsRead > MAX_ROWS_READ_PER_QUERY) {
      console.error(`fetch-stress-set: "${chunkId}" read ${rowsRead} rows, over the ${MAX_ROWS_READ_PER_QUERY} cap`);
      process.exit(1);
    }
    queryLog.set(chunkId, { id: chunkId, rowsRead, fetchedAt: new Date().toISOString() });

    for (const row of rows) {
      if (!tagsByUuid.has(row.uuid)) tagsByUuid.set(row.uuid, []);
      tagsByUuid.get(row.uuid).push({ name: row.name, slug: row.slug });
    }
  }

  return tagsByUuid;
}

function withTags(row, tagsByUuid) {
  return { ...row, tags: tagsByUuid.get(row.uuid) ?? [] };
}

/**
 * Sends one HEAD request per candidate row's image_url (15s timeout).
 * Returns { chosen, rejected } — chosen is the first row that answers 200
 * with an image/* content-type (or an { absent, reason } marker if none
 * do); rejected records every other candidate with its HEAD outcome.
 */
async function pickUsableImage(rows) {
  const rejected = [];
  for (const row of rows) {
    const url = row.image_url;
    let headStatus = null;
    let contentType = null;
    let ok = false;
    let reason = null;

    if (!url) {
      reason = 'no image_url on this candidate';
    } else {
      try {
        const res = await fetch(url, {
          method: 'HEAD',
          redirect: 'follow',
          signal: AbortSignal.timeout(15000),
        });
        headStatus = res.status;
        contentType = res.headers.get('content-type');
        ok = res.status === 200 && Boolean(contentType) && contentType.startsWith('image/');
        if (!ok) reason = `HEAD ${headStatus} content-type=${contentType ?? 'none'}`;
      } catch (err) {
        reason = `HEAD request failed: ${err?.message ?? err}`;
      }
    }

    if (ok) {
      return {
        chosen: { ...row, imageCheck: { headStatus, contentType } },
        rejected: [
          ...rejected,
          ...rows
            .filter((r) => r.uuid !== row.uuid)
            .map((r) => ({ uuid: r.uuid, url: r.image_url, headStatus: null, reason: 'not checked — chosen candidate found first' })),
        ],
      };
    }

    rejected.push({ uuid: row.uuid, url, headStatus, reason });
  }

  return { chosen: { absent: true, reason: 'no candidate image URL returned a usable image/* response' }, rejected };
}

async function copyChangelog(meta) {
  await mkdir(path.dirname(CHANGELOG_DEST), { recursive: true });
  await copyFile(CHANGELOG_SOURCE, CHANGELOG_DEST);

  const sourceBuf = await readFile(CHANGELOG_SOURCE);
  const sha256 = createHash('sha256').update(sourceBuf).digest('hex');
  const parsed = JSON.parse(sourceBuf.toString('utf8'));
  const entries = parsed.entries ?? [];

  if (entries.length !== 8) {
    console.error(`fetch-stress-set: expected 8 changelog entries, found ${entries.length}`);
    process.exit(1);
  }

  meta.changelog = { sourcePath: CHANGELOG_SOURCE, sha256, entries: entries.length };
}

async function main() {
  const only = parseOnlyArg(process.argv.slice(2));
  const caseIds = only ?? Object.keys(QUERIES);

  const fixture = await loadExistingFixture();
  fixture.cases ??= {};
  fixture._meta ??= { queries: [], rowsReadTotal: 0 };
  fixture._meta.queries ??= [];

  const queryLog = new Map(fixture._meta.queries.map((q) => [q.id, q]));
  const rawRows = {};

  for (const caseId of caseIds) {
    const sql = QUERIES[caseId];
    if (!sql) {
      console.error(`fetch-stress-set: unknown case id "${caseId}"`);
      process.exit(1);
    }

    const { rows, rowsRead } = await d1Query(sql, { label: caseId });

    if (rowsRead > MAX_ROWS_READ_PER_QUERY) {
      console.error(`fetch-stress-set: "${caseId}" read ${rowsRead} rows, over the ${MAX_ROWS_READ_PER_QUERY} cap`);
      process.exit(1);
    }

    if (caseId !== 'categories' && caseId !== 'corpus-stats') {
      assertProcessedNonDuplicate(rows, caseId);
    }

    rawRows[caseId] = rows;
    queryLog.set(caseId, { id: caseId, rowsRead, fetchedAt: new Date().toISOString() });
  }

  // Collect every uuid present in this run's fetched rows (categories and
  // corpus-stats carry no uuid column).
  const uuids = [];
  for (const [caseId, rows] of Object.entries(rawRows)) {
    if (caseId === 'categories' || caseId === 'corpus-stats') continue;
    for (const row of rows) {
      if (row.uuid) uuids.push(row.uuid);
    }
  }
  const tagsByUuid = uuids.length ? await fetchTagsForUuids(uuids, queryLog) : new Map();

  // Build each requested case into its final fixture shape.
  for (const caseId of caseIds) {
    const rows = rawRows[caseId];

    if (caseId === 'categories') {
      fixture.cases.categories = rows;
      const slugs = rows.map((r) => r.slug).join(',');
      const expected = CANONICAL_CATEGORY_SLUGS.join(',');
      if (slugs !== expected) {
        console.error(`fetch-stress-set: categories order mismatch — got "${slugs}", expected "${expected}"`);
        process.exit(1);
      }
      continue;
    }

    if (caseId === 'corpus-stats') {
      fixture.cases['corpus-stats'] = rows[0] ?? { absent: true, reason: 'no articles matched' };
      continue;
    }

    if (SINGLE_ROW_CASES.includes(caseId)) {
      fixture.cases[caseId] =
        rows.length === 0
          ? { absent: true, reason: 'no public row matches' }
          : withDenverTime(withTags(rows[0], tagsByUuid));
      continue;
    }

    if (ARRAY_CASES.includes(caseId)) {
      fixture.cases[caseId] = rows.map((r) => withDenverTime(withTags(r, tagsByUuid)));
      continue;
    }

    if (IMAGE_CANDIDATE_CASES.includes(caseId)) {
      const withTagsRows = rows.map((r) => withDenverTime(withTags(r, tagsByUuid)));
      const { chosen, rejected } = await pickUsableImage(withTagsRows);
      fixture.cases[caseId] = { chosen, rejected };
      continue;
    }

    if (caseId === 'spanish-headline') {
      const reviewed = rows.map((r) => {
        const row = withDenverTime(withTags(r, tagsByUuid));
        const review = SPANISH_HEADLINE_REVIEW[row.uuid];
        if (!review) {
          console.error(
            `fetch-stress-set: spanish-headline candidate ${row.uuid} ("${row.title}") has no manual review entry in SPANISH_HEADLINE_REVIEW — read it and add one before re-running`
          );
          process.exit(1);
        }
        return { ...row, confirmedSpanish: review.confirmedSpanish, note: review.note };
      });

      const confirmed = reviewed.filter((r) => r.confirmedSpanish);
      // reviewed is already ordered longest-title-first (query ORDER BY).
      const chosen =
        confirmed.length > 0
          ? confirmed[0]
          : { absent: true, reason: 'no candidate headline was confirmed genuinely Spanish-language' };

      fixture.cases['spanish-headline'] = { rows: reviewed, chosen };
      continue;
    }

    // tracer-pair (01-02 scope) — kept in its original shape.
    fixture.cases[caseId] = rows.map((r) => ({ ...r, published_at: toDenverIso(r.published_at) }));
  }

  fixture._meta.fetchedAt = new Date().toISOString();
  fixture._meta.wranglerVersion = WRANGLER_VERSION;
  fixture._meta.queries = Array.from(queryLog.values());
  fixture._meta.rowsReadTotal = fixture._meta.queries.reduce((sum, q) => sum + (q.rowsRead ?? 0), 0);

  await copyChangelog(fixture._meta);

  await mkdir(path.dirname(FIXTURE_PATH), { recursive: true });
  await writeFile(FIXTURE_PATH, JSON.stringify(fixture, null, 2) + '\n', 'utf8');

  console.log(`fetch-stress-set: wrote ${caseIds.length} case(s) to ${FIXTURE_PATH}`);
  console.log(`fetch-stress-set: rowsReadTotal = ${fixture._meta.rowsReadTotal}`);
}

// Guarded so a script importing QUERIES/PUBLIC/ROW/WC for inspection (e.g. to
// list spanish-headline candidates for manual review) doesn't trigger a full
// D1 fetch-and-write as an import side effect — same pattern as
// fetch-fonts.mjs (01-02).
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
