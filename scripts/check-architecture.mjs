/**
 * Enforces the Phase 0 dependency direction and emits a stable import graph.
 *
 * TypeScript's resolver is used so relative `.js` source specifiers and any
 * future tsconfig path aliases are interpreted consistently on every OS.
 *
 * @module
 */

import { execFile } from 'node:child_process';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const execFileAsync = promisify(execFile);
const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptsDir, '..');
const reportRoot = path.join(repoRoot, 'tests', 'bundle', 'baselines');
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs']);
const forbiddenCoreTargets = [
    ['src/plugins/', 'Feature plugins must depend on Core ports; Core must not import plugins.'],
    ['src/mask/', 'Move the dependency behind a capability instead of importing Mask from Core.'],
    ['src/crop/', 'Move the dependency behind a capability instead of importing Crop from Core.'],
    [
        'src/mosaic/',
        'Move the dependency behind a capability instead of importing Mosaic from Core.',
    ],
    [
        'src/annotation/',
        'Move the dependency behind a capability instead of importing Annotation from Core.',
    ],
    [
        'src/history/',
        'Move the dependency behind a capability instead of importing History from Core.',
    ],
    [
        'src/image/image-filters',
        'Move filter behavior behind a capability instead of importing it from Core.',
    ],
    [
        'src/image/transform-controller',
        'Core may expose generic operation primitives but must not import the Transform controller.',
    ],
    [
        'src/overlay/overlay-state',
        'Keep the existing overlay-state implementation outside the new Core boundary.',
    ],
    ['src/ui/', 'DOM controls belong above Core and must not be imported by Core.'],
];
const featureMatchers = {
    history: (file) => file.startsWith('src/history/'),
    transform: (file) =>
        file.startsWith('src/image/transform-') || file === 'src/image/overlay-transform-delta.ts',
    mask: (file) => file.startsWith('src/mask/'),
    crop: (file) => file.startsWith('src/crop/'),
    mosaic: (file) => file.startsWith('src/mosaic/'),
    filters: (file) => file === 'src/image/image-filters.ts',
    annotation: (file) => file.startsWith('src/annotation/'),
    domBindings: (file) => file.startsWith('src/ui/'),
};

function parseArguments(argv) {
    const options = { packageRoot: repoRoot, reportName: null };
    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        if (argument === '--package-root') {
            options.packageRoot = path.resolve(argv[index + 1] ?? '');
            index += 1;
        } else if (argument === '--update-report') {
            options.reportName = argv[index + 1] ?? '';
            index += 1;
        } else {
            throw new Error(`Unknown argument: ${argument}`);
        }
    }
    if (options.reportName && !/^[a-z0-9][a-z0-9.-]*$/i.test(options.reportName)) {
        throw new Error(`Invalid report name: ${options.reportName}`);
    }
    return options;
}

function toPosix(value) {
    return value.split(path.sep).join('/');
}

function relativeTo(root, filePath) {
    return toPosix(path.relative(root, filePath));
}

function isInside(root, filePath) {
    const relative = path.relative(root, filePath);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function collectSourceFiles(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(
        entries.map(async (entry) => {
            const entryPath = path.join(directory, entry.name);
            if (entry.isDirectory()) return collectSourceFiles(entryPath);
            if (!entry.isFile()) return [];
            if (entry.name.endsWith('.d.ts')) return [];
            return sourceExtensions.has(path.extname(entry.name)) ? [path.resolve(entryPath)] : [];
        }),
    );
    return nested.flat().sort();
}

function readCompilerOptions(packageRoot) {
    const configPath = path.join(packageRoot, 'tsconfig.json');
    const config = ts.readConfigFile(configPath, ts.sys.readFile);
    if (config.error) {
        throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
    }
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, packageRoot);
    if (parsed.errors.length > 0) {
        throw new Error(
            parsed.errors
                .map((error) => ts.flattenDiagnosticMessageText(error.messageText, '\n'))
                .join('\n'),
        );
    }
    return parsed.options;
}

function collectSpecifiers(sourceText, fileName) {
    const sourceFile = ts.createSourceFile(
        fileName,
        sourceText,
        ts.ScriptTarget.Latest,
        true,
        fileName.endsWith('.ts') || fileName.endsWith('.mts') || fileName.endsWith('.cts')
            ? ts.ScriptKind.TS
            : ts.ScriptKind.JS,
    );
    const specifiers = [];

    function addLiteral(node) {
        if (node && ts.isStringLiteralLike(node)) specifiers.push(node.text);
    }

    function visit(node) {
        if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
            addLiteral(node.moduleSpecifier);
        } else if (
            ts.isCallExpression(node) &&
            node.expression.kind === ts.SyntaxKind.ImportKeyword
        ) {
            addLiteral(node.arguments[0]);
        } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
            addLiteral(node.argument.literal);
        }
        ts.forEachChild(node, visit);
    }

    visit(sourceFile);
    return specifiers;
}

