/**
 * rollup.config.mjs
 *
 * Builds two bundle formats that tsc alone cannot produce cleanly:
 *
 *   FORMAT=cjs  →  dist/cjs/index.js       (CommonJS, unminified)
 *   FORMAT=umd  →  dist/umd/image-editor.umd.js  (UMD, minified)
 *
 * Both use the same Rollup resolver, so .js-extension imports in source files
 * (required for ESM interop) resolve correctly without needing a special
 * moduleResolution setting in tsconfig.cjs.json.
 *
 * The previous tsc-based CJS build (tsconfig.cjs.json) failed because
 * `moduleResolution: "node"` does not map `.js` imports → `.ts` source files.
 * Rollup handles this transparently through @rollup/plugin-node-resolve.
 *
 * npm scripts:
 *   npm run build:cjs  →  rollup -c --environment FORMAT:cjs
 *   npm run build:umd  →  rollup -c --environment FORMAT:umd
 */

import resolve  from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';

const FORMAT = process.env.FORMAT ?? 'umd';

const sharedPlugins = [
    resolve(),
    commonjs(),
    typescript({ tsconfig: './tsconfig.json' }),
];

const configs = {
    cjs: {
        input: 'src/index.ts',
        external: ['fabric'],
        output: {
            file: 'dist/cjs/index.js',
            format: 'cjs',
            exports: 'named',
            sourcemap: true,
        },
        plugins: sharedPlugins,
    },
    umd: {
        input: 'src/index.ts',
        external: ['fabric'],
        output: {
            file: 'dist/umd/image-editor.umd.js',
            format: 'umd',
            name: 'ImageEditor',
            globals: { fabric: 'fabric' },
            sourcemap: true,
        },
        plugins: [...sharedPlugins, terser()],
    },
};

if (!(FORMAT in configs)) {
    throw new Error(`[rollup] Unknown FORMAT="${FORMAT}". Use "cjs" or "umd".`);
}

export default configs[FORMAT];
