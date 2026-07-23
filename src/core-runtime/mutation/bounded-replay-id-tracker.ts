/**
 * Bounds completed operation identifiers while retaining active and recent replay protection.
 *
 * @module
 */

export const DEFAULT_RECENT_REPLAY_ID_LIMIT = 10_000;

export class BoundedReplayIdTracker {
    private readonly activeIds = new Set<string>();
    private readonly recentCompletedIds = new Set<string>();

    constructor(private readonly recentLimit = DEFAULT_RECENT_REPLAY_ID_LIMIT) {
        if (!Number.isSafeInteger(recentLimit) || recentLimit <= 0) {
            throw new RangeError('recentLimit must be a positive safe integer.');
        }
    }

    get activeSize(): number {
        return this.activeIds.size;
    }

    get recentSize(): number {
        return this.recentCompletedIds.size;
    }

    has(id: string): boolean {
        return this.activeIds.has(id) || this.recentCompletedIds.has(id);
    }

    start(id: string): boolean {
        if (this.has(id)) return false;
        this.activeIds.add(id);
        return true;
    }

    complete(id: string): void {
        if (!this.activeIds.delete(id)) return;
        this.recentCompletedIds.add(id);
        while (this.recentCompletedIds.size > this.recentLimit) {
            const oldest = this.recentCompletedIds.values().next().value;
            if (oldest === undefined) break;
            this.recentCompletedIds.delete(oldest);
        }
    }

    clear(): void {
        this.activeIds.clear();
        this.recentCompletedIds.clear();
    }
}
