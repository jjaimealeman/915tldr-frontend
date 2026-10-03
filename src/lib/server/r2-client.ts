// ARCH-02 / D-05 (05-02-PLAN.md): build-time R2 access over R2's S3-compatible API. Lives inside
// `src/lib/server/` — the same D1/KV chokepoint directory `d1-client.ts` and `kv-manifest.ts`
// already occupy — ON PURPOSE, so `tools/assert-no-d1.mjs`'s existing FORBIDDEN_TARGET_DIR walk
// keeps this module (and the write credential it holds) out of any Worker or page module graph
// without a separate guard having to be written. See `tests/ci-fixtures/assert-no-d1.test.mjs`'s
// T-05-08 case for the proof.
//
// Build-time only. Runs in Node during `astro build`/Workers Builds (05-07's archive sync), never
// inside the deployed Worker — the Worker's own R2 access is the READ-ONLY `ARCHIVE_BUCKET`
// binding in `wrangler.jsonc` (05-03), a completely separate, unprivileged code path from this
// module's write-capable S3 credential.
//
// Credential handling follows OPS-11 (the same convention `d1-client.ts`'s header documents):
// `R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`CLOUDFLARE_ACCOUNT_ID` are read from `process.env`
// only, never logged, never written to a file, and never embedded in a thrown error message —
// every catch block below builds its error text from the error's `name`/`Code`/
// `$metadata.httpStatusCode` only, never `err.message` (which could echo request/credential
// detail back from the SDK or the R2 API).

import { createHash } from 'node:crypto';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { TAG_SLUG_RE } from '../article-url.ts';

/** Hardcoded, like `d1-client.ts`'s own `D1_DATABASE_ID` — the archive tier uses exactly one
 * bucket; a second one would be a new decision, not a config value to parameterise. */
export const ARCHIVE_BUCKET_NAME = '915tldr-archive';

/** The three env vars `hasR2Credentials`/`createArchiveStore` need. `CLOUDFLARE_ACCOUNT_ID` is
 * shared with `d1-client.ts`; the two R2-specific keys are this module's own. */
export const R2_CREDENTIAL_ENV_KEYS = ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'] as const;

type EnvLike = Record<string, string | undefined>;

/** True only when every credential this module needs is present and non-empty — never partial.
 * `env` defaults to `process.env`; the explicit parameter is the same test seam `d1-client.ts`'s
 * `fetchImpl` pattern uses, applied to env lookups instead of network calls. */
export function hasR2Credentials(env: EnvLike = process.env): boolean {
  return (
    Boolean(env.CLOUDFLARE_ACCOUNT_ID) &&
    R2_CREDENTIAL_ENV_KEYS.every((key) => Boolean(env[key]))
  );
}

function requireEnv(name: string, env: EnvLike): string {
  const value = env[name];
  if (!value) {
    throw new Error(`r2-client: ${name} is not set in the environment`);
  }
  return value;
}

// Archive key scheme (05-02-PLAN.md must_haves): exactly four shapes, nothing else. The
// character classes below exclude `/` and `.` entirely, so a traversal attempt
// (`articles/../x.html`), a stray leading slash (`/tags/a.html`), or trailing garbage
// (`tags/a.html/../../b`) all fail the anchored match rather than needing a separate
// traversal-specific check.
const ARCHIVE_ARTICLE_KEY_RE =
  /^articles\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.html$/;
// Matches TAG_SLUG_RE's own character class (`src/lib/article-url.ts`) — lowercase a-z0-9- only,
// so an uppercase or underscore tag slug (a tampered/legacy value) is rejected the same way
// TAG_SLUG_RE itself would reject it when building a static tag page filename.
const ARCHIVE_TAG_KEY_RE = /^tags\/[a-z0-9-]+\.html$/;
const ARCHIVE_META_KEY_RE = /^_meta\/[a-z0-9-]+\.json$/;
const ARCHIVE_PROBE_KEY_RE = /^_probe\/[a-z0-9-]+\.txt$/;

const ARCHIVE_PREFIXES = ['articles/', 'tags/', '_meta/', '_probe/'] as const;

/** Throws `r2-client: invalid archive key ...` for anything outside the four allowed key shapes.
 * Every method below calls this FIRST, before any request is built — a rejected key must never
 * reach `client.send()`. Returns the key unchanged so a call site can write
 * `const key = assertArchiveKey(input);`. */
