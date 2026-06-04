/**
 * @file post-crop-mask-preservation.property.test.mjs
 *
 * Type:
 *   Property test
 *
 * Purpose:
 *   Verifies src/crop/crop-controller.ts mask preservation when
 *   crop.preserveMasksAfterCrop is enabled. The suite checks mask survival, drop
 *   behavior, coordinate translation, and transform-field preservation across cropped
 *   coordinate frames.
 *
 * Scope:
 *   - Masks intersecting the integer crop region survive and shift by the crop
 *     offset.
 *   - Masks fully outside the crop region are not re-added after crop.
 *   - angle, scaleX, and scaleY are preserved for surviving masks, including
 *     rotated-image scenarios.
 *
 * Out of scope:
 *   - visual rendering quality
 *   - browser-specific pointer interaction details
 *   - unrelated mask and export features
 *
 * Environment:
 *   - Node.js ESM
 *   - fast-check generated cases where applicable
 *   - Fabric/canvas behavior is mocked where needed
 *
 * Run:
 *   node --test tests/post-crop-mask-preservation.property.test.mjs
 *
 * Notes:
 *   - Prefer behavior-level assertions over implementation-detail checks.
 *   - Keep this file focused on post-crop mask preservation under image transforms
 *     only.
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

const { enterCropMode, applyCrop } = await import('../src/crop/crop-controller.ts');
const { resolveOptions } = await import('../src/core/default-options.ts');
const { HistoryManager } = await import('../src/history/history-manager.ts');
const { floorRegion, clampRegionToCanvas } = await import('../src/utils/canvas-region.ts');
const { attachMaskHoverHandlers } = await import('../src/mask/mask-style.ts');

// ─── Test doubles ───────────────────────────────────────────────────────────

/**
 * Stand-in for a Fabric.js `Rect`. The crop controller binds three
 * handlers (`modified` / `moving` / `scaling`) on the rect and detaches
 * them when the session ends.
 *
 * The shape carries `set` (used for scale clamps), `setCoords`, and
 * `getBoundingRect` (read by `applyCrop` to derive the integer crop
 * region from the rect's `left`/`top`/`width`/`height` × scale).
 */
class MockCropRect {
    constructor(props) {
        Object.assign(this, props);
        this._handlers = [];
    }
    set(patch) {
        Object.assign(this, patch);
        return this;
    }
    setCoords() {}
    setControlVisible() {}
    on(event, fn) {
        this._handlers.push({ event, fn, detached: false });
    }
    off(event, fn) {
        for (const rec of this._handlers) {
            if (!rec.detached && rec.event === event && rec.fn === fn) {
                rec.detached = true;
            }
        }
    }
    getBoundingRect() {
        return {
            left: this.left,
            top: this.top,
            width: this.width * (this.scaleX ?? 1),
            height: this.height * (this.scaleY ?? 1),
        };
    }
}

/**
 * Stand-in for `fabric.Canvas`. Tracks the live object list and the
 * `selection` flag the controller reads/writes on the freeze path.
 *
 * Implements every method the crop controller calls during
 * `enterCropMode`, the `capturePreservedMasks` pre-export pass, the
 * `restoreCropObjectState` / `removeCropRect` teardown, the
 * `canvas.toDataURL` export, and the `reapplyPreservedMasks` post-load
 * pass.
 *
 * `clear()` is exposed so the scripted `ctx.loadImage` (below) can
 * mirror the real loader's pre-decode `canvas.clear()` call — every
 * canvas object that was still on the canvas at the moment
 * `ctx.loadImage` ran is dropped, so `reapplyPreservedMasks` lands the
 * preserved masks onto an empty post-crop canvas. This matches the
 * production loader's behaviour without requiring the test to spin up
 * a real `image-loader.ts` pipeline.
 */
class MockCanvas {
    constructor({ width = 800, height = 600 } = {}) {
        this._width = width;
        this._height = height;
        this._objects = [];
        this._selection = true;
    }

    get selection() {
        return this._selection;
    }
    set selection(v) {
        this._selection = v;
    }

