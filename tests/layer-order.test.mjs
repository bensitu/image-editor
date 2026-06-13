/**
 * Type:
 *   Unit test
 *
 * Purpose:
 *   Verifies editor-owned layer ordering helpers keep base, overlay, and session
 *   object bands in the intended stack order.
 *
 * Scope:
 *   - normalizeLayerOrder repairs a full mixed object stack.
 *   - Single-object placement helpers insert base images, masks, annotations, and
 *     session objects into the correct layer band.
 *
 * Out of scope:
 *   - Fabric rendering behavior
 *   - state serialization
 *   - ImageEditor facade layer commands
 *
 * Environment:
 *   - Node.js ESM
 *   - mocked Fabric canvas stack operations
 *
 * Run:
 *   node --test tests/layer-order.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

const {
    normalizeLayerOrder,
    placeAnnotationObject,
    placeBaseImageObject,
    placeMaskObject,
    placeSessionObject,
} = await import('../src/core/layer-order.ts');

class MockCanvas {
    constructor(objects = []) {
        this.objects = objects.slice();
        this.moveCalls = 0;
    }
    getObjects() {
        return this.objects.slice();
    }
    add(object) {
        this.objects.push(object);
    }
    remove(object) {
        this.objects = this.objects.filter((candidate) => candidate !== object);
    }
    insertAt(index, object) {
        this.objects.splice(index, 0, object);
    }
    moveObjectTo(object, index) {
        this.moveCalls += 1;
        this.remove(object);
        this.insertAt(index, object);
        return true;
    }
}

function base(name) {
    return { name, editorObjectKind: 'baseImage' };
}

function mask(name) {
    return { name, editorObjectKind: 'mask', maskId: 1, maskUid: name, maskName: name };
}

function annotation(name) {
    return {
        name,
        editorObjectKind: 'annotation',
        annotationId: 1,
        annotationType: 'text',
        annotationName: name,
    };
}

function session(name) {
    return { name, editorObjectKind: 'session', sessionObjectType: 'mosaicPreviewCircle' };
}

function other(name) {
    return { name };
}

function names(canvas) {
    return canvas.getObjects().map((object) => object.name);
}

test('normalizeLayerOrder repairs base, other, overlay, session groups', () => {
    const canvas = new MockCanvas([
        session('session1'),
        mask('mask1'),
        other('other1'),
        base('base1'),
        annotation('annotation1'),
    ]);

    normalizeLayerOrder(canvas);

    assert.deepEqual(names(canvas), ['base1', 'other1', 'mask1', 'annotation1', 'session1']);
});

test('single-object placement inserts new objects into the correct layer band', () => {
    const canvas = new MockCanvas([base('base1'), other('other1'), session('session1')]);
    const mask1 = mask('mask1');
    const annotation1 = annotation('annotation1');
    const session2 = session('session2');
    const base2 = base('base2');

    placeMaskObject(canvas, mask1);
    placeAnnotationObject(canvas, annotation1);
    placeSessionObject(canvas, session2);
    placeBaseImageObject(canvas, base2);

    assert.deepEqual(names(canvas), [
        'base1',
        'base2',
        'other1',
        'mask1',
        'annotation1',
        'session1',
        'session2',
    ]);
});
