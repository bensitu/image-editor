import assert from 'node:assert/strict';
import test from 'node:test';

import {
    shapeAnnotationPluginRef,
    type ShapeAnnotationPluginApi,
    type ShapeGeometryInput,
    type ShapeSessionOptions,
} from '../../../src/plugins/annotation-shape/index.js';
import { ShapeInteractionBinding } from '../../../src/plugins/canvas-interactions/bindings/shape-interaction-binding.js';
import type { InteractionGestureContext } from '../../../src/plugins/canvas-interactions/interaction-binding.js';
import type { PointerSample } from '../../../src/plugins/canvas-interactions/interaction-types.js';

function sample(x: number, y: number): PointerSample {
    return Object.freeze({
        canvasPoint: Object.freeze({ x, y }),
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

function context(): InteractionGestureContext {
    return Object.freeze({
        epoch: 1,
        isCurrent: () => true,
        canResume: () => true,
    });
}

function pluginBinding(api: ShapeAnnotationPluginApi) {
    return Object.freeze({ ref: shapeAnnotationPluginRef, resolve: () => api });
}

test('Shape interaction flushes the newest preview before commit and preserves continuous options', async () => {
    const releasePreview = deferred();
    const calls: Array<readonly [string, unknown?]> = [];
    const options: ShapeSessionOptions = Object.freeze({
        kind: 'rect',
        stroke: '#336699',
        strokeWidth: 5,
        name: 'Diagram region',
    });
    const api = {
        getSession: () => ({ kind: 'rect', geometry: null, options }),
        updatePreview: async (value: ShapeGeometryInput) => {
            calls.push(['preview', value]);
            if (calls.length === 1) await releasePreview.promise;
        },
        commit: async () => {
            calls.push(['commit']);
            return 'shape-1';
        },
        cancel: async () => {
            calls.push(['cancel']);
        },
        enter: async (value: ShapeSessionOptions) => {
            calls.push(['enter', value]);
        },
    } as unknown as ShapeAnnotationPluginApi;
    const binding = new ShapeInteractionBinding({
        plugin: pluginBinding(api),
        continuous: true,
    });
    const claim = binding.claim({
        sample: sample(10, 10),
        activeToolId: binding.toolId,
        gesture: context(),
    });
    assert.ok(claim);

    const firstMove = binding.move(claim.gesture, sample(20, 25));
    await Promise.resolve();
    const skippedMove = binding.move(claim.gesture, sample(30, 35));
    const ended = binding.end(claim.gesture, sample(40, 50));
    releasePreview.resolve();
    await Promise.all([firstMove, skippedMove, ended]);

    assert.equal(calls[0]?.[0], 'preview');
    assert.deepEqual(calls[1], [
        'preview',
        { kind: 'rect', left: 10, top: 10, width: 30, height: 40 },
    ]);
    assert.deepEqual(calls.slice(2), [['commit'], ['enter', options]]);
});

test('Shape interaction cancels drags below the scene-space distance threshold', async () => {
    const calls: string[] = [];
    const options: ShapeSessionOptions = Object.freeze({ kind: 'line' });
    const api = {
        getSession: () => ({ kind: 'line', geometry: null, options }),
        cancel: async () => {
            calls.push('cancel');
        },
    } as unknown as ShapeAnnotationPluginApi;
    const binding = new ShapeInteractionBinding({
        plugin: pluginBinding(api),
        minimumDragDistance: 5,
    });
    const claim = binding.claim({
        sample: sample(10, 10),
        activeToolId: binding.toolId,
        gesture: context(),
    });
    assert.ok(claim);

    await binding.end(claim.gesture, sample(13, 13));
    assert.deepEqual(calls, ['cancel']);
});