    discardActiveObject() {
        return this;
    }
    getObjects() {
        return [...this._objects];
    }
    add(obj) {
        this._objects.push(obj);
    }
    remove(obj) {
        const i = this._objects.indexOf(obj);
        if (i >= 0) this._objects.splice(i, 1);
    }
    bringObjectToFront(obj) {
        const i = this._objects.indexOf(obj);
        if (i >= 0) {
            this._objects.splice(i, 1);
            this._objects.push(obj);
        }
    }
    setActiveObject() {
        return this;
    }
    getWidth() {
        return this._width;
    }
    getHeight() {
        return this._height;
    }
    renderAll() {}
    requestRenderAll() {}
    toDataURL() {
        return 'data:image/jpeg;base64,STUB';
    }
    clear() {
        this._objects = [];
    }
}

/**
 * Build a stand-in for the committed Fabric `originalImage`. * must exercise the rotation-invariance clause of the documented contract, so
 * the bounding rect is parameterised by the supplied `imageAngle`. The
 * controller does not consult `image.angle` directly — it reads the
 * absolute bounding rect via {@link MockCropRect.getBoundingRect}-style
 * surface — but the property frames the image as though it had been
 * rotated by `imageAngle`. The bounding rect dimensions are made
 * angle-dependent so two different angles produce two different
 * bounding rects, ensuring the test really iterates the rotation space
 * rather than producing a constant output across angles.
 *
 * The bounding rect always lives at `(left, top)` inside the canvas so
 * the `enterCropMode` initial-rect math (which insets the rect by
 * `padding` from the bbox) lands inside the canvas.
 */
function makeOriginalImage({ imageAngle, bboxLeft, bboxTop, bboxW, bboxH }) {
    return {
        angle: imageAngle,
        setCoords() {},
        getBoundingRect() {
            return {
                left: bboxLeft,
                top: bboxTop,
                width: bboxW,
                height: bboxH,
            };
        },
    };
}

/**
 * Build a structural mask that satisfies `isMaskObject` (carries a
 * numeric `maskId`) and exposes the live surface
 * {@link applyCrop}'s `capturePreservedMasks` and `reapplyPreservedMasks`
 * touch:
 *
 *   - `set(patch)` mutates the mask's properties (used to translate
 *     `left` / `top` and to re-assert `angle` / `scaleX` / `scaleY` /
 *     `visible` on the reapply pass).
 *   - `setCoords()` mirrors Fabric.js v7's coordinate-cache refresh
 *     called before reading the bounding rect.
 *   - `getBoundingRect()` returns the mask's axis-aligned bbox in
 *     canvas-pixel coordinates so the controller's intersection filter
 *     (`maskIntersectsRegion`) can decide whether the mask survives.
 *   - `on(event, fn)` is required by `attachMaskHoverHandlers`, which
 *     the reapply pass calls on every preserved mask.
 *
 * The bbox is computed from the supplied `(left, top, width, height,
 * angle)` — we ignore `angle` for the bbox since axis-aligned bbox
 * suffices for the intersection filter, mirroring the way 's
 * stub fixture in `crop-transitions.property.test.mjs` handles bbox
 * math. The point of carrying `angle` here is to feed it through the
 * preserve / restore round trip so the documented contract can be asserted
 * verbatim on the post-crop value.
 */
function makeMockMask({
    maskId,
    left,
    top,
    width,
    height,
    angle,
    scaleX,
    scaleY,
    opacity = 0.5,
    fill = 'rgba(0,0,0,0.5)',
    stroke = '#ccc',
    strokeWidth = 1,
    selectable = true,
    evented = true,
    lockRotation = false,
}) {
    const mask = {
        type: 'rect',
        maskId,
        maskName: `mask${maskId}`,
        originalAlpha: opacity,
        originalStroke: stroke,
        originalStrokeWidth: strokeWidth,
        // Live transform fields — the captured pre-crop snapshot reads
        // these and the post-crop reapply mutates them.
        left,
        top,
        width,
        height,
        angle,
        scaleX,
        scaleY,
        opacity,
        fill,
        stroke,
        strokeWidth,
        selectable,
        evented,
        lockRotation,
        visible: true,
        __listeners: {},
        // The axis-aligned bounding rect uses the scaled dimensions.
        // We deliberately ignore `angle` here because the legacy
        // `intersectsCrop` filter operates on axis-aligned bboxes,
        // matching `getObjectBBox` in `utils/canvas-region.ts`.
        getBoundingRect() {
            return {
                left: this.left,
                top: this.top,
                width: this.width * this.scaleX,
                height: this.height * this.scaleY,
            };
        },
        setCoords() {},
        set(patch) {
            Object.assign(this, patch);
            return this;
        },
        on(event, handler) {
            (this.__listeners[event] ??= []).push(handler);
        },
        off(event, handler) {
            const handlers = this.__listeners[event] ?? [];
            this.__listeners[event] = handlers.filter((candidate) => candidate !== handler);
        },
    };
    return mask;
}

