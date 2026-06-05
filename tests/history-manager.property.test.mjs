/**
 * Type:
 *   Property test
 *
 * Purpose:
 *   Verifies src/history/history-manager.ts command stack behavior for execute, push,
 *   undo, redo, overflow trimming, and asynchronous processing locks. The suite uses
 *   generated command sequences to stress pointer transitions.
 *
 * Scope:
 *   - execute and push keep currentIndex monotonic and trim redo branches.
 *   - undo and redo move the pointer by one successful awaited command.
 *   - Overlapping processing calls are ignored, and failures release the lock without
 *     moving the pointer.
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
 *   node --test tests/history-manager.property.test.mjs
 *
 * Notes:
 *   - Prefer behavior-level assertions over implementation-detail checks.
 *   - Keep this file focused on history pointer monotonicity and processing lock
 *     only.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

import { HistoryManager, Command } from '../src/history/history-manager.ts';

// ─── Helpers ───────────────────────────────────────────────────────────────

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Build a Command whose execute/undo bodies tag a shared `tracker` with
 * the operation kind and command id, and optionally sleep for a small
 * delay or reject. The tracker lets the property assertions verify that
 * only the expected bodies actually ran.
 */
function makeTrackedCommand(id, tracker, opts = {}) {
    const { executeDelay = 0, undoDelay = 0, executeRejects = false, undoRejects = false } = opts;
    return new Command(
        async () => {
            await delay(executeDelay);
            tracker.executes.push(id);
            if (executeRejects) {
                throw new Error(`execute ${id} rejected`);
            }
        },
        async () => {
            await delay(undoDelay);
            tracker.undos.push(id);
            if (undoRejects) {
                throw new Error(`undo ${id} rejected`);
            }
        },
    );
}

function freshTracker() {
    return { executes: [], undos: [] };
}

/**
 * Race `promise` against a timeout so a hanging promise surfaces as a
 * test failure instead of a CI hang.
 */
