import { type Disposable } from '../plugin-kernel/disposable.js';
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
export declare class HistoryCommitRouter implements GeometryHistoryCommitPort {
    private provider;
    private owner;
    register(owner: string, provider: CoreHistoryCommitPort): Disposable;
    isAvailable(): boolean;
    commit(record: HistoryRecordDraft | CoreHistoryRecord): void | Promise<void>;
}
