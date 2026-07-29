/**
 * Verifies the supported Node baseline and the required parallel CI surface.
 *
 * @module
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptsRoot, '..');
const REQUIRED_NODE_RANGE = '>=22.12.0';
const EXCLUDED_DIRECTORIES = new Set(['.next', 'dist', 'node_modules', 'out']);
const REQUIRED_PR_SCRIPTS = Object.freeze([
    'build',
    'test:package-entries',
    'test:package-types',
    'test:packed-entries',
    'test:package-isolation',
    'package:check',
    'check:npm-pack-contents',
    'check:public-api',
    'check:committed-dist',
    'check:security',
]);

function assertCondition(condition, message) {
    if (!condition) throw new Error(message);
}

async function readText(relativePath) {
    return readFile(path.join(repositoryRoot, relativePath), 'utf8');
}

async function readJson(relativePath) {
    return JSON.parse(await readText(relativePath));
}

const recommendedNodeVersion = (await readText('.nvmrc')).trim();
assertCondition(
    recommendedNodeVersion === '24',
    '.nvmrc must select the recommended local and release Node version 24.',
);
try {
    await readText('.node-version');
    throw new Error('.node-version must not conflict with the canonical .nvmrc.');
} catch (error) {
    if (error?.code !== 'ENOENT') throw error;
}

async function collectPackageManifests(relativeDirectory) {
    const directory = path.join(repositoryRoot, relativeDirectory);
    const entries = await readdir(directory, { withFileTypes: true });
    const manifests = [];
    for (const entry of entries) {
        if (EXCLUDED_DIRECTORIES.has(entry.name)) continue;
        const relativePath = path.join(relativeDirectory, entry.name);
        if (entry.isDirectory()) {
            manifests.push(...(await collectPackageManifests(relativePath)));
        } else if (entry.isFile() && entry.name === 'package.json') {
            manifests.push(relativePath);
        }
    }
    return manifests;
}

const manifestPaths = [
    'package.json',
    ...(await collectPackageManifests('examples')),
    ...(await collectPackageManifests('packages')),
].sort();

for (const manifestPath of manifestPaths) {
    const manifest = await readJson(manifestPath);
    assertCondition(
        manifest.engines?.node === REQUIRED_NODE_RANGE,
        `${manifestPath.replaceAll('\\', '/')} must declare engines.node ${REQUIRED_NODE_RANGE}.`,
    );
}

for (const manifestPath of ['package.json', 'examples/next-client-only/package.json']) {
    const manifest = await readJson(manifestPath);
    assertCondition(
        manifest.devDependencies?.['@types/node'] === '^22.0.0',
        `${manifestPath} must compile against the minimum supported Node major.`,
    );
}

for (const lockfilePath of ['package-lock.json', 'examples/next-client-only/package-lock.json']) {
    const lockfile = await readJson(lockfilePath);
    assertCondition(
        lockfile.packages?.['']?.engines?.node === REQUIRED_NODE_RANGE,
        `${lockfilePath} root metadata is not aligned with ${REQUIRED_NODE_RANGE}.`,
    );
    assertCondition(
        lockfile.packages?.['']?.devDependencies?.['@types/node'] === '^22.0.0',
        `${lockfilePath} does not lock the minimum supported Node type major.`,
    );
}

const ciWorkflow = await readText('.github/workflows/ci.yml');
for (const fragment of [
    "node-version: '22.12.0'",
    "node-version: '24.x'",
    'minimum-node:',
    'source-gate:',
    'package-gate:',
    'chromium-gate:',
    'pull-request-gate:',
    'npm run test:package-entries',
    'npm run test:package-types',
    'npm run test:packed-entries',
    'npm run test:package-isolation',
    'npm run package:check',
    'npm run check:npm-pack-contents',
    'npm run check:public-api',
    'npm run check:committed-dist -- --skip-build',
    'npm run check:security',
    'npm run test:e2e',
    'npm run check:supply-chain-policy',
]) {
    assertCondition(
        ciWorkflow.includes(fragment),
        `CI workflow is missing required fragment: ${fragment}`,
    );
}
assertCondition(
    !/node-version:\s*['"]?(?:20|26)(?:\.x)?['"]?/u.test(ciWorkflow),
    'CI must use only the supported Node 22.12 minimum and Node 24 full-gate runtimes.',
);

const draftReleaseWorkflow = await readText('.github/workflows/draft-release.yml');
assertCondition(
    draftReleaseWorkflow.includes("node-version: '22.12.0'") &&
        draftReleaseWorkflow.includes("node-version: '24.x'"),
    'Draft release workflow must verify Node 22.12 and run the full release gate on Node 24.',
);

const gateRunner = await readText('scripts/check-gates.mjs');
for (const scriptName of REQUIRED_PR_SCRIPTS) {
    assertCondition(
        gateRunner.includes(`'${scriptName}'`),
        `Pull-request gate is missing the ${scriptName} package-surface check.`,
    );
}

const readme = await readText('README.md');
assertCondition(
    readme.includes('Recommended local/release Node: 24') &&
        readme.includes('Minimum supported Node: 22.12.0'),
    'README must distinguish the recommended and minimum supported Node versions.',
);
const contributingGuide = await readText('docs/contributing.md');
assertCondition(
    contributingGuide.includes('Recommended local/release Node: 24') &&
        contributingGuide.includes('Minimum supported Node: 22.12.0'),
    'The contributing guide must distinguish the recommended and minimum Node versions.',
);

console.log(
    `Node and CI policy passed (${manifestPaths.length} manifests, ${REQUIRED_PR_SCRIPTS.length} required package checks).`,
);
