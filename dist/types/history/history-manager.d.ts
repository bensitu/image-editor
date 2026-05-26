/**
 * @file history-manager.ts
 * @description Bounded LIFO history stack of {@link Command} entries with
 * dispose-aware async `undo` / `redo` semantics.
 *
 * Behavior contract:
 *
 *  • {@link HistoryManager.execute} and {@link HistoryManager.push} are
 *    **synchronous** for the history-push step so callers can immediately
 *    inspect {@link HistoryManager.canUndo} / {@link HistoryManager.canRedo}
 *    on the next line (e.g. `_updateUI` calls that immediately follow
 *    `saveState`).
 *
 *  • {@link HistoryManager.undo} and {@link HistoryManager.redo} are
 *    **async** and protected by an internal `_processing` lock. Overlapping
 *    calls (rapid clicks) become no-ops that resolve without touching the
 *    stack so canvas restores cannot interleave.
 *
 *  • `currentIndex` only advances **after** the awaited `execute` / `undo`
 *    promise settles successfully. A rejection leaves the pointer where it
 *    was so the next click retries the same step instead of skipping past
 *    a failed restore.
 *
 *  • When the stack overflows past `maxSize`, the oldest entry is evicted
 *    and `currentIndex` stays the same numerically (the entry it pointed to
 *    has shifted one slot toward the front).
 *
 * `Command` is defined in this file (and re-exported from
 * `./command.ts` as a one-line shim) so that the module can be imported
 * directly from source by property tests running under Node's
 * type-stripping mode without needing to resolve a sibling `.js`
 * specifier at runtime.
 */
/**
 * Encapsulates a reversible canvas operation as a paired
 * `execute` / `undo` async closure.
 *
 * Both functions return `Promise<void>` so async Fabric.js operations
 * (`loadFromJSON`, `FabricImage.fromURL`, …) complete before the history
 * manager marks the step as finished and advances its pointer.
 *
 * @example
 * ```ts
 * const cmd = new Command(
 *   async  => { await canvas.loadFromJSON(afterJson);},
 *   async  => { await canvas.loadFromJSON(beforeJson);},
 *);
 * historyManager.execute(cmd);
 * ```
 */
export declare class Command {
    /** Performs (or re-performs) the action. */
    readonly execute: () => Promise<void>;
    /** Reverts the action. */
    readonly undo: () => Promise<void>;
    constructor(execute: () => Promise<void>, undo: () => Promise<void>);
}
/**
 * Manages a bounded LIFO stack of {@link Command} objects supporting
 * unlimited undo and redo within the configured history size.
 */
export declare class HistoryManager {
    /** Maximum number of commands retained. */
    readonly maxSize: number;
    /** @param maxSize Maximum number of commands retained. @default 50 */
    constructor(maxSize?: number);
    /**
     * Records a command on the history stack **and** fires its `execute`
     * (fire-and-forget).
     *
     * The history push is synchronous so that {@link canUndo} /
     * {@link canRedo} reflect the new state on the next line. In the
     * `saveState` pattern, `command.execute` is a no-op on its first
     * invocation (guarded by an `executedOnce` flag inside the closure), so
     * the fire-and-forget is safe and produces no canvas side-effect.
     */
    execute(command: Command): void;
    /**
     * Pushes a command onto the history stack **without** calling
     * `execute`. Use this when the operation has already been performed
     * (for example `applyCrop`) and only the undo/redo wiring is needed.
     */
    push(command: Command): void;
    /** Returns `true` if there is at least one action to undo. */
    canUndo(): boolean;
    /** Returns `true` if there is at least one action to redo. */
    canRedo(): boolean;
    /**
     * Undoes the most recent command.
     *
     * Resolves as a no-op if {@link canUndo} is `false` or another
     * `undo` / `redo` is currently in flight (overlapping calls are
     * rejected via the `_processing` lock). The `currentIndex` only moves
     * after the awaited `command.undo` settles successfully; if it
     * rejects, the pointer stays where it was so a subsequent click
     * retries the same step.
     */
    undo(): Promise<void>;
    /**
     * Re-executes the next command.
     *
     * Resolves as a no-op if {@link canRedo} is `false` or another
     * `undo` / `redo` is currently in flight. The `currentIndex` only
     * advances after the awaited `command.execute` settles successfully.
     */
    redo(): Promise<void>;
}
//# sourceMappingURL=history-manager.d.ts.map