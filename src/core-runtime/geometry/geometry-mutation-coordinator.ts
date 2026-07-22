/**
 * Coordinates Plugin geometry participants within atomic document mutations and rollback.
 *
 * @module
 */

import { createDisposable, type Disposable } from '../../plugin-kernel/disposable.js';
import { DocumentMutationError, DocumentMutationUnrecoverableError } from '../errors.js';
import type {
    DocumentMutationContext,
    DocumentMutationParticipant,
    DocumentMutationPort,
    DocumentMutationRollbackContext,
} from '../mutation/index.js';
import { cloneStateValue } from '../state/clone-state-value.js';
import {
    GeometryMutationError,
    GeometryRecoverableObjectError,
    GeometryRegistrationError,
    GeometryUnrecoverableError,
} from '../errors.js';
import {
    IDENTITY_AFFINE_MATRIX,
    computeAffineDelta,
    hasAffineReflection,
    isFiniteAffineMatrix,
} from './affine-matrix.js';
import type {
    BaseImageGeometrySnapshot,
    GeometryErrorSink,
    GeometryMutationDescriptor,
    GeometryMutationParticipant,
    GeometryMutationPort,
    GeometryMutationRequest,
    GeometryParticipantContext,
    GeometryStatePort,
    GeometryWarningSink,
} from './geometry-types.js';

interface ParticipantRecord {
    readonly participant: GeometryMutationParticipant;
    readonly registrationOrder: number;
}

interface PreparedParticipant {
    readonly record: ParticipantRecord;
    readonly prepared: unknown;
}

interface PreparedGeometryMutation {
    readonly entries: readonly PreparedParticipant[];
    readonly context: GeometryParticipantContext;
}

export interface GeometryMutationCoordinatorOptions {
    readonly mutations: DocumentMutationPort;
    readonly state: GeometryStatePort;
    readonly warningSink?: GeometryWarningSink;
    readonly errorSink?: GeometryErrorSink;
    readonly maxMetadataBytes?: number;
}

function assertIdentifier(value: string, label: string): void {
    if (value.trim().length === 0 || value.trim() !== value) {
        throw new GeometryMutationError(
            value || 'unknown',
            `${label} must be non-empty and trimmed.`,
        );
    }
}

function freezeGeometry(snapshot: BaseImageGeometrySnapshot): BaseImageGeometrySnapshot {
    if (
        !isFiniteAffineMatrix(snapshot.matrix) ||
        !Number.isFinite(snapshot.canvasWidth) ||
        !Number.isFinite(snapshot.canvasHeight) ||
        !Number.isSafeInteger(snapshot.revision) ||
        snapshot.revision < 0
    ) {
        throw new GeometryMutationError('geometry', 'captured geometry is malformed.');
    }
    return Object.freeze({
        ...snapshot,
        matrix: Object.freeze([...snapshot.matrix]) as BaseImageGeometrySnapshot['matrix'],
        boundingBox: Object.freeze({ ...snapshot.boundingBox }),
    });
}

