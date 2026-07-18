/** Verifies PoC package subpaths from the exact tarball produced by npm pack. */

import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, '..');
const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'image-editor-pack-'));
const resolvedTemporaryRoot = path.resolve(temporaryRoot);
const resolvedSystemTemp = path.resolve(tmpdir());
if (!resolvedTemporaryRoot.startsWith(`${resolvedSystemTemp}${path.sep}`)) {
    throw new Error('Refusing to use a packed-entry path outside the system temp directory.');
}
const npmCliPath = process.env.npm_execpath;

const esmSource = `
import assert from 'node:assert/strict';
import { ImageEditorCore } from '@bensitu/image-editor/core';
import { definePlugin, definePluginRef } from '@bensitu/image-editor/sdk';
import { createPluginTestHost, runPluginConformance } from '@bensitu/image-editor/testing';
import { overlayFoundationPlugin } from '@bensitu/image-editor/plugins/overlay';
import { annotationFoundationPlugin } from '@bensitu/image-editor/plugins/annotation';
import { textAnnotationPlugin } from '@bensitu/image-editor/plugins/annotation-text';
import { shapeAnnotationPlugin } from '@bensitu/image-editor/plugins/annotation-shape';
import { drawAnnotationPlugin } from '@bensitu/image-editor/plugins/annotation-draw';
import { transformPlugin } from '@bensitu/image-editor/plugins/transform';
import { maskPlugin } from '@bensitu/image-editor/plugins/mask';
import { historyPlugin } from '@bensitu/image-editor/plugins/history';
import { filtersPlugin } from '@bensitu/image-editor/plugins/filters';
import { cropPlugin } from '@bensitu/image-editor/plugins/crop';
import { mosaicPlugin } from '@bensitu/image-editor/plugins/mosaic';
import { overlayStatePlugin } from '@bensitu/image-editor/plugins/overlay-state';
import { domControlsPlugin } from '@bensitu/image-editor/plugins/dom-controls';
import { createMinimalPreset } from '@bensitu/image-editor/presets/minimal';
import { createRedactionPreset } from '@bensitu/image-editor/presets/redaction';
import { createAnnotationPreset } from '@bensitu/image-editor/presets/annotation';
import { createFullPreset } from '@bensitu/image-editor/presets/full';
import { detectSnapshotVersion, loadV2Snapshot, migrateV2Snapshot, v2SnapshotMigration } from '@bensitu/image-editor/migrate-v2';
for (const value of [ImageEditorCore, definePlugin, definePluginRef, createPluginTestHost, runPluginConformance, overlayFoundationPlugin, annotationFoundationPlugin, textAnnotationPlugin, shapeAnnotationPlugin, drawAnnotationPlugin, transformPlugin, maskPlugin, historyPlugin, filtersPlugin, cropPlugin, mosaicPlugin, overlayStatePlugin, domControlsPlugin, createMinimalPreset, createRedactionPreset, createAnnotationPreset, createFullPreset, detectSnapshotVersion, loadV2Snapshot, migrateV2Snapshot, v2SnapshotMigration]) {
    assert.equal(typeof value, 'function');
}
`;

