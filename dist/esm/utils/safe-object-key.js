const UNSAFE_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
export function isUnsafeObjectKey(key) {
    return UNSAFE_OBJECT_KEYS.has(key);
}
//# sourceMappingURL=safe-object-key.js.map