/**
 * Owns pointer gesture selection, lifetime invalidation, and asynchronous error isolation.
 *
 * @module
 */

import {
    observePromise,
    type CoreDiagnosticsPort,
    type Disposable,
    type PluginToolAccess,
} from '../../sdk/index.js';
import type {
    CanvasInteractionBinding,
    InteractionGestureContext,
    InteractionOperation,
} from './interaction-binding.js';
import type {
    CanvasInteractionsPluginOptions,
    InteractionCancelReason,
} from './canvas-interactions-types.js';
import type { PointerSample, PointerSourceSink } from './interaction-types.js';

interface ActiveGesture {
    readonly binding: CanvasInteractionBinding;
    readonly gesture: unknown;
    readonly epoch: number;
    readonly geometryRevision: number;
    ending: boolean;
}

function isPromiseLike(value: unknown): value is PromiseLike<void> {
    return (
        (typeof value === 'object' || typeof value === 'function') &&
        value !== null &&
        typeof (value as { then?: unknown }).then === 'function'
    );
}

export interface InteractionRuntimeStatus {
    readonly activeBindingId: string | null;
    readonly gestureActive: boolean;
}

export class InteractionRuntime implements PointerSourceSink, Disposable {
    private readonly toolSubscription: Disposable;
    private activeToolId: string | null = null;
    private activeGesture: ActiveGesture | null = null;
    private epoch = 0;
    private lifecycleEpoch = 0;
    private disposed = false;

    constructor(
        private readonly bindings: readonly CanvasInteractionBinding[],
        tools: PluginToolAccess,
        private readonly diagnostics: CoreDiagnosticsPort,
        private readonly options: Pick<CanvasInteractionsPluginOptions, 'onInteractionError'>,
        private readonly onStatusChange: () => void,
    ) {
        this.assertUniqueBindings();
        this.activeToolId = tools.getActiveToolId();
        this.toolSubscription = tools.subscribe(
            ({ activeToolId }) => {
                this.activeToolId = activeToolId;
                const owner = this.activeGesture;
                if (owner && owner.binding.toolId !== activeToolId) {
                    this.invalidateLocal('tool-change');
                } else {
                    this.onStatusChange();
                }
            },
            { emitCurrent: false },
        );
    }

    down(sample: PointerSample): void {
        if (this.disposed || this.activeGesture || !this.activeToolId) return;
        const binding = this.bindings.find((candidate) => candidate.toolId === this.activeToolId);
        if (!binding) return;
        const epoch = ++this.epoch;
        const lifecycleEpoch = this.lifecycleEpoch;
        const gestureContext: InteractionGestureContext = Object.freeze({
            epoch,
            isCurrent: () => this.isEpochCurrent(epoch),
            canResume: (toolId: string) =>
                !this.disposed &&
                this.lifecycleEpoch === lifecycleEpoch &&
                (this.activeToolId === null || this.activeToolId === toolId),
        });
        try {
            const claim = binding.claim({
                sample,
                activeToolId: this.activeToolId,
                gesture: gestureContext,
            });
            if (!claim) return;
            this.activeGesture = {
                binding,
                gesture: claim.gesture,
                epoch,
                geometryRevision: sample.geometryRevision,
                ending: false,
            };
            this.onStatusChange();
            if (isPromiseLike(claim.started)) {
                observePromise(claim.started, (error) => {
                    if (this.activeGesture?.epoch === epoch) {
                        this.handleError(error, binding.id, 'claim');
                    }
                });
            }
        } catch (error) {
            this.handleError(error, binding.id, 'claim');
        }
    }

    move(sample: PointerSample): void {
        const owner = this.activeGesture;
        if (!owner || owner.ending || !this.isSampleCurrent(owner, sample)) return;
        this.invoke(owner, 'move', () => owner.binding.move(owner.gesture, sample));
    }

    up(sample: PointerSample): void {
        const owner = this.activeGesture;
        if (!owner || owner.ending || !this.isSampleCurrent(owner, sample)) return;
        owner.ending = true;
        this.invoke(owner, 'end', () => owner.binding.end(owner.gesture, sample), true);
    }

    cancel(): void {
        if (this.disposed) return;
        observePromise(this.cancelGesture('pointer-cancel'), () => undefined);
    }

    async cancelGesture(reason: InteractionCancelReason = 'requested'): Promise<void> {
        this.assertActive('cancel Canvas interactions');
        const owner = this.activeGesture;
        this.invalidateLocal(reason);
        if (!owner) return;
        try {
            await owner.binding.cancel(owner.gesture, reason);
        } catch (error) {
            this.reportError(error, owner.binding.id, 'cancel');
            throw error;
        }
    }

