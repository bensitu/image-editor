/**
 * Audits dependencies and rejects tracked credential or private-key material.
 *
 * @module
 */

import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { findCredentialKinds } from './credential-policy.mjs';

const execFileAsync = promisify(execFile);
const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptsRoot, '..');
const npmCliPath = process.env.npm_execpath;
const auditRoots = Object.freeze([
    ['root workspace', repositoryRoot],
    ['isolated Next.js example', path.join(repositoryRoot, 'examples', 'next-client-only')],
]);
const textExtensions = new Set([
    '.cjs',
    '.css',
    '.html',
    '.js',
    '.json',
    '.md',
    '.mjs',
    '.ts',
    '.tsx',
    '.vue',
    '.yaml',
    '.yml',
]);
if (!npmCliPath) throw new Error('npm_execpath is unavailable; run through an npm script.');

async function readAudit(auditRoot, additionalArguments = []) {
    try {
        const { stdout } = await execFileAsync(
            process.execPath,
            [npmCliPath, 'audit', '--json', ...additionalArguments],
            {
                cwd: auditRoot,
                encoding: 'utf8',
                maxBuffer: 32 * 1024 * 1024,
                windowsHide: true,
            },
        );
        return JSON.parse(stdout);
    } catch (error) {
        if (typeof error.stdout === 'string' && error.stdout.trim().startsWith('{')) {
            return JSON.parse(error.stdout);
        }
        throw error;
    }
}

async function checkTrackedFiles() {
    const { stdout } = await execFileAsync('git', ['ls-files', '-z'], {
        cwd: repositoryRoot,
        encoding: 'utf8',
        maxBuffer: 16 * 1024 * 1024,
        windowsHide: true,
    });
    const files = stdout.split('\0').filter(Boolean);
    const privatePaths = files.filter((file) =>
        /(?:^|\/)(?:\.env(?:\..*)?|credentials?(?:\..*)?|id_(?:ed25519|rsa)|.*\.(?:key|pem))(?:$|\/)/iu.test(
            file.replaceAll('\\', '/'),
        ),
    );
    if (privatePaths.length > 0) {
        throw new Error(`Private credential paths are tracked:\n${privatePaths.join('\n')}`);
    }

    const exposed = [];
    for (const file of files) {
        if (!textExtensions.has(path.extname(file).toLowerCase()) || file.startsWith('dist/')) {
            continue;
        }
        try {
            const kinds = findCredentialKinds(
                await readFile(path.join(repositoryRoot, file), 'utf8'),
            );
            if (kinds.length > 0) {
                exposed.push(`${file} (${kinds.join(', ')})`);
            }
        } catch (error) {
            if (error?.code !== 'ENOENT') throw error;
        }
    }
    if (exposed.length > 0) {
        throw new Error(`Potential credentials are tracked:\n${exposed.join('\n')}`);
    }
    return files.length;
}

const trackedFiles = await checkTrackedFiles();
const auditSummaries = [];
for (const [label, auditRoot] of auditRoots) {
    const [productionAudit, fullAudit] = await Promise.all([
        readAudit(auditRoot, ['--omit=dev']),
        readAudit(auditRoot),
    ]);
    const production = productionAudit.metadata?.vulnerabilities;
    const full = fullAudit.metadata?.vulnerabilities;
    if (!production || !full) {
        throw new Error(`npm audit returned no vulnerability summary for ${label}.`);
    }
    if (
        (production.moderate ?? 0) > 0 ||
        (production.high ?? 0) > 0 ||
        (production.critical ?? 0) > 0
    ) {
        throw new Error(
            `${label} production audit reports ${production.moderate ?? 0} moderate, ` +
                `${production.high ?? 0} high, and ${production.critical ?? 0} critical vulnerabilities.`,
        );
    }
    if ((full.high ?? 0) > 0 || (full.critical ?? 0) > 0) {
        throw new Error(
            `${label} full audit reports ${full.high ?? 0} high and ` +
                `${full.critical ?? 0} critical vulnerabilities.`,
        );
    }
    auditSummaries.push(
        `${label}: production has 0 moderate/high/critical; full tree has ` +
            `${full.low ?? 0} low, ${full.moderate ?? 0} moderate, 0 high, 0 critical`,
    );
}

console.log(
    `Security policy passed (${trackedFiles} tracked files; ${auditSummaries.join('; ')}).`,
);
