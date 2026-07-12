import type { CoreHistoryCommitPort, CoreHistoryRecord } from '../../core-runtime/history-commit-router.js';
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
export declare class HistoryPluginController implements HistoryPort, CoreHistoryCommitPort {
    private readonly state;
    private readonly operations;
    private readonly reportWarning;
    private records;
    private position;
    private readonly listeners;
    private disposed;
    readonly maxSize: number;
    constructor(state: CoreStatePort, operations: HistoryOperationAccess, options: HistoryPluginOptions | undefined, reportWarning: (error: unknown, message: string) => void);
    isAvailable(): boolean;
    commit(record: CoreHistoryRecord): void;
    push(record: CoreHistoryRecord): void;
    undo(): Promise<void>;
    redo(): Promise<void>;
    canUndo(): boolean;
    canRedo(): boolean;
    clear(): void;
    onChange(handler: (state: HistoryAvailability) => void): () => void;
    getState(): HistoryAvailability;
    dispose(): void;
    private restoreTransactionally;
    private emitChange;
    private assertActive;
}
export {};
