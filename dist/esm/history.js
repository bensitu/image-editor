export class Command {
    constructor(execute, undo) {
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
export class HistoryManager {
    constructor(maxSize = 50) {
        Object.defineProperty(this, "maxSize", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: maxSize
        });
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
    }
    execute(command) {
        void command.execute();
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
    push(command) {
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
            if (cmd) {
                this.currentIndex--;
                await cmd.undo();
            }
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
            this.currentIndex++;
            const cmd = this.history[this.currentIndex];
            if (cmd)
                await cmd.execute();
        }
        finally {
            this._processing = false;
        }
    }
}
//# sourceMappingURL=history.js.map