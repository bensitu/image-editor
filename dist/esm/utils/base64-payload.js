const STANDARD_BASE64_BODY_PATTERN = /^[A-Za-z0-9+/]*$/u;
export function base64PayloadByteLength(payload) {
    const firstPaddingIndex = payload.indexOf('=');
    const body = firstPaddingIndex === -1 ? payload : payload.slice(0, firstPaddingIndex);
    const padding = firstPaddingIndex === -1 ? '' : payload.slice(firstPaddingIndex);
    if (!STANDARD_BASE64_BODY_PATTERN.test(body) ||
        (padding !== '' && !/^={1,2}$/u.test(padding))) {
        throw new TypeError('Base64 payload contains non-standard characters or padding.');
    }
    const remainder = payload.length % 4;
    if (remainder === 1 || (padding.length > 0 && remainder !== 0)) {
        throw new RangeError('Base64 payload length is malformed.');
    }
    return Math.floor((payload.length * 3) / 4) - padding.length;
}
//# sourceMappingURL=base64-payload.js.map