/**
 * Freezes the declarations, runtime entries, protocol identities, UMD namespace,
 * and codemod CLI that make up the supported public surface.
 *
 * @module
 */

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

import ts from 'typescript';

const execFileAsync = promisify(execFile);
const scriptsRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptsRoot, '..');
const snapshotPath = path.join(repositoryRoot, 'config', 'release', 'public-api.json');
const require = createRequire(import.meta.url);
const expectedEntries = Object.freeze([
    '.',
    './core',
    './sdk',
    './testing',
    './plugins/transform',
    './plugins/history',
    './plugins/overlay',
    './plugins/mask',
    './plugins/filters',
    './plugins/crop',
    './plugins/mosaic',
    './plugins/annotation',
    './plugins/annotation-text',
    './plugins/annotation-shape',
    './plugins/annotation-draw',
    './plugins/overlay-state',
    './plugins/dom-controls',
    './presets/minimal',
    './presets/redaction',
    './presets/annotation',
    './presets/full',
    './migrate-v2',
]);

function sha256(value) {
    return createHash('sha256').update(value).digest('hex');
}

function normalizedPath(value) {
    return value.replaceAll('\\', '/');
}

function stableJson(value) {
    return `${JSON.stringify(value, null, 4)}\n`;
}

function declarationText(value) {
    return value.replace(/\/\/# sourceMappingURL=.*(?:\r?\n)?$/gmu, '').replaceAll('\r\n', '\n');
}

function conditionTarget(entry, condition, field) {
    const branch = entry?.[condition];
    if (!branch || typeof branch !== 'object' || typeof branch[field] !== 'string') {
        throw new Error(`Package entry is missing ${condition}.${field}.`);
    }
    return branch[field];
}

function absolutePackagePath(packagePath) {
    if (!packagePath.startsWith('./')) throw new Error(`Invalid package path: ${packagePath}`);
    const absolute = path.resolve(repositoryRoot, packagePath.slice(2));
    if (!absolute.startsWith(`${repositoryRoot}${path.sep}`)) {
        throw new Error(`Package path escapes the repository: ${packagePath}`);
    }
    return absolute;
}

function sourceFileExports(checker, sourceFile) {
    const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
    if (!moduleSymbol)
        throw new Error(`Declaration entry has no module symbol: ${sourceFile.fileName}`);
    return checker
        .getExportsOfModule(moduleSymbol)
        .map((symbol) => {
            const target =
                symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
            const kinds = [
                ...new Set(
                    (target.declarations ?? symbol.declarations ?? []).map(
                        (declaration) => ts.SyntaxKind[declaration.kind],
                    ),
                ),
            ].sort();
            return Object.freeze({ name: symbol.getName(), kinds: Object.freeze(kinds) });
        })
        .sort((left, right) => left.name.localeCompare(right.name));
}

function diagnosticsFor(program) {
    return ts
        .getPreEmitDiagnostics(program)
        .filter((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error)
        .map((diagnostic) => {
            const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
            if (!diagnostic.file || diagnostic.start === undefined) {
                return `TS${diagnostic.code}: ${message}`;
            }
            const position = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
            return `${normalizedPath(path.relative(repositoryRoot, diagnostic.file.fileName))}:${position.line + 1}:${position.character + 1} TS${diagnostic.code}: ${message}`;
        });
}

async function runtimeExports(importPath, requirePath) {
    const esm = await import(`${pathToFileURL(importPath).href}?public-api-check=1`);
    const cjs = require(requirePath);
    const esmKeys = Object.keys(esm).sort();
    const cjsKeys = Object.keys(cjs).sort();
    if (JSON.stringify(esmKeys) !== JSON.stringify(cjsKeys)) {
        throw new Error(
            `ESM/CJS runtime export mismatch for ${normalizedPath(path.relative(repositoryRoot, importPath))}.`,
        );
    }
    return Object.freeze(esmKeys);
}

async function loadUmdNamespace() {
    const source = await readFile(
        path.join(repositoryRoot, 'dist', 'umd', 'image-editor.full.umd.js'),
        'utf8',
    );
    const context = vm.createContext(Object.create(null));
    vm.runInContext(source, context, { filename: 'image-editor.full.umd.js' });
    const namespace = context.ImageEditorFull;
    if (!namespace || typeof namespace !== 'object') {
        throw new Error('ImageEditorFull UMD namespace is unavailable.');
    }
    if ('ImageEditor' in namespace || 'default' in namespace) {
        throw new Error('ImageEditorFull exposes a removed facade alias.');
    }
    const pluginRefs = [];
    const capabilities = [];
    for (const [name, value] of Object.entries(namespace)) {
        if (!value || typeof value !== 'object' || typeof value.id !== 'string') continue;
        if (typeof value.apiVersion === 'string') {
            pluginRefs.push(Object.freeze({ name, id: value.id, apiVersion: value.apiVersion }));
        } else if (typeof value.version === 'string') {
            capabilities.push(Object.freeze({ name, id: value.id, version: value.version }));
        }
    }
    const byName = (left, right) => left.name.localeCompare(right.name);
    return Object.freeze({
        globalName: 'ImageEditorFull',
        exports: Object.freeze(Object.keys(namespace).sort()),
        pluginRefs: Object.freeze(pluginRefs.sort(byName)),
        capabilities: Object.freeze(capabilities.sort(byName)),
        coreApiVersion: namespace.CORE_API_VERSION,
        overlayStateWireVersion: namespace.OVERLAY_STATE_WIRE_VERSION,
    });
}

async function buildSnapshot() {
    const packageJson = JSON.parse(
        await readFile(path.join(repositoryRoot, 'package.json'), 'utf8'),
    );
    const codemodRoot = path.join(repositoryRoot, 'packages', 'image-editor-codemod');
    const codemodPackage = JSON.parse(
        await readFile(path.join(codemodRoot, 'package.json'), 'utf8'),
    );
    const actualEntries = Object.keys(packageJson.exports ?? {});
    if (JSON.stringify([...actualEntries].sort()) !== JSON.stringify([...expectedEntries].sort())) {
        throw new Error(
            `Formal export map differs from policy. Expected ${expectedEntries.join(', ')}.`,
        );
    }

    const apiDocumentationPath = path.join(repositoryRoot, 'docs', 'api.md');
    const apiDocumentation = await readFile(apiDocumentationPath, 'utf8');
    const undocumentedFormalEntries = expectedEntries.filter((entry) => {
        const specifier = entry === '.' ? packageJson.name : `${packageJson.name}${entry.slice(1)}`;
        return !apiDocumentation.includes(`\`${specifier}\``);
    });
    if (undocumentedFormalEntries.length > 0) {
        throw new Error(
            `Formal entries missing from docs/api.md: ${undocumentedFormalEntries.join(', ')}.`,
        );
    }

    const entryPaths = expectedEntries.map((entryName) => {
        const entry = packageJson.exports[entryName];
        return Object.freeze({
            name: entryName,
            import: conditionTarget(entry, 'import', 'default'),
            require: conditionTarget(entry, 'require', 'default'),
            importTypes: conditionTarget(entry, 'import', 'types'),
            requireTypes: conditionTarget(entry, 'require', 'types'),
        });
    });
    const umdTypesPath = path.join(repositoryRoot, 'src', 'umd', 'full.ts');
    const codemodTypesPath = path.join(codemodRoot, codemodPackage.types.replace(/^\.\//u, ''));
    const rootNames = [
        ...entryPaths.flatMap((entry) => [
            absolutePackagePath(entry.importTypes),
            absolutePackagePath(entry.requireTypes),
        ]),
        umdTypesPath,
        codemodTypesPath,
    ];
    const program = ts.createProgram({
        rootNames,
        options: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.NodeNext,
            moduleResolution: ts.ModuleResolutionKind.NodeNext,
            strict: true,
            noEmit: true,
            skipLibCheck: false,
            types: ['node'],
        },
    });
    const diagnostics = diagnosticsFor(program);
    if (diagnostics.length > 0) {
        throw new Error(`Public declaration diagnostics:\n${diagnostics.join('\n')}`);
    }
    const checker = program.getTypeChecker();
    const formalEntries = {};
    for (const entry of entryPaths) {
        const importPath = absolutePackagePath(entry.import);
        const requirePath = absolutePackagePath(entry.require);
        const importTypesPath = absolutePackagePath(entry.importTypes);
        const requireTypesPath = absolutePackagePath(entry.requireTypes);
        const importDeclaration = declarationText(await readFile(importTypesPath, 'utf8'));
        const requireDeclaration = declarationText(await readFile(requireTypesPath, 'utf8'));
        if (importDeclaration !== requireDeclaration) {
            throw new Error(`${entry.name} ESM/CJS declarations differ.`);
        }
        const importSource = program.getSourceFile(importTypesPath);
        const requireSource = program.getSourceFile(requireTypesPath);
        if (!importSource || !requireSource) {
            throw new Error(`${entry.name} declaration source is unavailable.`);
        }
        const importExports = sourceFileExports(checker, importSource);
        const requireExports = sourceFileExports(checker, requireSource);
        if (JSON.stringify(importExports) !== JSON.stringify(requireExports)) {
            throw new Error(`${entry.name} ESM/CJS type exports differ.`);
        }
        formalEntries[entry.name] = Object.freeze({
            import: entry.import,
            require: entry.require,
            importTypes: entry.importTypes,
            requireTypes: entry.requireTypes,
            exports: Object.freeze(importExports),
            runtimeExports: await runtimeExports(importPath, requirePath),
        });
    }

    const declarationRoot = path.join(repositoryRoot, 'dist', 'types');
    const normalizedDeclarationRoot = `${normalizedPath(declarationRoot)}/`;
    const declarationFiles = await Promise.all(
        program
            .getSourceFiles()
            .filter(
                (sourceFile) =>
                    normalizedPath(sourceFile.fileName).startsWith(normalizedDeclarationRoot) &&
                    sourceFile.fileName.endsWith('.d.ts'),
            )
            .map(async (sourceFile) => {
                const relative = normalizedPath(path.relative(repositoryRoot, sourceFile.fileName));
                const content = declarationText(await readFile(sourceFile.fileName, 'utf8'));
                for (const specifier of sourceFile.imports) {
                    const value = specifier.text;
                    if (value.startsWith(`${packageJson.name}/`)) {
                        const entry = `./${value.slice(packageJson.name.length + 1)}`;
                        if (!packageJson.exports[entry]) {
                            throw new Error(`${relative} imports private package path ${value}.`);
                        }
                    }
                }
                return Object.freeze({ file: relative, sha256: sha256(content) });
            }),
    );
    declarationFiles.sort((left, right) => left.file.localeCompare(right.file));
    const declarationGraphSha256 = sha256(
        declarationFiles.map((file) => `${file.file}:${file.sha256}`).join('\n'),
    );

    const umdSource = program.getSourceFile(umdTypesPath);
    const codemodSource = program.getSourceFile(codemodTypesPath);
    if (!umdSource || !codemodSource) throw new Error('UMD or codemod declaration is unavailable.');
    const umd = await loadUmdNamespace();
    const umdTypeExports = sourceFileExports(checker, umdSource);
    const missingUmdTypes = umd.exports.filter(
        (name) => !umdTypeExports.some((typeExport) => typeExport.name === name),
    );
    if (missingUmdTypes.length > 0) {
        throw new Error(`UMD runtime exports lack declarations: ${missingUmdTypes.join(', ')}.`);
    }

    const codemodRuntime = await import(
        `${pathToFileURL(path.join(codemodRoot, codemodPackage.main.replace(/^\.\//u, ''))).href}?public-api-check=1`
    );
    const { stdout: codemodHelp } = await execFileAsync(
        process.execPath,
        [
            path.join(
                codemodRoot,
                codemodPackage.bin['image-editor-codemod'].replace(/^\.\//u, ''),
            ),
            '--help',
        ],
        { cwd: repositoryRoot, encoding: 'utf8', windowsHide: true },
    );

    const migration = await import(
        `${pathToFileURL(path.join(repositoryRoot, 'dist', 'esm', 'migrate-v2', 'index.js')).href}?public-api-check=1`
    );
    const currentDetection = migration.detectSnapshotVersion({
        schema: 'image-editor.state',
        version: 3,
    });
    const sourceDetection = migration.detectSnapshotVersion({
        objects: [],
        _editorState: { currentScale: 1, currentRotation: 0, baseImageScale: 1 },
    });
    if (currentDetection.kind !== 'current' || sourceDetection.kind !== 'source') {
        throw new Error('Snapshot schema detection contract is unavailable.');
    }

    return Object.freeze({
        schemaVersion: 1,
        package: packageJson.name,
        formalEntries: Object.freeze(formalEntries),
        documentation: Object.freeze({
            path: 'docs/api.md',
            formalEntryCount: expectedEntries.length,
            undocumentedFormalEntries: Object.freeze(undocumentedFormalEntries),
        }),
        declarations: Object.freeze({
            graphSha256: declarationGraphSha256,
            files: Object.freeze(declarationFiles),
        }),
        frozenContracts: Object.freeze({
            coreApiVersion: umd.coreApiVersion,
            currentSnapshot: Object.freeze({
                schema: currentDetection.schema,
                version: currentDetection.version,
            }),
            migrationSourceSnapshot: Object.freeze({
                schema: sourceDetection.schema,
                version: sourceDetection.version,
            }),
            overlayStateWireVersion: umd.overlayStateWireVersion,
            pluginRefs: umd.pluginRefs,
            capabilities: umd.capabilities,
        }),
        umd: Object.freeze({
            globalName: umd.globalName,
            exports: umd.exports,
            typeExports: Object.freeze(umdTypeExports),
        }),
        codemod: Object.freeze({
            package: codemodPackage.name,
            bin: Object.freeze(codemodPackage.bin),
            exports: Object.freeze(codemodPackage.exports),
            runtimeExports: Object.freeze(Object.keys(codemodRuntime).sort()),
            typeExports: Object.freeze(sourceFileExports(checker, codemodSource)),
            declarationSha256: sha256(declarationText(await readFile(codemodTypesPath, 'utf8'))),
            help: codemodHelp.replaceAll('\r\n', '\n'),
        }),
    });
}

const mode = process.argv[2] ?? '--check';
if (!['--check', '--generate'].includes(mode) || process.argv.length > 3) {
    throw new Error('Use --check or --generate.');
}

try {
    const snapshot = await buildSnapshot();
    const actual = stableJson(snapshot);
    if (mode === '--generate') {
        await writeFile(snapshotPath, actual, 'utf8');
    } else {
        const expected = await readFile(snapshotPath, 'utf8');
        if (expected.replaceAll('\r\n', '\n') !== actual) {
            throw new Error(
                'Public API snapshot changed. Run "npm run generate:public-api" only after compatibility review.',
            );
        }
    }
    console.log(
        `Public API surface: PASS (${expectedEntries.length} formal entries, ${snapshot.declarations.files.length} declaration files, ${snapshot.umd.exports.length} UMD exports).`,
    );
} catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
}
