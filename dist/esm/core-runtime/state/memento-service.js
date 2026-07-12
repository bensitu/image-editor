import { MementoCaptureError, MementoRestoreError, StateRegistrationError } from '../errors.js';
import { cloneStateValue } from './clone-state-value.js';
function createAbortError(message) {
    if (typeof DOMException === 'function')
        return new DOMException(message, 'AbortError');
    const error = new Error(message);
    error.name = 'AbortError';
    return error;
}
function throwIfAborted(signal) {
    var _a;
    if (signal.aborted)
        throw (_a = signal.reason) !== null && _a !== void 0 ? _a : createAbortError('State restoration was aborted.');
}
export class MementoService {
    constructor(coreAdapter, slices) {
        Object.defineProperty(this, "coreAdapter", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: coreAdapter
        });
        Object.defineProperty(this, "slices", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: slices
        });
        Object.defineProperty(this, "trustedMementos", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new WeakSet()
        });
        Object.defineProperty(this, "revision", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "restoring", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "disposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
    }
    capture() {
        this.assertActive('capture a memento');
        if (this.restoring) {
            throw new StateRegistrationError('Cannot capture a new memento during restoration.');
        }
        return this.captureInternal();
    }
    isTrusted(value) {
        return typeof value === 'object' && value !== null && this.trustedMementos.has(value);
    }
    async restore(memento, options = {}) {
        this.assertActive('restore a memento');
        if (!this.isTrusted(memento)) {
            throw new MementoRestoreError('core', 'restore', new Error('Untrusted memento.'));
        }
        if (this.restoring) {
            throw new MementoRestoreError('core', 'restore', new Error('Reentrant memento restoration is not allowed.'));
        }
        const controller = new AbortController();
        const providedSignal = options.signal;
        const abort = () => controller.abort(providedSignal === null || providedSignal === void 0 ? void 0 : providedSignal.reason);
        providedSignal === null || providedSignal === void 0 ? void 0 : providedSignal.addEventListener('abort', abort, { once: true });
        if (providedSignal === null || providedSignal === void 0 ? void 0 : providedSignal.aborted)
            abort();
        this.restoring = true;
        let rollback = null;
        try {
            if (options.rollbackOnFailure !== false)
                rollback = this.captureInternal();
            await this.restoreInternal(memento, 'trusted-memento', controller.signal);
        }
        catch (error) {
            if (!rollback) {
                if (error instanceof MementoRestoreError)
                    throw error;
                throw new MementoRestoreError('core', 'restore', error);
            }
            const rollbackErrors = [];
            try {
                await this.restoreInternal(rollback, 'rollback', new AbortController().signal);
            }
            catch (rollbackError) {
                rollbackErrors.push(rollbackError);
            }
            if (error instanceof MementoRestoreError) {
                throw new MementoRestoreError(error.sliceId, 'restore', error.cause, rollbackErrors);
            }
            throw new MementoRestoreError('core', 'restore', error, rollbackErrors);
        }
        finally {
            providedSignal === null || providedSignal === void 0 ? void 0 : providedSignal.removeEventListener('abort', abort);
            this.restoring = false;
        }
    }
    dispose() {
        this.disposed = true;
    }
    captureInternal() {
        const capturedAt = Date.now();
        const context = Object.freeze({ mode: 'memento', capturedAt });
        let core;
        try {
            core = cloneStateValue(this.coreAdapter.capture(context));
        }
        catch (error) {
            throw new MementoCaptureError('core', error);
        }
        const plugins = Object.create(null);
        for (const slice of this.slices.list()) {
            try {
                plugins[slice.id] = Object.freeze({
                    version: slice.version,
                    data: cloneStateValue(slice.capture(context)),
                });
            }
            catch (error) {
                throw new MementoCaptureError(slice.id, error);
            }
        }
        const memento = Object.freeze({
            revision: ++this.revision,
            capturedAt,
            core,
            plugins: Object.freeze(plugins),
        });
        this.trustedMementos.add(memento);
        return memento;
    }
    async restoreInternal(memento, mode, signal) {
        var _a;
        const context = Object.freeze({ mode, signal });
        throwIfAborted(signal);
        try {
            await this.coreAdapter.restore(cloneStateValue(memento.core), context);
        }
        catch (error) {
            throw new MementoRestoreError('core', mode === 'rollback' ? 'rollback' : 'restore', error);
        }
        for (const slice of this.slices.list()) {
            throwIfAborted(signal);
            const entry = memento.plugins[slice.id];
            try {
                if (!entry) {
                    await ((_a = slice.clearState) === null || _a === void 0 ? void 0 : _a.call(slice, context));
                    continue;
                }
                if (entry.version !== slice.version) {
                    throw new Error(`Captured version ${entry.version} does not match installed version ${slice.version}.`);
                }
                await slice.restore(cloneStateValue(entry.data), context);
            }
            catch (error) {
                throw new MementoRestoreError(slice.id, mode === 'rollback' ? 'rollback' : 'restore', error);
            }
        }
    }
    assertActive(operation) {
        if (this.disposed) {
            throw new StateRegistrationError(`Cannot ${operation} after MementoService disposal.`);
        }
    }
}
//# sourceMappingURL=memento-service.js.map