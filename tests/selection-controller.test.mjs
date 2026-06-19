/**
 * Type:
 *   Unit test
 *
 * Purpose:
 *   Verifies the selection/object-event controller independently from the
 *   ImageEditor facade.
 *
 * Scope:
 *   - Mask selection styling and label/list synchronization.
 *   - Mask/object modification callback emission.
 *   - Annotation lock handling during modification.
 *   - Selection callback context fallback rules.
 *
 * Out of scope:
 *   - Fabric event dispatch.
 *   - DOM list rendering.
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';

const { handleObjectModified, handleObjectMovingScalingRotating, handleSelectionChanged } =
    await import('../src/selection/editor-selection-controller.ts');

function createMask(id, overrides = {}) {
    return {
        editorObjectKind: 'mask',
        maskId: id,
        maskUid: `mask-${id}`,
        maskName: `Mask ${id}`,
        originalAlpha: 0.5,
        originalStroke: '#00f',
        originalStrokeWidth: 3,
        labelObject: null,
        set(patch) {
            Object.assign(this, patch);
        },
        ...overrides,
    };
}

function createAnnotation(id, overrides = {}) {
    return {
        editorObjectKind: 'annotation',
        annotationId: id,
        annotationType: 'text',
        annotationName: `Annotation ${id}`,
        ...overrides,
    };
}

function createCanvas(objects) {
    return {
        renderRequested: false,
        getObjects() {
            return objects;
        },
        requestRenderAll() {
            this.renderRequested = true;
        },
    };
}

function createAccess(overrides = {}) {
    const calls = [];
    const canvas = overrides.canvas ?? createCanvas([]);
    const contexts = {
        fallback: { operation: 'createMask', isInternalOperation: false },
        history: { operation: 'undo', isInternalOperation: true },
        saveState: { operation: 'saveState', isInternalOperation: false },
        updateAnnotation: { operation: 'updateAnnotation', isInternalOperation: false },
    };
    const access = {
        calls,
        getCanvas: () => canvas,
        removeLabelForMask: (mask) => {
            calls.push(['removeLabelForMask', mask.maskId]);
            mask.labelObject = null;
        },
        showLabelForMask: (mask) => {
            calls.push(['showLabelForMask', mask.maskId]);
        },
        syncMaskLabel: (mask) => {
            calls.push(['syncMaskLabel', mask.maskId]);
        },
        updateMaskListSelection: (mask) => {
            calls.push(['updateMaskListSelection', mask?.maskId ?? null]);
        },
        updateAnnotationListSelection: (annotation) => {
            calls.push(['updateAnnotationListSelection', annotation?.annotationId ?? null]);
        },
        updateUi: () => {
            calls.push(['updateUi']);
        },
        saveState: () => {
            calls.push(['saveState']);
        },
        getNextSelectionChangeContext: () => null,
        getActiveStateRestoreOperation: () => null,
        buildSelection: (selected) => ({
            selectedMask: selected.find((object) => object.editorObjectKind === 'mask') ?? null,
            selectedMasks: selected.filter((object) => object.editorObjectKind === 'mask'),
            selectedAnnotation:
                selected.find((object) => object.editorObjectKind === 'annotation') ?? null,
            selectedAnnotations: selected.filter(
                (object) => object.editorObjectKind === 'annotation',
            ),
            selectedObjectKind: null,
        }),
        buildCallbackContext: (operation, isInternalOperation) =>
            contexts[operation] ?? { operation, isInternalOperation },
        emitSelectionChange: (selection, context) => {
            calls.push(['emitSelectionChange', selection.selectedMask?.maskId ?? null, context]);
        },
        emitMasksChanged: (context) => {
            calls.push(['emitMasksChanged', context]);
        },
        emitAnnotationsChanged: (context) => {
            calls.push(['emitAnnotationsChanged', context]);
        },
        emitImageChanged: (context) => {
            calls.push(['emitImageChanged', context]);
        },
        ...overrides,
    };
    return access;
}

test('selected mask path applies selected style, shows label, and syncs lists', () => {
    const selectedMask = createMask(1);
    const otherMask = createMask(2, { labelObject: { editorObjectKind: 'session' } });
    const canvas = createCanvas([selectedMask, otherMask]);
    const access = createAccess({ canvas });

    handleSelectionChanged(access, [selectedMask]);

    assert.equal(selectedMask.stroke, '#ff0000');
    assert.equal(selectedMask.strokeWidth, 1);
    assert.equal(otherMask.stroke, '#00f');
    assert.equal(otherMask.strokeWidth, 3);
    assert.equal(canvas.renderRequested, true);
    assert.deepEqual(access.calls.slice(0, 4), [
        ['removeLabelForMask', 2],
        ['showLabelForMask', 1],
        ['updateMaskListSelection', 1],
        ['updateAnnotationListSelection', null],
    ]);
});

test('unselected mask label removal runs when selection moves away', () => {
    const mask = createMask(1, { labelObject: { editorObjectKind: 'session' } });
    const annotation = createAnnotation(1);
    const access = createAccess({ canvas: createCanvas([mask, annotation]) });

    handleSelectionChanged(access, [annotation]);

    assert.equal(mask.labelObject, null);
    assert.deepEqual(access.calls[0], ['removeLabelForMask', 1]);
    assert.deepEqual(access.calls[1], ['updateMaskListSelection', null]);
    assert.deepEqual(access.calls[2], ['updateAnnotationListSelection', 1]);
});

test('mask label is synced while a mask is transformed', () => {
    const mask = createMask(1);
    const access = createAccess();

    handleObjectMovingScalingRotating(access, mask);

    assert.deepEqual(access.calls, [['syncMaskLabel', 1]]);
});

test('mask modification saves state and emits mask/image changes', () => {
    const mask = createMask(1);
    const access = createAccess();

    handleObjectModified(access, mask);

    assert.deepEqual(access.calls, [
        ['syncMaskLabel', 1],
        ['saveState'],
        ['emitMasksChanged', { operation: 'saveState', isInternalOperation: false }],
        ['emitImageChanged', { operation: 'saveState', isInternalOperation: false }],
    ]);
});

test('locked annotation modification is ignored', () => {
    const annotation = createAnnotation(1, { annotationLocked: true });
    const access = createAccess();

    handleObjectModified(access, annotation);

    assert.deepEqual(access.calls, []);
});

test('unlocked annotation modification saves state and emits annotation/image changes', () => {
    const annotation = createAnnotation(1);
    const access = createAccess();

    handleObjectModified(access, annotation);

    assert.deepEqual(access.calls, [
        ['saveState'],
        ['emitAnnotationsChanged', { operation: 'updateAnnotation', isInternalOperation: false }],
        ['emitImageChanged', { operation: 'updateAnnotation', isInternalOperation: false }],
    ]);
});

test('selection callback uses provided next selection context', () => {
    const nextContext = { operation: 'createMask', isInternalOperation: false };
    const mask = createMask(1);
    const access = createAccess({
        canvas: createCanvas([mask]),
        getNextSelectionChangeContext: () => nextContext,
    });

    handleSelectionChanged(access, [mask]);

    assert.deepEqual(access.calls.at(-1), ['emitSelectionChange', 1, nextContext]);
});

test('selection callback falls back to history restore context when active', () => {
    const mask = createMask(1);
    const access = createAccess({
        canvas: createCanvas([mask]),
        getActiveStateRestoreOperation: () => 'undo',
    });

    handleSelectionChanged(access, [mask]);

    assert.deepEqual(access.calls.at(-1), [
        'emitSelectionChange',
        1,
        { operation: 'undo', isInternalOperation: true },
    ]);
});
