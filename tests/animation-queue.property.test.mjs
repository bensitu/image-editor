/**
 * Type:
 *   Property test
 *
 * Purpose:
 *   Verifies src/animation/animation-queue.ts in isolation. The queue must run
 *   asynchronous tasks in insertion order, avoid concurrent execution, and settle all
 *   promises when pending work is cleared during dispose.
 *
 * Scope:
 *   - Randomized task sequences assert FIFO start order and one-at-a-time execution.
 *   - clear(reason) rejects pending tasks while allowing the active task to settle.
 *   - clear() without a reason resolves pending tasks, matching the facade dispose
 *     path.
 *
 * Out of scope:
 *   - unrelated editor features
 *   - visual rendering quality
 *   - browser-specific integration details
 *
 * Environment:
 *   - Node.js ESM
 *   - fast-check generated cases where applicable
 *
 * Run:
 *   node --test tests/animation-queue.property.test.mjs
 *
 * Notes:
 *   - Prefer behavior-level assertions over implementation-detail checks.
 *   - Keep this file focused on animationQueue FIFO ordering and dispose-safe
 *     settlement only.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

import { AnimationQueue } from '../src/animation/animation-queue.ts';

// ─── Arbitraries ───────────────────────────────────────────────────────────

// Short, deterministic delays so the suite stays fast at ≥100 iterations.
// The documented stated range is 0–20 ms; we cap at 10 ms here so 100 runs
// of up to 8 tasks each finish within a few seconds on CI.
const delayArb = fc.integer({ min: 0, max: 10 });

// Each task either resolves or rejects after its delay. Both paths must
// settle the public promise.
const settleModeArb = fc.constantFrom('resolve', 'reject');

// One enqueued task is described by its delay and its settle mode.
const taskSpecArb = fc.record({
    delay: delayArb,
    mode: settleModeArb,
});

// 1–8 tasks per scenario keeps total runtime bounded while still
// exercising real FIFO depth.
const taskBatchArb = fc.array(taskSpecArb, { minLength: 1, maxLength: 8 });

// Clear() may fire never, immediately after the last add() call (i.e.
// while the head task is still running), or after a small delay
// (mid-queue). 'reason' is either undefined (resolve pending) or a
// string sentinel (reject pending).
const clearStrategyArb = fc.oneof(
    fc.record({ when: fc.constant('never'), reason: fc.constant(null) }),
    fc.record({
        when: fc.constantFrom('immediate', 'mid-queue'),
        reason: fc.option(fc.constantFrom('disposed', 'cancelled'), { nil: undefined }),
    }),
);

// ─── Helpers ───────────────────────────────────────────────────────────────

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Build an animation function that records a start timestamp on entry,
 * sleeps for `spec.delay` ms, records an end timestamp on exit, and
 * either resolves or throws based on `spec.mode`. The shared `tracker`
 * is used to verify FIFO ordering and the at-most-one-running invariant.
 */
function makeTrackedFn(id, spec, tracker) {
    return async () => {
        const startTick = ++tracker.tick;
        tracker.events.push({ kind: 'start', id, tick: startTick });
        tracker.concurrent += 1;
        if (tracker.concurrent > tracker.maxConcurrent) {
            tracker.maxConcurrent = tracker.concurrent;
        }
        try {
            await delay(spec.delay);
            if (spec.mode === 'reject') {
                const err = new Error(`task ${id} rejected`);
                err.__taskId = id;
                throw err;
            }
        } finally {
            tracker.concurrent -= 1;
            const endTick = ++tracker.tick;
            tracker.events.push({ kind: 'end', id, tick: endTick });
        }
    };
}

/**
 * Race a promise against a timeout to surface "hanging promise" bugs as
 * test failures rather than CI hangs. The queue is supposed to settle
 * every public promise, so if any promise stays pending past the
 * timeout we fail loudly.
 */
