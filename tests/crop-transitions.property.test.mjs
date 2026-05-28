/**
 * @file crop-transitions.property.test.mjs
 *
 * Type:
 *   Property test
 *
 * Purpose:
 *   Verifies src/crop/crop-controller.ts state-machine transitions for enter, apply,
 *   cancel, and rollback. A deterministic canvas stub, real HistoryManager, and
 *   scripted loadImage path keep the crop controller isolated while preserving
 *   observable session and history behavior.
 *
 * Scope:
 *   - enterCropMode captures the pre-crop snapshot before adding the crop rectangle.
 *   - applyCrop pushes exactly one undoable history entry on success.
 *   - cancel and rollback clear the session and detach crop-rectangle handlers
 *     without leaking history entries.
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
 *   node --test tests/crop-transitions.property.test.mjs
 *
 * Notes:
 *   - Prefer behavior-level assertions over implementation-detail checks.
 *   - Keep this file focused on atomic crop transitions only.
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

const { enterCropMode, applyCrop, cancelCrop } = await import('../src/crop/crop-controller.ts');
const { CropApplyError } = await import('../src/core/errors.ts');
const { HistoryManager } = await import('../src/history/history-manager.ts');
const { resolveOptions } = await import('../src/core/default-options.ts');

// ─── Test doubles ───────────────────────────────────────────────────────────

/**
 * Stand-in for a Fabric.js `Rect`. The crop controller binds three
 * handlers (`modified` / `moving` / `scaling`) on the rect and detaches
 * them when the session ends; we record `on(...)` and `off(...)` calls
 * so the test can assert handler-detach invariants.
 *
 * The shape carries `set` (used for scale clamps), `setCoords` (called
 * before reading the bounding rect on apply), and `getBoundingRect`
 * (read by `applyCrop` to derive the integer crop region).
 */
class MockCropRect {
    constructor(props) {
        Object.assign(this, props);
        // Track every (event, handler) pair so the test can compute
        // `attached - detached` after each transition. A clean session
        // ends with the count back at zero.
        this._handlers = []; // { event, fn, detached }
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
        // Mark every matching live handler as detached. Mirrors
        // Fabric.js v7's `off(event, fn)` semantics, which removes the
        // specific handler rather than every handler for the event.
        for (const rec of this._handlers) {
            if (!rec.detached && rec.event === event && rec.fn === fn) {
                rec.detached = true;
            }
        }
    }
    getBoundingRect() {
        // Return a region inside the canvas so `floorRegion` /
        // `clampRegionToCanvas` produce a valid 1+ × 1+ region.
        return {
            left: this.left,
            top: this.top,
            width: this.width * (this.scaleX ?? 1),
            height: this.height * (this.scaleY ?? 1),
        };
    }
    /** Number of bound handlers that are still attached. */
    liveHandlerCount() {
        return this._handlers.filter((h) => !h.detached).length;
    }
}

/**
 * Stand-in for `fabric.Canvas`. Records every method invocation in
 * `callOrder` so the property test can verify the pre-crop snapshot
 * was captured BEFORE the crop rectangle was added`).
 *
 * The mock implements every method the crop controller calls:
 *
 *   - `discardActiveObject`
 *   - `getObjects`               (mask enumeration, freeze loop)
 *   - `add` / `remove`           (crop rect lifecycle)
 *   - `bringObjectToFront`       (z-order on entry / preserved masks)
 *   - `setActiveObject`          (rect becomes active on entry)
 *   - `getWidth` / `getHeight`   (clamp the integer crop region)
 *   - `toDataURL`                (export the cropped JPEG)
 *   - `renderAll` /              (post-mutation repaint)
 *     `requestRenderAll`
 *   - `selection` setter
 */
class MockCanvas {
    constructor({ width = 800, height = 600 } = {}) {
        this._width = width;
        this._height = height;
        this._objects = [];
        this._selection = true;
        this.callOrder = [];
        this.toDataURLCalls = [];
    }

    // selection is a property — track writes via a getter/setter so the
    // controller's `canvas.selection = false` and `canvas.selection = !!prev`
    // assignments are observable.
    get selection() {
        return this._selection;
    }
    set selection(v) {
        this.callOrder.push(`selection=${v}`);
        this._selection = v;
    }

