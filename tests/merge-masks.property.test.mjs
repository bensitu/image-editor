/**
 * Type:
 *   Property test
 *
 * Purpose:
 *   Verifies src/mask/merge-controller.ts behavior for successful merge and rollback
 *   on failure. The suite uses a mock canvas, scripted export/load paths, and a real
 *   HistoryManager to observe snapshots, scroll preservation, and history entries.
 *
 * Scope:
 *   - Successful merge captures the pre-merge snapshot before mutation and pushes
 *     exactly one history entry.
 *   - Scroll positions are preserved when the container exists.
 *   - Failed merge restores the pre-merge snapshot and does not push history.
 *
 * Out of scope:
 *   - visual rendering quality
 *   - unrelated crop or export behavior
 *   - browser-specific pointer interaction details
 *
 * Environment:
 *   - Node.js ESM
 *   - fast-check generated cases where applicable
 *   - Fabric/canvas behavior is mocked where needed
 *
 * Run:
 *   node --test tests/merge-masks.property.test.mjs
 *
 * Notes:
 *   - Prefer behavior-level assertions over implementation-detail checks.
 *   - Keep this file focused on atomic mergeMasks pipeline only.
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

const { mergeMasks } = await import('../src/export/export-service.ts');
const { MergeMasksError } = await import('../src/core/errors.ts');
const { HistoryManager } = await import('../src/history/history-manager.ts');

// ─── Test doubles ───────────────────────────────────────────────────────────

/**
 * Minimal mask object satisfying both the `isMaskObject` guard
 * (`maskId: number`) and the surface that `withMaskStyleBackup` reads:
 * `opacity`, `fill`, `stroke`, `strokeWidth`, `selectable`,
 * `lockRotation`, plus a permissive `set` mutator and a `setCoords`
 * no-op so the bake-in step does not throw.
 */
function makeMockMask(maskId) {
    return {
        editorObjectKind: 'mask',
        type: 'rect',
        maskId,
        maskUid: `mask-${maskId}`,
        maskName: `mask_${maskId}`,
        opacity: 1,
        fill: '#ff0000',
        stroke: null,
        strokeWidth: 0,
        selectable: true,
        lockRotation: false,
        set(props) {
            Object.assign(this, props);
        },
        setCoords() {
            /* no-op for mocks; Fabric uses this to refresh cached bbox */
        },
    };
}

/**
 * Stand-in for `fabric.Canvas` covering only the surface that
 * `mergeMasks` and its inner `exportImageBase64` touch:
 *   - getObjects()              — mask enumeration + filter
 *   - discardActiveObject()     — the documented contract
 *   - renderAll()               — post-discard repaint
 *   - toDataURL(options)        — the merged-bitmap render
 *
 * Records every method invocation in `callOrder` so the property tests
 * can assert that `saveState` (the snapshot capture) ran before any
 * mutation method on the canvas.
 */
function makeMockCanvas(initialMasks, stubDataUrl) {
    const callOrder = [];
    let objects = [...initialMasks];
    return {
        callOrder,
        getObjects() {
            return objects;
        },
        /** Drain the mask list — used by `removeAllMasksNoHistory`. */
        setObjects(next) {
            objects = next;
        },
        discardActiveObject() {
            callOrder.push('discardActiveObject');
            return this;
        },
        renderAll() {
            callOrder.push('renderAll');
        },
        toDataURL(_options) {
            callOrder.push('toDataURL');
            return stubDataUrl;
        },
    };
}

/**
 * Build a fully-wired `MergeMasksContext` plus the stub state needed to
 * observe the merge's behavior across the two scenarios. Returns the
 * context, the live mock canvas, the history manager, the recorded
 * snapshot/load history, and a `containerElement` whose `scrollTop` /
 * `scrollLeft` are pre-populated to a caller-supplied tuple so the
 * the documented contract assertions can detect any drift.
 *
 * @param {object}   args
 * @param {number}   args.maskCount      Number of masks to seed.
 * @param {number}   args.scrollTop      Pre-merge container scrollTop.
 * @param {number}   args.scrollLeft     Pre-merge container scrollLeft.
 * @param {boolean}  args.failLoadImage  When true, the inner `loadImage`
 *                                       throws to exercise the rollback
 *                                       path.
 */