export function assertArchiveKey(key: unknown): string {
  if (
    typeof key !== 'string' ||
    !(
      ARCHIVE_ARTICLE_KEY_RE.test(key) ||
      ARCHIVE_TAG_KEY_RE.test(key) ||
      ARCHIVE_META_KEY_RE.test(key) ||
      ARCHIVE_PROBE_KEY_RE.test(key)
    )
  ) {
    throw new Error(`r2-client: invalid archive key ${JSON.stringify(key)}`);
  }
  return key;
}

function assertArchivePrefix(prefix: unknown): string {
  if (typeof prefix !== 'string' || !(ARCHIVE_PREFIXES as readonly string[]).includes(prefix)) {
    throw new Error(`r2-client: invalid archive key prefix ${JSON.stringify(prefix)}`);
  }
  return prefix;
}

/** Builds error text from the error's `name`/`Code`/`$metadata.httpStatusCode` only — never
 * `err.message`, which could otherwise echo request/header/credential detail from the AWS SDK or
 * the R2 API straight back into a thrown error (and from there into a log line). */
function describeError(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { name?: unknown; Code?: unknown; code?: unknown; $metadata?: { httpStatusCode?: unknown } };
    return String(e.name ?? e.Code ?? e.code ?? e.$metadata?.httpStatusCode ?? 'UnknownError');
  }
  return 'UnknownError';
}

/** The AWS SDK v3 throws a `NotFound` error (name `NotFound`, sometimes `NoSuchKey`, always a 404
 * `$metadata.httpStatusCode`) for a HeadObject/GetObject miss — distinguished from every other
 * failure so `headObject`/`getText` can return `null` instead of throwing. */
function isNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: unknown; Code?: unknown; $metadata?: { httpStatusCode?: unknown } };
  return e.name === 'NotFound' || e.name === 'NoSuchKey' || e.Code === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404;
}

/** Minimal shape every `createArchiveStore` client — real `S3Client` or an injected test fake —
 * must satisfy. Matches `d1-client.ts`'s `fetchImpl` seam convention: the production path builds
 * the real client, tests inject a fake with the same call surface. */
export interface R2SendableClient {
  send(command: unknown): Promise<unknown>;
}

export interface HeadObjectResult {
  sha256: string | null;
  size: number | null;
  etag: string | null;
}

/** Partial-result contract (WR-02, 05-18): `deleteObjects` never throws mid-loop once past its
 * up-front key validation. Each 1,000-key batch is attempted independently — a batch that the SDK
 * call itself rejects (not an R2-reported per-key error, a thrown `send()`) reports EVERY key in
 * that batch in `errors` (code from `describeError`, never `err.message`) and the loop continues
 * to the next batch; `deleted` accumulates only the counts confirmed by batches that didn't throw.
 * Callers must drop an index entry ONLY for a key that is absent from `errors` — a key that
 * errored (for either reason: an R2-reported per-key error, or its whole batch rejecting) must
 * keep its index entry, since whether it's actually gone from R2 is unknown. */
export interface DeleteObjectsResult {
  deleted: number;
  errors: Array<{ key: string; code: string }>;
}

export interface ArchiveStore {
  putObject(key: string, body: string | Uint8Array, opts: { contentType: string; sha256: string }): Promise<void>;
  headObject(key: string): Promise<HeadObjectResult | null>;
  getText(key: string): Promise<string | null>;
  getJson<T = unknown>(key: string): Promise<T | null>;
  putJson(key: string, value: unknown): Promise<void>;
  deleteObjects(keys: string[]): Promise<DeleteObjectsResult>;
  listKeys(prefix: string): Promise<string[]>;
}

/** Builds the real `S3Client` (region `auto`, the account's `r2.cloudflarestorage.com` endpoint,
 * the two R2 credentials) unless `opts.client` is supplied — the test seam, any object with an
 * async `send(command)`. `opts.env` defaults to `process.env`, read only at call time, never
 * cached across calls. */
