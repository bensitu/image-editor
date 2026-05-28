/**
 * @file hide-masks-during-crop.property.test.mjs
 *
 * Type:
 *   Property test
 *
 * Purpose:
 *   Verifies the interaction between src/crop/crop-controller.ts and
 *   src/mask/mask-style.ts when crop.hideMasksDuringCrop is enabled or disabled. The
 *   suite checks that mask style backups and object event flags round-trip correctly
 *   through enter and cancel.
 *
 * Scope:
 *   - Enabled mode backs up mask styles before forcing masks invisible and
 *     non-interactive.
 *   - cancelCrop restores opacity, fill, stroke, strokeWidth, selectable,
 *     lockRotation, and evented state.
 *   - Disabled mode skips mask style backups while still restoring freeze-loop event
 *     flags.
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
 *   node --test tests/hide-masks-during-crop.property.test.mjs
 *
 * Notes:
 *   - Prefer behavior-level assertions over implementation-detail checks.
 *   - Keep this file focused on hide masks during crop and restore on cancel only.
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

const { enterCropMode, cancelCrop } = await import('../src/crop/crop-controller.ts');
const { resolveOptions } = await import('../src/core/default-options.ts');
const { HistoryManager } = await import('../src/history/history-manager.ts');

// ─── Test doubles ───────────────────────────────────────────────────────────

/**
 * Stand-in for a Fabric.js `Rect`. The crop controller binds three
 * handlers (`modified` / `moving` / `scaling`) on the rect; we record
 * `on(...)` / `off(...)` calls so the rect can be cleanly torn down on
 * `cancelCrop`. The shape carries `set` (used for scale clamps),
 * `setCoords` (called before reading the bounding rect on apply), and
 * `getBoundingRect` (read by `applyCrop` to derive the integer crop
 * region). does not exercise `applyCrop`.
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
    setCoords() {
        // No-op — the test does not exercise Fabric's coordinate cache.
    }
    setControlVisible() {
        // No-op — `setControlVisible('mtr', false)` is called by
        // `enterCropMode` to hide the rotation handle. does
        // not assert visibility.
    }
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
 * Only methods the crop controller calls during `enterCropMode` and
 * `cancelCrop` are implemented. `applyCrop` is NOT exercised by
 * (it has its own coverage in / 28).
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
}

/**
 * Minimal stand-in for the committed Fabric `originalImage`. The crop
 * controller reads `getBoundingRect()` once on entry to derive the
 * initial crop rectangle bounds.
 */
function makeOriginalImage() {
    return {
        setCoords() {},
        getBoundingRect() {
            return { left: 0, top: 0, width: 600, height: 400 };
        },
    };
}

/**
 * Build a structural mask that satisfies `isMaskObject` (carries a
 * numeric `maskId`) and exposes the live `set` method that
 * `applyCropHideMaskStyle` and `restoreMaskStyleBackup` mutate. The
 * `setCoords` method is required by `restoreMaskStyleBackup` (mirrors
 * legacy's mergeMasks restore that calls `setCoords` after a write).
 *
 * Style fields default to fast-check-supplied values so each iteration
 * exercises a different "pre-crop live state".
 */
function makeMockMask(maskId, styleSeed) {
    const mask = {
        type: 'rect',
        maskId,
        // Pre-crop live style — backs this set up on entry
        // and restores it on cancel.
        opacity: styleSeed.opacity,
        fill: styleSeed.fill,
        stroke: styleSeed.stroke,
        strokeWidth: styleSeed.strokeWidth,
        selectable: styleSeed.selectable,
        lockRotation: styleSeed.lockRotation,
        evented: styleSeed.evented,
        set(patch) {
            Object.assign(this, patch);
            return this;
        },
        setCoords() {},
    };
    return mask;
}

/**
 * Build a fully-wired `CropControllerContext` plus the observability
 * hooks needs:
 *
 *   - The mock canvas seeded with the supplied masks (in canvas object
 *     order).
 *   - A real `HistoryManager` so we can assert NO history entry is
 *     produced by `cancelCrop`.
 *   - `saveStateCalls` recording every snapshot capture so we can
 *     verify the controller still captures a pre-crop snapshot under
 *     `hideMasksDuringCrop`.
 *   - `sessionRef` exposing the live session pointer.
 *
 * The `hideMasksDuringCrop` flag drives the property branch; all other
 * crop options are pinned so the initial rect fits the 600×400
 * `originalImage` bounding box.
 */
