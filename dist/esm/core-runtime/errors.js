function severityFor(behavior) {
    if (behavior === 'operation-cancelled')
        return 'cancelled';
    if (behavior === 'recoverable-object' ||
        behavior === 'recoverable-optional-capability' ||
        behavior === 'operation-conflict') {
        return 'recoverable';
    }
    return 'fatal';
}
function errorCode(value) {
    if (!value || typeof value !== 'object' || !('code' in value))
        return null;
    return typeof value.code === 'string' ? value.code : null;
}
export function classifyCoreError(error) {
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
    constructor(message, options = {}) {
        var _a, _b;
        super(message);
        Object.defineProperty(this, "code", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "cause", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "behavior", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "severity", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.name = new.target.name;
        this.code = (_a = options.code) !== null && _a !== void 0 ? _a : 'CORE_RUNTIME_ERROR';
        this.cause = options.cause;
        this.behavior = (_b = options.behavior) !== null && _b !== void 0 ? _b : 'fatal-participant';
        this.severity = severityFor(this.behavior);
    }
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
    constructor(operation) {
        super(`[ImageEditor] Cannot ${operation} while the editor is disposing.`, {
            code: 'EDITOR_DISPOSING',
            behavior: 'lifecycle',
        });
    }
}
export class EditorDisposedError extends CoreRuntimeError {
    constructor(operation) {
        super(`[ImageEditor] Cannot ${operation} after the editor has been disposed.`, {
            code: 'EDITOR_DISPOSED',
            behavior: 'lifecycle',
        });
    }
}
export class EditorFaultedError extends CoreRuntimeError {
    constructor(operation) {
        super(`[ImageEditor] Cannot ${operation} while the editor is faulted.`, {
            code: 'EDITOR_FAULTED',
            behavior: 'lifecycle',
        });
    }
}
export class StateRegistrationError extends CoreRuntimeError {
    constructor(message, sliceId) {
        super(`[ImageEditor] ${message}`, { code: 'STATE_REGISTRATION_ERROR' });
        Object.defineProperty(this, "sliceId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: sliceId
        });
    }
}
export class StateCloneError extends CoreRuntimeError {
    constructor(message, cause) {
        super(`[ImageEditor] ${message}`, { code: 'STATE_CLONE_ERROR', cause });
    }
}
export class MementoCaptureError extends CoreRuntimeError {
    constructor(sliceId, cause) {
        super(`[ImageEditor] Failed to capture state slice "${sliceId}".`, {
            code: 'MEMENTO_CAPTURE_ERROR',
            cause,
        });
        Object.defineProperty(this, "sliceId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: sliceId
        });
    }
}
export class MementoRestoreError extends CoreRuntimeError {
    constructor(sliceId, phase, cause, rollbackErrors = []) {
        super(`[ImageEditor] Failed to ${phase} state slice "${sliceId}"${rollbackErrors.length > 0
            ? `; ${rollbackErrors.length} rollback error(s) followed`
            : ''}.`, {
            code: 'MEMENTO_RESTORE_ERROR',
            cause,
            behavior: rollbackErrors.length > 0 ? 'fatal-rollback' : 'fatal-restore',
        });
        Object.defineProperty(this, "sliceId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: sliceId
        });
        Object.defineProperty(this, "phase", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: phase
        });
        Object.defineProperty(this, "rollbackErrors", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: rollbackErrors
        });
    }
}
export class SnapshotValidationError extends CoreRuntimeError {
    constructor(message, path = '$', cause, code = 'SNAPSHOT_VALIDATION_ERROR') {
        super(`[ImageEditor] Invalid snapshot at ${path}: ${message}`, {
            code,
            cause,
            behavior: 'snapshot-validation',
        });
        Object.defineProperty(this, "path", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: path
        });
    }
}
export class SnapshotVersionUnsupportedError extends SnapshotValidationError {
    constructor(detectedVersion = 'unversioned') {
        super(`snapshot version "${detectedVersion}" is unsupported; migrate it with "@bensitu/image-editor/migrate-v2" before loading.`, '$.version', undefined, 'SNAPSHOT_VERSION_UNSUPPORTED');
        Object.defineProperty(this, "detectedVersion", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: detectedVersion
        });
        Object.defineProperty(this, "migrationEntry", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: '@bensitu/image-editor/migrate-v2'
        });
    }
}
export class EmergencyResetError extends CoreRuntimeError {
    constructor(diagnostics, cause) {
        super(`[ImageEditor] Emergency reset failed with ${diagnostics.length} diagnostic(s); the editor was permanently disposed.`, { code: 'EMERGENCY_RESET_ERROR', cause, behavior: 'lifecycle' });
        Object.defineProperty(this, "diagnostics", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: diagnostics
        });
    }
}
export class GeometryRegistrationError extends CoreRuntimeError {
    constructor(message, participantId) {
        super(`[ImageEditor] ${message}`, { code: 'GEOMETRY_REGISTRATION_ERROR' });
        Object.defineProperty(this, "participantId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: participantId
        });
    }
}
export class GeometryMutationError extends CoreRuntimeError {
    constructor(mutationId, message, cause, rollbackErrors = []) {
        super(`[ImageEditor] Geometry mutation "${mutationId}" failed: ${message}`, {
            code: 'GEOMETRY_MUTATION_ERROR',
            cause,
        });
        Object.defineProperty(this, "mutationId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: mutationId
        });
        Object.defineProperty(this, "rollbackErrors", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: rollbackErrors
        });
    }
}
export class GeometryRecoverableObjectError extends CoreRuntimeError {
    constructor(message, objectIdentity, objectKind, cause) {
        super(`[ImageEditor] Recoverable overlay geometry failure: ${message}`, {
            code: 'GEOMETRY_RECOVERABLE_OBJECT_ERROR',
            cause,
            behavior: 'recoverable-object',
        });
        Object.defineProperty(this, "objectIdentity", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: objectIdentity
        });
        Object.defineProperty(this, "objectKind", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: objectKind
        });
    }
}
export class GeometryUnrecoverableError extends CoreRuntimeError {
    constructor(mutationId, cause, errors) {
        super(`[ImageEditor] Geometry mutation "${mutationId}" could not restore its pre-operation state.`, { code: 'GEOMETRY_UNRECOVERABLE_ERROR', cause, behavior: 'fatal-restore' });
        Object.defineProperty(this, "mutationId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: mutationId
        });
        Object.defineProperty(this, "errors", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: errors
        });
    }
}
export class DocumentMutationRegistrationError extends CoreRuntimeError {
    constructor(message, transactionId) {
        super(`[ImageEditor] ${message}`, { code: 'DOCUMENT_MUTATION_REGISTRATION_ERROR' });
        Object.defineProperty(this, "transactionId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: transactionId
        });
    }
}
export class DocumentMutationError extends CoreRuntimeError {
    constructor(transactionId, message, cause, rollbackErrors = [], code = 'DOCUMENT_MUTATION_ERROR', behavior = rollbackErrors.length > 0
        ? 'fatal-rollback'
        : 'fatal-participant') {
        super(`[ImageEditor] Document mutation "${transactionId}" failed: ${message}`, {
            code,
            cause,
            behavior,
        });
        Object.defineProperty(this, "transactionId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: transactionId
        });
        Object.defineProperty(this, "rollbackErrors", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: rollbackErrors
        });
    }
}
export class DocumentMutationInvariantError extends DocumentMutationError {
    constructor(transactionId, cause) {
        super(transactionId, cause instanceof Error ? cause.message : 'invariant validation failed.', cause, [], 'DOCUMENT_MUTATION_INVARIANT_ERROR', 'fatal-invariant');
    }
}
export class DocumentMutationUnrecoverableError extends DocumentMutationError {
    constructor(transactionId, cause, rollbackErrors) {
        super(transactionId, 'the pre-operation state could not be restored.', cause, rollbackErrors, 'DOCUMENT_MUTATION_UNRECOVERABLE_ERROR', 'fatal-restore');
    }
}
//# sourceMappingURL=errors.js.map