/**
 * Registers operations and coordinates conflict, cancellation, and reentrancy policy.
 *
 * @module
 */

import { createDisposable, type Disposable, type MaybePromise } from './disposable.js';
import {
    OperationConflictError,
    OperationRegistrationError,
    PluginKernelDisposedError,
} from './errors.js';
import { isRuntimeIdentifier } from './runtime-identifier.js';

export type OperationId = string;
export type OperationMode = 'read' | 'busy' | 'animation' | 'mutation';
export type OperationConflictDomain =
    | 'document'
    | 'base-image'
    | 'geometry'
    | 'raster'
    | 'overlay'
    | 'selection'
    | 'tool'
    | 'export'
    | 'state'
    | 'image-decode';
export type OperationReentrancy = 'reject' | 'queue' | 'replace' | 'coalesce';

export interface OperationDefinition<TArgs = unknown> {
    readonly id: OperationId;
    readonly mode: OperationMode;
    readonly conflictDomains: readonly OperationConflictDomain[];
    readonly reentrancy: OperationReentrancy;
    readonly allowedDuringTool?: readonly string[];
    coalesce?(previous: TArgs, next: TArgs): TArgs;
}

export interface OperationToken extends Disposable {
    readonly id: OperationId;
    readonly ownerPluginId: string;
    readonly parentId: OperationId | null;
    readonly topLevel: boolean;
    readonly ownsHistory: boolean;
    readonly signal: AbortSignal;
    readonly active: boolean;
}

export interface OperationExecutionContext {
    readonly signal: AbortSignal;
    readonly token: OperationToken;
    readonly topLevel: boolean;
    readonly ownsHistory: boolean;
}

export interface OperationRunOptions {
    readonly parent?: OperationToken;
    readonly signal?: AbortSignal;
}

interface RegisteredOperation {
    readonly definition: OperationDefinition<unknown>;
    readonly ownerPluginId: string;
}

interface OperationWaiter<TResult = unknown> {
    readonly resolve: (value: TResult) => void;
    readonly reject: (error: unknown) => void;
}

interface ActiveOperation {
    readonly record: RegisteredOperation;
    readonly controller: AbortController;
    readonly token: OperationToken;
    readonly deactivate: () => void;
    request: ScheduledOperation | null;
}

interface ScheduledOperation<TArgs = unknown, TResult = unknown> {
    readonly record: RegisteredOperation;
    args: TArgs;
    readonly task: (args: TArgs, context: OperationExecutionContext) => MaybePromise<TResult>;
    readonly options: OperationRunOptions;
    readonly waiters: OperationWaiter<TResult>[];
    active: ActiveOperation | null;
    state: 'pending' | 'active' | 'retired' | 'settled';
    removeExternalAbortListener: (() => void) | null;
}

const OPERATION_MODES: readonly OperationMode[] = ['read', 'busy', 'animation', 'mutation'];
const REENTRANCY_POLICIES: readonly OperationReentrancy[] = [
    'reject',
    'queue',
    'replace',
    'coalesce',
];
const CONFLICT_DOMAINS: readonly OperationConflictDomain[] = [
    'document',
    'base-image',
    'geometry',
    'raster',
    'overlay',
    'selection',
    'tool',
    'export',
    'state',
    'image-decode',
];

function abortError(message: string): DOMException {
    return new DOMException(message, 'AbortError');
}

function abortReason(signal: AbortSignal, fallback: string): unknown {
    return signal.reason ?? abortError(fallback);
}

function domainsOverlap(
    first: readonly OperationConflictDomain[],
    second: readonly OperationConflictDomain[],
): boolean {
    return first.some((domain) => second.includes(domain));
}

function definitionsConflict(first: OperationDefinition, second: OperationDefinition): boolean {
    if (first.mode === 'read' && second.mode === 'read') return false;
    return domainsOverlap(first.conflictDomains, second.conflictDomains);
}

export class OperationRegistry implements Disposable {
    private readonly operations = new Map<OperationId, RegisteredOperation>();
    private readonly activeOperations = new Set<ActiveOperation>();
    private readonly executingRequests = new Set<Promise<void>>();
    private readonly idleWaiters = new Set<() => void>();
    private pendingRequests: ScheduledOperation[] = [];
    private suspendedReason: unknown | null = null;
    private disposed = false;