function withTimeout(promise, ms, label) {
    let timeoutHandle;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutHandle = setTimeout(() => {
            reject(new Error(`Timed out waiting for ${label}`));
        }, ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => {
        clearTimeout(timeoutHandle);
    });
}

/** Sum of all task delays, with a generous safety margin for clear/teardown. */
function settleBudgetMs(specs) {
    const total = specs.reduce((sum, s) => sum + s.delay, 0);
    return Math.max(250, total * 4 + 250);
}

// ─── Property assertions ───────────────────────────────────────────────────

test('FIFO order, at most one running, all promises settle', async () => {
    await fc.assert(
        fc.asyncProperty(taskBatchArb, clearStrategyArb, async (specs, clearStrategy) => {
            const queue = new AnimationQueue();
            const tracker = { tick: 0, concurrent: 0, maxConcurrent: 0, events: [] };

            // Pre-condition: a fresh queue is quiescent.
            assert.equal(queue.isRunning(), false, 'fresh queue must not be running');

            // Enqueue every task synchronously in one tick so the head
            // task starts immediately and the tail tasks queue behind it.
            const settled = [];
            const promises = specs.map((spec, i) => {
                const fn = makeTrackedFn(i, spec, tracker);
                const p = queue.add(fn).then(
                    () => settled.push({ id: i, status: 'fulfilled' }),
                    (err) => settled.push({ id: i, status: 'rejected', err }),
                );
                return p;
            });

            // Apply the clear strategy. 'immediate' fires synchronously
            // after the last add() — by then the head task is already
            // mid-await, so its public promise must still settle from
            // the function's natural resolution. 'mid-queue' lets a few
            // tasks settle naturally before draining the rest.
            if (clearStrategy.when === 'immediate') {
                queue.clear(clearStrategy.reason);
            } else if (clearStrategy.when === 'mid-queue') {
                // Sleep for roughly the head task's delay so we drain
                // while at least one task is still pending.
                await delay(Math.max(1, specs[0].delay));
                queue.clear(clearStrategy.reason);
            }

            // — every public promise must settle within a
            // bounded budget. A hanging promise here is a real bug.
            await withTimeout(
                Promise.all(promises),
                settleBudgetMs(specs),
                'all add() promises to settle',
            );

            // — at most one task ran concurrently at any
            // point. The tracker's `maxConcurrent` is 0 if no task ever
            // executed (clear='immediate' with reason that drained
            // everything before a task could start) or 1 otherwise.
            assert.ok(
                tracker.maxConcurrent <= 1,
                `AnimationQueue must run at most one task at a time; saw maxConcurrent=${tracker.maxConcurrent}`,
            );

            // — among the tasks that actually executed, the
            // start order is the enqueue order, and each task starts
            // strictly after the previous one ends. (Tasks drained by
            // clear() never produce events, so the executed prefix may
            // be shorter than `specs.length`.)
            const startEvents = tracker.events.filter((e) => e.kind === 'start');
            const endEvents = tracker.events.filter((e) => e.kind === 'end');
            assert.equal(
                startEvents.length,
                endEvents.length,
                `every started task must end (starts=${startEvents.length}, ends=${endEvents.length})`,
            );

            for (let i = 0; i < startEvents.length; i++) {
                assert.equal(
                    startEvents[i].id,
                    i,
                    `tasks must start in enqueue order; expected id=${i} but got id=${startEvents[i].id}`,
                );
                if (i > 0) {
                    assert.ok(
                        startEvents[i].tick > endEvents[i - 1].tick,
                        `task ${i} must start after task ${i - 1} ends (start tick=${startEvents[i].tick}, prev end tick=${endEvents[i - 1].tick})`,
                    );
                }
            }

            // Sanity: every public promise we registered is now in
            // `settled`. (Promise.all above already proved fulfilment
            // of the chained handlers, but assert the count explicitly.)
            assert.equal(
                settled.length,
                specs.length,
                `every add() promise must settle; settled=${settled.length}, expected=${specs.length}`,
            );

            // Once everything has settled, the queue must be quiescent
            // again. The recursive `drainQueue` empties the queue and
            // flips `running=false` on the next iteration.
            assert.equal(queue.isRunning(), false, 'queue must be idle once every task settles');
        }),
        { numRuns: 100 },
    );
});

