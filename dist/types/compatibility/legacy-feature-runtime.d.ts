/**
 * Temporary feature-only runtime boundary used while legacy features migrate
 * onto narrow Core and plugin ports.
 */
export interface LegacyFeatureCompatibilityPort {
    readonly attached: boolean;
    attach(): void;
    dispose(): void | Promise<void>;
}
export declare function createLegacyFeatureCompatibilityPort(): LegacyFeatureCompatibilityPort;
