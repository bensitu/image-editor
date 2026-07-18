const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const HEADER_PROBE_BYTES = 256 * 1024;
function matchesAscii(bytes, offset, value) {
    if (offset < 0 || offset + value.length > bytes.length)
        return false;
    for (let index = 0; index < value.length; index += 1) {
        if (bytes[offset + index] !== value.charCodeAt(index))
            return false;
    }
    return true;
}
function uint16BE(bytes, offset) {
    if (offset < 0 || offset + 2 > bytes.length)
        return null;
    return (bytes[offset] << 8) | bytes[offset + 1];
}
function uint16LE(bytes, offset) {
    if (offset < 0 || offset + 2 > bytes.length)
        return null;
    return bytes[offset] | (bytes[offset + 1] << 8);
}
function uint24LE(bytes, offset) {
    if (offset < 0 || offset + 3 > bytes.length)
        return null;
    return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}
function uint32BE(bytes, offset) {
    if (offset < 0 || offset + 4 > bytes.length)
        return null;
    return (bytes[offset] * 0x1000000 +
        ((bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]));
}
function positiveDimensions(width, height) {
    return width !== null && height !== null && width > 0 && height > 0
        ? Object.freeze({ width, height })
        : null;
}
function readPngDimensions(bytes) {
    if (bytes.length < 24 ||
        !PNG_SIGNATURE.every((byte, index) => bytes[index] === byte) ||
        !matchesAscii(bytes, 12, 'IHDR')) {
        return null;
    }
    return positiveDimensions(uint32BE(bytes, 16), uint32BE(bytes, 20));
}
function isJpegStartOfFrame(marker) {
    return ((marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf));
}
function readJpegDimensions(bytes) {
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8)
        return null;
    let offset = 2;
    while (offset + 1 < bytes.length) {
        while (offset < bytes.length && bytes[offset] === 0xff)
            offset += 1;
        if (offset >= bytes.length)
            return null;
        const marker = bytes[offset];
        offset += 1;
        if (marker === 0xda || marker === 0xd9)
            return null;
        if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7))
            continue;
        const length = uint16BE(bytes, offset);
        if (length === null || length < 2 || offset + length > bytes.length)
            return null;
        if (isJpegStartOfFrame(marker) && length >= 7) {
            return positiveDimensions(uint16BE(bytes, offset + 5), uint16BE(bytes, offset + 3));
        }
        offset += length;
    }
    return null;
}
function readWebpDimensions(bytes) {
    var _a, _b;
    if (bytes.length < 20 || !matchesAscii(bytes, 0, 'RIFF') || !matchesAscii(bytes, 8, 'WEBP')) {
        return null;
    }
    if (matchesAscii(bytes, 12, 'VP8X') && bytes.length >= 30) {
        const width = uint24LE(bytes, 24);
        const height = uint24LE(bytes, 27);
        return width === null || height === null
            ? null
            : Object.freeze({ width: width + 1, height: height + 1 });
    }
    if (matchesAscii(bytes, 12, 'VP8 ') && bytes.length >= 30) {
        return positiveDimensions(((_a = uint16LE(bytes, 26)) !== null && _a !== void 0 ? _a : 0) & 0x3fff, ((_b = uint16LE(bytes, 28)) !== null && _b !== void 0 ? _b : 0) & 0x3fff);
    }
    if (matchesAscii(bytes, 12, 'VP8L') && bytes.length >= 25 && bytes[20] === 0x2f) {
        return Object.freeze({
            width: 1 + bytes[21] + ((bytes[22] & 0x3f) << 8),
            height: 1 + (bytes[22] >> 6) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10),
        });
    }
    return null;
}
function decodePrefix(base64) {
    const encoded = base64.slice(0, Math.ceil(HEADER_PROBE_BYTES / 3) * 4).replace(/\s+/g, '');
    if (!encoded)
        return new Uint8Array();
    const remainder = encoded.length % 4;
    if (remainder === 1)
        return null;
    const padded = remainder === 0 ? encoded : `${encoded}${'='.repeat(4 - remainder)}`;
    const buffer = globalThis.Buffer;
    if (buffer)
        return buffer.from(padded, 'base64');
    if (typeof globalThis.atob !== 'function')
        return null;
    const binary = globalThis.atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
export function inspectEncodedImageDataUrl(value) {
    var _a, _b;
    const match = /^data:(image\/(?:png|jpeg|webp));base64,([\s\S]*)$/i.exec(value);
    if (!match)
        return null;
    const mimeType = match[1].toLowerCase();
    const base64 = match[2].replace(/\s+/g, '');
    const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
    const encodedBytes = Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
    const prefix = decodePrefix(base64);
    const dimensions = prefix
        ? ((_b = (_a = readPngDimensions(prefix)) !== null && _a !== void 0 ? _a : readJpegDimensions(prefix)) !== null && _b !== void 0 ? _b : readWebpDimensions(prefix))
        : null;
    return Object.freeze({ mimeType, encodedBytes, dimensions });
}
//# sourceMappingURL=image-data-url.js.map