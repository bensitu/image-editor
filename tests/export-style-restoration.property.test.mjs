/**
 * Type:
 *   Property test
 *
 * Purpose:
 *   Verifies that src/export/export-service.ts temporarily bakes mask styles for
 *   image-area export and always restores the original live mask styles afterward.
 *   The property injects arbitrary mask style states and controlled export success or
 *   failure.
 *
 * Scope:
 *   - Successful exportImageBase64 restores every mask field after toDataURL
 *     completes.
 *   - A thrown toDataURL still restores styles in the finally path.
 *   - The canvas mock focuses on object enumeration and export failure injection.
 *
 * Out of scope:
 *   - visual pixel-quality comparison
 *   - browser download UI details
 *   - unrelated image loading behavior
 *
 * Environment:
 *   - Node.js ESM
 *   - fast-check generated cases where applicable
 *   - Fabric/canvas behavior is mocked where needed
 *
 * Run:
 *   node --test tests/export-style-restoration.property.test.mjs
 *
 * Notes:
 *   - Prefer behavior-level assertions over implementation-detail checks.
 *   - Keep this file focused on export-only mask style restoration only.
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

const { exportImageBase64 } = await import('../src/export/export-service.ts');

// ─── Test doubles ───────────────────────────────────────────────────────────

/**
 * Build a mock mask carrying the runtime metadata `isMaskObject` checks
 * for (`maskId: number`) plus the six style fields the bake-in/restore
 * bracket reads from {@link MaskBackup}.
 *
 * `set(patch)` mirrors Fabric's mutation contract — Object.assign onto
 * the live instance — so the bake-in mutator and the finally restore
 * both observe the live values. `setCoords()` is a no-op since the
 * mock has no cached bounding rect.
 */
function makeMockMask({ maskId, opacity, fill, stroke, strokeWidth, selectable, lockRotation }) {
    return {
        editorObjectKind: 'mask',
        maskId,
        maskUid: `mask-${maskId}`,
        maskName: `mask${maskId}`,
        opacity,
        fill,
        stroke,
        strokeWidth,
        selectable,
        lockRotation,
        set(patch) {
            Object.assign(this, patch);
            return this;
        },
        setCoords() {
            return this;
        },
    };
}

/**
 * Snapshot every mask's six tracked style fields. Used both to
 * capture the pre-export state and to read the post-restore state for
 * comparison.
 */
function snapshotMaskStyles(masks) {
    return masks.map((mask) => ({
        maskId: mask.maskId,
        opacity: mask.opacity,
        fill: mask.fill,
        stroke: mask.stroke,
        strokeWidth: mask.strokeWidth,
        selectable: mask.selectable,
        lockRotation: mask.lockRotation,
    }));
}

/**
 * Build a mock canvas that owns `masks` and lets the test optionally
 * inspect the mask styles AT THE MOMENT `toDataURL` is invoked (so we
 * can confirm the bake-in mutation actually ran) or force `toDataURL`
 * to throw (to exercise the `finally` restore path of the documented contract).
 *
 * `getObjects()` returns a fresh array on every call so the bake-in
 * loop's `.filter(isMaskObject)` does not mutate the stored list.
 */
function makeMockCanvas(masks, { onRender, throwOnRender = false } = {}) {
    return {
        getObjects() {
            return masks.slice();
        },
        discardActiveObject() {
            return this;
        },
        toDataURL(options) {
            if (typeof onRender === 'function') {
                onRender({ options, masks });
            }
            if (throwOnRender) {
                throw new Error('forced toDataURL failure');
            }
            return `data:${mimeTypeForFormat(options.format)};base64,AAAA`;
        },
    };
}

function mimeTypeForFormat(format) {
    return format === 'jpeg' ? 'image/jpeg' : `image/${format}`;
}

function makeContext(canvas, originalImage) {
    return {
        canvas,
        options: {
            defaultDownloadFileName: 'edited_image',
            downsampleQuality: 0.92,
            exportMultiplier: 1,
            exportAreaByDefault: 'image',
            mergeMasksByDefault: true,
            mergeAnnotationsByDefault: true,
        },
        fabric: {},
        isImageLoaded: () => true,
        getOriginalImage: () => originalImage,
    };
}

