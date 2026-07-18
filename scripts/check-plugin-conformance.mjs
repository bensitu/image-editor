/**
 * Structural and best-effort checks for external Image Editor Plugin packages.
 *
 * @module
 */

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';

const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts']);
const EXCLUDED_DIRECTORIES = new Set(['.git', 'build', 'coverage', 'dist', 'node_modules', 'out']);
const BEST_EFFORT_NOTICE =
    'Best-effort check; false negatives are possible. Runtime Conformance remains required, and this is not a sandbox.';
const PUBLIC_PACKAGE = '@bensitu/image-editor';
const INTERNAL_IMPORT_PATTERN =
    /(?:^|\/)(?:src|core-runtime|plugin-kernel)(?:\/|$)|(?:^|\/)internal(?:\/|$)/u;
const REGISTRATION_METHODS = new Set([
    'addEventListener',
    'on',
    'registerExportRenderer',
    'registerGeometryPolicy',
    'registerInteractionPolicy',
    'registerKind',
    'registerObjectProperties',
    'registerSlice',
    'registerTransientObject',
]);

function toPosix(value) {
    return value.split(path.sep).join('/');
}

function propertyName(node) {
    const name = node?.name;
    if (!name) return null;
    if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) return name.text;
    return null;
}

function findProperty(object, name) {
    if (!object || !ts.isObjectLiteralExpression(object)) return null;
    return object.properties.find((property) => propertyName(property) === name) ?? null;
}

function propertyValue(property) {
    if (!property) return null;
    if (ts.isPropertyAssignment(property)) return property.initializer;
    return null;
}

function stringValue(node) {
    return node && ts.isStringLiteralLike(node) ? node.text : null;
}

function callMethodName(call) {
    const expression = call.expression;
    if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
    if (
        ts.isElementAccessExpression(expression) &&
        expression.argumentExpression &&
        ts.isStringLiteralLike(expression.argumentExpression)
    ) {
        return expression.argumentExpression.text;
    }
    return null;
}

function sourceKind(file) {
    const extension = path.extname(file).toLowerCase();
    if (extension === '.tsx') return ts.ScriptKind.TSX;
    if (extension === '.jsx') return ts.ScriptKind.JSX;
    if (extension === '.js' || extension === '.mjs' || extension === '.cjs') {
        return ts.ScriptKind.JS;
    }
    return ts.ScriptKind.TS;
}

async function collectSources(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const groups = await Promise.all(
        entries.map(async (entry) => {
            if (entry.isDirectory()) {
                if (EXCLUDED_DIRECTORIES.has(entry.name)) return [];
                return collectSources(path.join(directory, entry.name));
            }
            if (!entry.isFile() || !SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
                return [];
            }
            return [path.join(directory, entry.name)];
        }),
    );
    return groups.flat();
}

function parseSource(file, text) {
    return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, sourceKind(file));
}

