/**
 * Verifies durable repository, test, and package-content boundaries.
 *
 * @module
 */

import { execFile } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptsRoot, '..');
const requiredDocuments = Object.freeze([
    'CHANGELOG.md',
    'LICENSE',
    'README.md',
    'docs/contributing.md',
    'docs/rules/comment-rules.md',
    'docs/rules/naming-rules.md',
]);
const allowedPackageFiles = new Set([
    '!dist/esm/umd',
    'CHANGELOG.md',
    'LICENSE',
    'README.md',
    'dist',
]);

function assertCondition(condition, message) {
    if (!condition) throw new Error(message);
}

async function git(args, options = {}) {
    return execFileAsync('git', args, {
        cwd: repositoryRoot,
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
        windowsHide: true,
        ...options,
    });
}

const { stdout } = await git(['ls-files', '-z']);
const tracked = [];
for (const file of stdout.split('\0').filter(Boolean)) {
    const normalized = file.replaceAll('\\', '/');
    try {
        await access(path.join(repositoryRoot, normalized));
        tracked.push(normalized);
    } catch {
        // A file removed by the reviewed change is outside the resulting repository policy.
    }
}
const trackedSet = new Set(tracked);

const forbiddenTracked = tracked.filter(
    (file) =>
        file.startsWith('.internal/') ||
        file.startsWith('docs/refactor/') ||
        /(?:^|\/)(?:codex[-_].*prompt|.*implementation[-_]report|stage[-_ ]?\d+.*(?:gate|report|result)|.*release[-_]candidate.*(?:evidence|manifest|provenance)|provenance\.json|.*\.tgz)$/iu.test(
            file,
        ),
);
assertCondition(
    forbiddenTracked.length === 0,
    `Private or generated evidence is tracked: ${forbiddenTracked.join(', ')}.`,
);

for (const probe of ['.internal/probe.json', 'docs/refactor/probe.md']) {
    try {
        await git(['check-ignore', '-q', probe]);
    } catch {
        throw new Error(`${probe} must remain ignored.`);
    }
}

const missingDocuments = requiredDocuments.filter((file) => !trackedSet.has(file));
assertCondition(
    missingDocuments.length === 0,
    `Required public documents are not tracked: ${missingDocuments.join(', ')}.`,
);

const packageJson = JSON.parse(await readFile(path.join(repositoryRoot, 'package.json'), 'utf8'));
const packageFiles = packageJson.files ?? [];
const unexpectedPackageFiles = packageFiles.filter((file) => !allowedPackageFiles.has(file));
assertCondition(
    unexpectedPackageFiles.length === 0,
    `package.json files includes non-distribution paths: ${unexpectedPackageFiles.join(', ')}.`,
);
for (const required of allowedPackageFiles) {
    assertCondition(packageFiles.includes(required), `package.json files is missing ${required}.`);
}

const tests = tracked.filter((file) => /(?:^|\/)tests\/.*\.test\.mjs$/u.test(`/${file}`));
const prohibitedTests = tests.filter((file) =>
    /(?:^|\/)(?:demo-page|implementation[-_ ]report|release[-_ ]gate|stage[-_ ]?\d+.*)\.test\.mjs$/iu.test(
        file,
    ),
);
assertCondition(
    prohibitedTests.length === 0,
    `Tests with temporary project responsibilities remain: ${prohibitedTests.join(', ')}.`,
);

const helpers = tracked.filter((file) => /^tests\/helpers\/.*\.mjs$/u.test(file));
const searchable = tracked.filter(
    (file) => /\.(?:[cm]?js|ts|tsx|vue)$/u.test(file) && !file.startsWith('dist/'),
);
const sourceByFile = new Map();
for (const file of searchable) {
    sourceByFile.set(file, await readFile(path.join(repositoryRoot, file), 'utf8'));
}
const unusedHelpers = helpers.filter((helper) => {
    const relativeFromTests = helper.slice('tests/'.length);
    const basename = path.posix.basename(helper);
    return ![...sourceByFile.entries()].some(
        ([file, source]) =>
            file !== helper && (source.includes(relativeFromTests) || source.includes(basename)),
    );
});
assertCondition(
    unusedHelpers.length === 0,
    `Tracked test helpers have no consumer: ${unusedHelpers.join(', ')}.`,
);

console.log(
    `Repository hygiene passed (${tracked.length} tracked files, ${tests.length} product tests).`,
);
