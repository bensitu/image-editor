/**
 * rollup.config.mjs
 *
 * Builds the CJS and UMD bundles for `@bensitu/image-editor` from the
 * already-emitted ESM tree under `dist/esm/`. Both passes share the same
 * input so TypeScript is compiled exactly once (by `tsc -p
 * tsconfig.build.json`) and Rollup only re-bundles the resulting JS.
 *
 *   FORMAT=cjs  →  dist/cjs/index.cjs              (CommonJS, unminified)
 *   FORMAT=umd  →  dist/umd/image-editor.full.umd.js     (Full UMD)
 *                  dist/umd/image-editor.full.umd.min.js (Full UMD, minified)
 *
 * Build pipeline (npm run build):
 *
 *   clean → build:esm → build:cjs → build:types → build:umd
 *           (tsc)       (rollup)    (tsc)         (rollup)
 *
 * Ordering matters: the CJS and UMD passes depend on the ESM emit being
 * present at `dist/esm/index.js` before Rollup runs.
 *
 * `fabric` is declared as an external global in both passes so the UMD
 * bundle picks it up from `globalThis.fabric` at runtime, matching the
 * peerDependency contract from `package.json`.
 *
 * npm scripts:
 *   npm run build:cjs  →  rollup -c --environment FORMAT:cjs
 *   npm run build:umd  →  rollup -c --environment FORMAT:umd
 */

import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

const FORMAT = process.env.FORMAT ?? 'umd';

/**
 * Both passes consume the ESM emit produced by `tsc -p tsconfig.build.json`.
 * Rollup performs whole-program bundling on this entry, collapsing the
 * decomposed `dist/esm/<subsystem>/...` tree into a single output file.
 */
const INPUT = 'dist/esm/index.js';
const CJS_INPUTS = {
    index: INPUT,
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
};

/**
 * `fabric` is a peer dependency. It must never be inlined into the CJS or
 * UMD bundles: ESM/CJS consumers import it themselves, and UMD consumers
 * load it via `<script>` so it lives on `globalThis.fabric`.
 */
const EXTERNAL = ['fabric'];

const configs = {
    cjs: {
        input: CJS_INPUTS,
        external: EXTERNAL,
        output: {
            dir: 'dist/cjs',
            entryFileNames: '[name].cjs',
            chunkFileNames: 'chunks/[name]-[hash].cjs',
            format: 'cjs',
            exports: 'named',
            sourcemap: true,
        },
        plugins: [resolve(), commonjs()],
    },
    umd: [
        {
            input: 'dist/esm/umd/full.js',
            external: EXTERNAL,
            output: {
                file: 'dist/umd/image-editor.full.umd.js',
                format: 'umd',
                name: 'ImageEditorFull',
                exports: 'named',
                globals: { fabric: 'fabric' },
                sourcemap: true,
            },
            plugins: [resolve(), commonjs()],
        },
        {
            input: 'dist/esm/umd/full.js',
            external: EXTERNAL,
            output: {
                file: 'dist/umd/image-editor.full.umd.min.js',
                format: 'umd',
                name: 'ImageEditorFull',
                exports: 'named',
                globals: { fabric: 'fabric' },
                sourcemap: true,
            },
            plugins: [resolve(), commonjs(), terser()],
        },
    ],
};

if (!(FORMAT in configs)) {
    throw new Error(`[rollup] Unknown FORMAT="${FORMAT}". Use "cjs" or "umd".`);
}

export default configs[FORMAT];
