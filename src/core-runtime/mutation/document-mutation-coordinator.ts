/**
 * Runs atomic document mutations with participant ordering, rollback, History, and committed events.
 *
 * @module
 */

import type { Disposable } from '../../plugin-kernel/disposable.js';
import type { OperationToken } from '../../plugin-kernel/operation-registry.js';
import {
    DocumentMutationError,
    DocumentMutationInvariantError,
    DocumentMutationRegistrationError,
    DocumentMutationUnrecoverableError,
} from '../errors.js';
import { cloneStateValue } from '../state/clone-state-value.js';
import type { CoreMemento } from '../state/state-types.js';
import type {
    DocumentMutationContext,
    DocumentMutationCoordinatorOptions,
    DocumentMutationDescriptor,
    DocumentMutationDiagnostic,
    DocumentMutationParticipant,
    DocumentMutationPort,
    DocumentMutationRequest,
    DocumentMutationRollbackContext,
} from './mutation-types.js';

interface NormalizedRequest<TResult> extends DocumentMutationRequest<TResult> {
    readonly participants: readonly DocumentMutationParticipant<TResult>[];
    readonly metadata: Readonly<Record<string, unknown>>;
}

interface RollbackEntry {
    readonly run: (cause: unknown, signal: AbortSignal) => Promise<void>;
    enabled: boolean;
}

interface TransactionSession {
    readonly before: CoreMemento;
    readonly rollbackEntries: RollbackEntry[];
    readonly validators: Array<() => Promise<void>>;
    readonly diagnostics: DocumentMutationDiagnostic[];
    failure: unknown | null;
    closed: boolean;
}

interface ContextRecord {
    readonly session: TransactionSession;
    readonly operationToken: OperationToken;
}

const DEFAULT_ROLLBACK_TIMEOUT_MS = 30_000;

function isCancellation(error: unknown): boolean {
    return (
        typeof error === 'object' &&
        error !== null &&
        'name' in error &&
        error.name === 'AbortError'
    );
}

function assertIdentifier(value: string, label: string): void {
    if (value.trim().length === 0 || value.trim() !== value) {
        throw new DocumentMutationRegistrationError(`${label} must be non-empty and trimmed.`);
    }
}

