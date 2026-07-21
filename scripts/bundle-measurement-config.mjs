import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

export const BUNDLE_MEASUREMENT_CONFIG = Object.freeze({
    schemaVersion: 2,
    output: Object.freeze({ lineEndings: 'lf' }),
    rollup: Object.freeze({
        format: 'es',
        exports: 'named',
        inlineDynamicImports: true,
        sourcemap: false,
        treeshake: Object.freeze({
            moduleSideEffects: false,
            propertyReadSideEffects: false,
        }),
    }),
    terser: Object.freeze({
        compressPasses: 2,
        comments: false,
        mangle: true,
    }),
    gzip: Object.freeze({ level: 9 }),
    brotli: Object.freeze({ quality: 11, mode: 'text' }),
    externalDependencies: Object.freeze(['fabric']),
});

/** Converts generated bundle text to the cross-platform measurement form. */
export function normalizeBundleMeasurementText(value) {
    return value.replace(/\r\n?/gu, '\n');
}

function canonicalize(value) {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(
        Object.entries(value)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, child]) => [key, canonicalize(child)]),
    );
}

export function hashJson(value) {
    return createHash('sha256')
        .update(JSON.stringify(canonicalize(value)))
        .digest('hex');
}

export const BUNDLE_MEASUREMENT_CONFIG_HASH = hashJson(BUNDLE_MEASUREMENT_CONFIG);

export async function hashFile(filePath) {
    return createHash('sha256')
        .update(await readFile(filePath))
        .digest('hex');
}

async function collectFiles(directory, predicate) {
    let entries;
    try {
        entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
        if (error?.code === 'ENOENT') return [];
        throw error;
    }
    const nested = await Promise.all(
        entries.map(async (entry) => {
            const entryPath = path.join(directory, entry.name);
            if (entry.isDirectory()) return collectFiles(entryPath, predicate);
            return entry.isFile() && predicate(entryPath) ? [entryPath] : [];
        }),
    );
    return nested.flat().sort();
}

export async function collectMeasurementInputs(packageRoot, fixturesRoot) {
    const distFiles = await collectFiles(path.join(packageRoot, 'dist', 'esm'), (filePath) =>
        filePath.endsWith('.js'),
    );
    const fixtureFiles = await collectFiles(fixturesRoot, () => true);
    const packageFiles = ['package.json', 'package-lock.json'].map((name) =>
        path.join(packageRoot, name),
    );
    return [...packageFiles, ...distFiles, ...fixtureFiles].sort();
}

export async function fingerprintMeasurementInputs(packageRoot, fixturesRoot) {
    const files = await collectMeasurementInputs(packageRoot, fixturesRoot);
    const hash = createHash('sha256');
    for (const filePath of files) {
        hash.update(path.relative(packageRoot, filePath).split(path.sep).join('/'));
        hash.update('\0');
        hash.update(await readFile(filePath));
        hash.update('\0');
    }
    return hash.digest('hex');
}

export async function latestMeasurementInputMtime(packageRoot, fixturesRoot) {
    const files = await collectMeasurementInputs(packageRoot, fixturesRoot);
    const mtimes = await Promise.all(files.map(async (filePath) => (await stat(filePath)).mtimeMs));
    return mtimes.length > 0 ? Math.max(...mtimes) : 0;
}
