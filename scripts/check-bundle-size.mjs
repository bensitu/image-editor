/**
 * Builds consumer-style fixtures and validates live bundle isolation policies.
 *
 * @module
 */

import { brotliCompressSync, constants as zlibConstants, gzipSync } from 'node:zlib';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rolldown } from 'rolldown';

import {
    BUNDLE_MEASUREMENT_CONFIG,
    normalizeBundleMeasurementText,
} from './bundle-measurement-config.mjs';
import { validatePlatformBudget } from './check-platform-budget.mjs';
import { inspectPublicBundleIsolation } from './check-public-bundle-isolation.mjs';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, '..');
const fixturesRoot = path.join(repoRoot, 'tests', 'bundle', 'fixtures');
const packageName = '@bensitu/image-editor';
const kernelTestSpecifier = '@bensitu/image-editor/plugin-kernel-internal';
const packageSubpathEntries = Object.freeze({
    [`${packageName}/core`]: ['core', 'index.js'],
    [`${packageName}/sdk`]: ['sdk', 'index.js'],
    [`${packageName}/testing`]: ['testing', 'index.js'],
    [`${packageName}/migrate-v2`]: ['migrate-v2', 'index.js'],
    [`${packageName}/plugins/overlay`]: ['foundations', 'overlay', 'index.js'],
    [`${packageName}/plugins/annotation`]: ['foundations', 'annotation', 'index.js'],
    [`${packageName}/plugins/transform`]: ['plugins', 'transform', 'index.js'],
    [`${packageName}/plugins/mask`]: ['plugins', 'mask', 'index.js'],
    [`${packageName}/plugins/history`]: ['plugins', 'history', 'index.js'],
    [`${packageName}/plugins/filters`]: ['plugins', 'filters', 'index.js'],
    [`${packageName}/plugins/crop`]: ['plugins', 'crop', 'index.js'],
    [`${packageName}/plugins/mosaic`]: ['plugins', 'mosaic', 'index.js'],
    [`${packageName}/plugins/annotation-text`]: ['plugins', 'annotation-text', 'index.js'],
    [`${packageName}/plugins/annotation-shape`]: ['plugins', 'annotation-shape', 'index.js'],
    [`${packageName}/plugins/annotation-draw`]: ['plugins', 'annotation-draw', 'index.js'],
    [`${packageName}/plugins/overlay-state`]: ['plugins', 'overlay-state', 'index.js'],
    [`${packageName}/plugins/dom-controls`]: ['plugins', 'dom-controls', 'index.js'],
    [`${packageName}/plugins/canvas-interactions`]: ['plugins', 'canvas-interactions', 'index.js'],
    [`${packageName}/presets/minimal`]: ['presets', 'minimal', 'index.js'],
    [`${packageName}/presets/redaction`]: ['presets', 'redaction', 'index.js'],
    [`${packageName}/presets/annotation`]: ['presets', 'annotation', 'index.js'],
    [`${packageName}/presets/full`]: ['presets', 'full', 'index.js'],
});
// Official dependency diagnostics may contain Plugin IDs, so isolation checks target
// Overlay State implementation symbols instead of its package-entry text.
const overlayStateImplementationSymbols = [
    'OverlayStateController',
    'OVERLAY_STATE_SCHEMA',
    'overlayStatePlugin',
];
const forbiddenKernelSymbols = [
    'createMask',
    'MaskObject',
    'enterCropMode',
    'CropSession',
    'mosaicPreview',
    'annotationType',
    'createTextAnnotation',
    'Brightness',
    'Contrast',
    'HistoryManager',
    ...overlayStateImplementationSymbols,
    'TransformController',
];
const fixtureForbiddenSymbols = Object.freeze({
    'core-only': forbiddenKernelSymbols,
    'core-transform': [
        'createMask',
        'MaskObject',
        'enterCropMode',
        'CropSession',
        'mosaicPreview',
        'annotationType',
        'createTextAnnotation',
        'Brightness',
        'Contrast',
        'HistoryManager',
        ...overlayStateImplementationSymbols,
    ],
    'core-mask': [
        'TransformPluginController',
        'HistoryManager',
        'annotationType',
        'createTextAnnotation',
        'enterCropMode',
        'CropSession',
        'mosaicPreview',
        'Brightness',
        'Contrast',
    ],
    'core-transform-mask': [
        'HistoryManager',
        'annotationType',
        'createTextAnnotation',
        'enterCropMode',
        'CropSession',
        'mosaicPreview',
        'Brightness',
        'Contrast',
    ],
    'core-history': [
        'TransformPluginController',
        'createMask',
        'MaskObject',
        'annotationType',
        'enterCropMode',
        'mosaicPreview',
        'Brightness',
    ],
    'sdk/core-crop': [
        'Brightness',
        'Contrast',
        'Saturation',
        'Grayscale',
        'Sepia',
        'Vintage',
        'Convolute',
    ],
    'sdk/core-mosaic': [
        'Brightness',
        'Contrast',
        'Saturation',
        'Grayscale',
        'Sepia',
        'Vintage',
        'Convolute',
    ],
    'sdk/core-annotation': [
        'TextAnnotationController',
        'ShapeAnnotationController',
        'DrawAnnotationController',
        'MaskObject',
    ],
    'sdk/core-annotation-text': [
        'ShapeAnnotationController',
        'DrawAnnotationController',
        'resolveEraserConfiguration',
        'MaskObject',
    ],
    'sdk/core-annotation-shape': [
        'TextAnnotationController',
        'DrawAnnotationController',
        'resolveEraserConfiguration',
        'MaskObject',
    ],
    'sdk/core-annotation-draw': [
        'TextAnnotationController',
        'ShapeAnnotationController',
        'MaskObject',
    ],
    'sdk/overlay-state-only': [
        'MaskPluginController',
        'FiltersPluginController',
        'CropController',
        'MosaicPluginController',
        'AnnotationController',
        'TextAnnotationController',
        'ShapeAnnotationController',
        'DrawAnnotationController',
        'DOMControls',
    ],
    'sdk/dom-controls-only': [
        'MaskPluginController',
        'FiltersPluginController',
        'CropController',
        'MosaicPluginController',
        'AnnotationController',
        'TextAnnotationController',
        'ShapeAnnotationController',
        'DrawAnnotationController',
        'OverlayStateController',
    ],
});
function parseArguments(argv) {
    if (argv.length > 0) throw new Error('The live bundle check does not accept arguments.');
    return Object.freeze({ packageRoot: repoRoot, fixtureNames: null });
}

