import {
    createDisposable,
    disposeInReverse,
    disposeInReverseSync,
    type CommitAwareDisposable,
    type Disposable,
} from './disposable.js';
import { PluginAggregateError, PluginKernelStateError } from './errors.js';
import type { PluginErrorSink, PluginWarningSink } from './reporting.js';

interface RegistrationEntry {
    readonly disposable: Disposable;
    readonly rollbackOnly: boolean;
}

export interface RegistrationScopeOptions {
    readonly warningSink?: PluginWarningSink;
    readonly errorSink?: PluginErrorSink;
}

export class RegistrationScope implements Disposable {
    public readonly transactionId: symbol;
    private readonly entries: RegistrationEntry[] = [];
    private readonly finalizers: Disposable[] = [];
    private state: 'open' | 'committed' | 'disposed' = 'open';

    constructor(
        public readonly pluginId: string,
        private readonly options: RegistrationScopeOptions = {},
    ) {
        this.transactionId = Symbol(`plugin-install:${pluginId}`);
    }

    get active(): boolean {
        return this.state !== 'disposed';
    }

    assertOpen(operation = 'register installation resources'): void {
        if (this.state !== 'open') {
            throw new PluginKernelStateError(operation, `registration-scope:${this.state}`);
        }
    }

    add<TDisposable extends Disposable>(disposable: TDisposable): TDisposable {
        this.assertOpen();
        this.entries.push({ disposable, rollbackOnly: false });
        return disposable;
    }

    addRollback(disposable: Disposable): Disposable {
        this.assertOpen();
        this.entries.push({ disposable, rollbackOnly: true });
        return disposable;
    }

    addFinalizer(disposable: Disposable): Disposable {
        this.assertOpen();
        this.finalizers.push(disposable);
        return disposable;
    }

    addCleanup(cleanup: () => void | Promise<void>): Disposable {
        return this.add(createDisposable(cleanup));
    }

    commit(): void {
        this.assertOpen('commit plugin installation');
        for (const entry of this.entries) {
            if (!entry.rollbackOnly && 'commit' in entry.disposable) {
                (entry.disposable as CommitAwareDisposable).commit();
            }
        }
        for (let index = this.entries.length - 1; index >= 0; index -= 1) {
            if (this.entries[index]?.rollbackOnly) this.entries.splice(index, 1);
        }
        this.state = 'committed';
    }

    async rollback(): Promise<readonly unknown[]> {
        if (this.state === 'disposed') return [];
        const errors = [
            ...(await disposeInReverse(
                this.entries.map((entry) => entry.disposable),
                { pluginId: this.pluginId, ...this.options },
            )),
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

    rollbackSync(): readonly unknown[] {
        if (this.state === 'disposed') return Object.freeze([]);
        const errors = [
            ...disposeInReverseSync(
                this.entries.map((entry) => entry.disposable),
                { pluginId: this.pluginId, ...this.options },
            ),
            ...disposeInReverseSync(this.finalizers, {
                pluginId: this.pluginId,
                ...this.options,
            }),
        ];
        this.entries.length = 0;
        this.finalizers.length = 0;
        this.state = 'disposed';
        return Object.freeze(errors);
    }

    async dispose(): Promise<void> {
        if (this.state === 'disposed') return;
        const errors = [
            ...(await disposeInReverse(
                this.entries.map((entry) => entry.disposable),
                { pluginId: this.pluginId, ...this.options },
            )),
            ...(await disposeInReverse(this.finalizers, {
                pluginId: this.pluginId,
                ...this.options,
            })),
        ];
        this.entries.length = 0;
        this.finalizers.length = 0;
        this.state = 'disposed';
        if (errors.length > 0) {
            throw new PluginAggregateError(
                `[ImageEditor] Plugin "${this.pluginId}" cleanup failed.`,
                errors,
                { pluginId: this.pluginId },
            );
        }
    }

    disposeSync(): void {
        if (this.state === 'disposed') return;
        const errors = this.rollbackSync();
        if (errors.length > 0) {
            throw new PluginAggregateError(
                `[ImageEditor] Plugin "${this.pluginId}" synchronous cleanup failed.`,
                errors,
                { pluginId: this.pluginId },
            );
        }
    }
}
