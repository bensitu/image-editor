import { createDisposable } from '../plugin-kernel/disposable.js';
import { CoreRuntimeError } from './errors.js';
const unavailableHistory = Object.freeze({
    isAvailable: () => false,
    commit: () => undefined,
});
export class HistoryCommitRouter {
    constructor() {
        Object.defineProperty(this, "provider", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: unavailableHistory
        });
        Object.defineProperty(this, "owner", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
    }
    register(owner, provider) {
        if (owner.trim().length === 0 || owner.trim() !== owner) {
            throw new CoreRuntimeError('[ImageEditor] History provider owner must be non-empty.');
        }
        if (this.owner) {
            throw new CoreRuntimeError(`[ImageEditor] History commit provider is already registered by "${this.owner}".`);
        }
        this.owner = owner;
        this.provider = provider;
        return createDisposable(() => {
            if (this.owner !== owner || this.provider !== provider)
                return;
            this.owner = null;
            this.provider = unavailableHistory;
        });
    }
    isAvailable() {
        return this.provider.isAvailable();
    }
    commit(record) {
        const coreRecord = Object.freeze({
            operationId: record.operationId,
            before: record.before,
            after: record.after,
            timestamp: record.timestamp,
            detail: 'descriptor' in record ? record.descriptor : record.detail,
        });
        return this.provider.commit(coreRecord);
    }
}
//# sourceMappingURL=history-commit-router.js.map