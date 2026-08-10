import assert from 'node:assert/strict';
import test from 'node:test';

import {
    type MosaicImagePoint,
    mosaicPluginRef,
    type MosaicPluginApi,
} from '../../../src/plugins/mosaic/index.js';
import { MosaicInteractionBinding } from '../../../src/plugins/canvas-interactions/bindings/mosaic-interaction-binding.js';
import type { InteractionGestureContext } from '../../../src/plugins/canvas-interactions/interaction-binding.js';
import type { PointerSample } from '../../../src/plugins/canvas-interactions/interaction-types.js';

function sample(x: number, imagePoint: Readonly<{ x: number; y: number }> | null): PointerSample {
    return Object.freeze({
        canvasPoint: Object.freeze({ x, y: x + 1 }),
        imagePoint,
        geometryRevision: 1,
        timestamp: x,
        pointerId: 1,
        pointerType: 'mouse',
        button: 0,
        shiftKey: false,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        target: null,
    });
}

const gestureContext: InteractionGestureContext = Object.freeze({
    epoch: 1,
    isCurrent: () => true,
    canResume: () => true,
});

test('Mosaic interaction uses natural pixels, skips outside movement, and ends after appends', async () => {
    const calls: Array<readonly [string, unknown?]> = [];
    const api = {
        getSession: () => ({ isStrokeActive: false }),
        beginStroke: async (point: MosaicImagePoint) => {
            calls.push(['begin', point]);
        },
        appendStroke: async (point: MosaicImagePoint) => {
            calls.push(['append', point]);
        },
        endStroke: async () => {
            calls.push(['end']);
        },
    } as unknown as MosaicPluginApi;
    const binding = new MosaicInteractionBinding({
        plugin: { ref: mosaicPluginRef, resolve: () => api },
    });
    const outsideClaim = binding.claim({
        sample: sample(1, null),
        activeToolId: binding.toolId,
        gesture: gestureContext,
    });
    assert.equal(outsideClaim, null);

    const claim = binding.claim({
        sample: sample(2, { x: 12, y: 18 }),
        activeToolId: binding.toolId,
        gesture: gestureContext,
    });
    assert.ok(claim);
    binding.move(claim.gesture, sample(3, null));
    const appended = binding.move(claim.gesture, sample(4, { x: 26, y: 31 }));
    const ended = binding.end(claim.gesture, sample(5, null));
    await Promise.all([claim.started, appended, ended]);

    assert.deepEqual(calls, [
        ['begin', { xPx: 12, yPx: 18 }],
        ['append', { xPx: 26, yPx: 31 }],
        ['end'],
    ]);
});
