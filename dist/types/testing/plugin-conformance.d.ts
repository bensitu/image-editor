import { type EditorPlugin } from '../sdk/index.js';
import type { ConformanceAssertionResult } from './conformance-types.js';
import { type PluginTestCapabilityProvider } from './plugin-test-host.js';
import { type ResponsibilityAssertionOptions } from './responsibility-assertions.js';
export declare const CONFORMANCE_PROFILE: "3.0";
export type { ConformanceAssertionResult, ConformanceAssertionStatus, } from './conformance-types.js';
export interface PluginConformanceReport {
    readonly schemaVersion: 1;
    readonly profile: typeof CONFORMANCE_PROFILE;
    readonly packageVersion: string;
    readonly coreApiVersion: string;
    readonly plugin: Readonly<{
        id: string;
        version: string;
        apiVersion: string;
    }>;
    readonly assertions: readonly ConformanceAssertionResult[];
    readonly result: 'PASS' | 'FAIL';
}
export type PluginFactory<TApi, TEvents extends object = object> = () => EditorPlugin<TApi, TEvents>;
export interface StateRoundTripAdapter<TApi, TState> {
    capture(api: TApi): TState | Promise<TState>;
    mutate(api: TApi): void | Promise<void>;
    restore(api: TApi, state: TState): void | Promise<void>;
}
export interface PersistentKindContract {
    readonly id: string;
    readonly persistence: Readonly<{
        mode: 'transient';
    }> | Readonly<{
        mode: 'persistent';
        codec: Readonly<{
            type: string;
            version: string;
            serialize: unknown;
            validate: unknown;
            deserialize: unknown;
        }>;
    }>;
}
export interface PersistentKindInspection<TApi> {
    inspect(api: TApi, providers: readonly PluginTestCapabilityProvider[]): readonly PersistentKindContract[] | Promise<readonly PersistentKindContract[]>;
}
export interface PluginAssertionOptions<TApi, TEvents extends object = object, TState = unknown> {
    readonly createPlugin?: PluginFactory<TApi, TEvents>;
    readonly createDependencies?: () => readonly EditorPlugin<unknown, TEvents>[];
    readonly createHostCapabilities?: () => readonly PluginTestCapabilityProvider[];
    readonly lifecycleImage?: unknown;
    readonly stateRoundTrip?: StateRoundTripAdapter<TApi, TState> | 'not-applicable';
    readonly persistentKinds?: PersistentKindInspection<TApi> | 'not-applicable';
    readonly typeInferenceFixtures?: () => void | Promise<void>;
    readonly responsibilities?: ResponsibilityAssertionOptions;
}
export interface PluginConformanceOptions<TApi, TEvents extends object = object, TState = unknown> extends PluginAssertionOptions<TApi, TEvents, TState> {
    readonly profile: typeof CONFORMANCE_PROFILE;
}
export declare function assertInstallRollback<TApi, TEvents extends object = object>(plugin: EditorPlugin<TApi, TEvents>, options?: PluginAssertionOptions<TApi, TEvents>): Promise<ConformanceAssertionResult>;
export declare function assertLifecycleOrder<TApi, TEvents extends object = object>(plugin: EditorPlugin<TApi, TEvents>, options?: PluginAssertionOptions<TApi, TEvents>): Promise<ConformanceAssertionResult>;
export declare function assertNoLeakedRegistrations<TApi, TEvents extends object = object>(plugin: EditorPlugin<TApi, TEvents>, options?: PluginAssertionOptions<TApi, TEvents>): Promise<ConformanceAssertionResult>;
export declare function assertStateRoundTrip<TApi, TEvents extends object = object, TState = unknown>(plugin: EditorPlugin<TApi, TEvents>, options?: PluginAssertionOptions<TApi, TEvents, TState>): Promise<ConformanceAssertionResult>;
export declare function assertMissingCapabilityFailure<TApi, TEvents extends object = object>(plugin: EditorPlugin<TApi, TEvents>, options?: PluginAssertionOptions<TApi, TEvents>): Promise<ConformanceAssertionResult>;
export declare function assertOptionalCapabilityFallback<TApi, TEvents extends object = object>(plugin: EditorPlugin<TApi, TEvents>, options?: PluginAssertionOptions<TApi, TEvents>): Promise<ConformanceAssertionResult>;
export declare function assertPermissionDeclarationMatchesUsage<TApi, TEvents extends object = object>(plugin: EditorPlugin<TApi, TEvents>, options?: PluginAssertionOptions<TApi, TEvents>): Promise<ConformanceAssertionResult>;
export declare function assertPersistentKindCodecCoverage<TApi, TEvents extends object = object>(plugin: EditorPlugin<TApi, TEvents>, options?: PluginAssertionOptions<TApi, TEvents>): Promise<ConformanceAssertionResult>;
export declare function assertTypeInferenceFixtures(runFixtures?: () => void | Promise<void>): Promise<ConformanceAssertionResult>;
/** Runs the required Plugin contracts and returns a deterministic machine report. */
export declare function runPluginConformance<TApi, TEvents extends object = object, TState = unknown>(plugin: EditorPlugin<TApi, TEvents>, options: PluginConformanceOptions<TApi, TEvents, TState>): Promise<PluginConformanceReport>;
