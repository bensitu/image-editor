import { createDisposable } from '../../plugin-kernel/disposable.js';
import { GeometryMutationError, GeometryRecoverableObjectError, GeometryRegistrationError, GeometryUnrecoverableError, } from '../errors.js';
import { cloneStateValue } from '../state/clone-state-value.js';
import { IDENTITY_AFFINE_MATRIX, computeAffineDelta, hasAffineReflection, isFiniteAffineMatrix, } from './affine-matrix.js';
function assertIdentifier(value, label) {
    if (value.trim().length === 0 || value.trim() !== value) {
        throw new GeometryMutationError(value || 'unknown', `${label} must be non-empty and trimmed.`);
    }
}
function freezeGeometry(snapshot) {
    if (!isFiniteAffineMatrix(snapshot.matrix) ||
        !Number.isFinite(snapshot.canvasWidth) ||
        !Number.isFinite(snapshot.canvasHeight) ||
        !Number.isSafeInteger(snapshot.revision) ||
        snapshot.revision < 0) {
        throw new GeometryMutationError('geometry', 'captured geometry is malformed.');
    }
    return Object.freeze({
        ...snapshot,
        matrix: Object.freeze([...snapshot.matrix]),
        boundingBox: Object.freeze({ ...snapshot.boundingBox }),
    });
}
function createDescriptor(request, before, after, metadata, provisional) {
    const affineDelta = provisional
        ? IDENTITY_AFFINE_MATRIX
        : request.kind === 'raster-replace'
            ? null
            : computeAffineDelta(before.matrix, after.matrix);
    return Object.freeze({
        id: request.id,
        kind: request.kind,
        operationId: request.operationId,
        before,
        after,
        affineDelta,
        hasReflection: affineDelta ? hasAffineReflection(affineDelta) : false,
        sourceRect: request.sourceRect ? Object.freeze({ ...request.sourceRect }) : undefined,
        targetSize: request.targetSize ? Object.freeze({ ...request.targetSize }) : undefined,
        metadata,
    });
}
export class GeometryMutationCoordinator {
    constructor(options) {
        Object.defineProperty(this, "options", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: options
        });
        Object.defineProperty(this, "participants", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "usedMutationIds", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Set()
        });
        Object.defineProperty(this, "registrationCounter", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "activeController", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "activePromise", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "disposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
    }
    get isRunning() {
        return this.activePromise !== null;
    }
    registerParticipant(participant) {
        this.assertActive('register a participant');
        assertIdentifier(participant.id, 'Participant id');
        if (!Number.isFinite(participant.order)) {
            throw new GeometryRegistrationError(`Geometry participant "${participant.id}" must use a finite order.`, participant.id);
        }
        if (this.participants.has(participant.id)) {
            throw new GeometryRegistrationError(`Geometry participant "${participant.id}" is already registered.`, participant.id);
        }
        const record = {
            participant: Object.freeze({ ...participant }),
            registrationOrder: this.registrationCounter++,
        };
        this.participants.set(participant.id, record);
        return createDisposable(() => {
            if (this.participants.get(participant.id) === record) {
                this.participants.delete(participant.id);
            }
        });
    }
    run(request) {
        this.assertActive('run a geometry mutation');
        if (this.activePromise) {
            return Promise.reject(new GeometryMutationError(request.id, 'another geometry mutation is active.'));
        }
        try {
            this.validateRequest(request);
        }
        catch (error) {
            return Promise.reject(error);
        }
        const controller = new AbortController();
        this.activeController = controller;
        const operation = this.performRun(request, controller.signal);
        this.activePromise = operation;
        return operation.finally(() => {
            if (this.activePromise === operation)
                this.activePromise = null;
            if (this.activeController === controller)
                this.activeController = null;
        });
    }
    async dispose() {
        var _a;
        if (this.disposed)
            return;
        this.disposed = true;
        (_a = this.activeController) === null || _a === void 0 ? void 0 : _a.abort(new Error('Geometry coordinator was disposed.'));
        try {
            await this.activePromise;
        }
        catch {
        }
        this.participants.clear();
        this.usedMutationIds.clear();
    }
    disposeSync() {
        if (this.disposed)
            return;
        if (this.activePromise) {
            throw new GeometryRegistrationError('Cannot synchronously dispose an active geometry mutation.');
        }
        this.disposed = true;
        this.participants.clear();
        this.usedMutationIds.clear();
    }
    async performRun(request, signal) {
        const operationToken = this.options.operations.acquire(request.operationId);
        try {
            return await this.performTransaction(request, signal);
        }
        finally {
            await operationToken.dispose();
        }
    }
    async performTransaction(request, signal) {
        var _a, _b, _c, _d, _e;
        const beforeMemento = this.options.mementos.capture();
        const before = freezeGeometry(this.options.state.captureGeometry());
        const metadata = cloneStateValue((_a = request.metadata) !== null && _a !== void 0 ? _a : {});
        const participantSnapshot = Object.freeze([...this.participants.values()].sort((left, right) => left.participant.order - right.participant.order ||
            left.registrationOrder - right.registrationOrder));
        const provisional = createDescriptor(request, before, before, metadata, true);
        const prepared = [];
        let finalDescriptor = provisional;
        const participantContext = Object.freeze({
            signal,
            warnRecoverable: (error, objectIdentity, objectKind) => {
                this.warn({
                    code: 'GEOMETRY_OBJECT_SKIPPED',
                    message: 'An overlay transform skipped a malformed or unsupported object.',
                    mutationId: request.id,
                    objectIdentity,
                    objectKind,
                    cause: error,
                });
            },
        });
        try {
            this.throwIfUnavailable(signal);
            for (const record of participantSnapshot) {
                if (!record.participant.supports(provisional))
                    continue;
                const preparedValue = record.participant.prepare
                    ? await record.participant.prepare(provisional, participantContext)
                    : undefined;
                prepared.push({ record, prepared: preparedValue });
            }
            this.throwIfUnavailable(signal);
            await request.mutateBase(Object.freeze({ signal }));
            this.throwIfUnavailable(signal);
            await this.options.state.finalizeGeometry();
            const after = freezeGeometry(this.options.state.captureGeometry());
            if (after.revision <= before.revision) {
                throw new GeometryMutationError(request.id, `geometry revision must increase (${before.revision} -> ${after.revision}).`);
            }
            finalDescriptor = createDescriptor(request, before, after, metadata, false);
            for (const entry of prepared) {
                this.throwIfUnavailable(signal);
                try {
                    await entry.record.participant.apply(finalDescriptor, entry.prepared, participantContext);
                }
                catch (error) {
                    if (error instanceof GeometryRecoverableObjectError) {
                        this.warn({
                            code: 'GEOMETRY_OBJECT_SKIPPED',
                            message: error.message,
                            mutationId: request.id,
                            participantId: entry.record.participant.id,
                            objectIdentity: error.objectIdentity,
                            objectKind: error.objectKind,
                            cause: error.cause,
                        });
                        continue;
                    }
                    throw error;
                }
            }
            for (const entry of prepared) {
                this.throwIfUnavailable(signal);
                try {
                    await ((_c = (_b = entry.record.participant).synchronize) === null || _c === void 0 ? void 0 : _c.call(_b, finalDescriptor, participantContext));
                }
                catch (error) {
                    if (error instanceof GeometryRecoverableObjectError) {
                        this.warn({
                            code: 'GEOMETRY_SYNCHRONIZE_WARNING',
                            message: error.message,
                            mutationId: request.id,
                            participantId: entry.record.participant.id,
                            objectIdentity: error.objectIdentity,
                            objectKind: error.objectKind,
                            cause: error.cause,
                        });
                        continue;
                    }
                    throw error;
                }
            }
            this.throwIfUnavailable(signal);
            this.options.state.requestRender();
            const afterMemento = this.options.mementos.capture();
            if (this.options.history.isAvailable()) {
                await this.options.history.commit(Object.freeze({
                    operationId: request.operationId,
                    before: beforeMemento,
                    after: afterMemento,
                    timestamp: Date.now(),
                    descriptor: finalDescriptor,
                }));
            }
            try {
                await this.options.events.emitCommitted('geometry:committed', finalDescriptor);
            }
            catch (error) {
                this.warn({
                    code: 'COMMITTED_EVENT_LISTENER_FAILED',
                    message: 'A committed geometry observer failed after the transaction committed.',
                    mutationId: request.id,
                    cause: error,
                });
            }
            return finalDescriptor;
        }
        catch (error) {
            const rollbackErrors = await this.rollback(request, finalDescriptor, prepared, participantContext, beforeMemento, error);
            const failure = error instanceof GeometryMutationError
                ? error
                : new GeometryMutationError(request.id, error instanceof Error ? error.message : 'unknown failure.', error, rollbackErrors);
            (_e = (_d = this.options).errorSink) === null || _e === void 0 ? void 0 : _e.call(_d, failure);
            throw failure;
        }
    }
    async rollback(request, descriptor, prepared, participantContext, beforeMemento, cause) {
        var _a, _b;
        const errors = [];
        for (let index = prepared.length - 1; index >= 0; index -= 1) {
            const entry = prepared[index];
            if (!entry)
                continue;
            try {
                await ((_b = (_a = entry.record.participant).rollback) === null || _b === void 0 ? void 0 : _b.call(_a, descriptor, entry.prepared, participantContext));
            }
            catch (error) {
                errors.push(error);
            }
        }
        let targetedSucceeded = false;
        if (request.rollbackBase) {
            try {
                await request.rollbackBase(Object.freeze({ signal: new AbortController().signal, cause }));
                targetedSucceeded =
                    errors.length === 0 &&
                        (this.options.mementos.matches
                            ? await this.options.mementos.matches(beforeMemento)
                            : true);
            }
            catch (error) {
                errors.push(error);
            }
        }
        if (!targetedSucceeded) {
            try {
                await this.options.mementos.restore(beforeMemento);
            }
            catch (restoreError) {
                errors.push(restoreError);
                throw new GeometryUnrecoverableError(request.id, cause, Object.freeze(errors));
            }
        }
        if (!this.options.state.isDisposed()) {
            try {
                this.options.state.requestRender();
            }
            catch (error) {
                errors.push(error);
            }
        }
        return Object.freeze(errors);
    }
    validateRequest(request) {
        var _a, _b;
        assertIdentifier(request.id, 'Mutation id');
        assertIdentifier(request.kind, 'Mutation kind');
        assertIdentifier(request.operationId, 'Operation id');
        if (this.usedMutationIds.has(request.id)) {
            throw new GeometryMutationError(request.id, 'mutation id has already been used.');
        }
        if (!this.options.operations.has(request.operationId)) {
            throw new GeometryMutationError(request.id, `operation "${request.operationId}" is not registered.`);
        }
        if (typeof request.mutateBase !== 'function') {
            throw new GeometryMutationError(request.id, 'mutateBase must be a function.');
        }
        const metadata = JSON.stringify((_a = request.metadata) !== null && _a !== void 0 ? _a : {});
        const maxMetadataBytes = (_b = this.options.maxMetadataBytes) !== null && _b !== void 0 ? _b : 64 * 1024;
        if (new TextEncoder().encode(metadata).byteLength > maxMetadataBytes) {
            throw new GeometryMutationError(request.id, `metadata exceeds ${maxMetadataBytes} bytes.`);
        }
        this.usedMutationIds.add(request.id);
    }
    throwIfUnavailable(signal) {
        var _a;
        if (signal.aborted)
            throw (_a = signal.reason) !== null && _a !== void 0 ? _a : new Error('Geometry mutation aborted.');
        if (this.options.state.isDisposed()) {
            throw new GeometryMutationError('disposed', 'core state is disposed.');
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
            throw new GeometryRegistrationError(`Cannot ${operation} after coordinator disposal.`);
        }
    }
}
//# sourceMappingURL=geometry-mutation-coordinator.js.map