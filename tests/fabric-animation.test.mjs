/**
 * Type:
 *   Unit test
 *
 * Purpose:
 *   Verifies the Fabric animation promise wrapper settles when dispose aborts
 *   an in-flight animation that never calls onComplete. This prevents the
 *   animation queue from hanging permanently when Fabric cancels or loses an
 *   animation completion callback.
 *
 * Scope:
 *   - animateProps registers Fabric animation abort handles with OperationGuard.
 *   - OperationGuard.markDisposed() aborts the active animation and lets the
 *     returned promise settle.
 *   - The test uses a minimal Fabric object stub that invokes onChange but
 *     intentionally never invokes onComplete.
 *
 * Out of scope:
 *   - Fabric.js rendering internals and real tween timing.
 *   - TransformController scale, rotate, and reset behavior.
 *   - AnimationQueue FIFO ordering, which is covered by
 *     animation-queue.property.test.mjs.
 *
 * Environment:
 *   - Node.js ESM.
 *   - TypeScript source imports through tests/helpers/ts-resolve-hook.mjs.
 *
 * Run:
 *   node --import ./tests/helpers/register-ts-loader.mjs --test tests/fabric-animation.test.mjs
 *
 * Notes:
 *   - Keep this file focused on the dispose/abort settlement contract for
 *     src/fabric/fabric-animation.ts.
 *   - The timeout wrapper exists only to fail fast if the promise regresses to
 *     a hanging state.
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';

const { animateProps } = await import('../src/fabric/fabric-animation.ts');
const { OperationGuard } = await import('../src/core/operation-guard.ts');

function withTimeout(promise, ms, label) {
    let handle;
    const timeout = new Promise((_, reject) => {
        handle = setTimeout(() => {
            reject(new Error(`Timed out waiting for ${label}`));
        }, ms);
    });
    return Promise.race([promise, timeout]).finally(() => {
        clearTimeout(handle);
    });
}

test('animateProps aborts and settles when dispose interrupts an in-flight animation', async () => {
    const guard = new OperationGuard();
    let abortCalls = 0;
    let changeCalls = 0;

    const object = {
        animate(_props, options) {
            options.onChange?.();
            return {
                scaleX: {
                    abort() {
                        abortCalls += 1;
                    },
                },
            };
        },
    };

    const promise = animateProps(
        object,
        { scaleX: 2 },
        {
            duration: 10000,
            onChange: () => {
                changeCalls += 1;
            },
        },
        guard,
    );

    await Promise.resolve();
    guard.markDisposed();
    await withTimeout(promise, 100, 'dispose-aborted animation');

    assert.equal(changeCalls, 1);
    assert.equal(abortCalls, 1);
});

test('animateProps passes a clamped finite duration to Fabric', async () => {
    const guard = new OperationGuard();
    const durations = [];
    const object = {
        animate(_props, options) {
            durations.push(options.duration);
            options.onComplete?.();
            return [];
        },
    };

    await animateProps(object, { scaleX: 2 }, { duration: Number.NaN }, guard);
    await animateProps(object, { scaleX: 2 }, { duration: -10 }, guard);

    assert.deepEqual(durations, [0, 0]);
});