/**
 * Build a fully-wired `CropControllerContext` plus the observability
 * hooks needs:
 *
 *   - The mock canvas seeded with the supplied masks (in canvas object
 *     order) — ordering does not affect directly but makes
 *     the failing-iteration trace more readable.
 *   - A real `HistoryManager` so the controller's atomicity invariants
 * are honoured and `applyCrop` settles cleanly.
 *   - A scripted `loadImage` that mirrors the production loader's
 *     `canvas.clear()` step. After `clear()`, the captured preserved
 *     masks are re-added by `reapplyPreservedMasks`.
 *   - `sessionRef` exposing the live session pointer.
 *
 * The crop padding / minWidth / minHeight are pinned so the
 * `enterCropMode` initial rect lands fully inside the supplied image
 * bounding rect with positive dimensions, regardless of the property's
 * fast-check inputs.
 */
function makeContext({
    masks,
    imageAngle,
    bboxLeft,
    bboxTop,
    bboxW,
    bboxH,
    canvasWidth = 800,
    canvasHeight = 600,
    preserveMasksAfterCrop = true,
    hideMasksDuringCrop = false,
}) {
    const canvas = new MockCanvas({ width: canvasWidth, height: canvasHeight });
    for (const mask of masks) canvas._objects.push(mask);

    const originalImage = makeOriginalImage({
        imageAngle,
        bboxLeft,
        bboxTop,
        bboxW,
        bboxH,
    });
    const historyManager = new HistoryManager(50);

    const saveStateCalls = [];
    let snapshotCounter = 0;
    const saveState = () => {
        snapshotCounter += 1;
        const snap = `snap:${snapshotCounter}`;
        saveStateCalls.push(snap);
        return snap;
    };
    const loadFromState = async () => {};

    // The scripted loader mirrors the production loader's
    // pre-decode `canvas.clear()` so the post-crop canvas starts empty
    // before `reapplyPreservedMasks` re-adds the captured records.
    // Without this step the preserved masks would land on top of the
    // pre-crop residue and 's intersection / transform
    // assertions would be polluted by stale pre-crop objects.
    const loadImage = async () => {
        canvas.clear();
    };

    const sessionRef = { current: null };
    const fabric = { Rect: MockCropRect };

    const options = resolveOptions({
        crop: {
            // Use a generous minWidth/minHeight so the initial rect can
            // be overridden by the test to a wide variety of crop
            // regions without the clamp logic in the modified-handler
            // forcing a different size.
            minWidth: 10,
            minHeight: 10,
            padding: 5,
            hideMasksDuringCrop,
            preserveMasksAfterCrop,
            allowRotationOfCropRect: false,
        },
        downsampleQuality: 0.92,
    });

    const ctx = {
        fabric,
        canvas,
        options,
        historyManager,
        isImageLoaded: () => true,
        getOriginalImage: () => originalImage,
        getCropSession: () => sessionRef.current,
        setCropSession: (s) => {
            sessionRef.current = s;
        },
        saveState,
        loadFromState,
        loadImage,
    };

    return { ctx, canvas, sessionRef, historyManager, saveStateCalls };
}

// ─── Geometry helpers ───────────────────────────────────────────────────────

/**
 * Compute the integer crop region the controller would derive from the
 * supplied `MockCropRect`-style bounds and a `canvasWidth × canvasHeight`
 * canvas. Uses the same `floorRegion` + `clampRegionToCanvas` chain the
 * controller uses so the test never drifts from the implementation's
 * geometry policy.
 */
function deriveCropRegion(rectBounds, canvasWidth, canvasHeight) {
    return clampRegionToCanvas(floorRegion(rectBounds), canvasWidth, canvasHeight);
}

/**
 * Mirror of the controller's intersection filter
 * (`maskIntersectsRegion`). Returns `true` when the mask's axis-aligned
 * bbox overlaps the integer crop region. Two-sided strict inequality on
 * each axis matches legacy's `intersectsCrop` semantics: a mask whose
 * bbox just touches the crop edge is NOT preserved (zero overlap).
 */
