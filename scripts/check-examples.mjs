/** Builds public examples and verifies their import and package boundaries. */

import { execFile } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import semver from 'semver';

const execFileAsync = promisify(execFile);
const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptsRoot, '..');
const examplesRoot = path.join(repositoryRoot, 'examples');
const manifest = JSON.parse(await readFile(path.join(repositoryRoot, 'package.json'), 'utf8'));
const formalEditorImports = new Set([
    '@bensitu/image-editor',
    ...Object.keys(manifest.exports)
        .filter((entry) => entry !== '.')
        .map((entry) => `@bensitu/image-editor${entry.slice(1)}`),
]);
const headerRoots = Object.freeze([
    'fabric-vs-framework-redaction',
    'plugin-template',
    'vanilla-core',
    'vanilla-dom-controls',
]);
const buildWorkspaces = Object.freeze([
    '@bensitu/image-editor-vanilla-core-example',
    '@bensitu/image-editor-vanilla-dom-controls-example',
    '@bensitu/image-editor-react-basic-example',
    '@bensitu/image-editor-vue-basic-example',
    '@bensitu/image-editor-next-client-only-example',
    '@bensitu/image-editor-redaction-comparison',
]);
const isolatedExampleRoots = new Map([
    ['@bensitu/image-editor-next-client-only-example', path.join(examplesRoot, 'next-client-only')],
]);

function assertCondition(condition, message) {
    if (!condition) throw new Error(message);
}

async function run(command, args, cwd = repositoryRoot) {
    return execFileAsync(command, args, {
        cwd,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        windowsHide: true,
        env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
    });
}

async function npm(args, cwd = repositoryRoot) {
    const npmCliPath =
        process.env.npm_execpath ??
        path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
    return run(process.execPath, [npmCliPath, ...args], cwd);
}

async function collectFiles(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        if (['dist', 'node_modules', '.next'].includes(entry.name)) continue;
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) files.push(...(await collectFiles(entryPath)));
        else if (entry.isFile() && /\.(?:[cm]?[jt]sx?|vue)$/u.test(entry.name))
            files.push(entryPath);
    }
    return files;
}

async function collectExampleManifests(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const manifests = [];
    for (const entry of entries) {
        if (['dist', 'node_modules', '.next'].includes(entry.name)) continue;
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            manifests.push(...(await collectExampleManifests(entryPath)));
        } else if (entry.isFile() && entry.name === 'package.json') {
            manifests.push({
                path: entryPath,
                value: JSON.parse(await readFile(entryPath, 'utf8')),
            });
        }
    }
    return manifests;
}

function collectImports(source) {
    const imports = [];
    const expression = /(?:from\s*|import\s*\()\s*['"]([^'"]+)['"]/gu;
    for (const match of source.matchAll(expression)) imports.push(match[1]);
    return imports;
}

function hasModuleResponsibilityHeader(source) {
    const header = source.match(/^\/\*\*[\s\S]*?\*\//u)?.[0];
    return Boolean(
        header &&
        /^\/\*\*\r?\n \* \S/u.test(header) &&
        /(?:^|\r?\n) \* @module(?:\r?\n|$)/u.test(header),
    );
}

async function verifySources() {
    const files = await collectFiles(examplesRoot);
    for (const filePath of files) {
        const source = await readFile(filePath, 'utf8');
        const relative = path.relative(examplesRoot, filePath).replaceAll('\\', '/');
        for (const specifier of collectImports(source)) {
            if (!specifier.startsWith('@bensitu/image-editor')) continue;
            assertCondition(
                formalEditorImports.has(specifier),
                `${relative} imports non-public entry "${specifier}".`,
            );
        }
        if (
            filePath.endsWith('.ts') &&
            headerRoots.some((root) => relative.startsWith(`${root}/`))
        ) {
            assertCondition(
                hasModuleResponsibilityHeader(source),
                `${relative} must begin with a module responsibility header containing @module.`,
            );
        }
    }
}

async function verifyFabricRanges() {
    const peerRange = manifest.peerDependencies?.fabric;
    const peerMinimum = typeof peerRange === 'string' ? semver.minVersion(peerRange) : null;
    assertCondition(peerMinimum !== null, 'The root Fabric peer range must be valid.');

    const checkedPackages = new Set();
    for (const exampleManifest of await collectExampleManifests(examplesRoot)) {
        for (const dependencyType of ['dependencies', 'devDependencies']) {
            const fabricRange = exampleManifest.value[dependencyType]?.fabric;
            if (typeof fabricRange !== 'string') continue;

            const normalizedRange = semver.validRange(fabricRange);
            const exampleMinimum = normalizedRange ? semver.minVersion(normalizedRange) : null;
            const relative = path
                .relative(repositoryRoot, exampleManifest.path)
                .replaceAll('\\', '/');
            assertCondition(
                normalizedRange !== null && exampleMinimum !== null,
                `${relative} has an invalid Fabric range "${fabricRange}".`,
            );
            assertCondition(
                semver.gte(exampleMinimum, peerMinimum),
                `${relative} permits Fabric below the root peer minimum ${peerMinimum.version}.`,
            );
            assertCondition(
                semver.intersects(normalizedRange, peerRange),
                `${relative} Fabric range "${fabricRange}" does not intersect "${peerRange}".`,
            );
            checkedPackages.add(exampleManifest.value.name);
        }
    }

    for (const packageName of [
        '@bensitu/image-editor-react-basic-example',
        '@bensitu/image-editor-vue-basic-example',
        '@bensitu/image-editor-next-client-only-example',
    ]) {
        assertCondition(
            checkedPackages.has(packageName),
            `${packageName} must declare a checked Fabric range.`,
        );
    }
}

async function verifyTemplatePackage() {
    const templateRoot = path.join(examplesRoot, 'plugin-template');
    await npm(['run', 'build'], templateRoot);
    await npm(['test'], templateRoot);
    const packed = await npm(['pack', '--dry-run', '--json'], templateRoot);
    const result = JSON.parse(packed.stdout)[0];
    assertCondition(
        result?.name === '@example/image-editor-status-plugin',
        'Template pack failed.',
    );
    const files = new Set((result.files ?? []).map((entry) => entry.path));
    for (const required of [
        'LICENSE',
        'README.md',
        'dist/cjs/index.cjs',
        'dist/esm/index.d.ts',
        'dist/esm/index.js',
        'package.json',
    ]) {
        assertCondition(files.has(required), `Template tarball is missing ${required}.`);
    }
}

await Promise.all([verifySources(), verifyFabricRanges()]);
for (const workspace of buildWorkspaces) {
    const isolatedRoot = isolatedExampleRoots.get(workspace);
    if (isolatedRoot) {
        const lockPath = path.join(isolatedRoot, 'package-lock.json');
        const lockBefore = await readFile(lockPath, 'utf8');
        console.log(`Installing ${workspace} from its audited lockfile.`);
        await npm(['install', '--ignore-scripts', '--no-audit', '--no-fund'], isolatedRoot);
        const lockAfter = await readFile(lockPath, 'utf8');
        assertCondition(
            lockAfter === lockBefore,
            `${workspace} installation changed its committed lockfile.`,
        );
        console.log(`Building ${workspace}.`);
        await npm(['run', 'build'], isolatedRoot);
        continue;
    }
    console.log(`Building ${workspace}.`);
    await npm(['run', 'build', '--workspace', workspace]);
}
await verifyTemplatePackage();
console.log('Public example compilation and package checks passed.');
