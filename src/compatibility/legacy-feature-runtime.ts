/**
 * Temporary feature-only runtime boundary used while legacy features migrate
 * onto narrow Core and plugin ports.
 */
export interface LegacyFeatureCompatibilityPort {
    readonly attached: boolean;
    attach(): void;
    dispose(): void | Promise<void>;
}

export function createLegacyFeatureCompatibilityPort(): LegacyFeatureCompatibilityPort {
    let attached = false;
    return Object.freeze({
        get attached(): boolean {
            return attached;
        },
        attach(): void {
            attached = true;
        },
        dispose(): void {
            attached = false;
        },
    });
}