function makeContext({ maskCount, scrollTop, scrollLeft, failLoadImage }) {
    const masks = Array.from({ length: maskCount }, (_, i) => makeMockMask(i + 1));
    const canvas = makeMockCanvas(masks, 'data:image/jpeg;base64,STUB');

    // Mock container element with mutable scroll properties; only the
    // four properties that `mergeMasks` reads/writes are exposed.
    const containerElement = {
        scrollTop,
        scrollLeft,
    };

    const historyManager = new HistoryManager(50);

    // `saveState` returns a unique string per call so the test can
    // distinguish "before" vs. "after" snapshots without relying on
    // canvas serialization. The merge captures the pre-merge snapshot
    // first (call 1) and the post-merge snapshot second (call 2).
    let snapshotCounter = 0;
    const saveStateCalls = [];
    const captureSnapshot = () => {
        snapshotCounter += 1;
        const snap = `snapshot:${snapshotCounter}`;
        saveStateCalls.push({
            snap,
            // Capture the call-order index at the time of saveState so
            // the test can assert "snapshot captured before any
            // mutation" by comparing against the canvas mock's
            // `callOrder.length` at this moment.
            canvasCallsAtCapture: canvas.callOrder.length,
        });
        return snap;
    };

    // `loadFromState` records every restore the merge performs. Used by
    // the failure path to verify rollback and by the `undo` / `execute`
    // callback assertions.
    const loadFromStateCalls = [];
    const loadFromState = async (snapshot) => {
        loadFromStateCalls.push(snapshot);
    };

    // The transactional `loadImage` is the failure injection point for
    // scenario 2. On success it records the call so the test can assert
    // the merge passed `preserveScroll: true`.
    const loadImageCalls = [];
    const loadImage = async (imageBase64, options) => {
        loadImageCalls.push({ imageBase64, options });
        if (failLoadImage) {
            throw Object.assign(new Error('loadImage failed'), {
                name: 'LoadImageFailure',
            });
        }
    };

    const exportImageBase64Calls = [];
    const exportImageBase64 = async (options) => {
        exportImageBase64Calls.push(options);
        return canvas.toDataURL(options);
    };

    const removeAllMasksCalls = [];
    const removeAllMasksNoHistory = () => {
        removeAllMasksCalls.push(canvas.callOrder.length);
        canvas.setObjects([]);
    };

    const ctx = {
        fabric: { FabricImage: { fromURL: () => Promise.resolve({}) } },
        canvas,
        options: {
            defaultDownloadFileName: 'edited_image',
            downsampleQuality: 0.92,
            exportMultiplier: 1,
            exportAreaByDefault: 'image',
            mergeMasksByDefault: true,
            mergeAnnotationsByDefault: true,
        },
        isImageLoaded: () => true,
        getOriginalImage: () => null,
        historyManager,
        containerElement,
        loadImage,
        captureSnapshot,
        loadFromState,
        exportImageBase64,
        withSelectionChangeSuppressed: async (callback) => {
            return await callback();
        },
        updateUi() {},
        updateInputs() {},
        getAnnotations: () => [],
        restoreAnnotations() {},
        removeAllMasksNoHistory,
    };

    return {
        ctx,
        canvas,
        containerElement,
        historyManager,
        saveStateCalls,
        loadFromStateCalls,
        loadImageCalls,
        exportImageBase64Calls,
        removeAllMasksCalls,
    };
}

// ─── Arbitraries ────────────────────────────────────────────────────────────

// At least one mask, otherwise the merge is a documented no-op (matches
// legacy's `if (!masks.length) return;` and the explicit gate inside
// `mergeMasks`).
const maskCountArb = fc.integer({ min: 1, max: 8 });

