import { createDisposable, observePromise, } from './disposable.js';
import { InvalidPluginDefinitionError, PluginKernelDisposedError } from './errors.js';
import { reportWarningSafely } from './reporting.js';
import { isRuntimeIdentifier } from './plugin-identifier.js';
export const DEFAULT_COMMITTED_EVENT_LISTENER_TIMEOUT_MS = 5000;
export class CommittedEventBus {
    constructor(options = {}) {
        var _a;
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
        Object.defineProperty(this, "emissionTails", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "listenerTimeoutMs", {
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
        const timeout = (_a = options.listenerTimeoutMs) !== null && _a !== void 0 ? _a : DEFAULT_COMMITTED_EVENT_LISTENER_TIMEOUT_MS;
        if (!Number.isSafeInteger(timeout) || timeout <= 0) {
            throw new InvalidPluginDefinitionError('Committed event listener timeout must be a positive safe integer.');
        }
        this.listenerTimeoutMs = timeout;
    }
    on(eventName, listener) {
        this.assertActive('register a committed event listener');
        this.assertEventName(eventName);
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
        var _a;
        this.assertActive('emit a committed event');
        this.assertEventName(eventName);
        const previous = (_a = this.emissionTails.get(eventName)) !== null && _a !== void 0 ? _a : Promise.resolve();
        const emission = previous.then(() => this.dispatch(eventName, payload));
        this.emissionTails.set(eventName, emission);
        try {
            await emission;
        }
        finally {
            if (this.emissionTails.get(eventName) === emission) {
                this.emissionTails.delete(eventName);
            }
        }
    }
    async dispatch(eventName, payload) {
        var _a;
        const snapshot = [...((_a = this.listeners.get(eventName)) !== null && _a !== void 0 ? _a : [])];
        for (let index = 0; index < snapshot.length; index += 1) {
            const listener = snapshot[index];
            if (listener)
                await this.invokeListener(eventName, index, listener, payload);
        }
    }
    async invokeListener(eventName, listenerIndex, listener, payload) {
        const settlement = Promise.resolve()
            .then(() => listener(payload))
            .then(() => Object.freeze({ status: 'fulfilled' }), (error) => Object.freeze({ status: 'rejected', error }));
        let timeoutHandle;
        const timeout = new Promise((resolve) => {
            timeoutHandle = setTimeout(resolve, this.listenerTimeoutMs, null);
        });
        const outcome = await Promise.race([settlement, timeout]);
        if (timeoutHandle !== undefined)
            clearTimeout(timeoutHandle);
        if (outcome === null) {
            reportWarningSafely(this.options.warningSink, this.options.errorSink, {
                code: 'COMMITTED_EVENT_LISTENER_TIMEOUT',
                message: `Committed event listener ${listenerIndex} for "${eventName}" exceeded ${this.listenerTimeoutMs} ms; remaining listeners continued.`,
                details: {
                    eventName,
                    listenerIndex,
                    timeoutMs: this.listenerTimeoutMs,
                },
            });
            observePromise(settlement.then((lateOutcome) => {
                if (lateOutcome.status !== 'rejected')
                    return;
                reportWarningSafely(this.options.warningSink, this.options.errorSink, {
                    code: 'COMMITTED_EVENT_LISTENER_LATE_FAILURE',
                    message: `Timed-out committed event listener ${listenerIndex} for "${eventName}" later rejected.`,
                    cause: lateOutcome.error,
                    details: {
                        eventName,
                        listenerIndex,
                        timeoutMs: this.listenerTimeoutMs,
                    },
                });
            }), (error) => {
                reportWarningSafely(this.options.warningSink, this.options.errorSink, {
                    code: 'COMMITTED_EVENT_LATE_OBSERVER_FAILURE',
                    message: `Late listener observation for "${eventName}" failed.`,
                    cause: error,
                });
            });
            return;
        }
        if (outcome.status === 'rejected') {
            reportWarningSafely(this.options.warningSink, this.options.errorSink, {
                code: 'COMMITTED_EVENT_LISTENER_FAILED',
                message: `Committed event listener ${listenerIndex} for "${eventName}" failed; remaining listeners continued.`,
                cause: outcome.error,
                details: { eventName, listenerIndex },
            });
        }
    }
    listenerCount(eventName) {
        var _a, _b;
        this.assertActive('inspect committed event listeners');
        if (eventName) {
            this.assertEventName(eventName);
            return (_b = (_a = this.listeners.get(eventName)) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0;
        }
        let count = 0;
        for (const listeners of this.listeners.values())
            count += listeners.length;
        return count;
    }
    dispose() {
        if (this.disposed)
            return;
        this.listeners.clear();
        this.emissionTails.clear();
        this.disposed = true;
    }
    assertActive(operation) {
        if (this.disposed)
            throw new PluginKernelDisposedError(operation);
    }
    assertEventName(eventName) {
        if (!isRuntimeIdentifier(eventName)) {
            throw new InvalidPluginDefinitionError('Invalid committed event Runtime ID.');
        }
    }
}
//# sourceMappingURL=committed-event-bus.js.map