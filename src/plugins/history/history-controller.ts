import { CoreRuntimeError } from '../../core-runtime/errors.js';
import type {
    CoreHistoryCommitPort,
    CoreHistoryRecord,
} from '../../core-runtime/history-commit-router.js';
import type { CoreStatePort } from '../../core-runtime/internal-capabilities.js';

export interface HistoryAvailability {
    readonly canUndo: boolean;
    readonly canRedo: boolean;
    readonly size: number;
    readonly position: number;
}

export interface HistoryPort {
    isAvailable(): boolean;
    push(record: CoreHistoryRecord): void;
    undo(): Promise<void>;
    redo(): Promise<void>;
    canUndo(): boolean;
    canRedo(): boolean;
    getState(): HistoryAvailability;
    clear(): void;
    onChange(handler: (state: HistoryAvailability) => void): () => void;
}

export interface HistoryPluginOptions {
    readonly maxSize?: number;
    readonly onChange?: (state: HistoryAvailability) => void;
}

interface HistoryOperationAccess {
    run(operationId: string, body: () => Promise<void>): Promise<void>;
}

function resolveMaxSize(value: number | undefined): number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : 50;
}

export class HistoryPluginController implements HistoryPort, CoreHistoryCommitPort {
    private records: CoreHistoryRecord[] = [];
    private position = 0;
    private readonly listeners = new Set<(state: HistoryAvailability) => void>();
    private disposed = false;
    readonly maxSize: number;

    constructor(
        private readonly state: CoreStatePort,
        private readonly operations: HistoryOperationAccess,
        options: HistoryPluginOptions = {},
        private readonly reportWarning: (error: unknown, message: string) => void,
    ) {
        this.maxSize = resolveMaxSize(options.maxSize);
        if (options.onChange) this.listeners.add(options.onChange);
    }

    isAvailable(): boolean {
        return !this.disposed;
    }

    commit(record: CoreHistoryRecord): void {
        if (record.operationId === 'core:load-image' || record.operationId === 'core:load-state') {
            this.clear();
            return;
        }
        this.push(record);
    }

    push(record: CoreHistoryRecord): void {
        this.assertActive('push History');
        if (!record || typeof record.operationId !== 'string' || record.operationId.length === 0) {
            throw new CoreRuntimeError('[ImageEditor] History record operationId is invalid.');
        }
        if (this.position < this.records.length) {
            this.records = this.records.slice(0, this.position);
        }
        this.records.push(
            Object.freeze({
                operationId: record.operationId,
                before: record.before,
                after: record.after,
                timestamp: record.timestamp,
                detail: record.detail,
            }),
        );
        if (this.records.length > this.maxSize) {
            const overflow = this.records.length - this.maxSize;
            this.records.splice(0, overflow);
        }
        this.position = this.records.length;
        this.emitChange();
    }

    undo(): Promise<void> {
        this.assertActive('undo');
        if (!this.canUndo()) return Promise.resolve();
        return this.operations.run('history:undo', async () => {
            const record = this.records[this.position - 1];
            if (!record) return;
            await this.restoreTransactionally(record.before, 'undo');
            this.position -= 1;
            this.emitChange();
        });
    }

    redo(): Promise<void> {
        this.assertActive('redo');
        if (!this.canRedo()) return Promise.resolve();
        return this.operations.run('history:redo', async () => {
            const record = this.records[this.position];
            if (!record) return;
            await this.restoreTransactionally(record.after, 'redo');
            this.position += 1;
            this.emitChange();
        });
    }

    canUndo(): boolean {
        return !this.disposed && this.position > 0;
    }

    canRedo(): boolean {
        return !this.disposed && this.position < this.records.length;
    }

    clear(): void {
        if (this.disposed) return;
        const changed = this.records.length > 0 || this.position !== 0;
        this.records = [];
        this.position = 0;
        if (changed) this.emitChange();
    }

    onChange(handler: (state: HistoryAvailability) => void): () => void {
        this.assertActive('subscribe to History');
        this.listeners.add(handler);
        return () => {
            this.listeners.delete(handler);
        };
    }

    getState(): HistoryAvailability {
        return Object.freeze({
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            size: this.records.length,
            position: this.position,
        });
    }

    dispose(): void {
        if (this.disposed) return;
        this.records = [];
        this.position = 0;
        this.listeners.clear();
        this.disposed = true;
    }

    private async restoreTransactionally(
        target: CoreHistoryRecord['before'],
        operation: 'undo' | 'redo',
    ): Promise<void> {
        const rollback = this.state.mementos.capture();
        try {
            await this.state.mementos.restore(target);
        } catch (error) {
            try {
                await this.state.mementos.restore(rollback);
            } catch (rollbackError) {
                throw new CoreRuntimeError(
                    `[ImageEditor] History ${operation} failed and rollback could not restore state.`,
                    {
                        code: 'HISTORY_UNRECOVERABLE_ERROR',
                        cause: Object.freeze([error, rollbackError]),
                    },
                );
            }
            throw new CoreRuntimeError(`[ImageEditor] History ${operation} failed.`, {
                code: 'HISTORY_RESTORE_ERROR',
                cause: error,
            });
        }
    }

    private emitChange(): void {
        const availability = this.getState();
        for (const listener of [...this.listeners]) {
            try {
                listener(availability);
            } catch (error) {
                this.reportWarning(error, 'History onChange callback failed.');
            }
        }
    }

    private assertActive(operation: string): void {
        if (this.disposed) {
            throw new CoreRuntimeError(`[ImageEditor] Cannot ${operation} after History disposal.`);
        }
    }
}
