'use strict';

var errors = require('../../chunks/errors-DeAfrgDC.cjs');
var pluginManifest = require('../../chunks/plugin-manifest-DNqSyjh2.cjs');
var pluginDefinition = require('../../chunks/plugin-definition-C87dytjB.cjs');
var coreCapabilities = require('../../chunks/core-capabilities-CWNPa1MZ.cjs');
require('../../chunks/plugin-identifier-DPwx4Gkd.cjs');

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
        Object.defineProperty(this, "baseline", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
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
        this.enabled = options.enabled !== false;
        this.maxSize = resolveMaxSize(options.maxSize);
        if (options.onChange)
            this.listeners.add(options.onChange);
    }
    get isEnabled() {
        return !this.disposed && this.enabled;
    }
    get length() {
        return this.records.length;
    }
    isAvailable() {
        return !this.disposed;
    }
    commit(record) {
        if (!this.isEnabled)
            return;
        if (record.operationId === 'core:load-image' ||
            record.operationId === 'core:commit-load-image' ||
            record.operationId === 'core:load-state') {
            const changed = this.resetTimeline();
            this.baseline = record.after;
            if (changed)
                this.emitChange();
            return;
        }
        this.push(record);
    }
    push(record) {
        var _a;
        this.assertActive('push History');
        if (!this.enabled)
            return;
        if (!record || typeof record.operationId !== 'string' || record.operationId.length === 0) {
            throw new errors.CoreRuntimeError('[ImageEditor] History record operationId is invalid.');
        }
        (_a = this.baseline) !== null && _a !== void 0 ? _a : (this.baseline = record.before);
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
    enable(options) {
        this.assertActive('enable History');
        if ((options === null || options === void 0 ? void 0 : options.baseline) !== 'current') {
            throw new errors.CoreRuntimeError('[ImageEditor] History can enable only from the current baseline.', {
                code: 'HISTORY_BASELINE_UNSUPPORTED',
            });
        }
        return this.operations.run('history:enable', async () => {
            if (this.enabled)
                return;
            const baseline = this.state.captureMemento();
            this.records = [];
            this.position = 0;
            this.baseline = baseline;
            this.enabled = true;
            this.emitChange();
        });
    }
    disable(options = {}) {
        var _a;
        this.assertActive('disable History');
        if (options.clear !== undefined && typeof options.clear !== 'boolean') {
            throw new errors.CoreRuntimeError('[ImageEditor] History disable clear must be a boolean.', {
                code: 'HISTORY_DISABLE_OPTION_INVALID',
            });
        }
        const shouldClear = (_a = options.clear) !== null && _a !== void 0 ? _a : true;
        return this.operations.run('history:disable', async () => {
            const wasEnabled = this.enabled;
            const hadRecords = this.records.length > 0 || this.position !== 0;
            this.enabled = false;
            if (shouldClear)
                this.resetTimeline();
            if (wasEnabled || (shouldClear && hadRecords))
                this.emitChange();
        });
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
        return this.isEnabled && this.position > 0;
    }
    canRedo() {
        return this.isEnabled && this.position < this.records.length;
    }
    clear() {
        if (this.disposed)
            return;
        if (this.resetTimeline())
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
            isEnabled: this.isEnabled,
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            length: this.records.length,
            size: this.records.length,
            position: this.position,
        });
    }
    dispose() {
        if (this.disposed)
            return;
        this.records = [];
        this.position = 0;
        this.baseline = null;
        this.enabled = false;
        this.listeners.clear();
        this.disposed = true;
    }
    resetTimeline() {
        const changed = this.records.length > 0 || this.position !== 0;
        this.records = [];
        this.position = 0;
        this.baseline = null;
        return changed;
    }
    async restoreTransactionally(target, operation) {
        const rollback = this.state.captureMemento();
        try {
            await this.state.restoreMemento(target);
        }
        catch (error) {
            try {
                await this.state.restoreMemento(rollback);
            }
            catch (rollbackError) {
                const failure = new errors.CoreRuntimeError(`[ImageEditor] History ${operation} failed and rollback could not restore state.`, {
                    code: 'HISTORY_UNRECOVERABLE_ERROR',
                    cause: Object.freeze([error, rollbackError]),
                    behavior: 'fatal-rollback',
                });
                this.state.reportFatal(failure);
                throw failure;
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

const HISTORY_CAPABILITY = pluginManifest.createCapabilityToken('plugin:history', '1.0.0');
const historyPluginRef = pluginManifest.definePluginRef('plugin:history', '1.0.0');
function historyPlugin(options = {}) {
    let controller = null;
    return pluginDefinition.definePlugin({
        ref: historyPluginRef,
        manifest: {
            id: historyPluginRef.id,
            version: '1.0.0',
            apiVersion: historyPluginRef.apiVersion,
            engine: '^3.0.0',
            requires: [
                { token: coreCapabilities.CORE_DIAGNOSTICS_CAPABILITY, range: '^1.0.0' },
                { token: coreCapabilities.MEMENTO_HISTORY_CAPABILITY, range: '^1.0.0' },
            ],
        },
        setupMode: 'sync',
        setup(context) {
            const diagnostics = context.capabilities.require(coreCapabilities.CORE_DIAGNOSTICS_CAPABILITY);
            const state = context.capabilities.require(coreCapabilities.MEMENTO_HISTORY_CAPABILITY);
            context.operations.register({
                id: 'history:undo',
                mode: 'mutation',
                conflictDomains: [
                    'document',
                    'base-image',
                    'geometry',
                    'raster',
                    'overlay',
                    'state',
                ],
                reentrancy: 'queue',
            });
            context.operations.register({
                id: 'history:redo',
                mode: 'mutation',
                conflictDomains: [
                    'document',
                    'base-image',
                    'geometry',
                    'raster',
                    'overlay',
                    'state',
                ],
                reentrancy: 'queue',
            });
            for (const operationId of ['history:enable', 'history:disable']) {
                context.operations.register({
                    id: operationId,
                    mode: 'mutation',
                    conflictDomains: [
                        'document',
                        'base-image',
                        'geometry',
                        'raster',
                        'overlay',
                        'state',
                    ],
                    reentrancy: 'queue',
                });
            }
            controller = new HistoryPluginController(state, {
                run: (operationId, body) => context.operations.run(operationId, null, () => body()),
            }, options, (error, message) => diagnostics.reportWarning(error, message));
            context.disposables.add(state.registerHistoryProvider(historyPluginRef.id, {
                isAvailable: () => { var _a; return (_a = controller === null || controller === void 0 ? void 0 : controller.isEnabled) !== null && _a !== void 0 ? _a : false; },
                commit: (record) => controller === null || controller === void 0 ? void 0 : controller.commit(record),
            }));
            context.capabilities.provide(HISTORY_CAPABILITY, controller, {
                version: HISTORY_CAPABILITY.version,
            });
            return controller;
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
