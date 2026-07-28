const BOOLEAN_BYTES = 4;
const DATE_BYTES = 8;
const NUMBER_BYTES = 8;
const OBJECT_OVERHEAD_BYTES = 16;
const COLLECTION_ENTRY_OVERHEAD_BYTES = 8;
const PROPERTY_OVERHEAD_BYTES = 8;
function addBytes(total, additional) {
    return total > Number.MAX_SAFE_INTEGER - additional
        ? Number.MAX_SAFE_INTEGER
        : total + additional;
}
function utf8ByteLength(value) {
    let bytes = 0;
    for (let index = 0; index < value.length; index += 1) {
        const codeUnit = value.charCodeAt(index);
        if (codeUnit <= 0x7f) {
            bytes += 1;
        }
        else if (codeUnit <= 0x7ff) {
            bytes += 2;
        }
        else if (codeUnit >= 0xd800 &&
            codeUnit <= 0xdbff &&
            index + 1 < value.length &&
            value.charCodeAt(index + 1) >= 0xdc00 &&
            value.charCodeAt(index + 1) <= 0xdfff) {
            bytes += 4;
            index += 1;
        }
        else {
            bytes += 3;
        }
    }
    return bytes;
}
function estimatePropertyKeyBytes(key) {
    var _a;
    const text = typeof key === 'symbol' ? ((_a = key.description) !== null && _a !== void 0 ? _a : '') : String(key);
    return utf8ByteLength(text);
}
function estimateObjectBytes(value, seen) {
    if (seen.has(value))
        return 0;
    seen.add(value);
    if (value instanceof ArrayBuffer)
        return value.byteLength;
    if (ArrayBuffer.isView(value))
        return value.byteLength;
    if (value instanceof Date)
        return DATE_BYTES;
    let bytes = OBJECT_OVERHEAD_BYTES;
    if (value instanceof Map) {
        for (const [key, entryValue] of value) {
            bytes = addBytes(bytes, COLLECTION_ENTRY_OVERHEAD_BYTES);
            bytes = addBytes(bytes, estimateValueBytes(key, seen));
            bytes = addBytes(bytes, estimateValueBytes(entryValue, seen));
        }
        return bytes;
    }
    if (value instanceof Set) {
        for (const entryValue of value) {
            bytes = addBytes(bytes, COLLECTION_ENTRY_OVERHEAD_BYTES);
            bytes = addBytes(bytes, estimateValueBytes(entryValue, seen));
        }
        return bytes;
    }
    for (const key of Reflect.ownKeys(value)) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || !('value' in descriptor))
            continue;
        bytes = addBytes(bytes, PROPERTY_OVERHEAD_BYTES);
        bytes = addBytes(bytes, estimatePropertyKeyBytes(key));
        bytes = addBytes(bytes, estimateValueBytes(descriptor.value, seen));
    }
    return bytes;
}
function estimateValueBytes(value, seen) {
    var _a;
    switch (typeof value) {
        case 'undefined':
            return 0;
        case 'boolean':
            return BOOLEAN_BYTES;
        case 'number':
            return NUMBER_BYTES;
        case 'bigint':
            return utf8ByteLength(value.toString());
        case 'string':
            return utf8ByteLength(value);
        case 'symbol':
            return utf8ByteLength((_a = value.description) !== null && _a !== void 0 ? _a : '');
        case 'function':
            return estimateObjectBytes(value, seen);
        case 'object':
            return value === null ? 0 : estimateObjectBytes(value, seen);
    }
}
export function estimateRetainedBytes(value) {
    return estimateValueBytes(value, new WeakSet());
}
//# sourceMappingURL=retained-size-estimator.js.map