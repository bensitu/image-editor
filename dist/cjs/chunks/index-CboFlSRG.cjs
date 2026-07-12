'use strict';

var internalCapabilities = require('./internal-capabilities-DIerpWRs.cjs');

function fixPrototype(self, ctor) {
    Object.setPrototypeOf(self, ctor.prototype);
}
class ImageDecodeError extends Error {
    constructor(message = 'Failed to decode image data URL.', originalError = null) {
        super(message);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'ImageDecodeError'
        });
        Object.defineProperty(this, "originalError", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.originalError = originalError;
        fixPrototype(this, ImageDecodeError);
    }
}
class ImageLoadTimeoutError extends Error {
    constructor(label, elapsedMs) {
        super(`Image load timed out after ${elapsedMs}ms during ${label}`);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'ImageLoadTimeoutError'
        });
        Object.defineProperty(this, "label", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "elapsedMs", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.label = label;
        this.elapsedMs = elapsedMs;
        fixPrototype(this, ImageLoadTimeoutError);
    }
}
class ImageLoadBudgetExhaustedError extends Error {
    constructor(label, remainingMs, minimumMs) {
        super(`Image load budget exhausted before ${label}: ${remainingMs}ms remaining, minimum ${minimumMs}ms required.`);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'ImageLoadBudgetExhaustedError'
        });
        Object.defineProperty(this, "label", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "remainingMs", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "minimumMs", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.label = label;
        this.remainingMs = remainingMs;
        this.minimumMs = minimumMs;
        fixPrototype(this, ImageLoadBudgetExhaustedError);
    }
}
class DownsampleError extends Error {
    constructor(message = 'Failed to obtain a 2D context for downsampling.', originalError = null) {
        super(message);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'DownsampleError'
        });
        Object.defineProperty(this, "originalError", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.originalError = originalError;
        fixPrototype(this, DownsampleError);
    }
}
class MergeMasksError extends Error {
    constructor(message = 'Failed to merge masks into the image.', originalError = null) {
        super(message);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'MergeMasksError'
        });
        Object.defineProperty(this, "originalError", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.originalError = originalError;
        fixPrototype(this, MergeMasksError);
    }
}
class MergeAnnotationsError extends Error {
    constructor(message = 'Failed to merge annotations into the image.', originalError = null) {
        super(message);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'MergeAnnotationsError'
        });
        Object.defineProperty(this, "originalError", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.originalError = originalError;
        fixPrototype(this, MergeAnnotationsError);
    }
}
class CropApplyError extends Error {
    constructor(message = 'Failed to apply crop to the image.', originalError = null) {
        super(message);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'CropApplyError'
        });
        Object.defineProperty(this, "originalError", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.originalError = originalError;
        fixPrototype(this, CropApplyError);
    }
}
class StateRestoreError extends Error {
    constructor(message = 'Failed to restore editor state.', originalError = null) {
        super(message);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'StateRestoreError'
        });
        Object.defineProperty(this, "originalError", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.originalError = originalError;
        fixPrototype(this, StateRestoreError);
    }
}
class IdleGuardError extends Error {
    constructor(operation, reason) {
        super(`[ImageEditor] Cannot run "${operation}" ${reason}.`);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'IdleGuardError'
        });
        Object.defineProperty(this, "operation", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.operation = operation;
        fixPrototype(this, IdleGuardError);
    }
}
class ExportNotReadyError extends Error {
    constructor(operation = 'exportImageFile', reason = 'no image is loaded on the canvas') {
        super(`Cannot ${operation}: ${reason}.`);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'ExportNotReadyError'
        });
        Object.defineProperty(this, "operation", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.operation = operation;
        fixPrototype(this, ExportNotReadyError);
    }
}
class ExportError extends Error {
    constructor(message = 'Failed to export image.', originalError = null) {
        super(message);
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'ExportError'
        });
        Object.defineProperty(this, "originalError", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.originalError = originalError;
        fixPrototype(this, ExportError);
    }
}

