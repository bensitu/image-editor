/**
 * Type:
 *   Unit test
 *
 * Purpose:
 *   Verifies facade runtime wiring behavior that is difficult to exercise
 *   directly through a single focused controller.
 *
 * Scope:
 *   - Merged-image loading restores display geometry even when the inner
 *     transactional image load rejects.
 *
 * Out of scope:
 *   - Full merge/export integration, covered by merge tests.
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';

const { resolveOptions } = await import('../src/core/default-options.ts');
const { EditorRuntime } = await import('../src/runtime/editor-runtime.ts');
const { createEditorRuntimeWiring } = await import('../src/runtime/editor-facade-wiring.ts');

function noop() {}

function makeRuntime() {
    const runtime = new EditorRuntime({}, true, resolveOptions({}));
    runtime.canvas = {
        getObjects: () => [],
        getActiveObject: () => null,
        discardActiveObject: () => {},
        getWidth: () => 1,
        getHeight: () => 1,
    };
    return runtime;
}

function makeHooks({ loadImage, restoreMergedImageDisplayGeometry }) {
    return {
        operations: {
            canRunIdleOperation: () => true,
            assertIdleForOperation: noop,
            assertCanQueueAnimation: noop,
            finalizeActiveTextEditingIfNeeded: noop,
            withSelectionChangeContext: (_context, callback) => callback(),
            withInternalOperationOptions: (_token, options = {}) => options,
            withAnimationQueueBypass: (options = {}) => options,
        },
        state: {
            saveCanvasState: noop,
            captureSnapshot: () => '{}',
            loadImage,
            loadFromState: async () => {},
        },
        display: {
            inferCurrentImageMimeType: () => null,
            shouldNormalizeCanvasSizeAfterStateRestore: () => false,
            updateCanvasSizeToImageBounds: noop,
            alignObjectBoundingBoxToCanvasTopLeft: noop,
            settleFitCoverScrollbarsAfterStateRestore: noop,
            setCanvasSize: noop,
            captureImageDisplayGeometry: () => ({ canvasWidth: 1, canvasHeight: 1 }),
            restoreMergedImageDisplayGeometry,
        },
        selection: {
            buildSelection: () => ({ type: 'none', object: null }),
            handleSelectionChanged: noop,
            getMasks: () => [],
            getAnnotations: () => [],
            getMaskCollectionSignature: () => '',
            getAnnotationCollectionSignature: () => '',
        },
        ui: {
            refreshUiAfterQueuedAnimation: noop,
            updateInputs: noop,
            updateMaskList: noop,
            updateMaskListSelection: noop,
            updateAnnotationList: noop,
            updateAnnotationListSelection: noop,
            updateUi: noop,
        },
        labels: {
            removeLabelForMask: noop,
            showLabelForMask: noop,
            syncMaskLabel: noop,
            hideAllMaskLabels: noop,
        },
        config: {
            updateSelectedAnnotation: noop,
            setTextColor: noop,
            setTextFontSize: noop,
            setDrawColor: noop,
            setDrawBrushSize: noop,
        },
        callbacks: {
            buildCallbackContext: (operation, isInternalOperation = false) => ({
                operation,
                isInternalOperation,
            }),
            emitImageCleared: noop,
            emitSelectionChange: noop,
            emitMasksChanged: noop,
            emitAnnotationsChanged: noop,
            emitImageChanged: noop,
            emitBusyChangeIfChanged: noop,
            reportWarning: noop,
        },
    };
}

test('loadMergedImage restores display geometry when image loading rejects', async () => {
    let restoredGeometry = null;
    const runtime = makeRuntime();
    const hooks = makeHooks({
        loadImage: async () => {
            throw new Error('load failed');
        },
        restoreMergedImageDisplayGeometry: (geometry) => {
            restoredGeometry = geometry;
        },
    });
    const wiring = createEditorRuntimeWiring(runtime, hooks);
    const mergeContext = wiring.contextFactory.buildMergeMasksContext();

    await assert.rejects(() => mergeContext.loadImage('data:image/png;base64,AAAA'), /load failed/);

    assert.deepEqual(restoredGeometry, { canvasWidth: 1, canvasHeight: 1 });
});
