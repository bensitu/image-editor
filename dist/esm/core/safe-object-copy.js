import { isUnsafeObjectKey } from '../utils/safe-object-key.js';
export function canCopySafeObjectKey(key) {
    return !isUnsafeObjectKey(key);
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