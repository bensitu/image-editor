declare const capabilityTokenBrand: unique symbol;
export interface CapabilityToken<TPort> {
    readonly id: string;
    readonly version: string;
    /** Phantom Port type. Runtime code never reads this field. */
    readonly __type?: TPort;
    readonly [capabilityTokenBrand]: true;
}
export interface CapabilityIdentity {
    readonly id: string;
    readonly version: string;
}
export interface CapabilityRequirementIdentity {
    readonly token: CapabilityIdentity;
    readonly range: string;
}
export interface CapabilityRequirement<TPort = unknown> extends CapabilityRequirementIdentity {
    readonly token: CapabilityToken<TPort>;
}
export declare function createCapabilityToken<TPort>(id: string, version: string): CapabilityToken<TPort>;
export declare function isCapabilityToken(value: unknown): value is CapabilityToken<unknown>;
export declare function assertCapabilityRequirement(requirement: CapabilityRequirementIdentity): void;
export {};
