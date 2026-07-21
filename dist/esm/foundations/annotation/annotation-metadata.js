import { isDangerousStateKey as isUnsafeObjectKey } from '../../plugin-kernel/plugin-identifier.js';
import { AnnotationValidationError } from './annotation-errors.js';
export const MAX_ANNOTATION_NAME_LENGTH = 128;
export const MAX_ANNOTATION_METADATA_DEPTH = 4;
export const MAX_ANNOTATION_METADATA_KEYS = 32;
export const MAX_ANNOTATION_METADATA_STRING_BYTES = 8 * 1024;
function isPlainRecord(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
        return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}
function cloneMetadataValue(value, depth, budget) {
    if (value === null || typeof value === 'boolean')
        return value;
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            throw new AnnotationValidationError('Annotation metadata numbers must be finite.');
        }
        return value;
    }
    if (typeof value === 'string') {
        budget.stringBytes += new TextEncoder().encode(value).byteLength;
        if (budget.stringBytes > MAX_ANNOTATION_METADATA_STRING_BYTES) {
            throw new AnnotationValidationError('Annotation metadata string data is too large.');
        }
        return value;
    }
    if (typeof value !== 'object' || value === null) {
        throw new AnnotationValidationError('Annotation metadata must be JSON-serializable.');
    }
    if (depth >= MAX_ANNOTATION_METADATA_DEPTH) {
        throw new AnnotationValidationError('Annotation metadata is nested too deeply.');
    }
    if (budget.ancestors.has(value)) {
        throw new AnnotationValidationError('Annotation metadata cannot contain cycles.');
    }
    budget.ancestors.add(value);
    try {
        if (Array.isArray(value)) {
            if (value.length > MAX_ANNOTATION_METADATA_KEYS) {
                throw new AnnotationValidationError('Annotation metadata arrays are too large.');
            }
            return Object.freeze(value.map((entry) => cloneMetadataValue(entry, depth + 1, budget)));
        }
        if (!isPlainRecord(value)) {
            throw new AnnotationValidationError('Annotation metadata objects must be plain.');
        }
        const entries = Object.entries(value);
        budget.keyCount += entries.length;
        if (budget.keyCount > MAX_ANNOTATION_METADATA_KEYS) {
            throw new AnnotationValidationError('Annotation metadata contains too many keys.');
        }
        const clone = {};
        for (const [key, entry] of entries) {
            if (isUnsafeObjectKey(key) || key.length === 0 || key.length > 128) {
                throw new AnnotationValidationError('Annotation metadata contains an unsafe key.');
            }
            budget.stringBytes += new TextEncoder().encode(key).byteLength;
            clone[key] = cloneMetadataValue(entry, depth + 1, budget);
        }
        return Object.freeze(clone);
    }
    finally {
        budget.ancestors.delete(value);
    }
}
export function normalizeAnnotationName(value, fallback) {
    const candidate = value === undefined ? fallback : value;
    if (typeof candidate !== 'string' ||
        candidate.length === 0 ||
        candidate.trim() !== candidate ||
        candidate.length > MAX_ANNOTATION_NAME_LENGTH) {
        throw new AnnotationValidationError(`Annotation name must be a trimmed string of at most ${MAX_ANNOTATION_NAME_LENGTH} characters.`);
    }
    return candidate;
}
export function normalizeAnnotationMetadata(value = {}) {
    if (!isPlainRecord(value)) {
        throw new AnnotationValidationError('Annotation metadata must be a plain object.');
    }
    return cloneMetadataValue(value, 0, {
        keyCount: 0,
        stringBytes: 0,
        ancestors: new Set(),
    });
}
export function isValidAnnotationMetadata(value) {
    try {
        normalizeAnnotationMetadata(value);
        return true;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=annotation-metadata.js.map