/** Verifies PoC package subpaths from the exact tarball produced by npm pack. */

import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
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
import { overlayFoundationPlugin } from '@bensitu/image-editor/plugins/overlay';
import { transformPlugin } from '@bensitu/image-editor/plugins/transform';
import { maskPlugin } from '@bensitu/image-editor/plugins/mask';
import { historyPlugin } from '@bensitu/image-editor/plugins/history';
for (const value of [ImageEditorCore, overlayFoundationPlugin, transformPlugin, maskPlugin, historyPlugin]) {
    assert.equal(typeof value, 'function');
}
`;

const cjsSource = `
'use strict';
const assert = require('node:assert/strict');
const { ImageEditorCore } = require('@bensitu/image-editor/core');
const { overlayFoundationPlugin } = require('@bensitu/image-editor/plugins/overlay');
const { transformPlugin } = require('@bensitu/image-editor/plugins/transform');
const { maskPlugin } = require('@bensitu/image-editor/plugins/mask');
const { historyPlugin } = require('@bensitu/image-editor/plugins/history');
for (const value of [ImageEditorCore, overlayFoundationPlugin, transformPlugin, maskPlugin, historyPlugin]) {
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
    for (const dependency of ['semver', 'tslib']) {
        await cp(
            path.join(repoRoot, 'node_modules', dependency),
            path.join(consumerRoot, 'node_modules', dependency),
            { recursive: true },
        );
    }
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
        './plugins/overlay',
        './plugins/transform',
        './plugins/mask',
        './plugins/history',
    ]) {
        if (!packedManifest.exports?.[subpath]) {
            throw new Error(`Packed manifest is missing export "${subpath}".`);
        }
    }
} finally {
    await rm(resolvedTemporaryRoot, { recursive: true, force: true });
}

console.log('Packed ESM/CJS entry check passed.');
