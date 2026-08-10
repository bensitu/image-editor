import assert from 'node:assert/strict';
import test from 'node:test';

import type {
    Disposable,
    PluginToolAccess,
    PluginToolStatusListener,
    PluginToolStatusSubscriptionOptions,
} from '../../../src/sdk/index.js';
import type {
    CanvasInteractionBinding,
    InteractionGestureContext,
} from '../../../src/plugins/canvas-interactions/interaction-binding.js';
import { InteractionRuntime } from '../../../src/plugins/canvas-interactions/interaction-runtime.js';
import type { PointerSample } from '../../../src/plugins/canvas-interactions/interaction-types.js';

class TestToolAccess implements PluginToolAccess {
    private readonly listeners = new Set<PluginToolStatusListener>();
    private activeToolId: string | null = null;

    async enter(toolId: string): Promise<void> {
        this.setActive(toolId);
    }

    async exit(): Promise<void> {
        this.setActive(null);
    }

    getActiveToolId(): string | null {
        return this.activeToolId;
    }

    canRunOperation(): boolean {
        return true;
    }

    subscribe(
        listener: PluginToolStatusListener,
        options: PluginToolStatusSubscriptionOptions = {},
    ): Disposable {
        this.listeners.add(listener);
        if (options.emitCurrent !== false) listener({ activeToolId: this.activeToolId });
        return {
            dispose: () => {
                this.listeners.delete(listener);
            },
        };
    }

    setActive(activeToolId: string | null): void {
        this.activeToolId = activeToolId;
        for (const listener of this.listeners) listener({ activeToolId });
    }
}

function sample(x: number, revision = 1): PointerSample {
    return Object.freeze({
        canvasPoint: Object.freeze({ x, y: x + 1 }),
        imagePoint: Object.freeze({ x: x * 2, y: x * 2 + 1 }),
        geometryRevision: revision,
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

function createRuntime(
    binding: CanvasInteractionBinding,
    tools: TestToolAccess,
    errors: unknown[] = [],
): InteractionRuntime {
    return new InteractionRuntime(
        [binding],
        tools,
        {
            reportWarning: (error) => errors.push(error),
            reportError: (error) => errors.push(error),
        },
        {},
        () => undefined,
    );
}

test('Interaction runtime keeps one owner through move and completion', async () => {
    const tools = new TestToolAccess();
    tools.setActive('annotation:shape');
    const calls: string[] = [];
    const binding: CanvasInteractionBinding<{ start: number }> = {
        id: 'shape',
        toolId: 'annotation:shape',
        claim: ({ sample: pointer }) => {
            calls.push(`claim:${pointer.canvasPoint.x}`);
            return { gesture: { start: pointer.canvasPoint.x } };
        },
        move: (_gesture, pointer) => {
            calls.push(`move:${pointer.canvasPoint.x}`);
        },
        end: async (_gesture, pointer) => {
            await Promise.resolve();
            calls.push(`end:${pointer.canvasPoint.x}`);
        },
        cancel: () => {
            calls.push('cancel');
        },
    };
    const runtime = createRuntime(binding, tools);

    runtime.down(sample(1));
    runtime.move(sample(2));
    runtime.up(sample(3));
    assert.equal(runtime.status().gestureActive, true);
    await Promise.resolve();
    await Promise.resolve();

    assert.deepEqual(calls, ['claim:1', 'move:2', 'end:3']);
    assert.deepEqual(runtime.status(), { activeBindingId: 'shape', gestureActive: false });
    runtime.dispose();
});

test('Tool changes synchronously invalidate stale asynchronous Gesture work', async () => {
    const tools = new TestToolAccess();
    tools.setActive('annotation:draw');
    const gate = deferred();
    const calls: string[] = [];
    let context: InteractionGestureContext | null = null;
    const binding: CanvasInteractionBinding<object> = {
        id: 'draw',
        toolId: 'annotation:draw',
        claim: (claimContext) => {
            context = claimContext.gesture;
            return { gesture: {} };
        },
        move: () => undefined,
        end: async () => {
            await gate.promise;
            if (context?.isCurrent()) calls.push('continued');
        },
        cancel: () => {
            calls.push('cancel');
        },
    };
    const runtime = createRuntime(binding, tools);

    runtime.down(sample(1));
    runtime.up(sample(2));
    tools.setActive('annotation:text');
    assert.equal(runtime.status().gestureActive, false);
    gate.resolve();
    await gate.promise;
    await Promise.resolve();

    assert.deepEqual(calls, []);
    runtime.dispose();
});

test('Requested cancellation calls the owner while document invalidation remains local', async () => {
    const tools = new TestToolAccess();
    tools.setActive('plugin:mosaic');
    const reasons: string[] = [];
    const binding: CanvasInteractionBinding<object> = {
        id: 'mosaic',
        toolId: 'plugin:mosaic',
        claim: () => ({ gesture: {} }),
        move: () => undefined,
        end: () => undefined,
        cancel: (_gesture, reason) => {
            reasons.push(reason);
        },
    };
    const runtime = createRuntime(binding, tools);

    runtime.down(sample(1));
    await runtime.cancelGesture('requested');
    runtime.down(sample(2));
    runtime.invalidateLifecycle('state-loaded');

    assert.deepEqual(reasons, ['requested']);
    assert.equal(runtime.status().gestureActive, false);
    runtime.dispose();
});
