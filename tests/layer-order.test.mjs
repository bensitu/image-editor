/** Verifies the layer-placement helpers used by current raster, Mask, and session code. */

import assert from 'node:assert/strict';
import { test } from 'node:test';

const { placeMaskObject, placeRasterVisualObject, placeSessionObject } =
    await import('../src/utils/internal-layer-placement.ts');

class MockCanvas {
    constructor(objects = []) {
        this.objects = objects.slice();
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
        this.remove(object);
        this.insertAt(index, object);
        return true;
    }
}

function names(canvas) {
    return canvas.getObjects().map((object) => object.name);
}

test('placement keeps raster visuals above Base Images and Masks below session UI', () => {
    const canvas = new MockCanvas([
        { name: 'base', editorObjectKind: 'baseImage' },
        { name: 'host-object' },
        {
            name: 'existing-session',
            editorObjectKind: 'session',
            sessionObjectType: 'mosaicPreviewCircle',
        },
    ]);
    const raster = { name: 'raster' };
    const mask = {
        name: 'mask',
        editorObjectKind: 'mask',
        maskId: 1,
        maskUid: 'mask-1',
        maskName: 'mask1',
    };
    const session = {
        name: 'new-session',
        editorObjectKind: 'session',
        sessionObjectType: 'cropRect',
    };

    placeRasterVisualObject(canvas, raster);
    placeMaskObject(canvas, mask);
    placeSessionObject(canvas, session);

    assert.deepEqual(names(canvas), [
        'base',
        'raster',
        'host-object',
        'mask',
        'existing-session',
        'new-session',
    ]);
});
