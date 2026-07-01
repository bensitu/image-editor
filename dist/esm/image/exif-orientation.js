import { readFileAsArrayBuffer } from '../utils/file.js';
const JPEG_MARKER_PREFIX = 0xff;
const JPEG_SOI = 0xd8;
const JPEG_SOS = 0xda;
const JPEG_EOI = 0xd9;
const JPEG_APP1 = 0xe1;
const TIFF_TAG_ORIENTATION = 0x0112;
const TIFF_TYPE_SHORT = 3;
const TIFF_TYPE_LONG = 4;
const EXIF_HEADER = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00];
function isValidOrientation(value) {
    return Number.isInteger(value) && value >= 1 && value <= 8;
}
function readUint16(view, offset, littleEndian) {
    if (offset < 0 || offset + 2 > view.byteLength)
        return null;
    return view.getUint16(offset, littleEndian);
}
function readUint32(view, offset, littleEndian) {
    if (offset < 0 || offset + 4 > view.byteLength)
        return null;
    return view.getUint32(offset, littleEndian);
}
function hasExifHeader(view, offset, end) {
    if (offset + EXIF_HEADER.length > end)
        return false;
    return EXIF_HEADER.every((byte, index) => view.getUint8(offset + index) === byte);
}
function isStandaloneMarker(marker) {
    return marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);
}
export function readJpegExifOrientation(buffer) {
    const view = new DataView(buffer);
    if (view.byteLength < 4)
        return null;
    if (view.getUint8(0) !== JPEG_MARKER_PREFIX || view.getUint8(1) !== JPEG_SOI) {
        return null;
    }
    let offset = 2;
    while (offset < view.byteLength) {
        if (view.getUint8(offset) !== JPEG_MARKER_PREFIX)
            return null;
        while (offset < view.byteLength && view.getUint8(offset) === JPEG_MARKER_PREFIX) {
            offset += 1;
        }
        if (offset >= view.byteLength)
            return null;
        const marker = view.getUint8(offset);
        offset += 1;
        if (marker === JPEG_SOS || marker === JPEG_EOI)
            return null;
        if (isStandaloneMarker(marker))
            continue;
        if (offset + 2 > view.byteLength)
            return null;
        const segmentLength = view.getUint16(offset, false);
        if (segmentLength < 2)
            return null;
        const segmentStart = offset + 2;
        const segmentEnd = offset + segmentLength;
        if (segmentEnd > view.byteLength)
            return null;
        if (marker === JPEG_APP1 && hasExifHeader(view, segmentStart, segmentEnd)) {
            return readExifSegmentOrientation(view, segmentStart + EXIF_HEADER.length, segmentEnd);
        }
        offset = segmentEnd;
    }
    return null;
}
function readExifSegmentOrientation(view, tiffStart, segmentEnd) {
    if (tiffStart + 8 > segmentEnd)
        return null;
    const byteOrderA = view.getUint8(tiffStart);
    const byteOrderB = view.getUint8(tiffStart + 1);
    const littleEndian = byteOrderA === 0x49 && byteOrderB === 0x49
        ? true
        : byteOrderA === 0x4d && byteOrderB === 0x4d
            ? false
            : null;
    if (littleEndian === null)
        return null;
    const tiffMagic = readUint16(view, tiffStart + 2, littleEndian);
    if (tiffMagic !== 0x002a)
        return null;
    const ifdOffset = readUint32(view, tiffStart + 4, littleEndian);
    if (ifdOffset === null)
        return null;
    const ifdStart = tiffStart + ifdOffset;
    if (ifdStart < tiffStart || ifdStart + 2 > segmentEnd)
        return null;
    const entryCount = readUint16(view, ifdStart, littleEndian);
    if (entryCount === null)
        return null;
    const entriesStart = ifdStart + 2;
    const entriesEnd = entriesStart + entryCount * 12;
    if (entriesEnd > segmentEnd)
        return null;
    for (let index = 0; index < entryCount; index += 1) {
        const entryOffset = entriesStart + index * 12;
        const tag = readUint16(view, entryOffset, littleEndian);
        if (tag !== TIFF_TAG_ORIENTATION)
            continue;
        const type = readUint16(view, entryOffset + 2, littleEndian);
        const count = readUint32(view, entryOffset + 4, littleEndian);
        if (count !== 1)
            return null;
        const value = type === TIFF_TYPE_SHORT
            ? readUint16(view, entryOffset + 8, littleEndian)
            : type === TIFF_TYPE_LONG
                ? readUint32(view, entryOffset + 8, littleEndian)
                : null;
        if (value === null)
            return null;
        return isValidOrientation(value) ? value : null;
    }
    return null;
}
export function isJpegFile(file) {
    var _a, _b;
    const type = (_b = (_a = file.type) === null || _a === void 0 ? void 0 : _a.toLowerCase()) !== null && _b !== void 0 ? _b : '';
    if (type)
        return type === 'image/jpeg';
    return /\.(?:jpe?g)$/i.test(file.name);
}
async function readFileOrientation(file) {
    try {
        return readJpegExifOrientation(await readFileAsArrayBuffer(file));
    }
    catch {
        return null;
    }
}
async function createRawImageBitmap(file) {
    if (typeof createImageBitmap !== 'function') {
        throw new Error('createImageBitmap with imageOrientation: "none" is required for safe EXIF orientation normalization.');
    }
    try {
        const bitmap = await createImageBitmap(file, { imageOrientation: 'none' });
        if (!hasPositiveDimensions(bitmap.width, bitmap.height)) {
            bitmap.close();
            throw new Error('Decoded image bitmap has no dimensions.');
        }
        return {
            source: bitmap,
            width: bitmap.width,
            height: bitmap.height,
            close: () => {
                bitmap.close();
            },
        };
    }
    catch (error) {
        throw Object.assign(new Error(error instanceof Error
            ? `createImageBitmap EXIF orientation decode failed: ${error.message}`
            : 'createImageBitmap EXIF orientation decode failed.'), { cause: error });
    }
}
function hasPositiveDimensions(width, height) {
    return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
}
function getCanvasDocument(ownerDocument) {
    const resolvedDocument = ownerDocument !== null && ownerDocument !== void 0 ? ownerDocument : (typeof document !== 'undefined' ? document : null);
    if (!resolvedDocument) {
        throw new Error('A document is required to normalize JPEG EXIF orientation.');
    }
    return resolvedDocument;
}
function createCanvas(ownerDocument) {
    return getCanvasDocument(ownerDocument).createElement('canvas');
}
function isRotatedRightAngle(orientation) {
    return orientation >= 5 && orientation <= 8;
}
function applyOrientationTransform(context, orientation, width, height) {
    switch (orientation) {
        case 2:
            context.transform(-1, 0, 0, 1, width, 0);
            break;
        case 3:
            context.transform(-1, 0, 0, -1, width, height);
            break;
        case 4:
            context.transform(1, 0, 0, -1, 0, height);
            break;
        case 5:
            context.transform(0, 1, 1, 0, 0, 0);
            break;
        case 6:
            context.transform(0, 1, -1, 0, height, 0);
            break;
        case 7:
            context.transform(0, -1, -1, 0, height, width);
            break;
        case 8:
            context.transform(0, -1, 1, 0, 0, width);
            break;
        case 1:
            break;
    }
}
function drawOrientedImage(decoded, orientation, options, ownerDocument) {
    var _a;
    const canvas = createCanvas(ownerDocument);
    const outputWidth = isRotatedRightAngle(orientation) ? decoded.height : decoded.width;
    const outputHeight = isRotatedRightAngle(orientation) ? decoded.width : decoded.height;
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const context = canvas.getContext('2d');
    if (!context) {
        throw new Error('Unable to create a canvas context for JPEG EXIF orientation.');
    }
    applyOrientationTransform(context, orientation, decoded.width, decoded.height);
    context.drawImage(decoded.source, 0, 0, decoded.width, decoded.height);
    return canvas.toDataURL('image/jpeg', (_a = options.autoOrientImageQuality) !== null && _a !== void 0 ? _a : options.downsampleQuality);
}
export async function normalizeJpegOrientationIfNeeded(file, dataUrl, options, ownerDocument) {
    void dataUrl;
    if (!options.autoOrientImage || !isJpegFile(file))
        return null;
    const orientation = await readFileOrientation(file);
    if (orientation === null || orientation === 1)
        return null;
    const decoded = await createRawImageBitmap(file);
    try {
        return drawOrientedImage(decoded, orientation, options, ownerDocument);
    }
    finally {
        decoded.close();
    }
}
//# sourceMappingURL=exif-orientation.js.map