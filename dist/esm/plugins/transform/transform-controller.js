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
class MutationAnimationScope {
    constructor(owner, unregisterScope) {
        Object.defineProperty(this, "owner", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: owner
        });
        Object.defineProperty(this, "unregisterScope", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: unregisterScope
        });
        Object.defineProperty(this, "cancelled", {
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
        Object.defineProperty(this, "idleWaiters", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Set()
        });
    }
    isDisposed() {
        return this.cancelled || this.owner.isDisposed();
    }
    registerAnimationAborter(abort) {
        if (this.isDisposed()) {
            abort();
            return () => undefined;
        }
        this.aborters.add(abort);
        return () => {
            this.aborters.delete(abort);
            this.resolveIdleWaiters();
        };
    }
    cancelAnimations() {
        if (this.cancelled)
            return this.waitForIdle();
        this.cancelled = true;
        for (const abort of [...this.aborters]) {
            try {
                abort();
            }
            catch {
                this.aborters.delete(abort);
            }
        }
        return this.waitForIdle();
    }
    dispose() {
        if (!this.cancelled) {
            this.cancelled = true;
            for (const abort of [...this.aborters]) {
                try {
                    abort();
                }
                catch {
                }
            }
        }
        this.aborters.clear();
        this.resolveIdleWaiters();
        this.unregisterScope();
    }
    waitForIdle() {
        if (this.aborters.size === 0)
            return Promise.resolve();
        return new Promise((resolve) => this.idleWaiters.add(resolve));
    }
    resolveIdleWaiters() {
        if (this.aborters.size > 0)
            return;
        for (const resolve of this.idleWaiters)
            resolve();
        this.idleWaiters.clear();
    }
}
class PluginAnimationControl {
    constructor() {
        Object.defineProperty(this, "disposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "scopes", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Set()
        });
    }
    isDisposed() {
        return this.disposed;
    }
    createScope() {
        const scope = new MutationAnimationScope(this, () => this.scopes.delete(scope));
        if (this.disposed) {
            scope.dispose();
        }
        else {
            this.scopes.add(scope);
        }
        return scope;
    }
    dispose() {
        if (this.disposed)
            return;
        this.disposed = true;
        for (const scope of [...this.scopes])
            scope.dispose();
        this.scopes.clear();
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
        return this.enqueue(operationId, async (signal, animations) => {
            const image = this.baseImage.getBaseImage();
            if (!image)
                return;
            await this.applyScale(image, factor, signal, animations);
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
        return this.enqueue('transform:rotate', async (signal, animations) => {
            const image = this.baseImage.getBaseImage();
            if (!image)
                return;
            await this.applyRotation(image, degrees, signal, animations);
        }, options);
    }
    flipHorizontal(options = {}) {
        return this.flip('flipX', 'transform:flip-horizontal', options);
    }
    flipVertical(options = {}) {
        return this.flip('flipY', 'transform:flip-vertical', options);
    }
    resetImageTransform(options = {}) {
        return this.enqueue('transform:reset', async (signal, animations) => {
            const image = this.baseImage.getBaseImage();
            if (!image)
                return;
            await this.applyScale(image, 1, signal, animations);
            await this.applyRotation(image, 0, signal, animations);
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
        const animations = this.animations.createScope();
        let operation;
        try {
            operation = this.geometry.run({
                id: mutationId,
                kind: 'transform',
                operationId,
                ...(options.parent ? { parent: options.parent } : {}),
                mutateBase: async ({ signal }) => {
                    await mutate(signal, animations);
                },
                rollbackBase: async () => {
                    await animations.cancelAnimations();
                    this.restoreRollback(image, rollback);
                },
                metadata: Object.freeze({ pluginId: 'plugin:transform' }),
            });
        }
        catch (error) {
            animations.dispose();
            return Promise.reject(error);
        }
        return operation.then(() => undefined).finally(() => animations.dispose());
    }
    async applyScale(image, factor, signal, animations) {
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
        }, animations), animations);
        this.throwIfAborted(signal);
        image.set({ scaleX: target, scaleY: target });
        image.setCoords();
        this.state.scale = scale;
    }
    async applyRotation(image, degrees, signal, animations) {
        this.throwIfAborted(signal);
        const center = image.getCenterPoint();
        image.set({ originX: 'center', originY: 'center' });
        image.setPositionByOrigin(center, 'center', 'center');
        image.setCoords();
        try {
            await this.runAnimation(signal, () => animateProps(image, { angle: degrees }, {
                duration: this.options.animationDuration,
                onChange: () => this.render.requestRender(),
            }, animations), animations);
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
    async runAnimation(signal, animation, animations) {
        const cancel = () => {
            animations.cancelAnimations().catch(() => undefined);
        };
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