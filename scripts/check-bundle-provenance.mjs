/**
 * Creates and validates reproducible bundle provenance records.
 *
 * Committed identity is derived from Git object IDs and committed bytes. This
 * deliberately avoids hashing checkout bytes, whose line endings may vary.
 *
 * @module
 */

import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { brotliCompressSync, constants as zlibConstants, gzipSync } from 'node:zlib';

const execFileAsync = promisify(execFile);
const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = path.resolve(scriptsDir, '..');
const defaultRecordPath = path.join(defaultRepoRoot, 'tests', 'bundle', 'provenance', 'v2.json');
const defaultRef = 'legacy/v2';
const defaultBaseline = 'v2';
const artifactEntry = 'dist/esm/index.js';
const defaultBaselinePath = 'tests/bundle/baselines/v2.json';
const defaultMeasurementPath = path.join(defaultRepoRoot, ...defaultBaselinePath.split('/'));
const measurementFixture = 'full-root';
const sourcePathspecs = [
    'src',
    'package.json',
    'package-lock.json',
    'rollup.config.mjs',
    'tsconfig.json',
    'tsconfig.build.json',
    'tsconfig.types.json',
    'dist/esm',
];
const measuredFields = ['rawBytes', 'minifiedBytes', 'gzipBytes', 'brotliBytes', 'moduleCount'];

function sha256(value) {
    return createHash('sha256').update(value).digest('hex');
}

function canonicalJson(value) {
    if (Array.isArray(value)) return value.map(canonicalJson);
    if (value === null || typeof value !== 'object') return value;
    return Object.fromEntries(
        Object.entries(value)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, child]) => [key, canonicalJson(child)]),
    );
}

function hashJson(value) {
    return sha256(JSON.stringify(canonicalJson(value)));
}

async function run(command, args, cwd) {
    const { stdout } = await execFileAsync(command, args, {
        cwd,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        windowsHide: true,
    });
    return stdout;
}

async function git(repoRoot, args) {
    return (await run('git', args, repoRoot)).trim();
}

/** Returns deterministic local candidates for a published or exact Git reference. */
export function gitReferenceCandidates(ref) {
    if (ref.startsWith('refs/') || /^[0-9a-f]{7,40}$/iu.test(ref)) return [ref];
    return [`refs/remotes/origin/${ref}`, `refs/heads/${ref}`, ref];
}

async function resolveCommit(repoRoot, ref) {
    for (const candidate of gitReferenceCandidates(ref)) {
        try {
            return await git(repoRoot, ['rev-parse', '--verify', candidate]);
        } catch {
            // Try the next deterministic candidate without mutating repository refs.
        }
    }
    throw new Error(
        `Git reference ${ref} is unavailable. Fetch published branches before checking.`,
    );
}

async function committedBytes(repoRoot, commit, filePath) {
    const { stdout } = await execFileAsync('git', ['show', `${commit}:${filePath}`], {
        cwd: repoRoot,
        encoding: null,
        maxBuffer: 64 * 1024 * 1024,
        windowsHide: true,
    });
    return Buffer.from(stdout);
}

function parseLsTree(output) {
    return output
        .split('\0')
        .filter(Boolean)
        .map((record) => {
            const tab = record.indexOf('\t');
            const [mode, type, object] = record.slice(0, tab).split(' ');
            return { mode, type, object, path: record.slice(tab + 1).replaceAll('\\', '/') };
        })
        .sort((left, right) => left.path.localeCompare(right.path));
}

/**
 * Hashes Git tree records without consulting checkout bytes.
 */
export function hashTrackedBlobManifest(records) {
    const normalized = records
        .map(({ mode, type, object, path: filePath }) => ({
            mode,
            type,
            object,
            path: filePath.replaceAll('\\', '/'),
        }))
        .sort((left, right) => left.path.localeCompare(right.path));
    return sha256(
        normalized
            .map(
                ({ mode, type, object, path: filePath }) =>
                    `${mode} ${type} ${object}\t${filePath}\n`,
            )
            .join(''),
    );
}

async function treeRecords(repoRoot, commit, pathspecs) {
    const output = await run('git', ['ls-tree', '-r', '-z', commit, '--', ...pathspecs], repoRoot);
    return parseLsTree(output);
}

/**
 * Converts porcelain status output into explicit dirty-tree evidence.
 */
