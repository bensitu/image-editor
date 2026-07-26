/**
 * Defines stable settings for live consumer-bundle measurements.
 *
 * @module
 */

export const BUNDLE_MEASUREMENT_CONFIG = Object.freeze({
    bundler: Object.freeze({
        platform: 'browser',
        format: 'es',
        exports: 'named',
        codeSplitting: false,
        sourcemap: false,
        minify: false,
        treeshake: Object.freeze({
            moduleSideEffects: false,
            propertyReadSideEffects: false,
        }),
    }),
    minifier: Object.freeze({ minify: true }),
    gzip: Object.freeze({ level: 9 }),
    brotli: Object.freeze({ quality: 11 }),
});

/** Converts generated bundle text to a cross-platform measurement form. */
export function normalizeBundleMeasurementText(value) {
    return value.replace(/\r\n?/gu, '\n');
}
