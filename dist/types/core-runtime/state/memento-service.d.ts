import type { Disposable } from '../../plugin-kernel/disposable.js';
import type { CoreMemento, CoreStateAdapter } from './state-types.js';
import type { StateSliceRegistry } from './state-slice-registry.js';
export interface MementoRestoreOptions {
    readonly signal?: AbortSignal;
    readonly rollbackOnFailure?: boolean;
}
export declare class MementoService implements Disposable {
    private readonly coreAdapter;
    private readonly slices;
    private readonly trustedMementos;
    private revision;
    private restoring;
    private disposed;
    constructor(coreAdapter: CoreStateAdapter, slices: StateSliceRegistry);
    capture(): CoreMemento;
    isTrusted(value: unknown): value is CoreMemento;
    restore(memento: CoreMemento, options?: MementoRestoreOptions): Promise<void>;
    dispose(): void;
    private captureInternal;
    private restoreInternal;
    private assertActive;
}
