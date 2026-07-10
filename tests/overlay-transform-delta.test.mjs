/**
 * Unit coverage for affine overlay binding and Fabric 7.4 reflection behavior.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fabric, installFabricDom } from './helpers/fabric-environment.mjs';

installFabricDom();

const {
    applyDeltaToObject,
    computeImageTransformDelta,
    deltaHasReflection,
    isApproximatelyIdentityTransform,
    isFiniteTransformMatrix,
    stripReflectionFromDelta,
    transformPointByMatrix,
} = await import('../src/image/overlay-transform-delta.ts');

const fabricUtil = {
    multiplyTransformMatrices: (a, b) => fabric.util.multiplyTransformMatrices(a, b),
    invertTransform: (matrix) => fabric.util.invertTransform(matrix),
    qrDecompose: (matrix) => fabric.util.qrDecompose(matrix),
    Point: fabric.Point,
};

function assertClose(actual, expected, message, epsilon = 1e-8) {
    assert.ok(
        Math.abs(actual - expected) <= epsilon,
        `${message}: expected ${expected}, received ${actual}`,
    );
}

function assertPointClose(actual, expected, message, epsilon = 1e-8) {
    assertClose(actual.x, expected.x, `${message} (x)`, epsilon);
    assertClose(actual.y, expected.y, `${message} (y)`, epsilon);
}

function assertMatrixClose(actual, expected, message, epsilon = 1e-8) {
    assert.equal(actual.length, expected.length, `${message} (length)`);
    actual.forEach((value, index) => {
        assertClose(value, expected[index], `${message} [${index}]`, epsilon);
    });
}

function determinant(matrix) {
    return matrix[0] * matrix[3] - matrix[1] * matrix[2];
}

function transformPoint(point, matrix) {
    return fabric.util.transformPoint(point, matrix);
}

function sourcePointForMarker(object, marker, imageMatrix) {
    const worldPoint = transformPoint(marker, object.calcTransformMatrix());
    return transformPoint(worldPoint, fabric.util.invertTransform(imageMatrix));
}

function aroundPoint(linearMatrix, x, y) {
    return fabric.util.multiplyTransformMatrices(
        [1, 0, 0, 1, x, y],
        fabric.util.multiplyTransformMatrices(linearMatrix, [1, 0, 0, 1, -x, -y]),
    );
}

function rotationMatrix(degrees) {
    const radians = (degrees * Math.PI) / 180;
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    return [cosine, sine, -sine, cosine, 0, 0];
}

test('matrix helpers reject partial or non-finite transforms', () => {
    assert.equal(isFiniteTransformMatrix([1, 0, 0, 1, 0, 0]), true);
    assert.equal(isFiniteTransformMatrix([1, 0, 0, 1, 0]), false);
    assert.equal(isFiniteTransformMatrix([1, 0, 0, 1, 0, Number.NaN]), false);
    assert.equal(isFiniteTransformMatrix([1, 0, 0, 1, 0, Number.POSITIVE_INFINITY]), false);

    assert.equal(isApproximatelyIdentityTransform([1, 0, 0, 1, 0, 0]), true);
    assert.equal(isApproximatelyIdentityTransform([1, 0, 0, 1, 0, 1e-9]), false);

    assert.deepEqual(
        computeImageTransformDelta([1, 0, 0, 1, 0], [1, 0, 0, 1, 0, 0], fabricUtil),
        [],
    );
});

test('Fabric 7.4 decomposes reflection as negative scale without flip flags', () => {
    const decomposed = fabric.util.qrDecompose([-1, 0, 0, 1, 0, 0]);

    assert.equal(decomposed.flipX, undefined);
    assert.equal(decomposed.flipY, undefined);
    assert.ok(
        decomposed.scaleX < 0 || decomposed.scaleY < 0,
        'reflection must be represented by a negative decomposed scale',
    );
    assert.ok(Number.isFinite(decomposed.angle), 'compensating angle remains finite');
});

test('delta calculation, reflection stripping, and Point construction preserve affine semantics', () => {
    const before = [1.25, 0, 0, 1.25, 10, 20];
    const after = [-1.25, 0, 0, 1.25, 210, 20];
    const delta = computeImageTransformDelta(before, after, fabricUtil);

    assertMatrixClose(delta, [-1, 0, 0, 1, 220, 0], 'computed image delta');
    assert.equal(deltaHasReflection(delta), true);

    const stripped = stripReflectionFromDelta(delta, fabricUtil);
    assert.equal(deltaHasReflection(stripped), false);

    const point = transformPointByMatrix(new fabric.Point(10, 12), delta, fabricUtil);
    assert.ok(point instanceof fabric.Point, 'transformPointByMatrix returns a Fabric Point');
    assertPointClose(point, new fabric.Point(210, 12), 'transformed point');
});

test('applyDeltaToObject preserves reflection and an asymmetric local marker', () => {
    const object = new fabric.Rect({
        left: 32,
        top: 18,
        width: 41,
        height: 23,
        angle: 17,
        scaleX: 1.2,
        scaleY: 0.8,
        originX: 'left',
        originY: 'top',
    });
    object.setCoords();

    const marker = new fabric.Point(9, -5);
    const beforeImage = [1, 0, 0, 1, 0, 0];
    const beforeMarker = sourcePointForMarker(object, marker, beforeImage);
    const delta = [-1, 0, 0, 1, 220, 0];
    const afterImage = fabric.util.multiplyTransformMatrices(delta, beforeImage);
    const expectedCenter = transformPoint(object.getCenterPoint(), delta);

    applyDeltaToObject(object, delta, { fabricUtil });

    assert.ok(
        determinant(object.calcTransformMatrix()) < 0,
        'the live Fabric object matrix must retain reflection',
    );
    assertPointClose(object.getCenterPoint(), expectedCenter, 'reflected object center');
    assertPointClose(
        sourcePointForMarker(object, marker, afterImage),
        beforeMarker,
        'asymmetric source-pixel marker',
    );
});

test('consecutive horizontal and vertical flips do not retain stale flip state', () => {
    for (const [name, delta] of [
        ['horizontal', [-1, 0, 0, 1, 220, 0]],
        ['vertical', [1, 0, 0, -1, 0, 160]],
    ]) {
        const object = new fabric.Ellipse({
            left: 37,
            top: 29,
            rx: 18,
            ry: 11,
            angle: 23,
            scaleX: 1.15,
            scaleY: 0.85,
        });
        object.setCoords();
        const before = object.calcTransformMatrix().slice();

        applyDeltaToObject(object, delta, { fabricUtil });
        applyDeltaToObject(object, delta, { fabricUtil });

        assertMatrixClose(
            object.calcTransformMatrix(),
            before,
            `${name} double flip restores the object matrix`,
        );
        assert.equal(determinant(object.calcTransformMatrix()) > 0, true);
    }
});

test('mixed affine sequence keeps full overlays image-local and readable text non-mirrored', () => {
    const overlay = new fabric.Polygon(
        [
            { x: 0, y: 0 },
            { x: 31, y: 7 },
            { x: 11, y: 29 },
        ],
        {
            left: 27,
            top: 21,
            angle: 11,
            scaleX: 0.9,
            scaleY: 1.1,
        },
    );
    const text = new fabric.FabricText('Readable', {
        left: 61,
        top: 36,
        angle: -8,
        scaleX: 1.05,
        scaleY: 0.95,
    });
    overlay.setCoords();
    text.setCoords();

    const marker = new fabric.Point(8, -4);
    const overlaySourceBefore = sourcePointForMarker(overlay, marker, [1, 0, 0, 1, 0, 0]);
    const textCenterBefore = text.getCenterPoint();
    const overlayMatrixBefore = overlay.calcTransformMatrix().slice();

    const operations = [
        aroundPoint([1.3, 0, 0, 1.3, 0, 0], 80, 60),
        aroundPoint(rotationMatrix(37), 80, 60),
        aroundPoint([-1, 0, 0, 1, 0, 0], 80, 60),
        aroundPoint([1, 0, 0, -1, 0, 0], 80, 60),
        aroundPoint(rotationMatrix(88), 80, 60),
        aroundPoint([0.73, 0, 0, 0.73, 0, 0], 80, 60),
        aroundPoint([-1, 0, 0, 1, 0, 0], 80, 60),
        aroundPoint(rotationMatrix(-125), 80, 60),
    ];

    let imageMatrix = [1, 0, 0, 1, 0, 0];
    for (const delta of operations) {
        applyDeltaToObject(overlay, delta, { fabricUtil });
        applyDeltaToObject(text, delta, {
            fabricUtil,
            preserveReadableText: true,
        });
        imageMatrix = fabric.util.multiplyTransformMatrices(delta, imageMatrix);
    }

    assertPointClose(
        sourcePointForMarker(overlay, marker, imageMatrix),
        overlaySourceBefore,
        'mixed-sequence asymmetric marker',
        1e-7,
    );
    assertMatrixClose(
        overlay.calcTransformMatrix(),
        fabric.util.multiplyTransformMatrices(imageMatrix, overlayMatrixBefore),
        'mixed-sequence full object matrix',
        1e-7,
    );
    assert.ok(
        determinant(overlay.calcTransformMatrix()) < 0,
        'three reflections leave the full overlay mirrored',
    );
    assert.ok(
        determinant(text.calcTransformMatrix()) > 0,
        'readable text local transform must not be mirrored',
    );
    assertPointClose(
        text.getCenterPoint(),
        transformPoint(textCenterBefore, imageMatrix),
        'readable text center follows the full image transform',
        1e-7,
    );
});
