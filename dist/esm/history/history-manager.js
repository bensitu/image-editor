export class Command {
    constructor(execute, undo) {
        Object.defineProperty(this, "execute", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "undo", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.execute = execute;
        this.undo = undo;
    }
}
export class HistoryManager {
    constructor(maxSize = 50) {
        Object.defineProperty(this, "history", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "currentIndex", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: -1
        });
        Object.defineProperty(this, "isProcessing", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "queuedExecuteCount", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "executeTail", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: Promise.resolve()
        });
        Object.defineProperty(this, "maxSize", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.maxSize = maxSize;
    }
    async execute(command) {
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
                }
                finally {
                    this.isProcessing = false;
                }
            }
            finally {
                this.queuedExecuteCount -= 1;
            }
        });
        this.executeTail = execution.catch(() => { });
        return execution;
    }
    push(command) {
        this.pushAndTrim(command);
    }
    canUndo() {
        return this.currentIndex >= 0;
    }
    canRedo() {
        return this.currentIndex < this.history.length - 1;
    }
    async undo() {
        if (this.isProcessing || this.queuedExecuteCount > 0 || !this.canUndo())
            return;
        this.isProcessing = true;
        try {
            const cmd = this.history[this.currentIndex];
            if (!cmd)
                return;
            await cmd.undo();
            this.currentIndex--;
        }
        finally {
            this.isProcessing = false;
        }
    }
    async redo() {
        if (this.isProcessing || this.queuedExecuteCount > 0 || !this.canRedo())
            return;
        this.isProcessing = true;
        try {
            const cmd = this.history[this.currentIndex + 1];
            if (!cmd)
                return;
            await cmd.execute();
            this.currentIndex++;
        }
        finally {
            this.isProcessing = false;
        }
    }
    assertCanPush() {
        if (!this.isProcessing && this.queuedExecuteCount === 0)
            return;
        throw new Error('Cannot push to history while undo/redo is in flight.');
    }
    pushAndTrim(command, options) {
        if (!(options === null || options === void 0 ? void 0 : options.skipProcessingCheck))
            this.assertCanPush();
        if (this.currentIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.currentIndex + 1);
        }
        this.history.push(command);
        if (this.history.length > this.maxSize) {
            this.history.shift();
        }
        else {
            this.currentIndex++;
        }
    }
}
//# sourceMappingURL=history-manager.js.map