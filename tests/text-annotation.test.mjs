/**
 * Type:
 *   Unit test
 *
 * Purpose:
 *   Verifies Text annotation creation behavior that should feel natural in
 *   host applications.
 *
 * Scope:
 *   - createTextAnnotation enters edit mode for new text.
 *   - The default text is selected so the first user keystroke replaces it.
 *
 * Environment:
 *   - Node.js ESM
 *   - focused Fabric/canvas stubs
 *
 * Run:
 *   node --test tests/text-annotation.test.mjs
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';

const { resolveOptions } = await import('../src/core/default-options.ts');
const { createTextAnnotation } = await import('../src/annotation/text-controller.ts');

class FakeTextbox {
    constructor(text, props = {}) {
        this.text = text;
        Object.assign(this, props);
        this.handlers = new Map();
        this.selectAllCalls = 0;
    }

    set(props) {
        Object.assign(this, props);
    }

    on(event, callback) {
        this.handlers.set(event, callback);
    }

    off(event, callback) {
        if (this.handlers.get(event) === callback) this.handlers.delete(event);
    }

    enterEditing() {
        this.isEditing = true;
        this.handlers.get('editing:entered')?.();
    }

    selectAll() {
        this.selectAllCalls += 1;
        this.selectionStart = 0;
        this.selectionEnd = String(this.text ?? '').length;
    }
}

class FakeCanvas {
    constructor() {
        this.objects = [];
        this.activeObject = null;
    }

    add(object) {
        this.objects.push(object);
    }

    remove(object) {
        this.objects = this.objects.filter((item) => item !== object);
    }

    insertAt(index, object) {
        this.objects.splice(index, 0, object);
    }

    getObjects() {
        return this.objects;
    }

    setActiveObject(object) {
        this.activeObject = object;
    }

    getWidth() {
        return 800;
    }

    getHeight() {
        return 600;
    }

    renderAll() {}
}

function makeContext() {
    const options = resolveOptions();
    const canvas = new FakeCanvas();
    let annotationCounter = 0;
    let saveCount = 0;

    return {
        context: {
            fabric: {
                Textbox: FakeTextbox,
            },
            canvas,
            options,
            getOriginalImage: () => null,
            getTextConfig: () => options.defaultTextConfig,
            isImageLoaded: () => true,
            getAnnotationCounter: () => annotationCounter,
            setAnnotationCounter: (value) => {
                annotationCounter = value;
            },
            getTextSession: () => null,
            setTextSession: () => {},
            saveCanvasState: () => {
                saveCount += 1;
            },
            updateAnnotationList: () => {},
            updateUi: () => {},
            emitAnnotationsChanged: () => {},
            emitImageChanged: () => {},
            buildCallbackContext: (operation) => ({ operation }),
        },
        canvas,
        getSaveCount: () => saveCount,
    };
}

test('createTextAnnotation selects the default text after entering edit mode', () => {
    const { context, canvas, getSaveCount } = makeContext();

    const annotation = createTextAnnotation(context);

    assert.ok(annotation);
    assert.equal(annotation.text, 'Text');
    assert.equal(annotation.isEditing, true);
    assert.equal(annotation.selectAllCalls, 1);
    assert.equal(annotation.selectionStart, 0);
    assert.equal(annotation.selectionEnd, 4);
    assert.equal(canvas.activeObject, annotation);
    assert.equal(getSaveCount(), 1);
});
