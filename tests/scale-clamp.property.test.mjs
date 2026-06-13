/**
 * Type:
 *   Property test
 *
 * Purpose:
 *   Verifies src/image/transform-controller.ts scaleImage behavior for arbitrary
 *   scale factors. A fake Fabric image and minimal TransformContext keep the async
 *   animation path deterministic while exposing currentScale and image scale fields.
 *
 * Scope:
 *   - Resulting currentScale is clamped to [minScale, maxScale].
 *   - Image scaleX and scaleY stay synchronized with currentScale times
 *     baseImageScale.
 *   - Animation completion is simulated through the same callback shape the wrapper
 *     expects.
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
 *   node --test tests/scale-clamp.property.test.mjs
 *
 * Notes:
 *   - Prefer behavior-level assertions over implementation-detail checks.
 *   - Keep this file focused on scale clamping only.
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
 * Minimal stand-in for `fabric.Canvas`. `animateProps`'s `onChange` calls
 * `requestRenderAll`; the post-snap path does not touch the canvas at
 * all (the controller writes the final value through the image, not the
 * canvas). Counting `requestRenderAll` calls is not part of the
 * property, but having the method present prevents a `TypeError` if the
 * mocked animate somehow fires `onChange` (it does not, in our stub).
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
 * Promise synchronously.
 *
 * Why synchronous completion is sound: `animateProps` only counts
 * `onComplete` callbacks before resolving — it does not depend on the
 * `Animation[]` return value. Firing `onComplete` once per property
 * matches the Fabric v7 contract documented in
 * `fabric/fabric-animation.ts` and lets each iteration finish in a
 * single microtask.
 *
 * Bookkeeping: we record the last `set({ scaleX, scaleY })` call so the
 * post-snap assertion can verify the controller's final write matches
 * `baseImageScale * clamped`.
 */
function makeFabricImageMock() {
    return {
        width: 100,
        height: 100,
        scaleX: 1,
        scaleY: 1,
        angle: 0,
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
            // No-op — the controller calls this for Fabric's coordinate
            // cache but our mock has no cache to invalidate.
        },
        setPositionByOrigin() {
            // No-op — placement math is not part of the scale clamping property.
        },
        getCenterPoint() {
            return { x: 50, y: 50 };
        },
        getCoords() {
            // The controller reads `coords[0]` as the visual top-left.
            // Returning a single zero point keeps `computeTopLeftPoint`
            // happy without exercising the bounding-rect fallback.
            return [{ x: 0, y: 0 }];
        },
        getBoundingRect() {
            return { left: 0, top: 0, width: 100, height: 100 };
        },
        animate(props, opts) {
            // Fire `onComplete` once per property to match Fabric v7's
            // multi-property completion contract. `scaleImage` tweens
            // `scaleX` and `scaleY`, so this resolves `animateProps`
            // after two callbacks.
            const propCount = Object.keys(props).length;
            for (let i = 0; i < propCount; i++) opts.onComplete?.();
            return [];
        },
    };
}

// ─── Context builder ───────────────────────────────────────────────────────

/**
 * Build a fully-wired `TransformContext` whose `currentScale` and the
 * fake image's `scaleX`/`scaleY` are observable to the test. Each call
 * mints its own state holder, image, canvas, and guard.
 */
function makeTransformCtx({ minScale, maxScale, baseImageScale = 1 }) {
    const canvas = new MockCanvas();
    const guard = new OperationGuard();
    const image = makeFabricImageMock();
    image.scaleX = baseImageScale;
    image.scaleY = baseImageScale;

    const state = {
        currentScale: 1,
        currentRotation: 0,
        baseImageScale,
    };
    const saveCalls = [];

    const options = resolveOptions({
        minScale,
        maxScale,
        animationDuration: 1, // 1 ms — the mock animate resolves synchronously anyway
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
            saveCalls.push(state.currentScale);
        },
        setSuppressSaveState: () => {
            // `scaleImage` does not toggle the suppression flag itself.
            // The orchestrator's `resetImageTransform` does, but Property
            // 11 only exercises the direct `scaleImage` path.
        },
    };

    return { ctx, state, image, saveCalls };
}

/** Reference clamp used by every property assertion. */
function clampScale(factor, minScale, maxScale) {
    return Math.max(minScale, Math.min(maxScale, factor));
}

// ─── Arbitraries ───────────────────────────────────────────────────────────

/**
 * Generate a `(minScale, maxScale)` pair with `0 < minScale <= maxScale`
 * and finite, non-NaN values. The bounds mirror the option-resolver's
 * `options-resolution.property.test.mjs` ranges so the values are
 * realistic.
 */
const scaleBoundsArb = fc
    .tuple(
        fc.double({
            min: 0.01,
            max: 1,
            noNaN: true,
            noDefaultInfinity: true,
        }),
        fc.double({
            min: 1,
            max: 10,
            noNaN: true,
            noDefaultInfinity: true,
        }),
    )
    .map(([a, b]) => ({ minScale: Math.min(a, b), maxScale: Math.max(a, b) }));

/**
 * Any finite scale factor — including values well below `minScale` and
 * well above `maxScale` so the clamp branches are exercised. The wide
 * `[-1e3, 1e3]` window keeps the values realistic for a scale factor
 * while still covering the negative-and-zero edge cases the Contract
 * does not exclude.
 */
