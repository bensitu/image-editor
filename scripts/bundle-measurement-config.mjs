/**
 * Defines stable settings for live consumer-bundle measurements.
 *
 * @module
 */

export const BUNDLE_MEASUREMENT_CONFIG = Object.freeze({
    rollup: Object.freeze({
        format: 'es',
        exports: 'named',
        inlineDynamicImports: true,
        sourcemap: false,
        treeshake: Object.freeze({
            moduleSideEffects: false,
            propertyReadSideEffects: false,
        }),
    }),
    terser: Object.freeze({
        compressPasses: 2,
        comments: false,
        mangle: true,
    }),
    gzip: Object.freeze({ level: 9 }),
    brotli: Object.freeze({ quality: 11 }),
});

/** Converts generated bundle text to a cross-platform measurement form. */
export function normalizeBundleMeasurementText(value) {
    return value.replace(/\r\n?/gu, '\n');
}
