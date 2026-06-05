/**
 * Type:
 *   Property test
 *
 * Purpose:
 *   Verifies src/image/transform-controller.ts resetImageTransform behavior with
 *   orchestrator-style save suppression. The suite isolates transform logic with a
 *   mock canvas and fake Fabric image while observing history-save calls.
 *
 * Scope:
 *   - resetImageTransform returns scale and rotation to default values when an image
 *     is loaded.
 *   - Internal scale and rotate steps run under suppression.
 *   - The completed reset emits exactly one history entry and no-ops when no image is
 *     loaded.
 *
 * Out of scope:
 *   - unrelated editor features
 *   - visual rendering quality
 *   - browser-specific integration details
 *
 * Environment:
 *   - Node.js ESM
 *   - fast-check generated cases where applicable
 *   - Fabric/canvas behavior is mocked where needed
 *
 * Run:
 *   node --test tests/reset-transform.property.test.mjs
 *
 * Notes:
 *   - Prefer behavior-level assertions over implementation-detail checks.
 *   - Keep this file focused on reset transform creates one history entry only.
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

const { TransformController } = await import('../src/image/transform-controller.ts');
const { OperationGuard } = await import('../src/core/operation-guard.ts');
const { resolveOptions } = await import('../src/core/default-options.ts');

// ─── Mocks ─────────────────────────────────────────────────────────────────

/**
 * Minimal stand-in for `fabric.Canvas`. Same shape as the scale-clamp
 * test: only `requestRenderAll` is implemented since `animateProps`'s
 * `onChange` is the only canvas-touching surface in the controller.
 */
class MockCanvas {
    constructor() {
        this.renderCalls = 0;
    }
    requestRenderAll() {
        this.renderCalls++;
    }
}

/**
 * Build a fake Fabric image whose `animate` resolves the wrapper
 * Promise synchronously by firing `opts.onComplete` once per property.
 * `scaleImage` tweens `scaleX` + `scaleY` (two callbacks) and
 * `rotateImage` tweens `angle` (one callback). Either way the wrapper
 * resolves in a single microtask per call.
 */
function makeFabricImageMock(initial) {
    return {
        width: 100,
        height: 100,
        scaleX: initial.scaleX,
        scaleY: initial.scaleY,
        angle: initial.angle,
        left: 0,
        top: 0,
        originX: 'left',
        originY: 'top',
        set(props, value) {
            // Support both `set({ key: val })` and `set(key, val)` forms
            // since `transform-controller.ts` uses both.
            if (typeof props === 'string') {
                this[props] = value;
            } else {
                Object.assign(this, props);
            }
        },
        setCoords() {
            // No-op — placement math is not part of .
        },
        setPositionByOrigin() {
            // No-op — only cares about history entry count
            // and final scale/rotation values.
        },
        getCenterPoint() {
            return { x: 50, y: 50 };
        },
        getCoords() {
            return [{ x: 0, y: 0 }];
        },
        getBoundingRect() {
            return { left: 0, top: 0, width: 100, height: 100 };
        },
        animate(props, opts) {
            // Fire `onComplete` once per property to match Fabric v7's
            // multi-property completion contract (see
            // `fabric-animation.ts → animateProps`).
            const propCount = Object.keys(props).length;
            for (let i = 0; i < propCount; i++) opts.onComplete?.();
            return [];
        },
    };
}

// ─── Context builder ───────────────────────────────────────────────────────

/**
 * Build a `TransformContext` whose `saveCanvasState` honours the
 * suppression flag toggled by `setSuppressSaveState`. This mirrors the
 * orchestrator wiring documented on
 * {@link TransformContext.saveCanvasState}: the orchestrator MUST treat
 * `saveCanvasState` as a no-op while the suppression flag is `true`,
 * which is what lets `resetImageTransform` collapse the chained
 * `scaleImage(1)` and `rotateImage(0)` per-operation entries into a
 * single history entry.
 *
 * The returned `getSaveCalls`, `getSuppressed`, and `getSuppressedAtSave`
 * helpers expose the bookkeeping the property assertions need:
 *   - `getSaveCalls()` — count of NON-suppressed `saveCanvasState` calls.
 *   - `getSuppressed()` — current suppression state (post-reset must be
 *     `false`).
 *   - `getSuppressedAtSave()` — array of suppression-state-at-call-time
 *     for every `saveCanvasState` invocation (including suppressed
 *     ones); used to assert the inner `scaleImage(1)` / `rotateImage(0)`
 *     calls each ran under suppression while the final reset save did
 *     not.
 */