async function pathIsFile(filePath) {
    try {
        return (await stat(filePath)).isFile();
    } catch {
        return false;
    }
}

async function discoverFixtures(requestedNames, packageRoot) {
    async function discover(directory, prefix = '') {
        const entries = await readdir(directory, { withFileTypes: true });
        const names = [];
        if (await pathIsFile(path.join(directory, 'index.mjs'))) names.push(prefix);
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const childPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
            names.push(...(await discover(path.join(directory, entry.name), childPrefix)));
        }
        return names;
    }

    const names = requestedNames ?? (await discover(fixturesRoot)).filter(Boolean).sort();
    const fixtures = [];

    for (const name of names) {
        const entryPath = path.join(fixturesRoot, name, 'index.mjs');
        if (!(await pathIsFile(entryPath))) {
            throw new Error(`Bundle fixture entry is missing: ${toRepoPath(entryPath, repoRoot)}`);
        }
        if (
            name === 'plugin-kernel' &&
            !(await pathIsFile(path.join(packageRoot, 'dist', 'esm', 'plugin-kernel', 'index.js')))
        ) {
            throw new Error('The plugin-kernel fixture requires dist/esm/plugin-kernel/index.js.');
        }
        fixtures.push({ name, entryPath });
    }
    return fixtures;
}

