/**
 * @file history.ts
 * @description Command pattern + bounded undo/redo history stack.
 *
 * ── Changes from previous version ──────────────────────────────────────────
 *  • Command.execute / Command.undo now return Promise<void> so that async
 *    canvas operations (loadFromJSON, FabricImage.fromURL …) are properly
 *    awaited before the history index advances.
 *  • HistoryManager.undo() / redo() are now async and guarded by a
 *    _processing lock that prevents race conditions from rapid clicks.
 *  • HistoryManager.execute() remains synchronous for the history-push step
 *    so callers can immediately inspect canUndo()/canRedo() (e.g. _updateUI).
 *    The command's execute() is called with void because in the saveState
 *    pattern the first invocation is always a no-op (executedOnce guard).
 *  • New push() method: records a command without re-executing it. Used by
 *    applyCrop() which has already performed the operation and only needs
 *    undo/redo wired up.
 */
/**
 * Encapsulates a reversible canvas operation.
 *
 * Both `execute` and `undo` return `Promise<void>` so that async Fabric.js
 * operations (loadFromJSON, FabricImage.fromURL …) complete before the history
 * manager marks the step as finished.
 *
 * @example
 * ```ts
 * const cmd = new Command(
 *   async () => { await canvas.loadFromJSON(afterJson); },
 *   async () => { await canvas.loadFromJSON(beforeJson); },
 * );
 * historyManager.execute(cmd);
 * ```
 */
export declare class Command {
    /** Performs (or re-performs) the action. */
    readonly execute: () => Promise<void>;
    /** Reverts the action. */
    readonly undo: () => Promise<void>;
    constructor(
    /** Performs (or re-performs) the action. */
    execute: () => Promise<void>, 
    /** Reverts the action. */
    undo: () => Promise<void>);
}
/**
 * Manages a bounded LIFO stack of {@link Command} objects that supports
 * unlimited undo and redo within the configured history size.
 *
 * `undo()` and `redo()` are **async** and protected by an internal
 * `_processing` lock so rapid user clicks cannot interleave canvas restores.
 */
export declare class HistoryManager {
    readonly maxSize: number;
    /** @internal */ history: Command[];
    /** @internal */ currentIndex: number;
    /** @internal */ private _processing;
    /** @param maxSize Maximum number of commands retained. @default 50 */
    constructor(maxSize?: number);
    /**
     * Records a command on the history stack **and** fires its `execute()`
     * immediately (fire-and-forget).
     *
     * The history push is **synchronous** so that `canUndo()` / `canRedo()`
     * reflect the new state before the caller's next statement (important for
     * `_updateUI()` calls that immediately follow `saveState()`).
     *
     * In the `saveState()` pattern, `command.execute()` is a no-op on the
     * first invocation (guarded by an `executedOnce` flag inside the closure),
     * so the fire-and-forget is safe and causes no canvas side-effect.
     */
    execute(command: Command): void;
    /**
     * Pushes a command onto the history stack **without** calling `execute()`.
     *
     * Use this when the operation has already been performed (e.g. `applyCrop`)
     * and only the undo/redo wiring is needed.
     */
    push(command: Command): void;
    /** Returns `true` if there is at least one action to undo. */
    canUndo(): boolean;
    /** Returns `true` if there is at least one action to redo. */
    canRedo(): boolean;
    /**
     * Undoes the most recent command.
     *
     * No-op if {@link canUndo} is false or a previous undo/redo is still in
     * progress (prevents race conditions from rapid clicks).
     */
    undo(): Promise<void>;
    /**
     * Re-executes the next command.
     *
     * No-op if {@link canRedo} is false or a previous undo/redo is still in
     * progress.
     */
    redo(): Promise<void>;
}
//# sourceMappingURL=history.d.ts.map