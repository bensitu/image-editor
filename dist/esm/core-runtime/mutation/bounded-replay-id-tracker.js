export const DEFAULT_RECENT_REPLAY_ID_LIMIT = 10000;
export class BoundedReplayIdTracker {
    constructor(recentLimit = DEFAULT_RECENT_REPLAY_ID_LIMIT) {
        Object.defineProperty(this, "recentLimit", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: recentLimit
        });
        Object.defineProperty(this, "activeIds", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Set()
        });
        Object.defineProperty(this, "recentCompletedIds", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Set()
        });
        if (!Number.isSafeInteger(recentLimit) || recentLimit <= 0) {
            throw new RangeError('recentLimit must be a positive safe integer.');
        }
    }
    get activeSize() {
        return this.activeIds.size;
    }
    get recentSize() {
        return this.recentCompletedIds.size;
    }
    has(id) {
        return this.activeIds.has(id) || this.recentCompletedIds.has(id);
    }
    start(id) {
        if (this.has(id))
            return false;
        this.activeIds.add(id);
        return true;
    }
    complete(id) {
        if (!this.activeIds.delete(id))
            return;
        this.recentCompletedIds.add(id);
        while (this.recentCompletedIds.size > this.recentLimit) {
            const oldest = this.recentCompletedIds.values().next().value;
            if (oldest === undefined)
                break;
            this.recentCompletedIds.delete(oldest);
        }
    }
    clear() {
        this.activeIds.clear();
        this.recentCompletedIds.clear();
    }
}
//# sourceMappingURL=bounded-replay-id-tracker.js.map