/**
 * Validates shared Runtime ID and unsafe object-key policies.
 *
 * @module
 */

import { InvalidPluginDefinitionError } from './errors.js';

const RUNTIME_IDENTIFIER_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*$/u;

/** Returns whether an object key must be rejected at an untrusted data boundary. */
export function isDangerousStateKey(key: string): boolean {
    return key === '__proto__' || key === 'constructor' || key === 'prototype';
}

export function isRuntimeIdentifier(value: unknown): value is string {
    return (
        typeof value === 'string' &&
        value.length < 129 &&
        RUNTIME_IDENTIFIER_PATTERN.test(value) &&
        !value.split(':').some(isDangerousStateKey)
    );
}

export function assertPluginIdentifier(pluginId: unknown, fieldName = 'Plugin id'): string {
    if (!isRuntimeIdentifier(pluginId)) {
        throw new InvalidPluginDefinitionError(
            `${fieldName} must use namespace:kebab-case and be at most 128 characters.`,
            typeof pluginId === 'string' ? pluginId : undefined,
        );
    }
    return pluginId;
}
