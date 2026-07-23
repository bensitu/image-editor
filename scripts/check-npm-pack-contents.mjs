/**
 * Validates the dry-run npm package manifest without creating a tarball.
 *
 * @module
 */

import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { inspectMainPackageContents } from './package-content-policy.mjs';
import { inspectPackagedSourceMap } from './source-map-policy.mjs';

const execFileAsync = promisify(execFile);
const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, '..');
const command = process.platform === 'win32' ? (process.env.ComSpec ?? 'cmd.exe') : 'npm';
const args =
    process.platform === 'win32'
        ? ['/d', '/s', '/c', 'npm pack --dry-run --json']
        : ['pack', '--dry-run', '--json'];
const requiredFiles = [
    'CHANGELOG.md',
    'LICENSE',
    'README.md',
    'dist/esm/index.js',
    'dist/cjs/index.cjs',
    'dist/umd/image-editor.full.umd.js',
    'dist/umd/image-editor.full.umd.js.map',
    'dist/umd/image-editor.full.umd.min.js',
    'dist/umd/image-editor.full.umd.min.js.map',
    'dist/types/index.d.ts',
    'dist/types/index.d.cts',
    'dist/types/core/index.d.ts',
    'dist/esm/sdk/index.js',
    'dist/cjs/sdk/index.cjs',
    'dist/types/sdk/index.d.ts',
    'dist/types/sdk/index.d.cts',
    'dist/esm/testing/index.js',
    'dist/cjs/testing/index.cjs',
    'dist/types/testing/index.d.ts',
    'dist/types/testing/index.d.cts',
];

const { stdout } = await execFileAsync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
});
const result = JSON.parse(stdout);
const pack = result[0];
const packageJson = JSON.parse(await readFile(path.join(repoRoot, 'package.json'), 'utf8'));
const entries = (pack?.files ?? []).map((entry) => ({
    ...entry,
    path: entry.path.replaceAll('\\', '/'),
}));
const files = new Set(entries.map((entry) => entry.path));
const failures = [];
const forbiddenFilePattern =
    /(?:^|\/)(?:\.env(?:\.|$)|credentials?(?:\.|$)|secrets?(?:\.|$)|[^/]+\.(?:key|pem|p12|pfx)|[^/]+\.tgz)$/iu;
const privatePathPattern = /(?:^|\/)(?:\.internal|implementation|release-candidate)(?:\/|$)/iu;
const credentialPattern =
    /(?:-----BEGIN (?:EC |OPENSSH |RSA )?PRIVATE KEY-----|\bAKIA[A-Z0-9]{16}\b|\b(?:ghp_|sk-)[A-Za-z0-9_-]{20,}\b)/u;
const absoluteLocalPathPattern = /(?:\b[A-Za-z]:\\Users\\|\/Users\/[^/]+\/|\/home\/[^/]+\/)/u;
const textFilePattern = /\.(?:c?js|mjs|json|map|md|css|d\.ts|d\.cts)$/u;
let sourceMapCount = 0;

if (pack?.name !== packageJson.name || pack?.version !== packageJson.version) {
    failures.push('npm pack identity does not match package.json.');
}
for (const requiredFile of requiredFiles) {
    if (!files.has(requiredFile)) failures.push(`npm pack is missing ${requiredFile}.`);
}
for (const file of files) {
    const allowed =
        file === 'package.json' ||
        /^(?:CHANGELOG|README|LICENSE)(?:\..*)?$/iu.test(file) ||
        file.startsWith('dist/');
    if (!allowed) failures.push(`npm pack contains unexpected file ${file}.`);
    if (forbiddenFilePattern.test(file) || privatePathPattern.test(file)) {
        failures.push(`npm pack contains forbidden private or credential path ${file}.`);
    }
}
for (const entry of entries) {
    if (entry.size > 8 * 1024 * 1024) {
        failures.push(`npm pack file ${entry.path} exceeds the 8 MiB per-file review limit.`);
    }
    if (!textFilePattern.test(entry.path)) continue;
    const source = await readFile(path.join(repoRoot, entry.path), 'utf8');
    if (credentialPattern.test(source)) {
        failures.push(`npm pack file ${entry.path} contains credential-like material.`);
    }
    if (absoluteLocalPathPattern.test(source)) {
        failures.push(`npm pack file ${entry.path} contains an absolute local user path.`);
    }
    if (!entry.path.endsWith('.map')) continue;
    sourceMapCount += 1;
    let sourceMap;
    try {
        sourceMap = JSON.parse(source);
    } catch {
        failures.push(`npm pack source map ${entry.path} is not valid JSON.`);
        continue;
    }
    failures.push(...inspectPackagedSourceMap(sourceMap, entry.path));
}

function visitExportTargets(value, keyPath = 'exports') {
    if (typeof value === 'string') {
        if (/(?:^|\/)(?:core-runtime|plugin-kernel|internal)(?:\/|$)/u.test(value)) {
            failures.push(`${keyPath} exposes private target ${value}.`);
        }
        return;
    }
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value))
        visitExportTargets(child, `${keyPath}.${key}`);
}

visitExportTargets(packageJson.exports);

const semanticInspection = await inspectMainPackageContents({
    packageRoot: repoRoot,
    manifest: packageJson,
    files: [...files],
});
failures.push(...semanticInspection.failures);

if (failures.length > 0) {
    console.error('npm pack contents check failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
}

console.log(
    `npm pack contents check passed (${files.size} files, ${pack.size} bytes; ` +
        `${semanticInspection.esm.reachable}/${semanticInspection.esm.total} ESM, ` +
        `${semanticInspection.declarations.reachable}/${semanticInspection.declarations.total} declarations, ` +
        `${semanticInspection.cjs.reachable}/${semanticInspection.cjs.total} CJS; ` +
        `${sourceMapCount} source maps, embedded source content: none).`,
);