class AnimationQueue {
    constructor() {
        Object.defineProperty(this, "queue", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "running", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
    }
    add(animationFn) {
        return new Promise((resolve, reject) => {
            this.queue.push({ run: animationFn, resolve, reject });
            if (!this.running) {
                void this.drainQueue();
            }
        });
    }
    clear(reason) {
        const pending = this.queue;
        this.queue = [];
        if (reason !== undefined) {
            for (const entry of pending) {
                entry.reject(reason);
            }
        }
        else {
            for (const entry of pending) {
                entry.resolve();
            }
        }
    }
    isRunning() {
        return this.running;
    }
    isBusy() {
        return this.running || this.queue.length > 0;
    }
    waitForIdle() {
        if (!this.running && this.queue.length === 0) {
            return Promise.resolve();
        }
        return this.add(() => Promise.resolve()).then(() => undefined, () => undefined);
    }
    async drainQueue() {
        if (this.running)
            return;
        this.running = true;
        try {
            while (this.queue.length > 0) {
                const entry = this.queue.shift();
                try {
                    await entry.run();
                    entry.resolve();
                }
                catch (error) {
                    entry.reject(error);
                }
            }
        }
        finally {
            this.running = false;
            if (this.queue.length > 0) {
                void this.drainQueue();
            }
        }
    }
}

class OperationGuard {
    constructor() {
        Object.defineProperty(this, "isAnimationActive", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "isDisposedFlag", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "isLoadingActive", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "currentOperationName", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "currentOperationToken", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "animationAborters", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Set()
        });
    }
    isAnimating() {
        return this.isAnimationActive;
    }
    isDisposed() {
        return this.isDisposedFlag;
    }
    isLoading() {
        return this.isLoadingActive;
    }
    activeOperationName() {
        return this.currentOperationName;
    }
    isBusy() {
        return (this.isAnimationActive || this.isLoadingActive || this.currentOperationToken !== null);
    }
    beginAnimation() {
        this.isAnimationActive = true;
    }
    endAnimation() {
        this.isAnimationActive = false;
    }
    markDisposed() {
        this.isDisposedFlag = true;
        this.isAnimationActive = false;
        this.isLoadingActive = false;
        this.currentOperationName = null;
        this.currentOperationToken = null;
        for (const abort of this.animationAborters) {
            try {
                abort();
            }
            catch {
            }
        }
        this.animationAborters.clear();
    }
    registerAnimationAborter(abort) {
        if (this.isDisposedFlag) {
            try {
                abort();
            }
            catch {
            }
            return () => undefined;
        }
        this.animationAborters.add(abort);
        return () => {
            this.animationAborters.delete(abort);
        };
    }
    beginLoading() {
        this.isLoadingActive = true;
    }
    endLoading() {
        this.isLoadingActive = false;
    }
    beginBusyOperation(operationName) {
        var _a;
        if (this.currentOperationToken !== null) {
            throw new IdleGuardError(operationName, `while ${(_a = this.currentOperationName) !== null && _a !== void 0 ? _a : 'another operation'} is running`);
        }
        const token = Symbol(operationName);
        this.currentOperationName = operationName;
        this.currentOperationToken = token;
        return token;
    }
    endBusyOperation(token) {
        if (token && token === this.currentOperationToken) {
            this.currentOperationName = null;
            this.currentOperationToken = null;
        }
    }
    isOwnOperation(token) {
        return !!token && token === this.currentOperationToken;
    }
    async runAnimation(animationTask) {
        this.beginAnimation();
        try {
            return await animationTask();
        }
        finally {
            this.endAnimation();
        }
    }
    assertNotAnimating(operationLabel) {
        if (this.isAnimationActive) {
            throw new IdleGuardError(operationLabel, 'while an animation is in progress');
        }
    }
    assertIdleForOperation(operationLabel, token) {
        var _a;
        if (this.isDisposedFlag) {
            throw new IdleGuardError(operationLabel, 'after dispose');
        }
        const ownOperation = this.isOwnOperation(token);
        if (this.isAnimationActive) {
            throw new IdleGuardError(operationLabel, 'while an animation is in progress');
        }
        if (this.isLoadingActive && !ownOperation) {
            throw new IdleGuardError(operationLabel, 'while an image is loading');
        }
        if (this.currentOperationToken && !ownOperation) {
            throw new IdleGuardError(operationLabel, `while ${(_a = this.currentOperationName) !== null && _a !== void 0 ? _a : 'another operation'} is running`);
        }
    }
    assertCanQueueAnimation(operationLabel, token) {
        var _a;
        if (this.isDisposedFlag) {
            throw new IdleGuardError(operationLabel, 'after dispose');
        }
        const ownOperation = this.isOwnOperation(token);
        if (this.isLoadingActive && !ownOperation) {
            throw new IdleGuardError(operationLabel, 'while an image is loading');
        }
        if (this.currentOperationToken && !ownOperation) {
            throw new IdleGuardError(operationLabel, `while ${(_a = this.currentOperationName) !== null && _a !== void 0 ? _a : 'another operation'} is running`);
        }
    }
}

