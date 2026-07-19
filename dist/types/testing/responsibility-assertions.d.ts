/**
 * Implements conformance proofs for bundle isolation, ownership, transactions, state migration, and Fabric mutation.
 *
 * @module
 */
import type { MaybePromise, PluginPermission } from '../sdk/index.js';
import type { ConformanceAssertionResult } from './conformance-types.js';
type ProofSource<T> = T | (() => MaybePromise<T>);
export interface BundleIsolationObservation {
    readonly moduleIds: readonly string[];
    readonly internalImports: number;
    readonly privateAliases: number;
    readonly unknownModules?: number;
}
export interface PeerDependencyManifest {
    readonly name?: string;
    readonly peerDependencies?: Readonly<Record<string, string>>;
    readonly dependencies?: Readonly<Record<string, string>>;
    readonly optionalDependencies?: Readonly<Record<string, string>>;
    readonly bundledDependencies?: readonly string[] | boolean;
}
export interface PackageModuleObservation {
    readonly moduleIds: readonly string[];
    readonly bundledCoreModules?: number;
    readonly bundledFabricModules?: number;
}
export interface MultiInstanceObservation {
    readonly coreRegistriesIsolated: boolean;
    readonly pluginStateIsolated: boolean;
    readonly operationsIsolated: boolean;
    readonly toolsIsolated: boolean;
    readonly overlayIndexesIsolated: boolean;
    readonly historyIsolated: boolean;
    readonly fabricGlobalStateIsolated: boolean;
}
export interface BaseImageInvariantAttempt {
    readonly action: string;
    readonly rejected: boolean;
    readonly documentUnchanged: boolean;
    readonly historyUnchanged: boolean;
    readonly committedEventAbsent: boolean;
    readonly instanceUsable: boolean;
}
export interface BaseImageInvariantObservation {
    readonly attempts: readonly BaseImageInvariantAttempt[];
}
export interface OverlayMutationHistoryObservation {
    readonly topLevelTransactions: number;
    readonly historyRecords: number;
    readonly committedEvents: number;
    readonly registrationLeaks: number;
}
export interface CompoundTransactionObservation {
    readonly topLevelTransactions: number;
    readonly mementoPairs: number;
    readonly historyRecords: number;
    readonly committedEvents: number;
    readonly undoRestoredAll: boolean;
    readonly redoRestoredAll: boolean;
    readonly participantFailureRolledBackAll: boolean;
    readonly nestedWorkPublishedOnce: boolean;
    readonly activeSelectionAtomic: boolean;
}
export interface SliceMigrationObservation {
    readonly sourceVersion: number;
    readonly targetVersion: number;
    readonly migrated: boolean;
    readonly deterministic: boolean;
    readonly validatedBeforeCommit: boolean;
    readonly failedMigrationMutationCount: number;
    readonly futureVersionTypedFailure: boolean;
    readonly missingPluginPolicyPreserved: boolean;
    readonly privateAccesses: number;
}
export interface FabricGlobalMutationLifecycle<TModule = unknown, TDefinition extends {
    readonly manifest?: {
        readonly permissions?: readonly PluginPermission[];
    };
} = {
    readonly manifest?: {
        readonly permissions?: readonly PluginPermission[];
    };
}, TRuntime = unknown> {
    readonly fabric: Readonly<Record<PropertyKey, unknown>>;
    readonly declaredPermissions?: readonly PluginPermission[];
    importModule(): MaybePromise<TModule>;
    createDefinition(module: TModule): MaybePromise<TDefinition>;
    setup(definition: TDefinition): MaybePromise<TRuntime>;
    dispose(runtime: TRuntime, definition: TDefinition): MaybePromise<void>;
}
export interface ResponsibilityAssertionOptions {
    readonly bundleIsolation?: ProofSource<BundleIsolationObservation>;
    readonly fabricGlobalMutation?: FabricGlobalMutationLifecycle;
    readonly multiInstanceIsolation?: ProofSource<MultiInstanceObservation>;
    readonly peerDependencyContract?: ProofSource<PeerDependencyManifest>;
    readonly packageModules?: ProofSource<PackageModuleObservation>;
    readonly baseImageInvariant?: ProofSource<BaseImageInvariantObservation>;
    readonly overlayMutationHistory?: ProofSource<OverlayMutationHistoryObservation>;
    readonly compoundTransaction?: ProofSource<CompoundTransactionObservation>;
    readonly sliceMigration?: ProofSource<SliceMigrationObservation>;
}
interface DescriptorFingerprint {
    readonly configurable: boolean;
    readonly enumerable: boolean;
    readonly writable: boolean | undefined;
    readonly value: unknown;
    readonly get: (() => unknown) | undefined;
    readonly set: ((value: unknown) => void) | undefined;
}
type GlobalSnapshot = ReadonlyMap<string, ReadonlyMap<PropertyKey, DescriptorFingerprint>>;
export declare function assertBundleIsolation(source?: ProofSource<BundleIsolationObservation>): Promise<ConformanceAssertionResult>;
/** Captures bounded, measurable Fabric global surfaces without invoking getters. */
export declare function captureFabricGlobalState(fabric: Readonly<Record<PropertyKey, unknown>>): GlobalSnapshot;
export declare function assertNoUndeclaredFabricGlobalMutation(lifecycle?: FabricGlobalMutationLifecycle): Promise<ConformanceAssertionResult>;
export declare function assertStrongMultiInstanceIsolation(source?: ProofSource<MultiInstanceObservation>): Promise<ConformanceAssertionResult>;
export declare function assertPeerDependencyContract(source?: ProofSource<PeerDependencyManifest>): Promise<ConformanceAssertionResult>;
export declare function assertPackageDoesNotBundleCoreOrFabric(source?: ProofSource<PackageModuleObservation>): Promise<ConformanceAssertionResult>;
export declare function assertBaseImageInvariant(source?: ProofSource<BaseImageInvariantObservation>): Promise<ConformanceAssertionResult>;
export declare function assertOverlayMutationHistory(source?: ProofSource<OverlayMutationHistoryObservation>): Promise<ConformanceAssertionResult>;
export declare function assertCompoundTransaction(source?: ProofSource<CompoundTransactionObservation>): Promise<ConformanceAssertionResult>;
export declare function assertSliceMigration(source?: ProofSource<SliceMigrationObservation>): Promise<ConformanceAssertionResult>;
export {};
