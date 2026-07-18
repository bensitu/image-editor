import { DocumentMutationError, DocumentMutationInvariantError, DocumentMutationRegistrationError, DocumentMutationUnrecoverableError, } from '../errors.js';
import { cloneStateValue } from '../state/clone-state-value.js';
function isCancellation(error) {
    return (typeof error === 'object' &&
        error !== null &&
        'name' in error &&
        error.name === 'AbortError');
}
function assertIdentifier(value, label) {
    if (value.trim().length === 0 || value.trim() !== value) {
        throw new DocumentMutationRegistrationError(`${label} must be non-empty and trimmed.`);
    }
}
function immutableMetadata(value) {
    const cloned = cloneStateValue(value !== null && value !== void 0 ? value : {});
    if (typeof cloned !== 'object' || cloned === null || Array.isArray(cloned)) {
        throw new DocumentMutationRegistrationError('Mutation metadata must be an object.');
    }
    return Object.freeze(cloned);
}
export class DocumentMutationCoordinator {
    constructor(options) {
        Object.defineProperty(this, "options", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: options
        });
        Object.defineProperty(this, "usedTransactionIds", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Set()
        });
        Object.defineProperty(this, "contextRecords", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new WeakMap()
        });
        Object.defineProperty(this, "activeControllers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Set()
        });
        Object.defineProperty(this, "activePromises", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Set()
        });
        Object.defineProperty(this, "disposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
    }
    get isRunning() {
        return this.activePromises.size > 0;
    }
    assertContextActive(context) {
        const record = this.contextRecords.get(context);
        if (!record || record.session.closed || context.signal.aborted) {
            throw new DocumentMutationInvariantError(context.transactionId, new Error('The document mutation context is not active.'));
        }
    }
    run(request) {
        var _a, _b, _c, _d;
        let normalized;
        let parentRecord;
        try {
            this.assertActive('run a document mutation');
            (_b = (_a = this.options.state).assertOperational) === null || _b === void 0 ? void 0 : _b.call(_a, 'run a document mutation');
            normalized = this.normalizeRequest(request);
            parentRecord = normalized.parent ? this.requireParent(normalized.parent) : null;
        }
        catch (error) {
            return Promise.reject(error);
        }
        const controller = new AbortController();
        const abort = () => { var _a; return controller.abort((_a = normalized.signal) === null || _a === void 0 ? void 0 : _a.reason); };
        if ((_c = normalized.signal) === null || _c === void 0 ? void 0 : _c.aborted)
            abort();
        else
            (_d = normalized.signal) === null || _d === void 0 ? void 0 : _d.addEventListener('abort', abort, { once: true });
        this.activeControllers.add(controller);
        const operation = this.options.operations.run(normalized.operationId, (operationContext) => parentRecord
            ? this.performNested(normalized, operationContext.token, parentRecord)
            : this.performTopLevel(normalized, operationContext.token), {
            parent: parentRecord === null || parentRecord === void 0 ? void 0 : parentRecord.operationToken,
            signal: controller.signal,
        });
        this.activePromises.add(operation);
        return operation.finally(() => {
            var _a;
            (_a = normalized.signal) === null || _a === void 0 ? void 0 : _a.removeEventListener('abort', abort);
            this.activeControllers.delete(controller);
            this.activePromises.delete(operation);
        });
    }
    async dispose() {
        if (this.disposed)
            return;
        this.disposed = true;
        const reason = new DOMException('Document Mutation Coordinator was disposed.', 'AbortError');
        for (const controller of this.activeControllers)
            controller.abort(reason);
        await Promise.allSettled([...this.activePromises]);
        this.activeControllers.clear();
        this.usedTransactionIds.clear();
    }
    async abortActive(reason) {
        this.assertActive('abort document mutations');
        for (const controller of this.activeControllers)
            controller.abort(reason);
        await Promise.allSettled([...this.activePromises]);
    }
    reset() {
        this.assertActive('reset document mutations');
        if (this.activePromises.size > 0) {
            throw new DocumentMutationRegistrationError('Cannot reset while a document mutation is active.');
        }
        this.usedTransactionIds.clear();
    }
    disposeSync() {
        if (this.disposed)
            return;
        if (this.activePromises.size > 0) {
            throw new DocumentMutationRegistrationError('Cannot synchronously dispose an active document mutation.');
        }
        this.disposed = true;
        this.usedTransactionIds.clear();
    }
    async performTopLevel(request, operationToken) {
        const before = this.options.mementos.capture();
        const session = {
            before,
            rollbackEntries: [],
            validators: [],
            diagnostics: [],
            failure: null,
            closed: false,
        };
        const context = this.createContext(request, operationToken, session, null);
        let result;
        let committedResult;
        try {
            result = await this.executeRequest(request, context, session);
            if (session.failure)
                throw session.failure;
            this.throwIfUnavailable(context.signal, request.id);
            this.options.state.requestRender();
            for (const validate of session.validators) {
                this.throwIfUnavailable(context.signal, request.id);
                try {
                    await validate();
                }
                catch (error) {
                    throw new DocumentMutationInvariantError(request.id, error);
                }
            }
            this.throwIfUnavailable(context.signal, request.id);
            committedResult = request.describeCommit
                ? await request.describeCommit(result, context)
                : result;
            this.throwIfUnavailable(context.signal, request.id);
        }
        catch (error) {
            session.closed = true;
            throw await this.restoreAfterFailure(request.id, session, error);
        }
        let descriptor;
        try {
            const after = this.options.mementos.capture();
            descriptor = Object.freeze({
                transactionId: request.id,
                parentTransactionId: null,
                kind: request.kind,
                operationId: request.operationId,
                conflictDomains: request.conflictDomains,
                metadata: request.metadata,
                diagnostics: Object.freeze([...session.diagnostics]),
                result: committedResult,
                committedAt: Date.now(),
            });
            if (this.options.history.isAvailable()) {
                await this.options.history.commit(Object.freeze({
                    operationId: request.operationId,
                    before,
                    after,
                    timestamp: descriptor.committedAt,
                    detail: descriptor,
                }));
            }
        }
        catch (error) {
            session.closed = true;
            throw await this.restoreAfterFailure(request.id, session, error);
        }
        session.closed = true;
        try {
            await this.options.events.emitCommitted(descriptor);
        }
        catch (error) {
            this.warn({
                code: 'DOCUMENT_COMMITTED_OBSERVER_FAILED',
                message: 'A committed document observer failed after the transaction committed.',
                transactionId: request.id,
                cause: error,
            });
        }
        return result;
    }
    async performNested(request, operationToken, parentRecord) {
        var _a;
        var _b;
        const parent = request.parent;
        if (!parent) {
            throw new DocumentMutationRegistrationError('Nested mutation requires a parent.');
        }
        const context = this.createContext(request, operationToken, parentRecord.session, parent);
        try {
            return await this.executeRequest(request, context, parentRecord.session);
        }
        catch (error) {
            (_a = (_b = parentRecord.session).failure) !== null && _a !== void 0 ? _a : (_b.failure = error);
            throw error;
        }
    }
    async executeRequest(request, context, session) {
        var _a, _b, _c, _d, _e;
        const outcome = { result: undefined };
        const requestRollback = request.rollback
            ? {
                enabled: false,
                run: async (cause) => {
                    var _a;
                    const rollbackContext = this.createRollbackContext(context, cause, outcome.result);
                    await ((_a = request.rollback) === null || _a === void 0 ? void 0 : _a.call(request, rollbackContext));
                },
            }
            : null;
        if (requestRollback)
            session.rollbackEntries.push(requestRollback);
        const prepared = [];
        for (const participant of request.participants) {
            this.throwIfUnavailable(context.signal, request.id);
            const preparedValue = participant.prepare
                ? await participant.prepare(context)
                : undefined;
            prepared.push({ participant, value: preparedValue });
            if (participant.rollback) {
                session.rollbackEntries.push({
                    enabled: true,
                    run: async (cause) => {
                        var _a;
                        const rollbackContext = this.createRollbackContext(context, cause, outcome.result);
                        await ((_a = participant.rollback) === null || _a === void 0 ? void 0 : _a.call(participant, preparedValue, rollbackContext));
                    },
                });
            }
        }
        this.throwIfUnavailable(context.signal, request.id);
        if (requestRollback)
            requestRollback.enabled = true;
        const result = await request.mutate(context);
        outcome.result = result;
        this.throwIfUnavailable(context.signal, request.id);
        for (const entry of prepared) {
            await ((_b = (_a = entry.participant).apply) === null || _b === void 0 ? void 0 : _b.call(_a, result, entry.value, context));
            this.throwIfUnavailable(context.signal, request.id);
        }
        for (const entry of prepared) {
            await ((_d = (_c = entry.participant).synchronize) === null || _d === void 0 ? void 0 : _d.call(_c, result, entry.value, context));
            this.throwIfUnavailable(context.signal, request.id);
        }
        await ((_e = request.synchronize) === null || _e === void 0 ? void 0 : _e.call(request, result, context));
        this.throwIfUnavailable(context.signal, request.id);
        if (request.validate) {
            session.validators.push(async () => { var _a; return (_a = request.validate) === null || _a === void 0 ? void 0 : _a.call(request, result, context); });
        }
        return result;
    }
    createContext(request, operationToken, session, parent) {
        var _a, _b;
        const participantIds = Object.freeze(request.participants.map(({ id }) => id));
        const context = Object.freeze({
            transactionId: request.id,
            parentTransactionId: (_a = parent === null || parent === void 0 ? void 0 : parent.transactionId) !== null && _a !== void 0 ? _a : null,
            operationId: request.operationId,
            conflictDomains: request.conflictDomains,
            historyOwner: parent ? 'parent' : 'self',
            eventOwner: parent ? 'parent' : 'self',
            signal: operationToken.signal,
            participantIds,
            metadata: request.metadata,
        });
        this.contextRecords.set(context, { session, operationToken });
        session.diagnostics.push(Object.freeze({
            transactionId: request.id,
            parentTransactionId: (_b = parent === null || parent === void 0 ? void 0 : parent.transactionId) !== null && _b !== void 0 ? _b : null,
            participantIds,
            metadata: request.metadata,
        }));
        return context;
    }
    createRollbackContext(context, cause, result) {
        return Object.freeze({
            ...context,
            signal: new AbortController().signal,
            cause,
            result,
        });
    }
    async restoreAfterFailure(transactionId, session, cause) {
        var _a, _b, _c, _d, _e, _f;
        const rollbackErrors = [];
        for (let index = session.rollbackEntries.length - 1; index >= 0; index -= 1) {
            const entry = session.rollbackEntries[index];
            if (!(entry === null || entry === void 0 ? void 0 : entry.enabled))
                continue;
            try {
                await entry.run(cause);
            }
            catch (error) {
                rollbackErrors.push(error);
            }
        }
        let targetedStateMatches = false;
        const targetedRollbackRan = session.rollbackEntries.some((entry) => entry.enabled);
        if (targetedRollbackRan && rollbackErrors.length === 0 && this.options.mementos.matches) {
            try {
                targetedStateMatches = await this.options.mementos.matches(session.before);
            }
            catch (error) {
                rollbackErrors.push(error);
            }
        }
        if (!targetedStateMatches) {
            try {
                await this.options.mementos.restore(session.before, {
                    rollbackOnFailure: false,
                });
            }
            catch (restoreError) {
                rollbackErrors.push(restoreError);
                const failure = new DocumentMutationUnrecoverableError(transactionId, cause, Object.freeze(rollbackErrors));
                (_b = (_a = this.options).faultSink) === null || _b === void 0 ? void 0 : _b.call(_a, failure);
                (_d = (_c = this.options).errorSink) === null || _d === void 0 ? void 0 : _d.call(_c, failure);
                return failure;
            }
        }
        if (!this.options.state.isDisposed()) {
            try {
                this.options.state.requestRender();
            }
            catch (error) {
                rollbackErrors.push(error);
            }
        }
        if (isCancellation(cause))
            return cause;
        const failure = cause instanceof DocumentMutationError
            ? cause
            : new DocumentMutationError(transactionId, cause instanceof Error ? cause.message : 'unknown failure.', cause, Object.freeze(rollbackErrors));
        (_f = (_e = this.options).errorSink) === null || _f === void 0 ? void 0 : _f.call(_e, failure);
        return failure;
    }
    normalizeRequest(request) {
        var _a, _b;
        assertIdentifier(request.id, 'Transaction id');
        assertIdentifier(request.kind, 'Mutation kind');
        assertIdentifier(request.operationId, 'Operation id');
        if (this.usedTransactionIds.has(request.id)) {
            throw new DocumentMutationRegistrationError(`Transaction id "${request.id}" has already been used.`, request.id);
        }
        if (!this.options.operations.has(request.operationId)) {
            throw new DocumentMutationRegistrationError(`Operation "${request.operationId}" is not registered.`, request.id);
        }
        const operation = this.options.operations.get(request.operationId);
        if (!operation) {
            throw new DocumentMutationRegistrationError(`Operation "${request.operationId}" is unavailable.`, request.id);
        }
        if (!Array.isArray(request.conflictDomains) ||
            request.conflictDomains.length === 0 ||
            request.conflictDomains.some((domain) => !operation.conflictDomains.includes(domain))) {
            throw new DocumentMutationRegistrationError('Mutation conflict domains must be covered by its registered operation.', request.id);
        }
        if (typeof request.mutate !== 'function') {
            throw new DocumentMutationRegistrationError('Mutation request must define mutate().', request.id);
        }
        const participants = [...((_a = request.participants) !== null && _a !== void 0 ? _a : [])];
        const participantIds = new Set();
        for (const participant of participants) {
            assertIdentifier(participant.id, 'Participant id');
            if (!Number.isFinite(participant.order)) {
                throw new DocumentMutationRegistrationError(`Participant "${participant.id}" must use a finite order.`, request.id);
            }
            if (participantIds.has(participant.id)) {
                throw new DocumentMutationRegistrationError(`Participant "${participant.id}" is duplicated.`, request.id);
            }
            participantIds.add(participant.id);
        }
        participants.sort((left, right) => left.order - right.order);
        const metadata = immutableMetadata(request.metadata);
        const serializedMetadata = JSON.stringify(metadata);
        const maxMetadataBytes = (_b = this.options.maxMetadataBytes) !== null && _b !== void 0 ? _b : 64 * 1024;
        if (new TextEncoder().encode(serializedMetadata).byteLength > maxMetadataBytes) {
            throw new DocumentMutationRegistrationError(`Mutation metadata exceeds ${maxMetadataBytes} bytes.`, request.id);
        }
        this.usedTransactionIds.add(request.id);
        return Object.freeze({
            ...request,
            conflictDomains: Object.freeze([...request.conflictDomains]),
            participants: Object.freeze(participants),
            metadata,
        });
    }
    requireParent(parent) {
        const record = this.contextRecords.get(parent);
        if (!record || record.session.closed || parent.signal.aborted) {
            throw new DocumentMutationRegistrationError(`Parent transaction "${parent.transactionId}" is not active.`, parent.transactionId);
        }
        return record;
    }
    throwIfUnavailable(signal, transactionId) {
        var _a;
        if (signal.aborted) {
            throw (_a = signal.reason) !== null && _a !== void 0 ? _a : new DOMException('Document mutation was aborted.', 'AbortError');
        }
        if (this.options.state.isDisposed()) {
            throw new DocumentMutationError(transactionId, 'Core state is disposed.');
        }
    }
    warn(warning) {
        var _a, _b, _c, _d;
        try {
            (_b = (_a = this.options).warningSink) === null || _b === void 0 ? void 0 : _b.call(_a, Object.freeze(warning));
        }
        catch (error) {
            (_d = (_c = this.options).errorSink) === null || _d === void 0 ? void 0 : _d.call(_c, error);
        }
    }
    assertActive(operation) {
        if (this.disposed) {
            throw new DocumentMutationRegistrationError(`Cannot ${operation} after coordinator disposal.`);
        }
    }
}
//# sourceMappingURL=document-mutation-coordinator.js.map