export function createWorkingTreeIdentity(statusOutput) {
    const dirtyPaths = statusOutput
        .split(/\r?\n/u)
        .filter(Boolean)
        .map((line) => line.slice(3).trim())
        .sort();
    return { clean: dirtyPaths.length === 0, dirtyPaths };
}

async function workingTreeIdentity(repoRoot) {
    return createWorkingTreeIdentity(
        await run('git', ['status', '--porcelain=v1', '--untracked-files=all'], repoRoot),
    );
}

/** Resolves an exact package version from committed npm lockfile data. */
export function packageVersionFromLockfile(lockfile, packageName) {
    const version =
        lockfile?.packages?.[`node_modules/${packageName}`]?.version ??
        lockfile?.dependencies?.[packageName]?.version;
    if (typeof version !== 'string' || version.length === 0) {
        throw new Error(`Committed package-lock.json does not resolve ${packageName}.`);
    }
    return version;
}

async function toolchainIdentity(repoRoot, commit) {
    const npmVersion =
        process.platform === 'win32'
            ? await run(
                  process.env.ComSpec ?? 'cmd.exe',
                  ['/d', '/s', '/c', 'npm --version'],
                  repoRoot,
              )
            : await run('npm', ['--version'], repoRoot);
    const lockfile = JSON.parse(
        (await committedBytes(repoRoot, commit, 'package-lock.json')).toString('utf8'),
    );
    return {
        node: process.version,
        npm: npmVersion.trim(),
        rollup: packageVersionFromLockfile(lockfile, 'rollup'),
        terser: packageVersionFromLockfile(lockfile, 'terser'),
        typescript: packageVersionFromLockfile(lockfile, 'typescript'),
    };
}

async function committedHash(repoRoot, commit, filePath) {
    return sha256(await committedBytes(repoRoot, commit, filePath));
}

async function createInputIdentity(repoRoot, commit) {
    return {
        packageLockHash: await committedHash(repoRoot, commit, 'package-lock.json'),
        rollupConfigHash: await committedHash(repoRoot, commit, 'rollup.config.mjs'),
    };
}

async function createArtifactIdentity(repoRoot, commit) {
    const raw = await committedBytes(repoRoot, commit, artifactEntry);
    const modules = [artifactEntry];
    return {
        entry: artifactEntry,
        rawHash: sha256(raw),
        rawBytes: raw.byteLength,
        gzipBytes: gzipSync(raw, { level: 9 }).byteLength,
        brotliBytes: brotliCompressSync(raw, {
            params: {
                [zlibConstants.BROTLI_PARAM_QUALITY]: 11,
                [zlibConstants.BROTLI_PARAM_MODE]: zlibConstants.BROTLI_MODE_TEXT,
            },
        }).byteLength,
        moduleCount: modules.length,
        modules,
        moduleListHash: hashJson(modules),
    };
}

function repositoryRelativePath(repoRoot, filePath) {
    const relativePath = path.relative(repoRoot, filePath).replaceAll('\\', '/');
    if (relativePath === '..' || relativePath.startsWith('../')) {
        throw new Error(`Measurement path must be inside the repository: ${filePath}`);
    }
    return relativePath;
}

/**
 * Validates the commit identity carried by either supported measurement schema.
 */
export function validateMeasurementSource(baseline, commit, tree) {
    if (baseline.source?.head !== undefined || baseline.source?.tree !== undefined) {
        if (baseline.source?.head !== commit || baseline.source?.tree !== tree) {
            throw new Error(
                'Measurement baseline does not identify the requested commit and tree.',
            );
        }
        return;
    }
    if (baseline.metadata?.gitCommit !== commit) {
        throw new Error('Measurement baseline does not identify the requested commit.');
    }
}

async function createMeasurementIdentity(repoRoot, commit, tree, measurementPath) {
    const baseline = JSON.parse(await readFile(measurementPath, 'utf8'));
    const measurementRepoPath = repositoryRelativePath(repoRoot, measurementPath);
    validateMeasurementSource(baseline, commit, tree);
    const fixture = baseline.fixtures?.[measurementFixture];
    if (!fixture) throw new Error(`${measurementRepoPath} has no ${measurementFixture} fixture.`);
    const modules = [...fixture.modules];
    return {
        baseline: measurementRepoPath,
        baselineHash: hashJson(baseline),
        fixture: measurementFixture,
        entryPath: fixture.entryPath,
        rawBytes: fixture.rawBytes,
        minifiedBytes: fixture.minifiedBytes,
        gzipBytes: fixture.gzipBytes,
        brotliBytes: fixture.brotliBytes,
        moduleCount: fixture.moduleCount,
        modules,
        moduleListHash: hashJson(modules),
    };
}