function bboxesIntersect(maskBBox, cropRegion) {
    return (
        maskBBox.left < cropRegion.left + cropRegion.width &&
        maskBBox.left + maskBBox.width > cropRegion.left &&
        maskBBox.top < cropRegion.top + cropRegion.height &&
        maskBBox.top + maskBBox.height > cropRegion.top
    );
}

/**
 * Snapshot the live transform of `mask` so the test can compare the
 * post-crop values against the true pre-crop values rather than against
 * the controller's mid-flight mutations.
 */
function snapshotMaskTransform(mask) {
    return {
        left: mask.left,
        top: mask.top,
        width: mask.width,
        height: mask.height,
        angle: mask.angle,
        scaleX: mask.scaleX,
        scaleY: mask.scaleY,
        // Pre-computed bbox makes the intersection / drop assertions
        // independent of any post-snapshot mutation in `set(...)`.
        bbox: {
            left: mask.left,
            top: mask.top,
            width: mask.width * mask.scaleX,
            height: mask.height * mask.scaleY,
        },
    };
}

function setCropRectBounds(session, cropBounds) {
    session.cropRect.set({
        left: cropBounds.left,
        top: cropBounds.top,
        width: cropBounds.width,
        height: cropBounds.height,
        scaleX: 1,
        scaleY: 1,
    });
}

// ─── Arbitraries ────────────────────────────────────────────────────────────

/**
 * Image rotation angle in degrees. Spans negative, zero, multi-turn,
 * and the full 360° range so the documented contract's "regardless of image
 * rotation" wording is exercised. The controller's mechanical
 * translation (`mask.left -= cropRegion.left`,
 * `mask.top -= cropRegion.top`) is independent of angle, so every
 * iteration must produce the same offset.
 */
const imageAngleArb = fc.oneof(
    fc.constantFrom(0, 90, 180, 270, 45, -45, 30, 60, 359, -359),
    fc.double({ min: -720, max: 720, noNaN: true }),
);

/**
 * Image bounding rect. The bbox is sized so the
 * `enterCropMode` initial-rect math (which insets by `padding`) lands
 * inside the canvas with positive dimensions for any padding ≤ 5 (the
 * resolved option).
 *
 * `(left, top)` is the canvas-pixel coordinate of the bbox top-left.
 * Both coordinates are non-negative so the test does not trip the
 * `Math.max(0, ...)` clamp inside the controller's
 * `enterCropMode` rect placement.
 */
const imageBBoxArb = fc.record({
    bboxLeft: fc.integer({ min: 0, max: 100 }),
    bboxTop: fc.integer({ min: 0, max: 100 }),
    bboxW: fc.integer({ min: 200, max: 600 }),
    bboxH: fc.integer({ min: 200, max: 400 }),
});

/**
 * One mask's pre-crop transform. The fields drive the `(left, top)`
 * snapshot
 * and the `angle` / `scaleX` / `scaleY` round trip.
 *
 * - `left` / `top` ∈ `[0, 800]` × `[0, 600]` — well inside the
 *   canvas bounds so the intersection filter has a meaningful
 *   chance of either including or excluding each mask.
 * - `width` / `height` ∈ `[10, 100]` — large enough that a 1-pixel
 *   floor in the crop region cannot accidentally exclude a mask that
 *   the test expects to be preserved.
 * - `angle` ∈ `[-360, 360]` — covers negative, zero, and multi-turn
 *   inputs so the post-crop assertion `mask.angle === pre.angle`
 *   exercises the full angle space.
 * - `scaleX` / `scaleY` ∈ `[0.25, 4]` — covers zoom-in / zoom-out
 *   inputs the user might apply to a mask.
 */
const maskTransformArb = fc.record({
    left: fc.integer({ min: 0, max: 800 }),
    top: fc.integer({ min: 0, max: 600 }),
    width: fc.integer({ min: 10, max: 100 }),
    height: fc.integer({ min: 10, max: 100 }),
    angle: fc.double({ min: -360, max: 360, noNaN: true }),
    scaleX: fc.double({ min: 0.25, max: 4, noNaN: true }),
    scaleY: fc.double({ min: 0.25, max: 4, noNaN: true }),
});

