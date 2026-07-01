/**
 * Type:
 *   Unit test
 *
 * Purpose:
 *   Verifies src/image/image-input-budget.ts pre-decode byte and pixel guards.
 *
 * Scope:
 *   - PNG, JPEG, and WebP header dimension parsing.
 *   - Base64 data URL byte estimation.
 *   - Data URL budget rejection before image decode.
 *
 * Out of scope:
 *   - Browser image rendering.
 *   - Transactional canvas rollback.
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';

const { assertImageDataUrlInputBudget, estimateBase64PayloadBytes, readImageHeaderDimensions } =
    await import('../src/image/image-input-budget.ts');
const { ImageDecodeError } = await import('../src/core/errors.ts');
const { resolveOptions } = await import('../src/core/default-options.ts');

function pngHeader(width, height) {
    const bytes = new Uint8Array(24);
    bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    bytes.set([0x00, 0x00, 0x00, 0x0d], 8);
    bytes.set([0x49, 0x48, 0x44, 0x52], 12);
    new DataView(bytes.buffer).setUint32(16, width, false);
    new DataView(bytes.buffer).setUint32(20, height, false);
    return bytes;
}

function jpegHeader(width, height) {
    const bytes = new Uint8Array(2 + 2 + 2 + 6 + 2);
    bytes.set([0xff, 0xd8, 0xff, 0xc0], 0);
    bytes[4] = 0x00;
    bytes[5] = 0x08;
    bytes[6] = 0x08;
    bytes[7] = (height >> 8) & 0xff;
    bytes[8] = height & 0xff;
    bytes[9] = (width >> 8) & 0xff;
    bytes[10] = width & 0xff;
    bytes.set([0xff, 0xd9], 12);
    return bytes;
}

function webpVp8xHeader(width, height) {
    const bytes = new Uint8Array(30);
    bytes.set([...Buffer.from('RIFF')], 0);
    bytes.set([...Buffer.from('WEBP')], 8);
    bytes.set([...Buffer.from('VP8X')], 12);
    const rawWidth = width - 1;
    const rawHeight = height - 1;
    bytes[24] = rawWidth & 0xff;
    bytes[25] = (rawWidth >> 8) & 0xff;
    bytes[26] = (rawWidth >> 16) & 0xff;
    bytes[27] = rawHeight & 0xff;
    bytes[28] = (rawHeight >> 8) & 0xff;
    bytes[29] = (rawHeight >> 16) & 0xff;
    return bytes;
}

function dataUrlFor(bytes, mime = 'image/png') {
    return `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
}

test('readImageHeaderDimensions parses supported image headers', () => {
    assert.deepEqual(readImageHeaderDimensions(pngHeader(640, 480)), {
        width: 640,
        height: 480,
    });
    assert.deepEqual(readImageHeaderDimensions(jpegHeader(320, 240)), {
        width: 320,
        height: 240,
    });
    assert.deepEqual(readImageHeaderDimensions(webpVp8xHeader(1024, 768)), {
        width: 1024,
        height: 768,
    });
});

test('estimateBase64PayloadBytes returns decoded payload size', () => {
    assert.equal(estimateBase64PayloadBytes('data:image/png;base64,QUJDRA=='), 4);
    assert.equal(estimateBase64PayloadBytes('data:image/png;base64,QQ=='), 1);
    assert.equal(estimateBase64PayloadBytes('data:image/png,abc'), null);
});

test('assertImageDataUrlInputBudget rejects oversized bytes and pixels', () => {
    assert.throws(
        () =>
            assertImageDataUrlInputBudget(
                dataUrlFor(Buffer.from('abcd')),
                resolveOptions({ maxInputBytes: 3 }),
            ),
        (error) => error instanceof ImageDecodeError && /maxInputBytes/.test(error.message),
    );

    assert.throws(
        () =>
            assertImageDataUrlInputBudget(
                dataUrlFor(pngHeader(100, 100)),
                resolveOptions({ maxInputPixels: 9999 }),
            ),
        (error) => error instanceof ImageDecodeError && /maxInputPixels/.test(error.message),
    );
});

test('assertImageDataUrlInputBudget accepts unpadded base64 image data URLs', () => {
    const dataUrl = dataUrlFor(pngHeader(2, 2)).replace(/=+$/, '');

    assert.doesNotThrow(() =>
        assertImageDataUrlInputBudget(
            dataUrl,
            resolveOptions({ maxInputBytes: 1024, maxInputPixels: 4 }),
        ),
    );
});
