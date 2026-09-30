// D-06 / T-03-02a fixture: deliberate violation, reused by both new negative cases (KV
// page-shaped and KV island-shaped). Imports the real render-manifest KV module directly, so
// that anything importing THIS file reaches `src/lib/server/kv-manifest.ts` transitively rather
// than directly — the exact shape the module-graph walk (tools/assert-no-d1.mjs) must catch.
// This is the fixture that would have been silently ACCEPTED before the T-03-02a fix (when the
// guard forbade only the single filename `src/lib/server/d1-client.ts`, not the whole
// `src/lib/server/` directory) — see `Case 5`/`Case 6` below and 03-02-SUMMARY.md's inversion
// proof for T-03-02a. Never import this file from real application code; it is not reachable
// from `pnpm build` because it lives outside `src/`.
import { getManifestEntry } from '../../src/lib/server/kv-manifest';

export function helperReachingKv() {
  return getManifestEntry('00000000-0000-0000-0000-000000000000');
}
