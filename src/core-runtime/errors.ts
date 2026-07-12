/** Errors raised by the renderer-neutral v3 core runtime. */

export class CoreRuntimeError extends Error {
    constructor(
        message: string,
        options: { readonly code?: string; readonly cause?: unknown } = {},
    ) {
        super(message);
        this.name = new.target.name;
        this.code = options.code ?? 'CORE_RUNTIME_ERROR';
        this.cause = options.cause;
    }

    readonly code: string;
    readonly cause: unknown;
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
            { code: 'MEMENTO_RESTORE_ERROR', cause },
        );
    }
}

export class SnapshotValidationError extends CoreRuntimeError {
    constructor(
        message: string,
        readonly path = '$',
        cause?: unknown,
    ) {
        super(`[ImageEditor] Invalid snapshot at ${path}: ${message}`, {
            code: 'SNAPSHOT_VALIDATION_ERROR',
            cause,
        });
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
            { code: 'GEOMETRY_UNRECOVERABLE_ERROR', cause },
        );
    }
}
