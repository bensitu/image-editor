/**
 * Rejects stale or structurally incomplete current-head bundle measurements.
 *
 * This guard validates provenance only. Live byte equality is additionally
 * checked by `check-bundle-size.mjs --verify-current-head`.
 *
 * @module
 */

import { execFile } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { VERSION as rollupVersion } from 'rollup';

import {
    BUNDLE_MEASUREMENT_CONFIG_HASH,
    fingerprintMeasurementInputs,
    hashFile,
    latestMeasurementInputMtime,
} from './bundle-measurement-config.mjs';

const execFileAsync = promisify(execFile);
const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, '..');
const fixturesRoot = path.join(repoRoot, 'tests', 'bundle', 'fixtures');
const baselinesRoot = path.join(repoRoot, 'tests', 'bundle', 'baselines');
const budgetsPath = path.join(repoRoot, 'tests', 'bundle', 'budgets.json');
const immutableBaselinePath = path.join(baselinesRoot, 'v2.9.0.json');
const measuredFields = ['rawBytes', 'minifiedBytes', 'gzipBytes', 'brotliBytes', 'moduleCount'];

function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateBundleProvenance(measurement, expected) {
    const errors = [];
    if (!isRecord(measurement) || measurement.schemaVersion !== 1) {
        return ['measurement must use schemaVersion 1.'];
    }
    const metadata = measurement.metadata;
    if (!isRecord(metadata)) return ['measurement metadata is missing.'];
    const exactMetadata = [
        ['gitCommit', expected.gitCommit],
        ['packageVersion', expected.packageVersion],
        ['measurementConfigHash', expected.measurementConfigHash],
        ['artifactFingerprint', expected.artifactFingerprint],
        ['lockedBudgetsSha256', expected.lockedBudgetsSha256],
        ['immutableBaselineSha256', expected.immutableBaselineSha256],
    ];
    for (const [field, expectedValue] of exactMetadata) {
        if (metadata[field] !== expectedValue) {
            errors.push(
                `metadata.${field} mismatch: expected ${expectedValue}, received ${String(metadata[field])}.`,
            );
        }
    }
    if (metadata.measurementConfigVersion !== 1) {
        errors.push('metadata.measurementConfigVersion must equal 1.');
    }
    if (
        metadata.bundler?.name !== 'rollup' ||
        metadata.bundler?.version !== expected.rollupVersion
    ) {
        errors.push(`metadata.bundler must be rollup ${expected.rollupVersion}.`);
    }
    if (typeof metadata.nodeVersion !== 'string' || !/^v\d+\.\d+\.\d+/.test(metadata.nodeVersion)) {
        errors.push('metadata.nodeVersion is missing or malformed.');
    }
    const measuredAt = Date.parse(metadata.measuredAt);
    if (!Number.isFinite(measuredAt)) {
        errors.push('metadata.measuredAt is missing or invalid.');
    }
    if (metadata.artifactLatestMtimeMs !== expected.artifactLatestMtimeMs) {
        errors.push('metadata.artifactLatestMtimeMs does not match current measurement inputs.');
    }
    if (Number.isFinite(measuredAt) && measuredAt + 1 < expected.artifactLatestMtimeMs) {
        errors.push('measurement predates a current build artifact or fixture.');
    }

    if (!isRecord(measurement.fixtures)) {
        errors.push('measurement fixtures are missing.');
        return errors;
    }
    const actualNames = Object.keys(measurement.fixtures).sort();
    const expectedNames = [...expected.fixtureNames].sort();
    if (JSON.stringify(actualNames) !== JSON.stringify(expectedNames)) {
        errors.push(
            `fixture set mismatch: expected ${expectedNames.join(', ')}, received ${actualNames.join(', ')}.`,
        );
    }
    for (const fixtureName of expectedNames) {
        const fixture = measurement.fixtures[fixtureName];
        if (!isRecord(fixture)) {
            errors.push(`${fixtureName}: measurement is missing.`);
            continue;
        }
        for (const field of measuredFields) {
            if (!Number.isSafeInteger(fixture[field]) || fixture[field] < 0) {
                errors.push(`${fixtureName}.${field} must be a non-negative safe integer.`);
            }
        }
        if (!Array.isArray(fixture.modules) || fixture.modules.length !== fixture.moduleCount) {
            errors.push(`${fixtureName}.modules must contain exactly moduleCount entries.`);
        }
        if (!Array.isArray(fixture.externalDependencies)) {
            errors.push(`${fixtureName}.externalDependencies must be an array.`);
        } else if (fixture.externalDependencies.some((dependency) => dependency !== 'fabric')) {
            errors.push(`${fixtureName} externalizes a runtime dependency other than Fabric.`);
        }
        if (typeof fixture.entryPath !== 'string' || fixture.entryPath.length === 0) {
            errors.push(`${fixtureName}.entryPath is missing.`);
        }
    }
    return errors;
}

export function compareMeasurements(expected, actual) {
    const errors = [];
    for (const [fixtureName, expectedFixture] of Object.entries(expected.fixtures ?? {})) {
        const actualFixture = actual.fixtures?.[fixtureName];
        if (!actualFixture) {
            errors.push(`${fixtureName}: live measurement is missing.`);
            continue;
        }
        for (const field of measuredFields) {
            if (actualFixture[field] !== expectedFixture[field]) {
                errors.push(
                    `${fixtureName}.${field}: baseline=${expectedFixture[field]}, live=${actualFixture[field]}.`,
                );
            }
        }
        for (const field of ['entryPath', 'modules', 'externalDependencies']) {
            if (JSON.stringify(actualFixture[field]) !== JSON.stringify(expectedFixture[field])) {
                errors.push(`${fixtureName}.${field} differs from the live measurement.`);
            }
        }
    }
    return errors;
}

async function fixtureNames() {
    return (await readdir(fixturesRoot, { withFileTypes: true }))
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort();
}

async function gitCommit() {
    const { stdout } = await execFileAsync('git', ['-C', repoRoot, 'rev-parse', 'HEAD']);
    return stdout.trim();
}

export async function createExpectedProvenance() {
    const packageJson = JSON.parse(await readFile(path.join(repoRoot, 'package.json'), 'utf8'));
    return {
        gitCommit: await gitCommit(),
        packageVersion: packageJson.version,
        measurementConfigHash: BUNDLE_MEASUREMENT_CONFIG_HASH,
        artifactFingerprint: await fingerprintMeasurementInputs(repoRoot, fixturesRoot),
        artifactLatestMtimeMs: await latestMeasurementInputMtime(repoRoot, fixturesRoot),
        lockedBudgetsSha256: await hashFile(budgetsPath),
        immutableBaselineSha256: await hashFile(immutableBaselinePath),
        rollupVersion,
        fixtureNames: await fixtureNames(),
    };
}

async function main() {
    const baselineName = process.argv[2] ?? 'current';
    if (!/^[a-z0-9][a-z0-9.-]*$/i.test(baselineName)) {
        throw new Error(`Invalid baseline name: ${baselineName}`);
    }
    const measurement = JSON.parse(
        await readFile(path.join(baselinesRoot, `${baselineName}.json`), 'utf8'),
    );
    const errors = validateBundleProvenance(measurement, await createExpectedProvenance());
    if (errors.length > 0) {
        console.error(`Bundle provenance check failed for ${baselineName}.json:`);
        for (const error of errors) console.error(`- ${error}`);
        process.exitCode = 1;
        return;
    }
    console.log(`Bundle provenance check passed for ${baselineName}.json.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
