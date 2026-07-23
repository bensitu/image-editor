/**
 * Runs the pull-request or release validation profile.
 *
 * @module
 */

import { execFile, spawn } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import semver from 'semver';

const execFileAsync = promisify(execFile);
const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptsRoot, '..');
const npmCliPath = process.env.npm_execpath;
const profile = process.argv[2];
const excludedDirectories = new Set([
    '.cache',
    '.git',
    '.internal',
    '.next',
    'coverage',
    'dist',
    'node_modules',
    'out',
    'playwright-report',
    'test-results',
]);

const pullRequestChecks = Object.freeze([
    ['source quality and Node product tests', 'check'],
    ['source module headers', 'check:source-quality'],
    ['current documentation boundaries', 'check:docs'],
    ['Node and CI policy', 'check:node-ci-policy'],
    ['architecture ownership', 'check:architecture'],
    ['repository hygiene', 'check:repository-hygiene'],
    ['testing entry isolation', 'check:testing-isolation'],
    ['official Plugin compliance', 'check:official-plugins'],
    ['strict public type fixtures', 'test:types'],
    ['distribution build', 'build'],
    ['package runtime entries', 'test:package-entries'],
    ['package declaration consumers', 'test:package-types'],
    ['packed public entries', 'test:packed-entries'],
    ['package isolation', 'test:package-isolation'],
    ['package metadata lint', 'package:check'],
    ['package contents and private-path policy', 'check:npm-pack-contents'],
    ['public API snapshot', 'check:public-api'],
    ['live bundle isolation and platform budget', 'check:bundle-size'],
    ['public examples', 'check:examples'],
    ['dependency and repository security', 'check:security'],
    ['Chromium product behavior', 'test:e2e'],
    ['Full UMD policy and browser behavior', 'test:umd'],
    ['deterministic generated output', 'check:deterministic-build'],
]);

const releaseChecks = Object.freeze([
    ['source quality and Node product tests', 'check'],
    ['source module headers', 'check:source-quality'],
    ['current documentation boundaries', 'check:docs'],
    ['Node and CI policy', 'check:node-ci-policy'],
    ['architecture ownership', 'check:architecture'],
    ['repository hygiene', 'check:repository-hygiene'],
    ['testing entry isolation', 'check:testing-isolation'],
    ['official Plugin compliance', 'check:official-plugins'],
    ['strict public type fixtures', 'test:types'],
    ['distribution build', 'build'],
    ['package runtime entries', 'test:package-entries'],
    ['package declaration consumers', 'test:package-types'],
    ['packed public entries', 'test:packed-entries'],
    ['package isolation', 'test:package-isolation'],
    ['package metadata lint', 'package:check'],
    ['package contents and private-path policy', 'check:npm-pack-contents'],
    ['public API snapshot', 'check:public-api'],
    ['live bundle isolation and platform budget', 'check:bundle-size'],
    ['reference Plugin package consumers', 'test:reference-plugins'],
    ['Codemod declaration consumers', 'test:codemod-types'],
    ['Codemod packed consumers', 'test:codemod-package'],
    ['public examples', 'check:examples'],
    ['dependency and repository security', 'check:security'],
    ['cross-browser product behavior', 'test:e2e:all'],
    ['Chromium visual regression', 'test:visual'],
    ['Full UMD policy and browser behavior', 'test:umd'],
    ['deterministic generated output', 'check:deterministic-build'],
]);

function assertCondition(condition, message) {
    if (!condition) throw new Error(message);
}

async function readJson(filePath) {
    return JSON.parse(await readFile(filePath, 'utf8'));
}

async function collectNamedFiles(directory, names) {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        if (excludedDirectories.has(entry.name)) continue;
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) files.push(...(await collectNamedFiles(entryPath, names)));
        else if (entry.isFile() && names.has(entry.name)) files.push(entryPath);
    }
    return files.sort();
}

async function git(args) {
    const { stdout } = await execFileAsync('git', args, {
        cwd: repositoryRoot,
        encoding: 'utf8',
        maxBuffer: 8 * 1024 * 1024,
        windowsHide: true,
    });
    return stdout.trim();
}

async function assertCleanTree() {
    const status = await git(['status', '--porcelain=v1', '--untracked-files=all']);
    assertCondition(status.length === 0, `Working tree is not clean:\n${status}`);
}