function createDescriptor(
    request: GeometryMutationRequest,
    before: BaseImageGeometrySnapshot,
    after: BaseImageGeometrySnapshot,
    metadata: Readonly<Record<string, unknown>>,
    provisional: boolean,
): GeometryMutationDescriptor {
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

export class GeometryMutationCoordinator implements GeometryMutationPort, Disposable {
    private readonly participants = new Map<string, ParticipantRecord>();
    private readonly usedMutationIds = new Set<string>();
    private readonly activeControllers = new Set<AbortController>();
    private readonly activePromises = new Set<Promise<GeometryMutationDescriptor>>();
    private registrationCounter = 0;
    private disposed = false;

    constructor(private readonly options: GeometryMutationCoordinatorOptions) {}

    get isRunning(): boolean {
        return this.activePromises.size > 0;
    }

    registerParticipant<TPrepared>(
        participant: GeometryMutationParticipant<TPrepared>,
    ): Disposable {
        this.assertActive('register a participant');
        assertIdentifier(participant.id, 'Participant id');
        if (!Number.isFinite(participant.order)) {
            throw new GeometryRegistrationError(
                `Geometry participant "${participant.id}" must use a finite order.`,
                participant.id,
            );
        }
        if (this.participants.has(participant.id)) {
            throw new GeometryRegistrationError(
                `Geometry participant "${participant.id}" is already registered.`,
                participant.id,
            );
        }
        const record: ParticipantRecord = {
            participant: Object.freeze({ ...participant }) as GeometryMutationParticipant,
            registrationOrder: this.registrationCounter++,
        };
        this.participants.set(participant.id, record);
        return createDisposable(() => {
            if (this.participants.get(participant.id) === record) {
                this.participants.delete(participant.id);
            }
        });
    }

    run(request: GeometryMutationRequest): Promise<GeometryMutationDescriptor> {
        this.assertActive('run a geometry mutation');
        let metadata: Readonly<Record<string, unknown>>;
        try {
            metadata = this.validateRequest(request);
        } catch (error) {
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

    async dispose(): Promise<void> {
        if (this.disposed) return;
        this.disposed = true;
        for (const controller of this.activeControllers) {
            controller.abort(new DOMException('Geometry coordinator was disposed.', 'AbortError'));
        }
        await Promise.allSettled([...this.activePromises]);
        this.participants.clear();
        this.usedMutationIds.clear();
    }

    async abortActive(reason: unknown): Promise<void> {
        this.assertActive('abort geometry mutations');
        for (const controller of this.activeControllers) controller.abort(reason);
        await Promise.allSettled([...this.activePromises]);
    }

    reset(): void {
        this.assertActive('reset geometry mutations');
        if (this.activePromises.size > 0) {
            throw new GeometryRegistrationError(
                'Cannot reset while a geometry mutation is active.',
            );
        }
        this.participants.clear();
        this.usedMutationIds.clear();
        this.registrationCounter = 0;
    }

    disposeSync(): void {
        if (this.disposed) return;
        if (this.activePromises.size > 0) {
            throw new GeometryRegistrationError(
                'Cannot synchronously dispose an active geometry mutation.',
            );
        }
        this.disposed = true;
        this.participants.clear();
        this.usedMutationIds.clear();
    }

    private async performRun(
        request: GeometryMutationRequest,
        metadata: Readonly<Record<string, unknown>>,
        signal: AbortSignal,
    ): Promise<GeometryMutationDescriptor> {
        let before: BaseImageGeometrySnapshot | null = null;
        let provisional: GeometryMutationDescriptor | null = null;
        const participantSnapshot = Object.freeze(
            [...this.participants.values()].sort(
                (left, right) =>
                    left.participant.order - right.participant.order ||
                    left.registrationOrder - right.registrationOrder,
            ),
        );
        const geometryParticipant: DocumentMutationParticipant<
            GeometryMutationDescriptor,
            PreparedGeometryMutation
        > = Object.freeze({
            id: 'core:geometry-participants',
            order: 0,
            prepare: async (context: DocumentMutationContext) => {
                const capturedBefore = freezeGeometry(this.options.state.captureGeometry());
                const provisionalDescriptor = createDescriptor(
                    request,
                    capturedBefore,
                    capturedBefore,
                    metadata,
                    true,
                );
                before = capturedBefore;
                provisional = provisionalDescriptor;
                const participantContext = this.createParticipantContext(
                    request.id,
                    context.signal,
                );
                const entries: PreparedParticipant[] = [];
                for (const record of participantSnapshot) {
                    if (!record.participant.supports(provisionalDescriptor)) continue;
                    const prepared = record.participant.prepare
                        ? await record.participant.prepare(
                              provisionalDescriptor,
                              participantContext,
                          )
                        : undefined;
                    entries.push({ record, prepared });
                }
                return Object.freeze({
                    entries: Object.freeze(entries),
                    context: participantContext,
                });
            },
            apply: async (
                descriptor: GeometryMutationDescriptor,
                prepared: PreparedGeometryMutation,
            ) => {
                for (const entry of prepared.entries) {
                    try {
                        await entry.record.participant.apply(
                            descriptor,
                            entry.prepared,
                            prepared.context,
                        );
                    } catch (error) {
                        if (error instanceof GeometryRecoverableObjectError) {
                            this.warnRecoverable(request.id, entry.record.participant.id, error);
                            continue;
                        }
                        throw error;
                    }
                }
            },
            synchronize: async (
                descriptor: GeometryMutationDescriptor,
                prepared: PreparedGeometryMutation,
            ) => {
                for (const entry of prepared.entries) {
                    try {
                        await entry.record.participant.synchronize?.(descriptor, prepared.context);
                    } catch (error) {
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
            },
            rollback: participantSnapshot.some(({ participant }) => participant.rollback)
                ? async (
                      prepared: PreparedGeometryMutation,
                      rollbackContext: DocumentMutationRollbackContext<GeometryMutationDescriptor>,
                  ) => {
                      const descriptor = rollbackContext.result ?? provisional;
                      if (!descriptor) return;
                      for (let index = prepared.entries.length - 1; index >= 0; index -= 1) {
                          const entry = prepared.entries[index];
                          if (!entry) continue;
                          await entry.record.participant.rollback?.(
                              descriptor,
                              entry.prepared,
                              prepared.context,
                          );
                      }
                  }
                : undefined,
        });

        try {
            return await this.options.mutations.run({
                id: request.id,
                kind: 'geometry',
                operationId: request.operationId,
                conflictDomains: ['document', 'base-image', 'geometry', 'overlay', 'state'],
                signal,
                parent: request.parent,
                metadata,
                participants: [geometryParticipant],
                mutate: async (context) => {
                    const capturedBefore = before;
                    if (!capturedBefore) {
                        throw new GeometryMutationError(
                            request.id,
                            'geometry preparation did not capture the before state.',
                        );
                    }
                    await request.mutateBase(
                        Object.freeze({ signal: context.signal, transaction: context }),
                    );
                    await this.options.state.finalizeGeometry();
                    const after = freezeGeometry(this.options.state.captureGeometry());
                    if (after.revision <= capturedBefore.revision) {
                        throw new GeometryMutationError(
                            request.id,
                            `geometry revision must increase (${capturedBefore.revision} -> ${after.revision}).`,
                        );
                    }
                    return createDescriptor(request, capturedBefore, after, metadata, false);
                },
                rollback: request.rollbackBase
                    ? async (context) => {
                          await request.rollbackBase?.(
                              Object.freeze({ signal: context.signal, cause: context.cause }),
                          );
                          if (before) await this.options.state.restoreGeometry?.(before);
                      }
                    : undefined,
            });
        } catch (error) {
            const failure = this.toGeometryFailure(request.id, error);
            this.options.errorSink?.(failure);
            throw failure;
        }
    }

    private createParticipantContext(
        mutationId: string,
        signal: AbortSignal,
    ): GeometryParticipantContext {
        return Object.freeze({
            signal,
            warnRecoverable: (error: unknown, objectIdentity?: string, objectKind?: string) => {
                this.warn({
                    code: 'GEOMETRY_OBJECT_SKIPPED',
                    message: 'An overlay transform skipped a malformed or unsupported object.',
                    mutationId,
                    objectIdentity,
                    objectKind,
                    cause: error,
                });
            },
        });
    }

    private warnRecoverable(
        mutationId: string,
        participantId: string,
        error: GeometryRecoverableObjectError,
    ): void {
        this.warn({
            code: 'GEOMETRY_OBJECT_SKIPPED',
            message: error.message,
            mutationId,
            participantId,
            objectIdentity: error.objectIdentity,
            objectKind: error.objectKind,
            cause: error.cause,
        });
    }

    private toGeometryFailure(mutationId: string, error: unknown): Error {
        if (error instanceof DocumentMutationUnrecoverableError) {
            return new GeometryUnrecoverableError(mutationId, error.cause, error.rollbackErrors);
        }
        if (error instanceof DocumentMutationError) {
            return new GeometryMutationError(
                mutationId,
                error.cause instanceof Error ? error.cause.message : error.message,
                error.cause,
                error.rollbackErrors,
            );
        }
        if (error instanceof GeometryMutationError) return error;
        return new GeometryMutationError(
            mutationId,
            error instanceof Error ? error.message : 'unknown failure.',
            error,
        );
    }

    private validateRequest(request: GeometryMutationRequest): Readonly<Record<string, unknown>> {
        assertIdentifier(request.id, 'Mutation id');
        assertIdentifier(request.kind, 'Mutation kind');
        assertIdentifier(request.operationId, 'Operation id');
        if (this.usedMutationIds.has(request.id)) {
            throw new GeometryMutationError(request.id, 'mutation id has already been used.');
        }
        if (typeof request.mutateBase !== 'function') {
            throw new GeometryMutationError(request.id, 'mutateBase must be a function.');
        }
        let clonedMetadata: Readonly<Record<string, unknown>>;
        let serializedMetadata: string;
        try {
            clonedMetadata = cloneStateValue(request.metadata ?? {});
            serializedMetadata = JSON.stringify(clonedMetadata);
        } catch (error) {
            throw new GeometryMutationError(
                request.id,
                'metadata must be safely JSON-serializable.',
                error,
            );
        }
        const maxMetadataBytes = this.options.maxMetadataBytes ?? 64 * 1024;
        if (new TextEncoder().encode(serializedMetadata).byteLength > maxMetadataBytes) {
            throw new GeometryMutationError(
                request.id,
                `metadata exceeds ${maxMetadataBytes} bytes.`,
            );
        }
        this.usedMutationIds.add(request.id);
        return clonedMetadata;
    }

    private warn(warning: Parameters<NonNullable<GeometryWarningSink>>[0]): void {
        try {
            this.options.warningSink?.(Object.freeze(warning));
        } catch (error) {
            this.options.errorSink?.(error);
        }
    }

    private assertActive(operation: string): void {
        if (this.disposed) {
            throw new GeometryRegistrationError(`Cannot ${operation} after coordinator disposal.`);
        }
    }
}
