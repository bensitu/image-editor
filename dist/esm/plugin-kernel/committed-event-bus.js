import { createDisposable } from './disposable.js';
import { PluginKernelDisposedError } from './errors.js';
import { reportWarningSafely } from './reporting.js';
export class CommittedEventBus {
    constructor(options = {}) {
        Object.defineProperty(this, "options", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: options
        });
        Object.defineProperty(this, "listeners", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "disposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
    }
    on(eventName, listener) {
        this.assertActive('register a committed event listener');
        let eventListeners = this.listeners.get(eventName);
        if (!eventListeners) {
            eventListeners = [];
            this.listeners.set(eventName, eventListeners);
        }
        const erasedListener = listener;
        eventListeners.push(erasedListener);
        return createDisposable(() => {
            const current = this.listeners.get(eventName);
            if (!current)
                return;
            const index = current.indexOf(erasedListener);
            if (index >= 0)
                current.splice(index, 1);
            if (current.length === 0)
                this.listeners.delete(eventName);
        });
    }
    async emitCommitted(eventName, payload) {
        var _a, _b;
        this.assertActive('emit a committed event');
        const snapshot = [...((_a = this.listeners.get(eventName)) !== null && _a !== void 0 ? _a : [])];
        for (let index = 0; index < snapshot.length; index += 1) {
            try {
                await ((_b = snapshot[index]) === null || _b === void 0 ? void 0 : _b.call(snapshot, payload));
            }
            catch (error) {
                reportWarningSafely(this.options.warningSink, this.options.errorSink, {
                    code: 'COMMITTED_EVENT_LISTENER_FAILED',
                    message: `Committed event listener ${index} for "${eventName}" failed; remaining listeners continued.`,
                    cause: error,
                    details: { eventName, listenerIndex: index },
                });
            }
        }
    }
    listenerCount(eventName) {
        var _a, _b;
        this.assertActive('inspect committed event listeners');
        if (eventName)
            return (_b = (_a = this.listeners.get(eventName)) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0;
        let count = 0;
        for (const listeners of this.listeners.values())
            count += listeners.length;
        return count;
    }
    dispose() {
        if (this.disposed)
            return;
        this.listeners.clear();
        this.disposed = true;
    }
    assertActive(operation) {
        if (this.disposed)
            throw new PluginKernelDisposedError(operation);
    }
}
//# sourceMappingURL=committed-event-bus.js.map