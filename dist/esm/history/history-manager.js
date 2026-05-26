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
        Object.defineProperty(this, "_processing", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "maxSize", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.maxSize = maxSize;
    }
    execute(command) {
        void command.execute();
        this._pushAndTrim(command);
    }
    push(command) {
        this._pushAndTrim(command);
    }
    canUndo() {
        return this.currentIndex >= 0;
    }
    canRedo() {
        return this.currentIndex < this.history.length - 1;
    }
    async undo() {
        if (this._processing || !this.canUndo())
            return;
        this._processing = true;
        try {
            const cmd = this.history[this.currentIndex];
            if (!cmd)
                return;
            await cmd.undo();
            this.currentIndex--;
        }
        finally {
            this._processing = false;
        }
    }
    async redo() {
        if (this._processing || !this.canRedo())
            return;
        this._processing = true;
        try {
            const cmd = this.history[this.currentIndex + 1];
            if (!cmd)
                return;
            await cmd.execute();
            this.currentIndex++;
        }
        finally {
            this._processing = false;
        }
    }
    _pushAndTrim(command) {
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