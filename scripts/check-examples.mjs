/** Builds public examples and verifies their import and package boundaries. */

import { execFile } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

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

await verifySources();
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
await run(process.execPath, ['scripts/check-reference-plugins.mjs', '--static']);
console.log('Public example compilation and package checks passed.');