// Random non-negative integer scroll positions — wide enough to surface
// any partial restore (e.g., restoring only one axis) as a property
// failure.
const scrollArb = fc.integer({ min: 0, max: 4096 });

// ─── Properties ─────────────────────────────────────────────────────────────

test('successful merge — pre-merge snapshot captured before any mutation, exactly one history entry pushed, scroll preserved, undo/execute snapshots match', async () => {
    await fc.assert(
        fc.asyncProperty(
            maskCountArb,
            scrollArb,
            scrollArb,
            async (maskCount, scrollTop, scrollLeft) => {
                const {
                    ctx,
                    canvas,
                    containerElement,
                    historyManager,
                    saveStateCalls,
                    loadFromStateCalls,
                    loadImageCalls,
                    removeAllMasksCalls,
                } = makeContext({
                    maskCount,
                    scrollTop,
                    scrollLeft,
                    failLoadImage: false,
                });

                await mergeMasks(ctx);

                // the documented contract — the pre-merge snapshot is captured
                // before any canvas mutation. The merge calls
                // `discardActiveObject` and `renderAll` immediately
                // before `saveState`, so the only canvas calls allowed
                // before the first snapshot are those two idempotent
                // pre-flight operations. Mask removal and the merged
                // bitmap render must come after.
                assert.ok(
                    saveStateCalls.length >= 1,
                    'the documented contract: saveState must be called to capture the pre-merge snapshot',
                );
                const firstCapture = saveStateCalls[0];
                const callsBeforeFirstSnapshot = canvas.callOrder.slice(
                    0,
                    firstCapture.canvasCallsAtCapture,
                );
                for (const call of callsBeforeFirstSnapshot) {
                    assert.ok(
                        call === 'discardActiveObject' || call === 'renderAll',
                        `the documented contract: only discardActiveObject/renderAll may run before the pre-merge snapshot; saw "${call}"`,
                    );
                }
                // The merged-bitmap render and the mask drain must
                // happen after the snapshot capture.
                assert.ok(
                    !callsBeforeFirstSnapshot.includes('toDataURL'),
                    'the documented contract: toDataURL (merged render) must not run before the pre-merge snapshot',
                );
                assert.equal(
                    removeAllMasksCalls.length,
                    1,
                    'mergeMasks must drain masks via removeAllMasksNoHistory exactly once on success',
                );
                assert.ok(
                    removeAllMasksCalls[0] >= firstCapture.canvasCallsAtCapture,
                    'the documented contract: mask drain must not precede the pre-merge snapshot',
                );

                // The merge captures both a pre-merge and a post-merge
                // snapshot on success (the second feeds the command's
                // `execute`).
                assert.equal(
                    saveStateCalls.length,
                    2,
                    'the documented contract: success path captures pre-merge and post-merge snapshots',
                );
                const beforeSnap = saveStateCalls[0].snap;
                const afterSnap = saveStateCalls[1].snap;
                assert.notEqual(
                    beforeSnap,
                    afterSnap,
                    'pre-merge and post-merge snapshots must differ for the history entry to be pushed',
                );

                // The inner transactional load is invoked exactly once
                // with `preserveScroll: true` so merge success preserves
                // the caller's scroll position.
                assert.equal(loadImageCalls.length, 1);
                assert.equal(
                    loadImageCalls[0].options?.preserveScroll,
                    true,
                    'the documented contract: mergeMasks must request preserveScroll on the inner loadImage',
                );

                // the documented contract — container scroll preserved across
                // the success path. The defensive restore at the tail
                // of the merge guarantees this regardless of layout.
                assert.equal(
                    containerElement.scrollTop,
                    scrollTop,
                    'the documented contract: container scrollTop must be preserved across mergeMasks',
                );
                assert.equal(
                    containerElement.scrollLeft,
                    scrollLeft,
                    'the documented contract: container scrollLeft must be preserved across mergeMasks',
                );

                // the documented contract — exactly one history entry pushed.
                assert.equal(
                    historyManager.history.length,
                    1,
                    'the documented contract: success must push exactly one history entry',
                );
                const cmd = historyManager.history[0];

                // the documented contract — the command's `undo` restores the
                // pre-merge snapshot and `execute` re-applies the
                // merged snapshot. Drive each callback once and inspect
                // the resulting `loadFromState` calls.
                const restoresBefore = loadFromStateCalls.length;
                await cmd.undo();
                const undoArg = loadFromStateCalls[restoresBefore];
                assert.equal(
                    undoArg,
                    beforeSnap,
                    'the documented contract: command.undo() must restore the pre-merge snapshot',
                );
                await cmd.execute();
                const execArg = loadFromStateCalls[restoresBefore + 1];
                assert.equal(
                    execArg,
                    afterSnap,
                    'the documented contract: command.execute() must re-apply the merged snapshot',
                );

                // The success path must NOT have invoked
                // `loadFromState` directly during the merge — the
                // post-merge restore on success goes through the inner
                // `loadImage`, not through the rollback channel.
                // (The two extra calls observed above are the test's
                // own `cmd.undo()` / `cmd.execute()` drives, and they
                // landed at indices restoresBefore and restoresBefore+1.)
                assert.equal(
                    restoresBefore,
                    0,
                    'the documented contract: success path must not call loadFromState (no rollback)',
                );
            },
        ),
        { numRuns: 100 },
    );
});

