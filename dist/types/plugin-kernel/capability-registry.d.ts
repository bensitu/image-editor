import { type CapabilityRequirement, type CapabilityToken } from './capability-token.js';
import { type Disposable } from './disposable.js';
import { type PluginErrorSink, type PluginWarningSink } from './reporting.js';
export interface CapabilityRegistryOptions {
    readonly warningSink?: PluginWarningSink;
    readonly errorSink?: PluginErrorSink;
}
export interface CapabilityProviderInfo {
    readonly capabilityId: string;
    readonly version: string;
    readonly providerPluginId: string;
    readonly complete: boolean;
}
export declare class CapabilityRegistry implements Disposable {
    private readonly options;
    private readonly providers;
    private disposed;
    constructor(options?: CapabilityRegistryOptions);
    provide<TPort>(token: CapabilityToken<TPort>, implementation: TPort, providerPluginId: string): Disposable;
    require<TPort>(requirement: CapabilityRequirement<TPort>, consumerPluginId: string): TPort;
    optional<TPort>(requirement: CapabilityRequirement<TPort>, consumerPluginId: string): TPort | null;
    getProviderInfo<TPort>(tokenOrId: CapabilityToken<TPort> | string): CapabilityProviderInfo | null;
    has<TPort>(tokenOrId: CapabilityToken<TPort> | string): boolean;
    dispose(): void;
    private resolve;
    private assertActive;
}
