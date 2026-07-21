/**
 * Validates the Full Preset UMD artifact boundary and compressed-size ceiling.
 *
 * @module
 */

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptsRoot, '..');
const budgetPath = path.join(repositoryRoot, 'config', 'bundle', 'full-umd-budget.json');
const artifactDefinitions = Object.freeze([
    Object.freeze({ file: 'dist/umd/image-editor.full.umd.js', minified: false }),
    Object.freeze({ file: 'dist/umd/image-editor.full.umd.min.js', minified: true }),
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

function assertCondition(condition, message) {
    if (!condition) throw new Error(message);
}

async function inspectArtifact(definition) {
    const absolutePath = path.join(repositoryRoot, definition.file);
    const [value, sourceMapText] = await Promise.all([
        readFile(absolutePath),
        readFile(`${absolutePath}.map`, 'utf8'),
    ]);
    const sourceMap = JSON.parse(sourceMapText);
    const sources = sourceMap.sources.map((source) => source.replaceAll('\\', '/'));
    assertCondition(
        sourceMap.file === path.basename(definition.file),
        `${definition.file} source map points to an unexpected artifact.`,
    );
    assertCondition(
        !sources.some((source) => source.includes('node_modules/fabric')),
        `${definition.file} bundles Fabric.`,
    );
    assertCondition(
        !sources.some((source) => source.includes('/testing/') || source.includes('/migrate-v2/')),
        `${definition.file} reaches testing or migration implementation code.`,
    );
    for (const requiredSource of requiredFeatureSources) {
        assertCondition(
            sources.some((source) => source.includes(requiredSource)),
            `${definition.file} is missing ${requiredSource}.`,
        );
    }
    return Object.freeze({
        file: definition.file,
        gzipBytes: gzipSync(value, { level: 9 }).byteLength,
        minified: definition.minified,
    });
}

const argument = process.argv[2] ?? '--check';
assertCondition(argument === '--check' && process.argv.length <= 3, 'Use --check.');

const [budget, packageJson, artifacts] = await Promise.all([
    JSON.parse(await readFile(budgetPath, 'utf8')),
    JSON.parse(await readFile(path.join(repositoryRoot, 'package.json'), 'utf8')),
    Promise.all(artifactDefinitions.map(inspectArtifact)),
]);
assertCondition(budget.schemaVersion === 1, 'Full UMD budget schema is invalid.');
assertCondition(
    packageJson.unpkg === './dist/umd/image-editor.full.umd.min.js',
    'unpkg must select the minified Full Preset UMD.',
);
assertCondition(
    packageJson.jsdelivr === './dist/umd/image-editor.full.umd.min.js',
    'jsdelivr must select the minified Full Preset UMD.',
);

const developmentSource = await readFile(
    path.join(repositoryRoot, artifactDefinitions[0].file),
    'utf8',
);
assertCondition(
    developmentSource.includes(budget.globalName),
    `Full UMD global ${String(budget.globalName)} is unavailable.`,
);

const umdFiles = (await readdir(path.join(repositoryRoot, 'dist', 'umd'))).sort();
assertCondition(
    JSON.stringify(umdFiles) === JSON.stringify([...budget.approvedArtifacts].sort()),
    'UMD output must contain only the approved Full-level artifacts.',
);
const minified = artifacts.find((artifact) => artifact.minified);
assertCondition(
    minified.gzipBytes <= budget.maximumMinifiedGzipBytes,
    `Minified Full UMD gzip size ${minified.gzipBytes} exceeds ${budget.maximumMinifiedGzipBytes}.`,
);

for (const artifact of artifacts) {
    console.log(`${artifact.file}: ${artifact.gzipBytes} gzip bytes`);
}
console.log('Full Preset UMD policy passed.');
