import assert from 'node:assert/strict';
import test from 'node:test';

import { assertCodemodPackagePolicy } from '../../scripts/codemod-package-policy.mjs';

function codemodManifest(overrides = {}) {
    return {
        name: '@bensitu/image-editor-codemod',
        version: '3.0.0-rc.1',
        main: './dist/index.js',
        types: './dist/index.d.ts',
        bin: { 'image-editor-codemod': './dist/cli.js' },
        exports: {
            '.': {
                types: './dist/index.d.ts',
                import: './dist/index.js',
                default: './dist/index.js',
            },
        },
        sideEffects: false,
        publishConfig: { access: 'public', provenance: true },
        ...overrides,
    };
}

const rootManifest = { version: '3.0.0-rc.1' };
const packedFiles = ['dist/cli.js', 'dist/index.js', 'dist/index.d.ts', 'README.md', 'LICENSE'];

test('Codemod publish policy accepts the aligned package and packed entries', () => {
    assert.doesNotThrow(() =>
        assertCodemodPackagePolicy(rootManifest, codemodManifest(), packedFiles),
    );
});

test('Codemod publish policy rejects version drift and missing declarations', () => {
    assert.throws(
        () =>
            assertCodemodPackagePolicy(
                rootManifest,
                codemodManifest({ version: '3.0.0' }),
                packedFiles,
            ),
        /must match root version/u,
    );
    assert.throws(
        () =>
            assertCodemodPackagePolicy(
                rootManifest,
                codemodManifest(),
                packedFiles.filter((filePath) => filePath !== 'dist/index.d.ts'),
            ),
        /missing dist\/index\.d\.ts/u,
    );
});
