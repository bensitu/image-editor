import assert from 'node:assert/strict';
import test from 'node:test';

import { applyDeltaToObject } from '../../../src/foundations/overlay/overlay-transform-delta.js';
import { fabric } from '../../helpers/fabric-environment.mjs';

test('transform delta restores every mutable transform field when Fabric mutation fails', () => {
    const object = new fabric.Rect({
        left: 12,
        top: 18,
        width: 40,
        height: 30,
        angle: 17,
        scaleX: 1.25,
        scaleY: 0.75,
        skewX: 4,
        skewY: 2,
        flipX: true,
        flipY: false,
    });
    object.setCoords();
    const before = {
        angle: object.angle,
        scaleX: object.scaleX,
        scaleY: object.scaleY,
        skewX: object.skewX,
        skewY: object.skewY,
        flipX: object.flipX,
        flipY: object.flipY,
        originX: object.originX,
        originY: object.originY,
        center: object.getCenterPoint(),
    };
    const originalSet = object.set;
    let failNextTransform = true;
    object.set = function setWithSyntheticFailure(key, value) {
        if (
            failNextTransform &&
            typeof key === 'object' &&
            key !== null &&
            Object.hasOwn(key, 'angle')
        ) {
            failNextTransform = false;
            throw new Error('synthetic Fabric transform failure');
        }
        return originalSet.call(this, key, value);
    };

    assert.throws(
        () =>
            applyDeltaToObject(object, [1, 0, 0, 1, 8, 6], {
                fabricUtil: {
                    ...fabric.util,
                    Point: fabric.Point,
                },
            }),
        /synthetic Fabric transform failure/,
    );

    assert.deepEqual(
        {
            angle: object.angle,
            scaleX: object.scaleX,
            scaleY: object.scaleY,
            skewX: object.skewX,
            skewY: object.skewY,
            flipX: object.flipX,
            flipY: object.flipY,
            originX: object.originX,
            originY: object.originY,
        },
        {
            angle: before.angle,
            scaleX: before.scaleX,
            scaleY: before.scaleY,
            skewX: before.skewX,
            skewY: before.skewY,
            flipX: before.flipX,
            flipY: before.flipY,
            originX: before.originX,
            originY: before.originY,
        },
    );
    assert.equal(object.getCenterPoint().distanceFrom(before.center) < 1e-8, true);
});