function immutableMetadata(
    value: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> {
    const cloned = cloneStateValue(value ?? {});
    if (typeof cloned !== 'object' || cloned === null || Array.isArray(cloned)) {
        throw new DocumentMutationRegistrationError('Mutation metadata must be an object.');
    }
    return Object.freeze(cloned as Record<string, unknown>);
}

export class DocumentMutationCoordinator implements DocumentMutationPort, Disposable {
    private readonly usedTransactionIds = new Set<string>();
    private readonly contextRecords = new WeakMap<DocumentMutationContext, ContextRecord>();
    private readonly activeControllers = new Set<AbortController>();
    private readonly activePromises = new Set<Promise<unknown>>();
    private disposed = false;

    constructor(private readonly options: DocumentMutationCoordinatorOptions) {
        const rollbackTimeoutMs = options.rollbackTimeoutMs ?? DEFAULT_ROLLBACK_TIMEOUT_MS;
        if (!Number.isSafeInteger(rollbackTimeoutMs) || rollbackTimeoutMs <= 0) {
            throw new DocumentMutationRegistrationError(
                'rollbackTimeoutMs must be a positive safe integer.',
            );
        }
    }

    get isRunning(): boolean {
        return this.activePromises.size > 0;
    }

    assertContextActive(context: DocumentMutationContext): void {
        const record = this.contextRecords.get(context);
        if (!record || record.session.closed || context.signal.aborted) {
            throw new DocumentMutationInvariantError(
                context.transactionId,
                new Error('The document mutation context is not active.'),
            );
        }
    }

    run<TResult>(request: DocumentMutationRequest<TResult>): Promise<TResult> {
        let normalized: NormalizedRequest<TResult>;
        let parentRecord: ContextRecord | null;
        try {
            this.assertActive('run a document mutation');
            this.options.state.assertOperational?.('run a document mutation');
            normalized = this.normalizeRequest(request);
            parentRecord = normalized.parent ? this.requireParent(normalized.parent) : null;
        } catch (error) {
            return Promise.reject(error);
        }

        const controller = new AbortController();
        const abort = (): void => controller.abort(normalized.signal?.reason);
        if (normalized.signal?.aborted) abort();
        else normalized.signal?.addEventListener('abort', abort, { once: true });
        this.activeControllers.add(controller);

        const operation = this.options.operations.run<TResult>(
            normalized.operationId,
            (operationContext) =>
                parentRecord
                    ? this.performNested(normalized, operationContext.token, parentRecord)
                    : this.performTopLevel(normalized, operationContext.token),
            {
                signal: controller.signal,
                ...(parentRecord ? { parent: parentRecord.operationToken } : {}),
            },
        );
        this.activePromises.add(operation);
        return operation.finally(() => {
            normalized.signal?.removeEventListener('abort', abort);
            this.activeControllers.delete(controller);
            this.activePromises.delete(operation);
        });
    }

    async dispose(): Promise<void> {
        if (this.disposed) return;
        this.disposed = true;
        const reason = new DOMException(
            'Document Mutation Coordinator was disposed.',
            'AbortError',
        );
        for (const controller of this.activeControllers) controller.abort(reason);
        await Promise.allSettled([...this.activePromises]);
        this.activeControllers.clear();
        this.usedTransactionIds.clear();
    }

    async abortActive(reason: unknown): Promise<void> {
        this.assertActive('abort document mutations');
        for (const controller of this.activeControllers) controller.abort(reason);
        await Promise.allSettled([...this.activePromises]);
    }

    reset(): void {
        this.assertActive('reset document mutations');
        if (this.activePromises.size > 0) {
            throw new DocumentMutationRegistrationError(
                'Cannot reset while a document mutation is active.',
            );
        }
        this.usedTransactionIds.clear();
    }

    disposeSync(): void {
        if (this.disposed) return;
        if (this.activePromises.size > 0) {
            throw new DocumentMutationRegistrationError(
                'Cannot synchronously dispose an active document mutation.',
            );
        }
        this.disposed = true;
        this.usedTransactionIds.clear();
    }

    private async performTopLevel<TResult>(
        request: NormalizedRequest<TResult>,
        operationToken: OperationToken,
    ): Promise<TResult> {
        const before = this.options.mementos.capture();
        const session: TransactionSession = {
            before,
            rollbackEntries: [],
            validators: [],
            diagnostics: [],
            failure: null,
            closed: false,
        };
        const context = this.createContext(request, operationToken, session, null);
        let result: TResult;
        let committedResult: unknown;
        try {
            result = await this.executeRequest(request, context, session);
            if (session.failure) throw session.failure;
            this.throwIfUnavailable(context.signal, request.id);
            this.options.state.requestRender();
            for (const validate of session.validators) {
                this.throwIfUnavailable(context.signal, request.id);
                try {
                    await validate();
                } catch (error) {
                    throw new DocumentMutationInvariantError(request.id, error);
                }
            }
            this.throwIfUnavailable(context.signal, request.id);
            committedResult = request.describeCommit
                ? await request.describeCommit(result, context)
                : result;
            this.throwIfUnavailable(context.signal, request.id);
        } catch (error) {
            session.closed = true;
            throw await this.restoreAfterFailure(request.id, session, error);
        }

        let descriptor: DocumentMutationDescriptor;
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
                await this.options.history.commit(
                    Object.freeze({
                        operationId: request.operationId,
                        before,
                        after,
                        timestamp: descriptor.committedAt,
                        detail: descriptor,
                    }),
                );
            }
        } catch (error) {
            session.closed = true;
            throw await this.restoreAfterFailure(request.id, session, error);
        }

        session.closed = true;
        try {
            await this.options.events.emitCommitted(descriptor);
        } catch (error) {
            this.warn({
                code: 'DOCUMENT_COMMITTED_OBSERVER_FAILED',
                message: 'A committed document observer failed after the transaction committed.',
                transactionId: request.id,
                cause: error,
            });
        }
        return result;
    }

    private async performNested<TResult>(
        request: NormalizedRequest<TResult>,
        operationToken: OperationToken,
        parentRecord: ContextRecord,
    ): Promise<TResult> {
        const parent = request.parent;
        if (!parent) {
            throw new DocumentMutationRegistrationError('Nested mutation requires a parent.');
        }
        const context = this.createContext(request, operationToken, parentRecord.session, parent);
        try {
            return await this.executeRequest(request, context, parentRecord.session);
        } catch (error) {
            parentRecord.session.failure ??= error;
            throw error;
        }
    }

    private async executeRequest<TResult>(
        request: NormalizedRequest<TResult>,
        context: DocumentMutationContext,
        session: TransactionSession,
    ): Promise<TResult> {
        const outcome: { result: TResult | undefined } = { result: undefined };
        const requestRollback: RollbackEntry | null = request.rollback
            ? {
                  enabled: false,
                  run: async (cause, signal) => {
                      const rollbackContext = this.createRollbackContext(
                          context,
                          cause,
                          outcome.result,
                          signal,
                      );
                      await request.rollback?.(rollbackContext);
                  },
              }
            : null;
        if (requestRollback) session.rollbackEntries.push(requestRollback);

        const prepared: Array<{
            readonly participant: DocumentMutationParticipant<TResult>;
            readonly value: unknown;
        }> = [];
        for (const participant of request.participants) {
            this.throwIfUnavailable(context.signal, request.id);
            const preparedValue = participant.prepare
                ? await participant.prepare(context)
                : undefined;
            prepared.push({ participant, value: preparedValue });
            if (participant.rollback) {
                session.rollbackEntries.push({
                    enabled: true,
                    run: async (cause, signal) => {
                        const rollbackContext = this.createRollbackContext(
                            context,
                            cause,
                            outcome.result,
                            signal,
                        );
                        await participant.rollback?.(preparedValue, rollbackContext);
                    },
                });
            }
        }

        this.throwIfUnavailable(context.signal, request.id);
        if (requestRollback) requestRollback.enabled = true;
        const result = await request.mutate(context);
        outcome.result = result;
        this.throwIfUnavailable(context.signal, request.id);
        for (const entry of prepared) {
            await entry.participant.apply?.(result, entry.value, context);
            this.throwIfUnavailable(context.signal, request.id);
        }
        for (const entry of prepared) {
            await entry.participant.synchronize?.(result, entry.value, context);
            this.throwIfUnavailable(context.signal, request.id);
        }
        await request.synchronize?.(result, context);
        this.throwIfUnavailable(context.signal, request.id);
        if (request.validate) {
            session.validators.push(async () => request.validate?.(result as TResult, context));
        }
        return result;
    }

    private createContext<TResult>(
        request: NormalizedRequest<TResult>,
        operationToken: OperationToken,
        session: TransactionSession,
        parent: DocumentMutationContext | null,
    ): DocumentMutationContext {
        const participantIds = Object.freeze(request.participants.map(({ id }) => id));
        const context: DocumentMutationContext = Object.freeze({
            transactionId: request.id,
            parentTransactionId: parent?.transactionId ?? null,
            operationId: request.operationId,
            conflictDomains: request.conflictDomains,
            historyOwner: parent ? 'parent' : 'self',
            eventOwner: parent ? 'parent' : 'self',
            signal: operationToken.signal,
            participantIds,
            metadata: request.metadata,
        });
        this.contextRecords.set(context, { session, operationToken });
        session.diagnostics.push(
            Object.freeze({
                transactionId: request.id,
                parentTransactionId: parent?.transactionId ?? null,
                participantIds,
                metadata: request.metadata,
            }),
        );
        return context;
    }

    private createRollbackContext<TResult>(
        context: DocumentMutationContext,
        cause: unknown,
        result: TResult | undefined,
        signal: AbortSignal,
    ): DocumentMutationRollbackContext<TResult> {
        return Object.freeze({
            ...context,
            signal,
            cause,
            result,
        });
    }

    private async restoreAfterFailure(
        transactionId: string,
        session: TransactionSession,
        cause: unknown,
    ): Promise<unknown> {
        const rollbackErrors: unknown[] = [];
        const rollbackTimeoutMs = this.options.rollbackTimeoutMs ?? DEFAULT_ROLLBACK_TIMEOUT_MS;
        const rollbackController = new AbortController();
        const timeoutError = new Error(
            `Document mutation rollback timed out after ${rollbackTimeoutMs}ms.`,
        );
        timeoutError.name = 'TimeoutError';
        const timeout = setTimeout(() => rollbackController.abort(timeoutError), rollbackTimeoutMs);
        const runRollbackTask = async (task: () => Promise<void>): Promise<void> => {
            if (rollbackController.signal.aborted) {
                throw rollbackController.signal.reason ?? timeoutError;
            }
            let removeAbortListener = (): void => undefined;
            const aborted = new Promise<never>((resolve, reject) => {
                void resolve;
                const abort = (): void => reject(rollbackController.signal.reason ?? timeoutError);
                removeAbortListener = () =>
                    rollbackController.signal.removeEventListener('abort', abort);
                rollbackController.signal.addEventListener('abort', abort, { once: true });
            });
            try {
                await Promise.race([task(), aborted]);
            } finally {
                removeAbortListener();
            }
        };

        try {
            for (let index = session.rollbackEntries.length - 1; index >= 0; index -= 1) {
                const entry = session.rollbackEntries[index];
                if (!entry?.enabled) continue;
                try {
                    await runRollbackTask(() => entry.run(cause, rollbackController.signal));
                } catch (error) {
                    rollbackErrors.push(error);
                }
            }

            let targetedStateMatches = false;
            const targetedRollbackRan = session.rollbackEntries.some((entry) => entry.enabled);
            if (
                targetedRollbackRan &&
                rollbackErrors.length === 0 &&
                this.options.mementos.matches
            ) {
                try {
                    targetedStateMatches = await this.options.mementos.matches(session.before);
                } catch (error) {
                    rollbackErrors.push(error);
                }
            }
            if (!targetedStateMatches) {
                try {
                    await runRollbackTask(() =>
                        this.options.mementos.restore(session.before, {
                            rollbackOnFailure: false,
                            signal: rollbackController.signal,
                        }),
                    );
                } catch (restoreError) {
                    rollbackErrors.push(restoreError);
                    const failure = new DocumentMutationUnrecoverableError(
                        transactionId,
                        cause,
                        Object.freeze(rollbackErrors),
                    );
                    this.options.faultSink?.(failure);
                    this.options.errorSink?.(failure);
                    return failure;
                }
            }
            if (!this.options.state.isDisposed()) {
                try {
                    this.options.state.requestRender();
                } catch (error) {
                    rollbackErrors.push(error);
                }
            }
        } finally {
            clearTimeout(timeout);
        }
        if (isCancellation(cause)) return cause;
        const failure =
            cause instanceof DocumentMutationError
                ? cause
                : new DocumentMutationError(
                      transactionId,
                      cause instanceof Error ? cause.message : 'unknown failure.',
                      cause,
                      Object.freeze(rollbackErrors),
                  );
        this.options.errorSink?.(failure);
        return failure;
    }

    private normalizeRequest<TResult>(
        request: DocumentMutationRequest<TResult>,
    ): NormalizedRequest<TResult> {
        assertIdentifier(request.id, 'Transaction id');
        assertIdentifier(request.kind, 'Mutation kind');
        assertIdentifier(request.operationId, 'Operation id');
        if (this.usedTransactionIds.has(request.id)) {
            throw new DocumentMutationRegistrationError(
                `Transaction id "${request.id}" has already been used.`,
                request.id,
            );
        }
        if (!this.options.operations.has(request.operationId)) {
            throw new DocumentMutationRegistrationError(
                `Operation "${request.operationId}" is not registered.`,
                request.id,
            );
        }
        const operation = this.options.operations.get(request.operationId);
        if (!operation) {
            throw new DocumentMutationRegistrationError(
                `Operation "${request.operationId}" is unavailable.`,
                request.id,
            );
        }
        if (
            !Array.isArray(request.conflictDomains) ||
            request.conflictDomains.length === 0 ||
            request.conflictDomains.some((domain) => !operation.conflictDomains.includes(domain))
        ) {
            throw new DocumentMutationRegistrationError(
                'Mutation conflict domains must be covered by its registered operation.',
                request.id,
            );
        }
        if (typeof request.mutate !== 'function') {
            throw new DocumentMutationRegistrationError(
                'Mutation request must define mutate().',
                request.id,
            );
        }
        const participants = [...(request.participants ?? [])];
        const participantIds = new Set<string>();
        for (const participant of participants) {
            assertIdentifier(participant.id, 'Participant id');
            if (!Number.isFinite(participant.order)) {
                throw new DocumentMutationRegistrationError(
                    `Participant "${participant.id}" must use a finite order.`,
                    request.id,
                );
            }
            if (participantIds.has(participant.id)) {
                throw new DocumentMutationRegistrationError(
                    `Participant "${participant.id}" is duplicated.`,
                    request.id,
                );
            }
            participantIds.add(participant.id);
        }
        participants.sort((left, right) => left.order - right.order);
        let metadata: Readonly<Record<string, unknown>>;
        let serializedMetadata: string;
        try {
            metadata = immutableMetadata(request.metadata);
            serializedMetadata = JSON.stringify(metadata);
        } catch (error) {
            if (error instanceof DocumentMutationRegistrationError) throw error;
            throw new DocumentMutationRegistrationError(
                'Mutation metadata must be safely JSON-serializable.',
                request.id,
            );
        }
        const maxMetadataBytes = this.options.maxMetadataBytes ?? 64 * 1024;
        if (new TextEncoder().encode(serializedMetadata).byteLength > maxMetadataBytes) {
            throw new DocumentMutationRegistrationError(
                `Mutation metadata exceeds ${maxMetadataBytes} bytes.`,
                request.id,
            );
        }
        this.usedTransactionIds.add(request.id);
        return Object.freeze({
            ...request,
            conflictDomains: Object.freeze([...request.conflictDomains]),
            participants: Object.freeze(participants),
            metadata,
        });
    }

    private requireParent(parent: DocumentMutationContext): ContextRecord {
        const record = this.contextRecords.get(parent);
        if (!record || record.session.closed || parent.signal.aborted) {
            throw new DocumentMutationRegistrationError(
                `Parent transaction "${parent.transactionId}" is not active.`,
                parent.transactionId,
            );
        }
        return record;
    }

    private throwIfUnavailable(signal: AbortSignal, transactionId: string): void {
        if (signal.aborted) {
            throw signal.reason ?? new DOMException('Document mutation was aborted.', 'AbortError');
        }
        if (this.options.state.isDisposed()) {
            throw new DocumentMutationError(transactionId, 'Core state is disposed.');
        }
    }

    private warn(warning: Parameters<NonNullable<typeof this.options.warningSink>>[0]): void {
        try {
            this.options.warningSink?.(Object.freeze(warning));
        } catch (error) {
            this.options.errorSink?.(error);
        }
    }

    private assertActive(operation: string): void {
        if (this.disposed) {
            throw new DocumentMutationRegistrationError(
                `Cannot ${operation} after coordinator disposal.`,
            );
        }
    }
}