    register<TArgs>(definition: OperationDefinition<TArgs>, ownerPluginId: string): Disposable {
        this.assertActive('register an operation');
        this.validateDefinition(definition, ownerPluginId);
        const existing = this.operations.get(definition.id);
        if (existing) {
            throw new OperationRegistrationError(
                `Operation "${definition.id}" is already registered by "${existing.ownerPluginId}".`,
                ownerPluginId,
            );
        }
        const frozenDefinition: OperationDefinition<unknown> = Object.freeze({
            ...definition,
            conflictDomains: Object.freeze([...definition.conflictDomains]),
            allowedDuringTool: definition.allowedDuringTool
                ? Object.freeze([...definition.allowedDuringTool])
                : undefined,
        }) as OperationDefinition<unknown>;
        const record = { definition: frozenDefinition, ownerPluginId };
        this.operations.set(definition.id, record);
        return createDisposable(() => {
            if (this.operations.get(definition.id) !== record) return;
            const reason = abortError(`Operation "${definition.id}" was unregistered.`);
            for (const active of [...this.activeOperations]) {
                if (active.record === record) this.retireActive(active, reason);
            }
            this.rejectPending((request) => request.record === record, reason);
            this.operations.delete(definition.id);
            this.drainPending();
        });
    }

    begin(operationId: OperationId, ownerPluginId: string): OperationToken {
        this.assertActive('begin an operation');
        if (this.suspendedReason !== null) throw this.suspendedReason;
        const record = this.requireOwned(operationId, ownerPluginId);
        const conflicts = this.findConflicts(record, undefined);
        if (conflicts.length > 0) {
            throw this.conflictError(record, conflicts[0]!.record, ownerPluginId);
        }
        const active = this.createActive(record, undefined, null);
        this.activeOperations.add(active);
        return active.token;
    }

    run<TArgs, TResult>(
        operationId: OperationId,
        ownerPluginId: string,
        args: TArgs,
        task: (args: TArgs, context: OperationExecutionContext) => MaybePromise<TResult>,
        options: OperationRunOptions = {},
    ): Promise<TResult> {
        this.assertActive('run an operation');
        if (this.suspendedReason !== null) return Promise.reject(this.suspendedReason);
        const record = this.requireOwned(operationId, ownerPluginId);
        this.validateParent(options.parent);
        if (options.signal?.aborted) {
            return Promise.reject(
                abortReason(options.signal, `Operation "${operationId}" was aborted.`),
            );
        }

        const existingPending = this.findCoalesciblePending(record, options.parent);
        if (record.definition.reentrancy === 'coalesce' && existingPending) {
            const coalesce = record.definition.coalesce;
            if (!coalesce) {
                return Promise.reject(
                    new OperationRegistrationError(
                        `Operation "${operationId}" has no coalesce function.`,
                        ownerPluginId,
                    ),
                );
            }
            existingPending.args = coalesce(existingPending.args, args) as unknown;
            return new Promise<TResult>((resolve, reject) => {
                existingPending.waiters.push({ resolve, reject } as OperationWaiter<unknown>);
            });
        }

        const request: ScheduledOperation<TArgs, TResult> = {
            record,
            args,
            task,
            options,
            waiters: [],
            active: null,
            state: 'pending',
            removeExternalAbortListener: null,
        };
        const result = new Promise<TResult>((resolve, reject) => {
            request.waiters.push({ resolve, reject });
        });
        this.attachExternalAbort(request as ScheduledOperation);
        this.schedule(request as ScheduledOperation);
        return result;
    }

    /** @internal Acquires a registered operation on behalf of a Core coordinator. */
    beginForHost(operationId: OperationId): OperationToken {
        this.assertActive('begin an operation');
        const registered = this.requireRegistered(operationId, 'core:host');
        return this.begin(operationId, registered.ownerPluginId);
    }

    /** @internal Runs a registered operation on behalf of a Core coordinator. */
    runForHost<TArgs, TResult>(
        operationId: OperationId,
        args: TArgs,
        task: (args: TArgs, context: OperationExecutionContext) => MaybePromise<TResult>,
        options: OperationRunOptions = {},
    ): Promise<TResult> {
        const registered = this.requireRegistered(operationId, 'core:host');
        return this.run(operationId, registered.ownerPluginId, args, task, options);
    }

    has(operationId: OperationId): boolean {
        this.assertActive('inspect an operation');
        return this.operations.has(operationId);
    }

    get(operationId: OperationId): OperationDefinition | null {
        this.assertActive('inspect an operation');
        return this.operations.get(operationId)?.definition ?? null;
    }

    isActive(operationId?: OperationId): boolean {
        this.assertActive('inspect operation state');
        if (!operationId) return this.activeOperations.size > 0;
        return [...this.activeOperations].some(
            (active) => active.record.definition.id === operationId,
        );
    }

