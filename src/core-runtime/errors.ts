/**
 * Errors raised by the renderer-neutral Core runtime.
 *
 * @module
 */

export type CoreErrorBehavior =
    | 'recoverable-object'
    | 'recoverable-optional-capability'
    | 'operation-cancelled'
    | 'operation-conflict'
    | 'fatal-participant'
    | 'fatal-invariant'
    | 'fatal-rollback'
    | 'fatal-restore'
    | 'snapshot-validation'
    | 'lifecycle';

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

function severityFor(behavior: CoreErrorBehavior): CoreErrorSeverity {
    if (behavior === 'operation-cancelled') return 'cancelled';
    if (
        behavior === 'recoverable-object' ||
        behavior === 'recoverable-optional-capability' ||
        behavior === 'operation-conflict'
    ) {
        return 'recoverable';
    }
    return 'fatal';
}

function errorCode(value: unknown): string | null {
    if (!value || typeof value !== 'object' || !('code' in value)) return null;
    return typeof value.code === 'string' ? value.code : null;
}

export function classifyCoreError(error: unknown): CoreErrorClassification {
    if (error instanceof CoreRuntimeError) {
        return Object.freeze({ behavior: error.behavior, severity: error.severity });
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
        return Object.freeze({ behavior: 'operation-cancelled', severity: 'cancelled' });
    }
    const code = errorCode(error);
    if (code === 'OPTIONAL_CAPABILITY_INCOMPATIBLE') {
        return Object.freeze({
            behavior: 'recoverable-optional-capability',
            severity: 'recoverable',
        });
    }
    if (code === 'OPERATION_CONFLICT') {
        return Object.freeze({ behavior: 'operation-conflict', severity: 'recoverable' });
    }
    return Object.freeze({ behavior: 'fatal-participant', severity: 'fatal' });
}

export class CoreRuntimeError extends Error {
    constructor(
        message: string,
        options: {
            readonly code?: string;
            readonly cause?: unknown;
            readonly behavior?: CoreErrorBehavior;
        } = {},
    ) {
        super(message);
        this.name = new.target.name;
        this.code = options.code ?? 'CORE_RUNTIME_ERROR';
        this.cause = options.cause;
        this.behavior = options.behavior ?? 'fatal-participant';
        this.severity = severityFor(this.behavior);
    }

    readonly code: string;
    readonly cause: unknown;
    readonly behavior: CoreErrorBehavior;
    readonly severity: CoreErrorSeverity;
}

export class EditorAlreadyInitializedError extends CoreRuntimeError {
    constructor() {
        super('[ImageEditor] The editor is already initialized.', {
            code: 'EDITOR_ALREADY_INITIALIZED',
            behavior: 'lifecycle',
        });
    }
}

export class EditorInitializationInProgressError extends CoreRuntimeError {
    constructor(operation = 'initialize') {
        super(`[ImageEditor] Cannot ${operation} while initialization is in progress.`, {
            code: 'EDITOR_INITIALIZATION_IN_PROGRESS',
            behavior: 'lifecycle',
        });
    }
}

export class EditorDisposingError extends CoreRuntimeError {
    constructor(operation: string) {
        super(`[ImageEditor] Cannot ${operation} while the editor is disposing.`, {
            code: 'EDITOR_DISPOSING',
            behavior: 'lifecycle',
        });
    }
}

export class EditorDisposedError extends CoreRuntimeError {
    constructor(operation: string) {
        super(`[ImageEditor] Cannot ${operation} after the editor has been disposed.`, {
            code: 'EDITOR_DISPOSED',
            behavior: 'lifecycle',
        });
    }
}

export class EditorFaultedError extends CoreRuntimeError {
    constructor(operation: string) {
        super(`[ImageEditor] Cannot ${operation} while the editor is faulted.`, {
            code: 'EDITOR_FAULTED',
            behavior: 'lifecycle',
        });
    }
}

export class StateRegistrationError extends CoreRuntimeError {
    constructor(
        message: string,
        readonly sliceId?: string,
    ) {
        super(`[ImageEditor] ${message}`, { code: 'STATE_REGISTRATION_ERROR' });
    }
}

export class StateCloneError extends CoreRuntimeError {
    constructor(message: string, cause?: unknown) {
        super(`[ImageEditor] ${message}`, { code: 'STATE_CLONE_ERROR', cause });
    }
}

export class MementoCaptureError extends CoreRuntimeError {
    constructor(
        readonly sliceId: string,
        cause: unknown,
    ) {
        super(`[ImageEditor] Failed to capture state slice "${sliceId}".`, {
            code: 'MEMENTO_CAPTURE_ERROR',
            cause,
        });
    }
}

