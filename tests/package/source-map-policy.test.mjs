import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { inspectPackagedSourceMap } from '../../scripts/source-map-policy.mjs';

const execFileAsync = promisify(execFile);
const testsRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testsRoot, '../..');

test('every source map in the built npm package excludes source content', async () => {
    const command = process.platform === 'win32' ? (process.env.ComSpec ?? 'cmd.exe') : 'npm';
    const args =
        process.platform === 'win32'
            ? ['/d', '/s', '/c', 'npm pack --dry-run --json']
            : ['pack', '--dry-run', '--json'];
    const { stdout } = await execFileAsync(command, args, {
        cwd: repositoryRoot,
        encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024,
        windowsHide: true,
    });
    const [pack] = JSON.parse(stdout);
    const maps = pack.files
        .map(({ path: fileName }) => fileName.replaceAll('\\', '/'))
        .filter((fileName) => fileName.endsWith('.map'));

    assert.ok(maps.length > 0, 'The package must contain attributable source maps.');
    for (const fileName of maps) {
        const sourceMap = JSON.parse(await readFile(path.join(repositoryRoot, fileName), 'utf8'));
        assert.deepEqual(inspectPackagedSourceMap(sourceMap, fileName), []);
    }
});

test('source-map policy rejects non-empty embedded sources', () => {
    assert.deepEqual(
        inspectPackagedSourceMap(
            { version: 3, sources: ['../src/index.ts'], sourcesContent: ['source code'] },
            'dist/index.js.map',
        ),
        ['npm pack source map dist/index.js.map embeds source content.'],
    );
    assert.deepEqual(
        inspectPackagedSourceMap(
            { version: 3, sources: ['../src/index.ts'], sourcesContent: [null, ''] },
            'dist/index.js.map',
        ),
        [],
    );
});
