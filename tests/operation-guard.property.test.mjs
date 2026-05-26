// Property 13: Operation guards during animation
//
// Property statement (design.md §"Property 13"):
//   For any guarded operation invoked while `isAnimating === true`, the
//   editor SHALL leave the canvas, history stack, crop session, masks,
//   and export state unchanged unless the operation is `undo()` or
//   `redo()`, which are serialized through the animation queue instead
//   of rejected by the guard.
//
// This test focuses on the `OperationGuard` primitive that owns the
// `isAnimating` / `isDisposed` flags and the `assertNotAnimating()` gate.
// The full `ImageEditor` facade is built in later tasks; this test only
// covers the contract owned by `src/core/operation-guard.ts`:
//
//   1. After `runAnimation(fn)` settles (resolve OR reject), `isAnimating()`
//      is `false`. (Req 14.3)
//   2. Calling `assertNotAnimating(label)` *inside* a `runAnimation(...)`
//      block throws an `Error` whose message embeds the operation label.
//      (Req 14.1)
//   3. Calling `assertNotAnimating(label)` *outside* any animation block
//      does not throw, regardless of label content. (Req 14.2 — `undo` /
//      `redo` are queue-routed, but any caller that does invoke the gate
//      while quiescent must succeed.)
//   4. After `markDisposed()`, `isDisposed()` returns `true` and
//      `isAnimating()` returns `false` even when invoked mid-animation —
//      the dispose-safe settlement contract from the guard's docblock.
//   5. Multiple sequential `runAnimation` calls each correctly bracket
//      their flag transitions; the guard returns to a quiescent state
//      between calls.
//
// Owner module: `src/core/operation-guard.ts`.
//
// Runtime note: Node 24+ strips TypeScript syntax natively, so the test
// imports the module under test directly from source — no separate build
// step is required to run the property test in isolation.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

import { OperationGuard } from '../src/core/operation-guard.ts';

// ─── Arbitraries ───────────────────────────────────────────────────────────

// Operation labels mirror the public-method names enumerated in
// Requirement 14.1, plus a few generic strings to exercise message
// formatting with arbitrary content.
const operationLabelArb = fc.oneof(
    fc.constantFrom(
        'mergeMasks',
        'exportImageBase64',
        'exportImageFile',
        'downloadImage',
        'enterCropMode',
        'applyCrop',
        'removeAllMasks',
        'loadImage',
    ),
    fc.string({ minLength: 1, maxLength: 32 }),
);

// Short, deterministic delays so the suite stays fast at ≥100 iterations.
const delayArb = fc.integer({ min: 0, max: 5 });

const settleModeArb = fc.constantFrom('resolve', 'reject');

// Random small batch of guarded "operation" labels to invoke against the
// guard while it is in a known state.
const labelBatchArb = fc.array(operationLabelArb, { minLength: 1, maxLength: 6 });

// ─── Helpers ───────────────────────────────────────────────────────────────

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Build an animation function that resolves or rejects after `ms` ms with a
// distinguishable payload, and lets the caller observe the guard state from
// within the animation block.
function makeAnimation(guard, mode, ms, observe) {
    return async () => {
        // Inside the bracket, the guard MUST report isAnimating=true.
        observe(guard.isAnimating(), guard.isDisposed());
        await delay(ms);
        if (mode === 'reject') {
            const err = new Error('animation rejected');
            err.__fc_marker = true;
            throw err;
        }
        return 'ok';
    };
}

// ─── Property assertions ───────────────────────────────────────────────────

test('Property 13.1: runAnimation clears isAnimating on both resolve and reject', async () => {
    await fc.assert(
        fc.asyncProperty(settleModeArb, delayArb, async (mode, ms) => {
            const guard = new OperationGuard();

            // Pre-condition: fresh guard reports a quiescent state.
            assert.equal(guard.isAnimating(), false);
            assert.equal(guard.isDisposed(), false);

            const observed = { isAnimating: null, isDisposed: null };
            const fn = makeAnimation(guard, mode, ms, (a, d) => {
                observed.isAnimating = a;
                observed.isDisposed = d;
            });

            if (mode === 'resolve') {
                const value = await guard.runAnimation(fn);
                assert.equal(value, 'ok');
            } else {
                await assert.rejects(
                    () => guard.runAnimation(fn),
                    (err) => err instanceof Error && err.__fc_marker === true,
                );
            }

            // Mid-animation, the bracket was active.
            assert.equal(observed.isAnimating, true,
                'guard must report isAnimating=true inside the runAnimation block');
            assert.equal(observed.isDisposed, false,
                'guard must report isDisposed=false inside a fresh runAnimation block');

            // Post-condition: Req 14.3 — flag is cleared before the
            // promise settled, so it must read `false` here regardless of
            // resolve/reject path.
            assert.equal(guard.isAnimating(), false,
                'isAnimating must be false after runAnimation settles');
            assert.equal(guard.isDisposed(), false,
                'isDisposed must remain false after a normal runAnimation cycle');
        }),
        { numRuns: 100 },
    );
});

