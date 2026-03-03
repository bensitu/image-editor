/**
 * @file history.ts
 * @description Command pattern + bounded undo/redo history stack.
 */
/**
 * Encapsulates a reversible canvas operation.
 *
 * @example
 * ```ts
 * const cmd = new Command(
 *   () => canvas.loadFromJSON(afterJson),
 *   () => canvas.loadFromJSON(beforeJson),
 * );
 * historyManager.execute(cmd);
 * ```
 */
export declare class Command {
    /** Performs (or re-performs) the action. */
    readonly execute: () => void;
    /** Reverts the action. */
    readonly undo: () => void;
    constructor(
    /** Performs (or re-performs) the action. */
    execute: () => void, 
    /** Reverts the action. */
    undo: () => void);
}
/**
 * Manages a bounded LIFO stack of {@link Command} objects that supports
 * unlimited undo and redo within the configured history size.
 */
export declare class HistoryManager {
    readonly maxSize: number;
    /** @internal */ history: Command[];
    /** @internal */ currentIndex: number;
    /** @param maxSize Maximum number of commands retained. @default 50 */
    constructor(maxSize?: number);
    /**
     * Executes a command and pushes it onto the history stack.
     * Any future (redo) history is discarded when a new command branches off.
     */
    execute(command: Command): void;
    /** Returns `true` if there is at least one action to undo. */
    canUndo(): boolean;
    /** Returns `true` if there is at least one action to redo. */
    canRedo(): boolean;
    /** Undoes the most recent command (no-op if {@link canUndo} is false). */
    undo(): void;
    /** Re-executes the next command (no-op if {@link canRedo} is false). */
    redo(): void;
}
//# sourceMappingURL=history.d.ts.map