    waitForIdle(): Promise<void> {
        if (this.isIdle()) return Promise.resolve();
        return new Promise<void>((resolve) => this.idleWaiters.add(resolve));
    }

    /** @internal Aborts all scheduled work while preserving operation registrations. */
    async abortAll(
        reason: unknown = abortError('All Plugin Kernel operations were aborted.'),
    ): Promise<void> {
        this.assertActive('abort operations');
        this.rejectPending(() => true, reason);
        for (const active of [...this.activeOperations]) {
            if (active.request) this.abortActive(active, reason);
            else this.retireActive(active, reason);
        }
        await Promise.allSettled([...this.executingRequests]);
        this.resolveIdleWaiters();
    }

    /** @internal Rejects future work and aborts current work after a fatal Core failure. */
    suspend(reason: unknown): Promise<void> {
        this.assertActive('suspend operations');
        this.suspendedReason = reason;
        return this.abortAll(reason);
    }

    dispose(): void {
        if (this.disposed) return;
        const reason = abortError('Operation Registry was disposed.');
        this.rejectPending(() => true, reason);
        for (const active of [...this.activeOperations]) this.retireActive(active, reason);
        this.operations.clear();
        this.suspendedReason = null;
        this.disposed = true;
        this.resolveIdleWaiters();
    }

    private schedule(request: ScheduledOperation): void {
        if (request.state !== 'pending') return;
        const conflicts = this.findConflicts(request.record, request.options.parent);
        const sameOperationActive = conflicts.filter(
            (active) => active.record.definition.id === request.record.definition.id,
        );
        const policy = request.record.definition.reentrancy;

        if (policy === 'replace' && sameOperationActive.length > 0) {
            const reason = abortError(
                `Operation "${request.record.definition.id}" was replaced by a newer request.`,
            );
            for (const active of sameOperationActive) this.retireActive(active, reason);
            this.rejectPending((pending) => pending.record === request.record, reason);
        } else if (conflicts.length > 0 && policy === 'reject') {
            this.rejectRequest(
                request,
                this.conflictError(
                    request.record,
                    conflicts[0]!.record,
                    request.record.ownerPluginId,
                ),
            );
            request.removeExternalAbortListener?.();
            request.removeExternalAbortListener = null;
            request.state = 'settled';
            this.resolveIdleWaiters();
            return;
        } else if (conflicts.length > 0 && policy === 'replace') {
            this.rejectRequest(
                request,
                this.conflictError(
                    request.record,
                    conflicts[0]!.record,
                    request.record.ownerPluginId,
                ),
            );
            request.removeExternalAbortListener?.();
            request.removeExternalAbortListener = null;
            request.state = 'settled';
            this.resolveIdleWaiters();
            return;
        }

        if (this.findConflicts(request.record, request.options.parent).length === 0) {
            this.startRequest(request);
        } else {
            this.pendingRequests.push(request);
        }
    }

    private startRequest(request: ScheduledOperation): void {
        if (request.state !== 'pending') return;
        const active = this.createActive(request.record, request.options.parent, request);
        request.active = active;
        request.state = 'active';
        this.activeOperations.add(active);
        const context: OperationExecutionContext = Object.freeze({
            signal: active.controller.signal,
            token: active.token,
            topLevel: active.token.topLevel,
            ownsHistory: active.token.ownsHistory,
        });
        let output: MaybePromise<unknown>;
        try {
            output = request.task(request.args, context);
        } catch (error) {
            output = Promise.reject(error);
        }
        const execution = Promise.resolve(output).then(
            (value) => ({ status: 'fulfilled' as const, value }),
            (error: unknown) => ({ status: 'rejected' as const, error }),
        );
        const tracked = execution
            .then((outcome) => {
                // Release the conflict authority before settling callers so an awaited
                // operation is fully complete when its public Promise resolves.
                this.finishRequest(request);
                if (outcome.status === 'rejected') {
                    this.rejectRequest(request, outcome.error);
                } else if (active.controller.signal.aborted) {
                    this.rejectRequest(
                        request,
                        abortReason(
                            active.controller.signal,
                            `Operation "${active.token.id}" was aborted.`,
                        ),
                    );
                } else {
                    this.resolveRequest(request, outcome.value);
                }
            })
            .finally(() => {
                this.executingRequests.delete(tracked);
                this.resolveIdleWaiters();
            });
        this.executingRequests.add(tracked);
        void tracked.catch(() => undefined);
    }