test('Property 13.2: assertNotAnimating throws inside runAnimation, succeeds outside', async () => {
    await fc.assert(
        fc.asyncProperty(labelBatchArb, delayArb, async (labels, ms) => {
            const guard = new OperationGuard();

            // Outside any animation block: every label must pass the gate.
            for (const label of labels) {
                assert.doesNotThrow(
                    () => guard.assertNotAnimating(label),
                    `assertNotAnimating(${JSON.stringify(label)}) must not throw on a quiescent guard`,
                );
            }

            // Inside an animation block: every label must trip the gate.
            await guard.runAnimation(async () => {
                await delay(ms);
                for (const label of labels) {
                    assert.throws(
                        () => guard.assertNotAnimating(label),
                        (err) => {
                            assert.ok(err instanceof Error,
                                'assertNotAnimating must throw an Error');
                            // The label is embedded verbatim in the message
                            // so each public method's documented no-op shape
                            // can branch on the operation name.
                            assert.ok(
                                err.message.includes(label) ||
                                    // Fallback: messages may quote the label;
                                    // accept either the bare or quoted form.
                                    err.message.includes(JSON.stringify(label).slice(1, -1)),
                                `error message must embed the operation label '${label}': ${err.message}`,
                            );
                            return true;
                        },
                        `assertNotAnimating(${JSON.stringify(label)}) must throw while isAnimating`,
                    );
                }
            });

            // After the block: every label must once again pass.
            assert.equal(guard.isAnimating(), false);
            for (const label of labels) {
                assert.doesNotThrow(
                    () => guard.assertNotAnimating(label),
                    `assertNotAnimating(${JSON.stringify(label)}) must not throw after runAnimation settles`,
                );
            }
        }),
        { numRuns: 100 },
    );
});

test('Property 13.3: markDisposed forces a quiescent state mid-animation', async () => {
    await fc.assert(
        fc.asyncProperty(delayArb, fc.boolean(), async (ms, callTwice) => {
            const guard = new OperationGuard();

            // Fresh state — both flags false.
            assert.equal(guard.isDisposed(), false);
            assert.equal(guard.isAnimating(), false);

            // Start an animation, then dispose mid-flight without
            // awaiting it. The animation's own `finally` will still run
            // and clear `isAnimating`, but `markDisposed()` must already
            // have forced both flags into a quiescent shape.
            let observedDuringDispose = null;

            const animationPromise = guard.runAnimation(async () => {
                await delay(ms);
                // Right before yielding, the bracket is active.
                assert.equal(guard.isAnimating(), true);

                guard.markDisposed();

                observedDuringDispose = {
                    isDisposed: guard.isDisposed(),
                    isAnimating: guard.isAnimating(),
                };

                if (callTwice) {
                    // Idempotency: a second call must not flip flags
                    // back on.
                    guard.markDisposed();
                    assert.equal(guard.isDisposed(), true);
                    assert.equal(guard.isAnimating(), false);
                }
                return 'done';
            });

            const result = await animationPromise;
            assert.equal(result, 'done');

            // Req 15.3 / dispose-safe settlement: post-dispose flags read
            // as quiescent even though dispose was called mid-animation.
            assert.deepEqual(observedDuringDispose, {
                isDisposed: true,
                isAnimating: false,
            });

            // After the animation settles, both flags remain quiescent.
            assert.equal(guard.isDisposed(), true);
            assert.equal(guard.isAnimating(), false);
        }),
        { numRuns: 100 },
    );
});

test('Property 13.4: sequential runAnimation calls each bracket cleanly', async () => {
    const stepArb = fc.record({
        mode: settleModeArb,
        ms: delayArb,
    });
    const sequenceArb = fc.array(stepArb, { minLength: 1, maxLength: 6 });

    await fc.assert(
        fc.asyncProperty(sequenceArb, async (steps) => {
            const guard = new OperationGuard();

            for (const [i, step] of steps.entries()) {
                // Between calls: quiescent.
                assert.equal(guard.isAnimating(), false,
                    `guard must be quiescent before step ${i}`);

                let sawAnimating = false;
                const fn = makeAnimation(guard, step.mode, step.ms, (a) => {
                    sawAnimating = a;
                });

                if (step.mode === 'resolve') {
                    const v = await guard.runAnimation(fn);
                    assert.equal(v, 'ok');
                } else {
                    await assert.rejects(() => guard.runAnimation(fn));
                }

                assert.equal(sawAnimating, true,
                    `step ${i}: guard must report isAnimating=true inside its bracket`);
                assert.equal(guard.isAnimating(), false,
                    `step ${i}: guard must be quiescent after settle (Req 14.3)`);
                assert.equal(guard.isDisposed(), false,
                    `step ${i}: dispose flag must remain false`);
            }
        }),
        { numRuns: 100 },
    );
});