function resolveImport(specifier, sourceFile, compilerOptions) {
    return ts.resolveModuleName(specifier, sourceFile, compilerOptions, ts.sys).resolvedModule
        ?.resolvedFileName;
}

function findStronglyConnectedComponents(graph) {
    let nextIndex = 0;
    const stack = [];
    const indexes = new Map();
    const lowLinks = new Map();
    const onStack = new Set();
    const components = [];

    function visit(node) {
        indexes.set(node, nextIndex);
        lowLinks.set(node, nextIndex);
        nextIndex += 1;
        stack.push(node);
        onStack.add(node);

        for (const target of graph.get(node) ?? []) {
            if (!indexes.has(target)) {
                visit(target);
                lowLinks.set(node, Math.min(lowLinks.get(node), lowLinks.get(target)));
            } else if (onStack.has(target)) {
                lowLinks.set(node, Math.min(lowLinks.get(node), indexes.get(target)));
            }
        }

        if (lowLinks.get(node) !== indexes.get(node)) return;
        const component = [];
        let current;
        do {
            current = stack.pop();
            onStack.delete(current);
            component.push(current);
        } while (current !== node);
        const hasSelfEdge = component.length === 1 && (graph.get(node) ?? new Set()).has(node);
        if (component.length > 1 || hasSelfEdge) components.push(component.sort());
    }

    for (const node of [...graph.keys()].sort()) {
        if (!indexes.has(node)) visit(node);
    }
    return components.sort((left, right) => left[0].localeCompare(right[0]));
}

function getReachable(graph, entry) {
    if (!graph.has(entry)) return new Set();
    const visited = new Set();
    const pending = [entry];
    while (pending.length > 0) {
        const current = pending.pop();
        if (visited.has(current)) continue;
        visited.add(current);
        for (const target of graph.get(current) ?? []) pending.push(target);
    }
    return visited;
}

async function getGitCommit(packageRoot) {
    try {
        const { stdout } = await execFileAsync('git', ['-C', packageRoot, 'rev-parse', 'HEAD']);
        return stdout.trim();
    } catch {
        return 'unknown';
    }
}

