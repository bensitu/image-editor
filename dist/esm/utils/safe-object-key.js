export function isUnsafeObjectKey(key) {
    return key === '__proto__' || key === 'constructor' || key === 'prototype';
}
//# sourceMappingURL=safe-object-key.js.map