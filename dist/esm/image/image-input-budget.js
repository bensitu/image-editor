import { ImageDecodeError } from '../core/errors.js';
const HEADER_PROBE_BYTES = 256 * 1024;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
function hasPositiveDimensions(width, height) {
    return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
}
function readUint16BE(bytes, offset) {
    if (offset < 0 || offset + 2 > bytes.length)
        return null;
    return (bytes[offset] << 8) | bytes[offset + 1];
}
function readUint32BE(bytes, offset) {
    if (offset < 0 || offset + 4 > bytes.length)
        return null;
    return (bytes[offset] * 0x1000000 +
        ((bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]));
}
function readUint16LE(bytes, offset) {
    if (offset < 0 || offset + 2 > bytes.length)
        return null;
    return bytes[offset] | (bytes[offset + 1] << 8);
}
function readUint24LE(bytes, offset) {
    if (offset < 0 || offset + 3 > bytes.length)
        return null;
    return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}
function matchesAscii(bytes, offset, value) {
    if (offset < 0 || offset + value.length > bytes.length)
        return false;
    for (let index = 0; index < value.length; index += 1) {
        if (bytes[offset + index] !== value.charCodeAt(index))
            return false;
    }
    return true;
}
function readPngDimensions(bytes) {
    if (bytes.length < 24)
        return null;
    if (!PNG_SIGNATURE.every((byte, index) => bytes[index] === byte))
        return null;
    if (!matchesAscii(bytes, 12, 'IHDR'))
        return null;
    const width = readUint32BE(bytes, 16);
    const height = readUint32BE(bytes, 20);
    return width !== null && height !== null && hasPositiveDimensions(width, height)
        ? { width, height }
        : null;
}
function isJpegStartOfFrame(marker) {
    return ((marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf));
}
function isStandaloneJpegMarker(marker) {
    return marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);
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
        if (isStandaloneJpegMarker(marker))
            continue;
        const segmentLength = readUint16BE(bytes, offset);
        if (segmentLength === null || segmentLength < 2)
            return null;
        const segmentStart = offset + 2;
        const segmentEnd = offset + segmentLength;
        if (segmentEnd > bytes.length)
            return null;
        if (isJpegStartOfFrame(marker)) {
            const height = readUint16BE(bytes, segmentStart + 1);
            const width = readUint16BE(bytes, segmentStart + 3);
            return width !== null && height !== null && hasPositiveDimensions(width, height)
                ? { width, height }
                : null;
        }
        offset = segmentEnd;
    }
    return null;
}
function readWebpDimensions(bytes) {
    if (bytes.length < 20 || !matchesAscii(bytes, 0, 'RIFF') || !matchesAscii(bytes, 8, 'WEBP')) {
        return null;
    }
    if (matchesAscii(bytes, 12, 'VP8X') && bytes.length >= 30) {
        const rawWidth = readUint24LE(bytes, 24);
        const rawHeight = readUint24LE(bytes, 27);
        if (rawWidth === null || rawHeight === null)
            return null;
        return { width: rawWidth + 1, height: rawHeight + 1 };
    }
    if (matchesAscii(bytes, 12, 'VP8 ') && bytes.length >= 30) {
        if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a)
            return null;
        const rawWidth = readUint16LE(bytes, 26);
        const rawHeight = readUint16LE(bytes, 28);
        if (rawWidth === null || rawHeight === null)
            return null;
        return { width: rawWidth & 0x3fff, height: rawHeight & 0x3fff };
    }
    if (matchesAscii(bytes, 12, 'VP8L') && bytes.length >= 25 && bytes[20] === 0x2f) {
        const byte1 = bytes[21];
        const byte2 = bytes[22];
        const byte3 = bytes[23];
        const byte4 = bytes[24];
        return {
            width: 1 + byte1 + ((byte2 & 0x3f) << 8),
            height: 1 + (byte2 >> 6) + (byte3 << 2) + ((byte4 & 0x0f) << 10),
        };
    }
    return null;
}
export function readImageHeaderDimensions(bytes) {
    var _a, _b;
    return (_b = (_a = readPngDimensions(bytes)) !== null && _a !== void 0 ? _a : readJpegDimensions(bytes)) !== null && _b !== void 0 ? _b : readWebpDimensions(bytes);
}
export function estimateBase64PayloadBytes(dataUrl) {
    const commaIndex = dataUrl.indexOf(',');
    if (commaIndex < 0)
        return null;
    const header = dataUrl.slice(0, commaIndex).toLowerCase();
    if (!header.endsWith(';base64'))
        return null;
    const base64 = dataUrl.slice(commaIndex + 1).replace(/\s+/g, '');
    if (!base64)
        return 0;
    const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
    return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}