test('clear(reason) rejects pending while head task still settles', async () => {
    await fc.assert(
        fc.asyncProperty(
            fc.array(delayArb, { minLength: 2, maxLength: 6 }),
            fc.constantFrom('disposed', 'cancelled', 'reset'),
            async (delays, reason) => {
                const queue = new AnimationQueue();

                // Head task uses a non-trivial delay so we have time to
                // call clear() while it is still mid-await; tail tasks
                // are pending behind it and must reject with `reason`.
                const headDelay = Math.max(2, delays[0]);
                const tailDelays = delays.slice(1);

                const outcomes = [];
                const headPromise = queue.add(async () => {
                    await delay(headDelay);
                });
                outcomes.push({ id: 0, kind: 'head', promise: headPromise });

                tailDelays.forEach((d, i) => {
                    const id = i + 1;
                    const p = queue.add(async () => {
                        // If clear() works, this body must NOT run for
                        // any tail task — pending entries are drained
                        // before they are shifted from the queue.
                        await delay(d);
                        throw new Error(
                            `tail task ${id} body executed despite clear(${JSON.stringify(reason)})`,
                        );
                    });
                    outcomes.push({ id, kind: 'tail', promise: p });
                });

                // Drain pending while head is still mid-await.
                queue.clear(reason);

                const results = await withTimeout(
                    Promise.allSettled(outcomes.map((o) => o.promise)),
                    settleBudgetMs(delays.map((d) => ({ delay: d, mode: 'resolve' }))),
                    'clear(reason) settlement',
                );

                // The head task started before clear(), so its public
                // promise must resolve from the function's natural
                // settlement (the queue does not interrupt running
                // entries; that is the documented contract).
                assert.equal(
                    results[0].status,
                    'fulfilled',
                    'head task must resolve naturally — clear() does not interrupt the running entry',
                );

                // Tail tasks were drained: their public promises must
                // reject with the supplied reason value.
                for (let i = 1; i < results.length; i++) {
                    assert.equal(
                        results[i].status,
                        'rejected',
                        `tail task ${i} must reject after clear(${JSON.stringify(reason)})`,
                    );
                    assert.equal(
                        results[i].reason,
                        reason,
                        `tail task ${i} must reject with the exact reason value`,
                    );
                }

                assert.equal(queue.isRunning(), false, 'queue must be idle after settlement');
            },
        ),
        { numRuns: 100 },
    );
});

test('clear() with no reason resolves pending entries', async () => {
    await fc.assert(
        fc.asyncProperty(fc.array(delayArb, { minLength: 2, maxLength: 6 }), async (delays) => {
            const queue = new AnimationQueue();

            const headDelay = Math.max(2, delays[0]);
            const tailDelays = delays.slice(1);

            const outcomes = [];
            outcomes.push({
                id: 0,
                kind: 'head',
                promise: queue.add(async () => {
                    await delay(headDelay);
                }),
            });

            tailDelays.forEach((d, i) => {
                const id = i + 1;
                outcomes.push({
                    id,
                    kind: 'tail',
                    promise: queue.add(async () => {
                        await delay(d);
                        throw new Error(`tail task ${id} body executed despite clear()`);
                    }),
                });
            });

            // No reason → pending entries resolve normally. The
            // dispose path uses this default because its own
            // disposed guards stop callbacks from touching the
            // canvas, so a soft drain is safe.
            queue.clear();

            const results = await withTimeout(
                Promise.allSettled(outcomes.map((o) => o.promise)),
                settleBudgetMs(delays.map((d) => ({ delay: d, mode: 'resolve' }))),
                'clear() (no reason) settlement',
            );

            for (const r of results) {
                assert.equal(
                    r.status,
                    'fulfilled',
                    `every entry must resolve when clear() is called without a reason; got ${r.status}`,
                );
            }

            assert.equal(queue.isRunning(), false, 'queue must be idle after settlement');
        }),
        { numRuns: 100 },
    );
});