    discardActiveObject() {
        this.callOrder.push('discardActiveObject');
        return this;
    }
    getObjects() {
        this.callOrder.push('getObjects');
        return [...this._objects];
    }
    add(obj) {
        this.callOrder.push('add');
        this._objects.push(obj);
    }
    remove(obj) {
        this.callOrder.push('remove');
        const i = this._objects.indexOf(obj);
        if (i >= 0) this._objects.splice(i, 1);
    }
    bringObjectToFront(obj) {
        this.callOrder.push('bringObjectToFront');
        const i = this._objects.indexOf(obj);
        if (i >= 0) {
            this._objects.splice(i, 1);
            this._objects.push(obj);
        }
    }
    setActiveObject() {
        this.callOrder.push('setActiveObject');
        return this;
    }
    getWidth() {
        return this._width;
    }
    getHeight() {
        return this._height;
    }
    toDataURL(options) {
        this.callOrder.push('toDataURL');
        this.toDataURLCalls.push(options);
        return 'data:image/jpeg;base64,STUB';
    }
    renderAll() {
        this.callOrder.push('renderAll');
    }
    requestRenderAll() {
        this.callOrder.push('requestRenderAll');
    }
}

/**
 * Minimal stand-in for the committed Fabric `originalImage`. The crop
 * controller reads `getBoundingRect()` once on entry to derive the
 * initial crop rectangle bounds; `setCoords()` is called first to
 * refresh Fabric.js v7's coordinate cache.
 *
 * The bounding rect is sized so the configured padding leaves room for
 * a `crop.minWidth × crop.minHeight` initial rect.
 */
function makeOriginalImage() {
    return {
        setCoords() {
            /* no-op */
        },
        getBoundingRect() {
            return { left: 0, top: 0, width: 600, height: 400 };
        },
    };
}

/**
 * Build a fully-wired `CropControllerContext` plus the observability
 * hooks the property tests need:
 *
 *   - The mock canvas (read by every transition).
 *   - A real `HistoryManager` (so the test counts pushes via
 *     `history.length` rather than spying).
 *   - A scripted `loadImage` that either commits (success) or rejects
 *     with a tagged error (failure injection for the documented contract).
 *   - `saveStateCalls` / `loadFromStateCalls` recording every
 *     snapshot capture and restore so the test can assert ordering
 *.
 *   - `sessionPointer` — the live `CropSession | null` ref the
 *     controller reads/writes. The orchestrator owns this in
 *     production; here a plain object suffices.
 *
 * @param {object}  args
 * @param {boolean} args.failLoadImage  When true, the inner `loadImage`
 *                                       throws to exercise the
 *                                       rollback path.
 */
