/**
 * Runs focused hostile-input, resource-limit, and distributable security checks.
 *
 * @module
 */

import { execFile } from 'node:child_process';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptsRoot, '..');
const npmCliPath = process.env.npm_execpath;
const securityTests = [
    'tests/core/snapshot-hardening.test.mjs',
    'tests/core/state-extension-registry.test.mjs',
    'tests/core/error-and-port-hardening.test.mjs',
    'tests/migrate-v2/migrate-v2.test.mjs',
    'tests/number-utils.property.test.mjs',
    'tests/plugins/mask/mask-plugin.test.mjs',
    'tests/plugins/overlay-state/overlay-state.test.mjs',
    'tests/sdk/permissions-and-codecs.test.mjs',
    'tests/safe-object-key.test.mjs',
    'tests/codemod/codemod.test.mjs',
];
const auditRoots = [
    ['root workspace', repositoryRoot],
    ['isolated Next.js example', path.join(repositoryRoot, 'examples', 'next-client-only')],
];

if (!npmCliPath) throw new Error('npm_execpath is unavailable; run through an npm script.');

async function assertSecurityTestsExist() {
    const missing = [];
    for (const relativePath of securityTests) {
        try {
            if (!(await stat(path.join(repositoryRoot, relativePath))).isFile()) {
                missing.push(relativePath);
            }
        } catch {
            missing.push(relativePath);
        }
    }
    if (missing.length > 0) {
        throw new Error(`Security test manifest contains missing files:\n${missing.join('\n')}`);
    }
}

async function run(command, args) {
    const result = await execFileAsync(command, args, {
        cwd: repositoryRoot,
        encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024,
        windowsHide: true,
    });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
}

async function readAudit(auditRoot) {
    try {
        const { stdout } = await execFileAsync(process.execPath, [npmCliPath, 'audit', '--json'], {
            cwd: auditRoot,
            encoding: 'utf8',
            maxBuffer: 32 * 1024 * 1024,
            windowsHide: true,
        });
        return JSON.parse(stdout);
    } catch (error) {
        if (typeof error.stdout === 'string' && error.stdout.trim().startsWith('{')) {
            return JSON.parse(error.stdout);
        }
        throw error;
    }
}

await assertSecurityTestsExist();
await run(process.execPath, [npmCliPath, 'run', 'build:codemod']);
await run(process.execPath, [
    '--import',
    './tests/helpers/register-ts-loader.mjs',
    '--test',
    ...securityTests,
]);
await run(process.execPath, [npmCliPath, 'run', 'check:npm-pack-contents']);

const auditSummaries = [];
for (const [label, auditRoot] of auditRoots) {
    const audit = await readAudit(auditRoot);
    const summary = audit.metadata?.vulnerabilities;
    if (!summary) throw new Error(`npm audit returned no vulnerability summary for ${label}.`);
    if ((summary.high ?? 0) > 0 || (summary.critical ?? 0) > 0) {
        throw new Error(
            `${label} npm audit reports ${summary.high ?? 0} high and ${summary.critical ?? 0} critical vulnerabilities.`,
        );
    }
    auditSummaries.push(
        `${label}: ${summary.low ?? 0} low, ${summary.moderate ?? 0} moderate, 0 high, 0 critical`,
    );
}

console.log(
    `Security check passed (${securityTests.length} focused fixtures; audit: ${auditSummaries.join('; ')}).`,
);
