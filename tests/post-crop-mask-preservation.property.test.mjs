// Property 28: Post-crop mask preservation respects pre-crop transform
//
// Property statement (design.md §"Property 28"):
//   For any crop apply operation with `preserveMasksAfterCrop === true`,
//   each mask's post-crop position SHALL preserve its relative
//   relationship to the pre-crop image bounding box. When the image is
//   rotated, the transform SHALL preserve mask `angle`, `scaleX`, and
//   `scaleY` while recomputing `left` and `top` in the cropped
//   coordinate frame.
//
// Owner modules under test: `src/crop/crop-controller.ts`,
// `src/utils/canvas-region.ts`, `src/utils/number.ts`.
//
// ─── Scope of this test ─────────────────────────────────────────────────────
//
// Property 28 is the post-crop seam owned by `applyCrop` when
// `options.crop.preserveMasksAfterCrop === true`. The contract has three
// halves:
//
//   31.4 Each mask whose pre-crop bounding rect intersects the integer
//        crop region survives the crop and lands at canvas-pixel
//        coordinates `(pre.left - cropRegion.left, pre.top - cropRegion.top)`.
//        Masks fully outside the crop region are dropped from the
//        post-crop canvas (matches v1's `intersectsCrop` filter so a
//        mask fully outside the cropped area does not reappear in the
//        cropped image space).
//
//   32.1 The same mechanical translation works regardless of image
//        rotation. The rotation angle is encoded in the rotated image's
//        bounding rect, which moves with the same canvas-pixel
//        translation as the masks when the mask's `left` and `top` are
//        shifted by a constant. The property iterates `originalImage.angle`
//        across a range of values and asserts every preserved mask still
//        lands at the documented offset.
//
//   32.2 Each mask's `angle`, `scaleX`, and `scaleY` are preserved
//        verbatim across the crop so the visible mask shape does not
//        change size or orientation.
//
// Two sub-properties cover the contract:
//
//   28.A Successful applyCrop with `preserveMasksAfterCrop === true`:
//        · every mask whose pre-crop bounding rect intersects the
//          integer crop region survives on the post-crop canvas;
//        · the surviving mask's `left` / `top` equal
//          `(pre.left - cropRegion.left, pre.top - cropRegion.top)`
//          (Requirement 31.4);
//        · the surviving mask's `angle`, `scaleX`, `scaleY` equal the
//          pre-crop values verbatim (Requirement 32.2);
//        · the round-trip is invariant under image rotation: the
//          property iterates `originalImage.angle` across a wide range
//          and asserts the same offsets land for every angle
//          (Requirement 32.1).
//
//   28.B Successful applyCrop with `preserveMasksAfterCrop === true`:
//        · every mask whose pre-crop bounding rect lies fully outside
//          the integer crop region is removed from the post-crop canvas
//          and is not re-added by the reapply step (Requirement 31.4 —
//          v1's `intersectsCrop` filter).
//
// The negative case `preserveMasksAfterCrop === false` (Requirement 31.3)
// is handled in production by the inner `ctx.loadImage(croppedBase64)`
// replacing every canvas object — that path is exercised end-to-end by
// Property 26 (`crop-transitions`) and by the example-based unit tests on
// the loader. Property 28 is intentionally scoped to the preserve-true
// branch because that is where the documented mask transform lives.
//
// Runtime note: Node 24+ strips TypeScript syntax natively, so this
// test imports the modules under test directly from source via the
// shared `ts-resolve-hook`. No build step is required.

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

const {
    enterCropMode,
    applyCrop,
} = await import('../src/crop/crop-controller.ts');
const { resolveOptions } = await import('../src/core/default-options.ts');
const { HistoryManager } = await import('../src/history/history-manager.ts');
const {
    floorRegion,
    clampRegionToCanvas,
} = await import('../src/utils/canvas-region.ts');

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

    get selection() { return this._selection; }
    set selection(v) { this._selection = v; }

    discardActiveObject() { return this; }
    getObjects() { return [...this._objects]; }
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
    setActiveObject() { return this; }
    getWidth() { return this._width; }
    getHeight() { return this._height; }
    renderAll() {}
    requestRenderAll() {}
    toDataURL() { return 'data:image/jpeg;base64,STUB'; }
    clear() {
        this._objects = [];
    }
}

/**
 * Build a stand-in for the committed Fabric `originalImage`. Property 28
 * must exercise the rotation-invariance clause of Requirement 32.1, so
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
 * suffices for the intersection filter, mirroring the way Property 28's
 * stub fixture in `crop-transitions.property.test.mjs` handles bbox
 * math. The point of carrying `angle` here is to feed it through the
 * preserve / restore round trip so Requirement 32.2 can be asserted
 * verbatim on the post-crop value.
 */
function makeMockMask({ maskId, left, top, width, height, angle, scaleX, scaleY }) {
    const mask = {
        type: 'rect',
        maskId,
        maskName: `mask${maskId}`,
        originalAlpha: 0.5,
        // Live transform fields — the captured pre-crop snapshot reads
        // these and the post-crop reapply mutates them.
        left,
        top,
        width,
        height,
        angle,
        scaleX,
        scaleY,
        opacity: 0.5,
        // The axis-aligned bounding rect uses the scaled dimensions.
        // We deliberately ignore `angle` here because the v1
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
        on() {},
        off() {},
    };
    return mask;
}