    private finishRequest(request: ScheduledOperation): void {
        const active = request.active;
        if (active) {
            this.activeOperations.delete(active);
            active.deactivate();
        }
        request.removeExternalAbortListener?.();
        request.removeExternalAbortListener = null;
        request.state = 'settled';
        this.drainPending();
        this.resolveIdleWaiters();
    }

    private drainPending(): void {
        if (this.disposed) return;
        let started = true;
        while (started) {
            started = false;
            for (let index = 0; index < this.pendingRequests.length; index += 1) {
                const request = this.pendingRequests[index]!;
                if (this.findConflicts(request.record, request.options.parent).length > 0) continue;
                this.pendingRequests.splice(index, 1);
                this.startRequest(request);
                started = true;
                break;
            }
        }
    }

    private createActive(
        record: RegisteredOperation,
        parent: OperationToken | undefined,
        request: ScheduledOperation | null,
    ): ActiveOperation {
        const controller = new AbortController();
        let active = true;
        const activeReference: { current: ActiveOperation | null } = { current: null };
        const token: OperationToken = Object.freeze({
            id: record.definition.id,
            ownerPluginId: record.ownerPluginId,
            parentId: parent?.id ?? null,
            topLevel: parent === undefined,
            ownsHistory: parent === undefined,
            signal: controller.signal,
            get active() {
                return active;
            },
            dispose: () => {
                const entry = activeReference.current;
                if (!active || !entry) return;
                this.retireActive(
                    entry,
                    abortError(`Operation "${record.definition.id}" was cancelled.`),
                );
                this.drainPending();
                this.resolveIdleWaiters();
            },
        });
        const entry: ActiveOperation = {
            record,
            controller,
            token,
            deactivate: () => {
                active = false;
            },
            request,
        };
        activeReference.current = entry;
        return entry;
    }

    private retireActive(active: ActiveOperation, reason: unknown): void {
        if (!active.token.active) return;
        this.activeOperations.delete(active);
        active.deactivate();
        active.controller.abort(reason);
        if (active.request && active.request.state === 'active') {
            active.request.state = 'retired';
        }
    }

    private abortActive(active: ActiveOperation, reason: unknown): void {
        if (!active.token.active || active.controller.signal.aborted) return;
        active.controller.abort(reason);
    }

    private findConflicts(
        record: RegisteredOperation,
        parent: OperationToken | undefined,
    ): ActiveOperation[] {
        return [...this.activeOperations].filter((active) => {
            if (parent && active.token === parent) return false;
            return definitionsConflict(record.definition, active.record.definition);
        });
    }

    private findCoalesciblePending(
        record: RegisteredOperation,
        parent: OperationToken | undefined,
    ): ScheduledOperation | undefined {
        return this.pendingRequests.find(
            (request) => request.record === record && request.options.parent === parent,
        );
    }

    private attachExternalAbort(request: ScheduledOperation): void {
        const signals = [
            ...new Set([request.options.signal, request.options.parent?.signal]),
        ].filter((signal): signal is AbortSignal => signal !== undefined);
        if (signals.length === 0) return;
        const abort = (): void => {
            const signal = signals.find((candidate) => candidate.aborted);
            const reason = signal
                ? abortReason(signal, `Operation "${request.record.definition.id}" was aborted.`)
                : abortError(`Operation "${request.record.definition.id}" was aborted.`);
            if (request.state === 'pending') {
                this.pendingRequests = this.pendingRequests.filter((entry) => entry !== request);
                this.rejectRequest(request, reason);
                request.state = 'settled';
            } else if (request.active) {
                // Keep the authority active until task cleanup settles so queued mutations
                // cannot overlap an in-flight rollback.
                this.abortActive(request.active, reason);
            }
            this.drainPending();
            this.resolveIdleWaiters();
        };
        for (const signal of signals) signal.addEventListener('abort', abort, { once: true });
        request.removeExternalAbortListener = () => {
            for (const signal of signals) signal.removeEventListener('abort', abort);
        };
        if (signals.some((signal) => signal.aborted)) abort();
    }

    private rejectPending(
        predicate: (request: ScheduledOperation) => boolean,
        reason: unknown,
    ): void {
        const retained: ScheduledOperation[] = [];
        for (const request of this.pendingRequests) {
            if (!predicate(request)) {
                retained.push(request);
                continue;
            }
            this.rejectRequest(request, reason);
            request.removeExternalAbortListener?.();
            request.state = 'settled';
        }
        this.pendingRequests = retained;
        this.resolveIdleWaiters();
    }