    invalidateLifecycle(reason: InteractionCancelReason): void {
        if (this.disposed) return;
        this.lifecycleEpoch += 1;
        this.invalidateLocal(reason);
    }

    status(): InteractionRuntimeStatus {
        const activeBinding = this.activeToolId
            ? this.bindings.find((binding) => binding.toolId === this.activeToolId)
            : undefined;
        return Object.freeze({
            activeBindingId: activeBinding?.id ?? null,
            gestureActive: this.activeGesture !== null,
        });
    }

    dispose(): void {
        if (this.disposed) return;
        this.lifecycleEpoch += 1;
        this.invalidateLocal('dispose');
        this.disposed = true;
        const cleanup = this.toolSubscription.dispose();
        if (isPromiseLike(cleanup)) {
            observePromise(cleanup, (error) => {
                this.diagnostics.reportWarning(
                    error,
                    'Canvas interaction Tool subscription cleanup failed.',
                );
            });
        }
    }

    private invoke(
        owner: ActiveGesture,
        operation: Exclude<InteractionOperation, 'claim' | 'cancel'>,
        task: () => Promise<void> | void,
        complete = false,
    ): void {
        try {
            const result = task();
            if (isPromiseLike(result)) {
                observePromise(
                    Promise.resolve(result).then(() => {
                        if (complete && this.activeGesture === owner) this.complete(owner);
                    }),
                    (error) => {
                        if (this.activeGesture === owner) {
                            this.handleError(error, owner.binding.id, operation);
                        }
                    },
                );
            } else if (complete && this.activeGesture === owner) {
                this.complete(owner);
            }
        } catch (error) {
            this.handleError(error, owner.binding.id, operation);
        }
    }

    private complete(owner: ActiveGesture): void {
        if (this.activeGesture !== owner) return;
        this.activeGesture = null;
        this.onStatusChange();
    }

    private isSampleCurrent(owner: ActiveGesture, sample: PointerSample): boolean {
        if (sample.geometryRevision === owner.geometryRevision) return true;
        this.invalidateLocal('image-replaced');
        return false;
    }

    private isEpochCurrent(epoch: number): boolean {
        return !this.disposed && this.epoch === epoch && this.activeGesture?.epoch === epoch;
    }

    private invalidateLocal(_reason: InteractionCancelReason): void {
        this.epoch += 1;
        const hadGesture = this.activeGesture !== null;
        this.activeGesture = null;
        if (hadGesture) this.onStatusChange();
    }

    private handleError(
        error: unknown,
        bindingId: string | null,
        operation: InteractionOperation,
    ): void {
        const owner = this.activeGesture;
        this.invalidateLocal('error');
        if (owner) {
            try {
                const cleanup = owner.binding.cancel(owner.gesture, 'error');
                if (isPromiseLike(cleanup)) {
                    observePromise(cleanup, (cleanupError) => {
                        this.reportError(cleanupError, owner.binding.id, 'cancel');
                    });
                }
            } catch (cleanupError) {
                this.reportError(cleanupError, owner.binding.id, 'cancel');
            }
        }
        this.reportError(error, bindingId, operation);
    }

    private reportError(
        error: unknown,
        bindingId: string | null,
        operation: InteractionOperation,
    ): void {
        this.diagnostics.reportError(
            error,
            `Canvas interaction ${operation} failed${bindingId ? ` for "${bindingId}"` : ''}.`,
        );
        try {
            this.options.onInteractionError?.(error, Object.freeze({ bindingId, operation }));
        } catch (callbackError) {
            this.diagnostics.reportWarning(
                callbackError,
                'A Canvas interaction error observer failed.',
            );
        }
    }

    private assertUniqueBindings(): void {
        const ids = new Set<string>();
        const tools = new Set<string>();
        for (const binding of this.bindings) {
            if (ids.has(binding.id)) {
                throw new Error(
                    `[ImageEditor] Duplicate Canvas interaction binding "${binding.id}".`,
                );
            }
            if (tools.has(binding.toolId)) {
                throw new Error(
                    `[ImageEditor] Canvas interaction Tool "${binding.toolId}" has multiple bindings.`,
                );
            }
            ids.add(binding.id);
            tools.add(binding.toolId);
        }
    }

    private assertActive(operation: string): void {
        if (this.disposed) {
            throw new Error(
                `[ImageEditor] Cannot ${operation} after Canvas Interactions disposal.`,
            );
        }
    }
}
