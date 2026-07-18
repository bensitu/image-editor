/**
 * Validates and measures the separately budgeted Full Preset UMD artifacts.
 *
 * @module
 */

import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptsRoot, '..');
const budgetPath = path.join(repositoryRoot, 'config', 'bundle', 'full-umd-budget.json');
const artifactDefinitions = Object.freeze([
    Object.freeze({
        id: 'development',
        file: 'dist/umd/image-editor.full.umd.js',
        maximumGzipBytes: 174_080,
    }),
    Object.freeze({
        id: 'minified',
        file: 'dist/umd/image-editor.full.umd.min.js',
        maximumGzipBytes: 110_592,
    }),
]);
const requiredFeatureSources = Object.freeze([
    '/foundations/overlay/',
    '/foundations/annotation/',
    '/plugins/transform/',
    '/plugins/history/',
    '/plugins/mask/',
    '/plugins/filters/',
    '/plugins/crop/',
    '/plugins/mosaic/',
    '/plugins/annotation-text/',
    '/plugins/annotation-shape/',
    '/plugins/annotation-draw/',
    '/plugins/overlay-state/',
    '/plugins/dom-controls/',
    '/presets/full/',
]);

function sha256(value) {
    return createHash('sha256').update(value).digest('hex');
}

function normalizedSources(map) {
    return map.sources.map((source) => source.replaceAll('\\', '/'));
}

function categorizeSource(source) {
    if (source.includes('/plugin-kernel/')) return 'pluginKernel';
    if (source.includes('/sdk/')) return 'sdk';
    if (source.includes('/foundations/') || source.includes('/plugins/')) {
        return 'officialFeatures';
    }
    if (source.includes('/presets/')) return 'presetComposition';
    if (/\/(?:core|core-runtime|fabric|image|mask|utils)\//u.test(source)) {
        return 'coreFramework';
    }
    return 'unknown';
}

async function measureArtifact(definition) {
    const absolutePath = path.join(repositoryRoot, definition.file);
    const value = await readFile(absolutePath);
    const map = JSON.parse(await readFile(`${absolutePath}.map`, 'utf8'));
    const sources = normalizedSources(map);
    const attribution = {
        pluginKernel: 0,
        sdk: 0,
        coreFramework: 0,
        officialFeatures: 0,
        presetComposition: 0,
        unknown: 0,
    };
    for (const source of sources) attribution[categorizeSource(source)] += 1;
    return Object.freeze({
        id: definition.id,
        file: definition.file,
        rawBytes: value.byteLength,
        gzipBytes: gzipSync(value, { level: 9 }).byteLength,
        brotliBytes: brotliCompressSync(value, {
            params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
        }).byteLength,
        sha256: sha256(value),
        sourceModules: sources.length,
        attribution: Object.freeze(attribution),
        sources: Object.freeze(sources),
        map,
    });
}

function publicMeasurement(measurement, definition) {
    return Object.freeze({
        file: measurement.file,
        rawBytes: measurement.rawBytes,
        gzipBytes: measurement.gzipBytes,
        brotliBytes: measurement.brotliBytes,
        sha256: measurement.sha256,
        maximumGzipBytes: definition.maximumGzipBytes,
        sourceModules: measurement.sourceModules,
        attribution: measurement.attribution,
    });
}

