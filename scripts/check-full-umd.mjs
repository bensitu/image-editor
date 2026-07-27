/**
 * Validates the Full Preset UMD artifact boundary and compressed-size ceiling.
 *
 * @module
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

import {
    ALL_APPROVED_UMD_ARTIFACTS,
    FULL_UMD_ARTIFACTS,
    MODULAR_UMD_ARTIFACTS,
} from '../config/bundle/modular-umd.mjs';
import { collectRelativeFiles } from './package-content-policy.mjs';

const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptsRoot, '..');
const budgetPath = path.join(repositoryRoot, 'config', 'bundle', 'full-umd-budget.json');
const artifactDefinitions = Object.freeze(
    FULL_UMD_ARTIFACTS.filter((file) => file.endsWith('.js')).map((file) =>
        Object.freeze({ file, minified: file.endsWith('.min.js') }),
    ),
);
const coreArtifactDefinitions = Object.freeze(
    MODULAR_UMD_ARTIFACTS.filter((file) => file.endsWith('.js')).map((file) =>
        Object.freeze({ file, minified: file.endsWith('.min.js') }),
    ),
);
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

async function inspectCoreArtifact(definition) {
    const absolutePath = path.join(repositoryRoot, definition.file);
    const [value, sourceMapText] = await Promise.all([
        readFile(absolutePath),
        readFile(`${absolutePath}.map`, 'utf8'),
    ]);
    const sourceMap = JSON.parse(sourceMapText);
    const sources = sourceMap.sources.map((source) => source.replaceAll('\\', '/'));
    const forbiddenSources = [
        '/foundations/',
        '/plugins/',
        '/presets/',
        '/testing/',
        '/migrate-v2/',
        'node_modules/fabric',
    ];
    assertCondition(
        sourceMap.file === path.basename(definition.file),
        `${definition.file} source map points to an unexpected artifact.`,
    );
    for (const forbiddenSource of forbiddenSources) {
        assertCondition(
            !sources.some((source) => source.includes(forbiddenSource)),
            `${definition.file} unexpectedly includes ${forbiddenSource}.`,
        );
    }
    for (const requiredSource of ['/core-runtime/', '/plugin-kernel/', '/sdk/']) {
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

const [budget, packageJson, artifacts, coreArtifacts] = await Promise.all([
    JSON.parse(await readFile(budgetPath, 'utf8')),
    JSON.parse(await readFile(path.join(repositoryRoot, 'package.json'), 'utf8')),
    Promise.all(artifactDefinitions.map(inspectArtifact)),
    Promise.all(coreArtifactDefinitions.map(inspectCoreArtifact)),
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

const fullArtifactNames = FULL_UMD_ARTIFACTS.map((file) => path.basename(file)).sort();
assertCondition(
    JSON.stringify(fullArtifactNames) === JSON.stringify([...budget.approvedArtifacts].sort()),
    'Full UMD budget artifact list does not match the registry.',
);
const umdFiles = await collectRelativeFiles(
    path.join(repositoryRoot, 'dist', 'umd'),
    repositoryRoot,
);
assertCondition(
    JSON.stringify(umdFiles) === JSON.stringify([...ALL_APPROVED_UMD_ARTIFACTS].sort()),
    'UMD output must contain only approved UMD artifacts.',
);
const minified = artifacts.find((artifact) => artifact.minified);
assertCondition(
    minified.gzipBytes <= budget.maximumMinifiedGzipBytes,
    `Minified Full UMD gzip size ${minified.gzipBytes} exceeds ${budget.maximumMinifiedGzipBytes}.`,
);

for (const artifact of artifacts) {
    console.log(`${artifact.file}: ${artifact.gzipBytes} gzip bytes`);
}
for (const artifact of coreArtifacts) {
    console.log(`${artifact.file}: ${artifact.gzipBytes} gzip bytes`);
}
console.log('Full and Core UMD policy passed.');
