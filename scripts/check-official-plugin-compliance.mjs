/**
 * Verifies that maintained Plugins consume only public authoring contracts.
 *
 * @module
 */

import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import ts from 'typescript';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const evidencePath = path.join(
    repositoryRoot,
    'docs',
    'refactor',
    'stage-2',
    'evidence',
    'official-plugin-imports.generated.json',
);
const sourceRoots = [
    'src/plugins/transform',
    'src/plugins/history',
    'src/plugins/filters',
    'src/foundations/overlay',
    'src/foundations/annotation',
    'src/plugins/mask',
    'src/plugins/crop',
    'src/plugins/mosaic',
    'src/plugins/annotation-text',
    'src/plugins/annotation-shape',
    'src/plugins/annotation-draw',
    'src/plugins/overlay-state',
    'src/plugins/dom-controls',
];
const publicSourceEntries = new Set([
    'src/core/index.ts',
    'src/sdk/index.ts',
    'src/foundations/overlay/index.ts',
    'src/foundations/annotation/index.ts',
]);
const publicSafeUtilities = new Set([
    'src/fabric/fabric-animation.ts',
    'src/mask/mask-factory.ts',
    'src/mask/mask-label-manager.ts',
    'src/mask/mask-style.ts',
    'src/utils/safe-object-key.ts',
]);
const permissionRequirements = new Map([
    ['FABRIC_RUNTIME_CAPABILITY', 'fabric:objects'],
    ['CANVAS_READ_CAPABILITY', 'fabric:canvas-read'],
    ['RASTER_MUTATION_CAPABILITY', 'core:raster-mutation'],
    ['GEOMETRY_MUTATION_CAPABILITY', 'core:geometry-participant'],
    ['EXPORT_CONTRIBUTION_CAPABILITY', 'core:export-contributor'],
    ['OVERLAY_REGISTRATION_CAPABILITY', 'fabric:custom-class'],
]);
const retainedRegistrationMethods = new Set([
    'registerExportRenderer',
    'registerExternalObject',
    'registerGeometryPolicy',
    'registerHistoryProvider',
    'registerInteractionPolicy',
    'registerKind',
    'registerObjectProperties',
    'registerSlice',
    'registerTransientObject',
]);

function toRepositoryPath(filePath) {
    return path.relative(repositoryRoot, filePath).replaceAll('\\', '/');
}

async function collectFiles(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) files.push(...(await collectFiles(entryPath)));
        else if (entry.isFile() && /\.(?:cts|mts|tsx?|mjs)$/u.test(entry.name)) {
            files.push(entryPath);
        }
    }
    return files.sort();
}

function stringValue(node) {
    return node && ts.isStringLiteralLike(node) ? node.text : null;
}

function methodName(call) {
    if (ts.isPropertyAccessExpression(call.expression)) return call.expression.name.text;
    return null;
}

function importedNames(node) {
    if (!ts.isImportDeclaration(node) || !node.importClause) return [];
    const names = [];
    if (node.importClause.name) names.push(node.importClause.name.text);
    const bindings = node.importClause.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) names.push(element.name.text);
    }
    return names;
}

function importSpecifier(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        return stringValue(node.moduleSpecifier);
    }
    if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
        return stringValue(node.argument.literal);
    }
    if (
        ts.isCallExpression(node) &&
        node.arguments.length === 1 &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
            (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
    ) {
        return stringValue(node.arguments[0]);
    }
    return null;
}

function resolveSourceImport(file, specifier) {
    if (!specifier.startsWith('.')) return null;
    const candidate = path.resolve(path.dirname(file), specifier);
    const extension = path.extname(candidate);
    const replacements = extension === '.js' ? ['.ts', '.tsx', '.mts'] : [extension, '.ts'];
    for (const replacement of replacements) {
        const resolved = extension
            ? candidate.slice(0, -extension.length) + replacement
            : candidate + replacement;
        if (ts.sys.fileExists(resolved)) return toRepositoryPath(resolved);
    }
    return toRepositoryPath(candidate);
}

function belongsToSourceRoot(sourcePath) {
    return sourceRoots.some((root) => sourcePath === root || sourcePath.startsWith(`${root}/`));
}

