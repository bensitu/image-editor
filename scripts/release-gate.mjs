/**
 * Post-build release gate for generated package artifacts.
 *
 * This script intentionally reads the existing dist/ tree only. Run it after
 * `npm run build` so it validates freshly generated output instead of stale
 * artifacts.
 *
 * @module
 */

import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, '..');
const failures = [];

const requiredArtifacts = [
    'dist/esm/index.js',
    'dist/cjs/index.cjs',
    'dist/umd/image-editor.umd.js',
    'dist/types/index.d.ts',
    'dist/types/index.d.cts',
    'dist/types/image-editor.d.ts',
    'dist/types/core/public-types.d.ts',
];

const expectedDeclarationSymbols = [
    'ImageEditor',
    'ImageEditorOptions',
    'MaskObject',
    'AnnotationObject',
    'ImageExportOptions',
    'OverlayState',
    'ImportOverlayStateOptions',
];

function toRepoPath(relativePath) {
    return path.join(repoRoot, relativePath);
}

function normalizePackagePath(value) {
    return value.replace(/^\.\//, '');
}

function addFailure(message) {
    failures.push(message);
}

async function readText(relativePath) {
    try {
        return await readFile(toRepoPath(relativePath), 'utf8');
    } catch (error) {
        addFailure(`${relativePath}: unable to read file (${error.message}).`);
        return '';
    }
}

async function assertNonEmptyFile(relativePath) {
    try {
        const fileStat = await stat(toRepoPath(relativePath));
        if (!fileStat.isFile()) {
            addFailure(`${relativePath}: expected a file.`);
            return;
        }
        if (fileStat.size <= 0) {
            addFailure(`${relativePath}: file must be non-empty.`);
        }
    } catch {
        addFailure(`${relativePath}: required build artifact is missing.`);
    }
}

async function assertPackagePathExists(label, value) {
    if (typeof value !== 'string' || value.trim() === '') {
        addFailure(`package.json ${label}: expected a non-empty string.`);
        return;
    }
    await assertNonEmptyFile(normalizePackagePath(value));
}

function assertContains(text, pattern, label, message) {
    if (!pattern.test(text)) {
        addFailure(`${label}: ${message}`);
    }
}

async function checkBuildArtifacts() {
    await Promise.all(requiredArtifacts.map((artifact) => assertNonEmptyFile(artifact)));
}

async function checkBundleShapes() {
    const esm = await readText('dist/esm/index.js');
    assertContains(
        esm,
        /\b(?:export|import)\s+/,
        'dist/esm/index.js',
        'expected ESM import/export syntax.',
    );

    const cjs = await readText('dist/cjs/index.cjs');
    assertContains(
        cjs,
        /['"]use strict['"]/,
        'dist/cjs/index.cjs',
        'expected a CommonJS strict-mode marker.',
    );
    assertContains(
        cjs,
        /(?:\bexports\.|\bmodule\.exports\b|Object\.defineProperty\(exports,)/,
        'dist/cjs/index.cjs',
        'expected a CommonJS exports marker.',
    );

    const umd = await readText('dist/umd/image-editor.umd.js');
    assertContains(
        umd,
        /\bImageEditor\b/,
        'dist/umd/image-editor.umd.js',
        'expected documented UMD global name "ImageEditor".',
    );
}

async function checkDeclarationShape() {
    const entryTypes = await readText('dist/types/index.d.ts');
    const publicTypes = await readText('dist/types/core/public-types.d.ts');
    const declarationText = `${entryTypes}\n${publicTypes}`;

    for (const symbol of expectedDeclarationSymbols) {
        assertContains(
            declarationText,
            new RegExp(`\\b${symbol}\\b`),
            'dist/types declarations',
            `expected public symbol "${symbol}" to be declared or re-exported.`,
        );
    }
}

async function checkPackageMetadata() {
    let packageJson;
    try {
        packageJson = JSON.parse(await readText('package.json'));
    } catch (error) {
        addFailure(`package.json: unable to parse JSON (${error.message}).`);
        return;
    }
    const rootExport = packageJson.exports?.['.'];

    await assertPackagePathExists('main', packageJson.main);
    await assertPackagePathExists('module', packageJson.module);
    await assertPackagePathExists('types', packageJson.types);
    if (packageJson.unpkg !== undefined) {
        await assertPackagePathExists('unpkg', packageJson.unpkg);
    }
    if (packageJson.jsdelivr !== undefined) {
        await assertPackagePathExists('jsdelivr', packageJson.jsdelivr);
    }

    if (rootExport?.import?.default !== undefined) {
        await assertPackagePathExists('exports["."].import.default', rootExport.import.default);
    }
    if (rootExport?.import?.types !== undefined) {
        await assertPackagePathExists('exports["."].import.types', rootExport.import.types);
    }
    if (rootExport?.require?.default !== undefined) {
        await assertPackagePathExists('exports["."].require.default', rootExport.require.default);
    }
    if (rootExport?.require?.types !== undefined) {
        await assertPackagePathExists('exports["."].require.types', rootExport.require.types);
    }
    if (rootExport?.default !== undefined) {
        await assertPackagePathExists('exports["."].default', rootExport.default);
    }
}

await checkBuildArtifacts();
await checkBundleShapes();
await checkDeclarationShape();
await checkPackageMetadata();

if (failures.length > 0) {
    console.error('Release gate failed:');
    for (const failure of failures) {
        console.error(`- ${failure}`);
    }
    process.exit(1);
}

console.log('Release gate passed.');
