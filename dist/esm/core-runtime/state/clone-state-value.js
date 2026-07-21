import { isDangerousStateKey } from '../../plugin-kernel/plugin-identifier.js';
export { isDangerousStateKey };
import { StateCloneError } from '../errors.js';
function isObject(value) {
    return typeof value === 'object' && value !== null;
}
function cloneFallback(value, seen) {
    var _a, _b;
    if (!isObject(value)) {
        if (typeof value === 'function' || typeof value === 'symbol') {
            throw new StateCloneError(`State contains an unsupported ${typeof value} value.`);
        }
        return value;
    }
    const existing = seen.get(value);
    if (existing !== undefined)
        return existing;
    if (value instanceof Date)
        return new Date(value.getTime());
    if (value instanceof ArrayBuffer)
        return value.slice(0);
    if (ArrayBuffer.isView(value)) {
        const source = value;
        return new Uint8Array(source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength));
    }
    if (value instanceof Map) {
        const result = new Map();
        seen.set(value, result);
        for (const [key, entry] of value) {
            result.set(cloneFallback(key, seen), cloneFallback(entry, seen));
        }
        return result;
    }
    if (value instanceof Set) {
        const result = new Set();
        seen.set(value, result);
        for (const entry of value)
            result.add(cloneFallback(entry, seen));
        return result;
    }
    if (Array.isArray(value)) {
        const result = [];
        seen.set(value, result);
        for (const entry of value)
            result.push(cloneFallback(entry, seen));
        return result;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
        throw new StateCloneError(`State contains unsupported object type "${(_b = (_a = prototype === null || prototype === void 0 ? void 0 : prototype.constructor) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : 'unknown'}".`);
    }
    const result = Object.create(null);
    seen.set(value, result);
    for (const key of Object.keys(value)) {
        if (isDangerousStateKey(key)) {
            throw new StateCloneError(`State contains dangerous key "${key}".`);
        }
        result[key] = cloneFallback(value[key], seen);
    }
    return result;
}
function deepFreeze(value, seen = new WeakSet()) {
    if (!isObject(value) || seen.has(value))
        return value;
    seen.add(value);
    if (value instanceof Map) {
        for (const [key, entry] of value) {
            deepFreeze(key, seen);
            deepFreeze(entry, seen);
        }
    }
    else if (value instanceof Set) {
        for (const entry of value)
            deepFreeze(entry, seen);
    }
    else {
        for (const key of Object.keys(value)) {
            deepFreeze(value[key], seen);
        }
    }
    try {
        Object.freeze(value);
    }
    catch {
    }
    return value;
}
export function cloneStateValue(value) {
    try {
        const structuredCloneFunction = globalThis.structuredClone;
        const cloned = typeof structuredCloneFunction === 'function'
            ? structuredCloneFunction(value)
            : cloneFallback(value, new Map());
        return deepFreeze(cloned);
    }
    catch (error) {
        if (error instanceof StateCloneError)
            throw error;
        throw new StateCloneError('State could not be cloned safely.', error);
    }
}
export function assertSafeImmutableReference(value, path = '$', seen = new WeakSet()) {
    var _a, _b;
    if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') {
        throw new StateCloneError(`Reference state at ${path} contains an unsupported ${typeof value}.`);
    }
    if (typeof value === 'number' && !Number.isFinite(value)) {
        throw new StateCloneError(`Reference state at ${path} contains a non-finite number.`);
    }
    if (!isObject(value))
        return;
    if (seen.has(value)) {
        throw new StateCloneError(`Reference state at ${path} contains a cyclic reference.`);
    }
    if (!Object.isFrozen(value)) {
        throw new StateCloneError(`Reference state at ${path} must be frozen.`);
    }
    const prototype = Object.getPrototypeOf(value);
    if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
        throw new StateCloneError(`Reference state at ${path} contains unsupported object type "${(_b = (_a = prototype === null || prototype === void 0 ? void 0 : prototype.constructor) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : 'unknown'}".`);
    }
    seen.add(value);
    for (const key of Object.keys(value)) {
        if (isDangerousStateKey(key)) {
            throw new StateCloneError(`Reference state at ${path} contains dangerous key "${key}".`);
        }
        assertSafeImmutableReference(value[key], Array.isArray(value) ? `${path}[${key}]` : `${path}.${key}`, seen);
    }
    seen.delete(value);
}
//# sourceMappingURL=clone-state-value.js.map