/**
 * A small set of masks (1..6) with sequential `maskId` so
 * `isMaskObject` matches every entry. Each mask carries a different
 * pre-crop transform sampled from {@link maskTransformArb}. Cardinality
 * is bounded so each property iteration runs in single-digit
 * milliseconds.
 */
const maskSetArb = fc
    .array(maskTransformArb, { minLength: 1, maxLength: 6 })
    .map((transforms) => transforms.map((t, i) => makeMockMask({ ...t, maskId: i + 1 })));

/**
 * Override values for the cropRect bounds the controller reads in
 * `applyCrop`. The test sets these on the live `session.cropRect`
 * AFTER `enterCropMode` runs, so the resulting cropRegion is governed
 * by the test inputs rather than by `enterCropMode`'s default placement
 * (which would always produce the same rect for the same image bbox).
 *
 * Bounds are constrained to the canvas so `clampRegionToCanvas` does
 * not silently shrink the region; `width` and `height` are positive.
 */
const cropBoundsArb = fc.record({
    left: fc.integer({ min: 0, max: 700 }),
    top: fc.integer({ min: 0, max: 500 }),
    width: fc.integer({ min: 50, max: 500 }),
    height: fc.integer({ min: 50, max: 400 }),
});

// ─── Properties ─────────────────────────────────────────────────────────────

test("applyCrop with preserveMasksAfterCrop=true shifts each surviving mask's left/top by -cropRegion.left/-cropRegion.top while preserving angle, scaleX, scaleY verbatim, regardless of image rotation", async () => {
    await fc.assert(
        fc.asyncProperty(
            maskSetArb,
            imageAngleArb,
            imageBBoxArb,
            cropBoundsArb,
            async (masks, imageAngle, imageBBox, cropBounds) => {
                const { ctx, canvas, sessionRef } = makeContext({
                    masks,
                    imageAngle,
                    bboxLeft: imageBBox.bboxLeft,
                    bboxTop: imageBBox.bboxTop,
                    bboxW: imageBBox.bboxW,
                    bboxH: imageBBox.bboxH,
                    preserveMasksAfterCrop: true,
                });

                // Snapshot every mask's pre-crop transform BEFORE the
                // controller mutates anything. The post-crop assertion
                // compares against this snapshot so a missed
                // pre-mutation read in the controller would surface as
                // a property failure.
                const preTransforms = masks.map(snapshotMaskTransform);

                // Open the session — `enterCropMode` adds a default
                // crop rect inside the image bbox. The next step
                // overrides its bounds so the property's cropRegion
                // matches the test inputs rather than
                // `enterCropMode`'s deterministic placement.
                enterCropMode(ctx);
                const session = sessionRef.current;
                assert.notEqual(
                    session,
                    null,
                    'enterCropMode must open a session for the apply path',
                );

                // Drive the cropRect to the bounds the property
                // requested. `set(...)` resets `scaleX` / `scaleY` to 1
                // so `getBoundingRect` returns `width × height`
                // directly — matches the controller's read shape.
                session.cropRect.set({
                    left: cropBounds.left,
                    top: cropBounds.top,
                    width: cropBounds.width,
                    height: cropBounds.height,
                    scaleX: 1,
                    scaleY: 1,
                });

                // Compute the cropRegion the controller will derive.
                // Using the same `floorRegion` + `clampRegionToCanvas`
                // helpers the controller calls keeps the test's
                // expected offsets faithful to the implementation's
                // geometry policy.
                const cropRegion = deriveCropRegion(
                    {
                        left: cropBounds.left,
                        top: cropBounds.top,
                        width: cropBounds.width,
                        height: cropBounds.height,
                    },
                    canvas.getWidth(),
                    canvas.getHeight(),
                );

                await applyCrop(ctx);

                // Partition pre-crop masks by whether their bbox
                // intersects the cropRegion. The intersecting set must
                // survive on the post-crop canvas; the disjoint set
                // must NOT.
                const surviving = canvas.getObjects();
                for (let i = 0; i < masks.length; i++) {
                    const mask = masks[i];
                    const pre = preTransforms[i];
                    const intersects = bboxesIntersect(pre.bbox, cropRegion);

                    if (!intersects) {
                        // 28.B — handled in the dedicated property
                        // below. Skip non-intersecting masks here so
                        // the post-crop transform assertions only fire
                        // on masks that should have been preserved.
                        continue;
                    }

                    // 31.4 — the surviving mask is on the post-crop
                    // canvas. The reapply pass re-adds the captured
                    // mask reference verbatim (`canvas.add(record.mask)`),
                    // so identity equality is the right comparison.
                    assert.ok(
                        surviving.includes(mask),
                        `the documented contract: mask[${i}] (maskId=${mask.maskId}) intersects cropRegion={left:${cropRegion.left},top:${cropRegion.top},w:${cropRegion.width},h:${cropRegion.height}} and MUST survive on the post-crop canvas`,
                    );

                    // 31.4, 32.1 — `left` / `top` shifted by
                    // `-cropRegion.left, -cropRegion.top`. The shift
                    // is angle-independent: the property iterates
                    // `imageAngle` across a wide range and asserts the
                    // same offsets for every angle.
                    assert.equal(
                        mask.left,
                        pre.left - cropRegion.left,
                        `the documented contract: mask[${i}].left must equal pre.left (${pre.left}) - cropRegion.left (${cropRegion.left}); got ${mask.left} at imageAngle=${imageAngle}`,
                    );
                    assert.equal(
                        mask.top,
                        pre.top - cropRegion.top,
                        `the documented contract: mask[${i}].top must equal pre.top (${pre.top}) - cropRegion.top (${cropRegion.top}); got ${mask.top} at imageAngle=${imageAngle}`,
                    );

                    // 32.2 — angle, scaleX, scaleY preserved verbatim
                    // so the visible mask shape does not change size
                    // or orientation. `Object.is` matches NaN to NaN
                    // and distinguishes `+0` / `-0`; the arbitraries
                    // never produce NaN (`noNaN: true`) so a strict
                    // equality is sufficient here.
                    assert.equal(
                        mask.angle,
                        pre.angle,
                        `the documented contract: mask[${i}].angle must be preserved verbatim; pre=${pre.angle}, post=${mask.angle}`,
                    );
                    assert.equal(
                        mask.scaleX,
                        pre.scaleX,
                        `the documented contract: mask[${i}].scaleX must be preserved verbatim; pre=${pre.scaleX}, post=${mask.scaleX}`,
                    );
                    assert.equal(
                        mask.scaleY,
                        pre.scaleY,
                        `the documented contract: mask[${i}].scaleY must be preserved verbatim; pre=${pre.scaleY}, post=${mask.scaleY}`,
                    );
                }

                return true;
            },
        ),
        { numRuns: 100 },
    );
});

