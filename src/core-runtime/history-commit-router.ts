/**
 * Routes committed document mutations to the active History provider.
 *
 * @module
 */

import { createDisposable, type Disposable } from '../plugin-kernel/disposable.js';
import { isRuntimeIdentifier } from '../plugin-kernel/plugin-identifier.js';
import { CoreRuntimeError } from './errors.js';
import type { DocumentMutationHistoryPort } from './mutation/index.js';
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

export class HistoryCommitRouter implements CoreHistoryCommitPort, DocumentMutationHistoryPort {
    private provider: CoreHistoryCommitPort = unavailableHistory;
    private owner: string | null = null;

    register(owner: string, provider: CoreHistoryCommitPort): Disposable {
        if (!isRuntimeIdentifier(owner)) {
            throw new CoreRuntimeError('[ImageEditor] Invalid History provider owner Runtime ID.');
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

    commit(record: CoreHistoryRecord): void | Promise<void> {
        const coreRecord: CoreHistoryRecord = Object.freeze({
            operationId: record.operationId,
            before: record.before,
            after: record.after,
            timestamp: record.timestamp,
            detail: record.detail,
        });
        return this.provider.commit(coreRecord);
    }
}
