import { animateProps, restoreOrigin, } from '../../fabric/fabric-animation.js';
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
class PluginAnimationControl {
    constructor() {
        Object.defineProperty(this, "disposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "aborters", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Set()
        });
    }
    isDisposed() {
        return this.disposed;
    }
    registerAnimationAborter(abort) {
        if (this.disposed) {
            abort();
            return () => undefined;
        }
        this.aborters.add(abort);
        return () => this.aborters.delete(abort);
    }
    cancelAnimations() {
        for (const abort of [...this.aborters]) {
            try {
                abort();
            }
            catch {
            }
        }
        this.aborters.clear();
    }
    dispose() {
        this.disposed = true;
        this.cancelAnimations();
    }
}
export class TransformPluginController {
    constructor(environment, baseImage, render, geometry, options) {
        Object.defineProperty(this, "environment", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: environment
        });
        Object.defineProperty(this, "baseImage", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: baseImage
        });
        Object.defineProperty(this, "render", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: render
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
        Object.defineProperty(this, "animations", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new PluginAnimationControl()
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
    scale(factor, options = {}) {
        return this.scaleWithOperation(factor, 'transform:scale', options);
    }
    scaleWithOperation(factor, operationId, options = {}) {
        if (!Number.isFinite(factor))
            return Promise.resolve();
        return this.enqueue(operationId, async (signal) => {
            const image = this.baseImage.getBaseImage();
            if (!image)
                return;
            await this.applyScale(image, factor, signal);
        }, options);
    }
    zoomIn(options = {}) {
        return this.scaleWithOperation(this.state.scale + this.options.scaleStep, 'transform:zoom-in', options);
    }
    zoomOut(options = {}) {
        return this.scaleWithOperation(this.state.scale - this.options.scaleStep, 'transform:zoom-out', options);
    }
    rotate(degrees, options = {}) {
        if (!Number.isFinite(degrees))
            return Promise.resolve();
        return this.enqueue('transform:rotate', async (signal) => {
            const image = this.baseImage.getBaseImage();
            if (!image)
                return;
            await this.applyRotation(image, degrees, signal);
        }, options);
    }
    flipHorizontal(options = {}) {
        return this.flip('flipX', 'transform:flip-horizontal', options);
    }
    flipVertical(options = {}) {
        return this.flip('flipY', 'transform:flip-vertical', options);
    }
    resetImageTransform(options = {}) {
        return this.enqueue('transform:reset', async (signal) => {
            const image = this.baseImage.getBaseImage();
            if (!image)
                return;
            await this.applyScale(image, 1, signal);
            await this.applyRotation(image, 0, signal);
            image.set({ flipX: false, flipY: false });
            image.setCoords();
            this.state.flipX = false;
            this.state.flipY = false;
        }, options);
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
        const image = this.baseImage.getBaseImage();
        this.state.scale = 1;
        this.state.rotationDegrees = Number(image === null || image === void 0 ? void 0 : image.angle) || 0;
        this.state.flipX = (image === null || image === void 0 ? void 0 : image.flipX) === true;
        this.state.flipY = (image === null || image === void 0 ? void 0 : image.flipY) === true;
    }
    dispose() {
        this.animations.dispose();
    }
    flip(property, operationId, options) {
        return this.enqueue(operationId, async () => {
            const image = this.baseImage.getBaseImage();
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
        }, options);
    }
    enqueue(operationId, mutate, options) {
        if (this.animations.isDisposed())
            return Promise.resolve();
        const image = this.baseImage.getBaseImage();
        if (!image)
            return Promise.resolve();
        const rollback = this.captureRollback(image);
        const mutationId = `${operationId}:${++this.mutationSequence}`;
        return this.geometry
            .run({
            id: mutationId,
            kind: 'transform',
            operationId,
            parent: options.parent,
            mutateBase: async ({ signal }) => {
                await mutate(signal);
            },
            rollbackBase: () => this.restoreRollback(image, rollback),
            metadata: Object.freeze({ pluginId: '@bensitu/transform' }),
        })
            .then(() => undefined);
    }
    async applyScale(image, factor, signal) {
        this.throwIfAborted(signal);
        const scale = Math.max(this.options.minScale, Math.min(this.options.maxScale, factor));
        const topLeft = this.computeTopLeftPoint(image);
        image.set({ originX: 'left', originY: 'top' });
        image.setPositionByOrigin(topLeft, 'left', 'top');
        image.setCoords();
        const target = this.baseImage.getBaseImageScale() * scale;
        await this.runAnimation(signal, () => animateProps(image, { scaleX: target, scaleY: target }, {
            duration: this.options.animationDuration,
            onChange: () => this.render.requestRender(),
        }, this.animations));
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
            await this.runAnimation(signal, () => animateProps(image, { angle: degrees }, {
                duration: this.options.animationDuration,
                onChange: () => this.render.requestRender(),
            }, this.animations));
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
            if (this.animations.isDisposed())
                restoreOrigin(image, 'left', 'top');
        }
    }
    captureRollback(image) {
        var _a, _b;
        return Object.freeze({
            transform: this.getState(),
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
        if (this.environment.isDisposed())
            return;
        image.set(rollback.image);
        image.setCoords();
        this.restoreState(rollback.transform);
        this.render.requestRender();
    }
    computeTopLeftPoint(image) {
        image.setCoords();
        const first = image.getCoords()[0];
        if (first)
            return first;
        const bounds = image.getBoundingRect();
        const PointConstructor = this.environment.fabric.Point;
        if (typeof PointConstructor === 'function') {
            return new PointConstructor(bounds.left, bounds.top);
        }
        return { x: bounds.left, y: bounds.top };
    }
    throwIfAborted(signal) {
        var _a;
        if (signal.aborted)
            throw (_a = signal.reason) !== null && _a !== void 0 ? _a : new Error('Transform operation aborted.');
        if (this.animations.isDisposed())
            throw new Error('Transform plugin is disposed.');
    }
    async runAnimation(signal, animation) {
        const cancel = () => this.animations.cancelAnimations();
        signal.addEventListener('abort', cancel, { once: true });
        if (signal.aborted)
            cancel();
        try {
            await animation();
        }
        finally {
            signal.removeEventListener('abort', cancel);
        }
    }
}
//# sourceMappingURL=transform-controller.js.map