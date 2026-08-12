/**
 * Owns bounded History capture, undo, redo, enablement, and availability state.
 *
 * @module
 */

import { CoreRuntimeError, type CoreHistoryRecord } from '../../core/index.js';
import type { MementoHistoryPort } from '../../sdk/index.js';
import { estimateRetainedBytes } from './retained-size-estimator.js';

const DEFAULT_MAX_HISTORY_BYTES = 128 * 1024 * 1024;

/** Immutable History availability, position, and retained-memory status. */
export interface HistoryStatus {
    readonly isEnabled: boolean;
    readonly canUndo: boolean;
    readonly canRedo: boolean;
    readonly length: number;
    readonly size: number;
    readonly position: number;
    readonly bytes: number;
    readonly maxBytes: number;
}

/** Alias for the complete observable History status. */
export type HistoryAvailability = HistoryStatus;

/** Selects the document state used when History is enabled. */
export interface HistoryEnableOptions {
    readonly baseline: 'current';
}

/** Controls whether disabling History also removes retained entries. */
export interface HistoryDisableOptions {
    readonly clear?: boolean;
}

/** Public History capture, navigation, enablement, and observation operations. */
export interface HistoryPort {
    /** Reports whether new document mutations enter History. */
    readonly isEnabled: boolean;
    /** Number of retained undo and redo entries. */
    readonly length: number;
    /** Reports whether History can accept or navigate records. */
    isAvailable(): boolean;
    /** Adds one committed Core mutation record. */
    push(record: CoreHistoryRecord): void;
    /** Enables History using the current document as its baseline. */
    enable(options: HistoryEnableOptions): Promise<void>;
    /** Disables History and optionally clears retained entries. */
    disable(options?: HistoryDisableOptions): Promise<void>;
    /** Restores the preceding retained document state. */
    undo(): Promise<void>;
    /** Restores the next retained document state. */
    redo(): Promise<void>;
    /** Reports whether an undo entry is available. */
    canUndo(): boolean;
    /** Reports whether a redo entry is available. */
    canRedo(): boolean;
    /** Returns an immutable History status snapshot. */
    getState(): HistoryStatus;
    /** Removes all retained entries while preserving enablement. */
    clear(): void;
    /** Subscribes to History status changes. */
    onChange(handler: (state: HistoryStatus) => void): () => void;
}

/** Configures initial enablement, entry count, retained bytes, and notifications. */
export interface HistoryPluginOptions {
    readonly enabled?: boolean;
    readonly maxSize?: number;
    readonly maxBytes?: number;
    readonly onChange?: (state: HistoryStatus) => void;
}

interface HistoryOperationAccess {
    run(operationId: string, body: () => Promise<void>): Promise<void>;
}

interface RetainedHistoryEntry {
    readonly record: CoreHistoryRecord;
    readonly bytes: number;
}

function resolveMaxSize(value: number | undefined): number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : 50;
}

function resolveMaxBytes(value: number | undefined): number {
    if (value === undefined) return DEFAULT_MAX_HISTORY_BYTES;
    if (!Number.isSafeInteger(value) || value <= 0) {
        throw new CoreRuntimeError(
            '[ImageEditor] History maxBytes must be a positive safe integer.',
            {
                code: 'HISTORY_MAX_BYTES_INVALID',
            },
        );
    }
    return value;
}

export class HistoryPluginController implements HistoryPort {
    private records: RetainedHistoryEntry[] = [];
    private position = 0;
    private retainedBytes = 0;
    private baseline: CoreHistoryRecord['before'] | null = null;
    declare private enabled: boolean;
    private readonly listeners = new Set<(state: HistoryStatus) => void>();
    private disposed = false;
    declare readonly maxSize: number;
    declare readonly maxBytes: number;

    constructor(
        private readonly state: MementoHistoryPort,
        private readonly operations: HistoryOperationAccess,
        options: HistoryPluginOptions = {},
        private readonly reportWarning: (error: unknown, message: string) => void,
    ) {
        this.enabled = options.enabled !== false;
        this.maxSize = resolveMaxSize(options.maxSize);
        this.maxBytes = resolveMaxBytes(options.maxBytes);
        if (options.onChange) this.listeners.add(options.onChange);
    }

    get isEnabled(): boolean {
        return !this.disposed && this.enabled;
    }

    get length(): number {
        return this.records.length;
    }

    isAvailable(): boolean {
        return !this.disposed;
    }

    commit(record: CoreHistoryRecord): void {
        if (!this.isEnabled) return;
        if (
            record.operationId === 'core:load-image' ||
            record.operationId === 'core:commit-load-image' ||
            record.operationId === 'core:load-state'
        ) {
            const changed = this.resetTimeline();
            this.baseline = record.after;
            if (changed) this.emitChange();
            return;
        }
        this.push(record);
    }

