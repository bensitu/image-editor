/**
 * Builds packed consumer fixtures for the public package and an external Plugin.
 *
 * @module
 */

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptsDirectory, '..');
const fixtureRoot = path.join(repositoryRoot, 'tests', 'package', 'external-plugin');
const evidencePath = path.join(
    repositoryRoot,
    'docs',
    'refactor',
    'stage-2',
    'evidence',
    'package-isolation.generated.json',
);
const requiredEntries = [
    '.',
    './core',
    './sdk',
    './testing',
    './plugins/transform',
    './plugins/history',
    './plugins/overlay',
    './plugins/annotation',
    './plugins/annotation-text',
    './plugins/annotation-shape',
    './plugins/annotation-draw',
    './plugins/mask',
    './plugins/filters',
    './plugins/crop',
    './plugins/mosaic',
    './plugins/overlay-state',
    './plugins/dom-controls',
    './presets/minimal',
    './presets/redaction',
    './presets/annotation',
    './presets/full',
    './migrate-v2',
];
const forbiddenImportPattern = /(?:core-runtime|plugin-kernel|\/internal(?:\/|['"]))/u;

function assertCondition(condition, message) {
    if (!condition) throw new Error(message);
}

async function run(command, args, cwd) {
    return execFileAsync(command, args, {
        cwd,
        encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024,
        windowsHide: true,
    });
}

async function pack(directory, destination) {
    const npmCliPath = process.env.npm_execpath;
    if (!npmCliPath) throw new Error('npm_execpath is unavailable; run through an npm script.');
    const { stdout } = await run(
        process.execPath,
        [npmCliPath, 'pack', '--json', '--pack-destination', destination],
        directory,
    );
    const result = JSON.parse(stdout)[0];
    assertCondition(
        result && typeof result.filename === 'string',
        'npm pack returned no artifact.',
    );
    return Object.freeze({ ...result, path: path.join(destination, result.filename) });
}

async function extract(tarball, destination) {
    await mkdir(destination, { recursive: true });
    await run('tar', ['-xf', tarball, '-C', destination], repositoryRoot);
    return path.join(destination, 'package');
}

async function sha256(filePath) {
    return createHash('sha256')
        .update(await readFile(filePath))
        .digest('hex');
}

async function collectFiles(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) files.push(...(await collectFiles(entryPath)));
        else if (entry.isFile()) files.push(entryPath);
    }
    return files.sort();
}

async function collectPackageInstances(nodeModulesRoot, packageName) {
    const manifests = (await collectFiles(nodeModulesRoot)).filter(
        (filePath) => path.basename(filePath) === 'package.json',
    );
    const instances = [];
    for (const manifestPath of manifests) {
        let manifest;
        try {
            manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
        } catch {
            continue;
        }
        if (manifest.name === packageName) {
            instances.push(
                path.relative(nodeModulesRoot, path.dirname(manifestPath)).replaceAll('\\', '/'),
            );
        }
    }
    return instances.sort();
}

function assertPeerPolicy(manifest) {
    assertCondition(
        manifest.peerDependencies?.['@bensitu/image-editor'] === '^3.0.0-0',
        'External Plugin must declare the Image Editor package as a compatible peer.',
    );
    assertCondition(
        manifest.peerDependencies?.fabric === '>=7.4.0 <8',
        'External Plugin must declare Fabric as a compatible peer.',
    );
    for (const name of ['@bensitu/image-editor', 'fabric']) {
        assertCondition(
            !Object.prototype.hasOwnProperty.call(manifest.dependencies ?? {}, name),
            `External Plugin must not declare ${name} as a runtime dependency.`,
        );
        assertCondition(
            !(manifest.bundledDependencies ?? manifest.bundleDependencies ?? []).includes(name),
            `External Plugin must not bundle ${name}.`,
        );
    }
}

const esmConsumer = `
import assert from 'node:assert/strict';
import { ImageEditorCore as RootCore } from '@bensitu/image-editor';
import { ImageEditorCore } from '@bensitu/image-editor/core';
import { definePlugin } from '@bensitu/image-editor/sdk';
import { createPluginTestHost } from '@bensitu/image-editor/testing';
import { historyPlugin } from '@bensitu/image-editor/plugins/history';
import { filtersPlugin } from '@bensitu/image-editor/plugins/filters';
import { cropPlugin } from '@bensitu/image-editor/plugins/crop';
import { maskPlugin } from '@bensitu/image-editor/plugins/mask';
import { mosaicPlugin } from '@bensitu/image-editor/plugins/mosaic';
import { overlayFoundationPlugin } from '@bensitu/image-editor/plugins/overlay';
import { annotationFoundationPlugin } from '@bensitu/image-editor/plugins/annotation';
import { textAnnotationPlugin } from '@bensitu/image-editor/plugins/annotation-text';
import { shapeAnnotationPlugin } from '@bensitu/image-editor/plugins/annotation-shape';
import { drawAnnotationPlugin } from '@bensitu/image-editor/plugins/annotation-draw';
import { transformPlugin } from '@bensitu/image-editor/plugins/transform';
import { overlayStatePlugin } from '@bensitu/image-editor/plugins/overlay-state';
import { domControlsPlugin } from '@bensitu/image-editor/plugins/dom-controls';
import { createMinimalPreset } from '@bensitu/image-editor/presets/minimal';
import { createRedactionPreset } from '@bensitu/image-editor/presets/redaction';
import { createAnnotationPreset } from '@bensitu/image-editor/presets/annotation';
import { createFullPreset } from '@bensitu/image-editor/presets/full';
import { detectSnapshotVersion, loadV2Snapshot, migrateV2Snapshot, v2SnapshotMigration } from '@bensitu/image-editor/migrate-v2';
import { publicPlugin } from '@image-editor-fixtures/public-plugin';
assert.equal(RootCore, ImageEditorCore);
for (const value of [definePlugin, createPluginTestHost, historyPlugin, filtersPlugin, cropPlugin, maskPlugin, mosaicPlugin, overlayFoundationPlugin, annotationFoundationPlugin, textAnnotationPlugin, shapeAnnotationPlugin, drawAnnotationPlugin, transformPlugin, overlayStatePlugin, domControlsPlugin, createMinimalPreset, createRedactionPreset, createAnnotationPreset, createFullPreset, detectSnapshotVersion, loadV2Snapshot, migrateV2Snapshot, v2SnapshotMigration, publicPlugin]) {
    assert.equal(typeof value, 'function');
}
assert.match(import.meta.resolve('fabric'), /node_modules[\\\\/]fabric[\\\\/]/u);
`;

const cjsConsumer = `
'use strict';
const assert = require('node:assert/strict');
const { ImageEditorCore: RootCore } = require('@bensitu/image-editor');
const { ImageEditorCore } = require('@bensitu/image-editor/core');
const { definePlugin } = require('@bensitu/image-editor/sdk');
const { createPluginTestHost } = require('@bensitu/image-editor/testing');
const { historyPlugin } = require('@bensitu/image-editor/plugins/history');
const { filtersPlugin } = require('@bensitu/image-editor/plugins/filters');
const { cropPlugin } = require('@bensitu/image-editor/plugins/crop');
const { maskPlugin } = require('@bensitu/image-editor/plugins/mask');
const { mosaicPlugin } = require('@bensitu/image-editor/plugins/mosaic');
const { overlayFoundationPlugin } = require('@bensitu/image-editor/plugins/overlay');
const { annotationFoundationPlugin } = require('@bensitu/image-editor/plugins/annotation');
const { textAnnotationPlugin } = require('@bensitu/image-editor/plugins/annotation-text');
const { shapeAnnotationPlugin } = require('@bensitu/image-editor/plugins/annotation-shape');
const { drawAnnotationPlugin } = require('@bensitu/image-editor/plugins/annotation-draw');
const { transformPlugin } = require('@bensitu/image-editor/plugins/transform');
const { overlayStatePlugin } = require('@bensitu/image-editor/plugins/overlay-state');
const { domControlsPlugin } = require('@bensitu/image-editor/plugins/dom-controls');
const { createMinimalPreset } = require('@bensitu/image-editor/presets/minimal');
const { createRedactionPreset } = require('@bensitu/image-editor/presets/redaction');
const { createAnnotationPreset } = require('@bensitu/image-editor/presets/annotation');
const { createFullPreset } = require('@bensitu/image-editor/presets/full');
const { detectSnapshotVersion, loadV2Snapshot, migrateV2Snapshot, v2SnapshotMigration } = require('@bensitu/image-editor/migrate-v2');
const { publicPlugin } = require('@image-editor-fixtures/public-plugin');
assert.equal(RootCore, ImageEditorCore);
for (const value of [definePlugin, createPluginTestHost, historyPlugin, filtersPlugin, cropPlugin, maskPlugin, mosaicPlugin, overlayFoundationPlugin, annotationFoundationPlugin, textAnnotationPlugin, shapeAnnotationPlugin, drawAnnotationPlugin, transformPlugin, overlayStatePlugin, domControlsPlugin, createMinimalPreset, createRedactionPreset, createAnnotationPreset, createFullPreset, detectSnapshotVersion, loadV2Snapshot, migrateV2Snapshot, v2SnapshotMigration, publicPlugin]) {
    assert.equal(typeof value, 'function');
}
assert.match(require.resolve('fabric'), /node_modules[\\\\/]fabric[\\\\/]/u);
`;

const esmTypeConsumer = `
import { ImageEditorCore } from '@bensitu/image-editor/core';
import { definePluginRef, type CoreStatusPort } from '@bensitu/image-editor/sdk';
import type { PluginConformanceReport } from '@bensitu/image-editor/testing';
import type { HistoryPort } from '@bensitu/image-editor/plugins/history';
import type { FiltersPluginApi } from '@bensitu/image-editor/plugins/filters';
import type { CropPluginApi, CropRect } from '@bensitu/image-editor/plugins/crop';
import type { MaskPluginApi } from '@bensitu/image-editor/plugins/mask';
import type { MosaicImagePoint, MosaicPluginApi } from '@bensitu/image-editor/plugins/mosaic';
import type { OverlayFoundationApi } from '@bensitu/image-editor/plugins/overlay';
import type { AnnotationPluginApi } from '@bensitu/image-editor/plugins/annotation';
import type { TextAnnotationPluginApi } from '@bensitu/image-editor/plugins/annotation-text';
import type { ShapeAnnotationPluginApi } from '@bensitu/image-editor/plugins/annotation-shape';
import type { DrawAnnotationPluginApi } from '@bensitu/image-editor/plugins/annotation-draw';
import type { TransformPluginApi } from '@bensitu/image-editor/plugins/transform';
import type { OverlayStatePluginApi } from '@bensitu/image-editor/plugins/overlay-state';
import type { DomControlsPluginApi } from '@bensitu/image-editor/plugins/dom-controls';
import type { MinimalPresetResult } from '@bensitu/image-editor/presets/minimal';
import type { RedactionPresetResult } from '@bensitu/image-editor/presets/redaction';
import type { AnnotationPresetResult } from '@bensitu/image-editor/presets/annotation';
import type { FullPresetResult } from '@bensitu/image-editor/presets/full';
import { detectSnapshotVersion, type SnapshotMigrationWarning } from '@bensitu/image-editor/migrate-v2';
import { publicPlugin, type PublicPluginApi } from '@image-editor-fixtures/public-plugin';
const ref = definePluginRef<PublicPluginApi>('fixture:type-consumer', '1.0.0');
const plugin = publicPlugin();
declare const values: [ImageEditorCore, CoreStatusPort, PluginConformanceReport, HistoryPort, FiltersPluginApi, CropPluginApi, CropRect, MaskPluginApi, MosaicPluginApi, MosaicImagePoint, OverlayFoundationApi, AnnotationPluginApi, TextAnnotationPluginApi, ShapeAnnotationPluginApi, DrawAnnotationPluginApi, TransformPluginApi, OverlayStatePluginApi, DomControlsPluginApi, MinimalPresetResult, RedactionPresetResult, AnnotationPresetResult, FullPresetResult, SnapshotMigrationWarning];
const detection = detectSnapshotVersion({});
void ref;
void plugin;
void values;
void detection;
`;

const cjsTypeConsumer = `
import core = require('@bensitu/image-editor/core');
import sdk = require('@bensitu/image-editor/sdk');
import testing = require('@bensitu/image-editor/testing');
import history = require('@bensitu/image-editor/plugins/history');
import filters = require('@bensitu/image-editor/plugins/filters');
import crop = require('@bensitu/image-editor/plugins/crop');
import mask = require('@bensitu/image-editor/plugins/mask');
import mosaic = require('@bensitu/image-editor/plugins/mosaic');
import overlay = require('@bensitu/image-editor/plugins/overlay');
import annotation = require('@bensitu/image-editor/plugins/annotation');
import annotationText = require('@bensitu/image-editor/plugins/annotation-text');
import annotationShape = require('@bensitu/image-editor/plugins/annotation-shape');
import annotationDraw = require('@bensitu/image-editor/plugins/annotation-draw');
import transform = require('@bensitu/image-editor/plugins/transform');
import overlayState = require('@bensitu/image-editor/plugins/overlay-state');
import domControls = require('@bensitu/image-editor/plugins/dom-controls');
import minimalPreset = require('@bensitu/image-editor/presets/minimal');
import redactionPreset = require('@bensitu/image-editor/presets/redaction');
import annotationPreset = require('@bensitu/image-editor/presets/annotation');
import fullPreset = require('@bensitu/image-editor/presets/full');
import migration = require('@bensitu/image-editor/migrate-v2');
import fixture = require('@image-editor-fixtures/public-plugin');
const ref = sdk.definePluginRef<fixture.PublicPluginApi>('fixture:type-consumer-cjs', '1.0.0');
const plugin = fixture.publicPlugin();
declare const values: [core.ImageEditorCore, sdk.CoreStatusPort, testing.PluginConformanceReport, history.HistoryPort, filters.FiltersPluginApi, crop.CropPluginApi, crop.CropRect, mask.MaskPluginApi, mosaic.MosaicPluginApi, mosaic.MosaicImagePoint, overlay.OverlayFoundationApi, annotation.AnnotationPluginApi, annotationText.TextAnnotationPluginApi, annotationShape.ShapeAnnotationPluginApi, annotationDraw.DrawAnnotationPluginApi, transform.TransformPluginApi, overlayState.OverlayStatePluginApi, domControls.DomControlsPluginApi, minimalPreset.MinimalPresetResult, redactionPreset.RedactionPresetResult, annotationPreset.AnnotationPresetResult, fullPreset.FullPresetResult, migration.SnapshotMigrationWarning];
const detection = migration.detectSnapshotVersion({});
void ref;
void plugin;
void values;
void detection;
`;

async function execute() {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'image-editor-isolation-'));
    const resolvedTemporaryRoot = path.resolve(temporaryRoot);
    const resolvedSystemTemp = path.resolve(tmpdir());
    assertCondition(
        resolvedTemporaryRoot.startsWith(`${resolvedSystemTemp}${path.sep}`),
        'Refusing to use a consumer path outside the system temporary directory.',
    );

    try {
        const artifactsRoot = path.join(temporaryRoot, 'artifacts');
        const consumerRoot = path.join(temporaryRoot, 'consumer');
        const nodeModulesRoot = path.join(consumerRoot, 'node_modules');
        await mkdir(artifactsRoot, { recursive: true });
        await mkdir(nodeModulesRoot, { recursive: true });

        const mainPack = await pack(repositoryRoot, artifactsRoot);
        const mainExtract = await extract(mainPack.path, path.join(temporaryRoot, 'main-extract'));
        const mainInstall = path.join(nodeModulesRoot, '@bensitu', 'image-editor');
        await mkdir(path.dirname(mainInstall), { recursive: true });
        await rename(mainExtract, mainInstall);
        for (const dependency of [
            '@types/jsdom',
            '@types/node',
            '@types/tough-cookie',
            'entities',
            'fabric',
            'parse5',
            'undici-types',
        ]) {
            await mkdir(path.dirname(path.join(nodeModulesRoot, dependency)), { recursive: true });
            await cp(
                path.join(repositoryRoot, 'node_modules', dependency),
                path.join(nodeModulesRoot, dependency),
                { recursive: true },
            );
        }

        const fixtureBuildRoot = path.join(consumerRoot, 'external-plugin');
        await cp(fixtureRoot, fixtureBuildRoot, { recursive: true });
        const typescriptCli = path.join(repositoryRoot, 'node_modules', 'typescript', 'bin', 'tsc');
        await run(process.execPath, [typescriptCli, '-p', 'tsconfig.json'], fixtureBuildRoot);
        const externalPack = await pack(fixtureBuildRoot, artifactsRoot);
        const externalExtract = await extract(
            externalPack.path,
            path.join(temporaryRoot, 'external-extract'),
        );
        const externalInstall = path.join(
            nodeModulesRoot,
            '@image-editor-fixtures',
            'public-plugin',
        );
        await mkdir(path.dirname(externalInstall), { recursive: true });
        await rename(externalExtract, externalInstall);

        const mainManifest = JSON.parse(
            await readFile(path.join(mainInstall, 'package.json'), 'utf8'),
        );
        const externalManifest = JSON.parse(
            await readFile(path.join(externalInstall, 'package.json'), 'utf8'),
        );
        assertPeerPolicy(externalManifest);
        assertCondition(
            mainManifest.peerDependencies?.fabric === '>=7.4.0 <8',
            'Main package Fabric peer range changed unexpectedly.',
        );
        for (const entry of requiredEntries) {
            assertCondition(
                mainManifest.exports?.[entry],
                `Packed package is missing export "${entry}".`,
            );
        }

        const externalFiles = await collectFiles(externalInstall);
        for (const filePath of externalFiles) {
            const relative = path.relative(externalInstall, filePath).replaceAll('\\', '/');
            assertCondition(
                !relative.startsWith('node_modules/'),
                'External tarball contains dependencies.',
            );
            if (/\.(?:[cm]?[jt]s|json)$/u.test(relative)) {
                const content = await readFile(filePath, 'utf8');
                assertCondition(
                    !forbiddenImportPattern.test(content),
                    `External tarball contains a private import in ${relative}.`,
                );
            }
        }

        await writeFile(path.join(consumerRoot, 'package.json'), '{"type":"module"}\n', 'utf8');
        await writeFile(path.join(consumerRoot, 'consumer.mjs'), esmConsumer, 'utf8');
        await writeFile(path.join(consumerRoot, 'consumer.cjs'), cjsConsumer, 'utf8');
        await writeFile(path.join(consumerRoot, 'consumer.mts'), esmTypeConsumer, 'utf8');
        await writeFile(path.join(consumerRoot, 'consumer.cts'), cjsTypeConsumer, 'utf8');
        await writeFile(
            path.join(consumerRoot, 'tsconfig.json'),
            `${JSON.stringify(
                {
                    compilerOptions: {
                        target: 'ES2022',
                        module: 'NodeNext',
                        moduleResolution: 'NodeNext',
                        strict: true,
                        noEmit: true,
                        skipLibCheck: false,
                    },
                    include: ['consumer.mts', 'consumer.cts'],
                },
                null,
                2,
            )}\n`,
            'utf8',
        );
        await run(process.execPath, ['consumer.mjs'], consumerRoot);
        await run(process.execPath, ['consumer.cjs'], consumerRoot);
        await run(process.execPath, [typescriptCli, '-p', 'tsconfig.json'], consumerRoot);

        const coreInstances = await collectPackageInstances(
            nodeModulesRoot,
            '@bensitu/image-editor',
        );
        const fabricInstances = await collectPackageInstances(nodeModulesRoot, 'fabric');
        assertCondition(
            coreInstances.length === 1,
            'Packed consumer must contain one Core package.',
        );
        assertCondition(
            fabricInstances.length === 1,
            'Packed consumer must contain one Fabric package.',
        );

        return Object.freeze({
            schemaVersion: 1,
            result: 'PASS',
            package: Object.freeze({
                name: mainPack.name,
                version: mainPack.version,
                files: mainPack.files.length,
                bytes: mainPack.size,
                sha256: await sha256(mainPack.path),
                entries: Object.freeze(requiredEntries),
            }),
            externalPlugin: Object.freeze({
                name: externalPack.name,
                version: externalPack.version,
                files: externalPack.files.length,
                bytes: externalPack.size,
                sha256: await sha256(externalPack.path),
                peerDependencies: externalManifest.peerDependencies,
                privateImports: 0,
                bundledDependencies: 0,
            }),
            consumer: Object.freeze({
                esm: 'PASS',
                cjs: 'PASS',
                nodeNextTypes: 'PASS',
                coreInstances: coreInstances.length,
                fabricInstances: fabricInstances.length,
                duplicateCoreCopies: 0,
                duplicateFabricCopies: 0,
            }),
        });
    } finally {
        await rm(resolvedTemporaryRoot, { recursive: true, force: true });
    }
}

const mode = process.argv[2] ?? '--check';
if (!['--check', '--generate'].includes(mode) || process.argv.length > 3) {
    throw new Error('Use --check or --generate.');
}
const result = await execute();
if (mode === '--generate') {
    await mkdir(path.dirname(evidencePath), { recursive: true });
    await writeFile(evidencePath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
}
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
