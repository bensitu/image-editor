import type { Disposable } from '../../plugin-kernel/disposable.js';
import type { DocumentMutationContext, DocumentMutationCoordinatorOptions, DocumentMutationPort, DocumentMutationRequest } from './mutation-types.js';
export declare class DocumentMutationCoordinator implements DocumentMutationPort, Disposable {
    private readonly options;
    private readonly usedTransactionIds;
    private readonly contextRecords;
    private readonly activeControllers;
    private readonly activePromises;
    private disposed;
    constructor(options: DocumentMutationCoordinatorOptions);
    get isRunning(): boolean;
    assertContextActive(context: DocumentMutationContext): void;
    run<TResult>(request: DocumentMutationRequest<TResult>): Promise<TResult>;
    dispose(): Promise<void>;
    abortActive(reason: unknown): Promise<void>;
    reset(): void;
    disposeSync(): void;
    private performTopLevel;
    private performNested;
    private executeRequest;
    private createContext;
    private createRollbackContext;
    private restoreAfterFailure;
    private normalizeRequest;
    private requireParent;
    private throwIfUnavailable;
    private warn;
    private assertActive;
}
