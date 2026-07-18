/** Measures both redaction adapters with Fabric held external. */

import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import { rollup } from 'rollup';
import ts from 'typescript';

const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptsRoot, '..');
const configurationPath = path.join(
    repositoryRoot,
    'config',
    'release',
    'framework-comparison.json',
);
const configuration = JSON.parse(await readFile(configurationPath, 'utf8'));

function assertCondition(condition, message) {
    if (!condition) throw new Error(message);
}

function sourceLines(source) {
    let insideBlockComment = false;
    let count = 0;
    for (const line of source.split(/\r?\n/u)) {
        const trimmed = line.trim();
        if (insideBlockComment) {
            if (trimmed.includes('*/')) insideBlockComment = false;
            continue;
        }
        if (trimmed.startsWith('/*')) {
            if (!trimmed.includes('*/')) insideBlockComment = true;
            continue;
        }
        if (trimmed.length === 0 || trimmed.startsWith('//')) continue;
        count += 1;
    }
    return count;
}

function typescriptSources() {
    return {
        name: 'comparison-typescript-sources',
        async resolveId(source, importer) {
            if (!importer || !source.startsWith('.')) return null;
            const candidate = path.resolve(path.dirname(importer), source.replace(/\.js$/u, '.ts'));
            try {
                await access(candidate);
                return candidate;
            } catch {
                return null;
            }
        },
        async load(id) {
            if (!id.endsWith('.ts')) return null;
            const source = await readFile(id, 'utf8');
            return ts.transpileModule(source, {
                fileName: id,
                compilerOptions: {
                    target: ts.ScriptTarget.ES2022,
                    module: ts.ModuleKind.ESNext,
                    isolatedModules: true,
                    sourceMap: false,
                },
                reportDiagnostics: true,
            }).outputText;
        },
    };
}

async function buildMeasurement(source, minified) {
    const entry = path.join(repositoryRoot, source);
    const bundle = await rollup({
        input: entry,
        external: (id) => id === 'fabric',
        plugins: [
            typescriptSources(),
            nodeResolve({ browser: true }),
            ...(minified ? [terser()] : []),
        ],
        treeshake: { moduleSideEffects: false },
        onwarn(warning, warn) {
            if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
            warn(warning);
        },
    });
    try {
        const output = await bundle.generate({ format: 'esm', sourcemap: false });
        const code = output.output
            .filter((entry) => entry.type === 'chunk')
            .map((entry) => entry.code)
            .join('\n');
        const moduleIds = bundle.cache.modules.map((module) => module.id.replaceAll('\\', '/'));
        return Object.freeze({
            bytes: Buffer.byteLength(code),
            gzipBytes: gzipSync(code, { level: 9 }).byteLength,
            moduleIds: Object.freeze(moduleIds.sort()),
        });
    } finally {
        await bundle.close();
    }
}

async function measure(name, expected) {
    const sourcePath = path.join(repositoryRoot, expected.source);
    const source = await readFile(sourcePath, 'utf8');
    const applicationGlueLoc = sourceLines(source);
    const [development, minified] = await Promise.all([
        buildMeasurement(expected.source, false),
        buildMeasurement(expected.source, true),
    ]);
    assertCondition(
        applicationGlueLoc === expected.applicationGlueLoc,
        `${name} application glue changed: expected ${expected.applicationGlueLoc}, received ${applicationGlueLoc}.`,
    );
    assertCondition(
        minified.gzipBytes <= expected.maximumGzipBytes,
        `${name} exceeds its ${expected.maximumGzipBytes}-byte gzip comparison ceiling.`,
    );
    assertCondition(
        minified.moduleIds.every((id) => !id.includes('/node_modules/fabric/')),
        `${name} bundled Fabric instead of keeping the shared peer external.`,
    );
    assertCondition(
        minified.moduleIds.every(
            (id) => !/(?:\/src\/|\/dist\/)(?:testing|migrate-v2)(?:\/|$)/u.test(id),
        ),
        `${name} reached testing or migration runtime code.`,
    );
    return Object.freeze({
        source: expected.source,
        applicationGlueLoc,
        developmentBytes: development.bytes,
        minifiedBytes: minified.bytes,
        minifiedGzipBytes: minified.gzipBytes,
        moduleCount: minified.moduleIds.length,
        fabricModules: 0,
    });
}

assertCondition(configuration.schemaVersion === 1, 'Unsupported comparison configuration.');
assertCondition(
    configuration.fabricExternal === true,
    'Fabric must remain external for both measurements.',
);
const result = Object.freeze({
    schemaVersion: 1,
    fabricExternal: true,
    pureFabric: await measure('Pure Fabric', configuration.measurements.pureFabric),
    framework: await measure('Image Editor Framework', configuration.measurements.framework),
});
console.log(`FRAMEWORK_COMPARISON=${JSON.stringify(result)}`);