const cjsSource = `
'use strict';
const assert = require('node:assert/strict');
const { ImageEditorCore } = require('@bensitu/image-editor/core');
const { definePlugin, definePluginRef } = require('@bensitu/image-editor/sdk');
const { createPluginTestHost, runPluginConformance } = require('@bensitu/image-editor/testing');
const { overlayFoundationPlugin } = require('@bensitu/image-editor/plugins/overlay');
const { annotationFoundationPlugin } = require('@bensitu/image-editor/plugins/annotation');
const { textAnnotationPlugin } = require('@bensitu/image-editor/plugins/annotation-text');
const { shapeAnnotationPlugin } = require('@bensitu/image-editor/plugins/annotation-shape');
const { drawAnnotationPlugin } = require('@bensitu/image-editor/plugins/annotation-draw');
const { transformPlugin } = require('@bensitu/image-editor/plugins/transform');
const { maskPlugin } = require('@bensitu/image-editor/plugins/mask');
const { historyPlugin } = require('@bensitu/image-editor/plugins/history');
const { filtersPlugin } = require('@bensitu/image-editor/plugins/filters');
const { cropPlugin } = require('@bensitu/image-editor/plugins/crop');
const { mosaicPlugin } = require('@bensitu/image-editor/plugins/mosaic');
const { overlayStatePlugin } = require('@bensitu/image-editor/plugins/overlay-state');
const { domControlsPlugin } = require('@bensitu/image-editor/plugins/dom-controls');
const { createMinimalPreset } = require('@bensitu/image-editor/presets/minimal');
const { createRedactionPreset } = require('@bensitu/image-editor/presets/redaction');
const { createAnnotationPreset } = require('@bensitu/image-editor/presets/annotation');
const { createFullPreset } = require('@bensitu/image-editor/presets/full');
const { detectSnapshotVersion, loadV2Snapshot, migrateV2Snapshot, v2SnapshotMigration } = require('@bensitu/image-editor/migrate-v2');
for (const value of [ImageEditorCore, definePlugin, definePluginRef, createPluginTestHost, runPluginConformance, overlayFoundationPlugin, annotationFoundationPlugin, textAnnotationPlugin, shapeAnnotationPlugin, drawAnnotationPlugin, transformPlugin, maskPlugin, historyPlugin, filtersPlugin, cropPlugin, mosaicPlugin, overlayStatePlugin, domControlsPlugin, createMinimalPreset, createRedactionPreset, createAnnotationPreset, createFullPreset, detectSnapshotVersion, loadV2Snapshot, migrateV2Snapshot, v2SnapshotMigration]) {
    assert.equal(typeof value, 'function');
}
`;

try {
    if (!npmCliPath) throw new Error('npm_execpath is unavailable; run through npm scripts.');
    const { stdout } = await execFileAsync(
        process.execPath,
        [npmCliPath, 'pack', '--json', '--pack-destination', temporaryRoot],
        { cwd: repoRoot },
    );
    const packResult = JSON.parse(stdout);
    const filename = packResult[0]?.filename;
    if (typeof filename !== 'string' || filename.length === 0) {
        throw new Error('npm pack did not return a tarball filename.');
    }
    const tarballPath = path.join(temporaryRoot, filename);
    const extractRoot = path.join(temporaryRoot, 'extract');
    await mkdir(extractRoot, { recursive: true });
    await execFileAsync('tar', ['-xf', tarballPath, '-C', extractRoot]);

    const consumerRoot = path.join(temporaryRoot, 'consumer');
    const packageInstallRoot = path.join(consumerRoot, 'node_modules', '@bensitu', 'image-editor');
    await mkdir(path.dirname(packageInstallRoot), { recursive: true });
    await rename(path.join(extractRoot, 'package'), packageInstallRoot);
    await writeFile(path.join(consumerRoot, 'package.json'), '{"type":"module"}\n', 'utf8');
    await writeFile(path.join(consumerRoot, 'consumer.mjs'), esmSource, 'utf8');
    await writeFile(path.join(consumerRoot, 'consumer.cjs'), cjsSource, 'utf8');

    await execFileAsync(process.execPath, ['consumer.mjs'], { cwd: consumerRoot });
    await execFileAsync(process.execPath, ['consumer.cjs'], { cwd: consumerRoot });

    const packedManifest = JSON.parse(
        await readFile(path.join(packageInstallRoot, 'package.json'), 'utf8'),
    );
    for (const subpath of [
        './core',
        './sdk',
        './testing',
        './plugins/overlay',
        './plugins/annotation',
        './plugins/annotation-text',
        './plugins/annotation-shape',
        './plugins/annotation-draw',
        './plugins/transform',
        './plugins/mask',
        './plugins/history',
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
    ]) {
        if (!packedManifest.exports?.[subpath]) {
            throw new Error(`Packed manifest is missing export "${subpath}".`);
        }
    }
} finally {
    await rm(resolvedTemporaryRoot, { recursive: true, force: true });
}

console.log('Packed ESM/CJS entry check passed.');
