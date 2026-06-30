/**
 * Type:
 *   Unit test
 *
 * Purpose:
 *   Verifies JPEG EXIF orientation parsing and canvas-normalization helpers.
 *
 * Environment:
 *   - Node.js ESM
 *   - Synthetic JPEG/EXIF buffers and stubbed browser canvas APIs
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';

const { isJpegFile, normalizeJpegOrientationIfNeeded, readJpegExifOrientation } =
    await import('../src/image/exif-orientation.ts');
const { resolveOptions } = await import('../src/core/default-options.ts');

function toArrayBuffer(bytes) {
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function writeUint16(bytes, offset, value, littleEndian) {
    if (littleEndian) {
        bytes[offset] = value & 0xff;
        bytes[offset + 1] = (value >> 8) & 0xff;
    } else {
        bytes[offset] = (value >> 8) & 0xff;
        bytes[offset + 1] = value & 0xff;
    }
}

function writeUint32(bytes, offset, value, littleEndian) {
    if (littleEndian) {
        bytes[offset] = value & 0xff;
        bytes[offset + 1] = (value >> 8) & 0xff;
        bytes[offset + 2] = (value >> 16) & 0xff;
        bytes[offset + 3] = (value >> 24) & 0xff;
    } else {
        bytes[offset] = (value >> 24) & 0xff;
        bytes[offset + 1] = (value >> 16) & 0xff;
        bytes[offset + 2] = (value >> 8) & 0xff;
        bytes[offset + 3] = value & 0xff;
    }
}

function makeExifPayload({ orientation, littleEndian = false, ifdOffset = 8 }) {
    const bytes = new Uint8Array(6 + ifdOffset + 2 + 12 + 4);
    bytes.set([0x45, 0x78, 0x69, 0x66, 0x00, 0x00], 0);
    const tiffStart = 6;
    if (littleEndian) {
        bytes[tiffStart] = 0x49;
        bytes[tiffStart + 1] = 0x49;
    } else {
        bytes[tiffStart] = 0x4d;
        bytes[tiffStart + 1] = 0x4d;
    }
    writeUint16(bytes, tiffStart + 2, 0x002a, littleEndian);
    writeUint32(bytes, tiffStart + 4, ifdOffset, littleEndian);

    const ifdStart = tiffStart + ifdOffset;
    writeUint16(bytes, ifdStart, 1, littleEndian);
    const entryStart = ifdStart + 2;
    writeUint16(bytes, entryStart, 0x0112, littleEndian);
    writeUint16(bytes, entryStart + 2, 3, littleEndian);
    writeUint32(bytes, entryStart + 4, 1, littleEndian);
    writeUint16(bytes, entryStart + 8, orientation, littleEndian);
    writeUint32(bytes, entryStart + 12, 0, littleEndian);
    return bytes;
}

function makeJpegWithExif(options) {
    const exif = makeExifPayload(options);
    const segmentLength = exif.length + 2;
    const bytes = new Uint8Array(2 + 2 + 2 + exif.length + 2);
    bytes.set([0xff, 0xd8, 0xff, 0xe1], 0);
    bytes[4] = (segmentLength >> 8) & 0xff;
    bytes[5] = segmentLength & 0xff;
    bytes.set(exif, 6);
    bytes.set([0xff, 0xd9], 6 + exif.length);
    return toArrayBuffer(bytes);
}

function makeJpegWithInvalidIfdOffset() {
    const bytes = new Uint8Array(makeJpegWithExif({ orientation: 6 }));
    const tiffOffset = 6 + 6 + 4;
    bytes[tiffOffset] = 0x7f;
    bytes[tiffOffset + 1] = 0xff;
    bytes[tiffOffset + 2] = 0xff;
    bytes[tiffOffset + 3] = 0xff;
    return toArrayBuffer(bytes);
}

function makeJpegWithoutExif() {
    return toArrayBuffer(
        new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xd9]),
    );
}

function makeFileForOrientation(orientation, name = 'photo.jpg', type = 'image/jpeg') {
    return new File([makeJpegWithExif({ orientation })], name, { type });
}

function installImageBitmapStub({ width = 2, height = 3 } = {}) {
    const original = globalThis.createImageBitmap;
    const calls = [];
    const bitmaps = [];
    globalThis.createImageBitmap = async (file, options) => {
        calls.push({ file, options });
        const bitmap = {
            width,
            height,
            closed: false,
            close() {
                this.closed = true;
            },
        };
        bitmaps.push(bitmap);
        return bitmap;
    };
    return {
        calls,
        bitmaps,
        restore() {
            globalThis.createImageBitmap = original;
        },
    };
}

function createCanvasDocumentStub() {
    const canvases = [];
    const transforms = [];
    const drawCalls = [];
    return {
        canvases,
        transforms,
        drawCalls,
        createElement(tagName) {
            assert.equal(tagName, 'canvas');
            const canvas = {
                width: 0,
                height: 0,
                getContext(kind) {
                    assert.equal(kind, '2d');
                    return {
                        transform(...args) {
                            transforms.push(args);
                        },
                        drawImage(...args) {
                            drawCalls.push(args);
                        },
                    };
                },
                toDataURL(type, quality) {
                    return `data:${type};width=${this.width};height=${this.height};quality=${quality}`;
                },
            };
            canvases.push(canvas);
            return canvas;
        },
    };
}

test('readJpegExifOrientation returns null for non-JPEG and JPEGs without EXIF', () => {
    assert.equal(readJpegExifOrientation(toArrayBuffer(new Uint8Array([0x00, 0x01]))), null);
    assert.equal(readJpegExifOrientation(makeJpegWithoutExif()), null);
});

test('readJpegExifOrientation parses big-endian and little-endian orientation 1', () => {
    assert.equal(readJpegExifOrientation(makeJpegWithExif({ orientation: 1 })), 1);
    assert.equal(
        readJpegExifOrientation(makeJpegWithExif({ orientation: 1, littleEndian: true })),
        1,
    );
});

test('readJpegExifOrientation parses required rotated orientations', () => {
    assert.equal(readJpegExifOrientation(makeJpegWithExif({ orientation: 3 })), 3);
    assert.equal(readJpegExifOrientation(makeJpegWithExif({ orientation: 6 })), 6);
    assert.equal(readJpegExifOrientation(makeJpegWithExif({ orientation: 8 })), 8);
});

test('readJpegExifOrientation handles truncated EXIF, invalid offsets, and unsupported values', () => {
    const truncated = new Uint8Array(makeJpegWithExif({ orientation: 6 })).slice(0, 18);
    assert.equal(readJpegExifOrientation(toArrayBuffer(truncated)), null);

    assert.equal(readJpegExifOrientation(makeJpegWithInvalidIfdOffset()), null);
    assert.equal(readJpegExifOrientation(makeJpegWithExif({ orientation: 9 })), null);
});

test('isJpegFile detects JPEG MIME type and extension fallback', () => {
    assert.equal(isJpegFile(new File(['x'], 'photo.bin', { type: 'image/jpeg' })), true);
    assert.equal(isJpegFile(new File(['x'], 'photo.JPG', { type: '' })), true);
    assert.equal(isJpegFile(new File(['x'], 'photo.png', { type: 'image/png' })), false);
});

test('normalizeJpegOrientationIfNeeded returns null for orientation 1 and disabled option', async () => {
    const bitmap = installImageBitmapStub();
    const documentStub = createCanvasDocumentStub();
    try {
        assert.equal(
            await normalizeJpegOrientationIfNeeded(
                makeFileForOrientation(1),
                'data:image/jpeg;base64,ORIGINAL',
                resolveOptions(),
                documentStub,
            ),
            null,
        );
        assert.equal(
            await normalizeJpegOrientationIfNeeded(
                makeFileForOrientation(6),
                'data:image/jpeg;base64,ORIGINAL',
                resolveOptions({ autoOrientImage: false }),
                documentStub,
            ),
            null,
        );
        assert.equal(bitmap.calls.length, 0);
        assert.equal(documentStub.canvases.length, 0);
    } finally {
        bitmap.restore();
    }
});

test('normalizeJpegOrientationIfNeeded swaps dimensions for orientation 6 and 8', async () => {
    const bitmap = installImageBitmapStub({ width: 2, height: 3 });
    const documentStub = createCanvasDocumentStub();
    try {
        const orientation6 = await normalizeJpegOrientationIfNeeded(
            makeFileForOrientation(6),
            'data:image/jpeg;base64,ORIGINAL',
            resolveOptions({ downsampleQuality: 0.75 }),
            documentStub,
        );
        assert.equal(orientation6, 'data:image/jpeg;width=3;height=2;quality=0.75');
        assert.deepEqual(documentStub.transforms.at(-1), [0, 1, -1, 0, 3, 0]);

        const orientation8 = await normalizeJpegOrientationIfNeeded(
            makeFileForOrientation(8),
            'data:image/jpeg;base64,ORIGINAL',
            resolveOptions({ downsampleQuality: 0.8 }),
            documentStub,
        );
        assert.equal(orientation8, 'data:image/jpeg;width=3;height=2;quality=0.8');
        assert.deepEqual(documentStub.transforms.at(-1), [0, -1, 1, 0, 0, 2]);
        assert.equal(
            bitmap.bitmaps.every((entry) => entry.closed),
            true,
        );
    } finally {
        bitmap.restore();
    }
});

test('normalizeJpegOrientationIfNeeded uses autoOrientImageQuality when provided', async () => {
    const bitmap = installImageBitmapStub({ width: 2, height: 3 });
    const documentStub = createCanvasDocumentStub();
    try {
        const result = await normalizeJpegOrientationIfNeeded(
            makeFileForOrientation(6),
            'data:image/jpeg;base64,ORIGINAL',
            resolveOptions({ downsampleQuality: 0.5, autoOrientImageQuality: 0.97 }),
            documentStub,
        );

        assert.equal(result, 'data:image/jpeg;width=3;height=2;quality=0.97');
    } finally {
        bitmap.restore();
    }
});

test('normalizeJpegOrientationIfNeeded rotates orientation 3 without swapping dimensions', async () => {
    const bitmap = installImageBitmapStub({ width: 2, height: 3 });
    const documentStub = createCanvasDocumentStub();
    try {
        const result = await normalizeJpegOrientationIfNeeded(
            makeFileForOrientation(3),
            'data:image/jpeg;base64,ORIGINAL',
            resolveOptions(),
            documentStub,
        );
        assert.equal(result, 'data:image/jpeg;width=2;height=3;quality=0.92');
        assert.deepEqual(documentStub.transforms.at(-1), [-1, 0, 0, -1, 2, 3]);
    } finally {
        bitmap.restore();
    }
});
