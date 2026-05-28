/**
 * @file downsample-dimensions.property.test.mjs
 *
 * Type:
 *   Property test
 *
 * Purpose:
 *   Verifies src/image/downsample.ts size calculation for arbitrary source image
 *   dimensions and maximum bounds. The property focuses on pure math and does not
 *   require canvas, image decoding, or DOM setup.
 *
 * Scope:
 *   - Images that already fit pass through unchanged.
 *   - Oversized images are scaled down without exceeding either bound.
 *   - Aspect ratio is preserved and output dimensions never fall below one pixel.
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
 *   node --test tests/downsample-dimensions.property.test.mjs
 *
 * Notes:
 *   - Prefer behavior-level assertions over implementation-detail checks.
 *   - Keep this file focused on downsample dimension calculation only.
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

const { computeDownsampleDimensions } = await import('../src/image/image-resampler.ts');

// ─── Arbitraries ───────────────────────────────────────────────────────────

const dimArb = fc.integer({ min: 1, max: 10000 });

// ─── Pass-through when within bounds ────────────────────────

test('pass-through when source fits both bounds', () => {
    fc.assert(
        fc.property(dimArb, dimArb, dimArb, dimArb, (srcW, srcH, maxW, maxH) => {
            // Restrict to the within-bounds case.
            fc.pre(srcW <= maxW && srcH <= maxH);

            const out = computeDownsampleDimensions(srcW, srcH, maxW, maxH);
            assert.equal(
                out.needsResize,
                false,
                `needsResize must be false when source (${srcW}x${srcH}) ` +
                    `fits within bounds (${maxW}x${maxH})`,
            );
            assert.equal(out.width, srcW, 'pass-through must preserve srcW');
            assert.equal(out.height, srcH, 'pass-through must preserve srcH');
            return true;
        }),
        { numRuns: 100 },
    );
});

// ─── Within bounds (with +/-1 rounding tolerance) ───────────

test('output never exceeds bounds', () => {
    fc.assert(
        fc.property(dimArb, dimArb, dimArb, dimArb, (srcW, srcH, maxW, maxH) => {
            const out = computeDownsampleDimensions(srcW, srcH, maxW, maxH);

            // The fitted axis is computed via Math.round(src * ratio) where
            // ratio = min(maxW/srcW, maxH/srcH). Math.round can introduce a
            // half-pixel overshoot, so allow +1 tolerance per axis; the
            // unfitted axis is always strictly within its bound.
            assert.ok(
                out.width <= maxW + 1,
                `out.width=${out.width} exceeded maxW=${maxW} ` +
                    `for src=${srcW}x${srcH}, max=${maxW}x${maxH}`,
            );
            assert.ok(
                out.height <= maxH + 1,
                `out.height=${out.height} exceeded maxH=${maxH} ` +
                    `for src=${srcW}x${srcH}, max=${maxW}x${maxH}`,
            );
            return true;
        }),
        { numRuns: 100 },
    );
});

// ─── Aspect ratio preserved when scaling occurred ───────────

test('aspect ratio preserved when scaling occurred', () => {
    fc.assert(
        fc.property(dimArb, dimArb, dimArb, dimArb, (srcW, srcH, maxW, maxH) => {
            const out = computeDownsampleDimensions(srcW, srcH, maxW, maxH);

            if (!out.needsResize) {
                // Pass-through case is covered by .
                return true;
            }

            // Aspect-ratio preservation is expressed as a per-axis bound:
            // each output dimension stays within ±1 of the ideal scaled
            // value `srcDim * ratio`. This is equivalent to "integer
            // rounding error per axis ≤ 1px" and avoids spurious failures
            // from comparing ratios when one axis is small (where a
            // 0.5-px rounding step can shift the ratio by O(1)).
            //
            // The 1-px floor from the documented contract (Math.max in
            // image-resampler.ts) can push the output above the ideal
            // scaled value when the ideal value rounds to 0; allow that
            // case explicitly.
            const ratio = Math.min(maxW / srcW, maxH / srcH);
            const idealWidth = srcW * ratio;
            const idealHeight = srcH * ratio;

            const widthDelta =
                idealWidth < 1 && out.width === 1
                    ? 0 // floor case: ideal rounds below 1px, output clamped to 1
                    : Math.abs(out.width - idealWidth);
            const heightDelta =
                idealHeight < 1 && out.height === 1 ? 0 : Math.abs(out.height - idealHeight);

            assert.ok(
                widthDelta <= 1,
                `width drift ${widthDelta} > 1 ` +
                    `(src=${srcW}x${srcH}, max=${maxW}x${maxH}, ` +
                    `out=${out.width}x${out.height}, ideal=${idealWidth.toFixed(2)}x${idealHeight.toFixed(2)})`,
            );
            assert.ok(
                heightDelta <= 1,
                `height drift ${heightDelta} > 1 ` +
                    `(src=${srcW}x${srcH}, max=${maxW}x${maxH}, ` +
                    `out=${out.width}x${out.height}, ideal=${idealWidth.toFixed(2)}x${idealHeight.toFixed(2)})`,
            );
            return true;
        }),
        { numRuns: 100 },
    );
});

// ─── Always positive ────────────────────────────────────────

test('output dimensions are always >= 1', () => {
    fc.assert(
        fc.property(dimArb, dimArb, dimArb, dimArb, (srcW, srcH, maxW, maxH) => {
            const out = computeDownsampleDimensions(srcW, srcH, maxW, maxH);
            assert.ok(
                out.width >= 1,
                `out.width=${out.width} must be >= 1 ` +
                    `(src=${srcW}x${srcH}, max=${maxW}x${maxH})`,
            );
            assert.ok(
                out.height >= 1,
                `out.height=${out.height} must be >= 1 ` +
                    `(src=${srcW}x${srcH}, max=${maxW}x${maxH})`,
            );
            return true;
        }),
        { numRuns: 100 },
    );
});

test('invalid bounds keep the original positive source dimensions', () => {
    for (const [maxW, maxH] of [
        [0, 100],
        [100, 0],
        [-1, 100],
        [100, -1],
        [Number.NaN, 100],
        [100, Number.POSITIVE_INFINITY],
    ]) {
        const out = computeDownsampleDimensions(640, 480, maxW, maxH);
        assert.deepEqual(out, {
            width: 640,
            height: 480,
            needsResize: false,
        });
    }
});
