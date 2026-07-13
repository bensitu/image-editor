/**
 * Builds consumer-style fixtures and checks deterministic bundle budgets.
 *
 * The package root can point at an isolated Git worktree so release and
 * current baselines use the same bundler and dependency policy.
 *
 * @module
 */

import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import { brotliCompressSync, constants as zlibConstants, gzipSync } from 'node:zlib';
import { execFile } from 'node:child_process';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { rollup, VERSION as rollupVersion } from 'rollup';

import {
    BUNDLE_MEASUREMENT_CONFIG,
    BUNDLE_MEASUREMENT_CONFIG_HASH,
    fingerprintMeasurementInputs,
    hashFile,
    latestMeasurementInputMtime,
} from './bundle-measurement-config.mjs';
import {
    compareMeasurements,
    createExpectedProvenance,
    validateBundleProvenance,
} from './check-bundle-provenance.mjs';

const execFileAsync = promisify(execFile);
const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, '..');
const fixturesRoot = path.join(repoRoot, 'tests', 'bundle', 'fixtures');
const baselinesRoot = path.join(repoRoot, 'tests', 'bundle', 'baselines');
const budgetsPath = path.join(repoRoot, 'tests', 'bundle', 'budgets.json');
const immutableBaselinePath = path.join(baselinesRoot, 'v2.9.0.json');
const packageName = '@bensitu/image-editor';
const kernelTestSpecifier = '@bensitu/image-editor/plugin-kernel-internal';
const packageSubpathEntries = Object.freeze({
    [`${packageName}/core`]: ['core', 'index.js'],
    [`${packageName}/plugins/overlay`]: ['foundations', 'overlay', 'index.js'],
    [`${packageName}/plugins/transform`]: ['plugins', 'transform', 'index.js'],
    [`${packageName}/plugins/mask`]: ['plugins', 'mask', 'index.js'],
    [`${packageName}/plugins/history`]: ['plugins', 'history', 'index.js'],
});
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
    'overlay-state',
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
        'overlay-state',
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
});
const measuredFields = ['rawBytes', 'minifiedBytes', 'gzipBytes', 'brotliBytes', 'moduleCount'];

function parseArguments(argv) {
    const options = {
        packageRoot: repoRoot,
        fixtureNames: null,
        updateName: null,
        archiveStaleCurrent: false,
        verifyCurrentHead: false,
    };

    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        if (argument === '--package-root') {
            options.packageRoot = path.resolve(argv[index + 1] ?? '');
            index += 1;
        } else if (argument === '--fixtures') {
            options.fixtureNames = (argv[index + 1] ?? '')
                .split(',')
                .map((value) => value.trim())
                .filter(Boolean);
            index += 1;
        } else if (argument === '--update') {
            options.updateName = argv[index + 1] ?? '';
            index += 1;
        } else if (argument === '--archive-stale-current') {
            options.archiveStaleCurrent = true;
        } else if (argument === '--verify-current-head') {
            options.verifyCurrentHead = true;
        } else {
            throw new Error(`Unknown argument: ${argument}`);
        }
    }

    if (options.updateName && !/^[a-z0-9][a-z0-9.-]*$/i.test(options.updateName)) {
        throw new Error(`Invalid baseline name: ${options.updateName}`);
    }
    if (options.updateName && options.verifyCurrentHead) {
        throw new Error('--update and --verify-current-head cannot be combined.');
    }
    if (options.archiveStaleCurrent && options.updateName !== 'current') {
        throw new Error('--archive-stale-current requires --update current.');
    }
    return options;
}

async function pathIsFile(filePath) {
    try {
        return (await stat(filePath)).isFile();
    } catch {
        return false;
    }
}

async function discoverFixtures(requestedNames, packageRoot) {
    const names =
        requestedNames ??
        (await readdir(fixturesRoot, { withFileTypes: true }))
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name)
            .sort();
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

