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

test('Blank Text clicks preserve ready mode and await creation before editing', async () => {
    const calls: Array<readonly [string, unknown?]> = [];
    let editing = true;
    let interactionCurrent = true;
    const createStarted = deferred();
    let finishCreate = (_id: string): void => undefined;
    const text = {
        getEditingSession: () =>
            editing ? { annotationId: 'text-current', text: 'Current' } : null,
        commitEditing: async () => {
            calls.push(['commit']);
            editing = false;
            interactionCurrent = false;
        },
        enter: async () => {
            calls.push(['enter']);
        },
        create: async (options: TextAnnotationCreateOptions) => {
            calls.push(['create', options]);
            createStarted.resolve();
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
        gesture: Object.freeze({
            epoch: 1,
            isCurrent: () => interactionCurrent,
            canResume: () => true,
        }),
    });
    assert.ok(claim);
    const ended = binding.end(claim.gesture, sample());
    await createStarted.promise;
    assert.deepEqual(calls, [['commit'], ['enter'], ['create', { left: 42, top: 64 }]]);

    finishCreate('text-1');
    await ended;
    assert.deepEqual(calls, [
        ['commit'],
        ['enter'],
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
        enter: async () => {
            calls.push(['enter']);
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

    assert.deepEqual(calls, [['cancel'], ['enter'], ['edit', 'text-2']]);
});
