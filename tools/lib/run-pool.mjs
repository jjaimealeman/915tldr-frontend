// 05-07 Task 1: a bounded-concurrency, deadline-aware task pool with per-item error isolation.
// Not `p-limit` (05-RESEARCH.md's own supporting-library suggestion) — `p-limit` has no deadline
// concept at all, and archive-sync's two upload phases must stop launching NEW work at a fixed
// wall-clock deadline (D-10/REND-12: pre 840s, post 1020s, both measured from the build's own
// start) while letting already-started work finish. That single requirement is why this is a
// small hand-rolled pool, not a dependency — see 05-RESEARCH.md's "Don't Hand-Roll" table, which
// flags concurrency-limiting as a `p-limit` job specifically for the case where no deadline is
// involved; this one is.
//
// Every thrown message (programmer-error input validation only — a worker's own rejection never
// throws out of runPool, it lands in `failed`) is prefixed `run-pool:`.

function fail(message) {
  throw new Error(`run-pool: ${message}`);
}

/**
 * @template T, R
 * @param {readonly T[]} items
 * @param {{
 *   concurrency: number,
 *   deadlineAt?: number,
 *   now?: () => number,
 *   worker: (item: T, index: number) => Promise<R>,
 * }} opts
 * @returns {Promise<{
 *   done: Array<{ item: T, index: number, result: R }>,
 *   failed: Array<{ item: T, index: number, error: unknown }>,
 *   notStarted: Array<{ item: T, index: number }>,
 * }>}
 *
 * Never runs more than `concurrency` workers concurrently. A worker that throws (or rejects)
 * lands its item in `failed` with the error — it never stops the pool or the other workers.
 * Once `now() >= deadlineAt`, no NEW item starts; any item already in flight is allowed to
 * finish (success or failure); every item that never got a chance to start lands in
 * `notStarted`, in original array order. `deadlineAt` defaults to `Infinity` (no deadline).
 */
export async function runPool(items, opts = {}) {
  const { concurrency, deadlineAt = Infinity, now = () => Date.now(), worker } = opts;

  if (typeof worker !== 'function') fail('opts.worker must be a function');
  if (typeof concurrency !== 'number' || !Number.isInteger(concurrency) || concurrency <= 0) {
    fail(`invalid concurrency: ${JSON.stringify(concurrency)}`);
  }

  const done = [];
  const failed = [];
  const n = items.length;
  let nextIndex = 0;

  // Single-threaded JS: reading/incrementing `nextIndex` here has no `await` between the read
  // and the increment, so two "concurrent" worker loops can never claim the same index — no lock
  // needed. This is also what makes `notStarted` exactly "everything from nextIndex onward" once
  // every loop has stopped claiming new work: items are always claimed in increasing index order.
  async function workerLoop() {
    while (true) {
      if (now() >= deadlineAt) return;
      if (nextIndex >= n) return;
      const index = nextIndex;
      nextIndex += 1;
      const item = items[index];
      try {
        const result = await worker(item, index);
        done.push({ item, index, result });
      } catch (error) {
        failed.push({ item, index, error });
      }
    }
  }

  const poolSize = Math.max(1, Math.min(concurrency, n || 1));
  const loops = [];
  for (let i = 0; i < poolSize; i += 1) {
    loops.push(workerLoop());
  }
  await Promise.all(loops);

  const notStarted = [];
  for (let index = nextIndex; index < n; index += 1) {
    notStarted.push({ item: items[index], index });
  }

  return { done, failed, notStarted };
}