test('applyCrop with preserveMasksAfterCrop=true drops every mask whose pre-crop bbox lies fully outside the integer crop region', async () => {
    await fc.assert(
        fc.asyncProperty(
            maskSetArb,
            imageAngleArb,
            imageBBoxArb,
            cropBoundsArb,
            async (masks, imageAngle, imageBBox, cropBounds) => {
                const { ctx, canvas, sessionRef } = makeContext({
                    masks,
                    imageAngle,
                    bboxLeft: imageBBox.bboxLeft,
                    bboxTop: imageBBox.bboxTop,
                    bboxW: imageBBox.bboxW,
                    bboxH: imageBBox.bboxH,
                    preserveMasksAfterCrop: true,
                });

                const preTransforms = masks.map(snapshotMaskTransform);

                enterCropMode(ctx);
                const session = sessionRef.current;
                assert.notEqual(
                    session,
                    null,
                    'enterCropMode must open a session for the apply path',
                );

                session.cropRect.set({
                    left: cropBounds.left,
                    top: cropBounds.top,
                    width: cropBounds.width,
                    height: cropBounds.height,
                    scaleX: 1,
                    scaleY: 1,
                });

                const cropRegion = deriveCropRegion(
                    {
                        left: cropBounds.left,
                        top: cropBounds.top,
                        width: cropBounds.width,
                        height: cropBounds.height,
                    },
                    canvas.getWidth(),
                    canvas.getHeight(),
                );

                await applyCrop(ctx);

                const surviving = canvas.getObjects();
                for (let i = 0; i < masks.length; i++) {
                    const mask = masks[i];
                    const pre = preTransforms[i];
                    const intersects = bboxesIntersect(pre.bbox, cropRegion);

                    if (intersects) {
                        // Surviving masks are covered by .
                        continue;
                    }

                    // the documented contract (intersection filter) — masks fully
                    // outside the cropRegion must be removed from the
                    // post-crop canvas. The reapply pass only re-adds
                    // records produced by `capturePreservedMasks`, and
                    // that helper only emits a record when the mask
                    // intersects the cropRegion.
                    assert.ok(
                        !surviving.includes(mask),
                        `the documented contract (intersection filter): mask[${i}] (maskId=${mask.maskId}) lies fully outside cropRegion={left:${cropRegion.left},top:${cropRegion.top},w:${cropRegion.width},h:${cropRegion.height}} and MUST NOT appear on the post-crop canvas`,
                    );
                }

                return true;
            },
        ),
        { numRuns: 100 },
    );
});

