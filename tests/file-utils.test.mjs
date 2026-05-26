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
