/**
 * Bundles the emitted ESM distribution into CommonJS and Full UMD artifacts.
 *
 * TypeScript remains responsible for JavaScript and declaration emission.
 * Rolldown consumes only the pruned JavaScript tree under `dist/esm`.
 *
 * @module
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'rolldown';

import {
    FULL_UMD,
    MODULAR_UMD_BOUNDARIES,
    MODULAR_UMD_GLOBALS,
    MODULAR_UMD_MODULES,
} from './config/bundle/modular-umd.mjs';

const repositoryRoot = path.dirname(fileURLToPath(import.meta.url));
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
    'plugins/canvas-interactions/index': 'dist/esm/plugins/canvas-interactions/index.js',
    'presets/minimal/index': 'dist/esm/presets/minimal/index.js',
    'presets/redaction/index': 'dist/esm/presets/redaction/index.js',
    'presets/annotation/index': 'dist/esm/presets/annotation/index.js',
    'presets/full/index': 'dist/esm/presets/full/index.js',
});
const external = Object.freeze(['fabric']);

function normalizedAbsolutePath(value) {
    const normalized = path.normalize(value);
    return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

const modularUmdBoundaries = new Map(
    MODULAR_UMD_BOUNDARIES.map((boundary) => [
        normalizedAbsolutePath(path.resolve(repositoryRoot, boundary.input)),
        boundary.externalId,
    ]),
);

function createModularUmdBoundaryPlugin() {
    return {
        name: 'image-editor-modular-umd-boundaries',
        async resolveId(source, importer) {
            if (!importer || !source.startsWith('.')) return null;
            const resolved = await this.resolve(source, importer, { skipSelf: true });
            if (!resolved || resolved.external) return null;
            const externalId = modularUmdBoundaries.get(
                normalizedAbsolutePath(resolved.id.split('?')[0]),
            );
            return externalId ? { id: externalId, external: true } : null;
        },
    };
}

function createUmdConfiguration(definition, minify) {
    const modularPlugin =
        definition.sourceKind === 'foundation' || definition.sourceKind === 'plugin';
    return {
        input: definition.input,
        external,
        ...(modularPlugin ? { plugins: [createModularUmdBoundaryPlugin()] } : {}),
        platform: 'browser',
        output: {
            format: 'umd',
            name: definition.globalName,
            exports: 'named',
            globals: modularPlugin ? MODULAR_UMD_GLOBALS : { fabric: 'fabric' },
            sourcemap: true,
            sourcemapExcludeSources: true,
            codeSplitting: false,
            file: `${definition.fileBase}.umd${minify ? '.min' : ''}.js`,
            minify,
            ...(definition.id !== 'full' ? { extend: true } : {}),
            ...(modularPlugin
                ? {
                      intro:
                          `if (Object.prototype.hasOwnProperty.call(exports, ` +
                          `${JSON.stringify(definition.guardExport)})) return;`,
                  }
                : {}),
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
    umd: [FULL_UMD, ...MODULAR_UMD_MODULES].flatMap((definition) => [
        createUmdConfiguration(definition, false),
        createUmdConfiguration(definition, true),
    ]),
};

if (!(format in configurations)) {
    throw new Error(`[rolldown] Unknown FORMAT="${format}". Use "cjs" or "umd".`);
}

export default defineConfig(configurations[format]);
