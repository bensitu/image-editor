/**
 * Adapts natural-image pointer samples to ordered Mosaic strokes.
 *
 * @module
 */

import type { MosaicImagePoint, MosaicPluginApi } from '../../mosaic/index.js';
import type { CanvasInteractionBinding, PointerDownContext } from '../interaction-binding.js';
import type {
    InteractionCancelReason,
    MosaicCanvasInteractionOptions,
} from '../canvas-interactions-types.js';
import type { InteractionPoint, PointerSample } from '../interaction-types.js';
import { OrderedSampleScheduler } from '../schedulers/ordered-sample-scheduler.js';

const MOSAIC_TOOL_ID = 'plugin:mosaic';

interface MosaicGesture {
    readonly context: PointerDownContext['gesture'];
    readonly started: Promise<void>;
    readonly samples: OrderedSampleScheduler<InteractionPoint>;
}

function mosaicPoint(point: InteractionPoint): MosaicImagePoint {
    return Object.freeze({ xPx: point.x, yPx: point.y });
}

export class MosaicInteractionBinding implements CanvasInteractionBinding<MosaicGesture> {
    readonly id = 'mosaic';
    readonly toolId = MOSAIC_TOOL_ID;
    private readonly api: MosaicPluginApi;

    constructor(options: MosaicCanvasInteractionOptions) {
        this.api = options.plugin.resolve();
    }

    claim(
        context: PointerDownContext,
    ): { readonly gesture: MosaicGesture; readonly started: Promise<void> } | null {
        const session = this.api.getSession();
        const startPoint = context.sample.imagePoint;
        if (!session || session.isStrokeActive || !startPoint) return null;
        const started = Promise.resolve().then(async () => {
            if (!context.gesture.isCurrent()) return;
            await this.api.beginStroke(mosaicPoint(startPoint));
        });
        const gesture: MosaicGesture = {
            context: context.gesture,
            started,
            samples: new OrderedSampleScheduler(async (point) => {
                await started;
                if (!context.gesture.isCurrent()) return;
                await this.api.appendStroke(mosaicPoint(point));
            }),
        };
        return Object.freeze({ gesture, started });
    }

    move(gesture: MosaicGesture, sample: PointerSample): Promise<void> | void {
        if (sample.imagePoint) return gesture.samples.push(sample.imagePoint);
    }

    async end(gesture: MosaicGesture, _sample: PointerSample): Promise<void> {
        await gesture.started;
        await gesture.samples.flush();
        if (!gesture.context.isCurrent()) return;
        await this.api.endStroke();
    }

    async cancel(gesture: MosaicGesture, _reason: InteractionCancelReason): Promise<void> {
        gesture.samples.cancel();
        try {
            await gesture.started;
        } catch {
            return;
        }
        if (this.api.getSession()) await this.api.cancel();
    }
}
