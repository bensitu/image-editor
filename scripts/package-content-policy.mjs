/**
 * Inspects packed runtime, declaration, UMD, and source-map artifacts by contract.
 *
 * @module
 */

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import ts from 'typescript';

export const EXPECTED_PACKAGE_EXPORTS = Object.freeze([
    '.',
    './core',
    './sdk',
    './testing',
    './migrate-v2',
    './plugins/overlay',
    './plugins/annotation',
    './plugins/transform',
    './plugins/mask',
    './plugins/history',
    './plugins/filters',
    './plugins/crop',
    './plugins/mosaic',
    './plugins/annotation-text',
    './plugins/annotation-shape',
    './plugins/annotation-draw',
    './plugins/overlay-state',
    './plugins/dom-controls',
    './presets/minimal',
    './presets/redaction',
    './presets/annotation',
    './presets/full',
]);

export const APPROVED_UMD_FILES = Object.freeze([
    'dist/umd/image-editor.full.umd.js',
    'dist/umd/image-editor.full.umd.js.map',
    'dist/umd/image-editor.full.umd.min.js',
    'dist/umd/image-editor.full.umd.min.js.map',
]);

const OLD_RUNTIME_ARTIFACT_PATTERNS = Object.freeze([
    /^dist\/(?:esm|types)\/(?:animation|annotation|crop|export|history|lifecycle|mosaic|overlay|runtime|selection|tool-mode|ui)\//u,
    /^dist\/(?:esm|types)\/core\/(?:default-options|editor-elements|errors|image-filter-config|operation-guard|state-serializer)\./u,
    /^dist\/(?:esm|types)\/fabric\/fabric-adapter\./u,
    /^dist\/(?:esm|types)\/image\/(?:display-geometry|exif-orientation|image-file-loader|image-filters|image-input-budget|image-loader|image-resampler|overlay-transform-delta|transform-actions|transform-controller)\./u,
    /^dist\/(?:esm|types)\/mask\/(?:mask-actions|mask-list)\./u,
    /^dist\/(?:esm|types)\/utils\/(?:canvas-region|file|image-element-loader|pointer|timeout)\./u,
    /(?:^|\/)(?:element-map|image-editor-facade|legacy-runtime)(?:[./-]|$)/u,
]);
const OLD_RUNTIME_SOURCE_PATTERNS = Object.freeze([
    /(?:^|\/)src\/(?:animation|annotation|crop|export|history|lifecycle|mosaic|overlay|runtime|selection|tool-mode|ui)\//u,
    /(?:^|\/)src\/core\/(?:default-options|editor-elements|errors|image-filter-config|operation-guard|state-serializer)\.ts$/u,
    /(?:^|\/)src\/fabric\/fabric-adapter\.ts$/u,
    /(?:^|\/)src\/image\/(?:display-geometry|exif-orientation|image-file-loader|image-filters|image-input-budget|image-loader|image-resampler|overlay-transform-delta|transform-actions|transform-controller)\.ts$/u,
    /(?:^|\/)src\/mask\/(?:mask-actions|mask-list)\.ts$/u,
    /(?:^|\/)src\/utils\/(?:canvas-region|file|image-element-loader|pointer|timeout)\.ts$/u,
]);
const MIGRATION_MARKERS = Object.freeze([
    'migrateV2Snapshot',
    'v2SnapshotMigration',
    'image-editor.canvas@2',
    'V2Snapshot',
]);

function normalizedPath(value) {
    return value.replaceAll('\\', '/');
}

function uniqueSorted(values) {
    return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

export async function collectRelativeFiles(directory, root = directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) files.push(...(await collectRelativeFiles(entryPath, root)));
        else if (entry.isFile()) files.push(normalizedPath(path.relative(root, entryPath)));
    }
    return files.sort((left, right) => left.localeCompare(right));
}

function exportTarget(entry, condition, field) {
    const branch = entry?.[condition];
    return branch && typeof branch === 'object' && typeof branch[field] === 'string'
        ? branch[field]
        : null;
}

function packagePath(target) {
    return typeof target === 'string' && target.startsWith('./') ? target.slice(2) : target;
}

function formalTargets(manifest, condition, field) {
    return Object.values(manifest.exports ?? {})
        .map((entry) => exportTarget(entry, condition, field))
        .filter((target) => typeof target === 'string')
        .map(packagePath);
}