/**
 * Tiny stand-in for `originalImage` whose `getBoundingRect()` returns
 * a fixed integer rect so {@link computeExportRegion} produces a
 * deterministic region every iteration. The exact rect does not
 * affect — only the bake-in/restore bracket does — but
 * supplying a real image keeps the export path on its happy branch.
 */
function makeFakeImage() {
    return {
        setCoords() {
            /* no-op */
        },
        getBoundingRect() {
            return { left: 0, top: 0, width: 100, height: 100 };
        },
    };
}

// ─── Arbitraries ───────────────────────────────────────────────────────────

/**
 * Hex color string (lower-case 6-digit). Produced as the source of
 * truth for `fill`/`stroke` so the assertions can compare strict-equal
 * after restore. We also allow `null` since both fields are documented
 * as `string | TFiller | null` and the `null` branch is the one the
 * export bake-in mutator forces on `stroke`.
 */
const colorOrNullArb = fc.oneof(
    fc.integer({ min: 0, max: 0xffffff }).map((n) => `#${n.toString(16).padStart(6, '0')}`),
    fc.constant(null),
);

/**
 * Pre-export mask style record. Bounds are chosen to cover the
 * documented mask style space:
 *
 *   - `opacity`        — finite [0, 1] (Fabric clamps display, but the
 *                        backup must round-trip the literal value).
 *   - `fill` / `stroke` — `string | null`, including the `null` value
 *                        the export bake-in forces on `stroke`.
 *   - `strokeWidth`    — finite non-negative (Fabric forbids negatives
 *                        in render but the backup field is numeric).
 *   - `selectable`     — both booleans.
 *   - `lockRotation`   — both booleans.
 *
 * Some random values may coincide with the bake-in style by chance
 * (e.g. `opacity === 1`, `selectable === false`); the property
 * statement does not exclude those — restoration to the same value is
 * still correct restoration — so the arbitrary does not filter them
 * out.
 */
const maskStyleArb = fc.record({
    opacity: fc.double({
        min: 0,
        max: 1,
        noNaN: true,
        noDefaultInfinity: true,
    }),
    fill: colorOrNullArb,
    stroke: colorOrNullArb,
    strokeWidth: fc.double({
        min: 0,
        max: 50,
        noNaN: true,
        noDefaultInfinity: true,
    }),
    selectable: fc.boolean(),
    lockRotation: fc.boolean(),
});

/** Between 0 and 5 masks per export call — covers the empty-list and
 *  multi-mask branches of the bake-in loop. */
const maskListArb = fc
    .array(maskStyleArb, { minLength: 0, maxLength: 5 })
    .map((styles) => styles.map((style, idx) => makeMockMask({ maskId: idx + 1, ...style })));

// ─── — successful export restores live styles ─────────────────

test("after a successful exportImageBase64({exportArea:'image', mergeMasks:true}), every mask style equals the pre-export value", async () => {
    await fc.assert(
        fc.asyncProperty(maskListArb, async (masks) => {
            const pre = snapshotMaskStyles(masks);

            // Capture the mask state Fabric would actually render so we
            // can prove the bake-in mutator DID run (otherwise the
            // post-restore equality would be vacuously satisfied —
            // restore would have nothing to restore from).
            const renderTimeStyles = [];
            const canvas = makeMockCanvas(masks, {
                onRender: () => {
                    renderTimeStyles.push(snapshotMaskStyles(masks));
                },
            });
            const ctx = makeContext(canvas, makeFakeImage());

            await exportImageBase64(ctx, {
                exportArea: 'image',
                mergeMasks: true,
                fileType: 'png',
            });

            // Sanity — `toDataURL` ran exactly once.
            assert.equal(
                renderTimeStyles.length,
                1,
                `expected exactly one render, got ${renderTimeStyles.length}`,
            );

            // Bake-in actually mutated each mask while toDataURL ran,
            // proving the capture preceded the mutation.
            for (const style of renderTimeStyles[0]) {
                assert.equal(
                    style.opacity,
                    1,
                    `bake-in must force opacity=1 during render, got ${style.opacity}`,
                );
                assert.equal(
                    style.fill,
                    '#000',
                    `bake-in must force fill='#000' during render, got ${String(style.fill)}`,
                );
                assert.equal(
                    style.strokeWidth,
                    0,
                    `bake-in must force strokeWidth=0 during render, got ${style.strokeWidth}`,
                );
                assert.equal(
                    style.stroke,
                    null,
                    `bake-in must force stroke=null during render, got ${String(style.stroke)}`,
                );
                assert.equal(
                    style.selectable,
                    false,
                    `bake-in must force selectable=false during render, got ${style.selectable}`,
                );
            }

            // the documented contract — every restored field is strict-equal to the
            // pre-export value, no defaulting or clamping.
            const post = snapshotMaskStyles(masks);
            assert.deepStrictEqual(
                post,
                pre,
                `mask styles must match pre-export values after a successful export\npre:  ${JSON.stringify(pre)}\npost: ${JSON.stringify(post)}`,
            );

            return true;
        }),
        { numRuns: 200 },
    );
});

