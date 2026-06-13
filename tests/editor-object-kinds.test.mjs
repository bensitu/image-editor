/**
 * Type:
 *   Unit test
 *
 * Purpose:
 *   Verifies the v2.2.0 editor-owned object foundation: strict runtime guards,
 *   centralized metadata helpers, and annotation runtime hidden/locked sync.
 *
 * Scope:
 *   - Mask guards reject legacy mask-like objects without editorObjectKind.
 *   - Object kind markers classify base images, masks, annotations, and sessions.
 *   - Annotation hidden/locked metadata synchronizes Fabric runtime flags.
 *
 * Out of scope:
 *   - Fabric rendering behavior
 *   - serialization round trips
 *   - ImageEditor facade event wiring
 *
 * Environment:
 *   - Node.js ESM
 *   - focused Fabric-like object stubs
 *
 * Run:
 *   node --test tests/editor-object-kinds.test.mjs
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    isAnnotationObject,
    isBaseImageObject,
    isDrawAnnotationObject,
    isEditableOverlayObject,
    isMaskObject,
    isSessionObject,
    isTextAnnotationObject,
} from '../src/core/public-types.ts';
import {
    markAnnotationObject,
    markBaseImageObject,
    markMaskObject,
    markSessionObject,
} from '../src/core/editor-object-kind.ts';
import { syncAnnotationRuntimeState } from '../src/annotation/annotation-style.ts';

function makeFabricLikeObject(props = {}) {
    return {
        set(patch) {
            Object.assign(this, patch);
            return this;
        },
        setCoordsCalls: 0,
        setCoords() {
            this.setCoordsCalls += 1;
        },
        ...props,
    };
}

test('strict mask guard rejects legacy mask-like objects without editorObjectKind', () => {
    assert.equal(isMaskObject({ maskId: 1, maskUid: 'mask-1', maskName: 'mask1' }), false);
    assert.equal(isMaskObject({ editorObjectKind: 'mask', maskId: 1, maskName: 'mask1' }), false);
});

test('metadata helpers classify base, mask, annotation, and session objects', () => {
    const image = markBaseImageObject(makeFabricLikeObject({ type: 'image' }));
    const mask = markMaskObject(makeFabricLikeObject({ type: 'rect' }), {
        maskId: 2,
        maskUid: 'mask-2',
        maskName: 'mask2',
        originalAlpha: 0.5,
        originalStroke: '#ccc',
        originalStrokeWidth: 1,
    });
    const text = markAnnotationObject(makeFabricLikeObject({ type: 'textbox' }), {
        annotationId: 3,
        annotationType: 'text',
        annotationName: 'text3',
    });
    const draw = markAnnotationObject(makeFabricLikeObject({ type: 'path' }), {
        annotationId: 4,
        annotationType: 'draw',
        annotationName: 'draw4',
    });
    const session = markSessionObject(makeFabricLikeObject({ type: 'rect' }), 'cropRect');

    assert.equal(isBaseImageObject(image), true);
    assert.equal(isMaskObject(mask), true);
    assert.equal(isAnnotationObject(text), true);
    assert.equal(isTextAnnotationObject(text), true);
    assert.equal(isDrawAnnotationObject(draw), true);
    assert.equal(isAnnotationObject(mask), false);
    assert.equal(isEditableOverlayObject(mask), true);
    assert.equal(isEditableOverlayObject(text), true);
    assert.equal(isSessionObject(session), true);
});

test('annotation hidden and locked metadata synchronizes Fabric runtime state', () => {
    const annotation = markAnnotationObject(makeFabricLikeObject({ type: 'textbox' }), {
        annotationId: 5,
        annotationType: 'text',
        annotationName: 'text5',
        annotationHidden: true,
        annotationLocked: true,
    });

    syncAnnotationRuntimeState(annotation);

    assert.equal(annotation.visible, false);
    assert.equal(annotation.selectable, false);
    assert.equal(annotation.evented, false);
    assert.equal(annotation.hasControls, false);
    assert.equal(annotation.lockMovementX, true);
    assert.equal(annotation.lockMovementY, true);
    assert.equal(annotation.lockScalingX, true);
    assert.equal(annotation.lockScalingY, true);
    assert.equal(annotation.lockRotation, true);
    assert.equal(annotation.editable, false);
    assert.equal(annotation.setCoordsCalls, 1);

    annotation.annotationHidden = false;
    annotation.annotationLocked = false;
    syncAnnotationRuntimeState(annotation);

    assert.equal(annotation.visible, true);
    assert.equal(annotation.selectable, true);
    assert.equal(annotation.evented, true);
    assert.equal(annotation.hasControls, true);
    assert.equal(annotation.lockMovementX, false);
    assert.equal(annotation.lockMovementY, false);
    assert.equal(annotation.lockScalingX, false);
    assert.equal(annotation.lockScalingY, false);
    assert.equal(annotation.lockRotation, false);
    assert.equal(annotation.editable, true);
    assert.equal(annotation.setCoordsCalls, 2);

    annotation.annotationLocked = undefined;
    syncAnnotationRuntimeState(annotation);

    assert.equal(annotation.selectable, true);
    assert.equal(annotation.evented, true);
    assert.equal(annotation.editable, true);
});
