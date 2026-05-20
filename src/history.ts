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

// ─── Command ──────────────────────────────────────────────────────────────────

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
export class Command {
    constructor(
        /** Performs (or re-performs) the action. */
        public readonly execute: () => Promise<void>,
        /** Reverts the action. */
        public readonly undo: () => Promise<void>,
    ) {}
}

// ─── HistoryManager ───────────────────────────────────────────────────────────

/**
 * Manages a bounded LIFO stack of {@link Command} objects that supports
 * unlimited undo and redo within the configured history size.
 *
 * `undo()` and `redo()` are **async** and protected by an internal
 * `_processing` lock so rapid user clicks cannot interleave canvas restores.
 */
export class HistoryManager {
    /** @internal */ history: Command[] = [];
    /** @internal */ currentIndex = -1;
    /** @internal */ private _processing = false;

    /** @param maxSize Maximum number of commands retained. @default 50 */
    constructor(public readonly maxSize: number = 50) {}

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
    execute(command: Command): void {
        // Fire the async operation — in the saveState pattern this is a no-op
        // on first call; subsequent calls (redo) are handled by redo() which
        // awaits properly.
        void command.execute();

        // Discard redo history on new branch
        if (this.currentIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.currentIndex + 1);
        }

        this.history.push(command);

        if (this.history.length > this.maxSize) {
            // Oldest entry evicted — index stays the same numerically
            this.history.shift();
        } else {
            this.currentIndex++;
        }
    }

    /**
     * Pushes a command onto the history stack **without** calling `execute()`.
     *
     * Use this when the operation has already been performed (e.g. `applyCrop`)
     * and only the undo/redo wiring is needed.
     */
    push(command: Command): void {
        if (this.currentIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.currentIndex + 1);
        }

        this.history.push(command);

        if (this.history.length > this.maxSize) {
            this.history.shift();
        } else {
            this.currentIndex++;
        }
    }

    /** Returns `true` if there is at least one action to undo. */
    canUndo(): boolean {
        return this.currentIndex >= 0;
    }

    /** Returns `true` if there is at least one action to redo. */
    canRedo(): boolean {
        return this.currentIndex < this.history.length - 1;
    }

    /**
     * Undoes the most recent command.
     *
     * No-op if {@link canUndo} is false or a previous undo/redo is still in
     * progress (prevents race conditions from rapid clicks).
     */
    async undo(): Promise<void> {
        if (this._processing || !this.canUndo()) return;
        this._processing = true;
        try {
            const cmd = this.history[this.currentIndex];
            if (cmd) {
                // Decrement index BEFORE awaiting so that concurrent calls
                // (prevented by _processing, but defensive) see the updated state.
                this.currentIndex--;
                await cmd.undo();
            }
        } finally {
            this._processing = false;
        }
    }

    /**
     * Re-executes the next command.
     *
     * No-op if {@link canRedo} is false or a previous undo/redo is still in
     * progress.
     */
    async redo(): Promise<void> {
        if (this._processing || !this.canRedo()) return;
        this._processing = true;
        try {
            this.currentIndex++;
            const cmd = this.history[this.currentIndex];
            if (cmd) await cmd.execute();
        } finally {
            this._processing = false;
        }
    }
}