// ─── — thrown export still restores live styles ──────────────

test('when canvas.toDataURL throws, exportImageBase64 still restores every mask style to the pre-export value', async () => {
    await fc.assert(
        fc.asyncProperty(maskListArb, async (masks) => {
            const pre = snapshotMaskStyles(masks);

            const renderTimeStyles = [];
            const canvas = makeMockCanvas(masks, {
                onRender: () => {
                    // Capture the mid-mutation state BEFORE the throw
                    // so we can prove the bake-in mutator ran (and the
                    // restore therefore had real work to do).
                    renderTimeStyles.push(snapshotMaskStyles(masks));
                },
                throwOnRender: true,
            });
            const ctx = makeContext(canvas, makeFakeImage());

            // The export must reject — the inner render step threw and
            // withMaskExportState propagates failures after the finally
            // restore has run.
            const rejection = await exportImageBase64(ctx, {
                exportArea: 'image',
                mergeMasks: true,
            }).then(
                (value) => ({ kind: 'resolved', value }),
                (error) => ({ kind: 'rejected', error }),
            );

            assert.equal(
                rejection.kind,
                'rejected',
                `export must reject when toDataURL throws; got ${rejection.kind}`,
            );
            assert.equal(
                String(rejection.error?.message ?? rejection.error),
                'forced toDataURL failure',
                'rejection must propagate the original error',
            );

            // Bake-in mutated masks BEFORE the throw — only meaningful
            // when there were masks to mutate; the empty-list branch
            // skips this assertion.
            if (masks.length > 0) {
                assert.equal(
                    renderTimeStyles.length,
                    1,
                    `expected exactly one render attempt, got ${renderTimeStyles.length}`,
                );
                for (const style of renderTimeStyles[0]) {
                    assert.equal(
                        style.opacity,
                        1,
                        'bake-in must have applied opacity=1 before the throw',
                    );
                    assert.equal(
                        style.fill,
                        '#000',
                        'bake-in must have applied fill="#000" before the throw',
                    );
                    assert.equal(
                        style.strokeWidth,
                        0,
                        'bake-in must have applied strokeWidth=0 before the throw',
                    );
                    assert.equal(
                        style.stroke,
                        null,
                        'bake-in must have applied stroke=null before the throw',
                    );
                    assert.equal(
                        style.selectable,
                        false,
                        'bake-in must have applied selectable=false before the throw',
                    );
                }
            }

            // the documented contract — the restore lives inside a finally so the
            // live styles match the pre-export values whether the
            // export resolved or threw.
            // the documented contract — the restored values are strict-equal to the
            // captured values, no defaulting or clamping.
            const post = snapshotMaskStyles(masks);
            assert.deepStrictEqual(
                post,
                pre,
                `mask styles must match pre-export values even after a thrown export\npre:  ${JSON.stringify(pre)}\npost: ${JSON.stringify(post)}`,
            );

            return true;
        }),
        { numRuns: 200 },
    );
});
