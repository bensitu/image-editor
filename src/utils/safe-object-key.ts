/**
 * Provides the canonical prototype-pollution key policy for untrusted objects.
 *
 * @module
 */

const UNSAFE_OBJECT_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);

/** Returns whether an object key must be rejected at an untrusted data boundary. */
export function isUnsafeObjectKey(key: string): boolean {
    return UNSAFE_OBJECT_KEYS.has(key);
}
