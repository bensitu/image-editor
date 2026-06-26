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

test('loadImageFile rethrows loadImage failures and resets the file input', async () => {
    const OriginalFileReader = globalThis.FileReader;
    const input = { value: 'C:\\fakepath\\photo.png' };
    const failure = new Error('decode failed');

    class SuccessFileReader {
        result = null;
        error = null;
        onload = null;
        onerror = null;
        onabort = null;

        readAsDataURL() {
            this.result = 'data:image/png;base64,AAAA';
            queueMicrotask(() => {
                this.onload?.();
            });
        }
    }

    globalThis.FileReader = SuccessFileReader;
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
        globalThis.FileReader = OriginalFileReader;
    }
});