function isPublicImport(sourcePath) {
    return (
        belongsToSourceRoot(sourcePath) ||
        publicSourceEntries.has(sourcePath) ||
        publicSafeUtilities.has(sourcePath)
    );
}

function position(sourceFile, node) {
    const location = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    return Object.freeze({ line: location.line + 1, column: location.character + 1 });
}

function diagnostic(file, sourceFile, node, ruleId, message) {
    return Object.freeze({
        ruleId,
        file: toRepositoryPath(file),
        ...position(sourceFile, node),
        message,
    });
}

function hasRetentionAncestor(node) {
    let current = node.parent;
    while (current && !ts.isExpressionStatement(current)) {
        if (ts.isCallExpression(current)) {
            const name = methodName(current);
            if (name === 'add' || name === 'push') return true;
        }
        if (
            ts.isVariableDeclaration(current) ||
            ts.isBinaryExpression(current) ||
            ts.isReturnStatement(current)
        ) {
            return true;
        }
        current = current.parent;
    }
    return false;
}

function eventSignature(call) {
    const event = stringValue(call.arguments[0]);
    const handler = call.arguments[1];
    if (!event || !handler) return null;
    const handlerText = handler.getText();
    return `${event}:${handlerText}`;
}

function collectManifestFacts(sourceFile) {
    const permissions = new Set();
    const requirements = [];
    const visit = (node) => {
        if (
            ts.isPropertyAssignment(node) &&
            ((ts.isIdentifier(node.name) && node.name.text === 'permissions') ||
                (ts.isStringLiteralLike(node.name) && node.name.text === 'permissions')) &&
            ts.isArrayLiteralExpression(node.initializer)
        ) {
            for (const element of node.initializer.elements) {
                const permission = stringValue(element);
                if (permission) permissions.add(permission);
            }
        }
        if (
            ts.isPropertyAssignment(node) &&
            ((ts.isIdentifier(node.name) && node.name.text === 'requires') ||
                (ts.isStringLiteralLike(node.name) && node.name.text === 'requires')) &&
            ts.isArrayLiteralExpression(node.initializer)
        ) {
            for (const element of node.initializer.elements) {
                if (!ts.isObjectLiteralExpression(element)) continue;
                const token = element.properties.find(
                    (property) =>
                        ts.isPropertyAssignment(property) &&
                        ((ts.isIdentifier(property.name) && property.name.text === 'token') ||
                            (ts.isStringLiteralLike(property.name) &&
                                property.name.text === 'token')),
                );
                if (token && ts.isPropertyAssignment(token) && ts.isIdentifier(token.initializer)) {
                    requirements.push({ name: token.initializer.text, node: token.initializer });
                }
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    return { permissions, requirements };
}

async function inspectFile(file) {
    const text = await readFile(file, 'utf8');
    const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const diagnostics = [];
    const eventSubscriptions = new Map();
    const eventRemovals = new Set();
    const manifest = collectManifestFacts(sourceFile);

    const visit = (node) => {
        const specifier = importSpecifier(node);
        if (specifier) {
            const resolved = resolveSourceImport(file, specifier);
            if (resolved && !isPublicImport(resolved)) {
                diagnostics.push(
                    diagnostic(
                        file,
                        sourceFile,
                        node,
                        'official-public-imports-only',
                        `Official Plugin source imports private module "${resolved}".`,
                    ),
                );
            }
            if (ts.isImportDeclaration(node)) {
                for (const name of importedNames(node)) {
                    if (
                        name.endsWith('_CAPABILITY') &&
                        resolved !== 'src/sdk/index.ts' &&
                        resolved !== 'src/foundations/overlay/index.ts' &&
                        resolved !== 'src/foundations/annotation/index.ts' &&
                        !resolved?.startsWith(toRepositoryPath(path.dirname(file)))
                    ) {
                        diagnostics.push(
                            diagnostic(
                                file,
                                sourceFile,
                                node,
                                'official-public-capabilities-only',
                                `Capability "${name}" is not imported from a public authoring entry.`,
                            ),
                        );
                    }
                }
            }
        }

        if (ts.isIdentifier(node) && node.text === 'CORE_ENVIRONMENT_CAPABILITY') {
            diagnostics.push(
                diagnostic(
                    file,
                    sourceFile,
                    node,
                    'official-narrow-host-access',
                    'Official Plugins must request narrow host capabilities.',
                ),
            );
        }
        if (ts.isIdentifier(node) && node.text === 'CoreEnvironmentPort') {
            diagnostics.push(
                diagnostic(
                    file,
                    sourceFile,
                    node,
                    'official-narrow-host-access',
                    'Official Plugin controllers must depend on narrow host ports.',
                ),
            );
        }
        if (
            ts.isPropertyAccessExpression(node) &&
            node.name.text === 'options' &&
            ts.isIdentifier(node.expression) &&
            (node.expression.text === 'host' || node.expression.text === 'environment')
        ) {
            diagnostics.push(
                diagnostic(
                    file,
                    sourceFile,
                    node,
                    'official-narrow-host-access',
                    'Official Plugin code must not read the complete host option object.',
                ),
            );
        }

        if (ts.isCallExpression(node)) {
            const name = methodName(node);
            if (name === 'on') {
                const signature = eventSignature(node);
                if (signature && !hasRetentionAncestor(node)) {
                    eventSubscriptions.set(signature, node);
                }
            } else if (name === 'off') {
                const signature = eventSignature(node);
                if (signature) eventRemovals.add(signature);
            } else if (
                name &&
                retainedRegistrationMethods.has(name) &&
                !hasRetentionAncestor(node)
            ) {
                diagnostics.push(
                    diagnostic(
                        file,
                        sourceFile,
                        node,
                        'official-registration-cleanup',
                        `Registration returned by "${name}" is not retained for disposal.`,
                    ),
                );
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(sourceFile);

    for (const [signature, node] of eventSubscriptions) {
        if (!eventRemovals.has(signature)) {
            diagnostics.push(
                diagnostic(
                    file,
                    sourceFile,
                    node,
                    'official-registration-cleanup',
                    `Event subscription "${signature}" has no matching removal.`,
                ),
            );
        }
    }
    for (const requirement of manifest.requirements) {
        const permission = permissionRequirements.get(requirement.name);
        if (permission && !manifest.permissions.has(permission)) {
            diagnostics.push(
                diagnostic(
                    file,
                    sourceFile,
                    requirement.node,
                    'official-declared-permissions',
                    `Capability "${requirement.name}" requires permission "${permission}".`,
                ),
            );
        }
    }

    return Object.freeze({ file: toRepositoryPath(file), diagnostics });
}

export async function inspectOfficialPlugins() {
    const files = (
        await Promise.all(sourceRoots.map((root) => collectFiles(path.join(repositoryRoot, root))))
    ).flat();
    const inspections = await Promise.all(files.map((file) => inspectFile(file)));
    const diagnostics = inspections.flatMap((inspection) => inspection.diagnostics);
    const count = (ruleId) => diagnostics.filter((item) => item.ruleId === ruleId).length;
    const result = Object.freeze({
        schemaVersion: 1,
        result: diagnostics.length === 0 ? 'PASS' : 'FAIL',
        entries: Object.freeze([...sourceRoots]),
        filesChecked: files.length,
        summary: Object.freeze({
            officialPluginInternalImports: count('official-public-imports-only'),
            officialPluginUndeclaredPermissions: count('official-declared-permissions'),
            officialPluginHiddenCoreCapabilities: count('official-public-capabilities-only'),
            officialPluginBroadMutableHostAccess: count('official-narrow-host-access'),
            officialPluginSetupLeaks: count('official-registration-cleanup'),
        }),
        diagnostics: Object.freeze(diagnostics),
    });
    return result;
}

async function main() {
    const mode = process.argv[2] ?? '--check';
    if (!['--check', '--generate'].includes(mode) || process.argv.length > 3) {
        throw new Error('Use --check or --generate.');
    }
    const result = await inspectOfficialPlugins();
    if (mode === '--generate') {
        await mkdir(path.dirname(evidencePath), { recursive: true });
        await writeFile(evidencePath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    }
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (result.result !== 'PASS') process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
    main().catch((error) => {
        process.stderr.write(`${error.stack ?? error}\n`);
        process.exitCode = 1;
    });
}
