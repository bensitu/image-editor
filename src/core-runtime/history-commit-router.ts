import { createDisposable, type Disposable } from '../plugin-kernel/disposable.js';
import { CoreRuntimeError } from './errors.js';
import type { GeometryHistoryCommitPort, HistoryRecordDraft } from './geometry/index.js';
import type { CoreMemento } from './state/index.js';

export interface CoreHistoryRecord {
    readonly operationId: string;
    readonly before: CoreMemento;
    readonly after: CoreMemento;
    readonly timestamp: number;
    readonly detail?: unknown;
}

export interface CoreHistoryCommitPort {
    isAvailable(): boolean;
    commit(record: CoreHistoryRecord): void | Promise<void>;
}

const unavailableHistory: CoreHistoryCommitPort = Object.freeze({
    isAvailable: () => false,
    commit: () => undefined,
});

export class HistoryCommitRouter implements GeometryHistoryCommitPort {
    private provider: CoreHistoryCommitPort = unavailableHistory;
    private owner: string | null = null;

    register(owner: string, provider: CoreHistoryCommitPort): Disposable {
        if (owner.trim().length === 0 || owner.trim() !== owner) {
            throw new CoreRuntimeError('[ImageEditor] History provider owner must be non-empty.');
        }
        if (this.owner) {
            throw new CoreRuntimeError(
                `[ImageEditor] History commit provider is already registered by "${this.owner}".`,
            );
        }
        this.owner = owner;
        this.provider = provider;
        return createDisposable(() => {
            if (this.owner !== owner || this.provider !== provider) return;
            this.owner = null;
            this.provider = unavailableHistory;
        });
    }

    isAvailable(): boolean {
        return this.provider.isAvailable();
    }

    commit(record: HistoryRecordDraft | CoreHistoryRecord): void | Promise<void> {
        const coreRecord: CoreHistoryRecord = Object.freeze({
            operationId: record.operationId,
            before: record.before,
            after: record.after,
            timestamp: record.timestamp,
            detail: 'descriptor' in record ? record.descriptor : record.detail,
        });
        return this.provider.commit(coreRecord);
    }
}
