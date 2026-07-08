/**
 * Own-property copying helpers for user-provided config objects.
 *
 * @module
 */

const UNSAFE_OBJECT_COPY_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function canCopySafeObjectKey(key: string): boolean {
    return !UNSAFE_OBJECT_COPY_KEYS.has(key);
}

export function copySafeOwnProperties<T extends object>(value: unknown): Partial<T> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

    const output = Object.create(null) as Record<string, unknown>;
    for (const [key, nestedValue] of Object.entries(value)) {
        if (!canCopySafeObjectKey(key)) continue;
        output[key] = nestedValue;
    }
    return output as Partial<T>;
}
