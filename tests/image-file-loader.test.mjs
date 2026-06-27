/**
 * Type:
 *   Unit test
 *
 * Purpose:
 *   Verifies src/image/image-file-loader.ts propagates loadImage failures while
 *   still resetting the backing file input.
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';

const { loadImageFile } = await import('../src/image/image-file-loader.ts');
const { resolveOptions } = await import('../src/core/default-options.ts');

function toArrayBuffer(bytes) {
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function writeUint16(bytes, offset, value) {
    bytes[offset] = (value >> 8) & 0xff;
    bytes[offset + 1] = value & 0xff;
}

function writeUint32(bytes, offset, value) {
    bytes[offset] = (value >> 24) & 0xff;
    bytes[offset + 1] = (value >> 16) & 0xff;
    bytes[offset + 2] = (value >> 8) & 0xff;
    bytes[offset + 3] = value & 0xff;
}

function makeJpegWithOrientation(orientation) {
    const exif = new Uint8Array(6 + 8 + 2 + 12 + 4);
    exif.set([0x45, 0x78, 0x69, 0x66, 0x00, 0x00], 0);
    const tiffStart = 6;
    exif[tiffStart] = 0x4d;
    exif[tiffStart + 1] = 0x4d;
    writeUint16(exif, tiffStart + 2, 0x002a);
    writeUint32(exif, tiffStart + 4, 8);
    const ifdStart = tiffStart + 8;
    writeUint16(exif, ifdStart, 1);
    const entryStart = ifdStart + 2;
    writeUint16(exif, entryStart, 0x0112);
    writeUint16(exif, entryStart + 2, 3);
    writeUint32(exif, entryStart + 4, 1);
    writeUint16(exif, entryStart + 8, orientation);

    const segmentLength = exif.length + 2;
    const jpeg = new Uint8Array(2 + 2 + 2 + exif.length + 2);
    jpeg.set([0xff, 0xd8, 0xff, 0xe1], 0);
    jpeg[4] = (segmentLength >> 8) & 0xff;
    jpeg[5] = segmentLength & 0xff;
    jpeg.set(exif, 6);
    jpeg.set([0xff, 0xd9], 6 + exif.length);
    return toArrayBuffer(jpeg);
}

function installSuccessFileReader(dataUrl = 'data:image/jpeg;base64,ORIGINAL') {
    const OriginalFileReader = globalThis.FileReader;
    class SuccessFileReader {
        result = null;
        error = null;
        onload = null;
        onerror = null;
        onabort = null;

        readAsDataURL() {
            this.result = dataUrl;
            queueMicrotask(() => {
                this.onload?.();
            });
        }
    }
    globalThis.FileReader = SuccessFileReader;
    return () => {
        globalThis.FileReader = OriginalFileReader;
    };
}

function installImageBitmapStub({ width = 2, height = 3 } = {}) {
    const original = globalThis.createImageBitmap;
    const calls = [];
    globalThis.createImageBitmap = async (file, options) => {
        calls.push({ file, options });
        return {
            width,
            height,
            close() {},
        };
    };
    return {
        calls,
        restore() {
            globalThis.createImageBitmap = original;
        },
    };
}

function createCanvasDocumentStub() {
    const canvases = [];
    return {
        canvases,
        createElement(tagName) {
            assert.equal(tagName, 'canvas');
            const canvas = {
                width: 0,
                height: 0,
                getContext(kind) {
                    assert.equal(kind, '2d');
                    return {
                        transform() {},
                        drawImage() {},
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

test('loadImageFile rethrows loadImage failures and resets the file input', async () => {
    const input = { value: 'C:\\fakepath\\photo.png' };
    const failure = new Error('decode failed');
    const restoreFileReader = installSuccessFileReader('data:image/png;base64,AAAA');
    try {
        await assert.rejects(
            () =>
                loadImageFile(
                    {
                        options: resolveOptions(),
                        getInputElement: () => input,
                        loadImage: async () => {
                            throw failure;
                        },
                    },
                    new File(['x'], 'photo.png', { type: 'image/png' }),
                ),
            (error) => error === failure,
        );
        assert.equal(input.value, '');
    } finally {
        restoreFileReader();
    }
});

test('loadImageFile normalizes JPEG EXIF orientation when enabled', async () => {
    const documentStub = createCanvasDocumentStub();
    const input = { value: 'C:\\fakepath\\photo.jpg', ownerDocument: documentStub };
    const loadCalls = [];
    const restoreFileReader = installSuccessFileReader();
    const bitmap = installImageBitmapStub({ width: 2, height: 3 });

    try {
        await loadImageFile(
            {
                options: resolveOptions({ downsampleQuality: 0.7 }),
                getInputElement: () => input,
                loadImage: async (dataUrl) => {
                    loadCalls.push(dataUrl);
                },
            },
            new File([makeJpegWithOrientation(6)], 'photo.jpg', { type: 'image/jpeg' }),
        );

        assert.deepEqual(loadCalls, ['data:image/jpeg;width=3;height=2;quality=0.7']);
        assert.equal(bitmap.calls.length, 1);
        assert.equal(input.value, '');
    } finally {
        bitmap.restore();
        restoreFileReader();
    }
});

test('loadImageFile preserves old JPEG behavior when autoOrientImage is false', async () => {
    const documentStub = createCanvasDocumentStub();
    const input = { value: 'C:\\fakepath\\photo.jpg', ownerDocument: documentStub };
    const loadCalls = [];
    const restoreFileReader = installSuccessFileReader();
    const bitmap = installImageBitmapStub();

    try {
        await loadImageFile(
            {
                options: resolveOptions({ autoOrientImage: false }),
                getInputElement: () => input,
                loadImage: async (dataUrl) => {
                    loadCalls.push(dataUrl);
                },
            },
            new File([makeJpegWithOrientation(6)], 'photo.jpg', { type: 'image/jpeg' }),
        );

        assert.deepEqual(loadCalls, ['data:image/jpeg;base64,ORIGINAL']);
        assert.equal(bitmap.calls.length, 0);
        assert.equal(documentStub.canvases.length, 0);
        assert.equal(input.value, '');
    } finally {
        bitmap.restore();
        restoreFileReader();
    }
});

test('loadImageFile skips EXIF normalization for non-JPEG files', async () => {
    const documentStub = createCanvasDocumentStub();
    const input = { value: 'C:\\fakepath\\image.png', ownerDocument: documentStub };
    const loadCalls = [];
    const restoreFileReader = installSuccessFileReader('data:image/png;base64,ORIGINAL');
    const bitmap = installImageBitmapStub();

    try {
        await loadImageFile(
            {
                options: resolveOptions(),
                getInputElement: () => input,
                loadImage: async (dataUrl) => {
                    loadCalls.push(dataUrl);
                },
            },
            new File(['png'], 'image.png', { type: 'image/png' }),
        );

        assert.deepEqual(loadCalls, ['data:image/png;base64,ORIGINAL']);
        assert.equal(bitmap.calls.length, 0);
        assert.equal(documentStub.canvases.length, 0);
    } finally {
        bitmap.restore();
        restoreFileReader();
    }
});
