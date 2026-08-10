import { OrderedSampleScheduler } from '../schedulers/ordered-sample-scheduler.js';
const MOSAIC_TOOL_ID = 'plugin:mosaic';
function mosaicPoint(point) {
    return Object.freeze({ xPx: point.x, yPx: point.y });
}
export class MosaicInteractionBinding {
    constructor(options) {
        Object.defineProperty(this, "id", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'mosaic'
        });
        Object.defineProperty(this, "toolId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: MOSAIC_TOOL_ID
        });
        Object.defineProperty(this, "plugin", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "apiValue", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        this.plugin = options.plugin;
    }
    claim(context) {
        const session = this.api().getSession();
        const startPoint = context.sample.imagePoint;
        if (!session || session.isStrokeActive || !startPoint)
            return null;
        const started = Promise.resolve().then(async () => {
            if (!context.gesture.isCurrent())
                return;
            await this.api().beginStroke(mosaicPoint(startPoint));
        });
        const gesture = {
            context: context.gesture,
            started,
            samples: new OrderedSampleScheduler(async (point) => {
                await started;
                if (!context.gesture.isCurrent())
                    return;
                await this.api().appendStroke(mosaicPoint(point));
            }),
        };
        return Object.freeze({ gesture, started });
    }
    move(gesture, sample) {
        if (sample.imagePoint)
            return gesture.samples.push(sample.imagePoint);
    }
    async end(gesture, _sample) {
        await gesture.started;
        await gesture.samples.flush();
        if (!gesture.context.isCurrent())
            return;
        await this.api().endStroke();
    }
    async cancel(gesture, _reason) {
        gesture.samples.cancel();
        try {
            await gesture.started;
        }
        catch {
            return;
        }
        const api = this.api();
        if (api.getSession())
            await api.cancel();
    }
    api() {
        var _a;
        return ((_a = this.apiValue) !== null && _a !== void 0 ? _a : (this.apiValue = this.plugin.resolve()));
    }
}
//# sourceMappingURL=mosaic-interaction-binding.js.map