function getChunk(output) {
    const chunks = output.output.filter((item) => item.type === 'chunk');
    if (chunks.length !== 1) {
        throw new Error(`Expected one inline fixture chunk, received ${chunks.length}.`);
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
        plugins: [
            packageAlias(packageRoot),
            nodeResolve({ browser: true, preferBuiltins: true }),
            commonjs(),
        ],
        treeshake: {
            ...BUNDLE_MEASUREMENT_CONFIG.rollup.treeshake,
        },
        onwarn(warning, warn) {
            if (warning.code === 'CIRCULAR_DEPENDENCY') return;
            warn(warning);
        },
    };
    const outputOptions = {
        format: 'es',
        exports: 'named',
        inlineDynamicImports: true,
        sourcemap: BUNDLE_MEASUREMENT_CONFIG.rollup.sourcemap,
    };
    const bundle = await rollup(inputOptions);

    try {
        const rawChunk = getChunk(await bundle.generate(outputOptions));
        const minifiedChunk = getChunk(
            await bundle.generate({
                ...outputOptions,
                plugins: [
                    terser({
                        compress: {
                            passes: BUNDLE_MEASUREMENT_CONFIG.terser.compressPasses,
                        },
                        format: { comments: BUNDLE_MEASUREMENT_CONFIG.terser.comments },
                        mangle: BUNDLE_MEASUREMENT_CONFIG.terser.mangle,
                    }),
                ],
            }),
        );
        const rawBuffer = Buffer.from(rawChunk.code, 'utf8');
        const minifiedBuffer = Buffer.from(minifiedChunk.code, 'utf8');
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
            gzipBytes: gzipSync(minifiedBuffer, {
                level: BUNDLE_MEASUREMENT_CONFIG.gzip.level,
            }).byteLength,
            brotliBytes: brotliCompressSync(minifiedBuffer, {
                params: {
                    [zlibConstants.BROTLI_PARAM_QUALITY]: BUNDLE_MEASUREMENT_CONFIG.brotli.quality,
                    [zlibConstants.BROTLI_PARAM_MODE]: zlibConstants.BROTLI_MODE_TEXT,
                },
            }).byteLength,
            moduleCount: modules.length,
            modules,
            externalDependencies: [...externalDependencies].sort(),
        };
    } finally {
        await bundle.close();
    }
}

async function readJson(filePath) {
    return JSON.parse(await readFile(filePath, 'utf8'));
}

async function getGitCommit(packageRoot) {
    try {
        const { stdout } = await execFileAsync('git', ['-C', packageRoot, 'rev-parse', 'HEAD']);
        return stdout.trim();
    } catch {
        return 'unknown';
    }
}

async function createMeasurement(packageRoot, fixtures) {
    const packageJson = await readJson(path.join(packageRoot, 'package.json'));
    const fixtureEntries = await Promise.all(
        fixtures.map(async (fixture) => [fixture.name, await measureFixture(fixture, packageRoot)]),
    );

    return {
        schemaVersion: 1,
        metadata: {
            packageVersion: packageJson.version,
            gitCommit: await getGitCommit(packageRoot),
            nodeVersion: process.version,
            measuredAt: new Date().toISOString(),
            measurementConfigVersion: BUNDLE_MEASUREMENT_CONFIG.schemaVersion,
            measurementConfigHash: BUNDLE_MEASUREMENT_CONFIG_HASH,
            artifactFingerprint: await fingerprintMeasurementInputs(packageRoot, fixturesRoot),
            artifactLatestMtimeMs: await latestMeasurementInputMtime(packageRoot, fixturesRoot),
            lockedBudgetsSha256: await hashFile(budgetsPath),
            immutableBaselineSha256: await hashFile(immutableBaselinePath),
            bundler: {
                name: 'rollup',
                version: rollupVersion,
            },
        },
        fixtures: Object.fromEntries(fixtureEntries),
    };
}

function formatBytes(value) {
    return `${value.toLocaleString('en-US')} B`;
}

function printMeasurement(measurement, baselines = new Map()) {
    const rows = Object.entries(measurement.fixtures).map(([name, fixture]) => {
        const baseline = baselines.get(name);
        const delta = baseline ? fixture.gzipBytes - baseline.gzipBytes : null;
        return {
            fixture: name,
            raw: formatBytes(fixture.rawBytes),
            minified: formatBytes(fixture.minifiedBytes),
            gzip: formatBytes(fixture.gzipBytes),
            brotli: formatBytes(fixture.brotliBytes),
            modules: fixture.moduleCount,
            gzipDelta: delta === null ? 'n/a' : `${delta >= 0 ? '+' : ''}${delta} B`,
        };
    });
    console.table(rows);
}