test('applyCrop with preserveMasksAfterCrop=true restores styles hidden by hideMasksDuringCrop', async () => {
    const mask = makeMockMask({
        maskId: 1,
        left: 40,
        top: 50,
        width: 30,
        height: 20,
        angle: 15,
        scaleX: 1.2,
        scaleY: 0.8,
        opacity: 0.65,
        fill: 'rgba(10,20,30,0.4)',
        stroke: '#123456',
        strokeWidth: 4,
        selectable: true,
        evented: true,
        lockRotation: true,
    });
    const { ctx, canvas, sessionRef } = makeContext({
        masks: [mask],
        imageAngle: 0,
        bboxLeft: 0,
        bboxTop: 0,
        bboxW: 300,
        bboxH: 200,
        preserveMasksAfterCrop: true,
        hideMasksDuringCrop: true,
    });

    enterCropMode(ctx);
    const session = sessionRef.current;
    assert.notEqual(session, null);
    assert.equal(mask.opacity, 0, 'sanity: crop mode hides the mask before apply');
    assert.equal(mask.evented, false, 'sanity: crop mode disables mask events before apply');

    setCropRectBounds(session, { left: 10, top: 20, width: 120, height: 120 });

    await applyCrop(ctx);

    assert.ok(canvas.getObjects().includes(mask), 'intersecting mask must be re-added');
    assert.equal(mask.left, 30);
    assert.equal(mask.top, 30);
    assert.equal(mask.opacity, 0.65);
    assert.equal(mask.fill, 'rgba(10,20,30,0.4)');
    assert.equal(mask.stroke, '#123456');
    assert.equal(mask.strokeWidth, 4);
    assert.equal(mask.selectable, true);
    assert.equal(mask.evented, true);
    assert.equal(mask.lockRotation, true);
    assert.equal(mask.visible, true);
});

test('applyCrop with preserveMasksAfterCrop=true does not duplicate mask hover handlers across repeated crops', async () => {
    const mask = makeMockMask({
        maskId: 1,
        left: 40,
        top: 50,
        width: 30,
        height: 20,
        angle: 0,
        scaleX: 1,
        scaleY: 1,
    });
    attachMaskHoverHandlers(mask);

    const { ctx, sessionRef } = makeContext({
        masks: [mask],
        imageAngle: 0,
        bboxLeft: 0,
        bboxTop: 0,
        bboxW: 300,
        bboxH: 200,
        preserveMasksAfterCrop: true,
    });

    for (const cropBounds of [
        { left: 10, top: 20, width: 120, height: 120 },
        { left: 0, top: 0, width: 200, height: 200 },
    ]) {
        enterCropMode(ctx);
        const session = sessionRef.current;
        assert.notEqual(session, null);
        setCropRectBounds(session, cropBounds);
        await applyCrop(ctx);
    }

    assert.equal(mask.__listeners.mouseover.length, 1);
    assert.equal(mask.__listeners.mouseout.length, 1);
    assert.ok(mask.__imageEditorMaskHandlers, 'hover handler tag must remain valid');
});

test('applyCrop rejects an empty crop region instead of exporting a silent 1x1 image', async () => {
    const { ctx, sessionRef } = makeContext({
        masks: [],
        imageAngle: 0,
        bboxLeft: 0,
        bboxTop: 0,
        bboxW: 300,
        bboxH: 200,
        preserveMasksAfterCrop: true,
    });

    enterCropMode(ctx);
    const session = sessionRef.current;
    assert.notEqual(session, null);
    setCropRectBounds(session, { left: 900, top: 900, width: 20, height: 20 });

    await assert.rejects(() => applyCrop(ctx), /crop region is empty/);
    assert.equal(sessionRef.current, null, 'failed apply must close the torn-down session');
});
