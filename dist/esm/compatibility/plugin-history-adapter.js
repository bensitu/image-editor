export class DeferredHistoryPort {
    constructor(maxSize) {
        Object.defineProperty(this, "maxSize", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: maxSize
        });
        Object.defineProperty(this, "delegate", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
    }
    get history() {
        var _a;
        const candidate = this.delegate;
        return Object.freeze(new Array((_a = candidate === null || candidate === void 0 ? void 0 : candidate.retainedCount) !== null && _a !== void 0 ? _a : 0).fill(undefined));
    }
    attach(delegate) {
        if (this.delegate)
            throw new Error('[ImageEditor] History plugin is already attached.');
        this.delegate = delegate;
    }
    detach(delegate) {
        if (this.delegate === delegate)
            this.delegate = null;
    }
    execute(command) {
        var _a, _b;
        return (_b = (_a = this.delegate) === null || _a === void 0 ? void 0 : _a.execute(command)) !== null && _b !== void 0 ? _b : Promise.resolve();
    }
    push(command) {
        var _a;
        (_a = this.delegate) === null || _a === void 0 ? void 0 : _a.push(command);
    }
    clear() {
        var _a;
        (_a = this.delegate) === null || _a === void 0 ? void 0 : _a.clear();
    }
    canUndo() {
        var _a, _b;
        return (_b = (_a = this.delegate) === null || _a === void 0 ? void 0 : _a.canUndo()) !== null && _b !== void 0 ? _b : false;
    }
    canRedo() {
        var _a, _b;
        return (_b = (_a = this.delegate) === null || _a === void 0 ? void 0 : _a.canRedo()) !== null && _b !== void 0 ? _b : false;
    }
    undo() {
        var _a, _b;
        return (_b = (_a = this.delegate) === null || _a === void 0 ? void 0 : _a.undo()) !== null && _b !== void 0 ? _b : Promise.resolve();
    }
    redo() {
        var _a, _b;
        return (_b = (_a = this.delegate) === null || _a === void 0 ? void 0 : _a.redo()) !== null && _b !== void 0 ? _b : Promise.resolve();
    }
}
export class PluginHistoryAdapter {
    constructor(core, history, maxSize, onChange) {
        Object.defineProperty(this, "core", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: core
        });
        Object.defineProperty(this, "history", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: history
        });
        Object.defineProperty(this, "maxSize", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: maxSize
        });
        Object.defineProperty(this, "baseline", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "unsubscribe", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "disposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        this.unsubscribe = history.onChange((state) => {
            this.refreshBaseline();
            onChange(state);
        });
    }
    get retainedCount() {
        return this.history.getState().size;
    }
    async execute(command) {
        this.assertActive();
        await command.execute();
        this.push(command);
    }
    push(command) {
        var _a;
        this.assertActive();
        void command;
        const after = this.core.captureCompatibilityMemento();
        const before = (_a = this.baseline) !== null && _a !== void 0 ? _a : after;
        this.history.push(Object.freeze({
            operationId: 'compatibility:state-change',
            before,
            after,
            timestamp: Date.now(),
            detail: Object.freeze({ source: 'full-facade' }),
        }));
        this.baseline = after;
    }
    clear() {
        if (this.disposed)
            return;
        this.history.clear();
        this.refreshBaseline();
    }
    canUndo() {
        return !this.disposed && this.history.canUndo();
    }
    canRedo() {
        return !this.disposed && this.history.canRedo();
    }
    async undo() {
        if (this.disposed)
            return;
        await this.history.undo();
        this.refreshBaseline();
    }
    async redo() {
        if (this.disposed)
            return;
        await this.history.redo();
        this.refreshBaseline();
    }
    resetBaseline() {
        if (this.disposed)
            return;
        this.refreshBaseline();
    }
    dispose() {
        if (this.disposed)
            return;
        this.unsubscribe();
        this.baseline = null;
        this.disposed = true;
    }
    refreshBaseline() {
        try {
            this.baseline = this.core.captureCompatibilityMemento();
        }
        catch {
            this.baseline = null;
        }
    }
    assertActive() {
        if (this.disposed)
            throw new Error('[ImageEditor] History adapter is disposed.');
    }
}
//# sourceMappingURL=plugin-history-adapter.js.map