async function loadBudgetBaselines(budgets) {
    const cache = new Map();
    const byFixture = new Map();

    for (const [fixtureName, budget] of Object.entries(budgets.fixtures)) {
        if (budget.status !== 'active') continue;
        const baselineName = budget.baseline;
        if (!cache.has(baselineName)) {
            cache.set(
                baselineName,
                await readJson(path.join(baselinesRoot, `${baselineName}.json`)),
            );
        }
        const baseline = cache.get(baselineName).fixtures[fixtureName];
        if (!baseline) {
            throw new Error(`Baseline ${baselineName}.json has no ${fixtureName} fixture.`);
        }
        byFixture.set(fixtureName, baseline);
    }
    return byFixture;
}

async function checkBudgets(measurement) {
    const budgets = await readJson(budgetsPath);
    const baselines = await loadBudgetBaselines(budgets);
    const failures = [];

    for (const [fixtureName, budget] of Object.entries(budgets.fixtures)) {
        if (budget.status !== 'active') continue;
        const actual = measurement.fixtures[fixtureName];
        if (!actual) {
            failures.push(`${fixtureName}: active budget has no measured fixture.`);
            continue;
        }
        for (const field of measuredFields) {
            const maximum = budget.maximum[field];
            if (actual[field] > maximum) {
                failures.push(
                    `${fixtureName} ${field}: current=${actual[field]}, maximum=${maximum}, delta=+${actual[field] - maximum}.`,
                );
            }
        }
    }

    printMeasurement(measurement, baselines);
    if (failures.length > 0) {
        console.error('Bundle budget check failed:');
        for (const failure of failures) console.error(`- ${failure}`);
        process.exitCode = 1;
        return;
    }
    console.log('Bundle budget check passed.');
}

async function updateBaseline(name, measurement) {
    const outputPath = path.join(baselinesRoot, `${name}.json`);
    await mkdir(baselinesRoot, { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(measurement, null, 4)}\n`, 'utf8');
    console.warn(`Updated bundle baseline: ${toRepoPath(outputPath, repoRoot)}`);
    printMeasurement(measurement);
}

async function archiveStaleCurrent(measurement) {
    const currentPath = path.join(baselinesRoot, 'current.json');
    let current;
    try {
        current = await readJson(currentPath);
    } catch (error) {
        if (error?.code === 'ENOENT') return;
        throw error;
    }
    const currentCommit = current.metadata?.gitCommit ?? 'unknown';
    const currentFingerprint = current.metadata?.artifactFingerprint ?? 'missing';
    if (
        currentCommit === measurement.metadata.gitCommit &&
        currentFingerprint === measurement.metadata.artifactFingerprint
    ) {
        return;
    }
    const suffix = /^[0-9a-f]{7,40}$/i.test(currentCommit) ? currentCommit.slice(0, 7) : 'unknown';
    const archivePath = path.join(baselinesRoot, `pre-phase-5a-r-stale-${suffix}.json`);
    try {
        await stat(archivePath);
    } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
        await writeFile(archivePath, `${JSON.stringify(current, null, 4)}\n`, 'utf8');
        console.warn(`Archived stale current baseline: ${toRepoPath(archivePath, repoRoot)}`);
    }
}

async function verifyCurrentHead(measurement) {
    const baseline = await readJson(path.join(baselinesRoot, 'current.json'));
    const errors = [
        ...validateBundleProvenance(baseline, await createExpectedProvenance()),
        ...compareMeasurements(baseline, measurement),
    ];
    if (errors.length > 0) {
        console.error('Current-head bundle verification failed:');
        for (const error of errors) console.error(`- ${error}`);
        process.exitCode = 1;
        return false;
    }
    console.log('Current-head bundle provenance and live measurement match.');
    return true;
}

const options = parseArguments(process.argv.slice(2));
const fixtures = await discoverFixtures(options.fixtureNames, options.packageRoot);
const measurement = await createMeasurement(options.packageRoot, fixtures);

if (options.updateName) {
    if (options.archiveStaleCurrent) await archiveStaleCurrent(measurement);
    await updateBaseline(options.updateName, measurement);
} else {
    const verified = options.verifyCurrentHead ? await verifyCurrentHead(measurement) : true;
    if (verified) await checkBudgets(measurement);
}
