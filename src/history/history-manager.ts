/**
 * Bounded LIFO history stack of {@link Command} entries with
 * dispose-aware async `undo` / `redo` semantics.
 *
 * Behavior contract:
 *
 *  • {@link HistoryManager.push} is **synchronous** for the history-push
 *  step so callers can immediately inspect {@link HistoryManager.canUndo} /
 *  {@link HistoryManager.canRedo} on the next line (e.g. `updateUi` calls
 *  that immediately follow `saveState`). {@link HistoryManager.execute}
 *  awaits the command before pushing it.
 *
 *  • {@link HistoryManager.execute} calls are serialized through an
 *  internal queue so command bodies cannot overlap even when callers do not
 *  await the first returned promise before starting the next one.
 *
 *  • {@link HistoryManager.undo} and {@link HistoryManager.redo} are
 *  **async** and protected by an internal `isProcessing` lock. Overlapping
 *  calls (rapid clicks) become no-ops that resolve without touching the
 *  stack so canvas restores cannot interleave.
 *
 *  • `currentIndex` only advances **after** the awaited `execute` / `undo`
 *  promise settles successfully. A rejection leaves the pointer where it
 *  was so the next click retries the same step instead of skipping past
 *  a failed restore.
 *
 *  • {@link HistoryManager.push} refuses to append a new command while
 *  another history operation is in flight. The integrated editor normally
 *  prevents this via its operation guard, and the history class enforces
 *  the same invariant when used directly.
 *
 *  • When the stack overflows past `maxSize`, the oldest entry is evicted
 *  and `currentIndex` stays the same numerically (the entry it pointed to
 *  has shifted one slot toward the front).
 *
 * `Command` is defined in this file (and re-exported from
 * `./command.ts` as a one-line shim) so that the module can be imported
 * directly from source by property tests running under Node's
 * type-stripping mode without needing to resolve a sibling `.js`
 * specifier at runtime.
 *
 * @module
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
 *   async () => {
 *     await canvas.loadFromJSON(afterJson);
 *   },
 *   async () => {
 *     await canvas.loadFromJSON(beforeJson);
 *   },
 * );
 * await historyManager.execute(cmd);
 * ```
 */
export class Command {
    /** Performs (or re-performs) the action. */
    readonly execute: () => Promise<void>;
    /** Reverts the action. */
    readonly undo: () => Promise<void>;

    constructor(execute: () => Promise<void>, undo: () => Promise<void>) {
        this.execute = execute;
        this.undo = undo;
    }
}

/**
 * Manages a bounded LIFO stack of {@link Command} objects supporting
 * unlimited undo and redo within the configured history size.
 */
export class HistoryManager {
    private history: Command[] = [];
    private currentIndex = -1;
    private isProcessing = false;
    private queuedExecuteCount = 0;
    private executeTail: Promise<void> = Promise.resolve();

    /** Maximum number of commands retained. */
    readonly maxSize: number;

    /**
     * @param maxSize - Maximum number of commands retained.
     * @default 50
     */
    constructor(maxSize: number = 50) {
        this.maxSize = maxSize;
    }

    /**
     * Awaits a command's `execute` closure and records it on the history stack
     * only after the closure succeeds.
     *
     * Use {@link push} when the operation has already been performed and
     * should become undoable synchronously.
     */
    async execute(command: Command): Promise<void> {
        this.queuedExecuteCount += 1;
        const execution = this.executeTail.then(async () => {
            try {
                if (this.isProcessing) {
                    throw new Error('Cannot push to history while undo/redo is in flight.');
                }
                this.isProcessing = true;
                try {
                    await command.execute();
                    this.pushAndTrim(command, { skipProcessingCheck: true });
                } finally {
                    this.isProcessing = false;
                }
            } finally {
                this.queuedExecuteCount -= 1;
            }
        });
        this.executeTail = execution.catch(() => {});
        return execution;
    }

    /**
     * Pushes a command onto the history stack **without** calling
     * `execute`. Use this when the operation has already been performed
     * (for example `applyCrop`) and only the undo/redo wiring is needed.
     *
     * Throws when an `undo` / `redo` operation is already in flight.
     */
    push(command: Command): void {
        this.pushAndTrim(command);
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
     * Resolves as a no-op if {@link canUndo} is `false` or another
     * history operation is currently in flight (overlapping calls are
     * rejected via the `isProcessing` lock). The `currentIndex` only moves
     * after the awaited `command.undo` settles successfully; if it
     * rejects, the pointer stays where it was so a subsequent click
     * retries the same step.
     */
    async undo(): Promise<void> {
        if (this.isProcessing || this.queuedExecuteCount > 0 || !this.canUndo()) return;
        this.isProcessing = true;
        try {
            const cmd = this.history[this.currentIndex];
            if (!cmd) return;
            await cmd.undo();
            // Advance pointer only after the awaited undo resolves.
            this.currentIndex--;
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Re-executes the next command.
     *
     * Resolves as a no-op if {@link canRedo} is `false` or another
     * history operation is currently in flight. The `currentIndex` only
     * advances after the awaited `command.execute` settles successfully.
     */
    async redo(): Promise<void> {
        if (this.isProcessing || this.queuedExecuteCount > 0 || !this.canRedo()) return;
        this.isProcessing = true;
        try {
            const cmd = this.history[this.currentIndex + 1];
            if (!cmd) return;
            await cmd.execute();
            // Advance pointer only after the awaited execute resolves.
            this.currentIndex++;
        } finally {
            this.isProcessing = false;
        }
    }

    private assertCanPush(): void {
        if (!this.isProcessing && this.queuedExecuteCount === 0) return;
        throw new Error('Cannot push to history while undo/redo is in flight.');
    }

    /**
     * Shared push/trim path for {@link execute} and {@link push}.
     *
     * Discards any redo branch past `currentIndex`, appends the new
     * command, and either advances `currentIndex` (within capacity) or
     * evicts the oldest entry without changing `currentIndex` numerically
     * (overflow past `maxSize`).
     *
     */
    private pushAndTrim(command: Command, options?: { skipProcessingCheck?: boolean }): void {
        if (!options?.skipProcessingCheck) this.assertCanPush();

        // Discard redo history on a new branch.
        if (this.currentIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.currentIndex + 1);
        }

        this.history.push(command);

        if (this.history.length > this.maxSize) {
            // The append temporarily places the new command at
            // currentIndex + 1. Evicting the oldest entry shifts every
            // remaining command one slot toward the front, so the new
            // command ends up at the existing numeric currentIndex.
            // Incrementing here would point past the retained stack.
            this.history.shift();
        } else {
            this.currentIndex++;
        }
    }
}
