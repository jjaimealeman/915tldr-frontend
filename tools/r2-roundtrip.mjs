#!/usr/bin/env node
// 05-02-PLAN.md Task 3: a live round trip against the real, private `915tldr-archive` R2 bucket —
// put a probe object with sha256 metadata, head it (metadata matches), get it (bytes match),
// delete it, head it again (absent). Prints per-operation milliseconds; exits 1 on any mismatch.
//
// Dynamic import of `../src/lib/server/r2-client.ts`, mirroring `tools/ci-build.mjs`'s own
// dynamic import of `src/lib/server/build-state.ts` — this tool's only touchpoint with the D1/KV
// chokepoint directory, kept out of any eagerly-evaluated module graph.
//
// Run with credentials loaded into the environment first:
//   set -a; . ./.dev.vars; set +a; node tools/r2-roundtrip.mjs

import { createHash } from 'node:crypto';

async function main() {
  const { createArchiveStore, hasR2Credentials } = await import('../src/lib/server/r2-client.ts');

  if (!hasR2Credentials()) {
    console.error(
      'r2-roundtrip: missing one or more of CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, ' +
        'R2_SECRET_ACCESS_KEY in the environment. Load .dev.vars first: ' +
        "set -a; . ./.dev.vars; set +a; node tools/r2-roundtrip.mjs"
    );
    process.exitCode = 1;
    return;
  }

  const store = createArchiveStore();
  const key = `_probe/roundtrip-${Date.now()}.txt`;
  const body = `915tldr-archive round-trip probe written ${new Date().toISOString()}`;
  const sha256 = createHash('sha256').update(body).digest('hex');

  const timings = {};
  const timed = async (label, fn) => {
    const start = Date.now();
    const result = await fn();
    timings[label] = Date.now() - start;
    return result;
  };

  try {
    await timed('put', () => store.putObject(key, body, { contentType: 'text/plain', sha256 }));

    const head = await timed('head', () => store.headObject(key));
    if (!head) {
      throw new Error(`r2-roundtrip: head after put returned null for ${key}`);
    }
    if (head.sha256 !== sha256) {
      throw new Error(
        `r2-roundtrip: head sha256 mismatch for ${key} (expected ${sha256}, got ${head.sha256})`
      );
    }
    if (head.size !== Buffer.byteLength(body)) {
      throw new Error(
        `r2-roundtrip: head size mismatch for ${key} (expected ${Buffer.byteLength(body)}, got ${head.size})`
      );
    }

    const text = await timed('get', () => store.getText(key));
    if (text !== body) {
      throw new Error(`r2-roundtrip: get body mismatch for ${key}`);
    }

    await timed('delete', () => store.deleteObjects([key]));

    const headAfterDelete = await timed('head-after-delete', () => store.headObject(key));
    if (headAfterDelete !== null) {
      throw new Error(`r2-roundtrip: head after delete expected null for ${key}, got an object`);
    }

    console.log(`r2-roundtrip: round trip succeeded for ${key}`);
    console.log(`r2-roundtrip: timings (ms) — ${JSON.stringify(timings)}`);
  } catch (err) {
    console.error(`r2-roundtrip: FAILED — ${err instanceof Error ? err.message : String(err)}`);
    console.log(`r2-roundtrip: timings before failure (ms) — ${JSON.stringify(timings)}`);
    process.exitCode = 1;
  }
}

main();
