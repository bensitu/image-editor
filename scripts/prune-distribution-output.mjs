/**
 * Removes generated artifacts that are inaccessible from formal package contracts.
 *
 * @module
 */

import { readdir, rm, rmdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    APPROVED_UMD_FILES,
    collectRelativeFiles,
    inspectMainPackageContents,
} from './package-content-policy.mjs';

const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptsRoot, '..');
const distributionRoot = path.join(repositoryRoot, 'dist');
const manifest = (await import('../package.json', { with: { type: 'json' } })).default;
const esmBuildInputs = new Set(['dist/esm/umd/full.js', 'dist/esm/umd/full.js.map']);
const mode = process.argv[2] ?? '--all';

if (!['--all', '--esm'].includes(mode) || process.argv.length > 3) {
    throw new Error('Use --all or --esm.');
}

async function removeGeneratedFile(relativePath, existingFiles, removed) {
    await rm(path.join(repositoryRoot, ...relativePath.split('/')), { force: true });
    if (existingFiles.has(relativePath)) removed.add(relativePath);
    const mapPath = `${relativePath}.map`;
    await rm(path.join(repositoryRoot, ...mapPath.split('/')), { force: true });
    if (existingFiles.has(mapPath)) removed.add(mapPath);
}

async function removeEmptyDirectories(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isDirectory()) await removeEmptyDirectories(path.join(directory, entry.name));
    }
    if (directory === distributionRoot) return;
    if ((await readdir(directory)).length === 0) await rmdir(directory);
}

const beforeFiles = await collectRelativeFiles(distributionRoot, repositoryRoot);
const beforeFileSet = new Set(beforeFiles);
const before = await inspectMainPackageContents({
    packageRoot: repositoryRoot,
    manifest,
    files: ['package.json', ...beforeFiles],
});
const removed = new Set();

for (const file of beforeFiles) {
    if (
        /^dist\/esm\/.*\.js$/u.test(file) &&
        !before.graphs.esmReachable.includes(file) &&
        !esmBuildInputs.has(file)
    ) {
        await removeGeneratedFile(file, beforeFileSet, removed);
    } else if (
        mode === '--all' &&
        /\.d\.(?:cts|mts|ts)$/u.test(file) &&
        !before.graphs.declarationReachable.includes(file)
    ) {
        await removeGeneratedFile(file, beforeFileSet, removed);
    } else if (
        mode === '--all' &&
        /^dist\/cjs\/.*\.cjs$/u.test(file) &&
        !before.graphs.cjsReachable.includes(file)
    ) {
        await removeGeneratedFile(file, beforeFileSet, removed);
    } else if (
        mode === '--all' &&
        file.startsWith('dist/umd/') &&
        !APPROVED_UMD_FILES.includes(file)
    ) {
        await rm(path.join(repositoryRoot, ...file.split('/')), { force: true });
        removed.add(file);
    }
}

await removeEmptyDirectories(distributionRoot);

const afterFiles = await collectRelativeFiles(distributionRoot, repositoryRoot);
if (mode === '--esm') {
    const unexpectedEsm = afterFiles.filter(
        (file) =>
            /^dist\/esm\/.*\.js$/u.test(file) &&
            !before.graphs.esmReachable.includes(file) &&
            !esmBuildInputs.has(file),
    );
    if (unexpectedEsm.length > 0) {
        throw new Error(`ESM pruning left inaccessible modules:\n${unexpectedEsm.join('\n')}`);
    }
    console.log(
        `ESM pruning passed (${removed.size} stale artifacts removed; ` +
            `${before.esm.reachable}/${before.esm.reachable} formal-entry modules).`,
    );
    process.exit(0);
}

const packedFiles = afterFiles.filter((file) => !esmBuildInputs.has(file));
const after = await inspectMainPackageContents({
    packageRoot: repositoryRoot,
    manifest,
    files: ['package.json', ...packedFiles],
});
if (after.failures.length > 0) {
    throw new Error(`Distribution pruning left policy failures:\n${after.failures.join('\n')}`);
}

console.log(
    `Distribution pruning passed (${removed.size} stale artifacts removed; ` +
        `${after.esm.reachable}/${after.esm.total} ESM, ` +
        `${after.declarations.reachable}/${after.declarations.total} declarations, ` +
        `${after.cjs.reachable}/${after.cjs.total} CJS).`,
);
