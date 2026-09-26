// D-06 fixture: deliberate violation, reused by both negative cases (ARCH-02 page-shaped and
// ARCH-03 island-shaped). Imports the real D1 chokepoint module directly, so that anything
// importing THIS file reaches D1 transitively rather than directly — the exact shape the
// module-graph walk (tools/assert-no-d1.mjs) must catch that a grep for "d1-client" on the
// entrypoint file alone would miss. Never import this file from real application code; it is
// not reachable from `pnpm build` because it lives outside `src/`.
import { fetchLatestArticle } from '../../src/lib/server/d1-client';

export function helperReachingD1() {
  return fetchLatestArticle();
}