function toPosix(value) {
    return value.split(path.sep).join('/');
}

function toRepoPath(filePath, root) {
    return toPosix(path.relative(root, filePath));
}

function normalizeModuleId(moduleId, packageRoot) {
    let normalized = moduleId.replace(/^\0+/, '').split('?')[0];
    if (!path.isAbsolute(normalized)) return normalized;

    const nodeModulesMarker = `${path.sep}node_modules${path.sep}`;
    const nodeModulesIndex = normalized.lastIndexOf(nodeModulesMarker);
    if (nodeModulesIndex >= 0) {
        return `node_modules/${toPosix(normalized.slice(nodeModulesIndex + nodeModulesMarker.length))}`;
    }

    const packageRelative = path.relative(packageRoot, normalized);
    if (!packageRelative.startsWith('..') && !path.isAbsolute(packageRelative)) {
        return toPosix(packageRelative);
    }

    const fixtureRelative = path.relative(repoRoot, normalized);
    if (!fixtureRelative.startsWith('..') && !path.isAbsolute(fixtureRelative)) {
        return toPosix(fixtureRelative);
    }
    return path.basename(normalized);
}

function packageAlias(packageRoot) {
    const rootEntry = path.join(packageRoot, 'dist', 'esm', 'index.js');
    const kernelEntry = path.join(packageRoot, 'dist', 'esm', 'plugin-kernel', 'index.js');

    return {
        name: 'local-package-fixture-alias',
        resolveId(source) {
            if (source === packageName) return rootEntry;
            if (source === kernelTestSpecifier) return kernelEntry;
            const subpath = packageSubpathEntries[source];
            if (subpath) return path.join(packageRoot, 'dist', 'esm', ...subpath);
            return null;
        },
    };
}

function validateGeneratedOutput(output) {
    if (!output || !Array.isArray(output.output)) {
        throw new Error(
            'Rolldown output metadata is incompatible: expected an object with an output array.',
        );
    }
    for (const item of output.output) {
        if (item?.type === 'chunk') {
            if (
                typeof item.code !== 'string' ||
                !item.modules ||
                typeof item.modules !== 'object' ||
                Array.isArray(item.modules) ||
                !Array.isArray(item.moduleIds)
            ) {
                throw new Error(
                    'Rolldown chunk metadata is incompatible: expected code, modules, and moduleIds.',
                );
            }
        } else if (item?.type !== 'asset') {
            throw new Error(
                `Rolldown output metadata is incompatible: unexpected item type "${String(item?.type)}".`,
            );
        }
    }
    return output;
}

function getChunk(generatedOutput) {
    const output = validateGeneratedOutput(generatedOutput);
    const chunks = output.output.filter((item) => item.type === 'chunk');
    if (chunks.length !== 1) {
        throw new Error(`Expected one fixture chunk, received ${chunks.length}.`);
    }
    return chunks[0];
}

