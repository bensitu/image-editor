/**
 * Verifies pinned workflow dependencies and protected npm publishing policy.
 *
 * @module
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as prettier from 'prettier';

import { LEGACY_DEMO_CDN_ASSETS } from '../config/docs/legacy-demo-security.mjs';
import { findUnsafeWorkflowRunInputs } from './workflow-input-policy.mjs';

const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptsRoot, '..');
const workflowsRoot = path.join(repositoryRoot, '.github', 'workflows');
const ACTION_LINE_PATTERN =
    /^\s*uses:\s*(?<action>[^\s#]+)(?:\s+#\s*(?<version>v\d+\.\d+\.\d+))?\s*$/u;
const FULL_SHA_PATTERN = /^[0-9a-f]{40}$/u;
const EXACT_NPM_VERSION = '11.5.1';

function assertCondition(condition, message) {
    if (!condition) throw new Error(message);
}

async function readRepositoryFile(relativePath) {
    return readFile(path.join(repositoryRoot, relativePath), 'utf8');
}

function parseDependabotUpdateBlocks(source) {
    const markers = [
        ...source.matchAll(/^ {4}- package-ecosystem: (?<ecosystem>[a-z][a-z-]*)\s*$/gmu),
    ];

    return markers.map((marker, index) => {
        const block = source.slice(marker.index, markers[index + 1]?.index ?? source.length);
        const directory = /^ {6}directory: (?<directory>\S+)\s*$/mu.exec(block)?.groups?.directory;
        assertCondition(
            directory,
            `Dependabot ${marker.groups?.ecosystem ?? 'unknown'} entry is missing a directory.`,
        );

        return {
            block,
            directory,
            ecosystem: marker.groups?.ecosystem,
        };
    });
}

function assertDependabotSchedule(block, label, openPullRequestsLimit) {
    for (const fragment of [
        'interval: weekly',
        'day: monday',
        'timezone: Asia/Tokyo',
        `open-pull-requests-limit: ${openPullRequestsLimit}`,
        'groups:',
    ]) {
        assertCondition(
            block.includes(fragment),
            `Dependabot ${label} configuration is missing: ${fragment}`,
        );
    }
}

const workflowEntries = await readdir(workflowsRoot, { withFileTypes: true });
const workflowPaths = workflowEntries
    .filter(
        (entry) => entry.isFile() && (entry.name.endsWith('.yml') || entry.name.endsWith('.yaml')),
    )
    .map((entry) => path.join(workflowsRoot, entry.name))
    .sort();

let pinnedActionCount = 0;
for (const workflowPath of workflowPaths) {
    const relativePath = path.relative(repositoryRoot, workflowPath).replaceAll('\\', '/');
    const source = await readFile(workflowPath, 'utf8');
    await prettier.format(source, { filepath: workflowPath });
    const unsafeInputs = findUnsafeWorkflowRunInputs(source);
    assertCondition(
        unsafeInputs.length === 0,
        `${relativePath} interpolates workflow input directly into run: ` +
            unsafeInputs.map(({ expression, line }) => `line ${line} (${expression})`).join(', '),
    );
    for (const [index, line] of source.split(/\r?\n/u).entries()) {
        if (!line.trimStart().startsWith('uses:')) continue;
        const match = ACTION_LINE_PATTERN.exec(line);
        assertCondition(match, `${relativePath}:${index + 1} has an invalid Action reference.`);
        const action = match.groups?.action;
        if (action?.startsWith('./') || action?.startsWith('docker://')) continue;
        const separatorIndex = action?.lastIndexOf('@') ?? -1;
        const reference = action?.slice(separatorIndex + 1) ?? '';
        assertCondition(
            separatorIndex > 0 && FULL_SHA_PATTERN.test(reference),
            `${relativePath}:${index + 1} must pin ${action ?? 'the Action'} to a full commit SHA.`,
        );
        assertCondition(
            match.groups?.version,
            `${relativePath}:${index + 1} must document the pinned Action release version.`,
        );
        pinnedActionCount += 1;
    }
}

const publishWorkflow = await readRepositoryFile('.github/workflows/publish-npm.yml');
assertCondition(
    publishWorkflow.includes(`npm install -g npm@${EXACT_NPM_VERSION}`),
    `The npm publish workflow must install exact npm ${EXACT_NPM_VERSION}.`,
);
assertCondition(
    !/npm install -g npm@[\^~*]/u.test(publishWorkflow),
    'The npm publish workflow must not install a floating npm CLI version.',
);
assertCondition(
    /environment:\s*\r?\n\s+name:\s*npm(?:\s|$)/u.test(publishWorkflow),
    'The npm publish job must use the protected npm environment.',
);
assertCondition(
    /^\s*id-token:\s*write\s*$/mu.test(publishWorkflow),
    'The npm publish workflow must retain id-token: write for trusted publishing.',
);

const pagesWorkflow = await readRepositoryFile('.github/workflows/deploy-pages.yml');
for (const fragment of [
    "- 'docs/**'",
    'run: npm run check:docs',
    'run: npm run package:pages',
    'path: .pages-site',
]) {
    assertCondition(
        pagesWorkflow.includes(fragment),
        `The Pages workflow is missing its reviewed documentation artifact policy: ${fragment}`,
    );
}
assertCondition(
    !pagesWorkflow.includes("- 'dist/**'") &&
        !pagesWorkflow.includes('run: npm run check:committed-dist'),
    'The CDN-backed Pages workflow must not depend on unused committed distribution assets.',
);

const packageManifestPaths = ['package.json', 'packages/image-editor-codemod/package.json'];
const [packageManifest, codemodPackageManifest] = await Promise.all(
    packageManifestPaths.map(async (manifestPath) =>
        JSON.parse(await readRepositoryFile(manifestPath)),
    ),
);
for (const [manifestPath, manifest] of [
    [packageManifestPaths[0], packageManifest],
    [packageManifestPaths[1], codemodPackageManifest],
]) {
    assertCondition(
        manifest.publishConfig?.access === 'public',
        `${manifestPath} must publish with public access.`,
    );
    assertCondition(
        manifest.publishConfig?.provenance === true,
        `${manifestPath} must require npm provenance.`,
    );
}
assertCondition(
    packageManifest.scripts?.['check:legacy-asset-integrity'] ===
        'node scripts/check-legacy-asset-integrity.mjs',
    'The verified Legacy asset integrity check must remain available.',
);
const legacyPage = await readRepositoryFile('docs/legacy-v1.html');
for (const asset of LEGACY_DEMO_CDN_ASSETS) {
    const urlIndex = legacyPage.indexOf(asset.url);
    const tagStart = legacyPage.lastIndexOf('<', urlIndex);
    const tagEnd = legacyPage.indexOf('>', urlIndex);
    const tag =
        urlIndex >= 0 && tagStart >= 0 && tagEnd > urlIndex
            ? legacyPage.slice(tagStart, tagEnd + 1)
            : '';
    assertCondition(
        tag.includes(`integrity="${asset.integrity}"`) && tag.includes('crossorigin="anonymous"'),
        `The Legacy demo is missing its pinned asset policy for ${asset.url}.`,
    );
}

const dependabotPath = '.github/dependabot.yml';
const dependabot = await readRepositoryFile(dependabotPath);
const dependabotFilePath = path.join(repositoryRoot, dependabotPath);
const dependabotFormatOptions = (await prettier.resolveConfig(dependabotFilePath)) ?? {};
const formattedDependabot = await prettier.format(dependabot, {
    ...dependabotFormatOptions,
    filepath: dependabotFilePath,
});
assertCondition(
    dependabot === formattedDependabot,
    'Dependabot configuration must be valid and formatted YAML.',
);
assertCondition(
    /^version: 2\s*$/mu.test(formattedDependabot),
    'Dependabot configuration must use version 2.',
);
assertCondition(
    !/^\s*ignore:\s*$/mu.test(formattedDependabot),
    'Dependabot configuration must not ignore dependency updates.',
);
assertCondition(
    !/\bauto-?merge\b/iu.test(formattedDependabot),
    'Dependabot configuration must not enable automatic merging.',
);

const dependabotUpdates = parseDependabotUpdateBlocks(formattedDependabot);
const expectedDependabotUpdates = new Map([
    ['github-actions:/', 5],
    ['npm:/', 10],
    ['npm:/examples/next-client-only', 5],
]);
assertCondition(
    dependabotUpdates.length === expectedDependabotUpdates.size,
    'Dependabot must contain only the GitHub Actions, root npm, and isolated Next example entries.',
);

const seenDependabotUpdates = new Set();
for (const update of dependabotUpdates) {
    const key = `${update.ecosystem}:${update.directory}`;
    assertCondition(
        expectedDependabotUpdates.has(key),
        `Dependabot contains an unexpected update entry: ${key}`,
    );
    assertCondition(
        !seenDependabotUpdates.has(key),
        `Dependabot contains a duplicate update entry: ${key}`,
    );
    seenDependabotUpdates.add(key);
    assertDependabotSchedule(update.block, key, expectedDependabotUpdates.get(key));
}
for (const key of expectedDependabotUpdates.keys()) {
    assertCondition(
        seenDependabotUpdates.has(key),
        `Dependabot is missing the required update entry: ${key}`,
    );
}

const rootNpmUpdate = dependabotUpdates.find(
    ({ directory, ecosystem }) => ecosystem === 'npm' && directory === '/',
);
for (const dependencyType of ['development', 'production']) {
    assertCondition(
        rootNpmUpdate?.block.includes(`dependency-type: ${dependencyType}`),
        `Dependabot root npm grouping must cover ${dependencyType} dependencies.`,
    );
}

const nextNpmUpdate = dependabotUpdates.find(
    ({ directory, ecosystem }) => ecosystem === 'npm' && directory === '/examples/next-client-only',
);
assertCondition(
    nextNpmUpdate?.block.includes("patterns:\n                  - '*'"),
    'Dependabot isolated Next example grouping must cover all dependencies.',
);

for (const update of dependabotUpdates.filter(({ ecosystem }) => ecosystem === 'npm')) {
    for (const updateType of ['minor', 'patch']) {
        assertCondition(
            update.block.includes(`- ${updateType}`),
            `Dependabot ${update.ecosystem}:${update.directory} grouping must include ${updateType} updates.`,
        );
    }
}

console.log(
    `Supply-chain policy passed (${workflowPaths.length} workflows, ` +
        `${pinnedActionCount} pinned external Action references).`,
);