function makeContextWithSuppression({ initialScale, initialRotation }) {
    const canvas = new MockCanvas();
    const guard = new OperationGuard();
    const image = makeFabricImageMock({
        // Mirror the orchestrator: `image.scaleX`/`scaleY` are
        // `baseImageScale * currentScale`. With `baseImageScale === 1`
        // they equal `currentScale`.
        scaleX: initialScale,
        scaleY: initialScale,
        angle: initialRotation,
    });

    const state = {
        currentScale: initialScale,
        currentRotation: initialRotation,
        baseImageScale: 1,
    };

    let suppressed = false;
    let saveCalls = 0;
    const suppressedAtSave = [];

    // Use defaults so 1 is always within [minScale, maxScale] (defaults
    // are `0.1` and `5.0`). The property covers any starting state, not
    // any min/max bound — bounds clamping is .
    const options = resolveOptions({
        animationDuration: 1,
    });

    const ctx = {
        canvas,
        options,
        guard,
        getOriginalImage: () => image,
        getCurrentScale: () => state.currentScale,
        setCurrentScale: (n) => {
            state.currentScale = n;
        },
        getCurrentRotation: () => state.currentRotation,
        setCurrentRotation: (n) => {
            state.currentRotation = n;
        },
        getBaseImageScale: () => state.baseImageScale,
        saveCanvasState: () => {
            // Record the suppression state at the time of every call
            // so the property can assert that the inner `scaleImage(1)`
            // / `rotateImage(0)` calls each ran with suppression active
            // and only the final reset save ran with suppression off.
            suppressedAtSave.push(suppressed);
            if (!suppressed) saveCalls++;
        },
        setSuppressSaveState: (v) => {
            suppressed = v;
        },
    };

    return {
        ctx,
        state,
        image,
        getSaveCalls: () => saveCalls,
        getSuppressed: () => suppressed,
        getSuppressedAtSave: () => suppressedAtSave.slice(),
    };
}

// ─── Arbitraries ───────────────────────────────────────────────────────────

/**
 * Any finite starting `currentScale`. The values straddle the default
 * `[0.1, 5]` window so both clamp branches inside the chained
 * `scaleImage(1)` would fire if it were not for the fact that the
 * target factor is `1` (always inside the bounds).
 */
const startingScaleArb = fc.double({
    min: 0.001,
    max: 100,
    noNaN: true,
    noDefaultInfinity: true,
});

/**
 * Any finite starting `currentRotation` in degrees. Negative, zero, and
 * multi-turn values are all valid Fabric `angle` inputs.
 */
const startingRotationArb = fc.double({
    min: -720,
    max: 720,
    noNaN: true,
    noDefaultInfinity: true,
});

// ─── Properties ─────────────────────────────────────────────────────────────

test('resetImageTransform produces exactly one history entry', async () => {
    await fc.assert(
        fc.asyncProperty(
            startingScaleArb,
            startingRotationArb,
            async (initialScale, initialRotation) => {
                const harness = makeContextWithSuppression({
                    initialScale,
                    initialRotation,
                });
                const controller = new TransformController(harness.ctx);

                await controller.resetImageTransform();

                // the documented contract — exactly one non-suppressed
                // `saveCanvasState` covers the entire reset.
                assert.equal(
                    harness.getSaveCalls(),
                    1,
                    'the documented contract: resetImageTransform must record exactly one history entry',
                );

                // the documented contract — final state is the default (scale 1,
                // rotation 0). The chained `scaleImage(1)` and
                // `rotateImage(0)` write these values.
                assert.equal(
                    harness.ctx.getCurrentScale(),
                    1,
                    'the documented contract: post-reset currentScale must be 1',
                );
                assert.equal(
                    harness.ctx.getCurrentRotation(),
                    0,
                    'the documented contract: post-reset currentRotation must be 0',
                );

                // Suppression flag MUST be released after the reset
                // so subsequent transforms continue to record
                // history (the controller's `finally` block).
                assert.equal(
                    harness.getSuppressed(),
                    false,
                    'the documented contract: suppression flag must be cleared after reset',
                );
            },
        ),
        { numRuns: 30 },
    );
});

test('inner scaleImage/rotateImage calls run under suppression; final save does not', async () => {
    await fc.assert(
        fc.asyncProperty(
            startingScaleArb,
            startingRotationArb,
            async (initialScale, initialRotation) => {
                const harness = makeContextWithSuppression({
                    initialScale,
                    initialRotation,
                });
                const controller = new TransformController(harness.ctx);

                await controller.resetImageTransform();

                // Three `saveCanvasState` invocations occur:
                //   1. `scaleImage(1)` save  — suppressed === true
                //   2. `rotateImage(0)` save — suppressed === true
                //   3. final reset save     — suppressed === false
                // The mock records suppression state at each call.
                const trace = harness.getSuppressedAtSave();

                assert.equal(
                    trace.length,
                    3,
                    'the documented contract: scaleImage, rotateImage, and the final reset each invoke saveCanvasState (3 calls total)',
                );
                assert.deepEqual(
                    trace,
                    [true, true, false],
                    'the documented contract: chained inner saves must run under suppression; only the final reset save is recorded',
                );
            },
        ),
        { numRuns: 30 },
    );
});

test('resetImageTransform is a no-op when no image is loaded', async () => {
    const harness = makeContextWithSuppression({
        initialScale: 2,
        initialRotation: 45,
    });
    // Override `getOriginalImage` to mirror the "no image loaded"
    // branch that `resetImageTransform` short-circuits on.
    harness.ctx.getOriginalImage = () => null;
    const controller = new TransformController(harness.ctx);

    await controller.resetImageTransform();

    assert.equal(
        harness.getSaveCalls(),
        0,
        'the documented contract: no history entry when no image is loaded',
    );
    assert.equal(
        harness.ctx.getCurrentScale(),
        2,
        'the documented contract: state is unchanged when no image is loaded',
    );
    assert.equal(
        harness.ctx.getCurrentRotation(),
        45,
        'the documented contract: state is unchanged when no image is loaded',
    );
});
