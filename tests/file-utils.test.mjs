/**
 * Type:
 *   Unit test
 *
 * Purpose:
 *   Verifies src/utils/file.ts helpers used by the image-input loading path. The
 *   suite covers supported MIME values, extension fallback for empty MIME strings,
 *   rejection of unsupported image types, and FileReader abort handling.
 *
 * Scope:
 *   - inferImageMimeType accepts supported browser MIME types and rejects unsupported
 *     ones.
 *   - isSupportedImageDataUrl accepts only supported image data URL MIME types.
 *   - Empty file.type values fall back to supported file extensions.
 *   - readFileAsDataUrl rejects when FileReader aborts and restores the original
 *     global FileReader after the test.
 *
 * Out of scope:
 *   - unrelated editor features
 *   - visual rendering quality
 *   - browser-specific integration details
 *
 * Environment:
 *   - Node.js ESM
 *   - source modules are imported directly where possible
 *
 * Run:
 *   node --test tests/file-utils.test.mjs
 *
 * Notes:
 *   - Prefer behavior-level assertions over implementation-detail checks.
 *   - Keep this file focused on file utility MIME inference and data URL reading
 *     only.
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';

const { inferImageMimeType, isSupportedImageDataUrl, readFileAsDataUrl } =
    await import('../src/utils/file.ts');

test('inferImageMimeType accepts supported browser MIME types', () => {
    for (const [name, type] of [
        ['photo.png', 'image/png'],
        ['photo.jpg', 'image/jpeg'],
        ['photo.webp', 'image/webp'],
    ]) {
        const file = new File(['x'], name, { type });
        assert.equal(inferImageMimeType(file), type);
    }
});

test('inferImageMimeType rejects unsupported image MIME types', () => {
    const file = new File(['x'], 'vector.svg', { type: 'image/svg+xml' });
    assert.equal(inferImageMimeType(file), null);
    assert.equal(inferImageMimeType(new File(['x'], 'anim.gif', { type: 'image/gif' })), null);
    assert.equal(inferImageMimeType(new File(['x'], 'bitmap.bmp', { type: 'image/bmp' })), null);
});

test('inferImageMimeType falls back to supported file extensions when MIME is empty', () => {
    for (const [name, type] of [
        ['photo.webp', 'image/webp'],
        ['photo.jpeg', 'image/jpeg'],
        ['photo.png', 'image/png'],
    ]) {
        const file = new File(['x'], name, { type: '' });
        assert.equal(inferImageMimeType(file), type);
    }
});

test('isSupportedImageDataUrl rejects unsupported image MIME types', () => {
    assert.equal(isSupportedImageDataUrl('data:image/png;base64,AAAA'), true);
    assert.equal(isSupportedImageDataUrl('data:image/jpeg;base64,AAAA'), true);
    assert.equal(isSupportedImageDataUrl('data:image/webp;base64,AAAA'), true);
    assert.equal(isSupportedImageDataUrl('data:image/gif;base64,AAAA'), false);
    assert.equal(isSupportedImageDataUrl('data:image/bmp;base64,AAAA'), false);
    assert.equal(isSupportedImageDataUrl('data:image/svg+xml;base64,AAAA'), false);
    assert.equal(isSupportedImageDataUrl('data:image/avif;base64,AAAA'), false);
    assert.equal(isSupportedImageDataUrl('data:text/plain;base64,AAAA'), false);
    assert.equal(isSupportedImageDataUrl('DATA:IMAGE/PNG;base64,AAAA'), false);
});

test('readFileAsDataUrl rejects when FileReader aborts', async () => {
    const OriginalFileReader = globalThis.FileReader;

    class AbortFileReader {
        result = null;
        error = null;
        onload = null;
        onerror = null;
        onabort = null;

        readAsDataURL() {
            queueMicrotask(() => {
                this.onabort?.();
            });
        }
    }

    globalThis.FileReader = AbortFileReader;
    try {
        await assert.rejects(
            readFileAsDataUrl(new File(['x'], 'photo.png', { type: 'image/png' })),
            /aborted/i,
        );
    } finally {
        globalThis.FileReader = OriginalFileReader;
    }
});
