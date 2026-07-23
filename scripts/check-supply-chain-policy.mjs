/**
 * Verifies pinned workflow dependencies and protected npm publishing policy.
 *
 * @module
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

const workflowEntries = await readdir(workflowsRoot, { withFileTypes: true });
const workflowPaths = workflowEntries
    .filter(
        (entry) =>
            entry.isFile() && (entry.name.endsWith('.yml') || entry.name.endsWith('.yaml')),
    )
    .map((entry) => path.join(workflowsRoot, entry.name))
    .sort();

let pinnedActionCount = 0;
for (const workflowPath of workflowPaths) {
    const relativePath = path.relative(repositoryRoot, workflowPath).replaceAll('\\', '/');
    const source = await readFile(workflowPath, 'utf8');
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

const dependabot = await readRepositoryFile('.github/dependabot.yml');
for (const fragment of [
    'version: 2',
    'package-ecosystem: github-actions',
    'directory: /',
    'interval: weekly',
]) {
    assertCondition(
        dependabot.includes(fragment),
        `Dependabot GitHub Actions configuration is missing: ${fragment}`,
    );
}

console.log(
    `Supply-chain policy passed (${workflowPaths.length} workflows, ` +
        `${pinnedActionCount} pinned external Action references).`,
);