async function measureFixture(fixture, packageRoot) {
    const externalDependencies = new Set();
    const inputOptions = {
        input: fixture.entryPath,
        external(source) {
            const isExternal = source === 'fabric' || source.startsWith('fabric/');
            if (isExternal) externalDependencies.add('fabric');
            return isExternal;
        },
        platform: BUNDLE_MEASUREMENT_CONFIG.bundler.platform,
        plugins: [packageAlias(packageRoot)],
        treeshake: {
            ...BUNDLE_MEASUREMENT_CONFIG.bundler.treeshake,
        },
        onLog(level, log, defaultHandler) {
            if (log.code === 'CIRCULAR_DEPENDENCY') return;
            defaultHandler(level, log);
        },
    };
    const outputOptions = {
        format: BUNDLE_MEASUREMENT_CONFIG.bundler.format,
        exports: BUNDLE_MEASUREMENT_CONFIG.bundler.exports,
        codeSplitting: BUNDLE_MEASUREMENT_CONFIG.bundler.codeSplitting,
        sourcemap: BUNDLE_MEASUREMENT_CONFIG.bundler.sourcemap,
        minify: BUNDLE_MEASUREMENT_CONFIG.bundler.minify,
    };
    const bundle = await rolldown(inputOptions);

    try {
        const rawChunk = getChunk(await bundle.generate(outputOptions));
        const minifiedChunk = getChunk(
            await bundle.generate({
                ...outputOptions,
                minify: BUNDLE_MEASUREMENT_CONFIG.minifier.minify,
            }),
        );
        const rawBuffer = Buffer.from(normalizeBundleMeasurementText(rawChunk.code), 'utf8');
        const minifiedBuffer = Buffer.from(
            normalizeBundleMeasurementText(minifiedChunk.code),
            'utf8',
        );
        const gzipBuffer = gzipSync(minifiedBuffer, {
            level: BUNDLE_MEASUREMENT_CONFIG.gzip.level,
        });
        const brotliBuffer = brotliCompressSync(minifiedBuffer, {
            params: {
                [zlibConstants.BROTLI_PARAM_QUALITY]: BUNDLE_MEASUREMENT_CONFIG.brotli.quality,
                [zlibConstants.BROTLI_PARAM_MODE]: zlibConstants.BROTLI_MODE_TEXT,
            },
        });
        const modules = Object.keys(rawChunk.modules)
            .map((moduleId) => normalizeModuleId(moduleId, packageRoot))
            .sort();

        const forbiddenSymbols =
            fixture.name === 'plugin-kernel'
                ? forbiddenKernelSymbols
                : fixtureForbiddenSymbols[fixture.name];
        if (forbiddenSymbols) {
            const foundSymbols = forbiddenSymbols.filter((symbol) =>
                rawChunk.code.includes(symbol),
            );
            if (foundSymbols.length > 0) {
                throw new Error(
                    `${fixture.name} contains forbidden business symbols: ${foundSymbols.join(', ')}`,
                );
            }
        }

        return {
            entryPath: toRepoPath(fixture.entryPath, repoRoot),
            rawBytes: rawBuffer.byteLength,
            minifiedBytes: minifiedBuffer.byteLength,
            gzipBytes: gzipBuffer.byteLength,
            brotliBytes: brotliBuffer.byteLength,
            moduleCount: modules.length,
            modules,
            externalDependencies: [...externalDependencies].sort(),
        };
    } finally {
        await bundle.close();
    }
}

async function createMeasurement(packageRoot, fixtures) {
    const fixtureEntries = await Promise.all(
        fixtures.map(async (fixture) => [fixture.name, await measureFixture(fixture, packageRoot)]),
    );

    return {
        schemaVersion: 1,
        fixtures: Object.fromEntries(fixtureEntries),
    };
}

function formatBytes(value) {
    return `${value.toLocaleString('en-US')} B`;
}

function printMeasurement(measurement) {
    const rows = Object.entries(measurement.fixtures).map(([name, fixture]) => ({
        fixture: name,
        raw: formatBytes(fixture.rawBytes),
        minified: formatBytes(fixture.minifiedBytes),
        gzip: formatBytes(fixture.gzipBytes),
        brotli: formatBytes(fixture.brotliBytes),
        modules: fixture.moduleCount,
    }));
    console.table(rows);
}

const options = parseArguments(process.argv.slice(2));
const fixtures = await discoverFixtures(options.fixtureNames, options.packageRoot);
const measurement = await createMeasurement(options.packageRoot, fixtures);
printMeasurement(measurement);
const [platformResult, isolationResult] = await Promise.all([
    validatePlatformBudget(measurement),
    inspectPublicBundleIsolation(measurement),
]);
console.log(`Platform bundle policy passed (${formatBytes(platformResult.gzipBytes)} gzip).`);
console.log(
    `Public bundle isolation passed (${isolationResult.summary.fixturesMeasured} fixtures).`,
);
