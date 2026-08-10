import assert from 'node:assert/strict';
import test from 'node:test';

import {
    annotationFoundationRef,
    type AnnotationPluginApi,
} from '../../../src/foundations/annotation/index.js';
import {
    overlayFoundationRef,
    type OverlayFoundationApi,
} from '../../../src/foundations/overlay/index.js';
import {
    textAnnotationPluginRef,
    type TextAnnotationPluginApi,
    type TextAnnotationCreateOptions,
} from '../../../src/plugins/annotation-text/index.js';
import { TextInteractionBinding } from '../../../src/plugins/canvas-interactions/bindings/text-interaction-binding.js';
import type { InteractionGestureContext } from '../../../src/plugins/canvas-interactions/interaction-binding.js';
import type { PointerSample } from '../../../src/plugins/canvas-interactions/interaction-types.js';

function sample(target: PointerSample['target'] = null): PointerSample {
    return Object.freeze({
        canvasPoint: Object.freeze({ x: 42, y: 64 }),
        imagePoint: null,
        geometryRevision: 1,
        timestamp: 1,
        pointerId: 1,
        pointerType: 'mouse',
        button: 0,
        shiftKey: false,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        target,
    });
}

const gestureContext: InteractionGestureContext = Object.freeze({
    epoch: 1,
    isCurrent: () => true,
    canResume: () => true,
});

function bindingOptions(
    text: TextAnnotationPluginApi,
    overlays: OverlayFoundationApi,
    annotations: AnnotationPluginApi,
) {
    return {
        plugin: { ref: textAnnotationPluginRef, resolve: () => text },
        overlays: { ref: overlayFoundationRef, resolve: () => overlays },
        annotations: { ref: annotationFoundationRef, resolve: () => annotations },
    } as const;
}

test('Blank Text clicks await creation before editing the new Annotation', async () => {
    const calls: Array<readonly [string, unknown?]> = [];
    let finishCreate = (_id: string): void => undefined;
    const text = {
        getEditingSession: () => null,
        create: async (options: TextAnnotationCreateOptions) => {
            calls.push(['create', options]);
            return new Promise<string>((resolve) => {
                finishCreate = resolve;
            });
        },
        beginEditing: async (id: string) => {
            calls.push(['edit', id]);
        },
    } as unknown as TextAnnotationPluginApi;
    const binding = new TextInteractionBinding(
        bindingOptions(text, {} as OverlayFoundationApi, {} as AnnotationPluginApi),
    );
    const claim = binding.claim({
        sample: sample(),
        activeToolId: binding.toolId,
        gesture: gestureContext,
    });
    assert.ok(claim);
    const ended = binding.end(claim.gesture, sample());
    await Promise.resolve();
    assert.deepEqual(calls, [['create', { left: 42, top: 64 }]]);

    finishCreate('text-1');
    await ended;
    assert.deepEqual(calls, [
        ['create', { left: 42, top: 64 }],
        ['edit', 'text-1'],
    ]);
});

test('Existing Text clicks use public classification and explicit retarget policy', async () => {
    const target = {} as PointerSample['target'];
    const calls: Array<readonly [string, unknown?]> = [];
    const text = {
        getEditingSession: () => ({ annotationId: 'text-1', text: 'First' }),
        cancelEditing: async () => {
            calls.push(['cancel']);
        },
        beginEditing: async (id: string) => {
            calls.push(['edit', id]);
        },
    } as unknown as TextAnnotationPluginApi;
    const overlays = {
        classify: () => ({
            kind: 'annotation:text',
            persistentId: 'text-2',
            ownerPluginId: 'annotation:text',
            hidden: false,
            locked: false,
        }),
    } as unknown as OverlayFoundationApi;
    const binding = new TextInteractionBinding({
        ...bindingOptions(text, overlays, {} as AnnotationPluginApi),
        retargetEditing: 'cancel',
    });
    const claim = binding.claim({
        sample: sample(target),
        activeToolId: binding.toolId,
        gesture: gestureContext,
    });
    assert.ok(claim);
    await binding.end(claim.gesture, sample(target));

    assert.deepEqual(calls, [['cancel'], ['edit', 'text-2']]);
});
