import assert from 'node:assert/strict';
import test from 'node:test';

import {
    compareMeasurements,
    validateBundleProvenance,
} from '../scripts/check-bundle-provenance.mjs';

function expected() {
    return {
        gitCommit: 'a'.repeat(40),
        packageVersion: '2.9.0',
        measurementConfigHash: 'config',
        artifactFingerprint: 'artifact',
        artifactLatestMtimeMs: 100,
        lockedBudgetsSha256: 'budgets',
        immutableBaselineSha256: 'immutable',
        rollupVersion: '4.61.1',
        fixtureNames: ['full-root'],
    };
}

function fixture() {
    return {
        entryPath: 'tests/bundle/fixtures/full-root/index.mjs',
        rawBytes: 10,
        minifiedBytes: 8,
        gzipBytes: 6,
        brotliBytes: 5,
        moduleCount: 1,
        modules: ['dist/esm/index.js'],
        externalDependencies: ['fabric'],
    };
}

function measurement() {
    const provenance = expected();
    return {
        schemaVersion: 1,
        metadata: {
            packageVersion: provenance.packageVersion,
            gitCommit: provenance.gitCommit,
            nodeVersion: 'v24.16.0',
            measuredAt: new Date(101).toISOString(),
            measurementConfigVersion: 1,
            measurementConfigHash: provenance.measurementConfigHash,
            artifactFingerprint: provenance.artifactFingerprint,
            artifactLatestMtimeMs: provenance.artifactLatestMtimeMs,
            lockedBudgetsSha256: provenance.lockedBudgetsSha256,
            immutableBaselineSha256: provenance.immutableBaselineSha256,
            bundler: { name: 'rollup', version: provenance.rollupVersion },
        },
        fixtures: { 'full-root': fixture() },
    };
}

test('bundle provenance accepts a complete current-head measurement', () => {
    assert.deepEqual(validateBundleProvenance(measurement(), expected()), []);
});

test('bundle provenance rejects a stale commit and artifact fingerprint', () => {
    const stale = measurement();
    stale.metadata.gitCommit = 'b'.repeat(40);
    stale.metadata.artifactFingerprint = 'stale';
    const errors = validateBundleProvenance(stale, expected());
    assert.ok(errors.some((error) => error.includes('gitCommit mismatch')));
    assert.ok(errors.some((error) => error.includes('artifactFingerprint mismatch')));
});

test('bundle provenance rejects incomplete fixtures and non-Fabric externals', () => {
    const invalid = measurement();
    delete invalid.fixtures['full-root'].brotliBytes;
    invalid.fixtures['full-root'].externalDependencies.push('semver');
    const errors = validateBundleProvenance(invalid, expected());
    assert.ok(errors.some((error) => error.includes('brotliBytes')));
    assert.ok(errors.some((error) => error.includes('other than Fabric')));
});

test('live comparison rejects byte, module, and import-graph drift', () => {
    const baseline = measurement();
    const live = measurement();
    live.fixtures['full-root'].gzipBytes += 1;
    live.fixtures['full-root'].modules = ['dist/esm/other.js'];
    const errors = compareMeasurements(baseline, live);
    assert.ok(errors.some((error) => error.includes('gzipBytes')));
    assert.ok(errors.some((error) => error.includes('modules')));
});
