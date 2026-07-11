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

function makeNoopOverlayTransformHooks() {
    let suppressed = false;
    return {
        getFabricUtil: () => ({}),
        getBoundOverlayTargets: () => [],
        shouldPreserveReadableForAnnotation: () => false,
        finalizeImageTransformSnap: () => {},
        applyOverlayTransformDelta: () => {},
        syncOverlayAfterTransform: () => {},
        setSuppressOverlaySync: (value) => {
            suppressed = value;
        },
        isOverlaySyncSuppressed: () => suppressed,
    };
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
        flipX: initial.flipX ?? false,
        flipY: initial.flipY ?? false,
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
            // No-op — placement math is not part of the reset history property.
        },
        setPositionByOrigin() {
            // No-op — this suite only cares about history entry count
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
        calcTransformMatrix() {
            return [this.scaleX, 0, 0, this.scaleY, this.left, this.top];
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
 * orchestrator wiring around {@link TransformContext.saveCanvasState}:
 * the orchestrator MUST treat
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
function makeContextWithSuppression({ initialScale, initialRotation, initialFlipX, initialFlipY }) {
    const canvas = new MockCanvas();
    const guard = new OperationGuard();
    const image = makeFabricImageMock({
        // Mirror the orchestrator: `image.scaleX`/`scaleY` are
        // `baseImageScale * currentScale`. With `baseImageScale === 1`
        // they equal `currentScale`.
        scaleX: initialScale,
        scaleY: initialScale,
        angle: initialRotation,
        flipX: initialFlipX ?? false,
        flipY: initialFlipY ?? false,
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
        ...makeNoopOverlayTransformHooks(),
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
                assert.equal(harness.image.flipX, false, 'resetImageTransform must clear flipX');
                assert.equal(harness.image.flipY, false, 'resetImageTransform must clear flipY');

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

test('resetImageTransform applies exactly one final overlay delta', async () => {
    const harness = makeContextWithSuppression({
        initialScale: 2,
        initialRotation: 37,
        initialFlipX: true,
        initialFlipY: false,
    });
    const initialMatrix = harness.image.calcTransformMatrix().slice();
    const deltaCalls = [];
    harness.ctx.applyOverlayTransformDelta = (beforeMatrix) => {
        deltaCalls.push({
            beforeMatrix: beforeMatrix.slice(),
            suppressed: harness.ctx.isOverlaySyncSuppressed(),
        });
    };
    const controller = new TransformController(harness.ctx);

    await controller.resetImageTransform();

    assert.deepEqual(deltaCalls, [
        {
            beforeMatrix: initialMatrix,
            suppressed: false,
        },
    ]);
    assert.equal(harness.ctx.isOverlaySyncSuppressed(), false);
});

test('resetImageTransform synchronizes overlay session state only once', async () => {
    const harness = makeContextWithSuppression({
        initialScale: 2,
        initialRotation: 37,
        initialFlipX: true,
        initialFlipY: false,
    });
    let syncCalls = 0;
    harness.ctx.syncOverlayAfterTransform = () => {
        syncCalls += 1;
    };
    const controller = new TransformController(harness.ctx);

    await controller.resetImageTransform();

    assert.equal(syncCalls, 1, 'only the final compound transform synchronizes overlays');
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

test('scaleImage rolls back runtime state when animation fails', async () => {
    const canvas = new MockCanvas();
    const guard = new OperationGuard();
    const image = makeFabricImageMock({ scaleX: 2, scaleY: 2, angle: 0 });
    image.animate = () => {
        throw new Error('scale animation failed');
    };
    const state = {
        currentScale: 2,
        currentRotation: 0,
        baseImageScale: 1,
    };
    const controller = new TransformController({
        canvas,
        options: resolveOptions({ animationDuration: 1 }),
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
            throw new Error('failed scale must not save history');
        },
        setSuppressSaveState: () => {},
        ...makeNoopOverlayTransformHooks(),
    });

    await controller.scaleImage(3);

    assert.equal(state.currentScale, 2);
    assert.equal(image.scaleX, 2);
    assert.equal(image.scaleY, 2);
});

test('rotateImage rolls back runtime state when animation fails', async () => {
    const canvas = new MockCanvas();
    const guard = new OperationGuard();
    const image = makeFabricImageMock({ scaleX: 1, scaleY: 1, angle: 45 });
    image.animate = () => {
        throw new Error('rotate animation failed');
    };
    const state = {
        currentScale: 1,
        currentRotation: 45,
        baseImageScale: 1,
    };
    const controller = new TransformController({
        canvas,
        options: resolveOptions({ animationDuration: 1 }),
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
            throw new Error('failed rotate must not save history');
        },
        setSuppressSaveState: () => {},
        ...makeNoopOverlayTransformHooks(),
    });

    await controller.rotateImage(90);

    assert.equal(state.currentRotation, 45);
    assert.equal(image.angle, 45);
    assert.equal(image.originX, 'left');
    assert.equal(image.originY, 'top');
});

test('scaleImage records history when final image snap throws after a successful animation', async () => {
    const canvas = new MockCanvas();
    const guard = new OperationGuard();
    const image = makeFabricImageMock({ scaleX: 1, scaleY: 1, angle: 0 });
    const state = {
        currentScale: 1,
        currentRotation: 0,
        baseImageScale: 1,
    };
    let saveCalls = 0;
    const controller = new TransformController({
        canvas,
        options: resolveOptions({ animationDuration: 1 }),
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
            saveCalls += 1;
        },
        setSuppressSaveState: () => {},
        ...makeNoopOverlayTransformHooks(),
        finalizeImageTransformSnap: () => {
            throw new Error('snap failed');
        },
    });

    await assert.rejects(() => controller.scaleImage(2), /snap failed/);

    assert.equal(saveCalls, 1);
    assert.equal(state.currentScale, 2);
    assert.equal(image.scaleX, 2);
    assert.equal(image.scaleY, 2);
});

test('flipHorizontal toggles only base image flipX and records one history entry', async () => {
    const harness = makeContextWithSuppression({
        initialScale: 1,
        initialRotation: 0,
        initialFlipX: false,
        initialFlipY: false,
    });
    const controller = new TransformController(harness.ctx);
    const overlay = { editorObjectKind: 'mask', flipX: false, flipY: false, left: 10 };

    await controller.flipHorizontal();

    assert.equal(harness.image.flipX, true);
    assert.equal(harness.image.flipY, false);
    assert.deepEqual(
        overlay,
        { editorObjectKind: 'mask', flipX: false, flipY: false, left: 10 },
        'flipHorizontal must not mutate overlay objects',
    );
    assert.equal(harness.getSaveCalls(), 1);

    await controller.flipHorizontal();

    assert.equal(harness.image.flipX, false);
    assert.equal(harness.getSaveCalls(), 2);
});

test('flipVertical toggles only base image flipY and records one history entry', async () => {
    const harness = makeContextWithSuppression({
        initialScale: 1,
        initialRotation: 0,
        initialFlipX: false,
        initialFlipY: false,
    });
    const controller = new TransformController(harness.ctx);
    const annotation = { editorObjectKind: 'annotation', flipX: false, flipY: false, top: 12 };

    await controller.flipVertical();

    assert.equal(harness.image.flipX, false);
    assert.equal(harness.image.flipY, true);
    assert.deepEqual(
        annotation,
        { editorObjectKind: 'annotation', flipX: false, flipY: false, top: 12 },
        'flipVertical must not mutate annotation objects',
    );
    assert.equal(harness.getSaveCalls(), 1);

    await controller.flipVertical();

    assert.equal(harness.image.flipY, false);
    assert.equal(harness.getSaveCalls(), 2);
});

test('flip failure restores image state and synchronizes overlays without saving history', async () => {
    const harness = makeContextWithSuppression({
        initialScale: 1,
        initialRotation: 0,
        initialFlipX: false,
        initialFlipY: true,
    });
    const warnings = [];
    harness.ctx.options = resolveOptions({
        animationDuration: 1,
        onWarning: (error, message) => warnings.push({ error, message }),
    });
    harness.image.getCoords = () => {
        throw new Error('top-left lookup failed');
    };
    const deltaCalls = [];
    let syncCalls = 0;
    harness.ctx.applyOverlayTransformDelta = (beforeMatrix) => {
        deltaCalls.push(beforeMatrix.slice());
    };
    harness.ctx.syncOverlayAfterTransform = () => {
        syncCalls += 1;
    };
    const controller = new TransformController(harness.ctx);

    await controller.flipHorizontal();

    assert.equal(harness.image.flipX, false);
    assert.equal(harness.image.flipY, true);
    assert.equal(harness.image.originX, 'left');
    assert.equal(harness.image.originY, 'top');
    assert.equal(harness.getSaveCalls(), 0);
    assert.equal(deltaCalls.length, 1, 'rollback synchronizes overlay geometry');
    assert.equal(syncCalls, 1, 'rollback synchronizes overlay session state');
    assert.equal(warnings.length, 1);
    assert.match(warnings[0].message, /flipHorizontal failed/);
});

test('flip is a no-op when no image is loaded or the editor is disposed', async () => {
    const noImageHarness = makeContextWithSuppression({
        initialScale: 1,
        initialRotation: 0,
    });
    noImageHarness.ctx.getOriginalImage = () => null;
    await new TransformController(noImageHarness.ctx).flipHorizontal();
    assert.equal(noImageHarness.getSaveCalls(), 0);

    const disposedHarness = makeContextWithSuppression({
        initialScale: 1,
        initialRotation: 0,
    });
    disposedHarness.ctx.guard.markDisposed();
    await new TransformController(disposedHarness.ctx).flipVertical();
    assert.equal(disposedHarness.image.flipY, false);
    assert.equal(disposedHarness.getSaveCalls(), 0);
});
