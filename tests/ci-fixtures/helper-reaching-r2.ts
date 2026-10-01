// D-06 / T-05-08 fixture: deliberate violation, mirrors `helper-reaching-kv.ts`'s own shape.
// Imports the real build-time R2 client directly, so that anything importing THIS file reaches
// `src/lib/server/r2-client.ts` transitively rather than directly — the exact shape the
// module-graph walk (tools/assert-no-d1.mjs) must catch, proving the directory-wide guard covers
// a module it was never specifically written for (r2-client.ts postdates the guard). Never
// import this file from real application code; it is not reachable from `pnpm build` because it
// lives outside `src/`.
import { hasR2Credentials } from '../../src/lib/server/r2-client';

export function helperReachingR2() {
  return hasR2Credentials();
}
