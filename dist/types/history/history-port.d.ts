/** A reversible command accepted by the v2 compatibility history port. */
export interface HistoryCommand {
    readonly execute: () => Promise<void>;
    readonly undo: () => Promise<void>;
}
/** Lightweight command value retained for v2 source compatibility. */
export declare class Command implements HistoryCommand {
    readonly execute: () => Promise<void>;
    readonly undo: () => Promise<void>;
    constructor(execute: () => Promise<void>, undo: () => Promise<void>);
}
/**
 * Minimal history surface consumed by legacy feature adapters. The full
 * facade supplies a plugin-backed implementation while the standalone v2
 * HistoryManager remains available to its focused unit tests.
 */
export interface LegacyHistoryPort {
    readonly maxSize: number;
    execute(command: HistoryCommand): Promise<void>;
    push(command: HistoryCommand): void;
    clear(): void;
    canUndo(): boolean;
    canRedo(): boolean;
    undo(): Promise<void>;
    redo(): Promise<void>;
}