/**
 * Builds a schema-v2 provenance record for a committed reference.
 */
export async function createBundleProvenance({
    repoRoot = defaultRepoRoot,
    ref = defaultRef,
    baseline = defaultBaseline,
    measurementPath = defaultMeasurementPath,
} = {}) {
    const head = await resolveCommit(repoRoot, ref);
    const tree = await git(repoRoot, ['rev-parse', `${head}^{tree}`]);
    const records = await treeRecords(repoRoot, head, sourcePathspecs);
    return {
        schemaVersion: 2,
        baseline,
        source: {
            ref,
            head,
            tree,
            clean: true,
            trackedBlobManifestHash: hashTrackedBlobManifest(records),
            trackedBlobCount: records.length,
            pathspecs: sourcePathspecs,
        },
        workingTree: await workingTreeIdentity(repoRoot),
        toolchain: await toolchainIdentity(repoRoot, head),
        inputs: await createInputIdentity(repoRoot, head),
        artifact: await createArtifactIdentity(repoRoot, head),
        measurement: await createMeasurementIdentity(repoRoot, head, tree, measurementPath),
    };
}

function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function getPath(value, fieldPath) {
    return fieldPath.split('.').reduce((parent, key) => parent?.[key], value);
}

function compareField(errors, actual, expected, fieldPath) {
    const actualValue = getPath(actual, fieldPath);
    const expectedValue = getPath(expected, fieldPath);
    if (JSON.stringify(actualValue) !== JSON.stringify(expectedValue)) {
        errors.push(
            `${fieldPath} mismatch: expected ${JSON.stringify(expectedValue)}, received ${JSON.stringify(actualValue)}.`,
        );
    }
}

const exactFields = [
    'baseline',
    'source.ref',
    'source.head',
    'source.tree',
    'source.trackedBlobManifestHash',
    'source.trackedBlobCount',
    'source.pathspecs',
    'toolchain.node',
    'toolchain.npm',
    'toolchain.rollup',
    'toolchain.terser',
    'toolchain.typescript',
    'inputs.packageLockHash',
    'inputs.rollupConfigHash',
    'artifact.entry',
    'artifact.rawHash',
    'artifact.rawBytes',
    'artifact.gzipBytes',
    'artifact.brotliBytes',
    'artifact.moduleCount',
    'artifact.modules',
    'artifact.moduleListHash',
    'measurement.baseline',
    'measurement.baselineHash',
    'measurement.fixture',
    'measurement.entryPath',
    'measurement.rawBytes',
    'measurement.minifiedBytes',
    'measurement.gzipBytes',
    'measurement.brotliBytes',
    'measurement.moduleCount',
    'measurement.modules',
    'measurement.moduleListHash',
];

/**
 * Validates structure, internal hashes, and exact identity against live Git data.
 */
export function validateBundleProvenance(actual, expected) {
    if (!isRecord(actual) || actual.schemaVersion !== 2) {
        return ['provenance must use schemaVersion 2.'];
    }
    const errors = [];
    for (const section of [
        'source',
        'workingTree',
        'toolchain',
        'inputs',
        'artifact',
        'measurement',
    ]) {
        if (!isRecord(actual[section])) errors.push(`${section} must be an object.`);
    }
    if (errors.length > 0) return errors;

    if (actual.source.clean !== true)
        errors.push('source.clean must be true for a committed baseline.');
    if (actual.workingTree.clean !== true || actual.workingTree.dirtyPaths?.length !== 0) {
        errors.push(
            `committed baseline was generated from a dirty tree: ${JSON.stringify(actual.workingTree.dirtyPaths ?? [])}.`,
        );
    }
    for (const field of ['node', 'npm', 'rollup', 'terser', 'typescript']) {
        if (typeof actual.toolchain[field] !== 'string' || actual.toolchain[field].length === 0) {
            errors.push(`toolchain.${field} must be a non-empty string.`);
        }
    }
    for (const section of ['artifact', 'measurement']) {
        const fields =
            section === 'artifact'
                ? ['rawBytes', 'gzipBytes', 'brotliBytes', 'moduleCount']
                : measuredFields;
        for (const field of fields) {
            if (!Number.isSafeInteger(actual[section][field]) || actual[section][field] < 0) {
                errors.push(`${section}.${field} must be a non-negative safe integer.`);
            }
        }
        if (
            !Array.isArray(actual[section].modules) ||
            actual[section].modules.length !== actual[section].moduleCount
        ) {
            errors.push(`${section}.modules must contain exactly moduleCount entries.`);
        } else if (actual[section].moduleListHash !== hashJson(actual[section].modules)) {
            errors.push(`${section}.moduleListHash does not match its module list.`);
        }
    }
    if (expected) {
        for (const fieldPath of exactFields) compareField(errors, actual, expected, fieldPath);
    }
    return errors;
}