function makeContext({ hideMasksDuringCrop, masks }) {
    const canvas = new MockCanvas();
    for (const mask of masks) canvas._objects.push(mask);

    const originalImage = makeOriginalImage();
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
    const loadImage = async () => {};

    const sessionRef = { current: null };

    const fabric = { Rect: MockCropRect };

    const options = resolveOptions({
        crop: {
            minWidth: 50,
            minHeight: 50,
            padding: 10,
            hideMasksDuringCrop,
            preserveMasksAfterCrop: false,
            allowRotationOfCropRect: false,
        },
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

// ─── Arbitraries ────────────────────────────────────────────────────────────

/**
 * One mask's pre-crop "live style". Each field uses an arbitrary that
 * spans realistic Fabric.js values so the backup capture loop is
 * exercised across the full domain of the documented contract's six fields.
 *
 * - `opacity` ∈ (0, 1] — the controller forces opacity to 0 on hide,
 *   so the pre-crop value must be observably non-zero for the test to
 *   catch a missed backup. (A pre-crop value of 0 would make
 *   "before-vs-after" indistinguishable.)
 *
 * - `fill` / `stroke` — strings, so a strict equality check on restore
 *   catches a missed field without false positives from object identity.
 *
 * - `strokeWidth` — small positive integers; the documented contract demands
 *   the live value is restored verbatim regardless of magnitude.
 *
 * - `selectable` / `lockRotation` — booleans, exercising both `true` and
 *   `false` pre-crop values.
 *
 * - `evented` — boolean. Restoration goes through the freeze loop's
 *   `prevEvented` path rather than the MaskBackup, but *   asserts the round-trip ends with `evented` matching the pre-crop
 *   value too.
 */
const maskStyleArb = fc.record({
    opacity: fc.double({ min: 0.05, max: 1, noNaN: true }),
    fill: fc.oneof(fc.constantFrom('#ff0000', '#00ff00', '#0000ff', '#abcdef', null)),
    stroke: fc.oneof(fc.constantFrom('#000000', '#cccccc', '#123456', null)),
    strokeWidth: fc.integer({ min: 0, max: 10 }),
    selectable: fc.boolean(),
    lockRotation: fc.boolean(),
    evented: fc.boolean(),
});

/**
 * A small collection of masks, identified by sequential `maskId` so
 * `isMaskObject` (`'maskId' in obj && typeof maskId === 'number'`)
 * matches all of them. Cardinality is bounded at 5 to keep the property
 * fast while still exercising the per-mask loop more than once.
 */
const maskSetArb = fc
    .array(maskStyleArb, { minLength: 0, maxLength: 5 })
    .map((styles) => styles.map((style, idx) => makeMockMask(idx + 1, style)));

// ─── Helper: snapshot a mask's pre-crop style for later comparison ───────────

/**
 * Capture the six fields the documented contract covers (`opacity`, `fill`,
 * `strokeWidth`, `stroke`, `selectable`, `lockRotation`) plus `evented`
 * on a plain object so the test can compare pre-crop vs. post-cancel
 * state without sharing references with the live mask.
 */
function snapshotMaskStyle(mask) {
    return {
        opacity: mask.opacity,
        fill: mask.fill,
        stroke: mask.stroke,
        strokeWidth: mask.strokeWidth,
        selectable: mask.selectable,
        lockRotation: mask.lockRotation,
        evented: mask.evented,
    };
}

// ─── Properties ─────────────────────────────────────────────────────────────

test('enterCropMode with hideMasksDuringCrop=true backs up prior mask styles and forces opacity=0 + evented=false', async () => {
    await fc.assert(
        fc.asyncProperty(maskSetArb, async (masks) => {
            // Snapshot the live style of each mask BEFORE any controller
            // call so the property can compare the captured backup against
            // the true pre-crop values (not against post-mutation state).
            const preCropStyles = masks.map(snapshotMaskStyle);

            const { ctx, sessionRef } = makeContext({
                hideMasksDuringCrop: true,
                masks,
            });

            enterCropMode(ctx);

            const session = sessionRef.current;
            assert.notEqual(session, null, 'enterCropMode must open a session');

            // the documented contract — exactly one MaskBackup is captured
            // per mask currently on the canvas. Non-mask objects must
            // NOT produce a MaskBackup (they are tracked via
            // `prevEvented` only).
            assert.equal(
                session.maskBackups.length,
                masks.length,
                `the documented contract: maskBackups must contain one entry per mask; expected ${masks.length}, got ${session.maskBackups.length}`,
            );

            // Each backup MUST carry the true pre-crop live values for
            // the six MaskBackup fields. The controller captures the
            // backup BEFORE mutating any mask, so even though the mask
            // has been mutated by the time we inspect the session, the
            // backup itself records the pre-crop snapshot.
            for (let i = 0; i < masks.length; i++) {
                const backup = session.maskBackups[i];
                const prior = preCropStyles[i];
                assert.equal(
                    backup.obj,
                    masks[i],
                    `the documented contract: maskBackups[${i}].obj must reference the live mask`,
                );
                assert.equal(
                    backup.opacity,
                    prior.opacity,
                    `the documented contract: maskBackups[${i}].opacity must capture the pre-crop opacity`,
                );
                assert.equal(
                    backup.fill,
                    prior.fill,
                    `the documented contract: maskBackups[${i}].fill must capture the pre-crop fill`,
                );
                assert.equal(
                    backup.stroke,
                    prior.stroke,
                    `the documented contract: maskBackups[${i}].stroke must capture the pre-crop stroke`,
                );
                assert.equal(
                    backup.strokeWidth,
                    prior.strokeWidth,
                    `the documented contract: maskBackups[${i}].strokeWidth must capture the pre-crop strokeWidth`,
                );
                assert.equal(
                    backup.selectable,
                    prior.selectable,
                    `the documented contract: maskBackups[${i}].selectable must capture the pre-crop selectable`,
                );
                assert.equal(
                    backup.lockRotation,
                    prior.lockRotation,
                    `the documented contract: maskBackups[${i}].lockRotation must capture the pre-crop lockRotation`,
                );
            }

            // the documented contract — after the freeze loop and the hide-style
            // pass, every mask carries `opacity: 0`, `evented: false`,
            // `selectable: false`. These are the three flags
            // `applyCropHideMaskStyle` writes; the rest of the mask's
            // style is left untouched on entry (only the cancel restore
            // brings it back).
            for (const mask of masks) {
                assert.equal(
                    mask.opacity,
                    0,
                    'the documented contract: hideMasksDuringCrop=true must force every mask to opacity 0',
                );
                assert.equal(
                    mask.evented,
                    false,
                    'the documented contract: hideMasksDuringCrop=true must force every mask to evented=false',
                );
                assert.equal(
                    mask.selectable,
                    false,
                    'the documented contract: hideMasksDuringCrop=true must force every mask to selectable=false',
                );
            }

            return true;
        }),
        { numRuns: 100 },
    );
});

test('cancelCrop after hideMasksDuringCrop=true restores opacity, fill, stroke, strokeWidth, selectable, lockRotation, and evented to pre-crop values', async () => {
    await fc.assert(
        fc.asyncProperty(maskSetArb, async (masks) => {
            const preCropStyles = masks.map(snapshotMaskStyle);

            const { ctx, sessionRef, historyManager } = makeContext({
                hideMasksDuringCrop: true,
                masks,
            });

            enterCropMode(ctx);
            assert.notEqual(
                sessionRef.current,
                null,
                'enterCropMode must open a session before cancel',
            );

            cancelCrop(ctx);

            // the documented contract (sanity) — cancel produces no history
            // entry. focuses on style restoration but a
            // missed history-suppression bug would corrupt this test
            // too, so the assertion guards against accidental coupling.
            assert.equal(
                historyManager.history.length,
                0,
                'the documented contract: cancelCrop must NOT push a history entry',
            );

            // the documented contract — every mask's `opacity`, `fill`,
            // `strokeWidth`, `stroke`, `selectable`, and `lockRotation`
            // is restored to the pre-crop value. `evented` is restored
            // through the freeze loop's `prevEvented` path; Documented contract Property
            // 27 names `evented` explicitly in its post-condition list,
            // so the assertion covers it too.
            for (let i = 0; i < masks.length; i++) {
                const mask = masks[i];
                const prior = preCropStyles[i];
                assert.equal(
                    mask.opacity,
                    prior.opacity,
                    `the documented contract: cancelCrop must restore mask[${i}].opacity to its pre-crop value`,
                );
                assert.equal(
                    mask.fill,
                    prior.fill,
                    `the documented contract: cancelCrop must restore mask[${i}].fill to its pre-crop value`,
                );
                assert.equal(
                    mask.stroke,
                    prior.stroke,
                    `the documented contract: cancelCrop must restore mask[${i}].stroke to its pre-crop value`,
                );
                assert.equal(
                    mask.strokeWidth,
                    prior.strokeWidth,
                    `the documented contract: cancelCrop must restore mask[${i}].strokeWidth to its pre-crop value`,
                );
                assert.equal(
                    mask.selectable,
                    prior.selectable,
                    `the documented contract: cancelCrop must restore mask[${i}].selectable to its pre-crop value`,
                );
                assert.equal(
                    mask.lockRotation,
                    prior.lockRotation,
                    `the documented contract: cancelCrop must restore mask[${i}].lockRotation to its pre-crop value`,
                );
                assert.equal(
                    mask.evented,
                    prior.evented,
                    `the documented contract (per Documented contract wording): cancelCrop must restore mask[${i}].evented to its pre-crop value`,
                );
            }

            // Session pointer is cleared so a subsequent
            // `enterCropMode` opens a fresh session.
            assert.equal(
                sessionRef.current,
                null,
                'the documented contract (sanity): session pointer must be null after cancelCrop',
            );

            return true;
        }),
        { numRuns: 100 },
    );
});

test('enterCropMode with hideMasksDuringCrop=false captures NO mask backups and leaves opacity untouched; cancelCrop round-trips evented/selectable to pre-crop values', async () => {
    await fc.assert(
        fc.asyncProperty(maskSetArb, async (masks) => {
            const preCropStyles = masks.map(snapshotMaskStyle);

            const { ctx, sessionRef } = makeContext({
                hideMasksDuringCrop: false,
                masks,
            });

            enterCropMode(ctx);

            const session = sessionRef.current;
            assert.notEqual(
                session,
                null,
                'enterCropMode must open a session even when hideMasksDuringCrop=false',
            );

            // the documented contract (negative) — when `hideMasksDuringCrop`
            // is `false`, the controller MUST NOT capture any
            // MaskBackup (the hide style is never applied, so there is
            // nothing to revert on cancel). The freeze loop still runs,
            // but its `prevEvented` records are a separate channel.
            assert.equal(
                session.maskBackups.length,
                0,
                'the documented contract (negative): hideMasksDuringCrop=false must produce ZERO MaskBackups',
            );

            // the documented contract (negative) — opacity, fill, stroke,
            // strokeWidth, and lockRotation MUST be untouched on entry
            // when the option is `false`. The freeze loop forces
            // `evented` and `selectable` to `false` on every object,
            // which is the only crop-on-entry mutation when the hide
            // option is disabled — those two flags are exempted from
            // this round-trip-untouched assertion.
            for (let i = 0; i < masks.length; i++) {
                const mask = masks[i];
                const prior = preCropStyles[i];
                assert.equal(
                    mask.opacity,
                    prior.opacity,
                    `the documented contract (negative): hideMasksDuringCrop=false must NOT change mask[${i}].opacity on entry`,
                );
                assert.equal(
                    mask.fill,
                    prior.fill,
                    `the documented contract (negative): hideMasksDuringCrop=false must NOT change mask[${i}].fill on entry`,
                );
                assert.equal(
                    mask.stroke,
                    prior.stroke,
                    `the documented contract (negative): hideMasksDuringCrop=false must NOT change mask[${i}].stroke on entry`,
                );
                assert.equal(
                    mask.strokeWidth,
                    prior.strokeWidth,
                    `the documented contract (negative): hideMasksDuringCrop=false must NOT change mask[${i}].strokeWidth on entry`,
                );
                assert.equal(
                    mask.lockRotation,
                    prior.lockRotation,
                    `the documented contract (negative): hideMasksDuringCrop=false must NOT change mask[${i}].lockRotation on entry`,
                );
            }

            cancelCrop(ctx);

            // the documented contract — after cancel, every field (including
            // the freeze-loop-mutated `evented` and `selectable`) is
            // back to its pre-crop value. This proves the round trip
            // is observably a no-op for the entire mask style space
            // when `hideMasksDuringCrop` is `false`.
            for (let i = 0; i < masks.length; i++) {
                const mask = masks[i];
                const prior = preCropStyles[i];
                assert.equal(
                    mask.opacity,
                    prior.opacity,
                    `the documented contract: cancelCrop round-trip must leave mask[${i}].opacity at its pre-crop value`,
                );
                assert.equal(
                    mask.fill,
                    prior.fill,
                    `the documented contract: cancelCrop round-trip must leave mask[${i}].fill at its pre-crop value`,
                );
                assert.equal(
                    mask.stroke,
                    prior.stroke,
                    `the documented contract: cancelCrop round-trip must leave mask[${i}].stroke at its pre-crop value`,
                );
                assert.equal(
                    mask.strokeWidth,
                    prior.strokeWidth,
                    `the documented contract: cancelCrop round-trip must leave mask[${i}].strokeWidth at its pre-crop value`,
                );
                assert.equal(
                    mask.selectable,
                    prior.selectable,
                    `the documented contract: cancelCrop round-trip must leave mask[${i}].selectable at its pre-crop value`,
                );
                assert.equal(
                    mask.lockRotation,
                    prior.lockRotation,
                    `the documented contract: cancelCrop round-trip must leave mask[${i}].lockRotation at its pre-crop value`,
                );
                assert.equal(
                    mask.evented,
                    prior.evented,
                    `the documented contract: cancelCrop round-trip must leave mask[${i}].evented at its pre-crop value`,
                );
            }

            assert.equal(sessionRef.current, null, 'session pointer must be null after cancelCrop');

            return true;
        }),
        { numRuns: 100 },
    );
});
