/**
 * Validates the shared Runtime ID contract and applies it to Plugin identities.
 *
 * @module
 */
export declare function isRuntimeIdentifier(value: unknown): value is string;
export declare function assertPluginIdentifier(pluginId: unknown, fieldName?: string): string;
