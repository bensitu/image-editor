/** Verifies the codemod tarball through installed runtime, CLI, and type consumers. */

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptsRoot, '..');
const packageRoot = path.join(repositoryRoot, 'packages', 'image-editor-codemod');
const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'image-editor-codemod-pack-'));
const resolvedTemporaryRoot = path.resolve(temporaryRoot);
const resolvedSystemTemp = path.resolve(tmpdir());
const npmCliPath = process.env.npm_execpath;

if (!resolvedTemporaryRoot.startsWith(`${resolvedSystemTemp}${path.sep}`)) {
    throw new Error('Refusing to use a package test path outside the system temporary directory.');
}

async function runNode(args, cwd) {
    return execFileAsync(process.execPath, args, {
        cwd,
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
        windowsHide: true,
    });
}

async function runCli(args, cwd, expectedCode) {
    try {
        const result = await runNode(args, cwd);
        if (expectedCode !== 0) throw new Error(`Expected exit code ${expectedCode}, received 0.`);
        return result;
    } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === expectedCode) {
            return error;
        }
        throw error;
    }
}

try {
    if (!npmCliPath) throw new Error('npm_execpath is unavailable; run through an npm script.');
    const packed = await runNode(
        [npmCliPath, 'pack', '--json', '--pack-destination', temporaryRoot],
        packageRoot,
    );
    const packResult = JSON.parse(packed.stdout)[0];
    if (!packResult || typeof packResult.filename !== 'string') {
        throw new Error('npm pack returned no codemod artifact.');
    }
    const packedFiles = packResult.files.map((entry) => entry.path).sort();
    if (packedFiles.some((file) => file.startsWith('src/') || file.includes('/test'))) {
        throw new Error('Codemod tarball contains source or test files.');
    }
    for (const required of [
        'dist/cli.js',
        'dist/index.js',
        'dist/index.d.ts',
        'README.md',
        'LICENSE',
    ]) {
        if (!packedFiles.includes(required)) {
            throw new Error(`Codemod tarball is missing ${required}.`);
        }
    }

    const tarballPath = path.join(temporaryRoot, packResult.filename);
    const consumerRoot = path.join(temporaryRoot, 'consumer');
    await mkdir(consumerRoot, { recursive: true });
    await writeFile(
        path.join(consumerRoot, 'package.json'),
        '{"name":"codemod-consumer","private":true,"type":"module"}\n',
        'utf8',
    );
    await runNode(
        [
            npmCliPath,
            'install',
            tarballPath,
            '--ignore-scripts',
            '--no-audit',
            '--no-fund',
            '--loglevel',
            'error',
        ],
        consumerRoot,
    );

    const installedRoot = path.join(
        consumerRoot,
        'node_modules',
        '@bensitu',
        'image-editor-codemod',
    );
    const runtimeConsumer = `
import assert from 'node:assert/strict';
import { transformSource } from '@bensitu/image-editor-codemod';
const result = transformSource(
  "import { ImageEditor } from '@bensitu/image-editor';\\nconst editor = new ImageEditor(fabric);\\neditor.init({ canvas: 'canvas' });\\n",
  'consumer.ts',
);
assert.equal(result.changed, true);
assert.match(result.code, /ImageEditorCore/);
`;
    await writeFile(path.join(consumerRoot, 'consumer.mjs'), runtimeConsumer, 'utf8');
    await runNode(['consumer.mjs'], consumerRoot);

    const typeConsumer = `
import {
  runCodemod,
  transformSource,
  type CodemodReport,
  type SourceTransformResult,
} from '@bensitu/image-editor-codemod';
const transformed: SourceTransformResult = transformSource('', 'source.ts');
const report: Promise<CodemodReport> = runCodemod(['src'], { mode: 'dry-run' });
void transformed;
void report;
`;
    await writeFile(path.join(consumerRoot, 'consumer.mts'), typeConsumer, 'utf8');
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
                include: ['consumer.mts'],
            },
            null,
            2,
        )}\n`,
        'utf8',
    );
    const typescriptCli = path.join(consumerRoot, 'node_modules', 'typescript', 'bin', 'tsc');
    await runNode([typescriptCli, '-p', 'tsconfig.json'], consumerRoot);

    const sourcePath = path.join(consumerRoot, 'editor.ts');
    await writeFile(
        sourcePath,
        "import { ImageEditor } from '@bensitu/image-editor';\nconst editor = new ImageEditor(fabric);\neditor.init({ canvas: 'canvas' });\n",
        'utf8',
    );
    const cliPath = path.join(installedRoot, 'dist', 'cli.js');
    await runCli([cliPath, 'v2-to-v3', 'editor.ts', '--dry-run'], consumerRoot, 1);
    await runCli([cliPath, 'v2-to-v3', 'editor.ts', '--write'], consumerRoot, 0);
    await runCli([cliPath, 'v2-to-v3', 'editor.ts', '--write'], consumerRoot, 0);
    if (!(await readFile(sourcePath, 'utf8')).includes('ImageEditorCore')) {
        throw new Error('Installed codemod CLI did not transform the source file.');
    }

    const tarballHash = createHash('sha256')
        .update(await readFile(tarballPath))
        .digest('hex');
    process.stdout.write(
        `${JSON.stringify(
            {
                result: 'PASS',
                package: packResult.name,
                version: packResult.version,
                files: packedFiles.length,
                bytes: packResult.size,
                sha256: tarballHash,
                runtimeConsumer: 'PASS',
                typeConsumer: 'PASS',
                cliDryRun: 'PASS',
                cliWrite: 'PASS',
                cliIdempotency: 'PASS',
                published: false,
            },
            null,
            2,
        )}\n`,
    );
} finally {
    await rm(resolvedTemporaryRoot, { recursive: true, force: true });
}
