/**
 * Verifies that tracked and packed documentation stays within the public repository boundary.
 *
 * @module
 */

import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptsDirectory, '..');
const policyPath = path.join(repositoryRoot, 'config', 'repository', 'documentation-boundary.json');
const allowedBoundaryReferences = new Set([
    '.gitignore',
    'config/repository/documentation-boundary.json',
    'scripts/check-reference-plugins.mjs',
    'scripts/check-repository-docs.mjs',
]);

function runGit(args) {
    return execFileSync('git', args, {
        cwd: repositoryRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
}

function trackedPaths() {
    return runGit(['ls-files', '-z'])
        .split('\0')
        .filter(Boolean)
        .map((filePath) => filePath.replaceAll('\\', '/'));
}

function npmCliPath() {
    return (
        process.env.npm_execpath ??
        path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
    );
}

function packedPaths() {
    const output = execFileSync(process.execPath, [npmCliPath(), 'pack', '--dry-run', '--json'], {
        cwd: repositoryRoot,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    const records = JSON.parse(output);
    return (records[0]?.files ?? []).map((entry) => entry.path.replaceAll('\\', '/'));
}

function isExecutableReferencePath(filePath) {
    return (
        filePath === 'package.json' ||
        ['scripts/', 'tests/', 'src/', 'config/', '.github/'].some((prefix) =>
            filePath.startsWith(prefix),
        )
    );
}

async function findBrokenBoundaryReferences(paths) {
    const references = [];
    for (const filePath of paths) {
        if (
            !isExecutableReferencePath(filePath) ||
            allowedBoundaryReferences.has(filePath) ||
            !/\.(?:c?js|mjs|json|ts|tsx|ya?ml)$/u.test(filePath)
        ) {
            continue;
        }
        const content = await readFile(path.join(repositoryRoot, filePath), 'utf8');
        if (content.includes('docs/refactor')) references.push(filePath);
    }
    return references;
}

async function verifyBoundary() {
    const policy = JSON.parse(await readFile(policyPath, 'utf8'));
    const tracked = trackedPaths();
    const trackedSet = new Set(tracked);
    const packed = packedPaths();
    const brokenPolicyReferences = await findBrokenBoundaryReferences(tracked);
    const trackedInternalDocuments = tracked.filter((filePath) =>
        policy.forbiddenTrackedPrefixes.some((prefix) => filePath.startsWith(prefix)),
    );
    const trackedPrivatePrompts = tracked.filter((filePath) =>
        /(?:^|\/)(?:codex[-_].*prompt|.*implementation-report|.*readiness-decision|.*salvage-plan)(?:\.|\/|$)/iu.test(
            filePath,
        ),
    );
    const packedInternalDocuments = packed.filter((filePath) =>
        policy.forbiddenPackedPrefixes.some((prefix) => filePath.startsWith(prefix)),
    );
    const missingPublicDocuments = policy.requiredTrackedDocuments.filter(
        (filePath) => !trackedSet.has(filePath),
    );
    const missingMachinePolicies = policy.requiredMachinePolicies.filter(
        (filePath) => !trackedSet.has(filePath),
    );
    for (const probePath of [
        '.internal/implementation/probe.json',
        '.internal/release-candidate/probe.json',
    ]) {
        execFileSync('git', ['check-ignore', '-q', probePath], {
            cwd: repositoryRoot,
            stdio: 'ignore',
        });
    }

    const result = {
        schemaVersion: 1,
        result:
            trackedInternalDocuments.length === 0 &&
            trackedPrivatePrompts.length === 0 &&
            packedInternalDocuments.length === 0 &&
            brokenPolicyReferences.length === 0 &&
            missingPublicDocuments.length === 0 &&
            missingMachinePolicies.length === 0
                ? 'PASS'
                : 'FAIL',
        trackedInternalDocuments: trackedInternalDocuments.length,
        trackedPrivatePrompts: trackedPrivatePrompts.length,
        packedInternalDocuments: packedInternalDocuments.length,
        brokenPolicyReferences: brokenPolicyReferences.length,
        rulesTracked: policy.requiredRuleDocuments.every((filePath) => trackedSet.has(filePath)),
        missingPublicDocuments,
        missingMachinePolicies,
        diagnostics: {
            trackedInternalDocuments,
            trackedPrivatePrompts,
            packedInternalDocuments,
            brokenPolicyReferences,
        },
    };
    if (!result.rulesTracked) result.result = 'FAIL';
    return result;
}

async function main() {
    const mode = process.argv[2] ?? '--check';
    if (!['--check', '--json'].includes(mode) || process.argv.length > 3) {
        throw new Error('Use --check or --json.');
    }
    const result = await verifyBoundary();
    if (mode === '--json') console.log(JSON.stringify(result, null, 4));
    else {
        console.log(
            `Repository documentation boundary ${result.result}: ` +
                `${result.trackedInternalDocuments} tracked internal, ` +
                `${result.packedInternalDocuments} packed internal, ` +
                `${result.brokenPolicyReferences} broken policy reference(s).`,
        );
    }
    if (result.result !== 'PASS') process.exitCode = 1;
}

await main();