const ANIMATION_SETTLE_GRACE_MS = 1000;
function animateProps(object, props, options, guard) {
    return new Promise((resolve, reject) => {
        const propCount = Object.keys(props).length;
        if (propCount === 0 || guard.isDisposed()) {
            resolve();
            return;
        }
        let completed = 0;
        let settled = false;
        let aborters = [];
        let timeoutId = null;
        let unregisterAborter = null;
        const cleanup = () => {
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            unregisterAborter === null || unregisterAborter === void 0 ? void 0 : unregisterAborter();
            unregisterAborter = null;
        };
        const settle = () => {
            if (settled)
                return;
            settled = true;
            cleanup();
            resolve();
        };
        const fail = (error) => {
            if (settled)
                return;
            settled = true;
            cleanup();
            reject(error);
        };
        const abortAndSettle = () => {
            for (const abort of aborters) {
                try {
                    abort();
                }
                catch {
                }
            }
            settle();
        };
        const duration = Number.isFinite(options.duration) ? Math.max(0, options.duration) : 0;
        timeoutId = setTimeout(abortAndSettle, duration + ANIMATION_SETTLE_GRACE_MS);
        unregisterAborter = guard.registerAnimationAborter(abortAndSettle);
        try {
            const animationResult = object.animate(props, {
                duration,
                onChange: () => {
                    var _a;
                    if (guard.isDisposed())
                        return;
                    (_a = options.onChange) === null || _a === void 0 ? void 0 : _a.call(options);
                },
                onComplete: () => {
                    if (++completed >= propCount)
                        settle();
                },
            });
            aborters = collectAnimationAborters(animationResult);
        }
        catch (error) {
            fail(error);
        }
    });
}
function collectAnimationAborters(animationResult) {
    const handles = Array.isArray(animationResult)
        ? animationResult
        : animationResult && typeof animationResult === 'object'
            ? Object.values(animationResult)
            : [animationResult];
    return handles.flatMap((handle) => {
        const abort = handle === null || handle === void 0 ? void 0 : handle.abort;
        return typeof abort === 'function' ? [() => abort.call(handle)] : [];
    });
}
function restoreOrigin(object, originX, originY) {
    try {
        object.set({ originX, originY });
        object.setCoords();
    }
    catch {
    }
}

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
function resolveTransformOptions(options = {}) {
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
class TransformPluginController {
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

const transformPluginRef = internalCapabilities.definePluginRef('@bensitu/transform', '1.0.0');
function isTransformState(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const candidate = value;
    return (typeof candidate.scale === 'number' &&
        Number.isFinite(candidate.scale) &&
        candidate.scale > 0 &&
        typeof candidate.rotationDegrees === 'number' &&
        Number.isFinite(candidate.rotationDegrees) &&
        typeof candidate.flipX === 'boolean' &&
        typeof candidate.flipY === 'boolean');
}
function transformPlugin(options = {}) {
    const resolved = resolveTransformOptions(options);
    let controller = null;
    return Object.freeze({
        ref: transformPluginRef,
        version: '1.0.0',
        setupMode: 'sync',
        requires: [
            { token: internalCapabilities.CORE_HOST_CAPABILITY, range: '^1.0.0' },
            { token: internalCapabilities.CORE_STATE_CAPABILITY, range: '^1.0.0' },
            { token: internalCapabilities.GEOMETRY_CAPABILITY, range: '^1.0.0' },
        ],
        setup(context) {
            const host = context.capabilities.require(internalCapabilities.CORE_HOST_CAPABILITY);
            const state = context.capabilities.require(internalCapabilities.CORE_STATE_CAPABILITY);
            const geometry = context.capabilities.require(internalCapabilities.GEOMETRY_CAPABILITY);
            controller = new TransformPluginController(host, geometry, resolved);
            for (const [id, mode] of [
                ['transform:scale', 'animation'],
                ['transform:zoom-in', 'animation'],
                ['transform:zoom-out', 'animation'],
                ['transform:rotate', 'animation'],
                ['transform:flip-horizontal', 'busy'],
                ['transform:flip-vertical', 'busy'],
                ['transform:reset', 'animation'],
            ]) {
                context.operations.register({ id, mode });
            }
            context.addDisposable(state.slices.register({
                id: transformPluginRef.id,
                version: 1,
                capture: () => {
                    var _a;
                    return (_a = controller === null || controller === void 0 ? void 0 : controller.getState()) !== null && _a !== void 0 ? _a : {
                        scale: 1,
                        rotationDegrees: 0,
                        flipX: false,
                        flipY: false,
                    };
                },
                validate: (value) => isTransformState(value)
                    ? { valid: true, value }
                    : { valid: false, message: 'Transform state is malformed.' },
                restore: (value) => controller === null || controller === void 0 ? void 0 : controller.restoreState(value),
                clearState: () => controller === null || controller === void 0 ? void 0 : controller.resetStateFromImage(),
            }));
            const requireController = () => {
                if (!controller)
                    throw new Error('Transform plugin is not installed.');
                return controller;
            };
            return Object.freeze({
                scale: (factor) => requireController().scale(factor),
                zoomIn: () => requireController().zoomIn(),
                zoomOut: () => requireController().zoomOut(),
                rotate: (degrees) => requireController().rotate(degrees),
                flipHorizontal: () => requireController().flipHorizontal(),
                flipVertical: () => requireController().flipVertical(),
                resetImageTransform: () => requireController().resetImageTransform(),
                reset: () => requireController().resetImageTransform(),
                getState: () => requireController().getState(),
                synchronizeCompatibilityState: (state) => requireController().restoreState(state),
            });
        },
        onImageLoaded() {
            controller === null || controller === void 0 ? void 0 : controller.resetStateFromImage();
        },
        onImageCleared() {
            controller === null || controller === void 0 ? void 0 : controller.resetStateFromImage();
        },
        onDispose() {
            controller === null || controller === void 0 ? void 0 : controller.dispose();
            controller = null;
        },
    });
}

exports.AnimationQueue = AnimationQueue;
exports.CropApplyError = CropApplyError;
exports.DownsampleError = DownsampleError;
exports.ExportError = ExportError;
exports.ExportNotReadyError = ExportNotReadyError;
exports.IdleGuardError = IdleGuardError;
exports.ImageDecodeError = ImageDecodeError;
exports.ImageLoadBudgetExhaustedError = ImageLoadBudgetExhaustedError;
exports.ImageLoadTimeoutError = ImageLoadTimeoutError;
exports.MergeAnnotationsError = MergeAnnotationsError;
exports.MergeMasksError = MergeMasksError;
exports.OperationGuard = OperationGuard;
exports.StateRestoreError = StateRestoreError;
exports.transformPlugin = transformPlugin;
exports.transformPluginRef = transformPluginRef;
//# sourceMappingURL=index-CboFlSRG.cjs.map
