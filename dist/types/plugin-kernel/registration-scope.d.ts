import { type Disposable } from './disposable.js';
import type { PluginErrorSink, PluginWarningSink } from './reporting.js';
export interface RegistrationScopeOptions {
    readonly warningSink?: PluginWarningSink;
    readonly errorSink?: PluginErrorSink;
}
export declare class RegistrationScope implements Disposable {
    readonly pluginId: string;
    private readonly options;
    readonly transactionId: symbol;
    private readonly entries;
    private readonly finalizers;
    private state;
    constructor(pluginId: string, options?: RegistrationScopeOptions);
    get active(): boolean;
    assertOpen(operation?: string): void;
    add<TDisposable extends Disposable>(disposable: TDisposable): TDisposable;
    addRollback(disposable: Disposable): Disposable;
    addFinalizer(disposable: Disposable): Disposable;
    addCleanup(cleanup: () => void | Promise<void>): Disposable;
    commit(): void;
    rollback(): Promise<readonly unknown[]>;
    dispose(): Promise<void>;
}
