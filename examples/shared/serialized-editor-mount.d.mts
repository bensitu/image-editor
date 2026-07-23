/**
 * Declares the serialized editor ownership helper used by framework examples.
 *
 * @module
 */

export interface SerializedEditorMountOptions<TOwner> {
    create(): TOwner;
    initialize(owner: TOwner): Promise<void>;
    publish(owner: TOwner): void;
    clear(): void;
    dispose(owner: TOwner): Promise<void>;
    onInitializationError(error: unknown): void;
    onDisposalError(error: unknown): void;
}

export interface SerializedEditorMountLease {
    readonly ready: Promise<void>;
    readonly closed: Promise<void>;
    release(): void;
}

export interface SerializedEditorMountCoordinator {
    mount<TOwner>(options: SerializedEditorMountOptions<TOwner>): SerializedEditorMountLease;
}

export declare function createSerializedEditorMountCoordinator(): SerializedEditorMountCoordinator;