async function validateLockfiles() {
    const lockfiles = await collectNamedFiles(repositoryRoot, new Set(['package-lock.json']));
    for (const lockfilePath of lockfiles) {
        const directory = path.dirname(lockfilePath);
        const manifestPath = path.join(directory, 'package.json');
        const [lockfile, manifest] = await Promise.all([
            readJson(lockfilePath),
            readJson(manifestPath),
        ]);
        const label = path.relative(repositoryRoot, lockfilePath).replaceAll('\\', '/');
        if (typeof manifest.version === 'string') {
            assertCondition(
                lockfile.version === manifest.version,
                `${label} version is not aligned.`,
            );
            assertCondition(
                lockfile.packages?.['']?.version === manifest.version,
                `${label} root package metadata is not aligned.`,
            );
        }

        for (const [packagePath, metadata] of Object.entries(lockfile.packages ?? {})) {
            if (!packagePath || packagePath.includes('node_modules') || !metadata.version) continue;
            const workspaceManifestPath = path.join(directory, packagePath, 'package.json');
            try {
                const workspaceManifest = await readJson(workspaceManifestPath);
                if (typeof workspaceManifest.version === 'string') {
                    assertCondition(
                        workspaceManifest.version === metadata.version,
                        `${label} metadata for ${packagePath} is not aligned.`,
                    );
                }
            } catch (error) {
                if (error?.code !== 'ENOENT') throw error;
            }
        }
    }
}

async function validatePeerRanges(version, fabricRange) {
    const roots = ['examples', 'packages', path.join('tests', 'package')];
    const manifests = (
        await Promise.all(
            roots.map((root) =>
                collectNamedFiles(path.join(repositoryRoot, root), new Set(['package.json'])),
            ),
        )
    ).flat();

    for (const manifestPath of manifests) {
        const manifest = await readJson(manifestPath);
        const label = path.relative(repositoryRoot, manifestPath).replaceAll('\\', '/');
        const imageEditorRange = manifest.peerDependencies?.['@bensitu/image-editor'];
        if (imageEditorRange !== undefined) {
            assertCondition(
                semver.validRange(imageEditorRange) !== null,
                `${label} has an invalid Image Editor peer range.`,
            );
            assertCondition(
                semver.satisfies(version, imageEditorRange, { includePrerelease: true }),
                `${label} does not accept Image Editor ${version}.`,
            );
        }
        if (manifest.peerDependencies?.fabric !== undefined) {
            assertCondition(
                manifest.peerDependencies.fabric === fabricRange,
                `${label} does not use the root Fabric peer range.`,
            );
        }
    }
}

async function validateVersionPolicy() {
    const [mainPackage, codemodPackage] = await Promise.all([
        readJson(path.join(repositoryRoot, 'package.json')),
        readJson(path.join(repositoryRoot, 'packages', 'image-editor-codemod', 'package.json')),
    ]);
    const version = mainPackage.version;
    assertCondition(
        semver.valid(version) !== null,
        `Package version ${String(version)} is invalid.`,
    );
    assertCondition(codemodPackage.version === version, 'Codemod package version is not aligned.');
    assertCondition(mainPackage.sideEffects === false, 'Main package must be side-effect free.');
    assertCondition(
        codemodPackage.sideEffects === false,
        'Codemod package must be side-effect free.',
    );
    assertCondition(
        semver.validRange(mainPackage.peerDependencies?.fabric) !== null,
        'The root Fabric peer range is invalid.',
    );

    await validateLockfiles();
    await validatePeerRanges(version, mainPackage.peerDependencies.fabric);
    return version;
}

async function validateReleasePreconditions() {
    await assertCleanTree();
    const version = await validateVersionPolicy();
    const tags = new Set(
        (await git(['tag', '--points-at', 'HEAD'])).split(/\r?\n/u).filter(Boolean),
    );
    assertCondition(
        !tags.has(version) && !tags.has(`v${version}`),
        `HEAD is already tagged for package version ${version}.`,
    );
    console.log(`Release preconditions passed for ${version}.`);
}

function runNpm(scriptName) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [npmCliPath, 'run', scriptName], {
            cwd: repositoryRoot,
            stdio: 'inherit',
            windowsHide: true,
        });
        child.on('error', reject);
        child.on('close', (code, signal) => {
            if (signal) reject(new Error(`${scriptName} terminated by ${signal}.`));
            else if (code === 0) resolve();
            else reject(new Error(`${scriptName} exited with code ${code}.`));
        });
    });
}

if (!npmCliPath) throw new Error('npm_execpath is unavailable; run through an npm script.');
assertCondition(['pr', 'release'].includes(profile), 'Use the pr or release profile.');
assertCondition(process.argv.length === 3, 'Gate profiles do not accept additional arguments.');

if (profile === 'release') await validateReleasePreconditions();

const checks = profile === 'pr' ? pullRequestChecks : releaseChecks;
for (const [index, [label, scriptName]] of checks.entries()) {
    console.log(`\n[${index + 1}/${checks.length}] ${label}`);
    await runNpm(scriptName);
}

if (profile === 'release') {
    await validateVersionPolicy();
    await assertCleanTree();
}
console.log(`${profile === 'pr' ? 'Pull-request' : 'Release'} gate passed.`);
