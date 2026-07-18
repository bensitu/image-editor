/** Errors raised by the renderer-neutral Core runtime. */
export type CoreErrorBehavior = 'recoverable-object' | 'recoverable-optional-capability' | 'operation-cancelled' | 'operation-conflict' | 'fatal-participant' | 'fatal-invariant' | 'fatal-rollback' | 'fatal-restore' | 'snapshot-validation' | 'lifecycle';
export type CoreErrorSeverity = 'recoverable' | 'cancelled' | 'fatal';
export interface CoreErrorClassification {
    readonly behavior: CoreErrorBehavior;
    readonly severity: CoreErrorSeverity;
}
export interface CoreDiagnostic extends CoreErrorClassification {
    readonly timestamp: number;
    readonly code: string;
    readonly message: string;
    readonly cause?: unknown;
}
export declare function classifyCoreError(error: unknown): CoreErrorClassification;
export declare class CoreRuntimeError extends Error {
    constructor(message: string, options?: {
        readonly code?: string;
        readonly cause?: unknown;
        readonly behavior?: CoreErrorBehavior;
    });
    readonly code: string;
    readonly cause: unknown;
    readonly behavior: CoreErrorBehavior;
    readonly severity: CoreErrorSeverity;
}
export declare class EditorAlreadyInitializedError extends CoreRuntimeError {
    constructor();
}
export declare class EditorInitializationInProgressError extends CoreRuntimeError {
    constructor(operation?: string);
}
export declare class EditorDisposingError extends CoreRuntimeError {
    constructor(operation: string);
}
export declare class EditorDisposedError extends CoreRuntimeError {
    constructor(operation: string);
}
export declare class EditorFaultedError extends CoreRuntimeError {
    constructor(operation: string);
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
    constructor(message: string, path?: string, cause?: unknown, code?: string);
}
export declare class SnapshotVersionUnsupportedError extends SnapshotValidationError {
    readonly detectedVersion: number | 'unversioned';
    readonly migrationEntry = "@bensitu/image-editor/migrate-v2";
    constructor(detectedVersion?: number | 'unversioned');
}
export declare class EmergencyResetError extends CoreRuntimeError {
    readonly diagnostics: readonly CoreDiagnostic[];
    constructor(diagnostics: readonly CoreDiagnostic[], cause?: unknown);
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
export declare class DocumentMutationRegistrationError extends CoreRuntimeError {
    readonly transactionId?: string | undefined;
    constructor(message: string, transactionId?: string | undefined);
}
export declare class DocumentMutationError extends CoreRuntimeError {
    readonly transactionId: string;
    readonly rollbackErrors: readonly unknown[];
    constructor(transactionId: string, message: string, cause?: unknown, rollbackErrors?: readonly unknown[], code?: string, behavior?: CoreErrorBehavior);
}
export declare class DocumentMutationInvariantError extends DocumentMutationError {
    constructor(transactionId: string, cause: unknown);
}
export declare class DocumentMutationUnrecoverableError extends DocumentMutationError {
    constructor(transactionId: string, cause: unknown, rollbackErrors: readonly unknown[]);
}
