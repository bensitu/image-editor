/**
 * Clones and freezes Plugin state while rejecting dangerous keys and unsafe shared references.
 *
 * @module
 */

const dangerousKeys = new Set(['__proto__', 'constructor', 'prototype']);
import { StateCloneError } from '../errors.js';

function isObject(value: unknown): value is object {
    return typeof value === 'object' && value !== null;
}

function cloneFallback(value: unknown, seen: Map<object, unknown>): unknown {
    if (!isObject(value)) {
        if (typeof value === 'function' || typeof value === 'symbol') {
            throw new StateCloneError(`State contains an unsupported ${typeof value} value.`);
        }
        return value;
    }
    const existing = seen.get(value);
    if (existing !== undefined) return existing;
    if (value instanceof Date) return new Date(value.getTime());
    if (value instanceof ArrayBuffer) return value.slice(0);
    if (ArrayBuffer.isView(value)) {
        const source = value as ArrayBufferView;
        return new Uint8Array(
            source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength),
        );
    }
    if (value instanceof Map) {
        const result = new Map<unknown, unknown>();
        seen.set(value, result);
        for (const [key, entry] of value) {
            result.set(cloneFallback(key, seen), cloneFallback(entry, seen));
        }
        return result;
    }
    if (value instanceof Set) {
        const result = new Set<unknown>();
        seen.set(value, result);
        for (const entry of value) result.add(cloneFallback(entry, seen));
        return result;
    }
    if (Array.isArray(value)) {
        const result: unknown[] = [];
        seen.set(value, result);
        for (const entry of value) result.push(cloneFallback(entry, seen));
        return result;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
        throw new StateCloneError(
            `State contains unsupported object type "${prototype?.constructor?.name ?? 'unknown'}".`,
        );
    }
    const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    seen.set(value, result);
    for (const key of Object.keys(value)) {
        if (isDangerousStateKey(key)) {
            throw new StateCloneError(`State contains dangerous key "${key}".`);
        }
        result[key] = cloneFallback((value as Record<string, unknown>)[key], seen);
    }
    return result;
}

function deepFreeze(value: unknown, seen = new WeakSet<object>()): unknown {
    if (!isObject(value) || seen.has(value)) return value;
    seen.add(value);
    if (value instanceof Map) {
        for (const [key, entry] of value) {
            deepFreeze(key, seen);
            deepFreeze(entry, seen);
        }
    } else if (value instanceof Set) {
        for (const entry of value) deepFreeze(entry, seen);
    } else {
        for (const key of Object.keys(value)) {
            deepFreeze((value as Record<string, unknown>)[key], seen);
        }
    }
    try {
        Object.freeze(value);
    } catch {
        // Some typed-array implementations cannot be frozen; the cloned buffer still prevents aliasing.
    }
    return value;
}

/** Creates an alias-free state value without using JSON as a fake deep clone. */
export function cloneStateValue<T>(value: T): T {
    try {
        const structuredCloneFunction = globalThis.structuredClone;
        const cloned =
            typeof structuredCloneFunction === 'function'
                ? structuredCloneFunction(value)
                : cloneFallback(value, new Map());
        return deepFreeze(cloned) as T;
    } catch (error) {
        if (error instanceof StateCloneError) throw error;
        throw new StateCloneError('State could not be cloned safely.', error);
    }
}

/** Verifies that a value is safe to retain by reference in a trusted Memento. */
export function assertSafeImmutableReference(
    value: unknown,
    path = '$',
    seen = new WeakSet<object>(),
): void {
    if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
        throw new StateCloneError(
            `Reference state at ${path} contains an unsupported ${typeof value}.`,
        );
    }
    if (typeof value === 'number' && !Number.isFinite(value)) {
        throw new StateCloneError(`Reference state at ${path} contains a non-finite number.`);
    }
    if (!isObject(value)) return;
    if (seen.has(value)) {
        throw new StateCloneError(`Reference state at ${path} contains a cyclic reference.`);
    }
    if (!Object.isFrozen(value)) {
        throw new StateCloneError(`Reference state at ${path} must be frozen.`);
    }
    const prototype = Object.getPrototypeOf(value);
    if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
        throw new StateCloneError(
            `Reference state at ${path} contains unsupported object type "${prototype?.constructor?.name ?? 'unknown'}".`,
        );
    }
    seen.add(value);
    for (const key of Object.keys(value)) {
        if (isDangerousStateKey(key)) {
            throw new StateCloneError(
                `Reference state at ${path} contains dangerous key "${key}".`,
            );
        }
        assertSafeImmutableReference(
            (value as Record<string, unknown>)[key],
            Array.isArray(value) ? `${path}[${key}]` : `${path}.${key}`,
            seen,
        );
    }
    seen.delete(value);
}

export function isDangerousStateKey(key: string): boolean {
    return dangerousKeys.has(key);
}
