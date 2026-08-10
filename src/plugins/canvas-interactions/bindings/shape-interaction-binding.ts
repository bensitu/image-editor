/**
 * Adapts scene-space pointer drags to the public Shape Annotation session API.
 *
 * @module
 */

import type {
    ShapeAnnotationKind,
    ShapeAnnotationPluginApi,
    ShapeGeometryInput,
    ShapeSessionOptions,
} from '../../annotation-shape/index.js';
import type { CanvasInteractionBinding, PointerDownContext } from '../interaction-binding.js';
import type {
    InteractionCancelReason,
    ShapeCanvasInteractionOptions,
} from '../canvas-interactions-types.js';
import type { InteractionPoint, PointerSample } from '../interaction-types.js';
import { LatestValueScheduler } from '../schedulers/latest-value-scheduler.js';

const SHAPE_TOOL_ID = 'annotation:shape';
const DEFAULT_MINIMUM_DRAG_DISTANCE = 2;

interface ShapeGesture {
    readonly start: InteractionPoint;
    readonly kind: ShapeAnnotationKind;
    readonly sessionOptions: Readonly<ShapeSessionOptions>;
    readonly context: PointerDownContext['gesture'];
    readonly previews: LatestValueScheduler<ShapeGeometryInput>;
}

function geometry(
    kind: ShapeAnnotationKind,
    start: InteractionPoint,
    end: InteractionPoint,
): ShapeGeometryInput {
    if (kind === 'rect') {
        return Object.freeze({
            kind,
            left: Math.min(start.x, end.x),
            top: Math.min(start.y, end.y),
            width: Math.abs(end.x - start.x),
            height: Math.abs(end.y - start.y),
        });
    }
    return Object.freeze({
        kind,
        start: Object.freeze({ ...start }),
        end: Object.freeze({ ...end }),
    });
}

function validFinalGeometry(value: ShapeGeometryInput): boolean {
    return value.kind !== 'rect' || (value.width > 0 && value.height > 0);
}

export class ShapeInteractionBinding implements CanvasInteractionBinding<ShapeGesture> {
    readonly id = 'shape';
    readonly toolId = SHAPE_TOOL_ID;
    private apiValue: ShapeAnnotationPluginApi | null = null;
    private readonly minimumDragDistance: number;
    private readonly continuous: boolean;

    constructor(options: ShapeCanvasInteractionOptions) {
        this.plugin = options.plugin;
        this.minimumDragDistance = options.minimumDragDistance ?? DEFAULT_MINIMUM_DRAG_DISTANCE;
        if (!Number.isFinite(this.minimumDragDistance) || this.minimumDragDistance < 0) {
            throw new TypeError(
                '[ImageEditor] Shape minimum drag distance must be a finite non-negative number.',
            );
        }
        this.continuous = options.continuous === true;
    }

    claim(context: PointerDownContext): { readonly gesture: ShapeGesture } | null {
        const session = this.api().getSession();
        if (!session) return null;
        const gesture: ShapeGesture = {
            start: context.sample.canvasPoint,
            kind: session.kind,
            sessionOptions: session.options,
            context: context.gesture,
            previews: new LatestValueScheduler((value) => {
                if (!context.gesture.isCurrent()) return;
                return this.api().updatePreview(value);
            }),
        };
        return Object.freeze({ gesture });
    }

    move(gesture: ShapeGesture, sample: PointerSample): Promise<void> {
        return gesture.previews.pushLatest(
            geometry(gesture.kind, gesture.start, sample.canvasPoint),
        );
    }

    async end(gesture: ShapeGesture, sample: PointerSample): Promise<void> {
        const distance = Math.hypot(
            sample.canvasPoint.x - gesture.start.x,
            sample.canvasPoint.y - gesture.start.y,
        );
        const finalGeometry = geometry(gesture.kind, gesture.start, sample.canvasPoint);
        if (distance < this.minimumDragDistance || !validFinalGeometry(finalGeometry)) {
            gesture.previews.cancel();
            await this.api().cancel();
            return;
        }
        await gesture.previews.pushLatest(finalGeometry);
        await gesture.previews.flush();
        if (!gesture.context.isCurrent()) return;
        await this.api().commit();
        if (this.continuous && gesture.context.canResume(this.toolId)) {
            await this.api().enter(gesture.sessionOptions);
        }
    }

    async cancel(gesture: ShapeGesture, _reason: InteractionCancelReason): Promise<void> {
        gesture.previews.cancel();
        const api = this.api();
        if (api.getSession()) await api.cancel();
    }

    private readonly plugin: ShapeCanvasInteractionOptions['plugin'];

    private api(): ShapeAnnotationPluginApi {
        return (this.apiValue ??= this.plugin.resolve());
    }
}
