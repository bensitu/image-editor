const UNSAFE_OBJECT_COPY_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
export function canCopySafeObjectKey(key) {
    return !UNSAFE_OBJECT_COPY_KEYS.has(key);
}
export function copySafeOwnProperties(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return {};
    const output = Object.create(null);
    for (const [key, nestedValue] of Object.entries(value)) {
        if (!canCopySafeObjectKey(key))
            continue;
        output[key] = nestedValue;
    }
    return output;
}
//# sourceMappingURL=safe-object-copy.js.map