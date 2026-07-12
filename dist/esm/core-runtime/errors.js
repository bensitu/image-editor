export class CoreRuntimeError extends Error {
    constructor(message, options = {}) {
        var _a;
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
        this.name = new.target.name;
        this.code = (_a = options.code) !== null && _a !== void 0 ? _a : 'CORE_RUNTIME_ERROR';
        this.cause = options.cause;
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
            : ''}.`, { code: 'MEMENTO_RESTORE_ERROR', cause });
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
    constructor(message, path = '$', cause) {
        super(`[ImageEditor] Invalid snapshot at ${path}: ${message}`, {
            code: 'SNAPSHOT_VALIDATION_ERROR',
            cause,
        });
        Object.defineProperty(this, "path", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: path
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
        super(`[ImageEditor] Geometry mutation "${mutationId}" could not restore its pre-operation state.`, { code: 'GEOMETRY_UNRECOVERABLE_ERROR', cause });
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
//# sourceMappingURL=errors.js.map