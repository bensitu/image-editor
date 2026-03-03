"use strict";
/**
 * @file history.ts
 * @description Command pattern + bounded undo/redo history stack.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HistoryManager = exports.Command = void 0;
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
class Command {
    constructor(
    /** Performs (or re-performs) the action. */
    execute, 
    /** Reverts the action. */
    undo) {
        Object.defineProperty(this, "execute", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: execute
        });
        Object.defineProperty(this, "undo", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: undo
        });
    }
}
exports.Command = Command;
// ─── HistoryManager ───────────────────────────────────────────────────────────
/**
 * Manages a bounded LIFO stack of {@link Command} objects that supports
 * unlimited undo and redo within the configured history size.
 */
class HistoryManager {
    /** @param maxSize Maximum number of commands retained. @default 50 */
    constructor(maxSize = 50) {
        Object.defineProperty(this, "maxSize", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: maxSize
        });
        /** @internal */ Object.defineProperty(this, "history", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        /** @internal */ Object.defineProperty(this, "currentIndex", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: -1
        });
    }
    /**
     * Executes a command and pushes it onto the history stack.
     * Any future (redo) history is discarded when a new command branches off.
     */
    execute(command) {
        command.execute();
        // Discard redo history on new branch
        if (this.currentIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.currentIndex + 1);
        }
        this.history.push(command);
        if (this.history.length > this.maxSize) {
            // Oldest entry evicted — index stays the same numerically
            this.history.shift();
        }
        else {
            this.currentIndex++;
        }
    }
    /** Returns `true` if there is at least one action to undo. */
    canUndo() {
        return this.currentIndex >= 0;
    }
    /** Returns `true` if there is at least one action to redo. */
    canRedo() {
        return this.currentIndex < this.history.length - 1;
    }
    /** Undoes the most recent command (no-op if {@link canUndo} is false). */
    undo() {
        if (this.canUndo()) {
            const cmd = this.history[this.currentIndex];
            if (cmd) {
                cmd.undo();
                this.currentIndex--;
            }
        }
    }
    /** Re-executes the next command (no-op if {@link canRedo} is false). */
    redo() {
        if (this.canRedo()) {
            this.currentIndex++;
            const cmd = this.history[this.currentIndex];
            if (cmd)
                cmd.execute();
        }
    }
}
exports.HistoryManager = HistoryManager;
//# sourceMappingURL=history.js.map