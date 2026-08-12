/**
 * Compares generated distribution files with the exact blobs recorded in the Git index.
 *
 * @module
 */

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const DIST_ROOTS = Object.freeze(['dist', 'packages/image-editor-codemod/dist']);
const MAX_GIT_OUTPUT_BYTES = 32 * 1024 * 1024;

function normalizePath(filePath) {
    return filePath.replaceAll('\\', '/');
}

async function gitText(repositoryRoot, args) {
    const { stdout } = await execFileAsync('git', args, {
        cwd: repositoryRoot,
        encoding: 'utf8',
        maxBuffer: MAX_GIT_OUTPUT_BYTES,
        windowsHide: true,
    });
    return stdout;
}

function gitBlob(repositoryRoot, objectId) {
    return new Promise((resolve, reject) => {
        execFile(
            'git',
            ['cat-file', 'blob', objectId],
            {
                cwd: repositoryRoot,
                encoding: null,
                maxBuffer: MAX_GIT_OUTPUT_BYTES,
                windowsHide: true,
            },
            (error, stdout) => {
                if (error) reject(error);
                else resolve(stdout);
            },
        );
    });
}

async function collectFiles(directory) {
    let entries;
    try {
        entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
        if (error?.code === 'ENOENT') return [];
        throw error;
    }

    const files = [];
    for (const entry of entries) {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...(await collectFiles(entryPath)));
        } else if (entry.isFile()) {
            files.push(entryPath);
        } else {
            throw new Error(`Distribution output must contain only files: ${entryPath}`);
        }
    }
    return files.sort();
}

function parseIndexEntries(source) {
    const entries = new Map();
    for (const record of source.split('\0').filter(Boolean)) {
        const match =
            /^(?<mode>\d+) (?<objectId>[0-9a-f]+) (?<stage>\d+)\t(?<filePath>[\s\S]+)$/u.exec(
                record,
            );
        if (!match?.groups) throw new Error(`Unable to parse Git index entry: ${record}`);
        if (match.groups.stage !== '0') {
            throw new Error(`Unmerged distribution path: ${match.groups.filePath}`);
        }
        entries.set(normalizePath(match.groups.filePath), {
            mode: match.groups.mode,
            objectId: match.groups.objectId,
        });
    }
    return entries;
}

function hashBytes(bytes, algorithm) {
    return createHash(algorithm).update(bytes).digest('hex');
}

function hashGitBlob(bytes, objectFormat) {
    return createHash(objectFormat).update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
}

async function mapWithConcurrency(values, concurrency, callback) {
    const results = new Array(values.length);
    let nextIndex = 0;

    async function worker() {
        while (nextIndex < values.length) {
            const index = nextIndex;
            nextIndex += 1;
            results[index] = await callback(values[index], index);
        }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, () => worker()));
    return results;
}

export async function inspectCommittedDist(repositoryRoot) {
    const absoluteRoot = path.resolve(repositoryRoot);
    const [indexSource, objectFormat, generatedRoots] = await Promise.all([
        gitText(absoluteRoot, ['ls-files', '--stage', '-z', '--', ...DIST_ROOTS]),
        gitText(absoluteRoot, ['rev-parse', '--show-object-format']),
        Promise.all(DIST_ROOTS.map((root) => collectFiles(path.join(absoluteRoot, root)))),
    ]);
    const generatedPaths = generatedRoots.flat();
    const normalizedObjectFormat = objectFormat.trim();
    if (!['sha1', 'sha256'].includes(normalizedObjectFormat)) {
        throw new Error(`Unsupported Git object format: ${normalizedObjectFormat}`);
    }

    const indexEntries = parseIndexEntries(indexSource);
    const generatedEntries = new Map(
        await Promise.all(
            generatedPaths.map(async (filePath) => {
                const bytes = await readFile(filePath);
                const relativePath = normalizePath(path.relative(absoluteRoot, filePath));
                return [
                    relativePath,
                    {
                        bytes: bytes.length,
                        objectId: hashGitBlob(bytes, normalizedObjectFormat),
                        sha256: hashBytes(bytes, 'sha256'),
                    },
                ];
            }),
        ),
    );

    const trackedPaths = [...indexEntries.keys()].sort();
    const generatedRelativePaths = [...generatedEntries.keys()].sort();
    const missingFiles = trackedPaths.filter((filePath) => !generatedEntries.has(filePath));
    const newFiles = generatedRelativePaths
        .filter((filePath) => !indexEntries.has(filePath))
        .map((filePath) =>
            Object.freeze({
                filePath,
                ...generatedEntries.get(filePath),
            }),
        );
    const changedPaths = trackedPaths.filter((filePath) => {
        const generated = generatedEntries.get(filePath);
        return generated && generated.objectId !== indexEntries.get(filePath).objectId;
    });
    const contentMismatches = await mapWithConcurrency(changedPaths, 8, async (filePath) => {
        const expected = await gitBlob(absoluteRoot, indexEntries.get(filePath).objectId);
        const generated = generatedEntries.get(filePath);
        return Object.freeze({
            filePath,
            committedBytes: expected.length,
            committedSha256: hashBytes(expected, 'sha256'),
            generatedBytes: generated.bytes,
            generatedSha256: generated.sha256,
        });
    });
    const totalBytes = [...generatedEntries.values()].reduce(
        (total, entry) => total + entry.bytes,
        0,
    );

    return Object.freeze({
        passed:
            missingFiles.length === 0 && newFiles.length === 0 && contentMismatches.length === 0,
        trackedFileCount: trackedPaths.length,
        generatedFileCount: generatedRelativePaths.length,
        totalBytes,
        missingFiles: Object.freeze(missingFiles),
        newFiles: Object.freeze(newFiles),
        contentMismatches: Object.freeze(contentMismatches),
    });
}

export function formatCommittedDistReport(report) {
    if (report.passed) {
        return (
            `Committed dist freshness passed (${report.generatedFileCount} files, ` +
            `${report.totalBytes} bytes).`
        );
    }

    const lines = ['Committed dist freshness failed.'];
    if (report.missingFiles.length > 0) {
        lines.push(
            `Stale or missing tracked files (${report.missingFiles.length}):`,
            ...report.missingFiles.map((filePath) => `  - ${filePath}`),
        );
    }
    if (report.newFiles.length > 0) {
        lines.push(
            `New untracked generated files (${report.newFiles.length}):`,
            ...report.newFiles.map(
                ({ bytes, filePath, sha256 }) =>
                    `  - ${filePath} (${bytes} bytes, sha256 ${sha256})`,
            ),
        );
    }
    if (report.contentMismatches.length > 0) {
        lines.push(
            `Content mismatches (${report.contentMismatches.length}):`,
            ...report.contentMismatches.flatMap(
                ({
                    committedBytes,
                    committedSha256,
                    filePath,
                    generatedBytes,
                    generatedSha256,
                }) => [
                    `  - ${filePath}`,
                    `    committed: ${committedBytes} bytes, sha256 ${committedSha256}`,
                    `    generated: ${generatedBytes} bytes, sha256 ${generatedSha256}`,
                ],
            ),
        );
    }
    lines.push('Run the standard build and commit every resulting dist change.');
    return lines.join('\n');
}
