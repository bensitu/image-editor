'use strict';

var internalCapabilities = require('../../chunks/internal-capabilities-DIerpWRs.cjs');
var errors = require('../../chunks/errors-CQdnZvQh.cjs');

function resolveMaxSize(value) {
    return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : 50;
}
class HistoryPluginController {
    constructor(state, operations, options = {}, reportWarning) {
        Object.defineProperty(this, "state", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: state
        });
        Object.defineProperty(this, "operations", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: operations
        });
        Object.defineProperty(this, "reportWarning", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: reportWarning
        });
        Object.defineProperty(this, "records", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "position", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "listeners", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Set()
        });
        Object.defineProperty(this, "disposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "maxSize", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.maxSize = resolveMaxSize(options.maxSize);
        if (options.onChange)
            this.listeners.add(options.onChange);
    }
    isAvailable() {
        return !this.disposed;
    }
    commit(record) {
        if (record.operationId === 'core:load-image' || record.operationId === 'core:load-state') {
            this.clear();
            return;
        }
        this.push(record);
    }
    push(record) {
        this.assertActive('push History');
        if (!record || typeof record.operationId !== 'string' || record.operationId.length === 0) {
            throw new errors.CoreRuntimeError('[ImageEditor] History record operationId is invalid.');
        }
        if (this.position < this.records.length) {
            this.records = this.records.slice(0, this.position);
        }
        this.records.push(Object.freeze({
            operationId: record.operationId,
            before: record.before,
            after: record.after,
            timestamp: record.timestamp,
            detail: record.detail,
        }));
        if (this.records.length > this.maxSize) {
            const overflow = this.records.length - this.maxSize;
            this.records.splice(0, overflow);
        }
        this.position = this.records.length;
        this.emitChange();
    }
    undo() {
        this.assertActive('undo');
        if (!this.canUndo())
            return Promise.resolve();
        return this.operations.run('history:undo', async () => {
            const record = this.records[this.position - 1];
            if (!record)
                return;
            await this.restoreTransactionally(record.before, 'undo');
            this.position -= 1;
            this.emitChange();
        });
    }
    redo() {
        this.assertActive('redo');
        if (!this.canRedo())
            return Promise.resolve();
        return this.operations.run('history:redo', async () => {
            const record = this.records[this.position];
            if (!record)
                return;
            await this.restoreTransactionally(record.after, 'redo');
            this.position += 1;
            this.emitChange();
        });
    }
    canUndo() {
        return !this.disposed && this.position > 0;
    }
    canRedo() {
        return !this.disposed && this.position < this.records.length;
    }
    clear() {
        if (this.disposed)
            return;
        const changed = this.records.length > 0 || this.position !== 0;
        this.records = [];
        this.position = 0;
        if (changed)
            this.emitChange();
    }
    onChange(handler) {
        this.assertActive('subscribe to History');
        this.listeners.add(handler);
        return () => {
            this.listeners.delete(handler);
        };
    }
    getState() {
        return Object.freeze({
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            size: this.records.length,
            position: this.position,
        });
    }
    dispose() {
        if (this.disposed)
            return;
        this.records = [];
        this.position = 0;
        this.listeners.clear();
        this.disposed = true;
    }
    async restoreTransactionally(target, operation) {
        const rollback = this.state.mementos.capture();
        try {
            await this.state.mementos.restore(target);
        }
        catch (error) {
            try {
                await this.state.mementos.restore(rollback);
            }
            catch (rollbackError) {
                throw new errors.CoreRuntimeError(`[ImageEditor] History ${operation} failed and rollback could not restore state.`, {
                    code: 'HISTORY_UNRECOVERABLE_ERROR',
                    cause: Object.freeze([error, rollbackError]),
                });
            }
            throw new errors.CoreRuntimeError(`[ImageEditor] History ${operation} failed.`, {
                code: 'HISTORY_RESTORE_ERROR',
                cause: error,
            });
        }
    }
    emitChange() {
        const availability = this.getState();
        for (const listener of [...this.listeners]) {
            try {
                listener(availability);
            }
            catch (error) {
                this.reportWarning(error, 'History onChange callback failed.');
            }
        }
    }
    assertActive(operation) {
        if (this.disposed) {
            throw new errors.CoreRuntimeError(`[ImageEditor] Cannot ${operation} after History disposal.`);
        }
    }
}

const HISTORY_CAPABILITY = internalCapabilities.createCapabilityToken('plugin.history', '1.0.0');
const historyPluginRef = internalCapabilities.definePluginRef('@bensitu/history', '1.0.0');
function historyPlugin(options = {}) {
    let controller = null;
    return Object.freeze({
        ref: historyPluginRef,
        version: '1.0.0',
        setupMode: 'sync',
        requires: [
            { token: internalCapabilities.CORE_HOST_CAPABILITY, range: '^1.0.0' },
            { token: internalCapabilities.CORE_STATE_CAPABILITY, range: '^1.0.0' },
        ],
        setup(context) {
            const host = context.capabilities.require(internalCapabilities.CORE_HOST_CAPABILITY);
            const state = context.capabilities.require(internalCapabilities.CORE_STATE_CAPABILITY);
            context.operations.register({ id: 'history:undo', mode: 'busy' });
            context.operations.register({ id: 'history:redo', mode: 'busy' });
            controller = new HistoryPluginController(state, {
                run: async (operationId, body) => {
                    const token = context.operations.begin(operationId);
                    try {
                        await body();
                    }
                    finally {
                        await token.dispose();
                    }
                },
            }, options, (error, message) => host.reportWarning(error, message));
            context.addDisposable(state.registerHistoryProvider(historyPluginRef.id, controller));
            context.capabilities.provide(HISTORY_CAPABILITY, controller);
            return controller;
        },
        onImageLoaded() {
            controller === null || controller === void 0 ? void 0 : controller.clear();
        },
        onDispose() {
            controller === null || controller === void 0 ? void 0 : controller.dispose();
            controller = null;
        },
    });
}

exports.HISTORY_CAPABILITY = HISTORY_CAPABILITY;
exports.historyPlugin = historyPlugin;
exports.historyPluginRef = historyPluginRef;
//# sourceMappingURL=index.cjs.map
