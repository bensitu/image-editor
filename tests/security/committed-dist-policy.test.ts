import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, rm, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

import { inspectCommittedDist } from '../../scripts/committed-dist-policy.mjs';

const execFileAsync = promisify(execFile);

async function git(repositoryRoot, ...args) {
    await execFileAsync('git', args, {
        cwd: repositoryRoot,
        encoding: 'utf8',
        windowsHide: true,
    });
}

async function writeFixture(repositoryRoot, relativePath, contents) {
    const filePath = path.join(repositoryRoot, relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, contents);
}

test('committed dist policy reports changed, new, map, and declaration artifacts', async () => {
    const repositoryRoot = await mkdtemp(path.join(os.tmpdir(), 'image-editor-dist-policy-'));
    const files = new Map([
        ['dist/esm/index.js', 'export const value = 1;\n'],
        ['dist/types/index.d.ts', 'export declare const value: number;\n'],
        ['dist/umd/index.js.map', '{"version":3,"sources":[]}\n'],
    ]);

    try {
        await git(repositoryRoot, 'init', '--quiet');
        await git(repositoryRoot, 'config', 'user.name', 'Image Editor Test');
        await git(repositoryRoot, 'config', 'user.email', 'test@example.invalid');
        for (const [filePath, contents] of files) {
            await writeFixture(repositoryRoot, filePath, contents);
        }
        await git(repositoryRoot, 'add', 'dist');
        await git(repositoryRoot, 'commit', '--quiet', '-m', 'fixture');

        assert.equal((await inspectCommittedDist(repositoryRoot)).passed, true);

        await writeFixture(repositoryRoot, 'dist/esm/index.js', 'export const value = 2;\n');
        const changed = await inspectCommittedDist(repositoryRoot);
        assert.deepEqual(
            changed.contentMismatches.map(({ filePath }) => filePath),
            ['dist/esm/index.js'],
        );
        await writeFixture(repositoryRoot, 'dist/esm/index.js', files.get('dist/esm/index.js'));

        await writeFixture(repositoryRoot, 'dist/cjs/chunks/new.cjs', 'module.exports = 1;\n');
        const added = await inspectCommittedDist(repositoryRoot);
        assert.deepEqual(
            added.newFiles.map(({ filePath }) => filePath),
            ['dist/cjs/chunks/new.cjs'],
        );
        await unlink(path.join(repositoryRoot, 'dist/cjs/chunks/new.cjs'));

        await unlink(path.join(repositoryRoot, 'dist/types/index.d.ts'));
        await unlink(path.join(repositoryRoot, 'dist/umd/index.js.map'));
        const missing = await inspectCommittedDist(repositoryRoot);
        assert.deepEqual(missing.missingFiles, ['dist/types/index.d.ts', 'dist/umd/index.js.map']);
    } finally {
        await rm(repositoryRoot, { force: true, recursive: true });
    }
});