async function validate(measurements, budget) {
    const failures = [];
    const packageJson = JSON.parse(
        await readFile(path.join(repositoryRoot, 'package.json'), 'utf8'),
    );
    if (packageJson.unpkg !== './dist/umd/image-editor.full.umd.min.js') {
        failures.push('unpkg must select the minified Full Preset UMD.');
    }
    if (packageJson.jsdelivr !== './dist/umd/image-editor.full.umd.min.js') {
        failures.push('jsdelivr must select the minified Full Preset UMD.');
    }

    const development = measurements[0];
    const namespaceOccurrences = development
        ? ((await readFile(path.join(repositoryRoot, development.file), 'utf8')).match(
              /ImageEditorFull/gu,
          )?.length ?? 0)
        : 0;
    if (namespaceOccurrences === 0) failures.push('Full UMD global name is unavailable.');

    for (const [index, measurement] of measurements.entries()) {
        const definition = artifactDefinitions[index];
        const expected = budget.artifacts?.[definition.id];
        if (!expected) {
            failures.push(`Budget is missing the ${definition.id} artifact.`);
            continue;
        }
        for (const field of [
            'file',
            'rawBytes',
            'gzipBytes',
            'brotliBytes',
            'sha256',
            'sourceModules',
        ]) {
            if (measurement[field] !== expected[field]) {
                failures.push(
                    `${definition.id} ${field} changed: expected ${expected[field]}, received ${measurement[field]}.`,
                );
            }
        }
        if (measurement.gzipBytes > definition.maximumGzipBytes) {
            failures.push(
                `${definition.id} gzip size ${measurement.gzipBytes} exceeds ${definition.maximumGzipBytes}.`,
            );
        }
        if (measurement.map.file !== path.basename(definition.file)) {
            failures.push(`${definition.id} source map points to an unexpected artifact.`);
        }
        if (measurement.attribution.unknown !== 0) {
            failures.push(`${definition.id} has unclassified source modules.`);
        }
        if (measurement.sources.some((source) => source.includes('node_modules/fabric'))) {
            failures.push(`${definition.id} bundles Fabric.`);
        }
        if (
            measurement.sources.some(
                (source) => source.includes('/testing/') || source.includes('/migrate-v2/'),
            )
        ) {
            failures.push(`${definition.id} reaches testing or migration implementation code.`);
        }
        for (const requiredSource of requiredFeatureSources) {
            if (!measurement.sources.some((source) => source.includes(requiredSource))) {
                failures.push(`${definition.id} is missing ${requiredSource}.`);
            }
        }
    }

    const umdFiles = (await readdir(path.join(repositoryRoot, 'dist', 'umd'))).sort();
    const allowedUmdFiles = [
        'image-editor.full.umd.js',
        'image-editor.full.umd.js.map',
        'image-editor.full.umd.min.js',
        'image-editor.full.umd.min.js.map',
    ];
    if (JSON.stringify(umdFiles) !== JSON.stringify(allowedUmdFiles)) {
        failures.push('UMD output must contain only the approved Full-level artifacts.');
    }
    return failures;
}

const mode = process.argv[2] ?? '--check';
if (!['--check', '--generate'].includes(mode) || process.argv.length > 3) {
    throw new Error('Use --check or --generate.');
}

const measurements = await Promise.all(artifactDefinitions.map(measureArtifact));
const generatedBudget = Object.freeze({
    schemaVersion: 1,
    globalName: 'ImageEditorFull',
    policy: Object.freeze({
        separateFromPlatformAnchor: true,
        fabricBundledModules: 0,
        testingModules: 0,
        migrationModules: 0,
        perPluginUmdArtifacts: 0,
    }),
    artifacts: Object.freeze(
        Object.fromEntries(
            measurements.map((measurement, index) => [
                measurement.id,
                publicMeasurement(measurement, artifactDefinitions[index]),
            ]),
        ),
    ),
});

if (mode === '--generate') {
    await writeFile(budgetPath, `${JSON.stringify(generatedBudget, null, 4)}\n`, 'utf8');
}
const budget =
    mode === '--generate' ? generatedBudget : JSON.parse(await readFile(budgetPath, 'utf8'));
const failures = await validate(measurements, budget);
for (const measurement of measurements) {
    console.log(
        `${measurement.id}: ${measurement.rawBytes} raw, ${measurement.gzipBytes} gzip, ${measurement.sourceModules} modules`,
    );
}
if (failures.length > 0) {
    for (const failure of failures) console.error(`- ${failure}`);
    process.exitCode = 1;
} else {
    console.log('Full Preset UMD policy: PASS');
}
