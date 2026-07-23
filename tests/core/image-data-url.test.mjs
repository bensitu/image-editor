import assert from 'node:assert/strict';
import test from 'node:test';

import { inspectEncodedImageDataUrl } from '../../src/core-runtime/state/image-data-url.js';

function writeAscii(bytes, offset, value) {
    for (let index = 0; index < value.length; index += 1) {
        bytes[offset + index] = value.charCodeAt(index);
    }
}

function pngHeader(width, height) {
    const bytes = Buffer.alloc(24);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes);
    writeAscii(bytes, 12, 'IHDR');
    bytes.writeUInt32BE(width, 16);
    bytes.writeUInt32BE(height, 20);
    return bytes.toString('base64');
}

function jpegHeader(width, height) {
    const bytes = Buffer.alloc(21);
    bytes.set([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08]);
    bytes.writeUInt16BE(height, 7);
    bytes.writeUInt16BE(width, 9);
    return bytes.toString('base64');
}

function webpHeader(width, height) {
    const bytes = Buffer.alloc(30);
    writeAscii(bytes, 0, 'RIFF');
    writeAscii(bytes, 8, 'WEBP');
    writeAscii(bytes, 12, 'VP8X');
    const encodedWidth = width - 1;
    const encodedHeight = height - 1;
    bytes[24] = encodedWidth & 0xff;
    bytes[25] = (encodedWidth >> 8) & 0xff;
    bytes[26] = (encodedWidth >> 16) & 0xff;
    bytes[27] = encodedHeight & 0xff;
    bytes[28] = (encodedHeight >> 8) & 0xff;
    bytes[29] = (encodedHeight >> 16) & 0xff;
    return bytes.toString('base64');
}

test('data URL inspection scans a large payload without changing byte accounting', () => {
    const encodedLength = 2 * 1024 * 1024;
    const inspection = inspectEncodedImageDataUrl(
        `data:image/png;base64,${'A'.repeat(encodedLength)}`,
    );

    assert.equal(inspection?.encodedBytes, (encodedLength * 3) / 4);
    assert.equal(inspection?.dimensions, null);
});

test('data URL inspection preserves empty, whitespace, and padding behavior', () => {
    assert.deepEqual(inspectEncodedImageDataUrl('data:image/png;base64,'), {
        mimeType: 'image/png',
        encodedBytes: 0,
        dimensions: null,
    });
    assert.equal(
        inspectEncodedImageDataUrl('data:image/png;base64, Q Q = = \n\t')?.encodedBytes,
        1,
    );
    assert.equal(inspectEncodedImageDataUrl('data:image/jpeg;base64,QUI=')?.encodedBytes, 2);
    assert.equal(inspectEncodedImageDataUrl('data:image/webp;base64,QQ==')?.encodedBytes, 1);
    assert.equal(inspectEncodedImageDataUrl('data:image/png;base64,QUI')?.encodedBytes, 2);
});

test('data URL inspection rejects unsupported headers and malformed base64', () => {
    for (const value of [
        'data:image/gif;base64,AAAA',
        'data:image/png,AAAA',
        'data:image/png;base64,AA-A',
        'data:image/png;base64,A',
        'data:image/png;base64,QQ=',
        'data:image/png;base64,QQ===',
        'data:image/png;base64,QQ==A',
        'data:image/png;base64,=AAA',
    ]) {
        assert.equal(inspectEncodedImageDataUrl(value), null, value);
    }
});

test('data URL inspection retains case-insensitive PNG, JPEG, and WebP dimensions', () => {
    for (const [mimeType, payload, dimensions] of [
        ['PNG', pngHeader(321, 123), { width: 321, height: 123 }],
        ['JPEG', jpegHeader(640, 360), { width: 640, height: 360 }],
        ['WEBP', webpHeader(777, 555), { width: 777, height: 555 }],
    ]) {
        assert.deepEqual(
            inspectEncodedImageDataUrl(`DATA:IMAGE/${mimeType};BASE64,${payload}`)?.dimensions,
            dimensions,
        );
    }
});
