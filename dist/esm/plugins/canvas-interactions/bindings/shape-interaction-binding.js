import { LatestValueScheduler } from '../schedulers/latest-value-scheduler.js';
const SHAPE_TOOL_ID = 'annotation:shape';
const DEFAULT_MINIMUM_DRAG_DISTANCE = 2;
function geometry(kind, start, end) {
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
function validFinalGeometry(value) {
    return value.kind !== 'rect' || (value.width > 0 && value.height > 0);
}
export class ShapeInteractionBinding {
    constructor(options) {
        var _a;
        Object.defineProperty(this, "id", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'shape'
        });
        Object.defineProperty(this, "toolId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: SHAPE_TOOL_ID
        });
        Object.defineProperty(this, "apiValue", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "minimumDragDistance", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "continuous", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "plugin", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.plugin = options.plugin;
        this.minimumDragDistance = (_a = options.minimumDragDistance) !== null && _a !== void 0 ? _a : DEFAULT_MINIMUM_DRAG_DISTANCE;
        if (!Number.isFinite(this.minimumDragDistance) || this.minimumDragDistance < 0) {
            throw new TypeError('[ImageEditor] Shape minimum drag distance must be a finite non-negative number.');
        }
        this.continuous = options.continuous === true;
    }
    claim(context) {
        const session = this.api().getSession();
        if (!session)
            return null;
        const gesture = {
            start: context.sample.canvasPoint,
            kind: session.kind,
            sessionOptions: session.options,
            context: context.gesture,
            previews: new LatestValueScheduler((value) => {
                if (!context.gesture.isCurrent())
                    return;
                return this.api().updatePreview(value);
            }),
        };
        return Object.freeze({ gesture });
    }
    move(gesture, sample) {
        return gesture.previews.pushLatest(geometry(gesture.kind, gesture.start, sample.canvasPoint));
    }
    async end(gesture, sample) {
        const distance = Math.hypot(sample.canvasPoint.x - gesture.start.x, sample.canvasPoint.y - gesture.start.y);
        const finalGeometry = geometry(gesture.kind, gesture.start, sample.canvasPoint);
        if (distance < this.minimumDragDistance || !validFinalGeometry(finalGeometry)) {
            gesture.previews.cancel();
            await this.api().cancel();
            return;
        }
        await gesture.previews.pushLatest(finalGeometry);
        await gesture.previews.flush();
        if (!gesture.context.isCurrent())
            return;
        await this.api().commit();
        if (this.continuous && gesture.context.canResume(this.toolId)) {
            await this.api().enter(gesture.sessionOptions);
        }
    }
    async cancel(gesture, _reason) {
        gesture.previews.cancel();
        const api = this.api();
        if (api.getSession())
            await api.cancel();
    }
    api() {
        var _a;
        return ((_a = this.apiValue) !== null && _a !== void 0 ? _a : (this.apiValue = this.plugin.resolve()));
    }
}
//# sourceMappingURL=shape-interaction-binding.js.map