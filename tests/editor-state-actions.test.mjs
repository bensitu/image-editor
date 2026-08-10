/**
 * Type:
 *   Unit test
 *
 * Purpose:
 *   Verifies history/editor-state action behavior that sits above the raw
 *   state serializer.
 *
 * Scope:
 *   - Snapshot capture records active mask identity only when Fabric reports
 *     the mask as the current active object.
 *
 * Environment:
 *   - Node.js ESM
 *   - Source TypeScript loaded through the test resolver hook
 *
 * Run:
 *   node --import ./tests/helpers/register-ts-loader.mjs --test tests/editor-state-actions.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

const { captureSnapshotAction, loadFromStateAction } =
    await import('../src/history/editor-state-actions.ts');
const { resolveOptions } = await import('../src/core/default-options.ts');

const neutralImageFilterConfig = Object.freeze({
    brightness: 0,
    contrast: 0,
    saturation: 0,
    blur: 0,
    sharpen: 0,
    grayscale: false,
    sepia: false,
    vintage: false,
});

function makeMask() {
    return {
        editorObjectKind: 'mask',
        type: 'rect',
        maskId: 7,
        maskUid: 'mask-7',
        maskName: 'mask7',
        labelObject: { maskLabel: true },
    };
}

function makeCanvas({ activeObject = null } = {}) {
    const mask = makeMask();
    return {
        width: 100,
        height: 80,
        objects: [mask],
        getObjects() {
            return this.objects.slice();
        },
        getActiveObject() {
            return activeObject;
        },
        toJSON() {
            return {
                version: '7.0.0',
                width: this.width,
                height: this.height,
                objects: this.objects.map((object) => ({ type: object.type })),
            };
        },
        mask,
    };
}

function makeAccess(canvas) {
    return {
        getCanvas: () => canvas,
        getCurrentScale: () => 1,
        getCurrentRotation: () => 0,
        getBaseImageScale: () => 1,
        getCurrentImageMimeType: () => 'image/png',
        getCurrentImageFilterConfig: () => neutralImageFilterConfig,
        hideAllMaskLabels: () => {},
    };
}

test('captureSnapshotAction does not infer active mask from a lone visible label', () => {
    const canvas = makeCanvas();

    const snapshot = captureSnapshotAction(makeAccess(canvas));
    const json = JSON.parse(snapshot);

    assert.equal(json._editorState.activeObjectKind, null);
    assert.equal('activeMaskId' in json._editorState, false);
});

test('captureSnapshotAction preserves explicit active mask identity', () => {
    const baseCanvas = makeCanvas();
    const canvas = makeCanvas({ activeObject: baseCanvas.mask });
    canvas.objects = [baseCanvas.mask];

    const snapshot = captureSnapshotAction(makeAccess(canvas));
    const json = JSON.parse(snapshot);

    assert.equal(json._editorState.activeObjectKind, 'mask');
    assert.equal(json._editorState.activeMaskId, 7);
});

test('loadFromStateAction restores the pre-call state after Fabric mutates and rejects', async () => {
    const restoreError = new Error('Fabric restore failed');
    const callbacks = [];
    const errors = [];
    const warnings = [];
    const originalObject = { type: 'rect', left: 12, top: 18, width: 20, height: 30 };
    const canvas = {
        width: 100,
        height: 80,
        objects: [originalObject],
        activeObject: null,
        loadCount: 0,
        renderOnAddRemove: true,
        getObjects() {
            return this.objects.slice();
        },
        getActiveObject() {
            return this.activeObject;
        },
        discardActiveObject() {
            this.activeObject = null;
        },
        setActiveObject(object) {
            this.activeObject = object;
        },
        toJSON() {
            return {
                version: '7.0.0',
                width: this.width,
                height: this.height,
                objects: structuredClone(this.objects),
            };
        },
        async loadFromJSON(json) {
            this.loadCount += 1;
            const previousRenderOnAddRemove = this.renderOnAddRemove;
            this.renderOnAddRemove = false;
            this.width = json.width;
            this.height = json.height;
            this.objects = structuredClone(json.objects ?? []);
            if (this.loadCount === 1) throw restoreError;
            this.renderOnAddRemove = previousRenderOnAddRemove;
            return this;
        },
        renderAll() {},
        sendObjectToBack() {},
    };
    const runtime = {
        originalImage: null,
        currentScale: 1.25,
        currentRotation: 90,
        baseImageScale: 0.75,
        currentImageMimeType: null,
        currentImageFilterConfig: neutralImageFilterConfig,
        isImageLoadedToCanvas: false,
        maskCounter: 3,
        annotationCounter: 4,
        lastMask: null,
        lastSnapshot: 'existing-history-baseline',
    };
    const options = resolveOptions({
        onError: (error) => errors.push(error),
        onWarning: (error) => warnings.push(error),
    });
    const access = {
        getCanvas: () => canvas,
        getLiveCanvas: () => canvas,
        getOptions: () => options,
        isDisposed: () => false,
        canRunIdleOperation: () => true,
        getActiveStateRestoreOperation: () => null,
        buildCallbackContext: (operation, isInternalOperation) => ({
            operation,
            isInternalOperation,
        }),
        getOriginalImage: () => runtime.originalImage,
        setOriginalImage: (image) => {
            runtime.originalImage = image;
        },
        getMaskCollectionSignature: () => '[]',
        getAnnotationCollectionSignature: () => '[]',
        setCanvasSize: (width, height) => {
            canvas.width = width;
            canvas.height = height;
        },
        hideAllMaskLabels: () => {},
        inferCurrentImageMimeType: () => null,
        setCurrentImageMimeType: (mimeType) => {
            runtime.currentImageMimeType = mimeType;
        },
        getCurrentImageFilterConfig: () => runtime.currentImageFilterConfig,
        restoreImageFilterConfig: (config) => {
            runtime.currentImageFilterConfig = config ?? neutralImageFilterConfig;
        },
        setIsImageLoadedToCanvas: (value) => {
            runtime.isImageLoadedToCanvas = value;
        },
        setMaskCounter: (value) => {
            runtime.maskCounter = value;
        },
        setAnnotationCounter: (value) => {
            runtime.annotationCounter = value;
        },
        setCurrentScale: (value) => {
            runtime.currentScale = value;
        },
        setCurrentRotation: (value) => {
            runtime.currentRotation = value;
        },
        setBaseImageScale: (value) => {
            runtime.baseImageScale = value;
        },
        setLastMask: (mask) => {
            runtime.lastMask = mask;
        },
        getLastSnapshot: () => runtime.lastSnapshot,
        setLastSnapshot: (snapshot) => {
            runtime.lastSnapshot = snapshot;
        },
        shouldNormalizeCanvasSizeAfterStateRestore: () => false,
        updateCanvasSizeToImageBounds: () => {},
        alignObjectBoundingBoxToCanvasTopLeft: () => {},
        settleFitCoverScrollbarsAfterStateRestore: () => {},
        buildTextControllerContext: () => ({}),
        updateInputs: () => {},
        updateMaskList: () => {},
        updateAnnotationList: () => {},
        updateUi: () => {},
        emitImageCleared: () => callbacks.push('imageCleared'),
        emitMasksChanged: () => callbacks.push('masksChanged'),
        emitAnnotationsChanged: () => callbacks.push('annotationsChanged'),
        emitImageChanged: () => callbacks.push('imageChanged'),
        withSelectionChangeContext: (_context, callback) => callback(),
        handleSelectionChanged: () => callbacks.push('selectionChanged'),
        shouldSuppressSaveState: () => false,
        getCurrentScale: () => runtime.currentScale,
        getCurrentRotation: () => runtime.currentRotation,
        getBaseImageScale: () => runtime.baseImageScale,
        getCurrentImageMimeType: () => runtime.currentImageMimeType,
        getHistoryManager: () => ({ push() {} }),
        withAnimationQueueBypass: () => ({}),
        showLabelForMask: () => {},
        updateMaskListSelection: () => {},
        updateAnnotationListSelection: () => {},
    };
    const targetState = JSON.stringify({
        version: '7.0.0',
        width: 320,
        height: 240,
        objects: [{ type: 'rect', left: 200, top: 150, width: 60, height: 40 }],
        _editorState: {
            currentScale: 2,
            currentRotation: 180,
            baseImageScale: 1.5,
            activeObjectKind: null,
        },
    });

    await assert.rejects(loadFromStateAction(access, targetState), (error) => {
        assert.equal(error, restoreError);
        return true;
    });

    assert.equal(canvas.loadCount, 2);
    assert.equal(canvas.renderOnAddRemove, true);
    assert.deepEqual(
        { width: canvas.width, height: canvas.height, objects: canvas.objects },
        { width: 100, height: 80, objects: [originalObject] },
    );
    assert.equal(runtime.currentScale, 1.25);
    assert.equal(runtime.currentRotation, 90);
    assert.equal(runtime.baseImageScale, 0.75);
    assert.equal(runtime.currentImageMimeType, null);
    assert.equal(runtime.lastSnapshot, 'existing-history-baseline');
    assert.deepEqual(callbacks, []);
    assert.deepEqual(errors, [restoreError]);
    assert.deepEqual(warnings, []);
});
