/**
 * Provides idempotent disposable primitives and reverse-order cleanup with error aggregation.
 *
 * @module
 */
import { type PluginErrorSink, type PluginWarningSink } from './reporting.js';
export type MaybePromise<T> = T | Promise<T>;
export interface Disposable {
    dispose(): MaybePromise<void>;
}
export interface CommitAwareDisposable extends Disposable {
    commit(): void;
}
export declare function isPromiseLike(value: unknown): value is PromiseLike<void>;
/**
 * Detaches Promise-like work while routing every rejection to an explicit observer.
 */
export declare function observePromise<T>(promise: PromiseLike<T>, onRejected: (error: unknown) => void): void;
export declare function disposeInReverseSync(disposables: readonly Disposable[], options?: DisposeInReverseOptions): readonly unknown[];
export declare function createDisposable(cleanup: () => MaybePromise<void>): Disposable;
export declare function createNoopDisposable(): Disposable;
export interface DisposeInReverseOptions {
    readonly pluginId?: string;
    readonly warningSink?: PluginWarningSink;
    readonly errorSink?: PluginErrorSink;
}
export declare function disposeInReverse(disposables: readonly Disposable[], options?: DisposeInReverseOptions): Promise<readonly unknown[]>;
export declare function createCompositeDisposable(disposables: readonly Disposable[], options?: DisposeInReverseOptions): Disposable;
