/**
 * @file operation-guard.property.test.mjs
 *
 * Type:
 *   Property test
 *
 * Purpose:
 *   Verifies src/core/operation-guard.ts state transitions around animation
 *   bracketing, assertion behavior, disposal, and sequential runs. The guard is
 *   tested directly because it owns the shared isAnimating and isDisposed flags used
 *   by the facade and controllers.
 *
 * Scope:
 *   - runAnimation clears isAnimating on both resolve and reject.
 *   - assertNotAnimating throws only while an animation is active.
 *   - markDisposed forces a quiescent state, and sequential animations bracket
 *     cleanly.
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
 *   node --test tests/operation-guard.property.test.mjs
 *
 * Notes:
 *   - Prefer behavior-level assertions over implementation-detail checks.
 *   - Keep this file focused on operation guard animation lifecycle only.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

import { OperationGuard } from '../src/core/operation-guard.ts';

// ─── Arbitraries ───────────────────────────────────────────────────────────

// Operation labels mirror the public-method names enumerated in
// the documented contract, plus a few generic strings to exercise message
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

test('runAnimation clears isAnimating on both resolve and reject', async () => {
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

            // Post-condition: the documented contract — flag is cleared before the
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

test('assertNotAnimating throws inside runAnimation, succeeds outside', async () => {
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

test('markDisposed forces a quiescent state mid-animation', async () => {
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

            // the documented contract / dispose-safe settlement: post-dispose flags read
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

test('sequential runAnimation calls each bracket cleanly', async () => {
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
                    `step ${i}: guard must be quiescent after settle`);
                assert.equal(guard.isDisposed(), false,
                    `step ${i}: dispose flag must remain false`);
            }
        }),
        { numRuns: 100 },
    );
});
