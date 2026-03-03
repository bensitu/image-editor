/**
 * @file history.ts
 * @description Command pattern + bounded undo/redo history stack.
 */

// ─── Command ──────────────────────────────────────────────────────────────────

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
export class Command {
    constructor(
        /** Performs (or re-performs) the action. */
        public readonly execute: () => void,
        /** Reverts the action. */
        public readonly undo: () => void,
    ) {}
}

// ─── HistoryManager ───────────────────────────────────────────────────────────

/**
 * Manages a bounded LIFO stack of {@link Command} objects that supports
 * unlimited undo and redo within the configured history size.
 */
export class HistoryManager {
    /** @internal */ history: Command[] = [];
    /** @internal */ currentIndex = -1;

    /** @param maxSize Maximum number of commands retained. @default 50 */
    constructor(public readonly maxSize: number = 50) {}

    /**
     * Executes a command and pushes it onto the history stack.
     * Any future (redo) history is discarded when a new command branches off.
     */
    execute(command: Command): void {
        command.execute();

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

    /** Returns `true` if there is at least one action to undo. */
    canUndo(): boolean {
        return this.currentIndex >= 0;
    }

    /** Returns `true` if there is at least one action to redo. */
    canRedo(): boolean {
        return this.currentIndex < this.history.length - 1;
    }

    /** Undoes the most recent command (no-op if {@link canUndo} is false). */
    undo(): void {
        if (this.canUndo()) {
            const cmd = this.history[this.currentIndex];
            if (cmd) { cmd.undo(); this.currentIndex--; }
        }
    }

    /** Re-executes the next command (no-op if {@link canRedo} is false). */
    redo(): void {
        if (this.canRedo()) {
            this.currentIndex++;
            const cmd = this.history[this.currentIndex];
            if (cmd) cmd.execute();
        }
    }
}
