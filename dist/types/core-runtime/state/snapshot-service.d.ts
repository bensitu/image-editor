import type { Disposable } from '../../plugin-kernel/disposable.js';
import type { MementoService } from './memento-service.js';
import type { CoreStateAdapter, EditorSnapshot, MissingPluginPolicy, PluginMementoEntry, SnapshotMigration, StateWarningSink } from './state-types.js';
import type { StateSliceRegistry } from './state-slice-registry.js';
export interface SnapshotLimits {
    readonly maxInputBytes: number;
    readonly maxDepth: number;
    readonly maxObjectCount: number;
    readonly maxPluginCount: number;
    readonly maxPluginPayloadBytes: number;
    readonly maxMetadataBytes: number;
    readonly maxStringLength: number;
    readonly maxDataUrlBytes: number;
    readonly maxDecodedPixels: number;
    readonly maxImageDimension: number;
    readonly externalUrlPolicy: 'reject' | 'allow';
}
export interface SnapshotLoadOptions {
    readonly missingPluginPolicy?: MissingPluginPolicy;
    readonly migrations?: readonly SnapshotMigration[];
    readonly signal?: AbortSignal;
    readonly rollbackOnFailure?: boolean;
}
export declare const DEFAULT_SNAPSHOT_LIMITS: SnapshotLimits;
declare const preparedSnapshotBrand: unique symbol;
export interface PreparedSnapshotLoad {
    readonly core: Readonly<Record<string, unknown>>;
    readonly validatedSlices: readonly Readonly<{
        id: string;
        value: unknown;
    }>[];
    readonly opaqueSlices: readonly Readonly<{
        id: string;
        entry: PluginMementoEntry;
    }>[];
    readonly [preparedSnapshotBrand]: true;
}
export declare class SnapshotService implements Disposable {
    private readonly coreAdapter;
    private readonly slices;
    private readonly mementos;
    private readonly warningSink?;
    private readonly limits;
    private opaque;
    private prepared;
    private disposed;
    constructor(coreAdapter: CoreStateAdapter, slices: StateSliceRegistry, mementos: MementoService, warningSink?: StateWarningSink | undefined, limits?: SnapshotLimits);
    capture(): EditorSnapshot;
    stringify(): string;
    load(input: string | unknown, options?: SnapshotLoadOptions): Promise<void>;
    prepare(input: string | unknown, options?: Pick<SnapshotLoadOptions, 'missingPluginPolicy'>): PreparedSnapshotLoad;
    prepareForLoad(input: string | unknown, options?: Pick<SnapshotLoadOptions, 'migrations' | 'missingPluginPolicy' | 'signal'>): Promise<PreparedSnapshotLoad>;
    private prepareParsed;
    loadPrepared(prepared: PreparedSnapshotLoad, options?: Omit<SnapshotLoadOptions, 'missingPluginPolicy'>): Promise<void>;
    dispose(): void;
    reset(): void;
    private validateEnvelope;
    private assertActive;
}
export {};
