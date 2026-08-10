import { OrderedSampleScheduler } from '../schedulers/ordered-sample-scheduler.js';
const DRAW_TOOL_ID = 'annotation:draw';
export class DrawInteractionBinding {
    constructor(options) {
        Object.defineProperty(this, "id", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'draw'
        });
        Object.defineProperty(this, "toolId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: DRAW_TOOL_ID
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
        if (!session || session.isStrokeActive)
            return null;
        const started = Promise.resolve().then(async () => {
            if (!context.gesture.isCurrent())
                return;
            await this.api().beginStroke(context.sample.canvasPoint);
        });
        const gesture = {
            context: context.gesture,
            started,
            samples: new OrderedSampleScheduler(async (point) => {
                await started;
                if (!context.gesture.isCurrent())
                    return;
                await this.api().appendStroke(point);
            }),
        };
        return Object.freeze({ gesture, started });
    }
    move(gesture, sample) {
        return gesture.samples.push(sample.canvasPoint);
    }
    async end(gesture, _sample) {
        await gesture.started;
        await gesture.samples.flush();
        if (!gesture.context.isCurrent())
            return;
        await this.api().endStroke();
    }
    async cancel(gesture, _reason) {
        var _a;
        gesture.samples.cancel();
        try {
            await gesture.started;
        }
        catch {
            return;
        }
        const api = this.api();
        if ((_a = api.getSession()) === null || _a === void 0 ? void 0 : _a.isStrokeActive)
            await api.cancelStroke();
    }
    api() {
        var _a;
        return ((_a = this.apiValue) !== null && _a !== void 0 ? _a : (this.apiValue = this.plugin.resolve()));
    }
}
//# sourceMappingURL=draw-interaction-binding.js.map