async function analyze(packageRoot) {
    const sourceRoot = path.join(packageRoot, 'src');
    const files = await collectSourceFiles(sourceRoot);
    const sourceSet = new Set(files);
    const compilerOptions = readCompilerOptions(packageRoot);
    const graph = new Map(files.map((file) => [file, new Set()]));
    const externalImports = new Map(files.map((file) => [file, new Set()]));
    const violations = [];
    let importCount = 0;

    for (const sourceFile of files) {
        const sourceRelative = relativeTo(packageRoot, sourceFile);
        const sourceText = await readFile(sourceFile, 'utf8');
        for (const specifier of collectSpecifiers(sourceText, sourceFile)) {
            importCount += 1;
            const resolved = resolveImport(specifier, sourceFile, compilerOptions);
            const resolvedPath = resolved ? path.resolve(resolved) : null;
            const targetRelative =
                resolvedPath && isInside(packageRoot, resolvedPath)
                    ? relativeTo(packageRoot, resolvedPath)
                    : null;

            if (resolvedPath && sourceSet.has(resolvedPath)) {
                graph.get(sourceFile).add(resolvedPath);
            } else if (!specifier.startsWith('.') && !targetRelative?.startsWith('src/')) {
                externalImports
                    .get(sourceFile)
                    .add(
                        specifier.split('/')[0].startsWith('@')
                            ? specifier.split('/').slice(0, 2).join('/')
                            : specifier.split('/')[0],
                    );
            }

            if (sourceRelative.startsWith('src/plugin-kernel/')) {
                if (specifier === 'fabric' || specifier.startsWith('fabric/')) {
                    violations.push({
                        sourceFile: sourceRelative,
                        forbiddenImport: specifier,
                        rule: 'plugin-kernel-renderer-isolation',
                        recommendation:
                            'Keep the Plugin Kernel independent from Fabric and renderer APIs.',
                    });
                }
                if (
                    targetRelative?.startsWith('src/') &&
                    !targetRelative.startsWith('src/plugin-kernel/')
                ) {
                    violations.push({
                        sourceFile: sourceRelative,
                        forbiddenImport: specifier,
                        rule: 'plugin-kernel-source-isolation',
                        recommendation:
                            'Depend only on Plugin Kernel modules or renderer-neutral third-party utilities.',
                    });
                }
            }

            if (sourceRelative.startsWith('src/core/') && targetRelative) {
                for (const [prefix, recommendation] of forbiddenCoreTargets) {
                    if (targetRelative.startsWith(prefix)) {
                        violations.push({
                            sourceFile: sourceRelative,
                            forbiddenImport: specifier,
                            rule: 'core-does-not-import-features',
                            recommendation,
                        });
                    }
                }
            }

            if (
                sourceRelative === 'src/index.ts' &&
                targetRelative?.startsWith('src/plugin-kernel/')
            ) {
                violations.push({
                    sourceFile: sourceRelative,
                    forbiddenImport: specifier,
                    rule: 'kernel-entry-isolation',
                    recommendation:
                        'Keep the internal Kernel test entry out of the package-root barrel.',
                });
            }
        }
    }

    if (packageRoot === repoRoot) {
        const kernelFixture = path.join(
            repoRoot,
            'tests',
            'bundle',
            'fixtures',
            'plugin-kernel',
            'index.mjs',
        );
        try {
            const fixtureText = await readFile(kernelFixture, 'utf8');
            for (const specifier of collectSpecifiers(fixtureText, kernelFixture)) {
                if (specifier !== '@bensitu/image-editor/plugin-kernel-internal') {
                    violations.push({
                        sourceFile: relativeTo(repoRoot, kernelFixture),
                        forbiddenImport: specifier,
                        rule: 'kernel-fixture-entry-isolation',
                        recommendation:
                            'The fixture may import only the internal Plugin Kernel test alias, never a root or feature entry.',
                    });
                }
            }
        } catch {
            // The Phase 0 release baseline legitimately predates the Kernel fixture.
        }
    }

    const entry = path.join(sourceRoot, 'index.ts');
    const reachable = getReachable(graph, entry);
    const reachableRelative = [...reachable].map((file) => relativeTo(packageRoot, file)).sort();
    const reachableExternals = new Set();
    for (const file of reachable) {
        for (const dependency of externalImports.get(file) ?? [])
            reachableExternals.add(dependency);
    }
    const kernelEntry = path.join(sourceRoot, 'plugin-kernel', 'index.ts');
    const kernelReachable = getReachable(graph, kernelEntry);

    return {
        schemaVersion: 1,
        metadata: {
            packageVersion: JSON.parse(
                await readFile(path.join(packageRoot, 'package.json'), 'utf8'),
            ).version,
            gitCommit: await getGitCommit(packageRoot),
            generatedAt: new Date().toISOString(),
        },
        entry: 'src/index.ts',
        sourceFileCount: files.length,
        importCount,
        reachableModuleCount: reachable.size,
        reachableModules: reachableRelative,
        externalDependencies: [...reachableExternals].sort(),
        fabricExternal: reachableExternals.has('fabric'),
        featureReachability: Object.fromEntries(
            Object.entries(featureMatchers).map(([name, matches]) => [
                name,
                reachableRelative.some(matches),
            ]),
        ),
        cycles: findStronglyConnectedComponents(graph).map((component) =>
            component.map((file) => relativeTo(packageRoot, file)),
        ),
        pluginKernel: {
            present: graph.has(kernelEntry),
            moduleCount: kernelReachable.size,
            modules: [...kernelReachable].map((file) => relativeTo(packageRoot, file)).sort(),
            importsOutsideKernel: [...kernelReachable]
                .map((file) => relativeTo(packageRoot, file))
                .filter((file) => !file.startsWith('src/plugin-kernel/')),
        },
        violations,
    };
}

async function updateReport(name, report) {
    const outputPath = path.join(reportRoot, `${name}.json`);
    await mkdir(reportRoot, { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(report, null, 4)}\n`, 'utf8');
    console.warn(`Updated architecture report: ${relativeTo(repoRoot, outputPath)}`);
}

const options = parseArguments(process.argv.slice(2));
const report = await analyze(options.packageRoot);
if (options.reportName) await updateReport(options.reportName, report);

if (report.violations.length > 0) {
    console.error('Architecture check failed:');
    for (const violation of report.violations) {
        console.error(
            `- ${violation.sourceFile}: import "${violation.forbiddenImport}" violates ${violation.rule}. ${violation.recommendation}`,
        );
    }
    process.exitCode = 1;
} else {
    console.log(
        `Architecture check passed (${report.sourceFileCount} files, ${report.importCount} imports, ${report.cycles.length} cycles).`,
    );
}
