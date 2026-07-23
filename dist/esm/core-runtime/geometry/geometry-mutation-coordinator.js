import { createDisposable } from '../../plugin-kernel/disposable.js';
import { DocumentMutationError, DocumentMutationUnrecoverableError } from '../errors.js';
import { cloneStateValue } from '../state/clone-state-value.js';
import { GeometryMutationError, GeometryRecoverableObjectError, GeometryRegistrationError, GeometryUnrecoverableError, } from '../errors.js';
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
        ...(request.sourceRect ? { sourceRect: Object.freeze({ ...request.sourceRect }) } : {}),
        ...(request.targetSize ? { targetSize: Object.freeze({ ...request.targetSize }) } : {}),
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
        Object.defineProperty(this, "registrationCounter", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
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
        let metadata;
        try {
            metadata = this.validateRequest(request);
        }
        catch (error) {
            return Promise.reject(error);
        }
        const controller = new AbortController();
        this.activeControllers.add(controller);
        const operation = this.performRun(request, metadata, controller.signal);
        this.activePromises.add(operation);
        return operation.finally(() => {
            this.activePromises.delete(operation);
            this.activeControllers.delete(controller);
        });
    }
    async dispose() {
        if (this.disposed)
            return;
        this.disposed = true;
        for (const controller of this.activeControllers) {
            controller.abort(new DOMException('Geometry coordinator was disposed.', 'AbortError'));
        }
        await Promise.allSettled([...this.activePromises]);
        this.participants.clear();
        this.usedMutationIds.clear();
    }
    async abortActive(reason) {
        this.assertActive('abort geometry mutations');
        for (const controller of this.activeControllers)
            controller.abort(reason);
        await Promise.allSettled([...this.activePromises]);
    }
    reset() {
        this.assertActive('reset geometry mutations');
        if (this.activePromises.size > 0) {
            throw new GeometryRegistrationError('Cannot reset while a geometry mutation is active.');
        }
        this.participants.clear();
        this.usedMutationIds.clear();
        this.registrationCounter = 0;
    }
    disposeSync() {
        if (this.disposed)
            return;
        if (this.activePromises.size > 0) {
            throw new GeometryRegistrationError('Cannot synchronously dispose an active geometry mutation.');
        }
        this.disposed = true;
        this.participants.clear();
        this.usedMutationIds.clear();
    }
    async performRun(request, metadata, signal) {
        var _a, _b;
        let before = null;
        let provisional = null;
        const participantSnapshot = Object.freeze([...this.participants.values()].sort((left, right) => left.participant.order - right.participant.order ||
            left.registrationOrder - right.registrationOrder));
        const geometryParticipant = Object.freeze({
            id: 'core:geometry-participants',
            order: 0,
            prepare: async (context) => {
                const capturedBefore = freezeGeometry(this.options.state.captureGeometry());
                const provisionalDescriptor = createDescriptor(request, capturedBefore, capturedBefore, metadata, true);
                before = capturedBefore;
                provisional = provisionalDescriptor;
                const participantContext = this.createParticipantContext(request.id, context.signal);
                const entries = [];
                for (const record of participantSnapshot) {
                    if (!record.participant.supports(provisionalDescriptor))
                        continue;
                    const prepared = record.participant.prepare
                        ? await record.participant.prepare(provisionalDescriptor, participantContext)
                        : undefined;
                    entries.push({ record, prepared });
                }
                return Object.freeze({
                    entries: Object.freeze(entries),
                    context: participantContext,
                });
            },
            apply: async (descriptor, prepared) => {
                for (const entry of prepared.entries) {
                    try {
                        await entry.record.participant.apply(descriptor, entry.prepared, prepared.context);
                    }
                    catch (error) {
                        if (error instanceof GeometryRecoverableObjectError) {
                            this.warnRecoverable(request.id, entry.record.participant.id, error);
                            continue;
                        }
                        throw error;
                    }
                }
            },
            synchronize: async (descriptor, prepared) => {
                var _a, _b;
                for (const entry of prepared.entries) {
                    try {
                        await ((_b = (_a = entry.record.participant).synchronize) === null || _b === void 0 ? void 0 : _b.call(_a, descriptor, prepared.context));
                    }
                    catch (error) {
                        if (error instanceof GeometryRecoverableObjectError) {
                            this.warn({
                                code: 'GEOMETRY_SYNCHRONIZE_WARNING',
                                message: error.message,
                                mutationId: request.id,
                                participantId: entry.record.participant.id,
                                ...(error.objectIdentity === undefined
                                    ? {}
                                    : { objectIdentity: error.objectIdentity }),
                                ...(error.objectKind === undefined
                                    ? {}
                                    : { objectKind: error.objectKind }),
                                cause: error.cause,
                            });
                            continue;
                        }
                        throw error;
                    }
                }
            },
            ...(participantSnapshot.some(({ participant }) => participant.rollback)
                ? {
                    rollback: async (prepared, rollbackContext) => {
                        var _a, _b, _c;
                        const descriptor = (_a = rollbackContext.result) !== null && _a !== void 0 ? _a : provisional;
                        if (!descriptor)
                            return;
                        for (let index = prepared.entries.length - 1; index >= 0; index -= 1) {
                            const entry = prepared.entries[index];
                            if (!entry)
                                continue;
                            await ((_c = (_b = entry.record.participant).rollback) === null || _c === void 0 ? void 0 : _c.call(_b, descriptor, entry.prepared, prepared.context));
                        }
                    },
                }
                : {}),
        });
        try {
            return await this.options.mutations.run({
                id: request.id,
                kind: 'geometry',
                operationId: request.operationId,
                conflictDomains: ['document', 'base-image', 'geometry', 'overlay', 'state'],
                signal,
                ...(request.parent ? { parent: request.parent } : {}),
                metadata,
                participants: [geometryParticipant],
                mutate: async (context) => {
                    const capturedBefore = before;
                    if (!capturedBefore) {
                        throw new GeometryMutationError(request.id, 'geometry preparation did not capture the before state.');
                    }
                    await request.mutateBase(Object.freeze({ signal: context.signal, transaction: context }));
                    await this.options.state.finalizeGeometry();
                    const after = freezeGeometry(this.options.state.captureGeometry());
                    if (after.revision <= capturedBefore.revision) {
                        throw new GeometryMutationError(request.id, `geometry revision must increase (${capturedBefore.revision} -> ${after.revision}).`);
                    }
                    return createDescriptor(request, capturedBefore, after, metadata, false);
                },
                ...(request.rollbackBase
                    ? {
                        rollback: async (context) => {
                            var _a, _b, _c;
                            await ((_a = request.rollbackBase) === null || _a === void 0 ? void 0 : _a.call(request, Object.freeze({
                                signal: context.signal,
                                cause: context.cause,
                            })));
                            if (before)
                                await ((_c = (_b = this.options.state).restoreGeometry) === null || _c === void 0 ? void 0 : _c.call(_b, before));
                        },
                    }
                    : {}),
            });
        }
        catch (error) {
            const failure = this.toGeometryFailure(request.id, error);
            (_b = (_a = this.options).errorSink) === null || _b === void 0 ? void 0 : _b.call(_a, failure);
            throw failure;
        }
    }
    createParticipantContext(mutationId, signal) {
        return Object.freeze({
            signal,
            warnRecoverable: (error, objectIdentity, objectKind) => {
                this.warn({
                    code: 'GEOMETRY_OBJECT_SKIPPED',
                    message: 'An overlay transform skipped a malformed or unsupported object.',
                    mutationId,
                    ...(objectIdentity === undefined ? {} : { objectIdentity }),
                    ...(objectKind === undefined ? {} : { objectKind }),
                    cause: error,
                });
            },
        });
    }
    warnRecoverable(mutationId, participantId, error) {
        this.warn({
            code: 'GEOMETRY_OBJECT_SKIPPED',
            message: error.message,
            mutationId,
            participantId,
            ...(error.objectIdentity === undefined ? {} : { objectIdentity: error.objectIdentity }),
            ...(error.objectKind === undefined ? {} : { objectKind: error.objectKind }),
            cause: error.cause,
        });
    }
    toGeometryFailure(mutationId, error) {
        if (error instanceof DocumentMutationUnrecoverableError) {
            return new GeometryUnrecoverableError(mutationId, error.cause, error.rollbackErrors);
        }
        if (error instanceof DocumentMutationError) {
            return new GeometryMutationError(mutationId, error.cause instanceof Error ? error.cause.message : error.message, error.cause, error.rollbackErrors);
        }
        if (error instanceof GeometryMutationError)
            return error;
        return new GeometryMutationError(mutationId, error instanceof Error ? error.message : 'unknown failure.', error);
    }
    validateRequest(request) {
        var _a, _b;
        assertIdentifier(request.id, 'Mutation id');
        assertIdentifier(request.kind, 'Mutation kind');
        assertIdentifier(request.operationId, 'Operation id');
        if (this.usedMutationIds.has(request.id)) {
            throw new GeometryMutationError(request.id, 'mutation id has already been used.');
        }
        if (typeof request.mutateBase !== 'function') {
            throw new GeometryMutationError(request.id, 'mutateBase must be a function.');
        }
        let clonedMetadata;
        let serializedMetadata;
        try {
            clonedMetadata = cloneStateValue((_a = request.metadata) !== null && _a !== void 0 ? _a : {});
            serializedMetadata = JSON.stringify(clonedMetadata);
        }
        catch (error) {
            throw new GeometryMutationError(request.id, 'metadata must be safely JSON-serializable.', error);
        }
        const maxMetadataBytes = (_b = this.options.maxMetadataBytes) !== null && _b !== void 0 ? _b : 64 * 1024;
        if (new TextEncoder().encode(serializedMetadata).byteLength > maxMetadataBytes) {
            throw new GeometryMutationError(request.id, `metadata exceeds ${maxMetadataBytes} bytes.`);
        }
        this.usedMutationIds.add(request.id);
        return clonedMetadata;
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