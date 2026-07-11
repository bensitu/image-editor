import { PluginAggregateError } from './errors.js';
import { reportWarningSafely, type PluginErrorSink, type PluginWarningSink } from './reporting.js';

export type MaybePromise<T> = T | Promise<T>;

export interface Disposable {
    dispose(): MaybePromise<void>;
}

export interface CommitAwareDisposable extends Disposable {
    commit(): void;
}

function isPromiseLike(value: unknown): value is PromiseLike<void> {
    return (
        (typeof value === 'object' || typeof value === 'function') &&
        value !== null &&
        typeof (value as { then?: unknown }).then === 'function'
    );
}

export function createDisposable(cleanup: () => MaybePromise<void>): Disposable {
    let state: 'active' | 'disposing' | 'disposed' = 'active';
    let pending: Promise<void> | null = null;

    return {
        dispose(): MaybePromise<void> {
            if (state === 'disposed') return undefined;
            if (state === 'disposing') return pending ?? undefined;
            state = 'disposing';
            try {
                const result = cleanup();
                if (isPromiseLike(result)) {
                    pending = Promise.resolve(result).finally(() => {
                        state = 'disposed';
                    });
                    return pending;
                }
                state = 'disposed';
                return undefined;
            } catch (error) {
                state = 'disposed';
                throw error;
            }
        },
    };
}

export function createNoopDisposable(): Disposable {
    return createDisposable(() => undefined);
}

export interface DisposeInReverseOptions {
    readonly pluginId?: string;
    readonly warningSink?: PluginWarningSink;
    readonly errorSink?: PluginErrorSink;
}

export async function disposeInReverse(
    disposables: readonly Disposable[],
    options: DisposeInReverseOptions = {},
): Promise<readonly unknown[]> {
    const errors: unknown[] = [];
    for (let index = disposables.length - 1; index >= 0; index -= 1) {
        try {
            await disposables[index]?.dispose();
        } catch (error) {
            errors.push(error);
            reportWarningSafely(options.warningSink, options.errorSink, {
                code: 'PLUGIN_CLEANUP_FAILED',
                message: `Plugin cleanup item ${index} failed; remaining cleanup continued.`,
                pluginId: options.pluginId,
                cause: error,
                details: { cleanupIndex: index },
            });
        }
    }
    return errors;
}

export function createCompositeDisposable(
    disposables: readonly Disposable[],
    options: DisposeInReverseOptions = {},
): Disposable {
    return createDisposable(async () => {
        const errors = await disposeInReverse(disposables, options);
        if (errors.length > 0) {
            throw new PluginAggregateError('One or more composite cleanup items failed.', errors, {
                pluginId: options.pluginId,
            });
        }
    });
}
