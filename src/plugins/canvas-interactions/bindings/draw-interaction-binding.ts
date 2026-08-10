/**
 * Adapts scene-space pointer samples to ordered Draw Annotation strokes.
 *
 * @module
 */

import type { DrawAnnotationPluginApi } from '../../annotation-draw/index.js';
import type { CanvasInteractionBinding, PointerDownContext } from '../interaction-binding.js';
import type {
    DrawCanvasInteractionOptions,
    InteractionCancelReason,
} from '../canvas-interactions-types.js';
import type { InteractionPoint, PointerSample } from '../interaction-types.js';
import { OrderedSampleScheduler } from '../schedulers/ordered-sample-scheduler.js';

const DRAW_TOOL_ID = 'annotation:draw';

interface DrawGesture {
    readonly context: PointerDownContext['gesture'];
    readonly started: Promise<void>;
    readonly samples: OrderedSampleScheduler<InteractionPoint>;
}

export class DrawInteractionBinding implements CanvasInteractionBinding<DrawGesture> {
    readonly id = 'draw';
    readonly toolId = DRAW_TOOL_ID;
    private readonly api: DrawAnnotationPluginApi;

    constructor(options: DrawCanvasInteractionOptions) {
        this.api = options.plugin.resolve();
    }

    claim(
        context: PointerDownContext,
    ): { readonly gesture: DrawGesture; readonly started: Promise<void> } | null {
        const session = this.api.getSession();
        if (!session || session.isStrokeActive) return null;
        const started = Promise.resolve().then(async () => {
            if (!context.gesture.isCurrent()) return;
            await this.api.beginStroke(context.sample.canvasPoint);
        });
        const gesture: DrawGesture = {
            context: context.gesture,
            started,
            samples: new OrderedSampleScheduler(async (point) => {
                await started;
                if (!context.gesture.isCurrent()) return;
                await this.api.appendStroke(point);
            }),
        };
        return Object.freeze({ gesture, started });
    }

    move(gesture: DrawGesture, sample: PointerSample): Promise<void> {
        return gesture.samples.push(sample.canvasPoint);
    }

    async end(gesture: DrawGesture, _sample: PointerSample): Promise<void> {
        await gesture.started;
        await gesture.samples.flush();
        if (!gesture.context.isCurrent()) return;
        await this.api.endStroke();
    }

    async cancel(gesture: DrawGesture, _reason: InteractionCancelReason): Promise<void> {
        gesture.samples.cancel();
        try {
            await gesture.started;
        } catch {
            return;
        }
        if (this.api.getSession()?.isStrokeActive) await this.api.cancelStroke();
    }
}
