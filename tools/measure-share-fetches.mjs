#!/usr/bin/env node
// 07-05 (SOC-08 / D-20): who fetched the share cards, from Cloudflare zone analytics. Lists every
// request to the card URLs on a host in a time window: raw User-Agent, status, request count and
// bytes served. SAMPLED analytics: counts are what Cloudflare reports, not a byte-exact log, and
// nothing here is ever estimated. If a field the query needs is missing or access-denied on this
// plan, the tool fails and names it instead of guessing.
//
// Read-only: one GraphQL query shape, no mutation. host, paths and dates are validated and travel
// as GraphQL variables, never concatenated into the query text. The token is read from
// process.env by tools/lib/cf-graphql.mjs and every error passes through redact(). `.dev.vars`
// (R2 write keys) is never read.
//
//   node tools/measure-share-fetches.mjs --since 2026-10-08T12:00:00Z [--until ...] [--host dev.915tldr.com]
//        [--paths /og-image.png,/og-image-es.png] [--json]
import { statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { queryCloudflareGraphql, redact } from './lib/cf-graphql.mjs';
import { ZONE_TAG_915TLDR } from './derive-hot-window.mjs';

export const DEFAULT_HOST = 'dev.915tldr.com';
export const DEFAULT_PATHS = Object.freeze(['/og-image.png', '/og-image-es.png']);
const REPO_ROOT = path.resolve(import.meta.dirname, '..');

/** GraphQL type names, confirmed by live introspection on 2026-10-08 (07-05). */
export const SHARE_SCHEMA_TYPES = Object.freeze({
  group: 'ZoneHttpRequestsAdaptiveGroups',
  sum: 'ZoneHttpRequestsAdaptiveGroupsSum',
  dimensions: 'ZoneHttpRequestsAdaptiveGroupsDimensions',
  filter: 'ZoneHttpRequestsAdaptiveGroupsFilter_InputObject',
});

const REQUIRED_FIELDS = Object.freeze([
  [SHARE_SCHEMA_TYPES.group, 'count'],
  [SHARE_SCHEMA_TYPES.sum, 'edgeResponseBytes'],
  [SHARE_SCHEMA_TYPES.dimensions, 'clientRequestPath'],
  [SHARE_SCHEMA_TYPES.dimensions, 'userAgent'],
  [SHARE_SCHEMA_TYPES.dimensions, 'edgeResponseStatus'],
  [SHARE_SCHEMA_TYPES.filter, 'datetime_geq'],
  [SHARE_SCHEMA_TYPES.filter, 'datetime_lt'],
  [SHARE_SCHEMA_TYPES.filter, 'clientRequestHTTPHost'],
  [SHARE_SCHEMA_TYPES.filter, 'clientRequestPath_in'],
]);

const QUERY = `query($zoneTag: String!, $filter: ZoneHttpRequestsAdaptiveGroupsFilter_InputObject, $limit: Int!) {
  viewer {
    zones(filter: { zoneTag: $zoneTag }) {
      httpRequestsAdaptiveGroups(limit: $limit, filter: $filter) {
        count
        sum { edgeResponseBytes }
        dimensions { clientRequestPath userAgent edgeResponseStatus }
      }
    }
  }
}`;

function parseInstant(name, value) {
  if (value === undefined || value === null || value === '') throw new Error(`measure-share-fetches: ${name} is required`);
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error(`measure-share-fetches: ${name} is not a parsable ISO date: ${JSON.stringify(value)}`);
  return d;
}

/**
 * Builds the analytics query. `since` is required; `until` defaults to `now`. Throws on a bad
 * host, path or date. Returns `{ query, variables }` with every input in variables.
 */
export function buildShareFetchQuery({ host = DEFAULT_HOST, paths = DEFAULT_PATHS, since, until, now = new Date(), zoneTag = ZONE_TAG_915TLDR, limit = 1000 } = {}) {
  if (since === undefined || since === null || since === '') throw new Error('measure-share-fetches: since is required');
  const from = parseInstant('since', since);
  const to = until === undefined || until === null || until === '' ? parseInstant('until', now) : parseInstant('until', until);
  if (!(from.getTime() < to.getTime())) throw new Error('measure-share-fetches: since must be before until');
  if (typeof host !== 'string' || !/^[a-z0-9.-]+$/.test(host)) throw new Error(`measure-share-fetches: host must match /^[a-z0-9.-]+$/, got ${JSON.stringify(host)}`);
  if (!Array.isArray(paths) || paths.length === 0) throw new Error('measure-share-fetches: at least one path is required');
  for (const p of paths) {
    if (typeof p !== 'string' || !p.startsWith('/')) throw new Error(`measure-share-fetches: every path must start with "/", got ${JSON.stringify(p)}`);
  }
  return {
    query: QUERY,
    variables: {
      zoneTag,
      limit,
      filter: {
        datetime_geq: from.toISOString(),
        datetime_lt: to.toISOString(),
        clientRequestHTTPHost: host,
        clientRequestPath_in: [...paths],
      },
    },
  };
}

/**
 * One row per (path, userAgent, status): `{ path, userAgent, status, count, totalBytes,
 * bytesPerRequest, fileBytes }`, sorted by path then count descending. `fileBytes` is the size of
 * the file on disk when `fileSizes` knows the path, else null. Nothing is estimated.
 */
export function summariseShareFetches(groups, fileSizes = {}) {
  const rows = (groups ?? []).map((g) => {
    const count = Number(g.count ?? 0);
    const totalBytes = Number(g.sum?.edgeResponseBytes ?? 0);
    const p = g.dimensions?.clientRequestPath;
    return {
      path: p,
      userAgent: g.dimensions?.userAgent ?? '',
      status: g.dimensions?.edgeResponseStatus,
      count,
      totalBytes,
      bytesPerRequest: count > 0 ? totalBytes / count : 0,
      fileBytes: Object.prototype.hasOwnProperty.call(fileSizes, p) ? fileSizes[p] : null,
    };
  });
  rows.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : b.count - a.count));
  return rows;
}