    private resolveRequest(request: ScheduledOperation, value: unknown): void {
        for (const waiter of request.waiters) waiter.resolve(value);
        request.waiters.length = 0;
    }

    private rejectRequest(request: ScheduledOperation, error: unknown): void {
        for (const waiter of request.waiters) waiter.reject(error);
        request.waiters.length = 0;
    }

    private requireRegistered(
        operationId: OperationId,
        ownerPluginId: string,
    ): RegisteredOperation {
        this.assertActive('access an operation');
        const registered = this.operations.get(operationId);
        if (!registered) {
            throw new OperationConflictError(
                `Operation "${operationId}" is not registered.`,
                ownerPluginId,
            );
        }
        return registered;
    }

    private requireOwned(operationId: OperationId, ownerPluginId: string): RegisteredOperation {
        const registered = this.requireRegistered(operationId, ownerPluginId);
        if (registered.ownerPluginId !== ownerPluginId) {
            throw new OperationConflictError(
                `Operation "${operationId}" belongs to "${registered.ownerPluginId}", not "${ownerPluginId}".`,
                ownerPluginId,
            );
        }
        return registered;
    }

    private validateParent(parent: OperationToken | undefined): void {
        if (!parent) return;
        if (
            !parent.active ||
            parent.signal.aborted ||
            ![...this.activeOperations].some((active) => active.token === parent)
        ) {
            throw new OperationConflictError(
                `Parent operation "${parent.id}" is not active.`,
                parent.ownerPluginId,
            );
        }
    }

    private validateDefinition<TArgs>(
        definition: OperationDefinition<TArgs>,
        ownerPluginId: string,
    ): void {
        if (!isRuntimeIdentifier(ownerPluginId)) {
            throw new OperationRegistrationError(
                'Operation owner Plugin id must match "namespace:kebab-case".',
                ownerPluginId,
            );
        }
        if (!isRuntimeIdentifier(definition.id)) {
            throw new OperationRegistrationError(
                'Operation id must match "namespace:kebab-case".',
                ownerPluginId,
            );
        }
        if (!OPERATION_MODES.includes(definition.mode)) {
            throw new OperationRegistrationError(
                `Operation "${definition.id}" has invalid mode "${definition.mode}".`,
                ownerPluginId,
            );
        }
        if (!REENTRANCY_POLICIES.includes(definition.reentrancy)) {
            throw new OperationRegistrationError(
                `Operation "${definition.id}" has invalid reentrancy policy.`,
                ownerPluginId,
            );
        }
        if (
            !Array.isArray(definition.conflictDomains) ||
            definition.conflictDomains.length === 0 ||
            definition.conflictDomains.some((domain) => !CONFLICT_DOMAINS.includes(domain)) ||
            new Set(definition.conflictDomains).size !== definition.conflictDomains.length
        ) {
            throw new OperationRegistrationError(
                `Operation "${definition.id}" has invalid conflict domains.`,
                ownerPluginId,
            );
        }
        if (definition.reentrancy === 'coalesce' && typeof definition.coalesce !== 'function') {
            throw new OperationRegistrationError(
                `Operation "${definition.id}" must define coalesce().`,
                ownerPluginId,
            );
        }
        if (
            definition.allowedDuringTool !== undefined &&
            (!Array.isArray(definition.allowedDuringTool) ||
                definition.allowedDuringTool.some((toolId) => !isRuntimeIdentifier(toolId)) ||
                new Set(definition.allowedDuringTool).size !== definition.allowedDuringTool.length)
        ) {
            throw new OperationRegistrationError(
                `Operation "${definition.id}" has invalid allowed Tool ids.`,
                ownerPluginId,
            );
        }
    }

    private conflictError(
        requested: RegisteredOperation,
        active: RegisteredOperation,
        ownerPluginId: string,
    ): OperationConflictError {
        return new OperationConflictError(
            `Operation "${requested.definition.id}" conflicts with active operation "${active.definition.id}" in domain(s) ${requested.definition.conflictDomains
                .filter((domain) => active.definition.conflictDomains.includes(domain))
                .join(', ')}.`,
            ownerPluginId,
        );
    }

    private isIdle(): boolean {
        return (
            this.activeOperations.size === 0 &&
            this.pendingRequests.length === 0 &&
            this.executingRequests.size === 0
        );
    }

    private resolveIdleWaiters(): void {
        if (!this.isIdle()) return;
        for (const resolve of this.idleWaiters) resolve();
        this.idleWaiters.clear();
    }

    private assertActive(operation: string): void {
        if (this.disposed) throw new PluginKernelDisposedError(operation);
    }
}
