/**
 * Publishes committed runtime events while isolating listener failures.
 *
 * @module
 */
import { type Disposable, type MaybePromise } from './disposable.js';
import { type PluginErrorSink, type PluginWarningSink } from './reporting.js';
export type PluginEventMap = Record<string, unknown>;
export type CommittedEventListener<TPayload> = (payload: TPayload) => MaybePromise<void>;
export interface CommittedEventBusOptions {
    readonly warningSink?: PluginWarningSink;
    readonly errorSink?: PluginErrorSink;
}
export declare class CommittedEventBus<TEvents extends object = PluginEventMap> implements Disposable {
    private readonly options;
    private readonly listeners;
    private readonly emissionTails;
    private disposed;
    constructor(options?: CommittedEventBusOptions);
    on<TKey extends keyof TEvents & string>(eventName: TKey, listener: CommittedEventListener<TEvents[TKey]>): Disposable;
    emitCommitted<TKey extends keyof TEvents & string>(eventName: TKey, payload: TEvents[TKey]): Promise<void>;
    private dispatch;
    listenerCount(eventName?: keyof TEvents & string): number;
    dispose(): void;
    private assertActive;
    private assertEventName;
}
