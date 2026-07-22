import assert from 'node:assert/strict';
import test from 'node:test';

import { isSafeSerializedFabricObject } from '../../src/fabric/safe-fabric-serialization.js';

test('serialized Fabric validation accepts bounded official object shapes', () => {
    assert.equal(
        isSafeSerializedFabricObject(
            {
                type: 'Path',
                path: [
                    ['M', 0, 0],
                    ['L', 10, 10],
                ],
                fill: null,
                stroke: '#000000',
                shadow: { type: 'shadow', color: '#000000', blur: 2 },
            },
            { rootTypes: ['path'] },
        ),
        true,
    );
});

test('serialized Fabric validation accepts omitted optional properties represented by undefined', () => {
    const value = {
        type: 'Textbox',
        version: '7.4.0',
        text: 'Safe',
        left: 0,
        top: 0,
        width: 10,
        height: 10,
        fontSize: 12,
        path: undefined,
    };

    assert.equal(isSafeSerializedFabricObject(value, { rootTypes: ['textbox'] }), true);
});

test('serialized Fabric validation rejects nested class revival and external resources', () => {
    for (const value of [
        {
            type: 'Rect',
            width: 10,
            height: 10,
            clipPath: { type: 'Image', src: 'https://example.invalid/image.png' },
        },
        {
            type: 'Rect',
            width: 10,
            height: 10,
            arbitrary: { type: 'Group', objects: [] },
        },
        {
            type: 'Rect',
            width: 10,
            height: 10,
            fill: { type: 'pattern', source: 'https://example.invalid/pattern.png' },
        },
    ]) {
        assert.equal(isSafeSerializedFabricObject(value, { rootTypes: ['rect'] }), false);
    }
});

test('serialized Fabric validation rejects string Path parser payloads and cycles', () => {
    assert.equal(
        isSafeSerializedFabricObject(
            { type: 'Path', path: 'M 0 0 '.repeat(10_000) },
            { rootTypes: ['path'] },
        ),
        false,
    );
    const cyclic = { type: 'Rect', width: 10, height: 10 };
    cyclic.nested = cyclic;
    assert.equal(isSafeSerializedFabricObject(cyclic, { rootTypes: ['rect'] }), false);
});

test('serialized Fabric validation enforces root properties without invoking accessors', () => {
    assert.equal(
        isSafeSerializedFabricObject(
            { type: 'Rect', width: 10, height: 10, unexpectedOption: true },
            { rootTypes: ['rect'] },
        ),
        false,
    );

    let getterCalls = 0;
    const accessor = { width: 10, height: 10 };
    Object.defineProperty(accessor, 'type', {
        enumerable: true,
        get() {
            getterCalls += 1;
            throw new Error('must not execute');
        },
    });
    assert.equal(isSafeSerializedFabricObject(accessor, { rootTypes: ['rect'] }), false);
    assert.equal(getterCalls, 0);
});
