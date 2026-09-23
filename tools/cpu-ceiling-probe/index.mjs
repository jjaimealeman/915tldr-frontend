// 03-06 Task 3 (D-01 measurement #3... this repo's third measurement of three, the render-step
// CPU ceiling): a deliberately CPU-bound Worker whose ONLY job is to be terminated, so the
// termination point can be observed and recorded — never deployed as a standing service.
//
// Burns CPU in a tight synchronous loop (no I/O, no await — the platform bills CPU time, not
// wall time, and an await that yields to I/O would let wall-clock run without burning CPU,
// understating how fast a real ceiling is reached). Logs elapsed self-reported CPU time at
// ~1-second intervals via console.log so `wrangler tail` can show the last successfully logged
// interval before termination, and cross-checks that self-reported figure against whatever
// Cloudflare's own platform-reported CPU time turns out to be for the same invocation (Part A
// of 03-06-PLAN.md Task 3 explicitly wants both, and wants any disagreement between them called
// out as a finding, not resolved by picking one).
//
// `scheduled()` is the trigger under test — Cron Trigger CPU ceiling, not the HTTP-request
// ceiling. `fetch()` exists ONLY as a manual-trigger convenience for iterating on this file
// during development; any measurement drawn from it is explicitly labelled "HTTP ceiling, not
// cron" in the report, never conflated with the scheduled-handler numbers.

const LOG_INTERVAL_MS = 1000;
// Safety cap on our OWN loop, independent of whatever the platform does — this worker must
// never spin longer than the outer ceiling under test even if our own termination detection is
// somehow wrong. 20 minutes comfortably exceeds the 15-minute wall-time ceiling the Workers
// platform documents for every Cron Trigger invocation regardless of interval, so the platform
// itself is expected to cut this off first in every real run.
const SAFETY_CAP_MS = 20 * 60 * 1000;

function burnCpu(label) {
  const start = performance.now();
  let lastLoggedInterval = 0;
  let iterations = 0;
  // Deliberately synchronous, deliberately wasteful (repeated string/array churn defeats
  // trivial JIT optimisation into a no-op loop) — this is the whole point of the probe.
  while (true) {
    iterations++;
    const junk = [];
    for (let i = 0; i < 1000; i++) junk.push(Math.sqrt(i) * Math.random());
    junk.sort((a, b) => a - b);

    const elapsed = performance.now() - start;
    const currentInterval = Math.floor(elapsed / LOG_INTERVAL_MS);
    if (currentInterval > lastLoggedInterval) {
      lastLoggedInterval = currentInterval;
      console.log(
        JSON.stringify({ probe: label, elapsedMs: Math.round(elapsed), iterations })
      );
    }

    if (elapsed >= SAFETY_CAP_MS) {
      console.log(
        JSON.stringify({ probe: label, elapsedMs: Math.round(elapsed), iterations, note: 'safety cap reached — platform did not terminate us first, which would itself be a finding' })
      );
      break;
    }
  }
  return performance.now() - start;
}

export default {
  async scheduled(controller, env, ctx) {
    console.log(JSON.stringify({ probe: 'scheduled-start', cron: controller.cron, scheduledTime: controller.scheduledTime }));
    const totalMs = burnCpu('scheduled');
    console.log(JSON.stringify({ probe: 'scheduled-end', totalMs: Math.round(totalMs) }));
  },

  // Manual-trigger convenience only — HTTP ceiling, not cron. See header comment.
  async fetch(request, env, ctx) {
    console.log(JSON.stringify({ probe: 'fetch-start' }));
    const totalMs = burnCpu('fetch');
    console.log(JSON.stringify({ probe: 'fetch-end', totalMs: Math.round(totalMs) }));
    return new Response(JSON.stringify({ totalMs: Math.round(totalMs) }), {
      headers: { 'content-type': 'application/json' },
    });
  },
};
