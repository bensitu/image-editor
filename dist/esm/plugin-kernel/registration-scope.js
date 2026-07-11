import { createDisposable, disposeInReverse, } from './disposable.js';
import { PluginAggregateError, PluginKernelStateError } from './errors.js';
export class RegistrationScope {
    constructor(pluginId, options = {}) {
        Object.defineProperty(this, "pluginId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: pluginId
        });
        Object.defineProperty(this, "options", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: options
        });
        Object.defineProperty(this, "transactionId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "entries", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "finalizers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "state", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'open'
        });
        this.transactionId = Symbol(`plugin-install:${pluginId}`);
    }
    get active() {
        return this.state !== 'disposed';
    }
    assertOpen(operation = 'register installation resources') {
        if (this.state !== 'open') {
            throw new PluginKernelStateError(operation, `registration-scope:${this.state}`);
        }
    }
    add(disposable) {
        this.assertOpen();
        this.entries.push({ disposable, rollbackOnly: false });
        return disposable;
    }
    addRollback(disposable) {
        this.assertOpen();
        this.entries.push({ disposable, rollbackOnly: true });
        return disposable;
    }
    addFinalizer(disposable) {
        this.assertOpen();
        this.finalizers.push(disposable);
        return disposable;
    }
    addCleanup(cleanup) {
        return this.add(createDisposable(cleanup));
    }
    commit() {
        var _a;
        this.assertOpen('commit plugin installation');
        for (const entry of this.entries) {
            if (!entry.rollbackOnly && 'commit' in entry.disposable) {
                entry.disposable.commit();
            }
        }
        for (let index = this.entries.length - 1; index >= 0; index -= 1) {
            if ((_a = this.entries[index]) === null || _a === void 0 ? void 0 : _a.rollbackOnly)
                this.entries.splice(index, 1);
        }
        this.state = 'committed';
    }
    async rollback() {
        if (this.state === 'disposed')
            return [];
        const errors = [
            ...(await disposeInReverse(this.entries.map((entry) => entry.disposable), { pluginId: this.pluginId, ...this.options })),
            ...(await disposeInReverse(this.finalizers, {
                pluginId: this.pluginId,
                ...this.options,
            })),
        ];
        this.entries.length = 0;
        this.finalizers.length = 0;
        this.state = 'disposed';
        return errors;
    }
    async dispose() {
        if (this.state === 'disposed')
            return;
        const errors = [
            ...(await disposeInReverse(this.entries.map((entry) => entry.disposable), { pluginId: this.pluginId, ...this.options })),
            ...(await disposeInReverse(this.finalizers, {
                pluginId: this.pluginId,
                ...this.options,
            })),
        ];
        this.entries.length = 0;
        this.finalizers.length = 0;
        this.state = 'disposed';
        if (errors.length > 0) {
            throw new PluginAggregateError(`[ImageEditor] Plugin "${this.pluginId}" cleanup failed.`, errors, { pluginId: this.pluginId });
        }
    }
}
//# sourceMappingURL=registration-scope.js.map