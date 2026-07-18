import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { runCodemod, transformSource } from '../../packages/image-editor-codemod/dist/index.js';

const fixtureRoot = new URL('./fixtures/', import.meta.url);
const cliPath = fileURLToPath(
    new URL('../../packages/image-editor-codemod/dist/cli.js', import.meta.url),
);

async function fixture(name) {
    return readFile(new URL(name, fixtureRoot), 'utf8');
}

async function withTemporaryDirectory(run) {
    const directory = await mkdtemp(path.join(tmpdir(), 'image-editor-codemod-test-'));
    try {
        return await run(directory);
    } finally {
        await rm(directory, { recursive: true, force: true });
    }
}

function runCli(args, cwd) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [cliPath, ...args], {
            cwd,
            windowsHide: true,
        });
        let stdout = '';
        let stderr = '';
        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        child.stdout.on('data', (value) => {
            stdout += value;
        });
        child.stderr.on('data', (value) => {
            stderr += value;
        });
        child.on('error', reject);
        child.on('close', (code) => resolve({ code, stdout, stderr }));
    });
}

for (const [inputName, outputName] of [
    ['common.input.ts', 'common.output.ts'],
    ['core.input.js', 'core.output.js'],
    ['jsx.input.tsx', 'jsx.output.tsx'],
]) {
    test('transforms ' + inputName + ' and is idempotent', async () => {
        const input = await fixture(inputName);
        const expected = await fixture(outputName);
        const transformed = transformSource(input, inputName);
        assert.equal(transformed.code, expected);
        assert.equal(transformed.changed, true);
        assert.deepEqual(transformed.unresolved, []);

        const second = transformSource(transformed.code, outputName);
        assert.equal(second.code, transformed.code);
        assert.equal(second.changed, false);
        assert.deepEqual(second.unresolved, []);
    });
}

test('reports every ambiguous syntax class without changing source', async () => {
    const cases = [
        ['dom-guidance.input.ts', 'DOM_ELEMENT_MAP_REVIEW_REQUIRED'],
        ['callbacks-guidance.input.ts', 'CALLBACK_REVIEW_REQUIRED'],
        ['dynamic-property.input.js', 'DYNAMIC_PROPERTY_ACCESS'],
        ['aliased-method.input.ts', 'ALIASED_METHOD'],
        ['runtime-options.input.ts', 'RUNTIME_OPTIONS'],
        ['spread-options.input.ts', 'SPREAD_OPTIONS'],
        ['unsupported-method.input.ts', 'UNSUPPORTED_METHOD'],
        ['subclass.input.ts', 'FACADE_SUBCLASS'],
        ['reflection.input.ts', 'EDITOR_REFLECTION'],
        ['mixed-versions.input.ts', 'MIXED_EDITOR_VERSIONS'],
        ['invalid-syntax.input.ts', 'INVALID_SYNTAX'],
    ];
    for (const [name, expectedCode] of cases) {
        const source = await fixture(name);
        const result = transformSource(source, name);
        assert.equal(result.code, source, name);
        assert.equal(result.changed, false, name);
        assert.ok(
            result.unresolved.some((value) => value.code === expectedCode),
            name + ' did not report ' + expectedCode + ': ' + JSON.stringify(result.unresolved),
        );
    }
});

