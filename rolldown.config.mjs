/**
 * Bundles the emitted ESM distribution into CommonJS and Full UMD artifacts.
 *
 * TypeScript remains responsible for JavaScript and declaration emission.
 * Rolldown consumes only the pruned JavaScript tree under `dist/esm`.
 *
 * @module
 */

import { defineConfig } from 'rolldown';

import { FULL_UMD, MODULAR_UMD_CORE } from './config/bundle/modular-umd.mjs';

const format = process.env.FORMAT ?? 'umd';
const formalEntries = Object.freeze({
    index: 'dist/esm/index.js',
    'core/index': 'dist/esm/core/index.js',
    'sdk/index': 'dist/esm/sdk/index.js',
    'testing/index': 'dist/esm/testing/index.js',
    'migrate-v2/index': 'dist/esm/migrate-v2/index.js',
    'foundations/overlay/index': 'dist/esm/foundations/overlay/index.js',
    'foundations/annotation/index': 'dist/esm/foundations/annotation/index.js',
    'plugins/transform/index': 'dist/esm/plugins/transform/index.js',
    'plugins/mask/index': 'dist/esm/plugins/mask/index.js',
    'plugins/history/index': 'dist/esm/plugins/history/index.js',
    'plugins/filters/index': 'dist/esm/plugins/filters/index.js',
    'plugins/crop/index': 'dist/esm/plugins/crop/index.js',
    'plugins/mosaic/index': 'dist/esm/plugins/mosaic/index.js',
    'plugins/annotation-text/index': 'dist/esm/plugins/annotation-text/index.js',
    'plugins/annotation-shape/index': 'dist/esm/plugins/annotation-shape/index.js',
    'plugins/annotation-draw/index': 'dist/esm/plugins/annotation-draw/index.js',
    'plugins/overlay-state/index': 'dist/esm/plugins/overlay-state/index.js',
    'plugins/dom-controls/index': 'dist/esm/plugins/dom-controls/index.js',
    'presets/minimal/index': 'dist/esm/presets/minimal/index.js',
    'presets/redaction/index': 'dist/esm/presets/redaction/index.js',
    'presets/annotation/index': 'dist/esm/presets/annotation/index.js',
    'presets/full/index': 'dist/esm/presets/full/index.js',
});
const external = Object.freeze(['fabric']);

function createUmdConfiguration(definition, minify) {
    return {
        input: definition.input,
        external,
        platform: 'browser',
        output: {
            format: 'umd',
            name: definition.globalName,
            exports: 'named',
            globals: { fabric: 'fabric' },
            sourcemap: true,
            sourcemapExcludeSources: true,
            codeSplitting: false,
            file: `${definition.fileBase}.umd${minify ? '.min' : ''}.js`,
            minify,
            ...(definition.id === 'core' ? { extend: true } : {}),
        },
    };
}

const configurations = {
    cjs: {
        input: formalEntries,
        external,
        platform: 'node',
        output: {
            dir: 'dist/cjs',
            format: 'cjs',
            exports: 'named',
            entryFileNames: '[name].cjs',
            chunkFileNames: 'chunks/[name]-[hash].cjs',
            sourcemap: true,
            sourcemapExcludeSources: true,
            codeSplitting: true,
            minify: false,
        },
    },
    umd: [FULL_UMD, MODULAR_UMD_CORE].flatMap((definition) => [
        createUmdConfiguration(definition, false),
        createUmdConfiguration(definition, true),
    ]),
};

if (!(format in configurations)) {
    throw new Error(`[rolldown] Unknown FORMAT="${format}". Use "cjs" or "umd".`);
}

export default defineConfig(configurations[format]);
