import type { Disposable } from '../../plugin-kernel/disposable.js';
import type { MementoService } from './memento-service.js';
import type { CoreStateAdapter, EditorSnapshotV3, MissingPluginPolicy, PluginMementoEntry, StateWarningSink } from './state-types.js';
import type { StateSliceRegistry } from './state-slice-registry.js';
export interface SnapshotLimits {
    readonly maxInputBytes: number;
    readonly maxDepth: number;
    readonly maxPluginCount: number;
    readonly maxPluginPayloadBytes: number;
    readonly maxMetadataBytes: number;
}
export interface SnapshotLoadOptions {
    readonly missingPluginPolicy?: MissingPluginPolicy;
    readonly signal?: AbortSignal;
}
export declare const DEFAULT_SNAPSHOT_LIMITS: SnapshotLimits;
export declare class SnapshotService implements Disposable {
    private readonly coreAdapter;
    private readonly slices;
    private readonly mementos;
    private readonly warningSink?;
    private readonly limits;
    private opaque;
    private disposed;
    constructor(coreAdapter: CoreStateAdapter, slices: StateSliceRegistry, mementos: MementoService, warningSink?: StateWarningSink | undefined, limits?: SnapshotLimits);
    capture(): EditorSnapshotV3;
    stringify(): string;
    load(input: string | unknown, options?: SnapshotLoadOptions): Promise<void>;
    dispose(): void;
    private validateEnvelope;
    private assertActive;
}
export interface SnapshotMigrationResult {
    readonly snapshot: EditorSnapshotV3;
    readonly warnings: readonly string[];
}
/** Phase 2 dispatcher. Feature-specific field migration is supplied through hooks in later phases. */
export declare function migrateV2SnapshotToV3(input: unknown, migratePlugins?: (source: Readonly<Record<string, unknown>>) => Readonly<Record<string, PluginMementoEntry>>): SnapshotMigrationResult;