function collectDeclaredPermissions(sourceFile) {
    const permissions = new Set();
    const visit = (node) => {
        if (ts.isPropertyAssignment(node) && propertyName(node) === 'permissions') {
            const initializer = node.initializer;
            if (ts.isArrayLiteralExpression(initializer)) {
                for (const element of initializer.elements) {
                    const value = stringValue(element);
                    if (value) permissions.add(value);
                }
            }
        }
        ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    return permissions;
}

function importSpecifier(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        return stringValue(node.moduleSpecifier);
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

function isInternalImport(specifier) {
    if (specifier.startsWith(`${PUBLIC_PACKAGE}/`)) {
        return INTERNAL_IMPORT_PATTERN.test(specifier.slice(PUBLIC_PACKAGE.length + 1));
    }
    if (!specifier.startsWith('.')) return false;
    return INTERNAL_IMPORT_PATTERN.test(specifier.replaceAll('\\', '/'));
}

function lineColumn(sourceFile, node) {
    const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    return { line: position.line + 1, column: position.character + 1 };
}

function jsonLine(text, token) {
    const index = Math.max(0, text.indexOf(`"${token}"`));
    const prefix = text.slice(0, index);
    return prefix.split(/\r?\n/u).length;
}

function makeDiagnostic(root, file, sourceFile, node, details) {
    const position =
        sourceFile && node ? lineColumn(sourceFile, node) : { line: details.line ?? 1, column: 1 };
    return Object.freeze({
        ruleId: details.ruleId,
        category: details.category ?? 'structural',
        severity: details.severity ?? 'error',
        file: toPosix(path.relative(root, file)),
        line: position.line,
        column: position.column,
        message: details.message,
    });
}

function addBestEffort(diagnostics, root, file, sourceFile, node, ruleId, message) {
    diagnostics.push(
        makeDiagnostic(root, file, sourceFile, node, {
            ruleId,
            category: 'best-effort',
            severity: 'warning',
            message: `${message} ${BEST_EFFORT_NOTICE}`,
        }),
    );
}

function inspectPersistenceCall(diagnostics, root, file, sourceFile, call, permissions) {
    if (!permissions.has('fabric:custom-class')) {
        diagnostics.push(
            makeDiagnostic(root, file, sourceFile, call, {
                ruleId: 'require-declared-fabric-import-permission',
                message:
                    'Overlay Kind registration requires manifest permission "fabric:custom-class".',
            }),
        );
    }
    const definition = call.arguments[0];
    if (!definition || !ts.isObjectLiteralExpression(definition)) {
        diagnostics.push(
            makeDiagnostic(root, file, sourceFile, call, {
                ruleId: 'require-overlay-persistence-definition',
                message: 'Overlay Kind registration must use a statically declared object.',
            }),
        );
        return;
    }
    const persistence = propertyValue(findProperty(definition, 'persistence'));
    if (!persistence || !ts.isObjectLiteralExpression(persistence)) {
        diagnostics.push(
            makeDiagnostic(root, file, sourceFile, definition, {
                ruleId: 'require-overlay-persistence-definition',
                message: 'Overlay Kind registration must declare persistence.',
            }),
        );
        return;
    }
    const mode = stringValue(propertyValue(findProperty(persistence, 'mode')));
    if (mode === 'transient') return;
    const codec = propertyValue(findProperty(persistence, 'codec'));
    const requiredCodecFields = ['type', 'version', 'serialize', 'validate', 'deserialize'];
    if (
        mode !== 'persistent' ||
        !codec ||
        !ts.isObjectLiteralExpression(codec) ||
        requiredCodecFields.some((field) => !findProperty(codec, field))
    ) {
        diagnostics.push(
            makeDiagnostic(root, file, sourceFile, persistence, {
                ruleId: 'require-overlay-persistence-definition',
                message:
                    'Persistent Overlay Kind registration requires a Codec with type, version, serialize, validate, and deserialize.',
            }),
        );
    }
}

function inspectSource(root, parsed, permissions, diagnostics) {
    const { file, sourceFile } = parsed;
    const visit = (node) => {
        const specifier = importSpecifier(node);
        if (specifier) {
            if (isInternalImport(specifier)) {
                diagnostics.push(
                    makeDiagnostic(root, file, sourceFile, node, {
                        ruleId: 'no-internal-import',
                        message: `Plugin source must use a public package path instead of "${specifier}".`,
                    }),
                );
            }
            if (specifier === 'fabric' && !permissions.has('fabric:objects')) {
                diagnostics.push(
                    makeDiagnostic(root, file, sourceFile, node, {
                        ruleId: 'require-declared-fabric-import-permission',
                        message: 'Importing Fabric requires manifest permission "fabric:objects".',
                    }),
                );
            }
        }

        if (ts.isCallExpression(node)) {
            const method = callMethodName(node);
            if (method === 'registerKind') {
                inspectPersistenceCall(diagnostics, root, file, sourceFile, node, permissions);
            }
            const expressionText = node.expression.getText(sourceFile);
            if (/classRegistry\.(?:setClass|setSVGClass)$/u.test(expressionText)) {
                if (!permissions.has('fabric:custom-class')) {
                    diagnostics.push(
                        makeDiagnostic(root, file, sourceFile, node, {
                            ruleId: 'require-declared-fabric-import-permission',
                            message:
                                'Fabric Class registry access requires manifest permission "fabric:custom-class".',
                        }),
                    );
                }
                addBestEffort(
                    diagnostics,
                    root,
                    file,
                    sourceFile,
                    node,
                    'detect-obvious-class-registry-write',
                    'An obvious Fabric Class registry write was detected.',
                );
            }
            if (
                node.parent &&
                ts.isExpressionStatement(node.parent) &&
                method &&
                REGISTRATION_METHODS.has(method) &&
                !expressionText.startsWith('context.')
            ) {
                addBestEffort(
                    diagnostics,
                    root,
                    file,
                    sourceFile,
                    node,
                    'detect-unhandled-registration-return',
                    `The disposable returned by ${method}() appears to be ignored.`,
                );
            }
        }

        if (
            ts.isBinaryExpression(node) &&
            node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
            node.operatorToken.kind <= ts.SyntaxKind.LastAssignment &&
            /\.prototype(?:\.|\[)/u.test(node.left.getText(sourceFile))
        ) {
            addBestEffort(
                diagnostics,
                root,
                file,
                sourceFile,
                node,
                'detect-obvious-prototype-write',
                'An obvious prototype write was detected.',
            );
        }
        ts.forEachChild(node, visit);
    };
    visit(sourceFile);
}

function inspectPackageJson(root, file, text, value, diagnostics) {
    const peerDependencies = value.peerDependencies ?? {};
    for (const dependency of [PUBLIC_PACKAGE, 'fabric']) {
        if (typeof peerDependencies[dependency] === 'string') continue;
        diagnostics.push(
            makeDiagnostic(root, file, null, null, {
                ruleId: 'require-peer-dependencies',
                line: jsonLine(text, 'peerDependencies'),
                message: `Plugin package peerDependencies must declare "${dependency}".`,
            }),
        );
    }
    const dependencies = value.dependencies ?? {};
    if (Object.prototype.hasOwnProperty.call(dependencies, PUBLIC_PACKAGE)) {
        diagnostics.push(
            makeDiagnostic(root, file, null, null, {
                ruleId: 'no-core-in-dependencies',
                line: jsonLine(text, PUBLIC_PACKAGE),
                message: `Plugin package dependencies must not install "${PUBLIC_PACKAGE}".`,
            }),
        );
    }
    if (Object.prototype.hasOwnProperty.call(dependencies, 'fabric')) {
        diagnostics.push(
            makeDiagnostic(root, file, null, null, {
                ruleId: 'no-fabric-in-dependencies',
                line: jsonLine(text, 'fabric'),
                message: 'Plugin package dependencies must not install "fabric".',
            }),
        );
    }
    const bundled = [
        ...(Array.isArray(value.bundledDependencies) ? value.bundledDependencies : []),
        ...(Array.isArray(value.bundleDependencies) ? value.bundleDependencies : []),
    ];
    if (bundled.includes(PUBLIC_PACKAGE)) {
        diagnostics.push(
            makeDiagnostic(root, file, null, null, {
                ruleId: 'no-core-in-dependencies',
                line: jsonLine(text, 'bundledDependencies'),
                message: `Plugin package must not bundle "${PUBLIC_PACKAGE}".`,
            }),
        );
    }
    if (bundled.includes('fabric')) {
        diagnostics.push(
            makeDiagnostic(root, file, null, null, {
                ruleId: 'no-fabric-in-dependencies',
                line: jsonLine(text, 'bundledDependencies'),
                message: 'Plugin package must not bundle "fabric".',
            }),
        );
    }
}

export async function inspectPluginPackage(packageRoot) {
    const root = path.resolve(packageRoot);
    const packageFile = path.join(root, 'package.json');
    const packageText = await readFile(packageFile, 'utf8');
    const packageValue = JSON.parse(packageText);
    const sourceFiles = (await collectSources(root)).sort();
    const parsed = await Promise.all(
        sourceFiles.map(async (file) => {
            const text = await readFile(file, 'utf8');
            return { file, sourceFile: parseSource(file, text) };
        }),
    );
    const permissions = new Set();
    for (const entry of parsed) {
        for (const permission of collectDeclaredPermissions(entry.sourceFile)) {
            permissions.add(permission);
        }
    }
    const diagnostics = [];
    inspectPackageJson(root, packageFile, packageText, packageValue, diagnostics);
    for (const entry of parsed) inspectSource(root, entry, permissions, diagnostics);
    diagnostics.sort(
        (left, right) =>
            left.file.localeCompare(right.file) ||
            left.line - right.line ||
            left.column - right.column ||
            left.ruleId.localeCompare(right.ruleId),
    );
    return Object.freeze({
        profile: '3.0',
        packageRoot: root,
        scannedFiles: Object.freeze(sourceFiles.map((file) => toPosix(path.relative(root, file)))),
        declaredPermissions: Object.freeze([...permissions].sort()),
        structuralPassed: diagnostics.every((diagnostic) => diagnostic.category !== 'structural'),
        strictPassed: diagnostics.length === 0,
        diagnostics: Object.freeze(diagnostics),
        limitations: Object.freeze({
            bestEffort: true,
            falseNegativesPossible: true,
            runtimeConformanceRequired: true,
            securitySandbox: false,
        }),
    });
}

async function main() {
    const args = process.argv.slice(2);
    const json = args.includes('--json');
    const strictBestEffort = args.includes('--strict-best-effort');
    const target = args.find((argument) => !argument.startsWith('--'));
    if (!target) {
        console.error(
            'Usage: node scripts/check-plugin-conformance.mjs <plugin-package> [--json] [--strict-best-effort]',
        );
        process.exitCode = 2;
        return;
    }
    const report = await inspectPluginPackage(target);
    if (json) console.log(JSON.stringify(report, null, 2));
    else {
        for (const diagnostic of report.diagnostics) {
            console.error(
                `${diagnostic.file}:${diagnostic.line}:${diagnostic.column} ${diagnostic.severity} ${diagnostic.ruleId} ${diagnostic.message}`,
            );
        }
        console.log(
            `Plugin checks scanned ${report.scannedFiles.length} source file(s): ${report.structuralPassed ? 'structural PASS' : 'structural FAIL'}, ${report.strictPassed ? 'best-effort clear' : 'best-effort findings present'}.`,
        );
    }
    if (!report.structuralPassed || (strictBestEffort && !report.strictPassed)) {
        process.exitCode = 1;
    }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) await main();
