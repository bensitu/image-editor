/**
 * Owns bounded History capture, undo, redo, enablement, and availability state.
 *
 * @module
 */
import { type CoreHistoryRecord } from '../../core/index.js';
import type { MementoHistoryPort } from '../../sdk/index.js';
export interface HistoryStatus {
    readonly isEnabled: boolean;
    readonly canUndo: boolean;
    readonly canRedo: boolean;
    readonly length: number;
    readonly size: number;
    readonly position: number;
}
export type HistoryAvailability = HistoryStatus;
export interface HistoryEnableOptions {
    readonly baseline: 'current';
}
export interface HistoryDisableOptions {
    readonly clear?: boolean;
}
export interface HistoryPort {
    readonly isEnabled: boolean;
    readonly length: number;
    isAvailable(): boolean;
    push(record: CoreHistoryRecord): void;
    enable(options: HistoryEnableOptions): Promise<void>;
    disable(options?: HistoryDisableOptions): Promise<void>;
    undo(): Promise<void>;
    redo(): Promise<void>;
    canUndo(): boolean;
    canRedo(): boolean;
    getState(): HistoryStatus;
    clear(): void;
    onChange(handler: (state: HistoryStatus) => void): () => void;
}
export interface HistoryPluginOptions {
    readonly enabled?: boolean;
    readonly maxSize?: number;
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
    private baseline;
    private enabled;
    private readonly listeners;
    private disposed;
    readonly maxSize: number;
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
    private restoreTransactionally;
    private emitChange;
    private assertActive;
}
export {};
