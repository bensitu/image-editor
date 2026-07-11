import { createDisposable, type Disposable, type MaybePromise } from './disposable.js';
import { PluginKernelDisposedError } from './errors.js';
import { reportWarningSafely, type PluginErrorSink, type PluginWarningSink } from './reporting.js';

export type PluginEventMap = Record<string, unknown>;
export type CommittedEventListener<TPayload> = (payload: TPayload) => MaybePromise<void>;

export interface CommittedEventBusOptions {
    readonly warningSink?: PluginWarningSink;
    readonly errorSink?: PluginErrorSink;
}

export class CommittedEventBus<TEvents extends object = PluginEventMap> implements Disposable {
    private readonly listeners = new Map<string, CommittedEventListener<never>[]>();
    private disposed = false;

    constructor(private readonly options: CommittedEventBusOptions = {}) {}

    on<TKey extends keyof TEvents & string>(
        eventName: TKey,
        listener: CommittedEventListener<TEvents[TKey]>,
    ): Disposable {
        this.assertActive('register a committed event listener');
        let eventListeners = this.listeners.get(eventName);
        if (!eventListeners) {
            eventListeners = [];
            this.listeners.set(eventName, eventListeners);
        }
        const erasedListener: CommittedEventListener<never> = listener;
        eventListeners.push(erasedListener);
        return createDisposable(() => {
            const current = this.listeners.get(eventName);
            if (!current) return;
            const index = current.indexOf(erasedListener);
            if (index >= 0) current.splice(index, 1);
            if (current.length === 0) this.listeners.delete(eventName);
        });
    }

    async emitCommitted<TKey extends keyof TEvents & string>(
        eventName: TKey,
        payload: TEvents[TKey],
    ): Promise<void> {
        this.assertActive('emit a committed event');
        const snapshot = [...(this.listeners.get(eventName) ?? [])];
        for (let index = 0; index < snapshot.length; index += 1) {
            try {
                await snapshot[index]?.(payload as never);
            } catch (error) {
                reportWarningSafely(this.options.warningSink, this.options.errorSink, {
                    code: 'COMMITTED_EVENT_LISTENER_FAILED',
                    message: `Committed event listener ${index} for "${eventName}" failed; remaining listeners continued.`,
                    cause: error,
                    details: { eventName, listenerIndex: index },
                });
            }
        }
    }

    listenerCount(eventName?: keyof TEvents & string): number {
        this.assertActive('inspect committed event listeners');
        if (eventName) return this.listeners.get(eventName)?.length ?? 0;
        let count = 0;
        for (const listeners of this.listeners.values()) count += listeners.length;
        return count;
    }

    dispose(): void {
        if (this.disposed) return;
        this.listeners.clear();
        this.disposed = true;
    }

    private assertActive(operation: string): void {
        if (this.disposed) throw new PluginKernelDisposedError(operation);
    }
}
