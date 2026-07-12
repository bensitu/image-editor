import { AnimationQueue } from '../../animation/animation-queue.js';
import { OperationGuard } from '../../core/operation-guard.js';
import { animateProps, restoreOrigin } from '../../fabric/fabric-animation.js';
const DEFAULT_OPTIONS = Object.freeze({
    animationDuration: 300,
    minScale: 0.1,
    maxScale: 5,
    scaleStep: 0.05,
    rotationStep: 90,
});
function nonNegative(value, fallback) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}
function positive(value, fallback) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}
export function resolveTransformOptions(options = {}) {
    const minScale = positive(options.minScale, DEFAULT_OPTIONS.minScale);
    const maxScale = Math.max(minScale, positive(options.maxScale, DEFAULT_OPTIONS.maxScale));
    return Object.freeze({
        animationDuration: nonNegative(options.animationDuration, DEFAULT_OPTIONS.animationDuration),
        minScale,
        maxScale,
        scaleStep: positive(options.scaleStep, DEFAULT_OPTIONS.scaleStep),
        rotationStep: positive(options.rotationStep, DEFAULT_OPTIONS.rotationStep),
    });
}
function cloneState(state) {
    return Object.freeze({ ...state });
}
export class TransformPluginController {
    constructor(host, geometry, options) {
        Object.defineProperty(this, "host", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: host
        });
        Object.defineProperty(this, "geometry", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: geometry
        });
        Object.defineProperty(this, "options", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: options
        });
        Object.defineProperty(this, "guard", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new OperationGuard()
        });
        Object.defineProperty(this, "queue", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new AnimationQueue()
        });
        Object.defineProperty(this, "state", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: {
                scale: 1,
                rotationDegrees: 0,
                flipX: false,
                flipY: false,
            }
        });
        Object.defineProperty(this, "mutationSequence", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
    }
    scale(factor) {
        return this.scaleWithOperation(factor, 'transform:scale');
    }
    scaleWithOperation(factor, operationId) {
        if (!Number.isFinite(factor))
            return Promise.resolve();
        return this.enqueue(operationId, async (signal) => {
            const image = this.host.getBaseImage();
            if (!image)
                return;
            await this.applyScale(image, factor, signal);
            this.host.finalizeBaseImageGeometry();
        });
    }
    zoomIn() {
        return this.scaleWithOperation(this.state.scale + this.options.scaleStep, 'transform:zoom-in');
    }
    zoomOut() {
        return this.scaleWithOperation(this.state.scale - this.options.scaleStep, 'transform:zoom-out');
    }
    rotate(degrees) {
        if (!Number.isFinite(degrees))
            return Promise.resolve();
        return this.enqueue('transform:rotate', async (signal) => {
            const image = this.host.getBaseImage();
            if (!image)
                return;
            await this.applyRotation(image, degrees, signal);
            this.host.finalizeBaseImageGeometry();
        });
    }
    flipHorizontal() {
        return this.flip('flipX', 'transform:flip-horizontal');
    }
    flipVertical() {
        return this.flip('flipY', 'transform:flip-vertical');
    }
    resetImageTransform() {
        return this.enqueue('transform:reset', async (signal) => {
            const image = this.host.getBaseImage();
            if (!image)
                return;
            await this.applyScale(image, 1, signal);
            await this.applyRotation(image, 0, signal);
            image.set({ flipX: false, flipY: false });
            image.setCoords();
            this.state.flipX = false;
            this.state.flipY = false;
            this.host.finalizeBaseImageGeometry();
        });
    }
    reset() {
        return this.resetImageTransform();
    }
    getState() {
        return cloneState(this.state);
    }
    restoreState(state) {
        this.state.scale = state.scale;
        this.state.rotationDegrees = state.rotationDegrees;
        this.state.flipX = state.flipX;
        this.state.flipY = state.flipY;
    }
    resetStateFromImage() {
        const image = this.host.getBaseImage();
        this.state.scale = 1;
        this.state.rotationDegrees = Number(image === null || image === void 0 ? void 0 : image.angle) || 0;
        this.state.flipX = (image === null || image === void 0 ? void 0 : image.flipX) === true;
        this.state.flipY = (image === null || image === void 0 ? void 0 : image.flipY) === true;
    }
    dispose() {
        this.guard.markDisposed();
        this.queue.clear();
    }
    flip(property, operationId) {
        return this.enqueue(operationId, async () => {
            const image = this.host.getBaseImage();
            if (!image)
                return;
            const center = image.getCenterPoint();
            image.set({ originX: 'center', originY: 'center' });
            image.setPositionByOrigin(center, 'center', 'center');
            image.set({ [property]: !image[property] });
            image.setCoords();
            const topLeft = this.computeTopLeftPoint(image);
            image.set({ originX: 'left', originY: 'top' });
            image.setPositionByOrigin(topLeft, 'left', 'top');
            image.setCoords();
            this.state[property] = image[property] === true;
            this.host.finalizeBaseImageGeometry();
        });
    }
    enqueue(operationId, mutate) {
        if (this.guard.isDisposed())
            return Promise.resolve();
        return this.queue.add(async () => {
            const image = this.host.getBaseImage();
            if (!image || this.guard.isDisposed())
                return;
            const rollback = this.captureRollback(image);
            const mutationId = `${operationId}:${++this.mutationSequence}`;
            await this.geometry.run({
                id: mutationId,
                kind: 'transform',
                operationId,
                mutateBase: async ({ signal }) => {
                    const abort = () => this.guard.markDisposed();
                    signal.addEventListener('abort', abort, { once: true });
                    try {
                        await mutate(signal);
                    }
                    finally {
                        signal.removeEventListener('abort', abort);
                    }
                },
                rollbackBase: () => this.restoreRollback(image, rollback),
                metadata: Object.freeze({ pluginId: '@bensitu/transform' }),
            });
        });
    }
    async applyScale(image, factor, signal) {
        this.throwIfAborted(signal);
        const scale = Math.max(this.options.minScale, Math.min(this.options.maxScale, factor));
        const topLeft = this.computeTopLeftPoint(image);
        image.set({ originX: 'left', originY: 'top' });
        image.setPositionByOrigin(topLeft, 'left', 'top');
        image.setCoords();
        const target = this.host.getBaseImageScale() * scale;
        await this.guard.runAnimation(() => animateProps(image, { scaleX: target, scaleY: target }, {
            duration: this.options.animationDuration,
            onChange: () => this.host.requestRender(),
        }, this.guard));
        this.throwIfAborted(signal);
        image.set({ scaleX: target, scaleY: target });
        image.setCoords();
        this.state.scale = scale;
    }
    async applyRotation(image, degrees, signal) {
        this.throwIfAborted(signal);
        const center = image.getCenterPoint();
        image.set({ originX: 'center', originY: 'center' });
        image.setPositionByOrigin(center, 'center', 'center');
        image.setCoords();
        try {
            await this.guard.runAnimation(() => animateProps(image, { angle: degrees }, {
                duration: this.options.animationDuration,
                onChange: () => this.host.requestRender(),
            }, this.guard));
            this.throwIfAborted(signal);
            image.set('angle', degrees);
            image.setCoords();
            const topLeft = this.computeTopLeftPoint(image);
            image.set({ originX: 'left', originY: 'top' });
            image.setPositionByOrigin(topLeft, 'left', 'top');
            image.setCoords();
            this.state.rotationDegrees = degrees;
        }
        finally {
            if (this.guard.isDisposed())
                restoreOrigin(image, 'left', 'top');
        }
    }
    captureRollback(image) {
        var _a, _b;
        return Object.freeze({
            transform: this.getState(),
            geometryRevision: this.host.getGeometryRevision(),
            canvasSize: this.host.getCanvasSize(),
            image: Object.freeze({
                left: Number(image.left) || 0,
                top: Number(image.top) || 0,
                scaleX: Number(image.scaleX) || 1,
                scaleY: Number(image.scaleY) || 1,
                angle: Number(image.angle) || 0,
                flipX: image.flipX === true,
                flipY: image.flipY === true,
                originX: (_a = image.originX) !== null && _a !== void 0 ? _a : 'left',
                originY: (_b = image.originY) !== null && _b !== void 0 ? _b : 'top',
            }),
        });
    }
    restoreRollback(image, rollback) {
        if (this.host.isDisposed())
            return;
        image.set(rollback.image);
        image.setCoords();
        this.restoreState(rollback.transform);
        this.host.setCanvasSize(rollback.canvasSize.width, rollback.canvasSize.height);
        this.host.setGeometryRevision(rollback.geometryRevision);
        this.host.requestRender();
    }
    computeTopLeftPoint(image) {
        image.setCoords();
        const first = image.getCoords()[0];
        if (first)
            return first;
        const bounds = image.getBoundingRect();
        const PointConstructor = this.host.fabric.Point;
        if (typeof PointConstructor === 'function') {
            return new PointConstructor(bounds.left, bounds.top);
        }
        return { x: bounds.left, y: bounds.top };
    }
    throwIfAborted(signal) {
        var _a;
        if (signal.aborted)
            throw (_a = signal.reason) !== null && _a !== void 0 ? _a : new Error('Transform operation aborted.');
        if (this.guard.isDisposed())
            throw new Error('Transform plugin is disposed.');
    }
}
//# sourceMappingURL=transform-controller.js.map