/**
 * Type:
 *   Unit regression test
 *
 * Purpose:
 *   Verifies mixed ActiveSelection handling for editable overlay actions.
 *
 * Scope:
 *   - deleteSelectedEditableObjects removes masks and unlocked annotations only.
 *   - removeSelectedAnnotationAction ignores masks and locked annotations.
 *   - updateSelectedAnnotationAction updates unlocked annotations only.
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';

const {
    deleteSelectedEditableObjects,
    removeSelectedAnnotationAction,
    updateSelectedAnnotationAction,
} = await import('../src/overlay/editable-object-actions.ts');

function mask(id) {
    return {
        editorObjectKind: 'mask',
        maskId: id,
        maskUid: `mask-${id}`,
        maskName: `Mask ${id}`,
    };
}

function annotation(id, overrides = {}) {
    return {
        editorObjectKind: 'annotation',
        annotationId: id,
        annotationType: overrides.annotationType ?? 'text',
        annotationName: `Annotation ${id}`,
        set(patch) {
            Object.assign(this, patch);
        },
        setCoords() {},
        ...overrides,
    };
}

function baseImage() {
    return { editorObjectKind: 'baseImage' };
}

function session() {
    return { editorObjectKind: 'session', sessionObjectType: 'cropRect' };
}

function activeSelection(objects) {
    return {
        type: 'activeselection',
        isType: (...types) =>
            types.includes('ActiveSelection') || types.includes('activeSelection'),
        getObjects: () => objects,
    };
}

function createCanvas(objects, selectedObjects) {
    return {
        objects: objects.slice(),
        activeObject: activeSelection(selectedObjects),
        getActiveObject() {
            return this.activeObject;
        },
        getObjects() {
            return this.objects.slice();
        },
        remove(object) {
            this.objects = this.objects.filter((candidate) => candidate !== object);
        },
        discardActiveObject() {
            this.activeObject = null;
        },
        renderAll() {},
        requestRenderAll() {},
    };
}

function createAccess(canvas) {
    const calls = [];
    const access = {
        calls,
        getCanvas: () => canvas,
        getLiveCanvas: () => canvas,
        buildAnnotationManagerContext: () => ({
            canvas,
            saveCanvasState: () => calls.push('managerSaveState'),
            updateUi: () => calls.push('managerUpdateUi'),
        }),
        getMasks: () => canvas.getObjects().filter((object) => object.editorObjectKind === 'mask'),
        getAnnotations: () =>
            canvas.getObjects().filter((object) => object.editorObjectKind === 'annotation'),
        removeLabelForMask: (target) => calls.push(['removeLabelForMask', target.maskId]),
        withSelectionChangeContext: (_context, callback) => callback(),
        buildCallbackContext: (operation, isInternalOperation) => ({
            operation,
            isInternalOperation,
        }),
        saveState: () => calls.push('saveState'),
        updateMaskList: () => calls.push('updateMaskList'),
        updateAnnotationList: () => calls.push('updateAnnotationList'),
        updateUi: () => calls.push('updateUi'),
        emitMasksChanged: (context) => calls.push(['emitMasksChanged', context.operation]),
        emitAnnotationsChanged: (context) =>
            calls.push(['emitAnnotationsChanged', context.operation]),
        emitImageChanged: (context) => calls.push(['emitImageChanged', context.operation]),
        reportWarning: (message) => calls.push(['warning', message]),
    };
    return access;
}

test('deleteSelectedEditableObjects removes masks and unlocked annotations only', () => {
    const selectedMask = mask(1);
    const unlockedText = annotation(1, { annotationType: 'text' });
    const lockedDraw = annotation(2, { annotationType: 'draw', annotationLocked: true });
    const base = baseImage();
    const transient = session();
    const canvas = createCanvas(
        [base, selectedMask, unlockedText, lockedDraw, transient],
        [selectedMask, unlockedText, lockedDraw, base, transient],
    );
    const access = createAccess(canvas);
    const context = { operation: 'deleteSelectedObject', isInternalOperation: false };

    deleteSelectedEditableObjects(access, context);

    assert.deepEqual(canvas.getObjects(), [base, lockedDraw, transient]);
    assert.equal(access.calls.filter((call) => call === 'saveState').length, 1);
    assert.deepEqual(
        access.calls.filter((call) => Array.isArray(call) && call[0].startsWith('emit')),
        [
            ['emitMasksChanged', 'deleteSelectedObject'],
            ['emitAnnotationsChanged', 'deleteSelectedObject'],
            ['emitImageChanged', 'deleteSelectedObject'],
        ],
    );
});

test('removeSelectedAnnotationAction removes selected unlocked annotations only', () => {
    const selectedMask = mask(1);
    const unlockedText = annotation(1);
    const lockedDraw = annotation(2, { annotationType: 'draw', annotationLocked: true });
    const canvas = createCanvas(
        [selectedMask, unlockedText, lockedDraw],
        [selectedMask, unlockedText, lockedDraw],
    );
    const access = createAccess(canvas);
    const context = { operation: 'removeSelectedAnnotation', isInternalOperation: false };

    removeSelectedAnnotationAction(access, context);

    assert.deepEqual(canvas.getObjects(), [selectedMask, lockedDraw]);
    assert.deepEqual(
        access.calls.filter((call) => Array.isArray(call) && call[0].startsWith('emit')),
        [
            ['emitAnnotationsChanged', 'removeSelectedAnnotation'],
            ['emitImageChanged', 'removeSelectedAnnotation'],
        ],
    );
});

test('updateSelectedAnnotationAction updates selected unlocked annotations only', () => {
    const selectedMask = mask(1);
    const unlockedText = annotation(1, { fill: '#000000' });
    const lockedDraw = annotation(2, {
        annotationType: 'draw',
        annotationLocked: true,
        stroke: '#111111',
    });
    const canvas = createCanvas(
        [selectedMask, unlockedText, lockedDraw],
        [selectedMask, unlockedText, lockedDraw],
    );
    const access = createAccess(canvas);
    const context = { operation: 'updateSelectedAnnotation', isInternalOperation: false };

    updateSelectedAnnotationAction(access, { fill: '#ff0000', stroke: '#00ff00' }, context);

    assert.equal(unlockedText.fill, '#ff0000');
    assert.equal(lockedDraw.stroke, '#111111');
    assert.equal(selectedMask.fill, undefined);
    assert.deepEqual(
        access.calls.filter((call) => Array.isArray(call) && call[0].startsWith('emit')),
        [
            ['emitAnnotationsChanged', 'updateSelectedAnnotation'],
            ['emitImageChanged', 'updateSelectedAnnotation'],
        ],
    );
});
