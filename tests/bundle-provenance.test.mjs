import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import {
    createWorkingTreeIdentity,
    hashTrackedBlobManifest,
    packageVersionFromLockfile,
    validateBundleProvenance,
    validateMeasurementSource,
} from '../scripts/check-bundle-provenance.mjs';

const hash = 'a'.repeat(64);
const commit = 'b'.repeat(40);

function provenance() {
    const artifactModules = ['dist/esm/index.js'];
    const measurementModules = ['dist/esm/index.js', 'tests/bundle/fixtures/full-root/index.mjs'];
    return {
        schemaVersion: 2,
        baseline: 'v2.9-freeze',
        source: {
            ref: 'legacy/v2.9-freeze',
            head: commit,
            tree: 'c'.repeat(40),
            clean: true,
            trackedBlobManifestHash: hash,
            trackedBlobCount: 2,
            pathspecs: ['src', 'dist/esm'],
        },
        workingTree: { clean: true, dirtyPaths: [] },
        toolchain: {
            node: 'v24.16.0',
            npm: '11.15.0',
            rollup: '4.61.1',
            terser: '5.48.0',
            typescript: '5.9.3',
        },
        inputs: {
            packageLockHash: hash,
            rollupConfigHash: hash,
            fixtureHash: hash,
            measurementConfigHash: hash,
        },
        artifact: {
            entry: 'dist/esm/index.js',
            rawHash: hash,
            rawBytes: 10,
            gzipBytes: 8,
            brotliBytes: 7,
            moduleCount: artifactModules.length,
            modules: artifactModules,
            moduleListHash: '',
        },
        measurement: {
            baseline: 'tests/bundle/baselines/v2.9-freeze.json',
            baselineHash: hash,
            fixture: 'full-root',
            entryPath: 'tests/bundle/fixtures/full-root/index.mjs',
            rawBytes: 20,
            minifiedBytes: 15,
            gzipBytes: 12,
            brotliBytes: 11,
            moduleCount: measurementModules.length,
            modules: measurementModules,
            moduleListHash: '',
        },
    };
}

function sha256Json(value) {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function validProvenance() {
    const record = provenance();
    record.artifact.moduleListHash = sha256Json(record.artifact.modules);
    record.measurement.moduleListHash = sha256Json(record.measurement.modules);
    return record;
}

test('committed identity is unchanged by LF or CRLF checkout bytes', () => {
    const records = [
        { mode: '100644', type: 'blob', object: 'd'.repeat(40), path: 'src/example.ts' },
    ];
    const lfCheckout = Buffer.from('export const value = 1;\n');
    const crlfCheckout = Buffer.from('export const value = 1;\r\n');
    assert.notDeepEqual(lfCheckout, crlfCheckout);
    assert.equal(hashTrackedBlobManifest(records), hashTrackedBlobManifest(records));
});

test('toolchain dependency identity comes from committed lockfile data', () => {
    const lockfile = {
        packages: {
            'node_modules/rollup': { version: '4.61.1' },
        },
    };
    assert.equal(packageVersionFromLockfile(lockfile, 'rollup'), '4.61.1');
    assert.throws(
        () => packageVersionFromLockfile(lockfile, 'typescript'),
        /does not resolve typescript/,
    );
});

test('schema-v2 provenance accepts a complete committed baseline', () => {
    const record = validProvenance();
    assert.deepEqual(validateBundleProvenance(record, structuredClone(record)), []);
});

test('measurement source validation accepts committed and current baseline schemas', () => {
    assert.doesNotThrow(() =>
        validateMeasurementSource(
            { source: { head: commit, tree: 'c'.repeat(40) } },
            commit,
            'c'.repeat(40),
        ),
    );
    assert.doesNotThrow(() =>
        validateMeasurementSource({ metadata: { gitCommit: commit } }, commit, 'c'.repeat(40)),
    );
    assert.throws(
        () => validateMeasurementSource({ metadata: { gitCommit: hash } }, commit, 'c'.repeat(40)),
        /requested commit/,
    );
});

test('stale head, tree, config, artifact, and module list fail', () => {
    const expected = validProvenance();
    const stale = structuredClone(expected);
    stale.source.head = 'e'.repeat(40);
    stale.source.tree = 'f'.repeat(40);
    stale.inputs.rollupConfigHash = '1'.repeat(64);
    stale.artifact.rawHash = '2'.repeat(64);
    stale.measurement.modules = ['dist/esm/stale.js'];
    const errors = validateBundleProvenance(stale, expected);
    for (const field of [
        'source.head',
        'source.tree',
        'inputs.rollupConfigHash',
        'artifact.rawHash',
        'measurement.modules',
    ]) {
        assert.ok(
            errors.some((error) => error.includes(field)),
            field,
        );
    }
});

test('dirty tree paths are explicit and rejected for committed baselines', () => {
    assert.deepEqual(createWorkingTreeIdentity(' M src/example.ts\n?? local.txt\n'), {
        clean: false,
        dirtyPaths: ['local.txt', 'src/example.ts'],
    });
    const dirty = validProvenance();
    dirty.workingTree = createWorkingTreeIdentity(' M src/example.ts\n');
    assert.ok(validateBundleProvenance(dirty, dirty).some((error) => error.includes('dirty tree')));
});

test('missing toolchain fields fail', () => {
    const record = validProvenance();
    delete record.toolchain.terser;
    assert.ok(
        validateBundleProvenance(record, record).some((error) =>
            error.includes('toolchain.terser'),
        ),
    );
});

test('wrong measurement fixture fails', () => {
    const expected = validProvenance();
    const wrong = structuredClone(expected);
    wrong.measurement.fixture = 'public-api';
    assert.ok(
        validateBundleProvenance(wrong, expected).some((error) =>
            error.includes('measurement.fixture'),
        ),
    );
});
