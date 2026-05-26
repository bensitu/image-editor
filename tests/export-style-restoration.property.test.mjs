// Property 24: Export-only style restoration
//
// Property statement (design.md §"Property 24"):
//   For any export operation that temporarily mutates mask styles,
//   every mutated style SHALL be restored in a `finally` path after
//   both successful and failed exports.
//
// Owner modules: `src/export/export-service.ts`, `src/mask/mask-style.ts`.
//
// Sub-properties exercised here, mirroring the three acceptance criteria
// of Requirement 28:
//
//   24.1 Capture-before-mutation (Requirement 28.1):
//        For any pre-export mask style, the export bake-in SHALL
//        capture the live values of `opacity`, `fill`, `stroke`,
//        `strokeWidth`, `selectable`, and `lockRotation` BEFORE the
//        mutator forces the bake-in style. We verify this indirectly
//        by asserting that, after a successful export, every mask is
//        restored to the exact pre-export values (if the capture had
//        happened AFTER the mutator, restoration would produce the
//        bake-in style, not the originals).
//
//   24.2 Restore inside finally on a thrown export (Requirement 28.2):
//        For any pre-export mask style, when the inner render step
//        rejects, the live mask styles SHALL still be restored to the
//        exact pre-export values (the restore lives inside a
//        `finally`, not after the `try`).
//
//   24.3 Restored fields are exact, no defaulting/clamping
//        (Requirement 28.3):
//        For any pre-export mask style, every restored field SHALL be
//        `===` strict-equal to the pre-export value — the restore
//        does not coerce, normalize, or default.
//
// ─── Why a canvas mock instead of a live Fabric.Canvas ──────────────────────
//
// The export service interacts with the canvas through exactly three
// methods relevant to this property:
//
//   discardActiveObject()  — Req 23.2 call site, no-op in the mock
//   getObjects()           — read by the bake-in/restore bracket
//   toDataURL(options)     — the rendering step we sometimes force to throw
//
// Spinning up a real Fabric canvas would require jsdom plus async
// asset wiring without exercising any new branch inside the bake-in/
// restore bracket. Mirroring `tests/export-service.test.mjs` and
// `tests/direct-region-export.property.test.mjs`, this test drives a
// small mock canvas and a list of mock masks.
//
// Runtime note: Node 24+ strips TypeScript syntax natively. The
// shared `helpers/ts-resolve-hook.mjs` rewrites `.js`-suffixed
// runtime imports to sibling `.ts` files so this test imports
// `export-service.ts` directly via dynamic `import()` after the
// hook is registered.

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
function makeMockMask({
    maskId,
    opacity,
    fill,
    stroke,
    strokeWidth,
    selectable,
    lockRotation,
}) {
    return {
        maskId,
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
    return masks.map(mask => ({
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
 * to throw (to exercise the `finally` restore path of Req 28.2).
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
            return 'data:image/jpeg;base64,AAAA';
        },
    };
}

function makeContext(canvas, originalImage) {
    return {
        canvas,
        options: {
            defaultDownloadFileName: 'edited_image.jpg',
            downsampleQuality: 0.92,
            exportMultiplier: 1,
            exportImageAreaByDefault: true,
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
 * affect Property 24 — only the bake-in/restore bracket does — but
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
    fc
        .integer({ min: 0, max: 0xffffff })
        .map(n => `#${n.toString(16).padStart(6, '0')}`),
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
    .map(styles =>
        styles.map((style, idx) => makeMockMask({ maskId: idx + 1, ...style })),
    );

// ─── Property 24.1 — successful export restores live styles ─────────────────

test('Property 24.1: after a successful exportImageBase64({exportImageArea:true}), every mask style equals the pre-export value (Reqs 28.1, 28.3)', async () => {
    await fc.assert(
        fc.asyncProperty(maskListArb, async masks => {
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

            await exportImageBase64(ctx, { exportImageArea: true });

            // Sanity — `toDataURL` ran exactly once.
            assert.equal(
                renderTimeStyles.length,
                1,
                `expected exactly one render, got ${renderTimeStyles.length}`,
            );

            // Bake-in actually mutated each mask while toDataURL ran,
            // proving the capture preceded the mutation (Req 28.1).
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

            // Req 28.3 — every restored field is strict-equal to the
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

// ─── Property 24.2 — thrown export still restores live styles ──────────────

test('Property 24.2: when canvas.toDataURL throws, exportImageBase64 still restores every mask style to the pre-export value (Reqs 28.2, 28.3)', async () => {
    await fc.assert(
        fc.asyncProperty(maskListArb, async masks => {
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
            // bakeMasksForExport propagates failures after the finally
            // restore has run.
            const rejection = await exportImageBase64(ctx, {
                exportImageArea: true,
            }).then(
                value => ({ kind: 'resolved', value }),
                error => ({ kind: 'rejected', error }),
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

            // Req 28.2 — the restore lives inside a finally so the
            // live styles match the pre-export values whether the
            // export resolved or threw.
            // Req 28.3 — the restored values are strict-equal to the
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
