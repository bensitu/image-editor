/**
 * Validates shared Runtime ID and unsafe object-key policies.
 *
 * @module
 */
/** Returns whether an object key must be rejected at an untrusted data boundary. */
export declare function isDangerousStateKey(key: string): boolean;
export declare function isRuntimeIdentifier(value: unknown): value is string;
export declare function assertPluginIdentifier(pluginId: unknown, fieldName?: string): string;
