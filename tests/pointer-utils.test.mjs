/**
 * Type:
 *   Unit test
 *
 * Purpose:
 *   Verifies shared Fabric pointer extraction helpers used by text and Mosaic
 *   controllers.
 *
 * Scope:
 *   - isFinitePoint accepts only finite numeric x/y points.
 *   - Fabric v7 scenePoint is preferred over pointer fallbacks.
 *   - pointer, absolutePointer, and event.e canvas fallback paths are supported.
 *   - Invalid and non-finite inputs return null.
 *
 * Out of scope:
 *   - controller-specific pointer side effects
 *   - Fabric canvas rendering
 *   - browser event dispatch
 *
 * Environment:
 *   - Node.js ESM
 *   - focused canvas pointer stubs
 *
 * Run:
 *   node --test tests/pointer-utils.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

const { getPointerFromFabricEvent, isFinitePoint } = await import('../src/utils/pointer.ts');

function makeCanvas(pointer) {
    return {
        getPointer(event) {
            assert.equal(event.type, 'click');
            return pointer;
        },
    };
}

test('isFinitePoint accepts only finite numeric x/y points', () => {
    assert.equal(isFinitePoint({ x: 1, y: 2 }), true);
    assert.equal(isFinitePoint({ x: Number.NaN, y: 2 }), false);
    assert.equal(isFinitePoint({ x: 1, y: Infinity }), false);
    assert.equal(isFinitePoint({ x: '1', y: 2 }), false);
    assert.equal(isFinitePoint(null), false);
});

test('getPointerFromFabricEvent resolves scenePoint first', () => {
    const point = getPointerFromFabricEvent(makeCanvas({ x: 9, y: 9 }), {
        scenePoint: { x: 1, y: 2 },
        pointer: { x: 3, y: 4 },
        absolutePointer: { x: 5, y: 6 },
    });

    assert.deepEqual(point, { x: 1, y: 2 });
});

test('getPointerFromFabricEvent resolves pointer and absolutePointer fallbacks', () => {
    assert.deepEqual(
        getPointerFromFabricEvent(makeCanvas({ x: 9, y: 9 }), {
            pointer: { x: 3, y: 4 },
            absolutePointer: { x: 5, y: 6 },
        }),
        { x: 3, y: 4 },
    );
    assert.deepEqual(
        getPointerFromFabricEvent(makeCanvas({ x: 9, y: 9 }), {
            absolutePointer: { x: 5, y: 6 },
        }),
        { x: 5, y: 6 },
    );
});

test('getPointerFromFabricEvent falls back to canvas.getPointer(event.e)', () => {
    const event = { type: 'click' };
    const point = getPointerFromFabricEvent(makeCanvas({ x: 7, y: 8 }), { e: event });

    assert.deepEqual(point, { x: 7, y: 8 });
});

test('getPointerFromFabricEvent returns null for invalid events and non-finite points', () => {
    assert.equal(getPointerFromFabricEvent(makeCanvas({ x: 1, y: 2 }), null), null);
    assert.equal(
        getPointerFromFabricEvent(makeCanvas({ x: Number.NaN, y: 2 }), {
            scenePoint: { x: Number.POSITIVE_INFINITY, y: 2 },
            e: { type: 'click' },
        }),
        null,
    );
});
