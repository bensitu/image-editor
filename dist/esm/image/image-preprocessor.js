function uint16(bytes, offset, littleEndian) {
    if (offset < 0 || offset + 2 > bytes.length)
        return null;
    return littleEndian
        ? bytes[offset] | (bytes[offset + 1] << 8)
        : (bytes[offset] << 8) | bytes[offset + 1];
}
function uint32(bytes, offset, littleEndian) {
    if (offset < 0 || offset + 4 > bytes.length)
        return null;
    if (littleEndian) {
        return (bytes[offset] +
            bytes[offset + 1] * 0x100 +
            bytes[offset + 2] * 0x10000 +
            bytes[offset + 3] * 0x1000000);
    }
    return (bytes[offset] * 0x1000000 +
        bytes[offset + 1] * 0x10000 +
        bytes[offset + 2] * 0x100 +
        bytes[offset + 3]);
}
function matches(bytes, offset, values) {
    return values.every((value, index) => bytes[offset + index] === value);
}
function findJpegExifOrientationEntry(bytes) {
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8)
        return null;
    let offset = 2;
    while (offset + 4 <= bytes.length) {
        while (offset < bytes.length && bytes[offset] === 0xff)
            offset += 1;
        if (offset >= bytes.length)
            break;
        const marker = bytes[offset++];
        if (marker === 0xda || marker === 0xd9)
            break;
        if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7))
            continue;
        const segmentLength = uint16(bytes, offset, false);
        if (segmentLength === null || segmentLength < 2 || offset + segmentLength > bytes.length) {
            break;
        }
        const segmentStart = offset + 2;
        const segmentEnd = offset + segmentLength;
        if (marker === 0xe1 &&
            segmentEnd - segmentStart >= 14 &&
            matches(bytes, segmentStart, [0x45, 0x78, 0x69, 0x66, 0, 0])) {
            const tiff = segmentStart + 6;
            const littleEndian = matches(bytes, tiff, [0x49, 0x49]);
            const bigEndian = matches(bytes, tiff, [0x4d, 0x4d]);
            if (!littleEndian && !bigEndian)
                return null;
            if (uint16(bytes, tiff + 2, littleEndian) !== 42)
                return null;
            const ifdOffset = uint32(bytes, tiff + 4, littleEndian);
            if (ifdOffset === null)
                return null;
            const directory = tiff + ifdOffset;
            const entryCount = uint16(bytes, directory, littleEndian);
            if (entryCount === null || entryCount > 4096)
                return null;
            for (let index = 0; index < entryCount; index += 1) {
                const entry = directory + 2 + index * 12;
                if (entry + 12 > segmentEnd)
                    return null;
                const tag = uint16(bytes, entry, littleEndian);
                if (tag !== 0x0112)
                    continue;
                const type = uint16(bytes, entry + 2, littleEndian);
                const count = uint32(bytes, entry + 4, littleEndian);
                if (type !== 3 || count !== 1)
                    return null;
                const value = uint16(bytes, entry + 8, littleEndian);
                return value !== null && value >= 1 && value <= 8
                    ? Object.freeze({
                        offset: entry + 8,
                        littleEndian,
                        value: value,
                    })
                    : null;
            }
        }
        offset += segmentLength;
    }
    return null;
}
export function readJpegExifOrientation(input) {
    var _a, _b;
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    return (_b = (_a = findJpegExifOrientationEntry(bytes)) === null || _a === void 0 ? void 0 : _a.value) !== null && _b !== void 0 ? _b : 1;
}
function dataUrlBytes(source) {
    const comma = source.indexOf(',');
    if (comma < 0)
        throw new TypeError('[ImageEditor] Image Data URL is malformed.');
    const header = source.slice(0, comma).toLowerCase();
    const encoded = source.slice(comma + 1);
    if (!header.endsWith(';base64')) {
        const bytes = [];
        for (let index = 0; index < encoded.length; index += 1) {
            if (encoded[index] === '%' &&
                /^[\da-f]{2}$/iu.test(encoded.slice(index + 1, index + 3))) {
                bytes.push(Number.parseInt(encoded.slice(index + 1, index + 3), 16));
                index += 2;
            }
            else {
                const value = encoded.charCodeAt(index);
                if (value > 0xff) {
                    throw new TypeError('[ImageEditor] Image Data URL contains invalid bytes.');
                }
                bytes.push(value);
            }
        }
        return Uint8Array.from(bytes);
    }
    const compact = encoded.replace(/\s/gu, '');
    const buffer = globalThis.Buffer;
    if (buffer)
        return Uint8Array.from(buffer.from(compact, 'base64'));
    if (typeof globalThis.atob !== 'function') {
        throw new TypeError('[ImageEditor] No base64 decoder is available.');
    }
    const binary = globalThis.atob(compact);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
function bytesDataUrl(bytes, mimeType) {
    const buffer = globalThis.Buffer;
    if (buffer)
        return `data:${mimeType};base64,${buffer.from(bytes).toString('base64')}`;
    if (typeof globalThis.btoa !== 'function') {
        throw new TypeError('[ImageEditor] No base64 encoder is available.');
    }
    const chunks = [];
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 0x8000)));
    }
    return `data:${mimeType};base64,${globalThis.btoa(chunks.join(''))}`;
}
function neutralizeJpegOrientation(bytes) {
    const entry = findJpegExifOrientationEntry(bytes);
    if (!entry || entry.value === 1)
        return bytes;
    const normalized = bytes.slice();
    if (entry.littleEndian) {
        normalized[entry.offset] = 1;
        normalized[entry.offset + 1] = 0;
    }
    else {
        normalized[entry.offset] = 0;
        normalized[entry.offset + 1] = 1;
    }
    return normalized;
}
function abortReason(signal) {
    var _a;
    return (_a = signal.reason) !== null && _a !== void 0 ? _a : new DOMException('Image preprocessing was aborted.', 'AbortError');
}
function orientedSize(width, height, orientation) {
    return orientation >= 5
        ? Object.freeze({ width: height, height: width })
        : Object.freeze({ width, height });
}
function targetSize(width, height, options) {
    if (!options.downsample)
        return Object.freeze({ width, height, downsampled: false });
    const scale = Math.min(1, options.maxWidth / width, options.maxHeight / height);
    return Object.freeze({
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
        downsampled: scale < 1,
    });
}
function outputMimeType(source, options) {
    if (options.format)
        return options.format;
    return options.preserveSourceFormat ? source : 'image/jpeg';
}
export function requiresImagePreprocessing(mimeType, width, height, options) {
    const needsExif = mimeType === 'image/jpeg' && options.normalizeExifOrientation;
    const needsDownsample = options.downsample && (width > options.maxWidth || height > options.maxHeight);
    const requestedMimeType = outputMimeType(mimeType, options);
    const needsEncoding = options.format !== null || requestedMimeType !== mimeType;
    return needsExif || needsDownsample || needsEncoding;
}
async function decodeWithImageBitmap(bytes, mimeType, signal) {
    if (typeof globalThis.createImageBitmap !== 'function')
        return null;
    signal.throwIfAborted();
    const copy = bytes.slice().buffer;
    const bitmap = await globalThis.createImageBitmap(new Blob([copy], { type: mimeType }), {
        imageOrientation: 'none',
    });
    if (signal.aborted) {
        bitmap.close();
        throw abortReason(signal);
    }
    return Object.freeze({
        image: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        rawOrientation: true,
        dispose: () => bitmap.close(),
    });
}
function imageDimensions(image) {
    const candidate = image;
    return Object.freeze({
        width: Number(candidate.naturalWidth) || Number(candidate.width) || 0,
        height: Number(candidate.naturalHeight) || Number(candidate.height) || 0,
    });
}
function decodeWithImage(source, ownerDocument, signal) {
    return new Promise((resolve, reject) => {
        const image = ownerDocument.createElement('img');
        let settled = false;
        const cleanup = () => {
            signal.removeEventListener('abort', abort);
            image.onload = null;
            image.onerror = null;
        };
        const finish = (task) => {
            if (settled)
                return;
            settled = true;
            cleanup();
            task();
        };
        const abort = () => {
            finish(() => {
                image.src = '';
                reject(abortReason(signal));
            });
        };
        image.onerror = () => finish(() => reject(new TypeError('Image decode failed.')));
        image.onload = () => {
            finish(() => {
                const dimensions = imageDimensions(image);
                if (!(dimensions.width > 0) || !(dimensions.height > 0)) {
                    reject(new TypeError('Image decode produced invalid dimensions.'));
                    return;
                }
                resolve(Object.freeze({
                    image,
                    width: dimensions.width,
                    height: dimensions.height,
                    rawOrientation: true,
                    dispose: () => {
                        image.src = '';
                    },
                }));
            });
        };
        signal.addEventListener('abort', abort, { once: true });
        if (signal.aborted)
            abort();
        else
            image.src = source;
    });
}
function setOrientationTransform(context, orientation, rawWidth, rawHeight, targetWidth, targetHeight) {
    const oriented = orientedSize(rawWidth, rawHeight, orientation);
    const scaleX = targetWidth / oriented.width;
    const scaleY = targetHeight / oriented.height;
    const transforms = {
        1: [1, 0, 0, 1, 0, 0],
        2: [-1, 0, 0, 1, rawWidth, 0],
        3: [-1, 0, 0, -1, rawWidth, rawHeight],
        4: [1, 0, 0, -1, 0, rawHeight],
        5: [0, 1, 1, 0, 0, 0],
        6: [0, 1, -1, 0, rawHeight, 0],
        7: [0, -1, -1, 0, rawHeight, rawWidth],
        8: [0, -1, 1, 0, 0, rawWidth],
    };
    const [a, b, c, d, e, f] = transforms[orientation];
    context.setTransform(a * scaleX, b * scaleY, c * scaleX, d * scaleY, e * scaleX, f * scaleY);
}
export async function preprocessImageDataUrl(request) {
    var _a, _b;
    request.signal.throwIfAborted();
    const needsExif = request.mimeType === 'image/jpeg' && request.options.normalizeExifOrientation;
    const requestedMimeType = outputMimeType(request.mimeType, request.options);
    const needsEncoding = request.options.format !== null || requestedMimeType !== request.mimeType;
    if (!requiresImagePreprocessing(request.mimeType, request.width, request.height, request.options)) {
        return Object.freeze({
            source: request.source,
            mimeType: request.mimeType,
            width: request.width,
            height: request.height,
            sourceWidth: request.width,
            sourceHeight: request.height,
            orientation: 1,
            orientationNormalized: false,
            downsampled: false,
        });
    }
    const bytes = dataUrlBytes(request.source);
    const orientation = needsExif ? readJpegExifOrientation(bytes) : 1;
    const oriented = orientedSize(request.width, request.height, orientation);
    const target = targetSize(oriented.width, oriented.height, request.options);
    const orientationNormalized = orientation !== 1 && request.options.normalizeExifOrientation;
    if (!orientationNormalized && !target.downsampled && !needsEncoding) {
        return Object.freeze({
            source: request.source,
            mimeType: request.mimeType,
            width: request.width,
            height: request.height,
            sourceWidth: request.width,
            sourceHeight: request.height,
            orientation,
            orientationNormalized: false,
            downsampled: false,
        });
    }
    const decoded = (_a = (await decodeWithImageBitmap(bytes, request.mimeType, request.signal))) !== null && _a !== void 0 ? _a : (await decodeWithImage(orientationNormalized
        ? bytesDataUrl(neutralizeJpegOrientation(bytes), request.mimeType)
        : request.source, request.ownerDocument, request.signal));
    try {
        request.signal.throwIfAborted();
        const canvas = request.ownerDocument.createElement('canvas');
        canvas.width = target.width;
        canvas.height = target.height;
        const context = canvas.getContext('2d');
        if (!context)
            throw new TypeError('[ImageEditor] Canvas 2D context is unavailable.');
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        const appliedOrientation = decoded.rawOrientation ? orientation : 1;
        setOrientationTransform(context, appliedOrientation, decoded.width, decoded.height, target.width, target.height);
        context.drawImage(decoded.image, 0, 0, decoded.width, decoded.height);
        request.signal.throwIfAborted();
        const source = canvas.toDataURL(requestedMimeType, request.options.quality);
        const emitted = (_b = /^data:(image\/(?:jpeg|png|webp));base64,/iu.exec(source)) === null || _b === void 0 ? void 0 : _b[1];
        const mimeType = emitted === 'image/jpeg' || emitted === 'image/png' || emitted === 'image/webp'
            ? emitted
            : requestedMimeType;
        return Object.freeze({
            source,
            mimeType,
            width: target.width,
            height: target.height,
            sourceWidth: request.width,
            sourceHeight: request.height,
            orientation,
            orientationNormalized,
            downsampled: target.downsampled,
        });
    }
    finally {
        decoded.dispose();
    }
}
//# sourceMappingURL=image-preprocessor.js.map