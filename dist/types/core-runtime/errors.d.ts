/** Errors raised by the renderer-neutral v3 core runtime. */
export declare class CoreRuntimeError extends Error {
    constructor(message: string, options?: {
        readonly code?: string;
        readonly cause?: unknown;
    });
    readonly code: string;
    readonly cause: unknown;
}
export declare class StateRegistrationError extends CoreRuntimeError {
    readonly sliceId?: string | undefined;
    constructor(message: string, sliceId?: string | undefined);
}
export declare class StateCloneError extends CoreRuntimeError {
    constructor(message: string, cause?: unknown);
}
export declare class MementoCaptureError extends CoreRuntimeError {
    readonly sliceId: string;
    constructor(sliceId: string, cause: unknown);
}
export declare class MementoRestoreError extends CoreRuntimeError {
    readonly sliceId: string;
    readonly phase: 'restore' | 'rollback';
    readonly rollbackErrors: readonly unknown[];
    constructor(sliceId: string, phase: 'restore' | 'rollback', cause: unknown, rollbackErrors?: readonly unknown[]);
}
export declare class SnapshotValidationError extends CoreRuntimeError {
    readonly path: string;
    constructor(message: string, path?: string, cause?: unknown);
}
export declare class GeometryRegistrationError extends CoreRuntimeError {
    readonly participantId?: string | undefined;
    constructor(message: string, participantId?: string | undefined);
}
export declare class GeometryMutationError extends CoreRuntimeError {
    readonly mutationId: string;
    readonly rollbackErrors: readonly unknown[];
    constructor(mutationId: string, message: string, cause?: unknown, rollbackErrors?: readonly unknown[]);
}
export declare class GeometryRecoverableObjectError extends CoreRuntimeError {
    readonly objectIdentity?: string | undefined;
    readonly objectKind?: string | undefined;
    constructor(message: string, objectIdentity?: string | undefined, objectKind?: string | undefined, cause?: unknown);
}
export declare class GeometryUnrecoverableError extends CoreRuntimeError {
    readonly mutationId: string;
    readonly errors: readonly unknown[];
    constructor(mutationId: string, cause: unknown, errors: readonly unknown[]);
}