function withTimeout(promise, ms, label) {
    let handle;
    const timeoutPromise = new Promise((_, reject) => {
        handle = setTimeout(() => {
            reject(new Error(`Timed out waiting for ${label}`));
        }, ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => {
        clearTimeout(handle);
    });
}

// ─── Arbitraries ───────────────────────────────────────────────────────────

const maxSizeArb = fc.integer({ min: 1, max: 10 });

const pushKindArb = fc.constantFrom('execute', 'push');

// A single synchronous push step: which API to use to add the command.
const syncStepArb = fc.record({
    kind: pushKindArb,
});

// Sequence of synchronous pushes; length intentionally allowed to exceed
// any reasonable maxSize so we always hit the overflow path on some
// runs.
const syncStepsArb = fc.array(syncStepArb, { minLength: 0, maxLength: 25 });

// Async op model: each step is one awaited undo() or redo() call.
// `noop`-mode steps invoke the API even when canUndo/canRedo says no, to
// confirm the no-op behaviour holds.
const asyncOpArb = fc.constantFrom('undo', 'redo');
const asyncStepsArb = fc.array(asyncOpArb, { minLength: 0, maxLength: 12 });

// Small delays keep total runtime bounded at numRuns=100.
const smallDelayArb = fc.integer({ min: 0, max: 5 });

// ─── Properties ────────────────────────────────────────────────────────────

test('synchronous execute/push monotonicity and overflow window', async () => {
    await fc.assert(
        fc.asyncProperty(maxSizeArb, syncStepsArb, async (maxSize, steps) => {
            const hm = new HistoryManager(maxSize);
            const tracker = freshTracker();

            // Pre-conditions on a fresh manager.
            assert.equal(hm.history.length, 0, 'fresh manager has empty history');
            assert.equal(hm.currentIndex, -1, 'fresh manager has currentIndex = -1');
            assert.equal(hm.canUndo(), false, 'fresh manager cannot undo');
            assert.equal(hm.canRedo(), false, 'fresh manager cannot redo');

            // Reference model: every push appends; the oldest entries are
            // dropped once the model exceeds maxSize.
            const expectedIds = [];

            for (let i = 0; i < steps.length; i++) {
                const cmd = makeTrackedCommand(i, tracker);
                if (steps[i].kind === 'execute') {
                    hm.execute(cmd);
                } else {
                    hm.push(cmd);
                }

                expectedIds.push(i);
                while (expectedIds.length > maxSize) {
                    expectedIds.shift();
                }

                // Length follows the model exactly.
                assert.equal(
                    hm.history.length,
                    expectedIds.length,
                    `step ${i}: history.length must be min(callCount, maxSize)`,
                );

                // currentIndex always points at the last pushed entry
                // (no redo branch exists in this property).
                assert.equal(
                    hm.currentIndex,
                    hm.history.length - 1,
                    `step ${i}: currentIndex must equal history.length - 1`,
                );

                // canUndo / canRedo correctness on every step
                //.
                assert.equal(
                    hm.canUndo(),
                    hm.currentIndex >= 0,
                    `step ${i}: canUndo() must agree with currentIndex >= 0`,
                );
                assert.equal(
                    hm.canRedo(),
                    false,
                    `step ${i}: canRedo() must be false right after execute/push (no redo branch)`,
                );

                // Stack bounds invariant from the property statement.
                assert.ok(
                    hm.history.length <= maxSize,
                    `step ${i}: history.length must never exceed maxSize`,
                );
            }

            // Final layout: the kept window is the last `min(callCount, maxSize)`
            // commands in enqueue order.
            assert.equal(
                hm.history.length,
                expectedIds.length,
                'final history.length must match the model window',
            );

            // Drain pending timers so every fire-and-forget execute()
            // closure completes before we inspect the tracker. The
            // closures use `await delay(0)` which schedules through
            // setTimeout, so a small sleep is required.
            await delay(20);

            // The tracker's `executes` array (only `execute()` calls
            // run the closure) cross-checks that every execute fired
            // exactly once in enqueue order, and that push() never
            // invoked execute.
            const expectedExecutes = steps
                .map((s, i) => ({ kind: s.kind, id: i }))
                .filter((s) => s.kind === 'execute')
                .map((s) => s.id);
            assert.deepEqual(
                tracker.executes,
                expectedExecutes,
                'execute() must fire each command once in enqueue order; push() must not invoke execute',
            );
        }),
        { numRuns: 100 },
    );
});

test('async undo/redo move currentIndex by exactly ±1 per successful awaited call', async () => {
    await fc.assert(
        fc.asyncProperty(
            maxSizeArb,
            fc.integer({ min: 1, max: 10 }),
            asyncStepsArb,
            async (maxSize, prefillCount, asyncSteps) => {
                const hm = new HistoryManager(maxSize);
                const tracker = freshTracker();

                // Prefill with `prefillCount` push() calls so we are not
                // also exercising execute()'s fire-and-forget here.
                for (let i = 0; i < prefillCount; i++) {
                    hm.push(makeTrackedCommand(i, tracker));
                }

                const expectedLength = Math.min(prefillCount, maxSize);
                let modelIndex = expectedLength - 1;

                for (let s = 0; s < asyncSteps.length; s++) {
                    const op = asyncSteps[s];
                    const beforeIndex = hm.currentIndex;
                    const beforeCanUndo = hm.canUndo();
                    const beforeCanRedo = hm.canRedo();

                    assert.equal(
                        beforeIndex,
                        modelIndex,
                        `step ${s}: model and manager currentIndex must agree before ${op}()`,
                    );

                    if (op === 'undo') {
                        await withTimeout(hm.undo(), 250, `undo() at step ${s}`);
                        if (beforeCanUndo) {
                            modelIndex -= 1;
                        }
                    } else {
                        await withTimeout(hm.redo(), 250, `redo() at step ${s}`);
                        if (beforeCanRedo) {
                            modelIndex += 1;
                        }
                    }

                    // Pointer moved by at most 1 step in the documented
                    // direction.
                    const delta = hm.currentIndex - beforeIndex;
                    if (op === 'undo') {
                        assert.ok(
                            delta === -1 || delta === 0,
                            `step ${s}: undo() must move currentIndex by -1 or 0 (no-op); saw ${delta}`,
                        );
                    } else {
                        assert.ok(
                            delta === 1 || delta === 0,
                            `step ${s}: redo() must move currentIndex by +1 or 0 (no-op); saw ${delta}`,
                        );
                    }

                    // Manager and model stay in lockstep.
                    assert.equal(
                        hm.currentIndex,
                        modelIndex,
                        `step ${s}: currentIndex must track the model after ${op}()`,
                    );

                    // Bounds: -1 ≤ currentIndex ≤ history.length - 1.
                    assert.ok(
                        hm.currentIndex >= -1 && hm.currentIndex <= hm.history.length - 1,
                        `step ${s}: currentIndex out of bounds after ${op}() (${hm.currentIndex}/${hm.history.length})`,
                    );

                    // canUndo/canRedo correctness on every step.
                    assert.equal(
                        hm.canUndo(),
                        hm.currentIndex >= 0,
                        `step ${s}: canUndo() correctness after ${op}()`,
                    );
                    assert.equal(
                        hm.canRedo(),
                        hm.currentIndex < hm.history.length - 1,
                        `step ${s}: canRedo() correctness after ${op}()`,
                    );
                }

                // Length never changes via undo/redo.
                assert.equal(
                    hm.history.length,
                    expectedLength,
                    'undo/redo must not modify history length',
                );
            },
        ),
        { numRuns: 100 },
    );
});

test('isProcessing lock makes overlapping undo/redo calls no-ops', async () => {
    await fc.assert(
        fc.asyncProperty(
            fc.integer({ min: 2, max: 8 }),
            smallDelayArb,
            fc.constantFrom('undo+undo', 'undo+redo', 'redo+redo', 'redo+undo'),
            async (prefillCount, undoDelay, overlapKind) => {
                const hm = new HistoryManager(20);
                const tracker = freshTracker();

                // Prefill with slow-undo / slow-execute commands so the
                // overlap window is wide enough for the second call to
                // hit the lock deterministically. We use a non-zero
                // delay so the first awaited body cannot complete in
                // the same microtask.
                const wireDelay = Math.max(1, undoDelay);
                for (let i = 0; i < prefillCount; i++) {
                    hm.push(
                        makeTrackedCommand(i, tracker, {
                            executeDelay: wireDelay,
                            undoDelay: wireDelay,
                        }),
                    );
                }

                // For 'redo+*' overlaps we first undo once so canRedo is
                // true.
                if (overlapKind.startsWith('redo')) {
                    await hm.undo();
                }

                const beforeIndex = hm.currentIndex;
                const beforeLength = hm.history.length;

                // Launch the first call but do NOT await it yet — we
                // want a second call in flight while the first is still
                // mid-await inside the locked region.
                const firstOp = overlapKind.startsWith('undo') ? 'undo' : 'redo';
                const secondOp = overlapKind.endsWith('undo') ? 'undo' : 'redo';
                const firstPromise = hm[firstOp]();

                // Synchronously: the lock should already be held, so
                // the second call returns a promise that resolves
                // immediately as a no-op.
                const secondBeforeIndex = hm.currentIndex;
                const secondPromise = hm[secondOp]();

                // The second call must not have moved the pointer; the
                // lock makes it return without entering the try-block.
                assert.equal(
                    hm.currentIndex,
                    secondBeforeIndex,
                    `${overlapKind}: overlapping ${secondOp}() must not move currentIndex synchronously`,
                );

                // Both promises must settle (resolve, in this scenario;
                // we use commands that resolve cleanly).
                const results = await withTimeout(
                    Promise.allSettled([firstPromise, secondPromise]),
                    1000,
                    `overlapping ${overlapKind} settlement`,
                );

                assert.equal(
                    results[0].status,
                    'fulfilled',
                    `${overlapKind}: first ${firstOp}() must resolve; saw ${results[0].status}`,
                );
                assert.equal(
                    results[1].status,
                    'fulfilled',
                    `${overlapKind}: second ${secondOp}() (the no-op) must resolve; saw ${results[1].status}`,
                );

                // Net movement equals exactly the first call's intended
                // step (or 0 if the first call also had no work).
                const expectedDelta = firstOp === 'undo' ? -1 : 1;
                const actualDelta = hm.currentIndex - beforeIndex;
                assert.equal(
                    actualDelta,
                    expectedDelta,
                    `${overlapKind}: only the first call should have moved the pointer (expected ${expectedDelta}, got ${actualDelta})`,
                );

                // Length is unchanged.
                assert.equal(
                    hm.history.length,
                    beforeLength,
                    'history.length must be unchanged after undo/redo',
                );

                // Tracker confirms only one body actually ran for this
                // overlap (the second call exited before await).
                if (firstOp === 'undo') {
                    assert.equal(
                        tracker.undos.length,
                        1,
                        `${overlapKind}: exactly one undo body should have run`,
                    );
                } else {
                    // 'redo+*' case: tracker.executes already has one
                    // execute from the prefill `await hm.undo(); …` —
                    // wait, we didn't run any execute in prefill (push
                    // doesn't fire it). So executes count comes purely
                    // from the redo body.
                    assert.equal(
                        tracker.executes.length,
                        1,
                        `${overlapKind}: exactly one execute body should have run during redo`,
                    );
                }
            },
        ),
        { numRuns: 100 },
    );
});

test('failed undo()/redo() leaves currentIndex unchanged and releases the lock', async () => {
    await fc.assert(
        fc.asyncProperty(
            fc.integer({ min: 1, max: 8 }),
            fc.constantFrom('undo', 'redo'),
            async (prefillCount, failingOp) => {
                const hm = new HistoryManager(20);
                const tracker = freshTracker();

                // Build a stack where exactly one command fails on the
                // operation we're about to invoke.
                for (let i = 0; i < prefillCount; i++) {
                    const isFailingTarget = i === prefillCount - 1;
                    hm.push(
                        makeTrackedCommand(i, tracker, {
                            undoRejects: failingOp === 'undo' && isFailingTarget,
                            executeRejects: failingOp === 'redo' && isFailingTarget,
                        }),
                    );
                }

                // For redo we need a redo branch to exist.
                if (failingOp === 'redo') {
                    await hm.undo();
                }

                const beforeIndex = hm.currentIndex;
                const beforeLength = hm.history.length;
                const beforeCanUndo = hm.canUndo();
                const beforeCanRedo = hm.canRedo();

                // The failing call's promise must reject; the manager
                // must NOT move currentIndex.
                const result = await withTimeout(
                    hm[failingOp]().then(
                        () => ({ status: 'fulfilled' }),
                        (err) => ({ status: 'rejected', err }),
                    ),
                    500,
                    `${failingOp}() rejection`,
                );

                // The targeted call had work to do (canUndo/canRedo was
                // true) but its body threw, so the public promise must
                // reject.
                assert.equal(
                    result.status,
                    'rejected',
                    `${failingOp}() must reject when the command body throws`,
                );

                // Pointer is unchanged — the documented contract say
                // currentIndex only advances on successful awaited
                // operations.
                assert.equal(
                    hm.currentIndex,
                    beforeIndex,
                    `${failingOp}() rejection must leave currentIndex unchanged`,
                );
                assert.equal(
                    hm.history.length,
                    beforeLength,
                    `${failingOp}() rejection must leave history.length unchanged`,
                );
                assert.equal(
                    hm.canUndo(),
                    beforeCanUndo,
                    `${failingOp}() rejection must leave canUndo() unchanged`,
                );
                assert.equal(
                    hm.canRedo(),
                    beforeCanRedo,
                    `${failingOp}() rejection must leave canRedo() unchanged`,
                );

                // The lock must have been released by the `finally`
                // block — a follow-up call against a non-failing target
                // must be able to enter the locked region. We push a
                // new well-behaved command and try to redo it (after
                // first undoing if needed) to confirm the lock is free.
                hm.push(makeTrackedCommand(prefillCount, tracker));
                // The new push lands at index = beforeIndex + 1 (we
                // discarded the redo branch by pushing). Calling undo()
                // now should successfully move the pointer one step.
                const indexAfterPush = hm.currentIndex;
                await withTimeout(hm.undo(), 500, 'follow-up undo() after rejection');
                assert.equal(
                    hm.currentIndex,
                    indexAfterPush - 1,
                    'lock must be released after rejection so the next call can do work',
                );
            },
        ),
        { numRuns: 100 },
    );
});

test('overflow eviction keeps the last maxSize entries with currentIndex = maxSize - 1', async () => {
    await fc.assert(
        fc.asyncProperty(
            maxSizeArb,
            fc.integer({ min: 0, max: 30 }),
            async (maxSize, pushCount) => {
                const hm = new HistoryManager(maxSize);
                const tracker = freshTracker();

                for (let i = 0; i < pushCount; i++) {
                    hm.push(makeTrackedCommand(i, tracker));
                }

                if (pushCount === 0) {
                    assert.equal(hm.history.length, 0);
                    assert.equal(hm.currentIndex, -1);
                    return;
                }

                if (pushCount <= maxSize) {
                    // No eviction yet.
                    assert.equal(
                        hm.history.length,
                        pushCount,
                        'no eviction expected when pushCount <= maxSize',
                    );
                    assert.equal(
                        hm.currentIndex,
                        pushCount - 1,
                        'currentIndex must equal pushCount - 1 with no eviction',
                    );
                    return;
                }

                // Overflow case: we pushed more than maxSize entries.
                assert.equal(
                    hm.history.length,
                    maxSize,
                    'overflow: history.length must clamp to maxSize',
                );
                assert.equal(
                    hm.currentIndex,
                    maxSize - 1,
                    'overflow: currentIndex must equal maxSize - 1',
                );

                // Stack bounds: pointer is in range and points to the
                // most-recent entry.
                assert.ok(
                    hm.currentIndex >= 0 && hm.currentIndex < hm.history.length,
                    'overflow: currentIndex must remain in range',
                );

                // canUndo true, canRedo false — we never undo'd in this
                // property, so there is no redo branch.
                assert.equal(hm.canUndo(), true, 'overflow: canUndo must be true');
                assert.equal(hm.canRedo(), false, 'overflow: canRedo must be false');

                // Verify the oldest (pushCount - maxSize) commands are
                // gone by undoing all the way back: every undo body we
                // observe must correspond to one of the kept ids
                // (the last `maxSize` ids, in reverse order).
                const expectedKept = [];
                for (let i = pushCount - maxSize; i < pushCount; i++) {
                    expectedKept.push(i);
                }
                while (hm.canUndo()) {
                    await withTimeout(hm.undo(), 250, 'drain undo() in overflow');
                }
                assert.equal(hm.currentIndex, -1, 'after draining undo, currentIndex must be -1');

                // The recorded undo ids must equal the kept set in
                // reverse order — proving the evicted ids are gone.
                const expectedUndoOrder = [...expectedKept].reverse();
                assert.deepEqual(
                    tracker.undos,
                    expectedUndoOrder,
                    'overflow: only the last maxSize commands must remain in the stack',
                );
            },
        ),
        { numRuns: 100 },
    );
});