export class MementoRestoreError extends CoreRuntimeError {
    constructor(
        readonly sliceId: string,
        readonly phase: 'restore' | 'rollback',
        cause: unknown,
        readonly rollbackErrors: readonly unknown[] = [],
    ) {
        super(
            `[ImageEditor] Failed to ${phase} state slice "${sliceId}"${
                rollbackErrors.length > 0
                    ? `; ${rollbackErrors.length} rollback error(s) followed`
                    : ''
            }.`,
            {
                code: 'MEMENTO_RESTORE_ERROR',
                cause,
                behavior: rollbackErrors.length > 0 ? 'fatal-rollback' : 'fatal-restore',
            },
        );
    }
}

export class SnapshotValidationError extends CoreRuntimeError {
    constructor(
        message: string,
        readonly path = '$',
        cause?: unknown,
        code = 'SNAPSHOT_VALIDATION_ERROR',
    ) {
        super(`[ImageEditor] Invalid snapshot at ${path}: ${message}`, {
            code,
            cause,
            behavior: 'snapshot-validation',
        });
    }
}

export class SnapshotVersionUnsupportedError extends SnapshotValidationError {
    readonly migrationEntry = '@bensitu/image-editor/migrate-v2';

    constructor(readonly detectedVersion: number | 'unversioned' = 'unversioned') {
        super(
            `snapshot version "${detectedVersion}" is unsupported; migrate it with "@bensitu/image-editor/migrate-v2" before loading.`,
            '$.version',
            undefined,
            'SNAPSHOT_VERSION_UNSUPPORTED',
        );
    }
}

export class EmergencyResetError extends CoreRuntimeError {
    constructor(
        readonly diagnostics: readonly CoreDiagnostic[],
        cause?: unknown,
    ) {
        super(
            `[ImageEditor] Emergency reset failed with ${diagnostics.length} diagnostic(s); the editor was permanently disposed.`,
            { code: 'EMERGENCY_RESET_ERROR', cause, behavior: 'lifecycle' },
        );
    }
}

export class GeometryRegistrationError extends CoreRuntimeError {
    constructor(
        message: string,
        readonly participantId?: string,
    ) {
        super(`[ImageEditor] ${message}`, { code: 'GEOMETRY_REGISTRATION_ERROR' });
    }
}

export class GeometryMutationError extends CoreRuntimeError {
    constructor(
        readonly mutationId: string,
        message: string,
        cause?: unknown,
        readonly rollbackErrors: readonly unknown[] = [],
    ) {
        super(`[ImageEditor] Geometry mutation "${mutationId}" failed: ${message}`, {
            code: 'GEOMETRY_MUTATION_ERROR',
            cause,
        });
    }
}

export class GeometryRecoverableObjectError extends CoreRuntimeError {
    constructor(
        message: string,
        readonly objectIdentity?: string,
        readonly objectKind?: string,
        cause?: unknown,
    ) {
        super(`[ImageEditor] Recoverable overlay geometry failure: ${message}`, {
            code: 'GEOMETRY_RECOVERABLE_OBJECT_ERROR',
            cause,
            behavior: 'recoverable-object',
        });
    }
}

export class GeometryUnrecoverableError extends CoreRuntimeError {
    constructor(
        readonly mutationId: string,
        cause: unknown,
        readonly errors: readonly unknown[],
    ) {
        super(
            `[ImageEditor] Geometry mutation "${mutationId}" could not restore its pre-operation state.`,
            { code: 'GEOMETRY_UNRECOVERABLE_ERROR', cause, behavior: 'fatal-restore' },
        );
    }
}

export class DocumentMutationRegistrationError extends CoreRuntimeError {
    constructor(
        message: string,
        readonly transactionId?: string,
    ) {
        super(`[ImageEditor] ${message}`, { code: 'DOCUMENT_MUTATION_REGISTRATION_ERROR' });
    }
}

export class DocumentMutationError extends CoreRuntimeError {
    constructor(
        readonly transactionId: string,
        message: string,
        cause?: unknown,
        readonly rollbackErrors: readonly unknown[] = [],
        code = 'DOCUMENT_MUTATION_ERROR',
        behavior: CoreErrorBehavior = rollbackErrors.length > 0
            ? 'fatal-rollback'
            : 'fatal-participant',
    ) {
        super(`[ImageEditor] Document mutation "${transactionId}" failed: ${message}`, {
            code,
            cause,
            behavior,
        });
    }
}

export class DocumentMutationInvariantError extends DocumentMutationError {
    constructor(transactionId: string, cause: unknown) {
        super(
            transactionId,
            cause instanceof Error ? cause.message : 'invariant validation failed.',
            cause,
            [],
            'DOCUMENT_MUTATION_INVARIANT_ERROR',
            'fatal-invariant',
        );
    }
}

export class DocumentMutationUnrecoverableError extends DocumentMutationError {
    constructor(transactionId: string, cause: unknown, rollbackErrors: readonly unknown[]) {
        super(
            transactionId,
            'the pre-operation state could not be restored.',
            cause,
            rollbackErrors,
            'DOCUMENT_MUTATION_UNRECOVERABLE_ERROR',
            'fatal-restore',
        );
    }
}
