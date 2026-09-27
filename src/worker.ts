// D-08: this project's first Worker. Runs ONLY when the static asset layer misses (Workers
// Static Assets serves an asset hit directly, never invoking this — `run_worker_first` stays
// unset, see wrangler.jsonc). STUB (TDD RED phase) — real implementation lands in the GREEN
// commit.
export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  RENDER_MANIFEST: { get(key: string, type: 'json'): Promise<unknown> };
}

export default {
  async fetch(_request: Request, _env: Env): Promise<Response> {
    throw new Error('not implemented');
  },
};
