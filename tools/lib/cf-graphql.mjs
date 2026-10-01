// 05-04: the shared Cloudflare GraphQL Analytics client every Phase 5 measurement tool queries
// live Cloudflare analytics through (`tools/load-test-zero-reads.mjs`,
// `tools/measure-worker-kv-cpu.mjs`). Mirrors two existing conventions in this repo rather than
// inventing a third: `tools/ci-build.mjs`'s `redact()`/`SECRET_ENV_KEYS`/`TOKEN_LIKE_RE` shape for
// never leaking a credential into an error message, and `src/lib/server/d1-client.ts`'s
// `requireEnv()` shape for reading credentials only from `process.env`, never logging them, never
// writing them to a file.
//
// `fetchImpl`/`env` are injectable on every exported function (this project's own established
// seam — see `tools/ci-build.mjs`'s header comment) so unit tests never perform a real network
// call.

export const CF_GRAPHQL_ENDPOINT = 'https://api.cloudflare.com/client/v4/graphql';

const SECRET_ENV_KEYS = ['CLOUDFLARE_API_TOKEN', 'NTFY_TOKEN'];

/** Any 40+ character run of token-shaped characters is redacted too, even with no matching env
 * var — catches a token echoed back by the API under a shape this list doesn't know about. */
const TOKEN_LIKE_RE = /[A-Za-z0-9_-]{40,}/g;

/** T-05-16: strips every secret value this project knows the name of, then sweeps any remaining
 * 40+ character token-shaped run — the exact two-pass order `tools/ci-build.mjs`'s own `redact()`
 * uses, so this project has one redaction convention, not two slightly different ones. */
export function redact(text, env = {}) {
  let out = String(text ?? '');
  for (const key of SECRET_ENV_KEYS) {
    const value = env?.[key];
    if (value) {
      out = out.split(value).join('[REDACTED]');
    }
  }
  return out.replace(TOKEN_LIKE_RE, '[REDACTED]');
}

function requireEnv(env, name) {
  const value = env[name];
  if (!value) {
    throw new Error(`cf-graphql: ${name} is not set in the environment`);
  }
  return value;
}

/**
 * Runs one GraphQL query against Cloudflare's Analytics API and returns `data`. Throws on a
 * transport failure, a non-2xx HTTP response, an unparsable body, or a GraphQL `errors` array —
 * every thrown message is prefixed `cf-graphql:` (this project's own `<module>: <message>` throw
 * convention, see `tools/ci-build.mjs`'s `CHECK_PATTERNS` comment) and passed through `redact()`
 * before it ever reaches a caller, a log line, or a test assertion.
 */
export async function queryCloudflareGraphql({ query, variables = {} }, opts = {}) {
  const { fetchImpl = fetch, env = process.env } = opts;
  const token = requireEnv(env, 'CLOUDFLARE_API_TOKEN');

  let response;
  try {
    response = await fetchImpl(CF_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });
  } catch (err) {
    throw new Error(redact(`cf-graphql: ${err instanceof Error ? err.message : String(err)}`, env));
  }

  let body;
  try {
    body = await response.json();
  } catch (err) {
    throw new Error(
      redact(`cf-graphql: failed to parse response JSON: ${err instanceof Error ? err.message : String(err)}`, env)
    );
  }

  if (body?.errors && Array.isArray(body.errors) && body.errors.length > 0) {
    const firstMessage = body.errors[0]?.message ?? 'unknown GraphQL error';
    throw new Error(redact(`cf-graphql: ${firstMessage}`, env));
  }

  if (!response.ok) {
    throw new Error(redact(`cf-graphql: HTTP ${response.status}`, env));
  }

  return body?.data;
}

/**
 * Returns the field names of the GraphQL type named `name`, via a live `__type` introspection
 * query. Every query this project's Phase 5 tools build confirms the dataset's real field names
 * this way FIRST, rather than guessing a shape that may have changed since 05-RESEARCH.md was
 * written (T-05-17's sibling concern: a measurement tool must query the real schema, not an
 * assumed one).
 */
export async function introspectType(name, opts = {}) {
  const data = await queryCloudflareGraphql(
    {
      query: `query($name: String!) { __type(name: $name) { fields { name } } }`,
      variables: { name },
    },
    opts
  );
  const fields = data?.__type?.fields;
  if (!Array.isArray(fields)) {
    throw new Error(`cf-graphql: introspectType found no type named "${name}" — has the schema changed?`);
  }
  return fields.map((f) => f.name);
}
