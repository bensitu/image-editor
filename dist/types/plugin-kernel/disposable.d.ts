import { type PluginErrorSink, type PluginWarningSink } from './reporting.js';
export type MaybePromise<T> = T | Promise<T>;
export interface Disposable {
    dispose(): MaybePromise<void>;
}
export interface CommitAwareDisposable extends Disposable {
    commit(): void;
}
export declare function createDisposable(cleanup: () => MaybePromise<void>): Disposable;
export declare function createNoopDisposable(): Disposable;
export interface DisposeInReverseOptions {
    readonly pluginId?: string;
    readonly warningSink?: PluginWarningSink;
    readonly errorSink?: PluginErrorSink;
}
export declare function disposeInReverse(disposables: readonly Disposable[], options?: DisposeInReverseOptions): Promise<readonly unknown[]>;
export declare function createCompositeDisposable(disposables: readonly Disposable[], options?: DisposeInReverseOptions): Disposable;
