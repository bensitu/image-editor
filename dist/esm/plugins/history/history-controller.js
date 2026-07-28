import { CoreRuntimeError } from '../../core/index.js';
import { estimateRetainedBytes } from './retained-size-estimator.js';
const DEFAULT_MAX_HISTORY_BYTES = 128 * 1024 * 1024;
function resolveMaxSize(value) {
    return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : 50;
}
function resolveMaxBytes(value) {
    if (value === undefined)
        return DEFAULT_MAX_HISTORY_BYTES;
    if (!Number.isSafeInteger(value) || value <= 0) {
        throw new CoreRuntimeError('[ImageEditor] History maxBytes must be a positive safe integer.', {
            code: 'HISTORY_MAX_BYTES_INVALID',
        });
    }
    return value;
}
export class HistoryPluginController {
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
        Object.defineProperty(this, "retainedBytes", {
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
        this.maxBytes = resolveMaxBytes(options.maxBytes);
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
            throw new CoreRuntimeError('[ImageEditor] History record operationId is invalid.');
        }
        const retainedRecord = Object.freeze({
            operationId: record.operationId,
            before: record.before,
            after: record.after,
            timestamp: record.timestamp,
            detail: record.detail,
        });
        const bytes = estimateRetainedBytes(retainedRecord);
        if (bytes > this.maxBytes) {
            const changed = this.resetTimeline();
            this.baseline = record.after;
            const warning = new CoreRuntimeError(`[ImageEditor] History record "${record.operationId}" exceeds maxBytes and was not retained.`, {
                code: 'HISTORY_RECORD_BYTE_LIMIT_EXCEEDED',
            });
            this.reportWarning(warning, `History record "${record.operationId}" requires ${bytes} bytes, exceeding the ${this.maxBytes}-byte limit.`);
            if (changed)
                this.emitChange();
            return;
        }
        (_a = this.baseline) !== null && _a !== void 0 ? _a : (this.baseline = record.before);
        this.removeEntries(this.position, this.records.length - this.position);
        this.records.push(Object.freeze({ record: retainedRecord, bytes }));
        this.retainedBytes += bytes;
        this.evictOverflow();
        this.position = this.records.length;
        this.emitChange();
    }
    enable(options) {
        this.assertActive('enable History');
        if ((options === null || options === void 0 ? void 0 : options.baseline) !== 'current') {
            throw new CoreRuntimeError('[ImageEditor] History can enable only from the current baseline.', {
                code: 'HISTORY_BASELINE_UNSUPPORTED',
            });
        }
        return this.operations.run('history:enable', async () => {
            if (this.enabled)
                return;
            const baseline = this.state.captureMemento();
            this.records = [];
            this.position = 0;
            this.retainedBytes = 0;
            this.baseline = baseline;
            this.enabled = true;
            this.emitChange();
        });
    }
    disable(options = {}) {
        var _a;
        this.assertActive('disable History');
        if (options.clear !== undefined && typeof options.clear !== 'boolean') {
            throw new CoreRuntimeError('[ImageEditor] History disable clear must be a boolean.', {
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
            const entry = this.records[this.position - 1];
            if (!entry)
                return;
            await this.restoreTransactionally(entry.record.before, 'undo');
            this.position -= 1;
            this.emitChange();
        });
    }
    redo() {
        this.assertActive('redo');
        if (!this.canRedo())
            return Promise.resolve();
        return this.operations.run('history:redo', async () => {
            const entry = this.records[this.position];
            if (!entry)
                return;
            await this.restoreTransactionally(entry.record.after, 'redo');
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
            bytes: this.retainedBytes,
            maxBytes: this.maxBytes,
        });
    }
    dispose() {
        if (this.disposed)
            return;
        this.records = [];
        this.position = 0;
        this.retainedBytes = 0;
        this.baseline = null;
        this.enabled = false;
        this.listeners.clear();
        this.disposed = true;
    }
    resetTimeline() {
        const changed = this.records.length > 0 || this.position !== 0 || this.retainedBytes !== 0;
        this.records = [];
        this.position = 0;
        this.retainedBytes = 0;
        this.baseline = null;
        return changed;
    }
    removeEntries(start, deleteCount) {
        if (deleteCount <= 0)
            return;
        const removed = this.records.splice(start, deleteCount);
        for (const entry of removed) {
            this.retainedBytes -= entry.bytes;
        }
    }
    evictOverflow() {
        while (this.records.length > this.maxSize || this.retainedBytes > this.maxBytes) {
            this.removeEntries(0, 1);
        }
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
                const failure = new CoreRuntimeError(`[ImageEditor] History ${operation} failed and rollback could not restore state.`, {
                    code: 'HISTORY_UNRECOVERABLE_ERROR',
                    cause: Object.freeze([error, rollbackError]),
                    behavior: 'fatal-rollback',
                });
                this.state.reportFatal(failure);
                throw failure;
            }
            throw new CoreRuntimeError(`[ImageEditor] History ${operation} failed.`, {
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
            throw new CoreRuntimeError(`[ImageEditor] Cannot ${operation} after History disposal.`);
        }
    }
}
//# sourceMappingURL=history-controller.js.map