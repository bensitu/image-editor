/**
 * Publishes committed runtime events while isolating listener failures.
 *
 * @module
 */

import {
    createDisposable,
    observePromise,
    type Disposable,
    type MaybePromise,
} from './disposable.js';
import { InvalidPluginDefinitionError, PluginKernelDisposedError } from './errors.js';
import { reportWarningSafely, type PluginErrorSink, type PluginWarningSink } from './reporting.js';
import { isRuntimeIdentifier } from './plugin-identifier.js';

export type PluginEventMap = Record<string, unknown>;
export type CommittedEventListener<TPayload> = (payload: TPayload) => MaybePromise<void>;

export interface CommittedEventBusOptions {
    readonly warningSink?: PluginWarningSink;
    readonly errorSink?: PluginErrorSink;
    readonly listenerTimeoutMs?: number;
}

export const DEFAULT_COMMITTED_EVENT_LISTENER_TIMEOUT_MS = 5_000;

type ListenerOutcome =
    Readonly<{ status: 'fulfilled' }> | Readonly<{ status: 'rejected'; error: unknown }>;

const DISPOSED_LISTENER_OUTCOME = Symbol('disposed-listener-outcome');

interface EventBusDisposalState {
    readonly controller: AbortController;
    readonly activeTimeouts: Set<ReturnType<typeof setTimeout>>;
}

const eventBusDisposalStates = new WeakMap<object, EventBusDisposalState>();

function getDisposalState(owner: object): EventBusDisposalState {
    const state = eventBusDisposalStates.get(owner);
    if (!state) {
        throw new Error('Committed event bus disposal state is unavailable.');
    }
    return state;
}

export class CommittedEventBus<TEvents extends object = PluginEventMap> implements Disposable {
    private readonly listeners = new Map<string, CommittedEventListener<never>[]>();
    private readonly emissionTails = new Map<string, Promise<void>>();
    private readonly listenerTimeoutMs: number;
    private disposed = false;

    constructor(private readonly options: CommittedEventBusOptions = {}) {
        const timeout = options.listenerTimeoutMs ?? DEFAULT_COMMITTED_EVENT_LISTENER_TIMEOUT_MS;
        if (!Number.isSafeInteger(timeout) || timeout <= 0) {
            throw new InvalidPluginDefinitionError(
                'Committed event listener timeout must be a positive safe integer.',
            );
        }
        this.listenerTimeoutMs = timeout;
        eventBusDisposalStates.set(this, {
            controller: new AbortController(),
            activeTimeouts: new Set(),
        });
    }

    on<TKey extends keyof TEvents & string>(
        eventName: TKey,
        listener: CommittedEventListener<TEvents[TKey]>,
    ): Disposable {
        this.assertActive('register a committed event listener');
        this.assertEventName(eventName);
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
        this.assertEventName(eventName);
        const previous = this.emissionTails.get(eventName) ?? Promise.resolve();
        const emission = previous.then(() => this.dispatch(eventName, payload));
        this.emissionTails.set(eventName, emission);
        try {
            await emission;
        } finally {
            if (this.emissionTails.get(eventName) === emission) {
                this.emissionTails.delete(eventName);
            }
        }
    }

    private async dispatch<TKey extends keyof TEvents & string>(
        eventName: TKey,
        payload: TEvents[TKey],
    ): Promise<void> {
        if (this.disposed) return;
        const snapshot = [...(this.listeners.get(eventName) ?? [])];
        for (let index = 0; index < snapshot.length; index += 1) {
            if (this.disposed) return;
            const listener = snapshot[index];
            if (listener) await this.invokeListener(eventName, index, listener, payload);
        }
    }

    private async invokeListener<TKey extends keyof TEvents & string>(
        eventName: TKey,
        listenerIndex: number,
        listener: CommittedEventListener<never>,
        payload: TEvents[TKey],
    ): Promise<void> {
        const disposalState = getDisposalState(this);
        const settlement = Promise.resolve()
            .then(() => listener(payload as never))
            .then<ListenerOutcome, ListenerOutcome>(
                () => Object.freeze({ status: 'fulfilled' }),
                (error: unknown) => Object.freeze({ status: 'rejected', error }),
            );
        let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
        const timeout = new Promise<null>((resolve) => {
            timeoutHandle = setTimeout(() => {
                if (timeoutHandle !== undefined) {
                    disposalState.activeTimeouts.delete(timeoutHandle);
                }
                resolve(null);
            }, this.listenerTimeoutMs);
            disposalState.activeTimeouts.add(timeoutHandle);
        });
        const disposalSignal = disposalState.controller.signal;
        let removeDisposalListener = (): void => undefined;
        const disposal = new Promise<typeof DISPOSED_LISTENER_OUTCOME>((resolve) => {
            const abort = (): void => {
                if (timeoutHandle !== undefined) {
                    clearTimeout(timeoutHandle);
                    disposalState.activeTimeouts.delete(timeoutHandle);
                }
                resolve(DISPOSED_LISTENER_OUTCOME);
            };
            removeDisposalListener = () => disposalSignal.removeEventListener('abort', abort);
            disposalSignal.addEventListener('abort', abort, { once: true });
            if (disposalSignal.aborted) abort();
        });
        let outcome: ListenerOutcome | null | typeof DISPOSED_LISTENER_OUTCOME;
        try {
            outcome = await Promise.race([settlement, timeout, disposal]);
        } finally {
            removeDisposalListener();
            if (timeoutHandle !== undefined) {
                clearTimeout(timeoutHandle);
                disposalState.activeTimeouts.delete(timeoutHandle);
            }
        }
        if (outcome === DISPOSED_LISTENER_OUTCOME) return;
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
            observePromise(
                settlement.then((lateOutcome) => {
                    if (this.disposed || lateOutcome.status !== 'rejected') return;
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
                }),
                (error) => {
                    if (this.disposed) return;
                    reportWarningSafely(this.options.warningSink, this.options.errorSink, {
                        code: 'COMMITTED_EVENT_LATE_OBSERVER_FAILURE',
                        message: `Late listener observation for "${eventName}" failed.`,
                        cause: error,
                    });
                },
            );
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

    listenerCount(eventName?: keyof TEvents & string): number {
        this.assertActive('inspect committed event listeners');
        if (eventName) {
            this.assertEventName(eventName);
            return this.listeners.get(eventName)?.length ?? 0;
        }
        let count = 0;
        for (const listeners of this.listeners.values()) count += listeners.length;
        return count;
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.listeners.clear();
        this.emissionTails.clear();
        const disposalState = getDisposalState(this);
        for (const timeout of disposalState.activeTimeouts) clearTimeout(timeout);
        disposalState.activeTimeouts.clear();
        disposalState.controller.abort();
    }

    private assertActive(operation: string): void {
        if (this.disposed) throw new PluginKernelDisposedError(operation);
    }

    private assertEventName(eventName: string): void {
        if (!isRuntimeIdentifier(eventName)) {
            throw new InvalidPluginDefinitionError('Invalid committed event Runtime ID.');
        }
    }
}
