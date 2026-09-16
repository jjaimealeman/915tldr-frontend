// Read-only D1 access for design-phase scripts (01-02).
//
// Threat model T-01-04 / T-01-05 (see 01-02-PLAN.md): the write-capable
// CLOUDFLARE_API_TOKEN reaches this process, so every statement is checked
// before wrangler is ever spawned, and error text is scrubbed of anything
// that looks like a credential before it is printed.

import { spawnSync } from 'node:child_process';

const WRITE_KEYWORDS = [
  'INSERT',
  'UPDATE',
  'DELETE',
  'DROP',
  'ALTER',
  'CREATE',
  'REPLACE',
  'ATTACH',
  'PRAGMA',
  'VACUUM',
];

const D1_CONFIG = 'design/scripts/d1.wrangler.jsonc';
const D1_DATABASE = '915tldr-db';
const WRANGLER_VERSION = '4.130.0';

/**
 * Redacts any run of 32+ characters from [A-Za-z0-9_-] in a string. Tokens,
 * account IDs and other credential-shaped values never reach printed output.
 */
function redact(text) {
  return String(text).replace(/[A-Za-z0-9_-]{32,}/g, '[redacted]');
}

/**
 * Throws if `sql` is not a single, read-only SELECT/WITH statement. This is
 * the sole gate between this process and a write-capable account token —
 * nothing below this function may run for a statement that fails here.
 */
function assertReadOnly(sql) {
  const trimmed = sql.trim();

  if (!/^(SELECT|WITH)\b/i.test(trimmed)) {
    throw new Error('d1Query: refused — statement must start with SELECT or WITH');
  }

  // Allow at most one optional trailing semicolon; any other semicolon means
  // more than one statement is present.
  const withoutTrailingSemicolon = trimmed.endsWith(';') ? trimmed.slice(0, -1) : trimmed;
  if (withoutTrailingSemicolon.includes(';')) {
    throw new Error('d1Query: refused — only a single statement is permitted');
  }

  for (const keyword of WRITE_KEYWORDS) {
    const wordBoundary = new RegExp(`\\b${keyword}\\b`, 'i');
    if (wordBoundary.test(trimmed)) {
      throw new Error(`d1Query: refused — statement contains write keyword "${keyword}"`);
    }
  }
}

/**
 * Runs a single read-only SQL statement against the production 915tldr-db
 * database via `wrangler d1 execute --remote --json`, using the read-only
 * config at design/scripts/d1.wrangler.jsonc.
 *
 * Refuses (without spawning anything) any statement that is not a single
 * SELECT/WITH statement. Returns `{ rows, rowsRead }`. Throws on wrangler
 * failure or a `success: false` response, with all error text scrubbed of
 * long token-like runs.
 */
export async function d1Query(sql, { label } = {}) {
  assertReadOnly(sql);

  const result = spawnSync(
    'npx',
    [
      '--yes',
      `wrangler@${WRANGLER_VERSION}`,
      'd1',
      'execute',
      D1_DATABASE,
      '--remote',
      '--json',
      '--config',
      D1_CONFIG,
      '--command',
      sql,
    ],
    { encoding: 'utf8' }
  );

  if (result.error) {
    throw new Error(`d1Query(${label ?? 'unlabeled'}): spawn failed — ${redact(result.error.message)}`);
  }

  if (result.status !== 0) {
    const stderr = redact(result.stderr ?? '');
    throw new Error(`d1Query(${label ?? 'unlabeled'}): wrangler exited ${result.status} — ${stderr}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch (err) {
    throw new Error(
      `d1Query(${label ?? 'unlabeled'}): could not parse wrangler JSON output — ${redact(err.message)}`
    );
  }

  const first = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!first || typeof first !== 'object' || !('results' in first) || !('success' in first)) {
    throw new Error(`d1Query(${label ?? 'unlabeled'}): unexpected wrangler JSON shape`);
  }

  if (first.success === false) {
    throw new Error(`d1Query(${label ?? 'unlabeled'}): query failed — ${redact(JSON.stringify(first))}`);
  }

  return {
    rows: first.results,
    rowsRead: first.meta?.rows_read ?? 0,
  };
}
