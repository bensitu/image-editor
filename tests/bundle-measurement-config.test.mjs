/**
 * Verifies that bundle measurements use one cross-platform text representation.
 *
 * @module
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
    BUNDLE_MEASUREMENT_CONFIG,
    hashNormalizedText,
    normalizeBundleMeasurementText,
} from '../scripts/bundle-measurement-config.mjs';

test('bundle measurement text normalizes CRLF and CR to LF', () => {
    assert.equal(BUNDLE_MEASUREMENT_CONFIG.schemaVersion, 2);
    assert.equal(BUNDLE_MEASUREMENT_CONFIG.output.lineEndings, 'lf');
    assert.equal(
        normalizeBundleMeasurementText('first\r\nsecond\rthird\n'),
        'first\nsecond\nthird\n',
    );
    assert.equal(
        hashNormalizedText('first\r\nsecond\rthird\n'),
        hashNormalizedText('first\nsecond\nthird\n'),
    );
});
