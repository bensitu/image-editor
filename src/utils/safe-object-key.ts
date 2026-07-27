/**
 * Identifies property names that can mutate object prototypes during assignment.
 *
 * @module
 */

export function isUnsafeObjectKey(key: string): boolean {
    return key === '__proto__' || key === 'constructor' || key === 'prototype';
}
