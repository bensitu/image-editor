import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';

const { resampleImage } = await import('../src/image/image-resampler.ts');

function makeDocumentRecorder(label) {
    const calls = [];
    return {
        calls,
        document: {
            createElement(tagName) {
                calls.push({ label, tagName });
                return {
                    width: 0,
                    height: 0,
                    getContext(type) {
                        assert.equal(type, '2d');
                        return {
                            drawImage() {},
                        };
                    },
                    toDataURL(type, quality) {
                        return `data:${type};base64,${Buffer.from(String(quality ?? 'none')).toString('base64')}`;
                    },
                };
            },
        },
    };
}

test('resampleImage creates its offscreen canvas from the provided ownerDocument', () => {
    const explicit = makeDocumentRecorder('explicit');
    const imageOwner = makeDocumentRecorder('image');
    const global = makeDocumentRecorder('global');
    const previousDocument = globalThis.document;
    globalThis.document = global.document;

    try {
        const imageElement = {
            naturalWidth: 120,
            naturalHeight: 80,
            ownerDocument: imageOwner.document,
        };

        const result = resampleImage(
            imageElement,
            60,
            40,
            'image/png',
            true,
            undefined,
            0.7,
            explicit.document,
        );

        assert.match(result.dataUrl, /^data:image\/png;base64,/);
        assert.equal(explicit.calls.length, 1);
        assert.equal(imageOwner.calls.length, 0);
        assert.equal(global.calls.length, 0);
    } finally {
        if (previousDocument === undefined) {
            delete globalThis.document;
        } else {
            globalThis.document = previousDocument;
        }
    }
});

test('resampleImage falls back to the image ownerDocument before global document', () => {
    const imageOwner = makeDocumentRecorder('image');
    const global = makeDocumentRecorder('global');
    const previousDocument = globalThis.document;
    globalThis.document = global.document;

    try {
        const imageElement = {
            naturalWidth: 120,
            naturalHeight: 80,
            ownerDocument: imageOwner.document,
        };

        resampleImage(imageElement, 60, 40, 'image/png', true, undefined, 0.7);

        assert.equal(imageOwner.calls.length, 1);
        assert.equal(global.calls.length, 0);
    } finally {
        if (previousDocument === undefined) {
            delete globalThis.document;
        } else {
            globalThis.document = previousDocument;
        }
    }
});