function moduleSpecifiers(fileName, source) {
    const scriptKind = /\.(?:d\.)?(?:cts|mts|ts)$/u.test(fileName)
        ? ts.ScriptKind.TS
        : ts.ScriptKind.JS;
    const sourceFile = ts.createSourceFile(
        fileName,
        source,
        ts.ScriptTarget.Latest,
        false,
        scriptKind,
    );
    const specifiers = [];
    function visit(node) {
        if (
            (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
            node.moduleSpecifier &&
            ts.isStringLiteralLike(node.moduleSpecifier)
        ) {
            specifiers.push(node.moduleSpecifier.text);
        } else if (
            ts.isImportEqualsDeclaration(node) &&
            ts.isExternalModuleReference(node.moduleReference) &&
            node.moduleReference.expression &&
            ts.isStringLiteralLike(node.moduleReference.expression)
        ) {
            specifiers.push(node.moduleReference.expression.text);
        } else if (
            ts.isImportTypeNode(node) &&
            ts.isLiteralTypeNode(node.argument) &&
            ts.isStringLiteralLike(node.argument.literal)
        ) {
            specifiers.push(node.argument.literal.text);
        } else if (
            ts.isCallExpression(node) &&
            node.arguments.length > 0 &&
            ts.isStringLiteralLike(node.arguments[0]) &&
            (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
                (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
        ) {
            specifiers.push(node.arguments[0].text);
        }
        ts.forEachChild(node, visit);
    }
    visit(sourceFile);
    return uniqueSorted(specifiers);
}

function declarationCandidates(basePath) {
    if (/\.d\.(?:cts|mts|ts)$/u.test(basePath)) return [basePath];
    if (basePath.endsWith('.cjs')) return [basePath.replace(/\.cjs$/u, '.d.cts')];
    if (basePath.endsWith('.mjs')) return [basePath.replace(/\.mjs$/u, '.d.mts')];
    if (basePath.endsWith('.js')) {
        return [
            basePath.replace(/\.js$/u, '.d.ts'),
            basePath.replace(/\.js$/u, '.d.cts'),
            basePath.replace(/\.js$/u, '.d.mts'),
        ];
    }
    return [
        `${basePath}.d.ts`,
        `${basePath}.d.cts`,
        `${basePath}.d.mts`,
        `${basePath}/index.d.ts`,
        `${basePath}/index.d.cts`,
        `${basePath}/index.d.mts`,
    ];
}

function runtimeCandidates(basePath, extension) {
    if (path.posix.extname(basePath)) return [basePath];
    return [basePath, `${basePath}${extension}`, `${basePath}/index${extension}`];
}

function resolveSelfImport(specifier, importer, manifest, graphKind) {
    if (specifier !== manifest.name && !specifier.startsWith(`${manifest.name}/`)) return null;
    const exportName =
        specifier === manifest.name ? '.' : `./${specifier.slice(manifest.name.length + 1)}`;
    const entry = manifest.exports?.[exportName];
    if (!entry) return { privateImport: exportName };
    if (graphKind === 'declaration') {
        const condition = importer.endsWith('.d.cts') ? 'require' : 'import';
        return { target: packagePath(exportTarget(entry, condition, 'types')) };
    }
    const condition = graphKind === 'cjs' ? 'require' : 'import';
    return { target: packagePath(exportTarget(entry, condition, 'default')) };
}

function resolveSpecifier(specifier, importer, files, manifest, graphKind) {
    const selfImport = resolveSelfImport(specifier, importer, manifest, graphKind);
    if (selfImport) return selfImport;
    if (!specifier.startsWith('.')) return { external: true };
    const basePath = path.posix.normalize(path.posix.join(path.posix.dirname(importer), specifier));
    if (basePath === '..' || basePath.startsWith('../') || path.posix.isAbsolute(basePath)) {
        return { escaped: true };
    }
    const candidates =
        graphKind === 'declaration'
            ? declarationCandidates(basePath)
            : runtimeCandidates(basePath, graphKind === 'cjs' ? '.cjs' : '.js');
    const target = candidates.find((candidate) => files.has(candidate));
    return target ? { target } : { missing: candidates[0] };
}

async function buildGraph({ packageRoot, files, roots, manifest, graphKind }) {
    const reachable = new Set();
    const missingTargets = [];
    const privateImports = [];
    const escapedImports = [];
    const queue = [...roots];
    for (const root of roots) {
        if (!files.has(root)) missingTargets.push(`formal target ${root}`);
    }
    while (queue.length > 0) {
        const current = queue.pop();
        if (!files.has(current) || reachable.has(current)) continue;
        reachable.add(current);
        const source = await readFile(path.join(packageRoot, ...current.split('/')), 'utf8');
        for (const specifier of moduleSpecifiers(current, source)) {
            const resolution = resolveSpecifier(specifier, current, files, manifest, graphKind);
            if (resolution.external) continue;
            if (resolution.target) queue.push(resolution.target);
            else if (resolution.privateImport) {
                privateImports.push(`${current} imports private subpath ${specifier}`);
            } else if (resolution.escaped) {
                escapedImports.push(`${current} imports path outside the package: ${specifier}`);
            } else if (resolution.missing) {
                missingTargets.push(`${current} imports missing target ${specifier}`);
            }
        }
    }
    return Object.freeze({
        reachable,
        missingTargets: uniqueSorted(missingTargets),
        privateImports: uniqueSorted(privateImports),
        escapedImports: uniqueSorted(escapedImports),
    });
}

function matchesAny(value, patterns) {
    return patterns.some((pattern) => pattern.test(value));
}

async function inspectSourceMaps(packageRoot, files) {
    const failures = [];
    const maps = [...files].filter((file) => file.endsWith('.map')).sort();
    for (const mapPath of maps) {
        const parent = mapPath.slice(0, -'.map'.length);
        if (!files.has(parent)) {
            failures.push(`Source map ${mapPath} has no packed parent artifact.`);
            continue;
        }
        let sourceMap;
        try {
            sourceMap = JSON.parse(
                await readFile(path.join(packageRoot, ...mapPath.split('/')), 'utf8'),
            );
        } catch {
            failures.push(`Source map ${mapPath} is not valid JSON.`);
            continue;
        }
        if (!Array.isArray(sourceMap.sources)) {
            failures.push(`Source map ${mapPath} has no sources array.`);
            continue;
        }
        const sources = [
            ...sourceMap.sources,
            ...(typeof sourceMap.sourceRoot === 'string' && sourceMap.sourceRoot.length > 0
                ? [sourceMap.sourceRoot]
                : []),
        ];
        for (const sourcePath of sources) {
            if (
                typeof sourcePath !== 'string' ||
                path.posix.isAbsolute(sourcePath) ||
                /^[A-Za-z]:[\\/]/u.test(sourcePath) ||
                sourcePath.startsWith('file:') ||
                /(?:^|[\\/])Users[\\/]|(?:^|\/)home\//u.test(sourcePath)
            ) {
                failures.push(`Source map ${mapPath} contains an absolute local source path.`);
                break;
            }
            const normalizedSource = normalizedPath(sourcePath);
            if (matchesAny(normalizedSource, OLD_RUNTIME_SOURCE_PATTERNS)) {
                failures.push(
                    `Source map ${mapPath} retains removed Runtime source ${sourcePath}.`,
                );
                break;
            }
        }
    }
    return Object.freeze({ total: maps.length, failures: uniqueSorted(failures) });
}

export async function inspectMainPackageContents({ packageRoot, manifest, files }) {
    const normalizedFiles = new Set(files.map(normalizedPath));
    const failures = [];
    const actualExports = Object.keys(manifest.exports ?? {}).sort();
    const expectedExports = [...EXPECTED_PACKAGE_EXPORTS].sort();
    if (JSON.stringify(actualExports) !== JSON.stringify(expectedExports)) {
        failures.push('Formal package exports do not match the approved entry set.');
    }

    const esmFiles = new Set(
        [...normalizedFiles].filter((file) => /^dist\/esm\/.*\.js$/u.test(file)),
    );
    const declarationFiles = new Set(
        [...normalizedFiles].filter((file) => /\.d\.(?:cts|mts|ts)$/u.test(file)),
    );
    const cjsFiles = new Set(
        [...normalizedFiles].filter((file) => /^dist\/cjs\/.*\.cjs$/u.test(file)),
    );

    const esmGraph = await buildGraph({
        packageRoot,
        files: esmFiles,
        roots: formalTargets(manifest, 'import', 'default'),
        manifest,
        graphKind: 'esm',
    });
    const declarationGraph = await buildGraph({
        packageRoot,
        files: declarationFiles,
        roots: uniqueSorted([
            ...formalTargets(manifest, 'import', 'types'),
            ...formalTargets(manifest, 'require', 'types'),
        ]),
        manifest,
        graphKind: 'declaration',
    });
    const cjsGraph = await buildGraph({
        packageRoot,
        files: cjsFiles,
        roots: formalTargets(manifest, 'require', 'default'),
        manifest,
        graphKind: 'cjs',
    });

    const unreachableEsm = [...esmFiles].filter((file) => !esmGraph.reachable.has(file)).sort();
    const unreachableDeclarations = [...declarationFiles]
        .filter((file) => !declarationGraph.reachable.has(file))
        .sort();
    const unreachableCjs = [...cjsFiles].filter((file) => !cjsGraph.reachable.has(file)).sort();
    for (const file of unreachableEsm) failures.push(`Packed ESM module is unreachable: ${file}.`);
    for (const file of unreachableDeclarations) {
        failures.push(`Packed declaration is unreachable: ${file}.`);
    }
    for (const file of unreachableCjs) failures.push(`Packed CJS module is unreachable: ${file}.`);
    for (const graph of [esmGraph, declarationGraph, cjsGraph]) {
        failures.push(...graph.missingTargets, ...graph.privateImports, ...graph.escapedImports);
    }

    const umdFiles = [...normalizedFiles].filter((file) => file.startsWith('dist/umd/')).sort();
    if (JSON.stringify(umdFiles) !== JSON.stringify([...APPROVED_UMD_FILES].sort())) {
        failures.push('Packed UMD files do not match the approved Full-level allowlist.');
    }

    const oldRuntimeFiles = [...normalizedFiles]
        .filter((file) => matchesAny(file, OLD_RUNTIME_ARTIFACT_PATTERNS))
        .sort();
    for (const file of oldRuntimeFiles)
        failures.push(`Packed old Runtime artifact remains: ${file}.`);

    const codemodFiles = [...normalizedFiles]
        .filter((file) => /(?:^|\/)(?:codemod|v2-to-v3)(?:[./-]|$)/u.test(file))
        .sort();
    for (const file of codemodFiles)
        failures.push(`Main package contains Codemod runtime: ${file}.`);

    const migrationLeaks = [];
    const scannableRuntime = [...normalizedFiles].filter(
        (file) => /\.(?:c?js|mjs)$/u.test(file) && !/^dist\/(?:esm|cjs)\/migrate-v2\//u.test(file),
    );
    for (const file of scannableRuntime) {
        const source = await readFile(path.join(packageRoot, ...file.split('/')), 'utf8');
        if (MIGRATION_MARKERS.some((marker) => source.includes(marker))) migrationLeaks.push(file);
    }
    for (const file of migrationLeaks) {
        failures.push(`Migration conversion logic escaped the migrate-v2 entry: ${file}.`);
    }

    const sourceMaps = await inspectSourceMaps(packageRoot, normalizedFiles);
    failures.push(...sourceMaps.failures);
    const dtsFiles = [...declarationFiles].filter((file) => file.endsWith('.d.ts'));
    const dctsFiles = [...declarationFiles].filter((file) => file.endsWith('.d.cts'));

    return Object.freeze({
        failures: Object.freeze(uniqueSorted(failures)),
        esm: Object.freeze({
            total: esmFiles.size,
            reachable: esmGraph.reachable.size,
            unreachable: Object.freeze(unreachableEsm),
        }),
        declarations: Object.freeze({
            total: declarationFiles.size,
            reachable: declarationGraph.reachable.size,
            unreachable: Object.freeze(unreachableDeclarations),
            dtsTotal: dtsFiles.length,
            dtsReachable: dtsFiles.filter((file) => declarationGraph.reachable.has(file)).length,
            dctsTotal: dctsFiles.length,
            dctsReachable: dctsFiles.filter((file) => declarationGraph.reachable.has(file)).length,
            privateImports: Object.freeze(declarationGraph.privateImports),
            missingTargets: Object.freeze(declarationGraph.missingTargets),
        }),
        cjs: Object.freeze({
            total: cjsFiles.size,
            reachable: cjsGraph.reachable.size,
            unreachable: Object.freeze(unreachableCjs),
        }),
        umd: Object.freeze({ files: Object.freeze(umdFiles) }),
        sourceMaps,
        oldRuntimeFiles: Object.freeze(oldRuntimeFiles),
        codemodFiles: Object.freeze(codemodFiles),
        migrationLeaks: Object.freeze(migrationLeaks),
        graphs: Object.freeze({
            esmReachable: Object.freeze([...esmGraph.reachable].sort()),
            declarationReachable: Object.freeze([...declarationGraph.reachable].sort()),
            cjsReachable: Object.freeze([...cjsGraph.reachable].sort()),
        }),
    });
}