    push(record: CoreHistoryRecord): void {
        this.assertActive('push History');
        if (!this.enabled) return;
        if (!record || typeof record.operationId !== 'string' || record.operationId.length === 0) {
            throw new CoreRuntimeError('[ImageEditor] History record operationId is invalid.');
        }
        const retainedRecord = Object.freeze({
            operationId: record.operationId,
            before: record.before,
            after: record.after,
            timestamp: record.timestamp,
            detail: record.detail,
        });
        const bytes = estimateRetainedBytes(retainedRecord);
        if (bytes > this.maxBytes) {
            const changed = this.resetTimeline();
            this.baseline = record.after;
            const warning = new CoreRuntimeError(
                `[ImageEditor] History record "${record.operationId}" exceeds maxBytes and was not retained.`,
                {
                    code: 'HISTORY_RECORD_BYTE_LIMIT_EXCEEDED',
                },
            );
            this.reportWarning(
                warning,
                `History record "${record.operationId}" requires ${bytes} bytes, exceeding the ${this.maxBytes}-byte limit.`,
            );
            if (changed) this.emitChange();
            return;
        }

        this.baseline ??= record.before;
        this.removeEntries(this.position, this.records.length - this.position);
        this.records.push(Object.freeze({ record: retainedRecord, bytes }));
        this.retainedBytes += bytes;
        this.evictOverflow();
        this.position = this.records.length;
        this.emitChange();
    }

    enable(options: HistoryEnableOptions): Promise<void> {
        this.assertActive('enable History');
        if (options?.baseline !== 'current') {
            throw new CoreRuntimeError(
                '[ImageEditor] History can enable only from the current baseline.',
                {
                    code: 'HISTORY_BASELINE_UNSUPPORTED',
                },
            );
        }
        return this.operations.run('history:enable', async () => {
            if (this.enabled) return;
            const baseline = this.state.captureMemento();
            this.records = [];
            this.position = 0;
            this.retainedBytes = 0;
            this.baseline = baseline;
            this.enabled = true;
            this.emitChange();
        });
    }

    disable(options: HistoryDisableOptions = {}): Promise<void> {
        this.assertActive('disable History');
        if (options.clear !== undefined && typeof options.clear !== 'boolean') {
            throw new CoreRuntimeError('[ImageEditor] History disable clear must be a boolean.', {
                code: 'HISTORY_DISABLE_OPTION_INVALID',
            });
        }
        const shouldClear = options.clear ?? true;
        return this.operations.run('history:disable', async () => {
            const wasEnabled = this.enabled;
            const hadRecords = this.records.length > 0 || this.position !== 0;
            this.enabled = false;
            if (shouldClear) this.resetTimeline();
            if (wasEnabled || (shouldClear && hadRecords)) this.emitChange();
        });
    }

    undo(): Promise<void> {
        this.assertActive('undo');
        if (!this.canUndo()) return Promise.resolve();
        return this.operations.run('history:undo', async () => {
            const entry = this.records[this.position - 1];
            if (!entry) return;
            await this.restoreTransactionally(entry.record.before, 'undo');
            this.position -= 1;
            this.emitChange();
        });
    }

    redo(): Promise<void> {
        this.assertActive('redo');
        if (!this.canRedo()) return Promise.resolve();
        return this.operations.run('history:redo', async () => {
            const entry = this.records[this.position];
            if (!entry) return;
            await this.restoreTransactionally(entry.record.after, 'redo');
            this.position += 1;
            this.emitChange();
        });
    }

    canUndo(): boolean {
        return this.isEnabled && this.position > 0;
    }

    canRedo(): boolean {
        return this.isEnabled && this.position < this.records.length;
    }

    clear(): void {
        if (this.disposed) return;
        if (this.resetTimeline()) this.emitChange();
    }

    onChange(handler: (state: HistoryStatus) => void): () => void {
        this.assertActive('subscribe to History');
        this.listeners.add(handler);
        return () => {
            this.listeners.delete(handler);
        };
    }

    getState(): HistoryStatus {
        return Object.freeze({
            isEnabled: this.isEnabled,
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            length: this.records.length,
            size: this.records.length,
            position: this.position,
            bytes: this.retainedBytes,
            maxBytes: this.maxBytes,
        });
    }

    dispose(): void {
        if (this.disposed) return;
        this.records = [];
        this.position = 0;
        this.retainedBytes = 0;
        this.baseline = null;
        this.enabled = false;
        this.listeners.clear();
        this.disposed = true;
    }

    private resetTimeline(): boolean {
        const changed = this.records.length > 0 || this.position !== 0 || this.retainedBytes !== 0;
        this.records = [];
        this.position = 0;
        this.retainedBytes = 0;
        this.baseline = null;
        return changed;
    }

    private removeEntries(start: number, deleteCount: number): void {
        if (deleteCount <= 0) return;
        const removed = this.records.splice(start, deleteCount);
        for (const entry of removed) {
            this.retainedBytes -= entry.bytes;
        }
    }

    private evictOverflow(): void {
        while (this.records.length > this.maxSize || this.retainedBytes > this.maxBytes) {
            this.removeEntries(0, 1);
        }
    }

    private async restoreTransactionally(
        target: CoreHistoryRecord['before'],
        operation: 'undo' | 'redo',
    ): Promise<void> {
        const rollback = this.state.captureMemento();
        try {
            await this.state.restoreMemento(target);
        } catch (error) {
            try {
                await this.state.restoreMemento(rollback);
            } catch (rollbackError) {
                const failure = new CoreRuntimeError(
                    `[ImageEditor] History ${operation} failed and rollback could not restore state.`,
                    {
                        code: 'HISTORY_UNRECOVERABLE_ERROR',
                        cause: Object.freeze([error, rollbackError]),
                        behavior: 'fatal-rollback',
                    },
                );
                this.state.reportFatal(failure);
                throw failure;
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
