import type { Disposable } from '../../plugin-kernel/disposable.js';
import { MementoCaptureError, MementoRestoreError, StateRegistrationError } from '../errors.js';
import { assertSafeImmutableReference, cloneStateValue } from './clone-state-value.js';
import type {
    CoreMemento,
    CoreStateAdapter,
    MementoPluginEntry,
    StateCaptureContext,
    StateRestoreContext,
} from './state-types.js';
import type { StateSliceRegistry } from './state-slice-registry.js';

export interface MementoRestoreOptions {
    readonly signal?: AbortSignal;
    readonly rollbackOnFailure?: boolean;
}

function createAbortError(message: string): Error {
    if (typeof DOMException === 'function') return new DOMException(message, 'AbortError');
    const error = new Error(message);
    error.name = 'AbortError';
    return error;
}

function throwIfAborted(signal: AbortSignal): void {
    if (signal.aborted) throw signal.reason ?? createAbortError('State restoration was aborted.');
}

export class MementoService implements Disposable {
    private trustedMementos = new WeakSet<object>();
    private revision = 0;
    private restoring = false;
    private disposed = false;

    constructor(
        private readonly coreAdapter: CoreStateAdapter,
        private readonly slices: StateSliceRegistry,
    ) {}

    capture(): CoreMemento {
        this.assertActive('capture a memento');
        if (this.restoring) {
            throw new StateRegistrationError('Cannot capture a new memento during restoration.');
        }
        return this.captureInternal();
    }

    isTrusted(value: unknown): value is CoreMemento {
        return typeof value === 'object' && value !== null && this.trustedMementos.has(value);
    }

    matches(memento: CoreMemento): boolean {
        this.assertActive('compare a memento');
        if (!this.isTrusted(memento)) return false;
        const current = this.captureInternal(false);
        return (
            JSON.stringify(current.core) === JSON.stringify(memento.core) &&
            JSON.stringify(current.plugins) === JSON.stringify(memento.plugins)
        );
    }

    async restore(memento: CoreMemento, options: MementoRestoreOptions = {}): Promise<void> {
        this.assertActive('restore a memento');
        if (!this.isTrusted(memento)) {
            throw new MementoRestoreError('core', 'restore', new Error('Untrusted memento.'));
        }
        if (this.restoring) {
            throw new MementoRestoreError(
                'core',
                'restore',
                new Error('Reentrant memento restoration is not allowed.'),
            );
        }
        const controller = new AbortController();
        const providedSignal = options.signal;
        const abort = (): void => controller.abort(providedSignal?.reason);
        providedSignal?.addEventListener('abort', abort, { once: true });
        if (providedSignal?.aborted) abort();

        this.restoring = true;
        let rollback: CoreMemento | null = null;
        try {
            if (options.rollbackOnFailure !== false) rollback = this.captureInternal(false);
            await this.restoreInternal(memento, 'trusted-memento', controller.signal);
        } catch (error) {
            if (!rollback) {
                if (error instanceof MementoRestoreError) throw error;
                throw new MementoRestoreError('core', 'restore', error);
            }
            const rollbackErrors: unknown[] = [];
            try {
                await this.restoreInternal(rollback, 'rollback', new AbortController().signal);
            } catch (rollbackError) {
                rollbackErrors.push(rollbackError);
            }
            if (error instanceof MementoRestoreError) {
                throw new MementoRestoreError(
                    error.sliceId,
                    'restore',
                    error.cause,
                    rollbackErrors,
                );
            }
            throw new MementoRestoreError('core', 'restore', error, rollbackErrors);
        } finally {
            providedSignal?.removeEventListener('abort', abort);
            this.restoring = false;
        }
    }

    dispose(): void {
        this.disposed = true;
    }

    reset(): void {
        this.assertActive('reset MementoService');
        if (this.restoring) {
            throw new StateRegistrationError('Cannot reset MementoService during restoration.');
        }
        this.trustedMementos = new WeakSet<object>();
        this.revision = 0;
    }

    private captureInternal(validateReferenceIdentity = true): CoreMemento {
        const capturedAt = Date.now();
        const context: StateCaptureContext = Object.freeze({ mode: 'memento', capturedAt });
        let core: Readonly<Record<string, unknown>>;
        try {
            core = cloneStateValue(this.coreAdapter.capture(context));
            assertSafeImmutableReference(core);
        } catch (error) {
            throw new MementoCaptureError('core', error);
        }
        const plugins: Record<string, MementoPluginEntry> = Object.create(null) as Record<
            string,
            MementoPluginEntry
        >;
        for (const slice of this.slices.list()) {
            try {
                const captured = slice.capture(context);
                let capturePolicy = slice.capturePolicy ?? 'always';
                let data: unknown;
                if (capturePolicy === 'reference') {
                    if (validateReferenceIdentity) {
                        const validation = slice.validate(captured, {
                            sliceId: slice.id,
                            version: slice.version,
                        });
                        if (!validation.valid || validation.value !== captured) {
                            throw new Error(
                                validation.valid
                                    ? 'Reference validation must preserve the captured identity.'
                                    : validation.message,
                            );
                        }
                        assertSafeImmutableReference(captured);
                        data = captured;
                    } else {
                        data = cloneStateValue(captured);
                        capturePolicy = 'always';
                    }
                } else {
                    data = cloneStateValue(captured);
                }
                assertSafeImmutableReference(data);
                plugins[slice.id] = Object.freeze({
                    version: slice.version,
                    capturePolicy,
                    data,
                });
            } catch (error) {
                throw new MementoCaptureError(slice.id, error);
            }
        }
        const memento = Object.freeze({
            revision: ++this.revision,
            capturedAt,
            core,
            plugins: Object.freeze(plugins),
        }) as CoreMemento;
        this.trustedMementos.add(memento);
        return memento;
    }

    private async restoreInternal(
        memento: CoreMemento,
        mode: StateRestoreContext['mode'],
        signal: AbortSignal,
    ): Promise<void> {
        const context: StateRestoreContext = Object.freeze({ mode, signal });
        throwIfAborted(signal);
        try {
            await this.coreAdapter.restore(cloneStateValue(memento.core), context);
        } catch (error) {
            throw new MementoRestoreError(
                'core',
                mode === 'rollback' ? 'rollback' : 'restore',
                error,
            );
        }
        for (const slice of this.slices.list()) {
            throwIfAborted(signal);
            const entry = memento.plugins[slice.id];
            try {
                if (!entry) {
                    await slice.clearState?.(context);
                    continue;
                }
                if (entry.version !== slice.version) {
                    throw new Error(
                        `Captured version ${entry.version} does not match installed version ${slice.version}.`,
                    );
                }
                await slice.restore(
                    entry.capturePolicy === 'reference' ? entry.data : cloneStateValue(entry.data),
                    context,
                );
            } catch (error) {
                throw new MementoRestoreError(
                    slice.id,
                    mode === 'rollback' ? 'rollback' : 'restore',
                    error,
                );
            }
        }
    }

    private assertActive(operation: string): void {
        if (this.disposed) {
            throw new StateRegistrationError(`Cannot ${operation} after MementoService disposal.`);
        }
    }
}