const factorArb = fc.double({
    min: -1e3,
    max: 1e3,
    noNaN: true,
    noDefaultInfinity: true,
});

// ─── Properties ─────────────────────────────────────────────────────────────

test('scaleImage clamps currentScale to [minScale, maxScale]', async () => {
    await fc.assert(
        fc.asyncProperty(scaleBoundsArb, factorArb, async ({ minScale, maxScale }, factor) => {
            const { ctx, image } = makeTransformCtx({
                minScale,
                maxScale,
            });
            const controller = new TransformController(ctx);

            await controller.scaleImage(factor);

            const expected = clampScale(factor, minScale, maxScale);

            assert.equal(
                ctx.getCurrentScale(),
                expected,
                'the documented contract: currentScale must equal clamp(factor, minScale, maxScale)',
            );

            // Sanity: the post-animation snap mirrors the clamp
            // through `baseImageScale` (1 here) so `scaleX` and
            // `scaleY` stay synchronized with the clamped value.
            assert.equal(
                image.scaleX,
                expected,
                'the documented contract: image.scaleX must reflect the clamped scale (baseImageScale=1)',
            );
            assert.equal(
                image.scaleY,
                expected,
                'the documented contract: image.scaleY must reflect the clamped scale (baseImageScale=1)',
            );
        }),
        { numRuns: 30 },
    );
});

test('factor below minScale clamps up', async () => {
    await fc.assert(
        fc.asyncProperty(scaleBoundsArb, async ({ minScale, maxScale }) => {
            const { ctx } = makeTransformCtx({ minScale, maxScale });
            const controller = new TransformController(ctx);

            // Below the floor — must clamp up to `minScale`.
            await controller.scaleImage(minScale / 2);

            assert.equal(
                ctx.getCurrentScale(),
                minScale,
                'the documented contract: factor < minScale must clamp up to minScale',
            );
        }),
        { numRuns: 30 },
    );
});

test('factor above maxScale clamps down', async () => {
    await fc.assert(
        fc.asyncProperty(scaleBoundsArb, async ({ minScale, maxScale }) => {
            const { ctx } = makeTransformCtx({ minScale, maxScale });
            const controller = new TransformController(ctx);

            // Above the ceiling — must clamp down to `maxScale`.
            await controller.scaleImage(maxScale * 2 + 1);

            assert.equal(
                ctx.getCurrentScale(),
                maxScale,
                'the documented contract: factor > maxScale must clamp down to maxScale',
            );
        }),
        { numRuns: 30 },
    );
});

test('factor within bounds passes through', async () => {
    await fc.assert(
        fc.asyncProperty(
            scaleBoundsArb,
            fc.double({
                min: 0,
                max: 1,
                noNaN: true,
                noDefaultInfinity: true,
            }),
            async ({ minScale, maxScale }, t) => {
                const { ctx } = makeTransformCtx({ minScale, maxScale });
                const controller = new TransformController(ctx);

                // Linear interpolation between minScale and maxScale
                // keeps the factor strictly inside the closed interval
                // for every `t in [0, 1]`.
                const factor = minScale + (maxScale - minScale) * t;
                await controller.scaleImage(factor);

                assert.equal(
                    ctx.getCurrentScale(),
                    factor,
                    'the documented contract: factor in [minScale, maxScale] must pass through unchanged',
                );
            },
        ),
        { numRuns: 30 },
    );
});

test('factor === minScale and factor === maxScale clamp to themselves', async () => {
    await fc.assert(
        fc.asyncProperty(scaleBoundsArb, async ({ minScale, maxScale }) => {
            {
                const { ctx } = makeTransformCtx({ minScale, maxScale });
                const controller = new TransformController(ctx);
                await controller.scaleImage(minScale);
                assert.equal(
                    ctx.getCurrentScale(),
                    minScale,
                    'the documented contract: factor === minScale must clamp to minScale',
                );
            }
            {
                const { ctx } = makeTransformCtx({ minScale, maxScale });
                const controller = new TransformController(ctx);
                await controller.scaleImage(maxScale);
                assert.equal(
                    ctx.getCurrentScale(),
                    maxScale,
                    'the documented contract: factor === maxScale must clamp to maxScale',
                );
            }
        }),
        { numRuns: 30 },
    );
});

test('scaleImage ignores non-finite factors without mutating state or history', async () => {
    for (const factor of [Number.NaN, Infinity, -Infinity]) {
        const { ctx, image, saveCalls } = makeTransformCtx({ minScale: 0.1, maxScale: 5 });
        const controller = new TransformController(ctx);

        await controller.scaleImage(factor);

        assert.equal(ctx.getCurrentScale(), 1);
        assert.equal(image.scaleX, 1);
        assert.equal(image.scaleY, 1);
        assert.equal(saveCalls.length, 0);
    }
});

test('rotateImage ignores non-finite degrees without mutating state or history', async () => {
    for (const degrees of [Number.NaN, Infinity, -Infinity]) {
        const { ctx, image, saveCalls } = makeTransformCtx({ minScale: 0.1, maxScale: 5 });
        const controller = new TransformController(ctx);

        await controller.rotateImage(degrees);

        assert.equal(ctx.getCurrentRotation(), 0);
        assert.equal(image.angle, 0);
        assert.equal(saveCalls.length, 0);
    }
});
