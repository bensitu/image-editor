/** Verifies that runtime entries cannot reach the public testing implementation. */

import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import ts from 'typescript';

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptsDirectory, '..');
const sourceRoot = path.join(repositoryRoot, 'src');
const testingRoot = path.join(sourceRoot, 'testing');
const runtimeSourceEntries = [
    'src/index.ts',
    'src/core/index.ts',
    'src/sdk/index.ts',
    'src/foundations/overlay/index.ts',
    'src/foundations/annotation/index.ts',
    'src/plugins/transform/index.ts',
    'src/plugins/mask/index.ts',
    'src/plugins/history/index.ts',
    'src/plugins/filters/index.ts',
    'src/plugins/crop/index.ts',
    'src/plugins/mosaic/index.ts',
    'src/plugins/annotation-text/index.ts',
    'src/plugins/annotation-shape/index.ts',
    'src/plugins/annotation-draw/index.ts',
    'src/plugins/overlay-state/index.ts',
    'src/plugins/dom-controls/index.ts',
    'src/presets/minimal/index.ts',
    'src/presets/redaction/index.ts',
    'src/presets/annotation/index.ts',
    'src/presets/full/index.ts',
];
const runtimeCjsEntries = [
    'dist/cjs/index.cjs',
    'dist/cjs/core/index.cjs',
    'dist/cjs/sdk/index.cjs',
    'dist/cjs/foundations/overlay/index.cjs',
    'dist/cjs/foundations/annotation/index.cjs',
    'dist/cjs/plugins/transform/index.cjs',
    'dist/cjs/plugins/mask/index.cjs',
    'dist/cjs/plugins/history/index.cjs',
    'dist/cjs/plugins/filters/index.cjs',
    'dist/cjs/plugins/crop/index.cjs',
    'dist/cjs/plugins/mosaic/index.cjs',
    'dist/cjs/plugins/annotation-text/index.cjs',
    'dist/cjs/plugins/annotation-shape/index.cjs',
    'dist/cjs/plugins/annotation-draw/index.cjs',
    'dist/cjs/plugins/overlay-state/index.cjs',
    'dist/cjs/plugins/dom-controls/index.cjs',
    'dist/cjs/presets/minimal/index.cjs',
    'dist/cjs/presets/redaction/index.cjs',
    'dist/cjs/presets/annotation/index.cjs',
    'dist/cjs/presets/full/index.cjs',
];
const testingMarkers = ['runPluginConformance', 'plugin-conformance', '/testing/'];

async function fileExists(filePath) {
    try {
        return (await stat(filePath)).isFile();
    } catch (error) {
        if (error?.code === 'ENOENT') return false;
        throw error;
    }
}

function inside(directory, filePath) {
    const relative = path.relative(directory, filePath);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function resolveSourceImport(importer, specifier) {
    if (!specifier.startsWith('.')) return null;
    const resolved = path.resolve(path.dirname(importer), specifier);
    const candidates = [
        resolved,
        resolved.replace(/\.js$/u, '.ts'),
        path.join(resolved, 'index.ts'),
    ];
    for (const candidate of candidates) {
        if (inside(sourceRoot, candidate) && (await fileExists(candidate))) return candidate;
    }
    return null;
}

async function collectSourceGraph(entryPaths) {
    const pending = entryPaths.map((entry) => path.join(repositoryRoot, entry));
    const visited = new Set();
    while (pending.length > 0) {
        const filePath = pending.pop();
        if (!filePath || visited.has(filePath)) continue;
        visited.add(filePath);
        const source = await readFile(filePath, 'utf8');
        const imports = ts.preProcessFile(source, true, true).importedFiles;
        for (const imported of imports) {
            const resolved = await resolveSourceImport(filePath, imported.fileName);
            if (resolved && !visited.has(resolved)) pending.push(resolved);
        }
    }
    return visited;
}

function relativeCjsDependencies(source) {
    return [...source.matchAll(/require\(["'](\.[^"']+\.cjs)["']\)/gu)].map((match) => match[1]);
}

async function collectCjsGraph(entryPaths) {
    const pending = entryPaths.map((entry) => path.join(repositoryRoot, entry));
    const visited = new Set();
    while (pending.length > 0) {
        const filePath = pending.pop();
        if (!filePath || visited.has(filePath)) continue;
        visited.add(filePath);
        const source = await readFile(filePath, 'utf8');
        for (const dependency of relativeCjsDependencies(source)) {
            pending.push(path.resolve(path.dirname(filePath), dependency));
        }
    }
    return visited;
}

function normalizedSources(map) {
    return (map.sources ?? []).map((source) => source.replaceAll('\\', '/'));
}

export async function checkTestingIsolation({ requireBuild = false } = {}) {
    const failures = [];
    const sourceGraph = await collectSourceGraph(runtimeSourceEntries);
    for (const filePath of sourceGraph) {
        if (inside(testingRoot, filePath)) {
            failures.push(
                `Runtime source graph reaches ${path.relative(repositoryRoot, filePath)}.`,
            );
        }
    }

    let bundleModules = 0;
    const bundleAvailable = await fileExists(path.join(repositoryRoot, runtimeCjsEntries[0]));
    if (requireBuild && !bundleAvailable) failures.push('Built CommonJS entries are unavailable.');
    if (bundleAvailable) {
        const cjsGraph = await collectCjsGraph(runtimeCjsEntries);
        bundleModules = cjsGraph.size;
        for (const filePath of cjsGraph) {
            const source = await readFile(filePath, 'utf8');
            for (const marker of testingMarkers.slice(0, 2)) {
                if (source.includes(marker)) {
                    failures.push(
                        `Runtime CommonJS graph contains testing marker "${marker}" in ${path.relative(repositoryRoot, filePath)}.`,
                    );
                }
            }
            const mapPath = `${filePath}.map`;
            if (!(await fileExists(mapPath))) continue;
            const map = JSON.parse(await readFile(mapPath, 'utf8'));
            for (const sourcePath of normalizedSources(map)) {
                if (sourcePath.includes('/testing/')) {
                    failures.push(`Runtime CommonJS graph contains testing source ${sourcePath}.`);
                }
            }
        }

        const umdPath = path.join(repositoryRoot, 'dist/umd/image-editor.full.umd.js');
        if (requireBuild && !(await fileExists(umdPath))) {
            failures.push('Built UMD entry is unavailable.');
        } else if (await fileExists(umdPath)) {
            const umd = await readFile(umdPath, 'utf8');
            for (const marker of testingMarkers.slice(0, 2)) {
                if (umd.includes(marker)) failures.push(`Runtime UMD bundle contains "${marker}".`);
            }
        }
    }

    return Object.freeze({
        sourceModules: sourceGraph.size,
        bundleModules,
        failures: Object.freeze(failures),
    });
}

async function main() {
    const result = await checkTestingIsolation({ requireBuild: true });
    console.log(`Runtime source modules checked: ${result.sourceModules}`);
    console.log(`Runtime CommonJS modules checked: ${result.bundleModules}`);
    console.log(`Testing runtime leakage: ${result.failures.length}`);
    if (result.failures.length > 0) {
        for (const failure of result.failures) console.error(`- ${failure}`);
        process.exitCode = 1;
    }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
