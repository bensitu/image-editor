'use strict';

const UNSAFE_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
function isUnsafeObjectKey(key) {
    return UNSAFE_OBJECT_KEYS.has(key);
}

exports.isUnsafeObjectKey = isUnsafeObjectKey;
//# sourceMappingURL=safe-object-key-WmIq_B8a.cjs.map