export function createArchiveStore(
  opts: { env?: EnvLike; client?: R2SendableClient } = {}
): ArchiveStore {
  const env = opts.env ?? process.env;
  const client: R2SendableClient =
    opts.client ??
    new S3Client({
      region: 'auto',
      endpoint: `https://${requireEnv('CLOUDFLARE_ACCOUNT_ID', env)}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: requireEnv('R2_ACCESS_KEY_ID', env),
        secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY', env),
      },
    });

  async function putObject(
    key: string,
    body: string | Uint8Array,
    putOpts: { contentType: string; sha256: string }
  ): Promise<void> {
    assertArchiveKey(key);
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: ARCHIVE_BUCKET_NAME,
          Key: key,
          Body: body,
          ContentType: putOpts.contentType,
          Metadata: { sha256: putOpts.sha256 },
        })
      );
    } catch (err) {
      throw new Error(`r2-client: put ${key} failed: ${describeError(err)}`);
    }
  }

  async function headObject(key: string): Promise<HeadObjectResult | null> {
    assertArchiveKey(key);
    try {
      const res = (await client.send(
        new HeadObjectCommand({ Bucket: ARCHIVE_BUCKET_NAME, Key: key })
      )) as { Metadata?: Record<string, string>; ContentLength?: number; ETag?: string };
      return {
        sha256: res.Metadata?.sha256 ?? null,
        size: typeof res.ContentLength === 'number' ? res.ContentLength : null,
        etag: res.ETag ?? null,
      };
    } catch (err) {
      if (isNotFoundError(err)) return null;
      throw new Error(`r2-client: head ${key} failed: ${describeError(err)}`);
    }
  }

  async function getText(key: string): Promise<string | null> {
    assertArchiveKey(key);
    try {
      const res = (await client.send(
        new GetObjectCommand({ Bucket: ARCHIVE_BUCKET_NAME, Key: key })
      )) as { Body: { transformToString(): Promise<string> } };
      return await res.Body.transformToString();
    } catch (err) {
      if (isNotFoundError(err)) return null;
      throw new Error(`r2-client: get ${key} failed: ${describeError(err)}`);
    }
  }

  async function getJson<T = unknown>(key: string): Promise<T | null> {
    const text = await getText(key);
    if (text === null) return null;
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`r2-client: get ${key} failed: response body is not valid JSON`);
    }
  }

  async function putJson(key: string, value: unknown): Promise<void> {
    const body = JSON.stringify(value);
    const sha256 = createHash('sha256').update(body).digest('hex');
    await putObject(key, body, { contentType: 'application/json', sha256 });
  }

  async function deleteObjects(keys: string[]): Promise<DeleteObjectsResult> {
    keys.forEach((key) => assertArchiveKey(key));
    let deleted = 0;
    const errors: Array<{ key: string; code: string }> = [];
    for (let i = 0; i < keys.length; i += 1000) {
      const batch = keys.slice(i, i + 1000);
      try {
        const res = (await client.send(
          new DeleteObjectsCommand({
            Bucket: ARCHIVE_BUCKET_NAME,
            Delete: { Objects: batch.map((key) => ({ Key: key })) },
          })
        )) as {
          Deleted?: Array<{ Key?: string }>;
          Errors?: Array<{ Key?: string; Code?: string }>;
        };
        deleted += (res.Deleted ?? []).length;
        for (const e of res.Errors ?? []) {
          errors.push({ key: e.Key ?? '', code: e.Code ?? 'UnknownError' });
        }
      } catch (err) {
        // WR-02 (05-18): a rejecting batch must not throw away the deleted-count already confirmed
        // by earlier batches, nor leave the caller unable to tell which keys are unaccounted for —
        // report every key of THIS batch as an error and keep going.
        const code = describeError(err);
        for (const key of batch) errors.push({ key, code });
      }
    }
    return { deleted, errors };
  }

  async function listKeys(prefix: string): Promise<string[]> {
    assertArchivePrefix(prefix);
    const keys: string[] = [];
    let continuationToken: string | undefined;
    do {
      try {
        const res = (await client.send(
          new ListObjectsV2Command({
            Bucket: ARCHIVE_BUCKET_NAME,
            Prefix: prefix,
            ContinuationToken: continuationToken,
          })
        )) as {
          Contents?: Array<{ Key?: string }>;
          IsTruncated?: boolean;
          NextContinuationToken?: string;
        };
        for (const obj of res.Contents ?? []) {
          if (obj.Key) keys.push(obj.Key);
        }
        continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
      } catch (err) {
        throw new Error(`r2-client: list ${prefix} failed: ${describeError(err)}`);
      }
    } while (continuationToken);
    return keys;
  }

  return { putObject, headObject, getText, getJson, putJson, deleteObjects, listKeys };
}
