/**
 * Inspects encoded image data URLs and extracts MIME type and dimensions from bounded header probes.
 *
 * @module
 */

export interface EncodedImageInspection {
    readonly mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
    readonly encodedBytes: number;
    readonly dimensions: Readonly<{ width: number; height: number }> | null;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const HEADER_PROBE_BYTES = 256 * 1024;
const HEADER_PROBE_BASE64_CHARACTERS = Math.ceil(HEADER_PROBE_BYTES / 3) * 4;
const MAX_DATA_URL_HEADER_LENGTH = 64;
const ASCII_CHUNK_SIZE = 8 * 1024;

function matchesAscii(bytes: Uint8Array, offset: number, value: string): boolean {
    if (offset < 0 || offset + value.length > bytes.length) return false;
    for (let index = 0; index < value.length; index += 1) {
        if (bytes[offset + index] !== value.charCodeAt(index)) return false;
    }
    return true;
}

function uint16BE(bytes: Uint8Array, offset: number): number | null {
    if (offset < 0 || offset + 2 > bytes.length) return null;
    return (bytes[offset]! << 8) | bytes[offset + 1]!;
}

function uint16LE(bytes: Uint8Array, offset: number): number | null {
    if (offset < 0 || offset + 2 > bytes.length) return null;
    return bytes[offset]! | (bytes[offset + 1]! << 8);
}

function uint24LE(bytes: Uint8Array, offset: number): number | null {
    if (offset < 0 || offset + 3 > bytes.length) return null;
    return bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16);
}

function uint32BE(bytes: Uint8Array, offset: number): number | null {
    if (offset < 0 || offset + 4 > bytes.length) return null;
    return (
        bytes[offset]! * 0x1000000 +
        ((bytes[offset + 1]! << 16) | (bytes[offset + 2]! << 8) | bytes[offset + 3]!)
    );
}

function positiveDimensions(width: number | null, height: number | null) {
    return width !== null && height !== null && width > 0 && height > 0
        ? Object.freeze({ width, height })
        : null;
}

function readPngDimensions(bytes: Uint8Array) {
    if (
        bytes.length < 24 ||
        !PNG_SIGNATURE.every((byte, index) => bytes[index] === byte) ||
        !matchesAscii(bytes, 12, 'IHDR')
    ) {
        return null;
    }
    return positiveDimensions(uint32BE(bytes, 16), uint32BE(bytes, 20));
}

function isJpegStartOfFrame(marker: number): boolean {
    return (
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf)
    );
}

function readJpegDimensions(bytes: Uint8Array) {
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
    let offset = 2;
    while (offset + 1 < bytes.length) {
        while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
        if (offset >= bytes.length) return null;
        const marker = bytes[offset]!;
        offset += 1;
        if (marker === 0xda || marker === 0xd9) return null;
        if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
        const length = uint16BE(bytes, offset);
        if (length === null || length < 2 || offset + length > bytes.length) return null;
        if (isJpegStartOfFrame(marker) && length >= 7) {
            return positiveDimensions(uint16BE(bytes, offset + 5), uint16BE(bytes, offset + 3));
        }
        offset += length;
    }
    return null;
}

function readWebpDimensions(bytes: Uint8Array) {
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
        return positiveDimensions(
            (uint16LE(bytes, 26) ?? 0) & 0x3fff,
            (uint16LE(bytes, 28) ?? 0) & 0x3fff,
        );
    }
    if (matchesAscii(bytes, 12, 'VP8L') && bytes.length >= 25 && bytes[20] === 0x2f) {
        return Object.freeze({
            width: 1 + bytes[21]! + ((bytes[22]! & 0x3f) << 8),
            height: 1 + (bytes[22]! >> 6) + (bytes[23]! << 2) + ((bytes[24]! & 0x0f) << 10),
        });
    }
    return null;
}

function decodePrefix(encoded: string): Uint8Array | null {
    if (!encoded) return new Uint8Array();
    const remainder = encoded.length % 4;
    if (remainder === 1) return null;
    const padded = remainder === 0 ? encoded : `${encoded}${'='.repeat(4 - remainder)}`;
    const buffer = (
        globalThis as typeof globalThis & {
            Buffer?: { from(input: string, encoding: 'base64'): Uint8Array };
        }
    ).Buffer;
    if (buffer) return buffer.from(padded, 'base64');
    if (typeof globalThis.atob !== 'function') return null;
    try {
        const binary = globalThis.atob(padded);
        return Uint8Array.from(binary, (character) => character.charCodeAt(0));
    } catch {
        return null;
    }
}

function isBase64Character(code: number): boolean {
    return (
        (code >= 0x41 && code <= 0x5a) ||
        (code >= 0x61 && code <= 0x7a) ||
        (code >= 0x30 && code <= 0x39) ||
        code === 0x2b ||
        code === 0x2f
    );
}

function prefixToString(prefix: Uint8Array, length: number): string {
    let result = '';
    for (let offset = 0; offset < length; offset += ASCII_CHUNK_SIZE) {
        result += String.fromCharCode(
            ...prefix.subarray(offset, Math.min(length, offset + ASCII_CHUNK_SIZE)),
        );
    }
    return result;
}

function scanBase64Payload(
    value: string,
    payloadOffset: number,
): Readonly<{ encodedBytes: number; prefix: string }> | null {
    const prefix = new Uint8Array(HEADER_PROBE_BASE64_CHARACTERS);
    let prefixLength = 0;
    let encodedLength = 0;
    let padding = 0;
    let sawPadding = false;

    for (let index = payloadOffset; index < value.length; index += 1) {
        const code = value.charCodeAt(index);
        if (isBase64Character(code)) {
            if (sawPadding) return null;
        } else if (code === 0x3d) {
            sawPadding = true;
            padding += 1;
            if (padding > 2) return null;
        } else if (/\s/u.test(value[index]!)) {
            continue;
        } else {
            return null;
        }

        encodedLength += 1;
        if (prefixLength < prefix.length) {
            prefix[prefixLength] = code;
            prefixLength += 1;
        }
    }

    const remainder = encodedLength % 4;
    if (remainder === 1 || (padding > 0 && remainder !== 0)) return null;
    return Object.freeze({
        encodedBytes: Math.max(0, Math.floor((encodedLength * 3) / 4) - padding),
        prefix: prefixToString(prefix, prefixLength),
    });
}

export function inspectEncodedImageDataUrl(value: string): EncodedImageInspection | null {
    const commaIndex = value.indexOf(',');
    if (commaIndex < 0 || commaIndex > MAX_DATA_URL_HEADER_LENGTH) return null;
    const header = value.slice(0, commaIndex).toLowerCase();
    let mimeType: EncodedImageInspection['mimeType'];
    if (header === 'data:image/png;base64') mimeType = 'image/png';
    else if (header === 'data:image/jpeg;base64') mimeType = 'image/jpeg';
    else if (header === 'data:image/webp;base64') mimeType = 'image/webp';
    else return null;

    const payload = scanBase64Payload(value, commaIndex + 1);
    if (!payload) return null;
    const decodedPrefix = decodePrefix(payload.prefix);
    const dimensions = decodedPrefix
        ? (readPngDimensions(decodedPrefix) ??
          readJpegDimensions(decodedPrefix) ??
          readWebpDimensions(decodedPrefix))
        : null;
    return Object.freeze({ mimeType, encodedBytes: payload.encodedBytes, dimensions });
}
