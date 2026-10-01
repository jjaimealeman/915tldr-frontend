// 05-07 Task 1: pins run-pool's three behavior bullets.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runPool } from '../../tools/lib/run-pool.mjs';

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test('run-pool: never runs more than `concurrency` workers at once', async () => {
  let active = 0;
  let maxActive = 0;
  const items = Array.from({ length: 12 }, (_, i) => i);

  const { done, failed, notStarted } = await runPool(items, {
    concurrency: 3,
    worker: async (item) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await delay(5);
      active -= 1;
      return item * 2;
    },
  });

  assert.equal(maxActive <= 3, true, `maxActive was ${maxActive}, expected <= 3`);
  assert.equal(done.length, 12);
  assert.equal(failed.length, 0);
  assert.equal(notStarted.length, 0);
  assert.deepEqual(
    done.map((d) => d.result).sort((a, b) => a - b),
    items.map((i) => i * 2)
  );
});

test('run-pool: a worker that throws lands in `failed` with its error; the other items still complete', async () => {
  const items = ['a', 'b', 'c', 'd', 'e'];
  const { done, failed, notStarted } = await runPool(items, {
    concurrency: 2,
    worker: async (item) => {
      if (item === 'c') throw new Error('boom on c');
      return `ok-${item}`;
    },
  });

  assert.equal(done.length, 4);
  assert.equal(failed.length, 1);
  assert.equal(notStarted.length, 0);
  assert.equal(failed[0].item, 'c');
  assert.equal(failed[0].error.message, 'boom on c');
  assert.deepEqual(
    done.map((d) => d.item).sort(),
    ['a', 'b', 'd', 'e']
  );
});

test('run-pool: a worker rejecting (not throwing synchronously) also lands in failed, never crashes the pool', async () => {
  const items = [1, 2, 3];
  const { done, failed } = await runPool(items, {
    concurrency: 3,
    worker: async (item) => {
      if (item === 2) return Promise.reject(new Error('rejected'));
      return item;
    },
  });
  assert.equal(done.length, 2);
  assert.equal(failed.length, 1);
  assert.equal(failed[0].item, 2);
});

test('run-pool: once now() >= deadlineAt, no new item starts; already-started items finish; untouched items land in notStarted', async () => {
  const items = Array.from({ length: 6 }, (_, i) => i);
  // A real wall-clock deadline that both concurrency=2 workers start BEFORE (so both items 0/1
  // are claimed and in flight) but that has elapsed by the time either worker's own delay
  // finishes — the pool must then refuse to claim items 2-5, while items 0/1 still run to
  // completion rather than being aborted mid-flight.
  const deadlineAt = Date.now() + 15;

  const { done, failed, notStarted } = await runPool(items, {
    concurrency: 2,
    deadlineAt,
    worker: async (item) => {
      await delay(30);
      return item;
    },
  });

  assert.equal(done.length + failed.length, 2, 'exactly the 2 in-flight items finished');
  assert.equal(notStarted.length, 4, 'the remaining 4 items never started');
  assert.deepEqual(
    notStarted.map((n) => n.index),
    [2, 3, 4, 5]
  );
});

test('run-pool: a deadline already past at call time starts nothing — every item lands in notStarted', async () => {
  const items = ['x', 'y', 'z'];
  let calls = 0;
  const { done, failed, notStarted } = await runPool(items, {
    concurrency: 5,
    deadlineAt: 0,
    now: () => 1,
    worker: async (item) => {
      calls += 1;
      return item;
    },
  });
  assert.equal(calls, 0);
  assert.equal(done.length, 0);
  assert.equal(failed.length, 0);
  assert.equal(notStarted.length, 3);
});

test('run-pool: an empty items array returns all-empty results without calling worker', async () => {
  let calls = 0;
  const { done, failed, notStarted } = await runPool([], {
    concurrency: 4,
    worker: async () => {
      calls += 1;
    },
  });
  assert.equal(calls, 0);
  assert.deepEqual(done, []);
  assert.deepEqual(failed, []);
  assert.deepEqual(notStarted, []);
});

test('run-pool: no deadline given (default Infinity) runs every item to completion', async () => {
  const items = [1, 2, 3, 4];
  const { done, notStarted } = await runPool(items, {
    concurrency: 2,
    worker: async (item) => item,
  });
  assert.equal(done.length, 4);
  assert.equal(notStarted.length, 0);
});

test('run-pool: rejects on an invalid concurrency or a missing worker, not a silent no-op', async () => {
  await assert.rejects(
    runPool([1], { concurrency: 0, worker: async () => {} }),
    /run-pool: invalid concurrency/
  );
  await assert.rejects(
    runPool([1], { concurrency: -1, worker: async () => {} }),
    /run-pool: invalid concurrency/
  );
  await assert.rejects(runPool([1], { concurrency: 1 }), /run-pool: opts\.worker must be a function/);
});