/**
 * Confirms every field the query needs exists. `introspect(typeName)` resolves to the field names
 * of a type; rejects with an error naming the first missing field.
 */
export async function verifyShareFetchSchema(introspect) {
  for (const [type, field] of REQUIRED_FIELDS) {
    const fields = await introspect(type);
    if (!Array.isArray(fields) || !fields.includes(field)) {
      throw new Error(`measure-share-fetches: live schema is missing "${field}" on ${type}`);
    }
  }
}

/** Live introspection for output and input types (cf-graphql's introspectType reads only `fields`). */
export function liveIntrospect(opts = {}) {
  return async (name) => {
    const data = await queryCloudflareGraphql(
      { query: 'query($name: String!) { __type(name: $name) { fields { name } inputFields { name } } }', variables: { name } },
      opts
    );
    const t = data?.__type;
    if (!t) throw new Error(`measure-share-fetches: live schema has no type named "${name}"`);
    return [...(t.fields ?? []), ...(t.inputFields ?? [])].map((f) => f.name);
  };
}

/** Runs the built query; returns the raw `httpRequestsAdaptiveGroups` array. */
export async function fetchShareGroups({ query, variables }, opts = {}) {
  const data = await queryCloudflareGraphql({ query, variables }, opts);
  return data?.viewer?.zones?.[0]?.httpRequestsAdaptiveGroups ?? [];
}

function parseArgs(argv) {
  const args = { host: DEFAULT_HOST, paths: [...DEFAULT_PATHS], json: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') { args.json = true; continue; }
    const eqAt = arg.indexOf('=');
    const [flag, inline] = eqAt === -1 ? [arg, undefined] : [arg.slice(0, eqAt), arg.slice(eqAt + 1)];
    const value = () => inline ?? argv[++i];
    if (flag === '--host') args.host = value();
    else if (flag === '--since') args.since = value();
    else if (flag === '--until') args.until = value();
    else if (flag === '--paths') args.paths = String(value()).split(',').map((s) => s.trim()).filter(Boolean);
    else throw new Error(`measure-share-fetches: unknown argument ${arg}`);
  }
  return args;
}

function cardFileSizes(paths) {
  const sizes = {};
  for (const p of paths) {
    try {
      sizes[p] = statSync(path.join(REPO_ROOT, 'public', p)).size;
    } catch {
      // not a file under public/: leave unknown
    }
  }
  return sizes;
}

async function main() {
  const env = process.env;
  try {
    const args = parseArgs(process.argv.slice(2));
    const built = buildShareFetchQuery({ host: args.host, paths: args.paths, since: args.since, until: args.until });
    await verifyShareFetchSchema(liveIntrospect({ env }));
    const groups = await fetchShareGroups(built, { env });
    const rows = summariseShareFetches(groups, cardFileSizes(args.paths));
    if (args.json) {
      console.log(JSON.stringify({ host: args.host, window: [built.variables.filter.datetime_geq, built.variables.filter.datetime_lt], sampled: true, rows }, null, 2));
    } else {
      console.log(`[measure-share] host ${args.host}, ${built.variables.filter.datetime_geq} to ${built.variables.filter.datetime_lt}`);
      console.log('[measure-share] sampled analytics: counts are what Cloudflare reports, not a byte-exact log');
      if (rows.length === 0) console.log('[measure-share] no requests to these paths in the window (zero rows reported by Cloudflare)');
      for (const r of rows) {
        console.log(`${r.path}\tstatus ${r.status}\t${r.count} req\t${Math.round(r.bytesPerRequest)} bytes/req\tfile ${r.fileBytes ?? 'n/a'} bytes\tUA ${JSON.stringify(r.userAgent)}`);
      }
    }
  } catch (err) {
    console.error(redact(err instanceof Error ? err.message : String(err), env));
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
