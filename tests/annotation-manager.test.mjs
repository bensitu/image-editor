/**
 * Type:
 *   Unit test
 *
 * Purpose:
 *   Verifies annotation manager helpers that are independent of the editor facade.
 *
 * Scope:
 *   - Fabric setter failures are propagated without raw property assignment.
 *   - Annotation list click selection resolves the current canvas at click time.
 *
 * Out of scope:
 *   - demo page behavior
 *   - documentation rendering
 *   - browser pointer integration
 *
 * Environment:
 *   - Node.js ESM
 *   - JSDOM for list DOM behavior
 *   - focused Fabric/canvas stubs
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const { renderAnnotationList, updateAnnotationObject } =
    await import('../src/annotation/annotation-manager.ts');
const { syncAnnotationRuntimeState } = await import('../src/annotation/annotation-style.ts');

function makeAnnotation(id, overrides = {}) {
    return {
        editorObjectKind: 'annotation',
        annotationId: id,
        annotationType: 'draw',
        annotationName: `draw${id}`,
        visible: true,
        selectable: true,
        evented: true,
        hasControls: true,
        stroke: '#000000',
        strokeWidth: 1,
        opacity: 1,
        set(props) {
            Object.assign(this, props);
            return this;
        },
        setCoords() {},
        ...overrides,
    };
}

function makeCanvas(objects) {
    return {
        objects: [...objects],
        activeObject: null,
        getObjects() {
            return this.objects;
        },
        setActiveObject(object) {
            this.activeObject = object;
        },
    };
}

test('syncAnnotationRuntimeState propagates Fabric set failures without assigning props', () => {
    const setError = new Error('set failed');
    const annotation = makeAnnotation(1, {
        annotationHidden: true,
        annotationLocked: true,
        set() {
            throw setError;
        },
    });

    assert.throws(
        () => syncAnnotationRuntimeState(annotation),
        (error) => error === setError,
    );
    assert.equal(annotation.visible, true, 'visible must not be assigned after set failure');
    assert.equal(annotation.selectable, true, 'selectable must not be assigned after set failure');
    assert.equal(annotation.evented, true, 'evented must not be assigned after set failure');
    assert.equal(
        annotation.hasControls,
        true,
        'hasControls must not be assigned after set failure',
    );
});

test('updateAnnotationObject propagates Fabric set failures without assigning props', () => {
    const setError = new Error('set failed');
    const annotation = makeAnnotation(2, {
        set() {
            throw setError;
        },
    });

    assert.throws(
        () => updateAnnotationObject(annotation, { stroke: '#ff0000' }),
        (error) => error === setError,
    );
    assert.equal(annotation.stroke, '#000000');
});

test('renderAnnotationList click resolves the current canvas from context', () => {
    const dom = new JSDOM('<!DOCTYPE html><body><ul id="annotationList"></ul></body>');
    const oldAnnotation = makeAnnotation(3, { annotationName: 'old' });
    const newAnnotation = makeAnnotation(3, { annotationName: 'new' });
    const oldCanvas = makeCanvas([oldAnnotation]);
    const newCanvas = makeCanvas([newAnnotation]);
    let currentCanvas = oldCanvas;
    const selected = [];

    renderAnnotationList({
        canvas: oldCanvas,
        getCanvas: () => currentCanvas,
        getListElement: () => dom.window.document.getElementById('annotationList'),
        onAnnotationSelected: (annotation) => selected.push(annotation),
    });

    currentCanvas = newCanvas;
    dom.window.document.querySelector('li.annotation-item').click();

    assert.equal(oldCanvas.activeObject, null);
    assert.equal(newCanvas.activeObject, newAnnotation);
    assert.deepEqual(selected, [newAnnotation]);
});
