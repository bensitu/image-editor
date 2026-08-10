import assert from 'node:assert/strict';
import test from 'node:test';

import {
    drawAnnotationPluginRef,
    type DrawAnnotationPluginApi,
} from '../../../src/plugins/annotation-draw/index.js';
import { DrawInteractionBinding } from '../../../src/plugins/canvas-interactions/bindings/draw-interaction-binding.js';
import type { InteractionGestureContext } from '../../../src/plugins/canvas-interactions/interaction-binding.js';
import type { PointerSample } from '../../../src/plugins/canvas-interactions/interaction-types.js';

function sample(x: number): PointerSample {
    return Object.freeze({
        canvasPoint: Object.freeze({ x, y: x + 1 }),
        imagePoint: null,
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

function deferred(): { readonly promise: Promise<void>; resolve(): void } {
    let resolve = (): void => undefined;
    const promise = new Promise<void>((complete) => {
        resolve = complete;
    });
    return { promise, resolve };
}

const gestureContext: InteractionGestureContext = Object.freeze({
    epoch: 1,
    isCurrent: () => true,
    canResume: () => true,
});

test('Draw interaction completes every accepted append before ending the stroke', async () => {
    const beginGate = deferred();
    const appendGate = deferred();
    const calls: string[] = [];
    const api = {
        getSession: () => ({ subMode: 'brush', isStrokeActive: false, pointCount: 0 }),
        beginStroke: async (point) => {
            calls.push(`begin:${point.x}`);
            await beginGate.promise;
        },
        appendStroke: async (point) => {
            calls.push(`append:${point.x}`);
            if (point.x === 2) await appendGate.promise;
        },
        endStroke: async () => {
            calls.push('end');
            return 'draw-1';
        },
    } as unknown as DrawAnnotationPluginApi;
    const binding = new DrawInteractionBinding({
        plugin: { ref: drawAnnotationPluginRef, resolve: () => api },
    });
    const claim = binding.claim({
        sample: sample(1),
        activeToolId: binding.toolId,
        gesture: gestureContext,
    });
    assert.ok(claim);
    const moves = [binding.move(claim.gesture, sample(2)), binding.move(claim.gesture, sample(3))];
    const ended = binding.end(claim.gesture, sample(4));
    await Promise.resolve();
    assert.deepEqual(calls, ['begin:1']);

    beginGate.resolve();
    await claim.started;
    await Promise.resolve();
    assert.deepEqual(calls, ['begin:1', 'append:2']);
    appendGate.resolve();
    await Promise.all([...moves, ended]);

    assert.deepEqual(calls, ['begin:1', 'append:2', 'append:3', 'end']);
});