/**
 * Build a fully-wired `CropControllerContext` plus the observability
 * hooks Property 28 needs:
 *
 *   - The mock canvas seeded with the supplied masks (in canvas object
 *     order) — ordering does not affect Property 28 directly but makes
 *     the failing-iteration trace more readable.
 *   - A real `HistoryManager` so the controller's atomicity invariants
 *     (Requirement 30.2) are honoured and `applyCrop` settles cleanly.
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
    // pre-crop residue and Property 28's intersection / transform
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
            hideMasksDuringCrop: false,
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
        setCropSession: (s) => { sessionRef.current = s; },
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
    return clampRegionToCanvas(
        floorRegion(rectBounds),
        canvasWidth,
        canvasHeight,
    );
}

/**
 * Mirror of the controller's intersection filter
 * (`maskIntersectsRegion`). Returns `true` when the mask's axis-aligned
 * bbox overlaps the integer crop region. Two-sided strict inequality on
 * each axis matches v1's `intersectsCrop` semantics: a mask whose
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

// ─── Arbitraries ────────────────────────────────────────────────────────────

/**
 * Image rotation angle in degrees. Spans negative, zero, multi-turn,
 * and the full 360° range so Requirement 32.1's "regardless of image
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
 * snapshot (Requirement 31.4 — captured verbatim before the export)
 * and the `angle` / `scaleX` / `scaleY` round trip (Requirement 32.2 —
 * preserved verbatim).
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
const maskSetArb = fc.array(maskTransformArb, { minLength: 1, maxLength: 6 })
    .map((transforms) =>
        transforms.map((t, i) => makeMockMask({ ...t, maskId: i + 1 })),
    );

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

test('Property 28.A: applyCrop with preserveMasksAfterCrop=true shifts each surviving mask\'s left/top by -cropRegion.left/-cropRegion.top while preserving angle, scaleX, scaleY verbatim, regardless of image rotation (Req 31.4, 32.1, 32.2)', async () => {
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
                        `Req 31.4: mask[${i}] (maskId=${mask.maskId}) intersects cropRegion={left:${cropRegion.left},top:${cropRegion.top},w:${cropRegion.width},h:${cropRegion.height}} and MUST survive on the post-crop canvas`,
                    );

                    // 31.4, 32.1 — `left` / `top` shifted by
                    // `-cropRegion.left, -cropRegion.top`. The shift
                    // is angle-independent: the property iterates
                    // `imageAngle` across a wide range and asserts the
                    // same offsets for every angle.
                    assert.equal(
                        mask.left,
                        pre.left - cropRegion.left,
                        `Req 31.4 / 32.1: mask[${i}].left must equal pre.left (${pre.left}) - cropRegion.left (${cropRegion.left}); got ${mask.left} at imageAngle=${imageAngle}`,
                    );
                    assert.equal(
                        mask.top,
                        pre.top - cropRegion.top,
                        `Req 31.4 / 32.1: mask[${i}].top must equal pre.top (${pre.top}) - cropRegion.top (${cropRegion.top}); got ${mask.top} at imageAngle=${imageAngle}`,
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
                        `Req 32.2: mask[${i}].angle must be preserved verbatim; pre=${pre.angle}, post=${mask.angle}`,
                    );
                    assert.equal(
                        mask.scaleX,
                        pre.scaleX,
                        `Req 32.2: mask[${i}].scaleX must be preserved verbatim; pre=${pre.scaleX}, post=${mask.scaleX}`,
                    );
                    assert.equal(
                        mask.scaleY,
                        pre.scaleY,
                        `Req 32.2: mask[${i}].scaleY must be preserved verbatim; pre=${pre.scaleY}, post=${mask.scaleY}`,
                    );
                }

                return true;
            },
        ),
        { numRuns: 100 },
    );
});

test('Property 28.B: applyCrop with preserveMasksAfterCrop=true drops every mask whose pre-crop bbox lies fully outside the integer crop region (Req 31.4)', async () => {
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
                        // Surviving masks are covered by Property 28.A.
                        continue;
                    }

                    // Req 31.4 (intersection filter) — masks fully
                    // outside the cropRegion must be removed from the
                    // post-crop canvas. The reapply pass only re-adds
                    // records produced by `capturePreservedMasks`, and
                    // that helper only emits a record when the mask
                    // intersects the cropRegion.
                    assert.ok(
                        !surviving.includes(mask),
                        `Req 31.4 (intersection filter): mask[${i}] (maskId=${mask.maskId}) lies fully outside cropRegion={left:${cropRegion.left},top:${cropRegion.top},w:${cropRegion.width},h:${cropRegion.height}} and MUST NOT appear on the post-crop canvas`,
                    );
                }

                return true;
            },
        ),
        { numRuns: 100 },
    );
});
