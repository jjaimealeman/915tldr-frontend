// D-06 / T-05-08 fixture: deliberate violation. Simulates the Worker entrypoint (`src/worker.ts`,
// mapped via FIXTURE_ID_MAP below) transitively importing the build-time R2 write client through
// a helper, never directly — proves the module-graph walk rejects a Worker entrypoint reaching
// r2-client.ts exactly the same way it already rejects one reaching kv-manifest.ts (Case 7).
// Never a real file in `src/`; never reachable from `pnpm build`.
import { helperReachingR2 } from './helper-reaching-r2';

export default {
  async fetch() {
    const ok = helperReachingR2();
    return new Response(JSON.stringify({ ok }));
  },
};