function makeContext({ failLoadImage = false } = {}) {
    const canvas = new MockCanvas();
    const originalImage = makeOriginalImage();
    const historyManager = new HistoryManager(50);

    // `saveState` returns a unique string per call so the test can
    // distinguish pre-crop vs. post-crop snapshots without needing a
    // real serializer. The first call (during `enterCropMode`)
    // captures the pre-crop snapshot; the second call (during a
    // successful `applyCrop`) captures the post-crop snapshot.
    let snapshotCounter = 0;
    const saveStateCalls = [];
    const saveState = () => {
        snapshotCounter += 1;
        const snap = `snap:${snapshotCounter}`;
        saveStateCalls.push({
            snap,
            // Capture canvas-call index at the moment of the snapshot
            // so the test can assert "the pre-crop snapshot was
            // captured BEFORE the crop rectangle was added"
            //.
            canvasCallsAtCapture: canvas.callOrder.length,
        });
        return snap;
    };

    const loadFromStateCalls = [];
    const loadFromState = async (snapshot) => {
        loadFromStateCalls.push(snapshot);
    };

    const loadImageCalls = [];
    const loadImage = async (imageBase64, options) => {
        loadImageCalls.push({ imageBase64, options });
        if (failLoadImage) {
            throw Object.assign(new Error('loadImage failed'), {
                name: 'LoadImageFailure',
            });
        }
    };

    // Session pointer ref — orchestrator-owned in production. The
    // controller reads/writes it through the
    // `getCropSession` / `setCropSession` callbacks.
    const sessionRef = { current: null };

    // Stub `fabric.Rect` constructor that returns the `MockCropRect`
    // built above. The crop controller calls `new ctx.fabric.Rect(...)`.
    const fabric = {
        Rect: MockCropRect,
    };

    const options = resolveOptions({
        // Tighten the crop config so the initial rect fits comfortably
        // inside the 600×400 originalImage bounding box for any padding.
        crop: {
            minWidth: 50,
            minHeight: 50,
            padding: 10,
            // is independent of mask hide/preserve modes. Disable both to
            // keep the session shape simple here.
            hideMasksDuringCrop: false,
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

    return {
        ctx,
        canvas,
        historyManager,
        saveStateCalls,
        loadFromStateCalls,
        loadImageCalls,
        sessionRef,
    };
}

// ─── Arbitraries ────────────────────────────────────────────────────────────

// Number of pre-existing canvas objects (non-mask, non-crop-rect)
// before `enterCropMode`. Drives the `prevEvented` capture loop;
// 's session-shape invariants are independent of object
// count, but iterating across a small range surfaces any off-by-one
// in the freeze loop.
const objectCountArb = fc.integer({ min: 0, max: 5 });

// ─── Properties ─────────────────────────────────────────────────────────────

test('enterCropMode clamps crop rectangle movement and scaling inside image bounds', () => {
    const { ctx, sessionRef } = makeContext();
    enterCropMode(ctx);
    const cropRect = sessionRef.current.cropRect;
    const movingHandler = cropRect._handlers.find((h) => h.event === 'moving')?.fn;
    assert.equal(typeof movingHandler, 'function', 'crop rect must bind a moving handler');

    cropRect.left = -500;
    cropRect.top = -500;
    cropRect.scaleX = 100;
    cropRect.scaleY = 100;
    movingHandler();

    assert.equal(cropRect.left, 10, 'left edge must clamp to the padded image inset');
    assert.equal(cropRect.top, 10, 'top edge must clamp to the padded image inset');
    assert.ok(cropRect.width * cropRect.scaleX <= 580, 'scaled width must fit bounds');
    assert.ok(cropRect.height * cropRect.scaleY <= 380, 'scaled height must fit bounds');

    cropRect.left = 10000;
    cropRect.top = 10000;
    cropRect.scaleX = 1;
    cropRect.scaleY = 1;
    movingHandler();

    assert.equal(cropRect.left, 540, 'right edge must clamp inside the padded image inset');
    assert.equal(cropRect.top, 340, 'bottom edge must clamp inside the padded image inset');
});

test('enterCropMode → applyCrop — pre-crop snapshot precedes the crop rect, exactly one history entry on success, undo restores the pre-crop snapshot, session cleared and crop-rect handlers detached after completion', async () => {
    await fc.assert(
        fc.asyncProperty(objectCountArb, async (objectCount) => {
            const { ctx, canvas, historyManager, saveStateCalls, loadFromStateCalls, sessionRef } =
                makeContext({ failLoadImage: false });

            // Seed the canvas with a few non-interactive objects so
            // the freeze loop has something to capture into
            // `prevEvented`. The shapes are plain objects with the
            // structural surface the controller touches.
            for (let i = 0; i < objectCount; i++) {
                canvas._objects.push({
                    type: 'rect',
                    evented: true,
                    selectable: true,
                    set(patch) {
                        Object.assign(this, patch);
                    },
                });
            }

            // Open the session. `enterCropMode` is sync.
            enterCropMode(ctx);

            // the documented contract — exactly one session opened.
            assert.notEqual(
                sessionRef.current,
                null,
                'the documented contract: enterCropMode must open a CropSession',
            );
            const session = sessionRef.current;
            assert.notEqual(
                session.cropRect,
                null,
                'the documented contract: the open session must carry a crop rectangle',
            );

            // the documented contract — pre-crop snapshot was captured
            // BEFORE the crop rectangle was added to the canvas.
            // The snapshot's `canvasCallsAtCapture` must precede the
            // first `add` call (which adds the crop rect).
            assert.equal(
                saveStateCalls.length,
                1,
                'the documented contract: enterCropMode captures exactly one pre-crop snapshot',
            );
            const firstAddIndex = canvas.callOrder.indexOf('add');
            assert.ok(
                firstAddIndex >= 0,
                'enterCropMode must add the crop rectangle to the canvas',
            );
            assert.ok(
                saveStateCalls[0].canvasCallsAtCapture <= firstAddIndex,
                `the documented contract: pre-crop snapshot must be captured BEFORE the crop rectangle is added; saveState index=${saveStateCalls[0].canvasCallsAtCapture}, first add index=${firstAddIndex}`,
            );

            // the documented contract (idempotent re-entry) — calling
            // `enterCropMode` again with a session already open MUST
            // NOT replace the session (at-most-one CropSession).
            const sessionRefBeforeRetry = sessionRef.current;
            const saveStateCountBeforeRetry = saveStateCalls.length;
            enterCropMode(ctx);
            assert.equal(
                sessionRef.current,
                sessionRefBeforeRetry,
                'the documented contract: re-entry of enterCropMode must NOT open a second session',
            );
            assert.equal(
                saveStateCalls.length,
                saveStateCountBeforeRetry,
                'the documented contract: re-entry of enterCropMode must NOT capture a second pre-crop snapshot',
            );

            // Capture the rect reference now so we can assert
            // post-apply handler detachment after the session pointer
            // is cleared.
            const cropRect = session.cropRect;
            const liveHandlersBeforeApply = cropRect.liveHandlerCount();
            assert.ok(
                liveHandlersBeforeApply >= 1,
                'enterCropMode must bind at least one Fabric handler on the crop rect',
            );

            const beforeSnap = saveStateCalls[0].snap;

            // Apply the crop.
            await applyCrop(ctx);

            // the documented contract — success path captures both pre-crop
            // and post-crop snapshots; the post-crop snapshot is the
            // history command's `execute` payload.
            assert.equal(
                saveStateCalls.length,
                2,
                'the documented contract: applyCrop success must capture the post-crop snapshot for the redo command',
            );
            const afterSnap = saveStateCalls[1].snap;
            assert.notEqual(
                beforeSnap,
                afterSnap,
                'pre-crop and post-crop snapshots must differ for the history entry to be pushed',
            );

            // the documented contract — exactly one history entry pushed.
            assert.equal(
                historyManager.history.length,
                1,
                'the documented contract: applyCrop success must push exactly ONE history entry',
            );
            assert.equal(
                historyManager.canUndo(),
                true,
                'the documented contract: history pointer must advance on the new entry',
            );

            // the documented contract — the command's `undo` restores the
            // pre-crop snapshot and `execute` re-applies the
            // post-crop snapshot. Drive each callback once and
            // inspect the resulting `loadFromState` calls.
            const restoresBefore = loadFromStateCalls.length;
            const cmd = historyManager.history[0];
            await cmd.undo();
            assert.equal(
                loadFromStateCalls[restoresBefore],
                beforeSnap,
                'the documented contract: command.undo() must restore the pre-crop snapshot',
            );
            await cmd.execute();
            assert.equal(
                loadFromStateCalls[restoresBefore + 1],
                afterSnap,
                'the documented contract: command.execute() must re-apply the post-crop snapshot',
            );

            // The success path itself must NOT have invoked
            // `loadFromState` directly — the post-crop restore goes
            // through the inner `loadImage`, not through the
            // rollback channel.
            assert.equal(
                restoresBefore,
                0,
                'the documented contract: success path must not call loadFromState (no rollback)',
            );

            // the documented contract — every crop-rect handler bound by
            // `enterCropMode` is detached after the session ends.
            assert.equal(
                cropRect.liveHandlerCount(),
                0,
                'the documented contract: every crop-rect Fabric handler must be detached after applyCrop',
            );

            // The session pointer is cleared so a subsequent
            // `enterCropMode` opens a fresh session.
            assert.equal(
                sessionRef.current,
                null,
                'the documented contract: session pointer must be null after applyCrop completes',
            );

            return true;
        }),
        { numRuns: 100 },
    );
});

test('enterCropMode → cancelCrop — no history entry produced, session cleared, crop-rect handlers detached', async () => {
    await fc.assert(
        fc.asyncProperty(objectCountArb, async (objectCount) => {
            const { ctx, canvas, historyManager, loadFromStateCalls, sessionRef } = makeContext({
                failLoadImage: false,
            });

            for (let i = 0; i < objectCount; i++) {
                canvas._objects.push({
                    type: 'rect',
                    evented: true,
                    selectable: true,
                    set(patch) {
                        Object.assign(this, patch);
                    },
                });
            }

            enterCropMode(ctx);
            const session = sessionRef.current;
            assert.notEqual(session, null, 'enterCropMode must open a session');
            const cropRect = session.cropRect;
            assert.ok(
                cropRect.liveHandlerCount() >= 1,
                'enterCropMode must bind handlers on the crop rect',
            );

            // Cancel the crop. `cancelCrop` is sync.
            cancelCrop(ctx);

            // the documented contract — cancel must NOT push a history
            // entry. The history stack is exactly as it was before.
            assert.equal(
                historyManager.history.length,
                0,
                'the documented contract: cancelCrop must NOT push a history entry',
            );
            assert.equal(
                historyManager.canUndo(),
                false,
                'the documented contract: cancelCrop must leave canUndo() === false',
            );
            // No `loadFromState` either — the cancel path restores
            // through the in-place teardown (per-object evented and
            // canvas.selection) rather than re-applying a snapshot.
            assert.equal(
                loadFromStateCalls.length,
                0,
                'the documented contract: cancelCrop must not call loadFromState (in-place restore)',
            );

            // the documented contract — every crop-rect handler bound by
            // `enterCropMode` is detached after cancel.
            assert.equal(
                cropRect.liveHandlerCount(),
                0,
                'the documented contract: every crop-rect Fabric handler must be detached after cancelCrop',
            );

            // Session pointer cleared.
            assert.equal(
                sessionRef.current,
                null,
                'the documented contract: session pointer must be null after cancelCrop',
            );

            return true;
        }),
        { numRuns: 100 },
    );
});

test('failed applyCrop — rejects with CropApplyError, no history entry pushed, pre-crop snapshot restored via loadFromState, session cleared and crop-rect handlers detached', async () => {
    await fc.assert(
        fc.asyncProperty(objectCountArb, async (objectCount) => {
            const { ctx, canvas, historyManager, saveStateCalls, loadFromStateCalls, sessionRef } =
                makeContext({ failLoadImage: true });

            for (let i = 0; i < objectCount; i++) {
                canvas._objects.push({
                    type: 'rect',
                    evented: true,
                    selectable: true,
                    set(patch) {
                        Object.assign(this, patch);
                    },
                });
            }

            enterCropMode(ctx);
            const session = sessionRef.current;
            assert.notEqual(session, null, 'enterCropMode must open a session');
            const cropRect = session.cropRect;
            const beforeSnap = saveStateCalls[0].snap;

            // Apply the crop. The injected `loadImage` failure must
            // propagate through the `applyCrop` rollback path.
            const rejection = await applyCrop(ctx).then(
                () => null,
                (err) => err,
            );

            // the documented contract — the promise rejects with
            // `CropApplyError`. The original cause is preserved on
            // `originalError` per the documented error-class contract.
            assert.ok(
                rejection instanceof CropApplyError,
                `the documented contract: failure must reject with CropApplyError; got ${rejection?.name ?? typeof rejection}`,
            );

            // the documented contract — the rollback path calls
            // `loadFromState` with the pre-crop snapshot. There may
            // be additional restores in the documented error
            // documentation, but the most recent must target the
            // pre-crop snapshot.
            assert.ok(
                loadFromStateCalls.length >= 1,
                'the documented contract: failure path must call loadFromState to restore the pre-crop snapshot',
            );
            assert.equal(
                loadFromStateCalls[loadFromStateCalls.length - 1],
                beforeSnap,
                'the documented contract: rollback restore must target the pre-crop snapshot',
            );

            // No history entry is pushed on rollback.
            assert.equal(
                historyManager.history.length,
                0,
                'the documented contract: failure must NOT push a history entry',
            );
            assert.equal(
                historyManager.canUndo(),
                false,
                'the documented contract: failure must leave canUndo() === false',
            );

            // the documented contract — every crop-rect handler is detached
            // after rollback.
            assert.equal(
                cropRect.liveHandlerCount(),
                0,
                'the documented contract: every crop-rect Fabric handler must be detached after applyCrop rollback',
            );

            // Session pointer cleared so the editor can open a fresh
            // crop session.
            assert.equal(
                sessionRef.current,
                null,
                'the documented contract: session pointer must be null after applyCrop rollback',
            );

            return true;
        }),
        { numRuns: 100 },
    );
});

test('cancelCrop and applyCrop are no-ops without an open session', async () => {
    // No fast-check input space — the property is purely about the
    // controller's state-machine guards. We still wrap a single
    // iteration in `fc.assert` for consistency with the rest of the
    // file and to satisfy the 100-iteration framing for property
    // tests on this spec.
    await fc.assert(
        fc.asyncProperty(fc.constant(null), async () => {
            const { ctx, historyManager, saveStateCalls, loadFromStateCalls, sessionRef } =
                makeContext({ failLoadImage: false });

            // No session open → cancelCrop is a no-op.
            cancelCrop(ctx);
            assert.equal(sessionRef.current, null, 'cancelCrop with no session must remain null');
            assert.equal(
                historyManager.history.length,
                0,
                'the documented contract: cancelCrop with no session must not push history',
            );

            // No session open → applyCrop is a no-op (resolves
            // without rejecting and without pushing history).
            await applyCrop(ctx);
            assert.equal(sessionRef.current, null, 'applyCrop with no session must remain null');
            assert.equal(
                historyManager.history.length,
                0,
                'the documented contract: applyCrop with no session must not push history',
            );
            assert.equal(
                saveStateCalls.length,
                0,
                'applyCrop with no session must not call saveState',
            );
            assert.equal(
                loadFromStateCalls.length,
                0,
                'applyCrop with no session must not call loadFromState',
            );

            return true;
        }),
        { numRuns: 100 },
    );
});
