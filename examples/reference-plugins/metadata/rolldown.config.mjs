/**
 * Bundles the emitted plugin entry for CommonJS consumers.
 *
 * @module
 */

import { defineConfig } from 'rolldown';

export default defineConfig({
    input: 'dist/esm/index.js',
    external: (source) =>
        source === 'fabric' ||
        source.startsWith('fabric/') ||
        source === '@bensitu/image-editor' ||
        source.startsWith('@bensitu/image-editor/'),
    platform: 'node',
    output: {
        file: 'dist/cjs/index.cjs',
        format: 'cjs',
        exports: 'named',
        codeSplitting: false,
        minify: false,
    },
});
