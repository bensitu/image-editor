/**
 * Owns bounded History capture, undo, redo, enablement, and availability state.
 *
 * @module
 */
import { type CoreHistoryRecord } from '../../core/index.js';
import type { MementoHistoryPort } from '../../sdk/index.js';
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
export declare class HistoryPluginController implements HistoryPort {
    private readonly state;
    private readonly operations;
    private readonly reportWarning;
    private records;
    private position;
    private retainedBytes;
    private baseline;
    private enabled;
    private readonly listeners;
    private disposed;
    readonly maxSize: number;
    readonly maxBytes: number;
    constructor(state: MementoHistoryPort, operations: HistoryOperationAccess, options: HistoryPluginOptions | undefined, reportWarning: (error: unknown, message: string) => void);
    get isEnabled(): boolean;
    get length(): number;
    isAvailable(): boolean;
    commit(record: CoreHistoryRecord): void;
    push(record: CoreHistoryRecord): void;
    enable(options: HistoryEnableOptions): Promise<void>;
    disable(options?: HistoryDisableOptions): Promise<void>;
    undo(): Promise<void>;
    redo(): Promise<void>;
    canUndo(): boolean;
    canRedo(): boolean;
    clear(): void;
    onChange(handler: (state: HistoryStatus) => void): () => void;
    getState(): HistoryStatus;
    dispose(): void;
    private resetTimeline;
    private removeEntries;
    private evictOverflow;
    private restoreTransactionally;
    private emitChange;
    private assertActive;
}
export {};
