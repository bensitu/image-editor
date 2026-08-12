/**
 * Validates Full and modular UMD artifacts, boundaries, and compressed-size budgets.
 *
 * @module
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

import {
    ALL_APPROVED_UMD_ARTIFACTS,
    FULL_UMD,
    FULL_UMD_ARTIFACTS,
    MODULAR_UMD_CORE,
    MODULAR_UMD_MODULES,
    MODULAR_UMD_PLUGINS,
} from '../config/bundle/modular-umd.mjs';
import { collectRelativeFiles } from './package-content-policy.mjs';

const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptsRoot, '..');
const fullBudgetPath = path.join(repositoryRoot, 'config', 'bundle', 'full-umd-budget.json');
const modularBudgetPath = path.join(repositoryRoot, 'config', 'bundle', 'modular-umd-budget.json');
const requiredFullSources = Object.freeze([
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
    '/plugins/canvas-interactions/',
    '/presets/full/',
]);
const forbiddenCoreSources = Object.freeze([
    '/foundations/',
    '/plugins/',
    '/presets/',
    '/testing/',
    '/migrate-v2/',
    'node_modules/fabric',
]);
const forbiddenPluginSources = Object.freeze([
    '/core-runtime/',
    '/plugin-kernel/',
    '/sdk/',
    '/presets/',
    '/testing/',
    '/migrate-v2/',
    'node_modules/fabric',
]);
const externalDependencyKinds = new Map([
    ['@bensitu/image-editor/core', 'core'],
    ['@bensitu/image-editor/sdk', 'core'],
    ['@bensitu/image-editor/plugins/overlay', 'overlay'],
    ['@bensitu/image-editor/plugins/annotation', 'annotation'],
]);

function assertCondition(condition, message) {
    if (!condition) throw new Error(message);
}

function normalizedSourcePath(value) {
    return value.replaceAll('\\', '/');
}

function sortedJson(values) {
    return JSON.stringify([...values].sort());
}

function artifactPath(definition, minified) {
    return `${definition.fileBase}.umd${minified ? '.min' : ''}.js`;
}

function hasAbsoluteLocalPath(value) {
    return (
        path.posix.isAbsolute(value) ||
        path.win32.isAbsolute(value) ||
        value.startsWith('file:') ||
        /(?:^|[\\/])Users[\\/]|(?:^|\/)home\//u.test(value)
    );
}

function inspectSourceMapPaths(sourceMap, file) {
    assertCondition(Array.isArray(sourceMap.sources), `${file} source map has no sources array.`);
    const paths = [
        ...sourceMap.sources,
        ...(typeof sourceMap.sourceRoot === 'string' && sourceMap.sourceRoot.length > 0
            ? [sourceMap.sourceRoot]
            : []),
    ];
    for (const source of paths) {
        assertCondition(
            typeof source === 'string' && !hasAbsoluteLocalPath(source),
            `${file} source map contains an absolute local path.`,
        );
    }
    return sourceMap.sources.map(normalizedSourcePath);
}

async function inspectArtifact(definition, minified) {
    const file = artifactPath(definition, minified);
    const absolutePath = path.join(repositoryRoot, ...file.split('/'));
    const [value, source, sourceMapText] = await Promise.all([
        readFile(absolutePath),
        readFile(absolutePath, 'utf8'),
        readFile(`${absolutePath}.map`, 'utf8'),
    ]);
    let sourceMap;
    try {
        sourceMap = JSON.parse(sourceMapText);
    } catch {
        throw new Error(`${file}.map is not valid JSON.`);
    }
    assertCondition(
        sourceMap.file === path.basename(file),
        `${file} source map points to ${String(sourceMap.file)}.`,
    );
    return Object.freeze({
        file,
        gzipBytes: gzipSync(value, { level: 9 }).byteLength,
        minified,
        rawBytes: value.byteLength,
        source,
        sources: Object.freeze(inspectSourceMapPaths(sourceMap, `${file}.map`)),
    });
}

function assertSourcesExclude(artifact, patterns) {
    for (const pattern of patterns) {
        assertCondition(
            !artifact.sources.some((source) => source.includes(pattern)),
            `${artifact.file} unexpectedly includes ${pattern}.`,
        );
    }
}

function actualExternalDependencies(source) {
    const externalIds = new Set();
    for (const match of source.matchAll(/\brequire\((['"])([^'"]+)\1\)/gu)) {
        externalIds.add(match[2]);
    }
    return externalIds;
}

function validateModularBudget(modularBudget) {
    assertCondition(modularBudget.schemaVersion === 1, 'Modular UMD budget schema is invalid.');
    assertCondition(modularBudget.gzipLevel === 9, 'Modular UMD budget must use gzip level 9.');
    assertCondition(
        modularBudget.headroomRatio === 1.15,
        'Modular UMD budget must retain the approved 15% headroom.',
    );
    assertCondition(
        modularBudget.roundingBytes === 1024,
        'Modular UMD budget must round to 1 KiB.',
    );
    const moduleIds = MODULAR_UMD_MODULES.map(({ id }) => id);
    assertCondition(
        sortedJson(Object.keys(modularBudget.modules ?? {})) === sortedJson(moduleIds),
        'Modular UMD budget entries do not match the module registry.',
    );
    for (const id of moduleIds) {
        const budget = modularBudget.modules[id];
        assertCondition(
            Number.isSafeInteger(budget.baselineMinifiedBytes) && budget.baselineMinifiedBytes > 0,
            `${id} has an invalid minified-byte baseline.`,
        );
        assertCondition(
            Number.isSafeInteger(budget.baselineMinifiedGzipBytes) &&
                budget.baselineMinifiedGzipBytes > 0,
            `${id} has an invalid gzip baseline.`,
        );
        const expectedMaximum =
            Math.ceil(
                (budget.baselineMinifiedGzipBytes * modularBudget.headroomRatio) /
                    modularBudget.roundingBytes,
            ) * modularBudget.roundingBytes;
        assertCondition(
            budget.maximumMinifiedGzipBytes === expectedMaximum,
            `${id} budget must be its baseline plus 15%, rounded to 1 KiB.`,
        );
    }
}

async function inspectFull(fullBudget) {
    assertCondition(fullBudget.schemaVersion === 1, 'Full UMD budget schema is invalid.');
    assertCondition(
        sortedJson(FULL_UMD_ARTIFACTS.map((file) => path.basename(file))) ===
            sortedJson(fullBudget.approvedArtifacts),
        'Full UMD budget artifact list does not match the registry.',
    );
    const [development, minified] = await Promise.all([
        inspectArtifact(FULL_UMD, false),
        inspectArtifact(FULL_UMD, true),
    ]);
    for (const artifact of [development, minified]) {
        assertSourcesExclude(artifact, ['node_modules/fabric', '/testing/', '/migrate-v2/']);
        for (const requiredSource of requiredFullSources) {
            assertCondition(
                artifact.sources.some((source) => source.includes(requiredSource)),
                `${artifact.file} is missing ${requiredSource}.`,
            );
        }
    }
    assertCondition(
        development.source.includes(`global.${fullBudget.globalName}`),
        `Full UMD global ${String(fullBudget.globalName)} is unavailable.`,
    );
    assertCondition(
        minified.gzipBytes <= fullBudget.maximumMinifiedGzipBytes,
        `Minified Full UMD gzip size ${minified.gzipBytes} exceeds ` +
            `${fullBudget.maximumMinifiedGzipBytes}.`,
    );
    return Object.freeze({ development, minified });
}

async function inspectCore(modularBudget) {
    const [development, minified] = await Promise.all([
        inspectArtifact(MODULAR_UMD_CORE, false),
        inspectArtifact(MODULAR_UMD_CORE, true),
    ]);
    for (const artifact of [development, minified]) {
        assertSourcesExclude(artifact, forbiddenCoreSources);
        for (const requiredSource of ['/core-runtime/', '/plugin-kernel/', '/sdk/']) {
            assertCondition(
                artifact.sources.some((source) => source.includes(requiredSource)),
                `${artifact.file} is missing ${requiredSource}.`,
            );
        }
    }
    assertCondition(
        development.source.includes('global.ImageEditor'),
        'Core UMD global ImageEditor is unavailable.',
    );
    for (const exportName of ['ImageEditorCore', 'definePlugin', 'composePlugins']) {
        assertCondition(
            development.source.includes(`exports.${exportName} =`),
            `Core UMD does not expose ${exportName}.`,
        );
    }
    const budget = modularBudget.modules.core;
    assertCondition(
        minified.gzipBytes <= budget.maximumMinifiedGzipBytes,
        `Minified Core UMD gzip size ${minified.gzipBytes} exceeds ` +
            `${budget.maximumMinifiedGzipBytes}.`,
    );
    return Object.freeze({ definition: MODULAR_UMD_CORE, development, minified, budget });
}

async function inspectPlugin(definition, modularBudget) {
    const [development, minified] = await Promise.all([
        inspectArtifact(definition, false),
        inspectArtifact(definition, true),
    ]);
    const ownSourceRoot =
        definition.sourceKind === 'foundation'
            ? `/foundations/${definition.id}/`
            : `/plugins/${definition.id}/`;
    for (const artifact of [development, minified]) {
        assertCondition(
            artifact.sources.some((source) => source.includes(ownSourceRoot)),
            `${artifact.file} does not include its own implementation.`,
        );
        assertSourcesExclude(artifact, forbiddenPluginSources);
        for (const source of artifact.sources) {
            if (source.includes('/plugins/')) {
                assertCondition(
                    source.includes(ownSourceRoot),
                    `${artifact.file} includes sibling Plugin source ${source}.`,
                );
            }
            if (source.includes('/foundations/')) {
                assertCondition(
                    source.includes(ownSourceRoot),
                    `${artifact.file} includes Foundation source ${source}.`,
                );
            }
        }
    }
    assertCondition(
        development.source.includes(`global.${definition.globalName}`),
        `${definition.id} UMD global ${definition.globalName} is unavailable.`,
    );
    assertCondition(
        development.source.includes(
            `Object.prototype.hasOwnProperty.call(exports, ${JSON.stringify(
                definition.guardExport,
            )})`,
        ),
        `${definition.id} UMD does not preserve an existing namespace export.`,
    );
    assertCondition(
        development.source.includes(`exports.${definition.guardExport} =`),
        `${definition.id} UMD does not expose ${definition.guardExport}.`,
    );

    const externalIds = actualExternalDependencies(development.source);
    const dependencyKinds = new Set();
    for (const externalId of externalIds) {
        if (externalId === 'fabric') continue;
        assertCondition(
            externalDependencyKinds.has(externalId),
            `${definition.id} UMD uses unsupported external ${externalId}.`,
        );
        dependencyKinds.add(externalDependencyKinds.get(externalId));
    }
    assertCondition(
        sortedJson(dependencyKinds) === sortedJson(definition.dependencies),
        `${definition.id} UMD external dependencies do not match its registry descriptor.`,
    );

    const budget = modularBudget.modules[definition.id];
    assertCondition(
        minified.gzipBytes <= budget.maximumMinifiedGzipBytes,
        `Minified ${definition.id} UMD gzip size ${minified.gzipBytes} exceeds ` +
            `${budget.maximumMinifiedGzipBytes}.`,
    );
    return Object.freeze({ definition, development, minified, budget });
}

async function inspectArtifactSet() {
    const files = await collectRelativeFiles(
        path.join(repositoryRoot, 'dist', 'umd'),
        repositoryRoot,
    );
    assertCondition(
        sortedJson(files) === sortedJson(ALL_APPROVED_UMD_ARTIFACTS),
        'UMD output must contain exactly the approved UMD artifact allowlist.',
    );
    const fileSet = new Set(files);
    for (const file of files) {
        assertCondition(
            !file.includes('/chunks/'),
            `UMD output contains an unexpected shared chunk: ${file}.`,
        );
        if (file.endsWith('.map')) {
            assertCondition(
                fileSet.has(file.slice(0, -'.map'.length)),
                `UMD source map has no parent JavaScript file: ${file}.`,
            );
        } else if (file.endsWith('.js')) {
            assertCondition(fileSet.has(`${file}.map`), `UMD JavaScript has no map: ${file}.`);
        }
    }
}

const argument = process.argv[2] ?? '--check';
assertCondition(argument === '--check' && process.argv.length <= 3, 'Use --check.');

const [fullBudget, modularBudget, packageJson] = await Promise.all([
    JSON.parse(await readFile(fullBudgetPath, 'utf8')),
    JSON.parse(await readFile(modularBudgetPath, 'utf8')),
    JSON.parse(await readFile(path.join(repositoryRoot, 'package.json'), 'utf8')),
]);
validateModularBudget(modularBudget);
assertCondition(
    packageJson.unpkg === './dist/umd/image-editor.full.umd.min.js',
    'unpkg must select the minified Full Preset UMD.',
);
assertCondition(
    packageJson.jsdelivr === './dist/umd/image-editor.full.umd.min.js',
    'jsdelivr must select the minified Full Preset UMD.',
);

const [full, core, plugins] = await Promise.all([
    inspectFull(fullBudget),
    inspectCore(modularBudget),
    Promise.all(MODULAR_UMD_PLUGINS.map((definition) => inspectPlugin(definition, modularBudget))),
    inspectArtifactSet(),
]);

console.log(
    `full: ${full.minified.rawBytes} minified bytes; ${full.minified.gzipBytes} gzip-9 bytes / ` +
        `${fullBudget.maximumMinifiedGzipBytes}`,
);
for (const result of [core, ...plugins]) {
    console.log(
        `${result.definition.id}: ${result.minified.rawBytes} minified bytes; ` +
            `${result.minified.gzipBytes} gzip-9 bytes / ` +
            `${result.budget.maximumMinifiedGzipBytes}`,
    );
}
console.log(`Full and modular UMD policy passed (${ALL_APPROVED_UMD_ARTIFACTS.length} artifacts).`);