test('failed merge — pre-merge snapshot captured and restored, promise rejects with MergeMasksError, no history entry pushed', async () => {
    await fc.assert(
        fc.asyncProperty(maskCountArb, async (maskCount) => {
            const {
                ctx,
                canvas,
                historyManager,
                saveStateCalls,
                loadFromStateCalls,
                loadImageCalls,
            } = makeContext({
                maskCount,
                scrollTop: 0,
                scrollLeft: 0,
                failLoadImage: true,
            });

            const rejection = await mergeMasks(ctx).then(
                () => null,
                (err) => err,
            );

            // the documented contract — the promise rejects with
            // `MergeMasksError`. The original cause is preserved on
            // `originalError` per the documented error-class contract.
            assert.ok(
                rejection instanceof MergeMasksError,
                'the documented contract: failure must reject with MergeMasksError',
            );

            // the documented contract — even on failure, the pre-merge
            // snapshot must have been captured before any mutation.
            assert.ok(
                saveStateCalls.length >= 1,
                'the documented contract: pre-merge snapshot must be captured even on the failure path',
            );
            const firstCapture = saveStateCalls[0];
            const callsBeforeFirstSnapshot = canvas.callOrder.slice(
                0,
                firstCapture.canvasCallsAtCapture,
            );
            for (const call of callsBeforeFirstSnapshot) {
                assert.ok(
                    call === 'discardActiveObject' || call === 'renderAll',
                    `the documented contract: only discardActiveObject/renderAll may run before the pre-merge snapshot; saw "${call}"`,
                );
            }

            // the documented contract — the rollback path calls
            // `loadFromState` with the pre-merge snapshot.
            const beforeSnap = firstCapture.snap;
            assert.ok(
                loadFromStateCalls.length >= 1,
                'the documented contract: failure path must call loadFromState to restore the pre-merge snapshot',
            );
            assert.equal(
                loadFromStateCalls[loadFromStateCalls.length - 1],
                beforeSnap,
                'the documented contract: the rollback restore must target the pre-merge snapshot',
            );

            // The failure injection happens inside the inner
            // `loadImage`, so the merge must have reached step 7
            // (matching the documented documented step ordering).
            assert.equal(
                loadImageCalls.length,
                1,
                'failure injection point: inner loadImage was attempted exactly once',
            );

            // No history entry is pushed when the merge rolls back. The history manager is
            // empty.
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
        }),
        { numRuns: 100 },
    );
});