/**
 * Compares legacy schema-v1 live measurements by values and module graph.
 */
export function compareMeasurements(expected, actual) {
    const errors = [];
    for (const [fixtureName, expectedFixture] of Object.entries(expected.fixtures ?? {})) {
        const actualFixture = actual.fixtures?.[fixtureName];
        if (!actualFixture) {
            errors.push(`${fixtureName}: live measurement is missing.`);
            continue;
        }
        for (const field of measuredFields) {
            if (actualFixture[field] !== expectedFixture[field]) {
                errors.push(
                    `${fixtureName}.${field}: baseline=${expectedFixture[field]}, live=${actualFixture[field]}.`,
                );
            }
        }
        for (const field of ['entryPath', 'modules', 'externalDependencies']) {
            if (JSON.stringify(actualFixture[field]) !== JSON.stringify(expectedFixture[field])) {
                errors.push(`${fixtureName}.${field} differs from the live measurement.`);
            }
        }
    }
    return errors;
}

function parseArguments(argv) {
    const options = {
        command: argv[0] ?? 'check',
        repoRoot: defaultRepoRoot,
        ref: defaultRef,
        baseline: defaultBaseline,
        recordPath: defaultRecordPath,
        measurementPath: defaultMeasurementPath,
        refFromGate: null,
    };
    for (let index = 1; index < argv.length; index += 1) {
        const argument = argv[index];
        const value = argv[index + 1];
        if (argument === '--repo-root') options.repoRoot = path.resolve(value);
        else if (argument === '--ref') options.ref = value;
        else if (argument === '--ref-from-gate') options.refFromGate = path.resolve(value);
        else if (argument === '--baseline') options.baseline = value;
        else if (argument === '--measurement-path') options.measurementPath = path.resolve(value);
        else if (argument === '--output' || argument === '--input') {
            options.recordPath = path.resolve(value);
        } else throw new Error(`Unknown argument: ${argument}`);
        index += 1;
    }
    if (!['check', 'generate'].includes(options.command)) {
        throw new Error(`Expected check or generate, received ${options.command}.`);
    }
    return options;
}

async function main() {
    const options = parseArguments(process.argv.slice(2));
    if (options.refFromGate) {
        const gate = JSON.parse(await readFile(options.refFromGate, 'utf8'));
        if (typeof gate.finalCommit !== 'string' || gate.finalCommit.length === 0) {
            throw new Error(`${options.refFromGate} does not define finalCommit.`);
        }
        options.ref = gate.finalCommit;
    }
    const expected = await createBundleProvenance(options);
    if (options.command === 'generate') {
        const errors = validateBundleProvenance(expected);
        if (errors.length > 0) throw new Error(errors.join('\n'));
        await mkdir(path.dirname(options.recordPath), { recursive: true });
        await writeFile(options.recordPath, `${JSON.stringify(expected, null, 4)}\n`, 'utf8');
        console.log(`Generated schema-v2 bundle provenance: ${options.recordPath}`);
        return;
    }
    const actual = JSON.parse(await readFile(options.recordPath, 'utf8'));
    const errors = validateBundleProvenance(actual, expected);
    if (errors.length > 0) {
        console.error('Bundle provenance check failed:');
        for (const error of errors) console.error(`- ${error}`);
        process.exitCode = 1;
        return;
    }
    console.log(
        `Bundle provenance check passed for ${actual.source.ref} at ${actual.source.head} (${actual.source.trackedBlobCount} Git objects).`,
    );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
