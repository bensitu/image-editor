import assert from 'node:assert/strict';
import test from 'node:test';

import semver from 'semver';

import {
    isValidSemVer,
    isValidSemVerRange,
    satisfiesSemVer,
} from '../../src/plugin-kernel/semver.js';

const validVersions = [
    '0.0.0',
    '1.0.0',
    '1.2.3',
    '1.2.3-alpha',
    '1.2.3-alpha.2',
    '1.2.3+build.7',
    '10.20.30-alpha.1+build.9',
];
const invalidVersions = ['1', '1.2', '01.2.3', '1.02.3', '1.2.03', '1.2.3-', 'not-semver'];
const ranges = [
    '*',
    '1',
    '1.2',
    '1.x',
    '1.2.*',
    '1.2.3',
    '^1.2.3',
    '^0.2.3',
    '^1.2.3-alpha.1',
    '~1.2.3',
    '~1.2',
    '>=1.0.0 <2.0.0',
    '>1',
    '<=1.2',
    '1.2.3 - 2.0.0',
    '1.2.3 || >=2.0.0 <3.0.0',
];

test('SemVer validation matches strict package version rules', () => {
    for (const version of validVersions) {
        assert.equal(isValidSemVer(version), semver.valid(version) !== null, version);
    }
    for (const version of invalidVersions) {
        assert.equal(isValidSemVer(version), semver.valid(version) !== null, version);
    }
});

test('SemVer range evaluation matches npm behavior for supported range forms', () => {
    const versions = [
        ...validVersions,
        '0.2.3',
        '0.2.9',
        '0.3.0',
        '1.2.4',
        '1.9.9',
        '2.0.0',
        '2.4.1',
        '3.0.0',
    ];
    for (const range of ranges) {
        assert.equal(isValidSemVerRange(range), semver.validRange(range) !== null, range);
        for (const version of versions) {
            assert.equal(
                satisfiesSemVer(version, range),
                semver.satisfies(version, range, { includePrerelease: false }),
                `${version} in ${range}`,
            );
        }
    }
});

test('invalid and padded ranges are rejected without throwing', () => {
    for (const range of ['', ' ^1.0.0', '^1.0.0 ', '>=', '^', 'not-range', '1 ||']) {
        assert.equal(isValidSemVerRange(range), false, range);
        assert.equal(satisfiesSemVer('1.0.0', range), false, range);
    }
});

test('SemVer comparison remains aligned with npm across deterministic range families', () => {
    const versions = [];
    for (let major = 0; major <= 3; major += 1) {
        for (let minor = 0; minor <= 3; minor += 1) {
            for (let patch = 0; patch <= 3; patch += 1) {
                const base = `${major}.${minor}.${patch}`;
                versions.push(base, `${base}-0`, `${base}-alpha`, `${base}-alpha.1`);
            }
        }
    }
    const generatedRanges = [];
    for (let major = 0; major <= 3; major += 1) {
        for (let minor = 0; minor <= 2; minor += 1) {
            const base = `${major}.${minor}.0`;
            generatedRanges.push(
                `${major}`,
                `${major}.${minor}`,
                `${major}.${minor}.x`,
                `^${base}`,
                `~${major}.${minor}`,
                `>=${base} <${major + 1}.0.0`,
                `${base} - ${major + 1}.0.0`,
                `^${base}-alpha.1`,
            );
        }
    }

    for (const range of generatedRanges) {
        assert.equal(isValidSemVerRange(range), semver.validRange(range) !== null, range);
        for (const version of versions) {
            assert.equal(
                satisfiesSemVer(version, range),
                semver.satisfies(version, range, { includePrerelease: false }),
                `${version} in ${range}`,
            );
        }
    }
});
