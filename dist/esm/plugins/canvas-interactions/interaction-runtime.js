import { observePromise, } from '../../sdk/index.js';
function isPromiseLike(value) {
    return ((typeof value === 'object' || typeof value === 'function') &&
        value !== null &&
        typeof value.then === 'function');
}
export class InteractionRuntime {
    constructor(bindings, tools, diagnostics, options, onStatusChange) {
        Object.defineProperty(this, "bindings", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: bindings
        });
        Object.defineProperty(this, "diagnostics", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: diagnostics
        });
        Object.defineProperty(this, "options", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: options
        });
        Object.defineProperty(this, "onStatusChange", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: onStatusChange
        });
        Object.defineProperty(this, "toolSubscription", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "activeToolId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "activeGesture", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "epoch", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "lifecycleEpoch", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "disposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        this.assertUniqueBindings();
        this.activeToolId = tools.getActiveToolId();
        this.toolSubscription = tools.subscribe(({ activeToolId }) => {
            this.activeToolId = activeToolId;
            const owner = this.activeGesture;
            if (owner && owner.binding.toolId !== activeToolId) {
                this.invalidateLocal('tool-change');
            }
            else {
                this.onStatusChange();
            }
        }, { emitCurrent: false });
    }
    down(sample) {
        if (this.disposed || this.activeGesture || !this.activeToolId)
            return;
        const binding = this.bindings.find((candidate) => candidate.toolId === this.activeToolId);
        if (!binding)
            return;
        const epoch = ++this.epoch;
        const lifecycleEpoch = this.lifecycleEpoch;
        const gestureContext = Object.freeze({
            epoch,
            isCurrent: () => this.isEpochCurrent(epoch),
            canResume: (toolId) => !this.disposed &&
                this.lifecycleEpoch === lifecycleEpoch &&
                (this.activeToolId === null || this.activeToolId === toolId),
        });
        try {
            const claim = binding.claim({
                sample,
                activeToolId: this.activeToolId,
                gesture: gestureContext,
            });
            if (!claim)
                return;
            this.activeGesture = {
                binding,
                gesture: claim.gesture,
                epoch,
                geometryRevision: sample.geometryRevision,
                ending: false,
            };
            this.onStatusChange();
            if (isPromiseLike(claim.started)) {
                observePromise(claim.started, (error) => {
                    var _a;
                    if (((_a = this.activeGesture) === null || _a === void 0 ? void 0 : _a.epoch) === epoch) {
                        this.handleError(error, binding.id, 'claim');
                    }
                });
            }
        }
        catch (error) {
            this.handleError(error, binding.id, 'claim');
        }
    }
    move(sample) {
        const owner = this.activeGesture;
        if (!owner || owner.ending || !this.isSampleCurrent(owner, sample))
            return;
        this.invoke(owner, 'move', () => owner.binding.move(owner.gesture, sample));
    }
    up(sample) {
        const owner = this.activeGesture;
        if (!owner || owner.ending || !this.isSampleCurrent(owner, sample))
            return;
        owner.ending = true;
        this.invoke(owner, 'end', () => owner.binding.end(owner.gesture, sample), true);
    }
    cancel() {
        if (this.disposed)
            return;
        observePromise(this.cancelGesture('pointer-cancel'), (error) => {
            this.reportError(error, null, 'cancel');
        });
    }
    async cancelGesture(reason = 'requested') {
        this.assertActive('cancel Canvas interactions');
        const owner = this.activeGesture;
        this.invalidateLocal(reason);
        if (!owner)
            return;
        try {
            await owner.binding.cancel(owner.gesture, reason);
        }
        catch (error) {
            this.reportError(error, owner.binding.id, 'cancel');
            throw error;
        }
    }
    invalidateLifecycle(reason) {
        if (this.disposed)
            return;
        this.lifecycleEpoch += 1;
        this.invalidateLocal(reason);
    }
    status() {
        var _a;
        const activeBinding = this.activeToolId
            ? this.bindings.find((binding) => binding.toolId === this.activeToolId)
            : undefined;
        return Object.freeze({
            activeBindingId: (_a = activeBinding === null || activeBinding === void 0 ? void 0 : activeBinding.id) !== null && _a !== void 0 ? _a : null,
            gestureActive: this.activeGesture !== null,
        });
    }
    dispose() {
        if (this.disposed)
            return;
        this.lifecycleEpoch += 1;
        this.invalidateLocal('dispose');
        this.disposed = true;
        const cleanup = this.toolSubscription.dispose();
        if (isPromiseLike(cleanup)) {
            observePromise(cleanup, (error) => {
                this.diagnostics.reportWarning(error, 'Canvas interaction Tool subscription cleanup failed.');
            });
        }
    }
    invoke(owner, operation, task, complete = false) {
        try {
            const result = task();
            if (isPromiseLike(result)) {
                observePromise(Promise.resolve(result).then(() => {
                    if (complete && this.activeGesture === owner)
                        this.complete(owner);
                }), (error) => {
                    if (this.activeGesture === owner) {
                        this.handleError(error, owner.binding.id, operation);
                    }
                });
            }
            else if (complete && this.activeGesture === owner) {
                this.complete(owner);
            }
        }
        catch (error) {
            this.handleError(error, owner.binding.id, operation);
        }
    }
    complete(owner) {
        if (this.activeGesture !== owner)
            return;
        this.activeGesture = null;
        this.onStatusChange();
    }
    isSampleCurrent(owner, sample) {
        if (sample.geometryRevision === owner.geometryRevision)
            return true;
        this.invalidateLocal('image-replaced');
        return false;
    }
    isEpochCurrent(epoch) {
        var _a;
        return !this.disposed && this.epoch === epoch && ((_a = this.activeGesture) === null || _a === void 0 ? void 0 : _a.epoch) === epoch;
    }
    invalidateLocal(_reason) {
        this.epoch += 1;
        const hadGesture = this.activeGesture !== null;
        this.activeGesture = null;
        if (hadGesture)
            this.onStatusChange();
    }
    handleError(error, bindingId, operation) {
        const owner = this.activeGesture;
        this.invalidateLocal('error');
        if (owner) {
            try {
                const cleanup = owner.binding.cancel(owner.gesture, 'error');
                if (isPromiseLike(cleanup)) {
                    observePromise(cleanup, (cleanupError) => {
                        this.reportError(cleanupError, owner.binding.id, 'cancel');
                    });
                }
            }
            catch (cleanupError) {
                this.reportError(cleanupError, owner.binding.id, 'cancel');
            }
        }
        this.reportError(error, bindingId, operation);
    }
    reportError(error, bindingId, operation) {
        var _a, _b;
        this.diagnostics.reportError(error, `Canvas interaction ${operation} failed${bindingId ? ` for "${bindingId}"` : ''}.`);
        try {
            (_b = (_a = this.options).onInteractionError) === null || _b === void 0 ? void 0 : _b.call(_a, error, Object.freeze({ bindingId, operation }));
        }
        catch (callbackError) {
            this.diagnostics.reportWarning(callbackError, 'A Canvas interaction error observer failed.');
        }
    }
    assertUniqueBindings() {
        const ids = new Set();
        const tools = new Set();
        for (const binding of this.bindings) {
            if (ids.has(binding.id)) {
                throw new Error(`[ImageEditor] Duplicate Canvas interaction binding "${binding.id}".`);
            }
            if (tools.has(binding.toolId)) {
                throw new Error(`[ImageEditor] Canvas interaction Tool "${binding.toolId}" has multiple bindings.`);
            }
            ids.add(binding.id);
            tools.add(binding.toolId);
        }
    }
    assertActive(operation) {
        if (this.disposed) {
            throw new Error(`[ImageEditor] Cannot ${operation} after Canvas Interactions disposal.`);
        }
    }
}
//# sourceMappingURL=interaction-runtime.js.map