test('waitForIdle() resolves only after every queued task has settled', async () => {
    await fc.assert(
        fc.asyncProperty(taskBatchArb, async (specs) => {
            const queue = new AnimationQueue();

            let settledCount = 0;
            const total = specs.length;

            specs.forEach((spec, i) => {
                queue
                    .add(
                        makeTrackedFn(i, spec, {
                            tick: 0,
                            concurrent: 0,
                            maxConcurrent: 0,
                            events: [],
                        }),
                    )
                    .then(
                        () => {
                            settledCount += 1;
                        },
                        () => {
                            settledCount += 1;
                        },
                    );
            });

            // waitForIdle() appends a no-op sentinel that inherits the
            // FIFO ordering, so it must not resolve until every prior
            // entry has settled. Once it resolves, every prior promise
            // must also have run its `then`/`catch` callback, i.e.
            // `settledCount === total`.
            await withTimeout(queue.waitForIdle(), settleBudgetMs(specs), 'waitForIdle()');

            // Drain the microtask queue once so the `then` callbacks
            // attached above can run before we check settledCount. The
            // sentinel resolves before the prior add()'s public
            // promise's chained `.then(...)` runs, but only by a
            // microtask — yielding once is enough.
            await Promise.resolve();
            await Promise.resolve();

            assert.equal(
                settledCount,
                total,
                `waitForIdle() must resolve only after every prior entry settles; settled=${settledCount}, expected=${total}`,
            );

            // After waitForIdle, the queue is quiescent.
            assert.equal(queue.isRunning(), false, 'queue must be idle after waitForIdle()');

            // Calling waitForIdle() on an idle queue returns an
            // already-resolved promise (fast path).
            await withTimeout(queue.waitForIdle(), 100, 'idle waitForIdle()');
        }),
        { numRuns: 100 },
    );
});

test('isRunning() is true during an awaited task and false when idle', async () => {
    await fc.assert(
        fc.asyncProperty(fc.integer({ min: 1, max: 5 }), delayArb, async (count, taskDelay) => {
            const queue = new AnimationQueue();

            // Fresh queue is idle.
            assert.equal(queue.isRunning(), false);

            const observations = [];
            const promises = [];
            for (let i = 0; i < count; i++) {
                promises.push(
                    queue.add(async () => {
                        // Inside an awaited task, isRunning() must
                        // always report true.
                        observations.push({
                            id: i,
                            isRunning: queue.isRunning(),
                        });
                        await delay(Math.max(1, taskDelay));
                    }),
                );
            }

            // Right after the synchronous add() calls, the head
            // task has already entered its body (the `drainQueue`
            // micro-runner runs synchronously up to its first
            // await), so the queue must report running.
            assert.equal(
                queue.isRunning(),
                true,
                'queue must report running synchronously after the first add()',
            );

            await withTimeout(
                Promise.all(promises),
                settleBudgetMs(new Array(count).fill({ delay: taskDelay, mode: 'resolve' })),
                'isRunning()-cycle settlement',
            );

            // Every observation taken from inside a task body must
            // see isRunning() === true.
            for (const obs of observations) {
                assert.equal(
                    obs.isRunning,
                    true,
                    `isRunning() must be true while task ${obs.id} is awaited`,
                );
            }

            // After the queue drains, isRunning() must flip back to
            // false on the next microtask tick.
            await Promise.resolve();
            assert.equal(
                queue.isRunning(),
                false,
                'isRunning() must be false once every task settles',
            );
        }),
        { numRuns: 100 },
    );
});
