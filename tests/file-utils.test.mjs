/**
 * @file file-utils.test.mjs
 *
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
 *   - Empty file.type values fall back to supported file extensions.
 *   - readFileAsDataURL rejects when FileReader aborts and restores the original
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

const {
    inferImageMimeType,
    readFileAsDataURL,
} = await import('../src/utils/file.ts');

test('inferImageMimeType accepts supported browser MIME types', () => {
    const file = new File(['x'], 'photo.png', { type: 'image/png' });
    assert.equal(inferImageMimeType(file), 'image/png');
});

test('inferImageMimeType rejects unsupported image MIME types', () => {
    const file = new File(['x'], 'vector.svg', { type: 'image/svg+xml' });
    assert.equal(inferImageMimeType(file), null);
});

test('inferImageMimeType falls back to supported file extensions when MIME is empty', () => {
    const file = new File(['x'], 'photo.webp', { type: '' });
    assert.equal(inferImageMimeType(file), 'image/webp');
});

test('readFileAsDataURL rejects when FileReader aborts', async () => {
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
            readFileAsDataURL(new File(['x'], 'photo.png', { type: 'image/png' })),
            /aborted/i,
        );
    } finally {
        globalThis.FileReader = OriginalFileReader;
    }
});
