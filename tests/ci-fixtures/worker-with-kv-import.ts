// D-06 / T-04-26 fixture: deliberate violation. Simulates the Worker entrypoint
// (`src/worker.ts`, mapped via FIXTURE_ID_MAP below) transitively importing the render-manifest
// KV module through a helper, never directly — proves the module-graph walk rejects a Worker
// entrypoint reaching the D1/KV chokepoint directory exactly the same way it already rejects a
// page or island doing so (Cases 1-2/5-6 above). Never a real file in `src/`; never reachable
// from `pnpm build`.
import { helperReachingKv } from './helper-reaching-kv';

export default {
  async fetch() {
    const entry = await helperReachingKv();
    return new Response(JSON.stringify(entry));
  },
};
