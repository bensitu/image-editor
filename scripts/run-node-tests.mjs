/**
 * Runs Node's test runner with an explicit, deterministic test-file list.
 *
 * @module
 */

import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, '..');
const requestedRoot = process.argv[2];
const testsRoot = requestedRoot
    ? path.resolve(repoRoot, requestedRoot)
    : path.join(repoRoot, 'tests');
const typeFixtureRoot = path.join(repoRoot, 'tests', 'types');
const testSuffixes = Object.freeze(['.test.mjs', '.test.ts']);

if (!testsRoot.startsWith(`${repoRoot}${path.sep}`)) {
    console.error('Test root must stay inside the repository.');
    process.exit(1);
}
if (testsRoot === typeFixtureRoot || testsRoot.startsWith(`${typeFixtureRoot}${path.sep}`)) {
    console.error('Compile-only type fixtures must run through npm run test:types.');
    process.exit(1);
}

async function collectTestFiles(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = await Promise.all(
        entries.map(async (entry) => {
            const entryPath = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                if (entryPath === typeFixtureRoot) return [];
                return collectTestFiles(entryPath);
            }
            if (entry.isFile() && testSuffixes.some((suffix) => entry.name.endsWith(suffix))) {
                return [entryPath];
            }
            return [];
        }),
    );
    return files.flat();
}

const testFiles = (await collectTestFiles(testsRoot)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

if (testFiles.length === 0) {
    console.error('No runtime test files found with a .test.ts or .test.mjs suffix.');
    process.exit(1);
}

const relativeTestFiles = testFiles.map((file) =>
    path.relative(repoRoot, file).split(path.sep).join('/'),
);
const loaderUrl = pathToFileURL(
    path.join(repoRoot, 'tests', 'helpers', 'register-ts-loader.mjs'),
).href;
const child = spawn(process.execPath, ['--import', loaderUrl, '--test', ...relativeTestFiles], {
    cwd: repoRoot,
    stdio: 'inherit',
    windowsHide: true,
});

child.on('error', (error) => {
    console.error(error);
    process.exit(1);
});

child.on('close', (code, signal) => {
    if (signal) {
        console.error(`Test runner terminated by signal ${signal}.`);
        process.exit(1);
    }
    process.exit(code ?? 1);
});
