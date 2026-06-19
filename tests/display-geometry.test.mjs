/**
 * Type:
 *   Unit test
 *
 * Purpose:
 *   Verifies display-geometry helpers that can run without a real Fabric
 *   canvas or browser layout engine.
 *
 * Scope:
 *   - Scrollbar-stable viewport sizing.
 *   - Capturing and restoring merged-image display geometry.
 *
 * Out of scope:
 *   - Browser scrollbar measurement.
 *   - Full load/merge integration, covered by existing merge/layout tests.
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';

const {
    captureImageDisplayGeometry,
    getScrollbarStableViewportCanvasSize,
    restoreMergedImageDisplayGeometry,
} = await import('../src/image/display-geometry.ts');

function makeImage({ width = 200, height = 100, bounds = { width: 100, height: 50 } } = {}) {
    return {
        width,
        height,
        props: {},
        coordsCalls: 0,
        setCoords() {
            this.coordsCalls += 1;
        },
        getBoundingRect() {
            return bounds;
        },
        set(nextProps) {
            this.props = { ...this.props, ...nextProps };
        },
    };
}

function makeContext({ canvas, image }) {
    const calls = {
        canvasSizes: [],
        currentScale: [],
        currentRotation: [],
        baseImageScale: [],
        lastSnapshot: [],
    };
    return {
        calls,
        context: {
            canvas,
            containerElement: null,
            options: { canvasWidth: 800, canvasHeight: 600 },
            currentLayoutMode: 'expand',
            viewportCache: {},
            getOriginalImage: () => image,
            setCanvasSize: (width, height) => calls.canvasSizes.push([width, height]),
            setCurrentScale: (scale) => calls.currentScale.push(scale),
            setCurrentRotation: (rotation) => calls.currentRotation.push(rotation),
            setBaseImageScale: (scale) => calls.baseImageScale.push(scale),
            captureSnapshot: () => 'snapshot-after-merge',
            setLastSnapshot: (snapshot) => calls.lastSnapshot.push(snapshot),
        },
    };
}

test('stable viewport sizing subtracts one pixel but never returns zero', () => {
    assert.deepEqual(getScrollbarStableViewportCanvasSize({ width: 320, height: 240 }), {
        width: 319,
        height: 239,
    });
    assert.deepEqual(getScrollbarStableViewportCanvasSize({ width: 1, height: 0 }), {
        width: 1,
        height: 1,
    });
});

test('captureImageDisplayGeometry records canvas and positive image display bounds', () => {
    const image = makeImage({ bounds: { width: 0, height: 0 } });
    const canvas = {
        getWidth: () => 640,
        getHeight: () => 480,
    };
    const { context } = makeContext({ canvas, image });

    assert.deepEqual(captureImageDisplayGeometry(context), {
        canvasWidth: 640,
        canvasHeight: 480,
        imageDisplayWidth: 1,
        imageDisplayHeight: 1,
    });
    assert.equal(image.coordsCalls, 1);
});

test('restoreMergedImageDisplayGeometry restores canvas, base-image scale, and snapshot', () => {
    const image = makeImage();
    const sentToBack = [];
    const canvas = {
        sendObjectToBack: (object) => sentToBack.push(object),
        renderAllCalls: 0,
        renderAll() {
            this.renderAllCalls += 1;
        },
    };
    const { calls, context } = makeContext({ canvas, image });

    restoreMergedImageDisplayGeometry(context, {
        canvasWidth: 640,
        canvasHeight: 480,
        imageDisplayWidth: 100,
        imageDisplayHeight: 50,
    });

    assert.deepEqual(calls.canvasSizes, [[640, 480]]);
    assert.deepEqual(calls.currentScale, [1]);
    assert.deepEqual(calls.currentRotation, [0]);
    assert.deepEqual(calls.baseImageScale, [0.5]);
    assert.deepEqual(calls.lastSnapshot, ['snapshot-after-merge']);
    assert.equal(sentToBack[0], image);
    assert.equal(canvas.renderAllCalls, 1);
    assert.deepEqual(image.props, {
        left: 0,
        top: 0,
        angle: 0,
        scaleX: 0.5,
        scaleY: 0.5,
        originX: 'left',
        originY: 'top',
        selectable: false,
        evented: false,
        hasControls: false,
        hoverCursor: 'default',
    });
});
