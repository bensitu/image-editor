/**
 * Verifies a local candidate across source, distribution, browser, and policy contracts.
 *
 * @module
 */

import { spawn } from 'node:child_process';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptsRoot, '..');
const npmCliPath = process.env.npm_execpath;
const mode = process.argv[2] === '--engineering' ? 'engineering' : 'candidate';

if (!npmCliPath) throw new Error('npm_execpath is unavailable; run through an npm script.');
if (process.argv.length > (mode === 'engineering' ? 3 : 2)) {
    throw new Error('Use check:release without arguments.');
}

const engineeringChecks = [
    ['source quality and Node product tests', 'check'],
    ['architecture ownership', 'check:architecture'],
    ['repository documentation boundary', 'check:repository-docs'],
    ['source language policy', 'check:source-language'],
    ['tracked test scope', 'check:test-scope'],
    ['testing entry isolation', 'check:testing-isolation'],
    ['official Plugin compliance', 'check:official-plugins'],
    ['strict public type fixtures', 'test:types'],
    ['deterministic generated output', 'check:deterministic-build'],
    ['package runtime entries', 'test:package-entries'],
    ['package declaration consumers', 'test:package-types'],
    ['packed public entries', 'test:packed-entries'],
    ['public API snapshot', 'check:public-api'],
    ['package isolation', 'test:package-isolation'],
    ['package metadata lint', 'package:check'],
    ['package contents and private-path policy', 'check:npm-pack-contents'],
    ['platform bundle measurement', 'check:bundle:measurement'],
    ['bundle provenance', 'check:bundle:provenance'],
    ['platform budget and headroom', 'check:platform-budget'],
    ['public bundle isolation', 'check:public-bundle-isolation'],
    ['Full UMD budget', 'check:full-umd'],
];

const candidateOnlyChecks = [
    ['Plugin lint distribution contract', 'check:plugin-lint'],
    ['reference Plugin package boundaries', 'check:reference-plugin-boundaries'],
    ['reference Plugin consumers', 'test:reference-plugins'],
    ['Snapshot migration', 'test:migration'],
    ['Codemod transformations and types', 'test:codemod'],
    ['Codemod packed consumers', 'test:codemod-package'],
    ['all bundle fixtures', 'check:bundle-size'],
    ['public framework examples', 'check:examples'],
    ['Fabric comparison proof', 'check:comparison'],
    ['runtime performance and memory', 'check:performance'],
    ['hostile input and dependency security', 'check:security'],
    ['cross-browser product behavior', 'test:e2e:all'],
    ['visual regression', 'test:visual'],
    ['Full UMD runtime and browser behavior', 'test:umd'],
];

function assertCondition(condition, message) {
    if (!condition) throw new Error(message);
}

async function readJson(relativePath) {
    return JSON.parse(await readFile(path.join(repositoryRoot, relativePath), 'utf8'));
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

async function validateVersionAlignment(candidateRequired) {
    const [mainPackage, codemodPackage, lockfile] = await Promise.all([
        readJson('package.json'),
        readJson('packages/image-editor-codemod/package.json'),
        readJson('package-lock.json'),
    ]);
    const version = mainPackage.version;
    assertCondition(
        typeof version === 'string' &&
            (!candidateRequired || /^3\.0\.0-rc\.[1-9]\d*$/u.test(version)),
        `Package version ${String(version)} is not a 3.0.0 release candidate.`,
    );
    assertCondition(codemodPackage.version === version, 'Codemod package version is not aligned.');
    assertCondition(lockfile.version === version, 'Root lockfile version is not aligned.');
    assertCondition(
        lockfile.packages?.['']?.version === version,
        'Root lockfile package metadata is not aligned.',
    );
    assertCondition(
        lockfile.packages?.['packages/image-editor-codemod']?.version === version,
        'Codemod lockfile package metadata is not aligned.',
    );
    assertCondition(
        mainPackage.peerDependencies?.fabric === '>=7.4.0 <8',
        'Main Fabric peer range changed.',
    );
    assertCondition(mainPackage.sideEffects === false, 'Main package sideEffects policy changed.');

    if (candidateRequired) {
        const peerManifests = [
            'examples/plugin-template/package.json',
            'examples/reference-plugins/watermark/package.json',
            'examples/reference-plugins/metadata/package.json',
            'examples/reference-plugins/grid-guide/package.json',
            'examples/reference-plugins/blur-region/package.json',
            'tests/package/external-plugin/package.json',
        ];
        for (const manifestPath of peerManifests) {
            const manifest = await readJson(manifestPath);
            assertCondition(
                manifest.peerDependencies?.['@bensitu/image-editor'] === '^3.0.0-0',
                `${manifestPath} does not accept the candidate package.`,
            );
            assertCondition(
                manifest.peerDependencies?.fabric === '>=7.4.0 <8',
                `${manifestPath} changed the Fabric peer range.`,
            );
        }
        const [coreManifest, overlayStateTypes] = await Promise.all([
            readFile(
                path.join(repositoryRoot, 'src', 'plugin-kernel', 'plugin-manifest.ts'),
                'utf8',
            ),
            readFile(
                path.join(
                    repositoryRoot,
                    'src',
                    'plugins',
                    'overlay-state',
                    'overlay-state-types.ts',
                ),
                'utf8',
            ),
        ]);
        assertCondition(
            /CORE_API_VERSION\s*=\s*'3\.0\.0'/u.test(coreManifest),
            'Core API version must remain independent at 3.0.0.',
        );
        assertCondition(
            /OVERLAY_STATE_WIRE_VERSION\s*=\s*1/u.test(overlayStateTypes),
            'Overlay State wire version must remain independent at 1.',
        );
    }
    return version;
}

async function validateCandidatePreconditions() {
    await assertCleanTree();
    const branch = await git(['branch', '--show-current']);
    assertCondition(
        branch === 'develop' || branch === 'main' || /^release\//u.test(branch),
        `Branch ${branch || '(detached)'} is not allowed for a candidate check.`,
    );
    const tags = await git(['tag', '--points-at', 'HEAD']);
    assertCondition(tags.length === 0, `Candidate commit already has tags: ${tags}.`);
    const version = await validateVersionAlignment(true);
    console.log(`Candidate preconditions passed (${version} on ${branch}).`);
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

if (mode === 'candidate') await validateCandidatePreconditions();
else await validateVersionAlignment(false);

const checks =
    mode === 'candidate' ? [...engineeringChecks, ...candidateOnlyChecks] : engineeringChecks;
for (let index = 0; index < checks.length; index += 1) {
    const [label, scriptName] = checks[index];
    console.log(`\n[${index + 1}/${checks.length}] ${label}`);
    await runNpm(scriptName);
}

if (mode === 'candidate') {
    await validateVersionAlignment(true);
    await assertCleanTree();
    console.log('Candidate release check passed with a clean working tree.');
} else {
    console.log('Engineering release-readiness checks passed.');
}