test('runner supports multi-file dry-run, diff, write, and stable reports', async () => {
    await withTemporaryDirectory(async (directory) => {
        const sourceRoot = path.join(directory, 'src');
        await cp(fixtureRoot, sourceRoot, { recursive: true });
        const commonPath = path.join(sourceRoot, 'common.input.ts');
        const commonBefore = await readFile(commonPath, 'utf8');

        const dryRun = await runCodemod(['src'], { cwd: directory, mode: 'dry-run' });
        assert.ok(dryRun.filesScanned >= 14);
        assert.equal(dryRun.filesWritten, 0);
        assert.ok(dryRun.filesChanged >= 3);
        assert.ok(dryRun.unresolvedCount >= 11);
        assert.equal(await readFile(commonPath, 'utf8'), commonBefore);

        const diff = await runCodemod(['src/common.input.ts'], {
            cwd: directory,
            mode: 'diff',
        });
        assert.equal(diff.filesChanged, 1);
        assert.match(diff.files[0].diff, /^--- a\/src\/common\.input\.ts/m);
        assert.match(diff.files[0].diff, /createFullPreset/);
        assert.equal(await readFile(commonPath, 'utf8'), commonBefore);

        const write = await runCodemod(['src/common.input.ts', 'src/core.input.js'], {
            cwd: directory,
            mode: 'write',
        });
        assert.equal(write.filesChanged, 2);
        assert.equal(write.filesWritten, 2);
        assert.equal(write.unresolvedCount, 0);
        assert.equal(await readFile(commonPath, 'utf8'), await fixture('common.output.ts'));

        const idempotent = await runCodemod(['src/common.input.ts', 'src/core.input.js'], {
            cwd: directory,
            mode: 'write',
        });
        assert.equal(idempotent.filesChanged, 0);
        assert.equal(idempotent.filesWritten, 0);
        assert.equal(idempotent.result, 'PASS');
    });
});

test('runner reports oversized input without reading or changing it', async () => {
    await withTemporaryDirectory(async (directory) => {
        const filePath = path.join(directory, 'large.ts');
        await writeFile(filePath, Buffer.alloc(2 * 1024 * 1024 + 1, 0x20));
        const report = await runCodemod(['large.ts'], { cwd: directory, mode: 'write' });
        assert.equal(report.filesChanged, 0);
        assert.equal(report.filesWritten, 0);
        assert.equal(report.unresolvedCount, 1);
        assert.equal(report.files[0].unresolved[0].code, 'SOURCE_TOO_LARGE');
    });
});

test('runner refuses symbolic-link traversal', async () => {
    await withTemporaryDirectory(async (directory) => {
        const target = path.join(directory, 'target');
        const sourceRoot = path.join(directory, 'src');
        await mkdir(target);
        await mkdir(sourceRoot);
        await writeFile(path.join(target, 'external.ts'), await fixture('common.input.ts'));
        await symlink(target, path.join(sourceRoot, 'linked'), 'junction');
        await assert.rejects(
            () => runCodemod(['src'], { cwd: directory, mode: 'write' }),
            /symbolic link/i,
        );
    });
});

test('CLI preserves source in dry-run and diff modes and writes an unresolved report', async () => {
    await withTemporaryDirectory(async (directory) => {
        await writeFile(path.join(directory, 'editor.ts'), await fixture('common.input.ts'));
        const dryRun = await runCli(['v2-to-v3', 'editor.ts', '--dry-run'], directory);
        assert.equal(dryRun.code, 1);
        assert.match(dryRun.stdout, /"mode": "dry-run"/);
        assert.equal(
            await readFile(path.join(directory, 'editor.ts'), 'utf8'),
            await fixture('common.input.ts'),
        );

        const diff = await runCli(['v2-to-v3', 'editor.ts', '--diff'], directory);
        assert.equal(diff.code, 1);
        assert.match(diff.stdout, /^--- a\/editor\.ts/m);

        await writeFile(
            path.join(directory, 'dynamic.js'),
            await fixture('dynamic-property.input.js'),
        );
        const unresolved = await runCli(
            ['v2-to-v3', 'dynamic.js', '--dry-run', '--report', 'report.json'],
            directory,
        );
        assert.equal(unresolved.code, 2);
        assert.match(unresolved.stderr, /DYNAMIC_PROPERTY_ACCESS/);
        const report = JSON.parse(await readFile(path.join(directory, 'report.json'), 'utf8'));
        assert.equal(report.result, 'UNRESOLVED');
        assert.equal(report.filesWritten, 0);
    });
});
