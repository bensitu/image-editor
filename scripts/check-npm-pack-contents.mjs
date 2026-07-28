/**
 * Validates the exact npm package artifact and its packed manifest.
 *
 * @module
 */

import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { ALL_APPROVED_UMD_ARTIFACTS } from '../config/bundle/modular-umd.mjs';
import { findCredentialKinds } from './credential-policy.mjs';
import { inspectMainPackageContents } from './package-content-policy.mjs';
import { inspectPackagedSourceMap } from './source-map-policy.mjs';

const execFileAsync = promisify(execFile);
const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, '..');
const npmCliPath = process.env.npm_execpath;
const requiredFiles = [
    'CHANGELOG.md',
    'LICENSE',
    'README.md',
    'dist/esm/index.js',
    'dist/cjs/index.cjs',
    ...ALL_APPROVED_UMD_ARTIFACTS,
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

async function inspectPackedArtifact() {
    if (!npmCliPath) throw new Error('npm_execpath is unavailable; run through an npm script.');
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'image-editor-package-contents-'));
    const resolvedTemporaryRoot = path.resolve(temporaryRoot);
    const resolvedSystemTemp = path.resolve(tmpdir());
    if (!resolvedTemporaryRoot.startsWith(`${resolvedSystemTemp}${path.sep}`)) {
        throw new Error('Refusing to use a package inspection path outside the system temp.');
    }

    try {
        const { stdout } = await execFileAsync(
            process.execPath,
            [
                npmCliPath,
                'pack',
                '--json',
                '--ignore-scripts',
                '--pack-destination',
                resolvedTemporaryRoot,
            ],
            {
                cwd: repoRoot,
                encoding: 'utf8',
                maxBuffer: 32 * 1024 * 1024,
                windowsHide: true,
            },
        );
        const pack = JSON.parse(stdout)[0];
        if (!pack || typeof pack.filename !== 'string') {
            throw new Error('npm pack returned no package artifact.');
        }
        const { stdout: packedManifestSource } = await execFileAsync(
            'tar',
            ['-xOf', path.join(resolvedTemporaryRoot, pack.filename), 'package/package.json'],
            {
                cwd: repoRoot,
                encoding: 'utf8',
                maxBuffer: 1024 * 1024,
                windowsHide: true,
            },
        );
        return { pack, packedManifest: JSON.parse(packedManifestSource) };
    } finally {
        await rm(resolvedTemporaryRoot, { recursive: true, force: true });
    }
}

const { pack, packedManifest } = await inspectPackedArtifact();
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
const absoluteLocalPathPattern = /(?:\b[A-Za-z]:\\Users\\|\/Users\/[^/]+\/|\/home\/[^/]+\/)/u;
const textFilePattern = /\.(?:c?js|mjs|json|map|md|css|d\.ts|d\.cts)$/u;
let sourceMapCount = 0;

if (pack?.name !== packageJson.name || pack?.version !== packageJson.version) {
    failures.push('npm pack identity does not match package.json.');
}
if (packedManifest.name !== packageJson.name || packedManifest.version !== packageJson.version) {
    failures.push('Packed package.json identity does not match the source manifest.');
}
if (
    packedManifest.publishConfig?.access !== 'public' ||
    packedManifest.publishConfig?.provenance !== true
) {
    failures.push('Packed package.json must require public provenance publishing.');
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
    const credentialKinds = findCredentialKinds(source);
    if (credentialKinds.length > 0) {
        failures.push(
            `npm pack file ${entry.path} contains credential-like material ` +
                `(${credentialKinds.join(', ')}).`,
        );
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
