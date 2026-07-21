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
const credentialPattern =
    /-----BEGIN (?:EC |OPENSSH |RSA )?PRIVATE KEY-----|\b(?:ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|sk-(?:live|proj)-[A-Za-z0-9_-]{20,})\b/u;

if (!npmCliPath) throw new Error('npm_execpath is unavailable; run through an npm script.');

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
            if (credentialPattern.test(await readFile(path.join(repositoryRoot, file), 'utf8'))) {
                exposed.push(file);
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
    `Security policy passed (${trackedFiles} tracked files; ${auditSummaries.join('; ')}).`,
);