function decodeBase64Prefix(dataUrl, maxBytes) {
    const commaIndex = dataUrl.indexOf(',');
    if (commaIndex < 0)
        return null;
    const header = dataUrl.slice(0, commaIndex).toLowerCase();
    if (!header.endsWith(';base64'))
        return null;
    const encodedLength = Math.ceil(maxBytes / 3) * 4;
    const base64 = dataUrl
        .slice(commaIndex + 1, commaIndex + 1 + encodedLength)
        .replace(/\s+/g, '');
    if (!base64)
        return new Uint8Array(0);
    const paddedBase64 = padBase64(base64);
    if (paddedBase64 === null)
        return null;
    const bufferCtor = globalThis.Buffer;
    if (bufferCtor && typeof bufferCtor.from === 'function') {
        return bufferCtor.from(paddedBase64, 'base64');
    }
    if (typeof globalThis.atob === 'function') {
        const binary = globalThis.atob(paddedBase64);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
            bytes[index] = binary.charCodeAt(index);
        }
        return bytes;
    }
    return null;
}
function padBase64(base64) {
    const remainder = base64.length % 4;
    if (remainder === 0)
        return base64;
    if (remainder === 1)
        return null;
    return `${base64}${'='.repeat(4 - remainder)}`;
}
async function readBlobAsArrayBuffer(blob) {
    if (typeof blob.arrayBuffer === 'function') {
        return blob.arrayBuffer();
    }
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result;
            if (result instanceof ArrayBuffer) {
                resolve(result);
            }
            else {
                reject(new Error('FileReader returned a non-ArrayBuffer result'));
            }
        };
        reader.onerror = () => {
            var _a;
            reject((_a = reader.error) !== null && _a !== void 0 ? _a : new Error('FileReader error'));
        };
        reader.onabort = () => {
            reject(new Error('FileReader read aborted'));
        };
        reader.readAsArrayBuffer(blob);
    });
}
function assertInputByteBudget(bytes, maxInputBytes) {
    if (bytes === null)
        return;
    if (bytes > maxInputBytes) {
        throw new ImageDecodeError(`Image input byte length ${bytes} exceeds maxInputBytes (${maxInputBytes}).`);
    }
}
function assertInputPixelBudget(dimensions, maxInputPixels) {
    if (!dimensions)
        return;
    const pixels = dimensions.width * dimensions.height;
    if (pixels > maxInputPixels) {
        throw new ImageDecodeError(`Image input dimensions ${dimensions.width}x${dimensions.height} exceed maxInputPixels (${maxInputPixels}).`);
    }
}
export function assertImageDataUrlInputBudget(dataUrl, options) {
    assertInputByteBudget(estimateBase64PayloadBytes(dataUrl), options.maxInputBytes);
    const headerBytes = decodeBase64Prefix(dataUrl, HEADER_PROBE_BYTES);
    assertInputPixelBudget(headerBytes ? readImageHeaderDimensions(headerBytes) : null, options.maxInputPixels);
}
export async function assertImageFileInputBudget(file, options) {
    assertInputByteBudget(file.size, options.maxInputBytes);
    const probeBlob = typeof file.slice === 'function' ? file.slice(0, HEADER_PROBE_BYTES) : file;
    const probeBuffer = await readBlobAsArrayBuffer(probeBlob);
    assertInputPixelBudget(readImageHeaderDimensions(new Uint8Array(probeBuffer)), options.maxInputPixels);
}
//# sourceMappingURL=image-input-budget.js.map