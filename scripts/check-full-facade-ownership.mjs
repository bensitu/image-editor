/**
 * Generates and validates the Phase 5A-R Full Facade ownership inventory.
 *
 * Generated files are facts derived from the TypeScript AST and the live
 * full-root Rollup measurement. Policy files are reviewed migration decisions.
 * The checker keeps those two layers complete, current, and mutually consistent.
 *
 * @module
 */

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { format, resolveConfig } from 'prettier';
import ts from 'typescript';

const execFileAsync = promisify(execFile);
const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptsDirectory, '..');
const sourceRoot = path.join(repositoryRoot, 'src');
const architectureRoot = path.join(repositoryRoot, 'tests', 'architecture');
const refactorDocsRoot = path.join(repositoryRoot, 'docs', 'refactor');
const currentBundlePath = path.join(repositoryRoot, 'tests', 'bundle', 'baselines', 'current.json');

const ownershipGeneratedPath = path.join(architectureRoot, 'full-facade-ownership.generated.json');
const ownershipPolicyPath = path.join(architectureRoot, 'full-facade-ownership.policy.json');
const legacyGeneratedPath = path.join(architectureRoot, 'legacy-feature-call-sites.generated.json');
const legacyPolicyPath = path.join(architectureRoot, 'legacy-feature-call-sites.policy.json');
const bridgePolicyPath = path.join(architectureRoot, 'compatibility-bridge-state.policy.json');
const reachabilityPolicyPath = path.join(architectureRoot, 'full-root-reachability.policy.json');

const runtimeOwnershipDocPath = path.join(refactorDocsRoot, 'phase-5a-r-runtime-ownership.md');
const bridgeAuditDocPath = path.join(refactorDocsRoot, 'phase-5a-r-compatibility-bridge-audit.md');
const bundleOwnershipDocPath = path.join(refactorDocsRoot, 'phase-5a-r-bundle-ownership.md');

const validCurrentOwners = new Set([
    'IMAGE_EDITOR',
    'EDITOR_RUNTIME',
    'CORE',
    'PLUGIN',
    'COMPATIBILITY',
]);
const validTargetOwners = new Set([
    'CORE',
    'TRANSFORM_PLUGIN',
    'MASK_PLUGIN',
    'HISTORY_PLUGIN',
    'LEGACY_FILTERS_ADAPTER',
    'LEGACY_CROP_ADAPTER',
    'LEGACY_MOSAIC_ADAPTER',
    'LEGACY_ANNOTATION_ADAPTER',
    'LEGACY_OVERLAY_STATE_ADAPTER',
    'LEGACY_DOM_ADAPTER',
    'THIN_FACADE',
    'DELETE',
]);
const validClassifications = new Set([
    'CORE_OWNED',
    'PLUGIN_OWNED',
    'LEGACY_FEATURE_OWNED',
    'DOM_ADAPTER_OWNED',
    'CALLBACK_ADAPTER_OWNED',
    'TRANSIENT_SESSION',
    'DELETE',
]);
const validMigrationStages = new Set([
    'R2',
    'R3',
    'R4',
    'R5A',
    'R5B',
    'R5C',
    'R5D',
    'R5E',
    'R5F',
    'R5G',
    'DELETE',
]);
const validBridgeClassifications = new Set([
    'CORE_DUPLICATE',
    'TRANSFORM_DUPLICATE',
    'HISTORY_DUPLICATE',
    'FEATURE_SPECIFIC',
    'COMPATIBILITY_ONLY',
    'TRANSIENT_RUNTIME',
    'DELETE',
]);
const validReachabilityClassifications = new Set([
    'REQUIRED_CORE',
    'REQUIRED_PLUGIN_KERNEL',
    'REQUIRED_TRANSFORM',
    'REQUIRED_OVERLAY',
    'REQUIRED_MASK',
    'REQUIRED_HISTORY',
    'REQUIRED_LEGACY_FEATURE_ALGORITHM',
    'DUPLICATE_CORE_RUNTIME_INFRASTRUCTURE',
    'DUPLICATE_QUEUE_GUARD_HISTORY_STATE',
    'COMPATIBILITY_ONLY',
    'DEAD_UNNECESSARY_ROOT_DEPENDENCY',
]);

const legacyFamilies = Object.freeze([
    ['FILTERS', (file) => file === 'src/image/image-filters.ts'],
    ['CROP', (file) => file.startsWith('src/crop/')],
    ['MOSAIC', (file) => file.startsWith('src/mosaic/')],
    ['ANNOTATION', (file) => file.startsWith('src/annotation/')],
    ['OVERLAY_STATE', (file) => file.startsWith('src/overlay/overlay-state-')],
    ['UI', (file) => file.startsWith('src/ui/')],
    ['MASK', (file) => file.startsWith('src/mask/')],
    ['HISTORY', (file) => file.startsWith('src/history/')],
    ['RUNTIME', (file) => file.startsWith('src/runtime/')],
]);

function parseArguments(argv) {
    let mode = null;
    let refreshPolicies = false;
    for (const argument of argv) {
        if (argument === '--generate' || argument === '--check') {
            if (mode) throw new Error('Choose exactly one of --generate or --check.');
            mode = argument.slice(2);
        } else if (argument === '--refresh-policies') {
            refreshPolicies = true;
        } else {
            throw new Error(`Unknown argument: ${argument}`);
        }
    }
    if (!mode) throw new Error('Expected --generate or --check.');
    if (refreshPolicies && mode !== 'generate') {
        throw new Error('--refresh-policies is valid only with --generate.');
    }
    return { mode, refreshPolicies };
}

function toPosix(value) {
    return value.split(path.sep).join('/');
}

function relativeToRepository(filePath) {
    return toPosix(path.relative(repositoryRoot, filePath));
}

function isInside(parent, candidate) {
    const relative = path.relative(parent, candidate);
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function hashText(value) {
    return createHash('sha256').update(value).digest('hex');
}

function slug(value) {
    return String(value)
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase()
        .slice(0, 56);
}

function createStableId(kind, ...parts) {
    const identity = parts.join('\u0000');
    const readable = slug(parts.at(-1) ?? kind) || 'item';
    return `${kind}:${readable}:${hashText(`${kind}\u0000${identity}`).slice(0, 10)}`;
}

function lineOf(sourceFile, node) {
    return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function compactEvidence(value) {
    return value.replace(/\s+/g, ' ').trim().slice(0, 240);
}

function nodeName(node, sourceFile) {
    if (!node?.name) return '';
    if (ts.isIdentifier(node.name) || ts.isPrivateIdentifier(node.name)) return node.name.text;
    if (ts.isStringLiteralLike(node.name) || ts.isNumericLiteral(node.name)) return node.name.text;
    return compactEvidence(node.name.getText(sourceFile));
}

function visibilityOf(node) {
    if (node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.PrivateKeyword)) {
        return 'private';
    }
    if (node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ProtectedKeyword)) {
        return 'protected';
    }
    return 'public';
}

function visitAst(node, visitor) {
    visitor(node);
    ts.forEachChild(node, (child) => visitAst(child, visitor));
}

function enclosingSymbol(node, sourceFile) {
    let current = node.parent;
    while (current) {
        if (
            ts.isMethodDeclaration(current) ||
            ts.isGetAccessorDeclaration(current) ||
            ts.isSetAccessorDeclaration(current) ||
            ts.isConstructorDeclaration(current) ||
            ts.isFunctionDeclaration(current) ||
            ts.isFunctionExpression(current) ||
            ts.isArrowFunction(current)
        ) {
            const name = ts.isConstructorDeclaration(current)
                ? 'constructor'
                : nodeName(current, sourceFile) || 'anonymous';
            const owner =
                current.parent && ts.isClassDeclaration(current.parent)
                    ? `${current.parent.name?.text ?? 'anonymous-class'}.${name}`
                    : name;
            return { name: owner, node: current };
        }
        current = current.parent;
    }
    return { name: 'module-scope', node: sourceFile };
}

async function collectTypeScriptFiles(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(
        entries.map(async (entry) => {
            const entryPath = path.join(directory, entry.name);
            if (entry.isDirectory()) return collectTypeScriptFiles(entryPath);
            if (!entry.isFile() || entry.name.endsWith('.d.ts')) return [];
            return /\.(?:ts|tsx|mts|cts)$/.test(entry.name) ? [entryPath] : [];
        }),
    );
    return nested.flat().sort();
}

function readCompilerOptions() {
    const configPath = path.join(repositoryRoot, 'tsconfig.json');
    const config = ts.readConfigFile(configPath, ts.sys.readFile);
    if (config.error) {
        throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
    }
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, repositoryRoot);
    if (parsed.errors.length > 0) {
        throw new Error(
            parsed.errors
                .map((error) => ts.flattenDiagnosticMessageText(error.messageText, '\n'))
                .join('\n'),
        );
    }
    return parsed.options;
}

function collectImportBindings(node) {
    if (ts.isExportDeclaration(node)) {
        if (!node.exportClause) return [{ imported: '*', local: '*', typeOnly: node.isTypeOnly }];
        if (ts.isNamedExports(node.exportClause)) {
            return node.exportClause.elements.map((element) => ({
                imported: element.propertyName?.text ?? element.name.text,
                local: element.name.text,
                typeOnly: node.isTypeOnly || element.isTypeOnly,
            }));
        }
        return [{ imported: '*', local: '*', typeOnly: node.isTypeOnly }];
    }
    const clause = node.importClause;
    if (!clause) return [{ imported: '*side-effect*', local: '*side-effect*', typeOnly: false }];
    const bindings = [];
    if (clause.name) {
        bindings.push({
            imported: 'default',
            local: clause.name.text,
            typeOnly: clause.isTypeOnly,
        });
    }
    if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
        bindings.push({
            imported: '*',
            local: clause.namedBindings.name.text,
            typeOnly: clause.isTypeOnly,
        });
    }
    if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const element of clause.namedBindings.elements) {
            bindings.push({
                imported: element.propertyName?.text ?? element.name.text,
                local: element.name.text,
                typeOnly: clause.isTypeOnly || element.isTypeOnly,
            });
        }
    }
    return bindings;
}

async function analyzeSources() {
    const compilerOptions = readCompilerOptions();
    const absoluteFiles = await collectTypeScriptFiles(sourceRoot);
    const sourceFiles = new Map();
    const sourceTexts = new Map();
    const absoluteByRelative = new Map();

    for (const absoluteFile of absoluteFiles) {
        const relativeFile = relativeToRepository(absoluteFile);
        const sourceText = await readFile(absoluteFile, 'utf8');
        sourceTexts.set(relativeFile, sourceText);
        absoluteByRelative.set(relativeFile, path.resolve(absoluteFile));
        sourceFiles.set(
            relativeFile,
            ts.createSourceFile(
                absoluteFile,
                sourceText,
                ts.ScriptTarget.Latest,
                true,
                absoluteFile.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
            ),
        );
    }

    const relativeByAbsolute = new Map(
        [...absoluteByRelative.entries()].map(([relative, absolute]) => [absolute, relative]),
    );
    const importsByFile = new Map();
    const graph = new Map([...sourceFiles.keys()].map((file) => [file, new Set()]));

    for (const [relativeFile, sourceFile] of sourceFiles) {
        const imports = [];
        for (const statement of sourceFile.statements) {
            if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
            if (!statement.moduleSpecifier || !ts.isStringLiteralLike(statement.moduleSpecifier)) {
                continue;
            }
            const specifier = statement.moduleSpecifier.text;
            const resolved = ts.resolveModuleName(
                specifier,
                absoluteByRelative.get(relativeFile),
                compilerOptions,
                ts.sys,
            ).resolvedModule?.resolvedFileName;
            const normalizedResolved = resolved ? path.resolve(resolved) : null;
            const target =
                normalizedResolved && isInside(sourceRoot, normalizedResolved)
                    ? (relativeByAbsolute.get(normalizedResolved) ?? null)
                    : null;
            const edge = {
                nodeKind: ts.isImportDeclaration(statement) ? 'import' : 'export',
                specifier,
                target,
                line: lineOf(sourceFile, statement),
                bindings: collectImportBindings(statement),
            };
            imports.push(edge);
            if (target) graph.get(relativeFile)?.add(target);
        }
        importsByFile.set(relativeFile, imports);
    }

    const entry = 'src/index.ts';
    const reachable = new Set();
    const predecessor = new Map();
    const queue = [entry];
    while (queue.length > 0) {
        const current = queue.shift();
        if (!current || reachable.has(current)) continue;
        reachable.add(current);
        for (const target of graph.get(current) ?? []) {
            if (!predecessor.has(target)) predecessor.set(target, current);
            if (!reachable.has(target)) queue.push(target);
        }
    }

    function importChain(target) {
        if (!reachable.has(target)) return [];
        const chain = [target];
        let current = target;
        while (current !== entry && predecessor.has(current)) {
            current = predecessor.get(current);
            chain.push(current);
        }
        return chain.reverse();
    }

    const sourceFingerprint = hashText(
        [...sourceTexts.entries()]
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([file, source]) => `${file}\u0000${source}`)
            .join('\u0001'),
    );
    const reachableSourceBytes = [...reachable].reduce(
        (total, file) => total + Buffer.byteLength(sourceTexts.get(file) ?? '', 'utf8'),
        0,
    );

    return {
        sourceFiles,
        sourceTexts,
        importsByFile,
        graph,
        reachable,
        importChain,
        sourceFingerprint,
        reachableSourceBytes,
    };
}

async function getGitCommit() {
    const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
        cwd: repositoryRoot,
        encoding: 'utf8',
    });
    return stdout.trim();
}

async function readJson(filePath) {
    return JSON.parse(await readFile(filePath, 'utf8'));
}

async function fileExists(filePath) {
    try {
        await access(filePath);
        return true;
    } catch {
        return false;
    }
}

async function writeJson(filePath, value) {
    await mkdir(path.dirname(filePath), { recursive: true });
    const config = (await resolveConfig(path.join(repositoryRoot, 'package.json'))) ?? {};
    const content = await format(JSON.stringify(value), { ...config, parser: 'json' });
    await writeFile(filePath, content, 'utf8');
}

function sortById(entries) {
    return [...entries].sort((left, right) => left.id.localeCompare(right.id));
}

function memberRecords(analysis, sourceFileName, className, fieldsOnly = false) {
    const sourceFile = analysis.sourceFiles.get(sourceFileName);
    if (!sourceFile) throw new Error(`Missing source file: ${sourceFileName}`);
    const declaration = sourceFile.statements.find(
        (statement) => ts.isClassDeclaration(statement) && statement.name?.text === className,
    );
    if (!declaration || !ts.isClassDeclaration(declaration)) {
        throw new Error(`Missing class ${className} in ${sourceFileName}.`);
    }
    const records = [];
    for (const member of declaration.members) {
        let kind = null;
        let symbol = nodeName(member, sourceFile);
        if (ts.isPropertyDeclaration(member)) kind = 'field';
        else if (ts.isMethodDeclaration(member)) kind = 'method';
        else if (ts.isGetAccessorDeclaration(member) || ts.isSetAccessorDeclaration(member)) {
            kind = 'accessor';
        } else if (ts.isConstructorDeclaration(member)) {
            kind = 'method';
            symbol = 'constructor';
        }
        if (!kind || (fieldsOnly && kind !== 'field')) continue;
        const visibility = visibilityOf(member);
        const publicApi =
            className === 'ImageEditor' && visibility === 'public' && symbol !== 'constructor';
        records.push({
            id: createStableId(kind, sourceFileName, className, symbol),
            kind,
            sourceFile: sourceFileName,
            symbol: `${className}.${symbol}`,
            line: lineOf(sourceFile, member),
            currentReachableFromRoot: analysis.reachable.has(sourceFileName),
            evidence: [compactEvidence(member.getText(sourceFile))],
            container: className,
            memberName: symbol,
            visibility,
            publicApi,
            readonly:
                member.modifiers?.some(
                    (modifier) => modifier.kind === ts.SyntaxKind.ReadonlyKeyword,
                ) ?? false,
        });
    }
    return records;
}

function rootImportRecords(analysis) {
    const sourceFileName = 'src/image-editor.ts';
    const sourceFile = analysis.sourceFiles.get(sourceFileName);
    const records = [];
    for (const imported of analysis.importsByFile.get(sourceFileName) ?? []) {
        if (imported.nodeKind !== 'import') continue;
        for (const binding of imported.bindings) {
            records.push({
                id: createStableId(
                    'import',
                    sourceFileName,
                    imported.specifier,
                    binding.imported,
                    binding.local,
                ),
                kind: 'import',
                sourceFile: sourceFileName,
                symbol: `${binding.local} <- ${imported.specifier}#${binding.imported}`,
                line: imported.line,
                currentReachableFromRoot: true,
                evidence: [
                    `Direct ImageEditor import of ${binding.imported} as ${binding.local} from ${imported.specifier}.`,
                ],
                moduleSpecifier: imported.specifier,
                resolvedSourceFile: imported.target,
                importedSymbol: binding.imported,
                localSymbol: binding.local,
                typeOnly: binding.typeOnly,
                rootDirectImport: true,
                sourceText: sourceFile
                    ? compactEvidence(sourceFile.text.split(/\r?\n/)[imported.line - 1] ?? '')
                    : '',
            });
        }
    }
    return records;
}

function compatibilityStateFieldRecords(analysis) {
    const compatibilityFiles = [
        'src/compatibility/full-facade-state-plugin.ts',
        'src/compatibility/full-facade-annotation-plugin.ts',
        'src/compatibility/plugin-history-adapter.ts',
    ];
    const records = [];
    for (const sourceFileName of compatibilityFiles) {
        const sourceFile = analysis.sourceFiles.get(sourceFileName);
        for (const statement of sourceFile.statements) {
            if (ts.isInterfaceDeclaration(statement)) {
                for (const member of statement.members) {
                    if (!ts.isPropertySignature(member) && !ts.isMethodSignature(member)) continue;
                    const memberName = nodeName(member, sourceFile);
                    records.push({
                        id: createStableId(
                            'state-field',
                            sourceFileName,
                            statement.name.text,
                            memberName,
                        ),
                        kind: 'state-field',
                        sourceFile: sourceFileName,
                        symbol: `${statement.name.text}.${memberName}`,
                        line: lineOf(sourceFile, member),
                        currentReachableFromRoot: analysis.reachable.has(sourceFileName),
                        evidence: [compactEvidence(member.getText(sourceFile))],
                        container: statement.name.text,
                        memberName,
                        stateFieldKind: ts.isMethodSignature(member)
                            ? 'method-contract'
                            : 'property',
                    });
                }
            }
            if (!ts.isClassDeclaration(statement) || !statement.name) continue;
            for (const member of statement.members) {
                if (ts.isPropertyDeclaration(member)) {
                    const memberName = nodeName(member, sourceFile);
                    records.push({
                        id: createStableId(
                            'state-field',
                            sourceFileName,
                            statement.name.text,
                            memberName,
                        ),
                        kind: 'state-field',
                        sourceFile: sourceFileName,
                        symbol: `${statement.name.text}.${memberName}`,
                        line: lineOf(sourceFile, member),
                        currentReachableFromRoot: analysis.reachable.has(sourceFileName),
                        evidence: [compactEvidence(member.getText(sourceFile))],
                        container: statement.name.text,
                        memberName,
                        stateFieldKind: 'class-property',
                    });
                }
                if (!ts.isConstructorDeclaration(member)) continue;
                for (const parameter of member.parameters) {
                    const isParameterProperty = parameter.modifiers?.some((modifier) =>
                        [
                            ts.SyntaxKind.PublicKeyword,
                            ts.SyntaxKind.PrivateKeyword,
                            ts.SyntaxKind.ProtectedKeyword,
                            ts.SyntaxKind.ReadonlyKeyword,
                        ].includes(modifier.kind),
                    );
                    if (!isParameterProperty || !ts.isIdentifier(parameter.name)) continue;
                    const memberName = parameter.name.text;
                    records.push({
                        id: createStableId(
                            'state-field',
                            sourceFileName,
                            statement.name.text,
                            memberName,
                        ),
                        kind: 'state-field',
                        sourceFile: sourceFileName,
                        symbol: `${statement.name.text}.${memberName}`,
                        line: lineOf(sourceFile, parameter),
                        currentReachableFromRoot: analysis.reachable.has(sourceFileName),
                        evidence: [compactEvidence(parameter.getText(sourceFile))],
                        container: statement.name.text,
                        memberName,
                        stateFieldKind: 'parameter-property',
                    });
                }
            }
        }
    }
    return records;
}

function moduleRecords(analysis) {
    return [...analysis.reachable].sort().map((sourceFileName) => ({
        id: createStableId('module', sourceFileName),
        kind: 'module',
        sourceFile: sourceFileName,
        symbol: sourceFileName,
        line: 1,
        currentReachableFromRoot: true,
        evidence: [analysis.importChain(sourceFileName).join(' -> ')],
        importChain: analysis.importChain(sourceFileName),
        sourceBytes: Buffer.byteLength(analysis.sourceTexts.get(sourceFileName) ?? '', 'utf8'),
    }));
}

function ownerFamily(expressionText) {
    if (/(?:^|\.)StaticCanvas$/.test(expressionText)) return 'StaticCanvas';
    if (/(?:^|\.)Canvas$/.test(expressionText)) return 'Canvas';
    if (/(?:^|\.)AnimationQueue$/.test(expressionText)) return 'AnimationQueue';
    if (/(?:^|\.)OperationGuard$/.test(expressionText)) return 'OperationGuard';
    if (
        /(?:^|\.)(?:DeferredHistoryPort|PluginHistoryAdapter|HistoryPluginController)$/.test(
            expressionText,
        )
    ) {
        return 'HistoryStack';
    }
    if (/(?:^|\.)HistoryCommitRouter$/.test(expressionText)) return 'HistoryCommitRouter';
    return null;
}

function ownerRecords(analysis) {
    const records = [];
    const occurrences = new Map();
    for (const sourceFileName of [...analysis.reachable].sort()) {
        const sourceFile = analysis.sourceFiles.get(sourceFileName);
        visitAst(sourceFile, (node) => {
            if (!ts.isNewExpression(node)) return;
            const expression = compactEvidence(node.expression.getText(sourceFile));
            const family = ownerFamily(expression);
            if (!family) return;
            const enclosing = enclosingSymbol(node, sourceFile).name;
            const occurrenceKey = `${sourceFileName}\u0000${family}\u0000${enclosing}`;
            const occurrence = (occurrences.get(occurrenceKey) ?? 0) + 1;
            occurrences.set(occurrenceKey, occurrence);
            records.push({
                id: createStableId('owner', sourceFileName, family, enclosing, String(occurrence)),
                kind: 'owner',
                sourceFile: sourceFileName,
                symbol: `${family} owner in ${enclosing}`,
                line: lineOf(sourceFile, node),
                currentReachableFromRoot: true,
                evidence: [compactEvidence(node.getText(sourceFile))],
                ownerFamily: family,
                ownerRole: 'constructor-call',
                enclosingSymbol: enclosing,
                occurrence,
            });
        });
    }
    return records;
}

function bridgeCallRecords(analysis) {
    const records = [];
    const occurrences = new Map();
    for (const sourceFileName of [...analysis.reachable].sort()) {
        const sourceFile = analysis.sourceFiles.get(sourceFileName);
        visitAst(sourceFile, (node) => {
            if (!ts.isCallExpression(node)) return;
            const expression = node.expression;
            const called = ts.isPropertyAccessExpression(expression)
                ? expression.name.text
                : ts.isIdentifier(expression)
                  ? expression.text
                  : '';
            if (
                !/^(?:attachExistingCanvas|synchronizeCompatibility[A-Za-z0-9]*|captureCompatibilityMemento|restoreCompatibilityMemento)$/.test(
                    called,
                )
            ) {
                return;
            }
            const enclosing = enclosingSymbol(node, sourceFile).name;
            const occurrenceKey = `${sourceFileName}\u0000${called}\u0000${enclosing}`;
            const occurrence = (occurrences.get(occurrenceKey) ?? 0) + 1;
            occurrences.set(occurrenceKey, occurrence);
            records.push({
                id: createStableId(
                    'bridge-call',
                    sourceFileName,
                    called,
                    enclosing,
                    String(occurrence),
                ),
                kind: 'call-site',
                sourceFile: sourceFileName,
                symbol: called,
                line: lineOf(sourceFile, node),
                currentReachableFromRoot: true,
                evidence: [compactEvidence(node.getText(sourceFile))],
                callSiteKind: 'compatibility-bridge',
                enclosingSymbol: enclosing,
                occurrence,
            });
        });
    }
    return records;
}

function optionsAndCallbackRecords(analysis) {
    const sourceFileName = 'src/image-editor.ts';
    const sourceFile = analysis.sourceFiles.get(sourceFileName);
    const records = [];
    const occurrences = new Map();
    visitAst(sourceFile, (node) => {
        if (!ts.isPropertyAccessExpression(node)) return;
        const memberName = node.name.text;
        const receiver = compactEvidence(node.expression.getText(sourceFile));
        const callback = /^on[A-Z]/.test(memberName);
        const option = /(?:^|\.)options$/.test(receiver) || /getRuntimeOptions\(\)$/.test(receiver);
        if (!callback && !option) return;
        const enclosing = enclosingSymbol(node, sourceFile).name;
        const kind = callback ? 'callback-reference' : 'option-reference';
        const occurrenceKey = `${kind}\u0000${memberName}\u0000${enclosing}`;
        const occurrence = (occurrences.get(occurrenceKey) ?? 0) + 1;
        occurrences.set(occurrenceKey, occurrence);
        records.push({
            id: createStableId(kind, sourceFileName, memberName, enclosing, String(occurrence)),
            kind: 'call-site',
            sourceFile: sourceFileName,
            symbol: memberName,
            line: lineOf(sourceFile, node),
            currentReachableFromRoot: true,
            evidence: [compactEvidence(node.getText(sourceFile))],
            callSiteKind: kind,
            enclosingSymbol: enclosing,
            occurrence,
        });
    });
    return records;
}

function legacyFamilyForFile(sourceFileName) {
    return legacyFamilies.find(([, matches]) => matches(sourceFileName))?.[0] ?? null;
}

function collectStateDependencies(enclosingNode, sourceFile) {
    const text = enclosingNode.getText(sourceFile);
    const dependencies = new Set();
    for (const pattern of [
        /\bthis\.runtime\.([A-Za-z_$][\w$]*)/g,
        /\bruntime\.([A-Za-z_$][\w$]*)/g,
        /\bthis\.([A-Za-z_$][\w$]*)/g,
    ]) {
        for (const match of text.matchAll(pattern)) dependencies.add(match[1]);
    }
    return [...dependencies].sort().slice(0, 32);
}

function generateLegacyCallSites(analysis) {
    const sourcePaths = [...analysis.sourceFiles.keys()].filter(
        (file) =>
            file === 'src/image-editor.ts' ||
            file.startsWith('src/compatibility/') ||
            file.startsWith('src/runtime/'),
    );
    const records = [];
    for (const sourceFileName of sourcePaths.sort()) {
        const sourceFile = analysis.sourceFiles.get(sourceFileName);
        const bindingMap = new Map();
        for (const imported of analysis.importsByFile.get(sourceFileName) ?? []) {
            if (imported.nodeKind !== 'import' || !imported.target) continue;
            const family = legacyFamilyForFile(imported.target);
            if (!family) continue;
            for (const binding of imported.bindings) {
                const importRecord = {
                    id: createStableId(
                        'legacy-import',
                        sourceFileName,
                        imported.target,
                        binding.imported,
                        binding.local,
                    ),
                    kind: 'import',
                    sourceFile: sourceFileName,
                    symbol: binding.local,
                    helperSymbol: binding.imported,
                    localSymbol: binding.local,
                    targetSourceFile: imported.target,
                    family,
                    line: imported.line,
                    currentReachableFromRoot: analysis.reachable.has(sourceFileName),
                    evidence: [
                        `Direct import of ${binding.imported} as ${binding.local} from ${imported.target}.`,
                    ],
                    publicApiSource: 'module-scope',
                    currentStateDependencies: [],
                    usageKind: 'direct-import',
                    typeOnly: binding.typeOnly,
                };
                records.push(importRecord);
                bindingMap.set(binding.local, {
                    family,
                    imported: binding.imported,
                    local: binding.local,
                    targetSourceFile: imported.target,
                });
            }
        }

        const occurrenceCounts = new Map();
        visitAst(sourceFile, (node) => {
            if (!ts.isCallExpression(node) && !ts.isNewExpression(node)) return;
            const expression = node.expression;
            let binding = null;
            let helperSymbol = '';
            if (ts.isIdentifier(expression)) {
                binding = bindingMap.get(expression.text) ?? null;
                helperSymbol = binding?.imported ?? expression.text;
            } else if (
                ts.isPropertyAccessExpression(expression) &&
                ts.isIdentifier(expression.expression)
            ) {
                binding = bindingMap.get(expression.expression.text) ?? null;
                helperSymbol = binding ? expression.name.text : '';
            }
            if (!binding || binding.imported === '*side-effect*') return;
            const enclosing = enclosingSymbol(node, sourceFile);
            const occurrenceKey = `${binding.local}\u0000${helperSymbol}\u0000${enclosing.name}`;
            const occurrence = (occurrenceCounts.get(occurrenceKey) ?? 0) + 1;
            occurrenceCounts.set(occurrenceKey, occurrence);
            records.push({
                id: createStableId(
                    'legacy-call',
                    sourceFileName,
                    binding.targetSourceFile,
                    helperSymbol,
                    enclosing.name,
                    String(occurrence),
                ),
                kind: 'call-site',
                sourceFile: sourceFileName,
                symbol: helperSymbol,
                helperSymbol,
                localSymbol: binding.local,
                targetSourceFile: binding.targetSourceFile,
                family: binding.family,
                line: lineOf(sourceFile, node),
                currentReachableFromRoot: analysis.reachable.has(sourceFileName),
                evidence: [compactEvidence(node.getText(sourceFile))],
                publicApiSource: enclosing.name,
                currentStateDependencies: collectStateDependencies(enclosing.node, sourceFile),
                usageKind: ts.isNewExpression(node) ? 'constructor-call' : 'function-call',
                occurrence,
            });
        });
    }
    return sortById(records);
}

function compatibilityBridgeFacts(analysis) {
    const records = [];
    const files = [
        'src/compatibility/full-facade-state-plugin.ts',
        'src/compatibility/full-facade-annotation-plugin.ts',
        'src/compatibility/plugin-history-adapter.ts',
    ];
    for (const sourceFileName of files) {
        const sourceFile = analysis.sourceFiles.get(sourceFileName);
        if (!sourceFile) throw new Error(`Missing compatibility bridge: ${sourceFileName}`);
        for (const statement of sourceFile.statements) {
            if (ts.isInterfaceDeclaration(statement)) {
                for (const member of statement.members) {
                    if (!ts.isPropertySignature(member) && !ts.isMethodSignature(member)) continue;
                    const memberName = nodeName(member, sourceFile);
                    records.push({
                        id: createStableId(
                            'bridge-item',
                            sourceFileName,
                            statement.name.text,
                            memberName,
                        ),
                        sourceFile: sourceFileName,
                        symbol: `${statement.name.text}.${memberName}`,
                        line: lineOf(sourceFile, member),
                        bridgeKind: ts.isMethodSignature(member)
                            ? 'method-contract'
                            : 'state-field',
                        evidence: [compactEvidence(member.getText(sourceFile))],
                    });
                }
            }
            if (ts.isFunctionDeclaration(statement) && statement.name) {
                records.push({
                    id: createStableId(
                        'bridge-item',
                        sourceFileName,
                        'function',
                        statement.name.text,
                    ),
                    sourceFile: sourceFileName,
                    symbol: statement.name.text,
                    line: lineOf(sourceFile, statement),
                    bridgeKind: /^(?:is|validate)/.test(statement.name.text)
                        ? 'predicate'
                        : /serialize|deserialize/.test(statement.name.text)
                          ? 'serializer'
                          : 'helper',
                    evidence: [compactEvidence(statement.getText(sourceFile).slice(0, 240))],
                });
            }
            if (ts.isClassDeclaration(statement) && statement.name) {
                for (const member of statement.members) {
                    if (
                        !ts.isPropertyDeclaration(member) &&
                        !ts.isMethodDeclaration(member) &&
                        !ts.isGetAccessorDeclaration(member) &&
                        !ts.isConstructorDeclaration(member)
                    ) {
                        continue;
                    }
                    const memberName = ts.isConstructorDeclaration(member)
                        ? 'constructor'
                        : nodeName(member, sourceFile);
                    records.push({
                        id: createStableId(
                            'bridge-item',
                            sourceFileName,
                            statement.name.text,
                            memberName,
                        ),
                        sourceFile: sourceFileName,
                        symbol: `${statement.name.text}.${memberName}`,
                        line: lineOf(sourceFile, member),
                        bridgeKind: ts.isPropertyDeclaration(member)
                            ? 'state-field'
                            : 'history-behavior',
                        evidence: [compactEvidence(member.getText(sourceFile).slice(0, 240))],
                    });
                    if (!ts.isConstructorDeclaration(member)) continue;
                    for (const parameter of member.parameters) {
                        const isParameterProperty = parameter.modifiers?.some((modifier) =>
                            [
                                ts.SyntaxKind.PublicKeyword,
                                ts.SyntaxKind.PrivateKeyword,
                                ts.SyntaxKind.ProtectedKeyword,
                                ts.SyntaxKind.ReadonlyKeyword,
                            ].includes(modifier.kind),
                        );
                        if (!isParameterProperty || !ts.isIdentifier(parameter.name)) continue;
                        records.push({
                            id: createStableId(
                                'bridge-item',
                                sourceFileName,
                                statement.name.text,
                                parameter.name.text,
                            ),
                            sourceFile: sourceFileName,
                            symbol: `${statement.name.text}.${parameter.name.text}`,
                            line: lineOf(sourceFile, parameter),
                            bridgeKind: 'state-field',
                            evidence: [compactEvidence(parameter.getText(sourceFile))],
                        });
                    }
                }
            }
        }

        const registrationOccurrences = new Map();
        visitAst(sourceFile, (node) => {
            if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
                if (node.name.text !== 'COMPATIBILITY_OBJECT_PROPERTIES' || !node.initializer) {
                    return;
                }
                visitAst(node.initializer, (literal) => {
                    if (!ts.isStringLiteralLike(literal)) return;
                    records.push({
                        id: createStableId(
                            'bridge-item',
                            sourceFileName,
                            'object-property',
                            literal.text,
                        ),
                        sourceFile: sourceFileName,
                        symbol: `object-property:${literal.text}`,
                        line: lineOf(sourceFile, literal),
                        bridgeKind: 'object-property',
                        evidence: [literal.getText(sourceFile)],
                    });
                });
                return;
            }
            if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) {
                return;
            }
            const method = node.expression.name.text;
            const receiver = compactEvidence(node.expression.expression.getText(sourceFile));
            if (
                ![
                    'register',
                    'registerKind',
                    'registerGeometryPolicy',
                    'registerSerializer',
                ].includes(method) ||
                !/(?:state\.|overlay\.)/.test(receiver)
            ) {
                return;
            }
            const key = `${receiver}.${method}`;
            const occurrence = (registrationOccurrences.get(key) ?? 0) + 1;
            registrationOccurrences.set(key, occurrence);
            records.push({
                id: createStableId(
                    'bridge-item',
                    sourceFileName,
                    'registration',
                    key,
                    String(occurrence),
                ),
                sourceFile: sourceFileName,
                symbol: `${key}#${occurrence}`,
                line: lineOf(sourceFile, node),
                bridgeKind: receiver.includes('transientObjects')
                    ? 'transient-predicate'
                    : method === 'registerSerializer'
                      ? 'serializer-policy'
                      : method === 'registerGeometryPolicy'
                        ? 'geometry-policy'
                        : 'registration-policy',
                evidence: [compactEvidence(node.getText(sourceFile).slice(0, 240))],
            });
        });
    }
    const byId = new Map();
    for (const record of records) byId.set(record.id, record);
    return sortById([...byId.values()]);
}

function currentOwnerFor(record) {
    if (record.sourceFile === 'src/image-editor.ts') return 'IMAGE_EDITOR';
    if (record.sourceFile === 'src/runtime/editor-runtime.ts') return 'EDITOR_RUNTIME';
    if (record.sourceFile.startsWith('src/core-runtime/')) return 'CORE';
    if (
        record.sourceFile.startsWith('src/plugins/') ||
        record.sourceFile.startsWith('src/foundations/')
    ) {
        return 'PLUGIN';
    }
    if (record.sourceFile.startsWith('src/compatibility/')) return 'COMPATIBILITY';
    if (record.sourceFile.startsWith('src/runtime/')) return 'EDITOR_RUNTIME';
    return 'IMAGE_EDITOR';
}

function targetOwnerFor(record) {
    const source = record.resolvedSourceFile ?? record.sourceFile;
    const search = `${source} ${record.symbol} ${record.evidence?.join(' ') ?? ''}`.toLowerCase();
    if (
        /plugins\/transform|transformplugin|transformcontroller|rotate|rotation|flip|scaleimage/.test(
            search,
        )
    ) {
        return 'TRANSFORM_PLUGIN';
    }
    if (/plugins\/mask|(?:^|[^a-z])mask/.test(search)) return 'MASK_PLUGIN';
    if (/plugins\/history|history|undo|redo/.test(search)) return 'HISTORY_PLUGIN';
    if (/image-filter|imagefilter|filterconfig|filters/.test(search)) {
        return 'LEGACY_FILTERS_ADAPTER';
    }
    if (/src\/crop\/|crop/.test(search)) return 'LEGACY_CROP_ADAPTER';
    if (/src\/mosaic\/|mosaic/.test(search)) return 'LEGACY_MOSAIC_ADAPTER';
    if (/src\/annotation\/|annotation|draw|eraser|shape|textsession/.test(search)) {
        return 'LEGACY_ANNOTATION_ADAPTER';
    }
    if (/overlay-state|overlaystate|selection|editableobject|metadata/.test(search)) {
        return 'LEGACY_OVERLAY_STATE_ADAPTER';
    }
    if (
        /src\/ui\/|dombinding|keyboard|canvas-element|containerelement|placeholder|elementmap|aria|pointerevents/.test(
            search,
        )
    ) {
        return 'LEGACY_DOM_ADAPTER';
    }
    if (/callback|onimage|onerror|onwarning|ontool|onhistory|onselection/.test(search)) {
        return 'THIN_FACADE';
    }
    if (
        source.startsWith('src/core-runtime/') ||
        source.startsWith('src/plugin-kernel/') ||
        /canvas|image|layout|export|memento|state|core/.test(search)
    ) {
        return 'CORE';
    }
    return 'THIN_FACADE';
}

function classificationFor(targetOwner, record) {
    if (targetOwner === 'CORE') return 'CORE_OWNED';
    if (targetOwner.endsWith('_PLUGIN')) return 'PLUGIN_OWNED';
    if (targetOwner === 'LEGACY_DOM_ADAPTER') return 'DOM_ADAPTER_OWNED';
    if (targetOwner.startsWith('LEGACY_')) return 'LEGACY_FEATURE_OWNED';
    if (targetOwner === 'DELETE') return 'DELETE';
    if (record.callSiteKind === 'callback-reference') return 'CALLBACK_ADAPTER_OWNED';
    return record.publicApi ? 'CALLBACK_ADAPTER_OWNED' : 'TRANSIENT_SESSION';
}

function migrationStageFor(targetOwner) {
    return {
        CORE: 'R2',
        TRANSFORM_PLUGIN: 'R3',
        HISTORY_PLUGIN: 'R3',
        MASK_PLUGIN: 'R4',
        LEGACY_FILTERS_ADAPTER: 'R5B',
        LEGACY_CROP_ADAPTER: 'R5C',
        LEGACY_MOSAIC_ADAPTER: 'R5D',
        LEGACY_ANNOTATION_ADAPTER: 'R5E',
        LEGACY_OVERLAY_STATE_ADAPTER: 'R5F',
        LEGACY_DOM_ADAPTER: 'R5G',
        THIN_FACADE: 'R2',
        DELETE: 'DELETE',
    }[targetOwner];
}

function publicApiTest(memberName) {
    const search = memberName.toLowerCase();
    if (/mask/.test(search)) return 'tests/mask-history-regression.test.mjs#public-mask-api';
    if (/undo|redo|history/.test(search))
        return 'tests/browser/e2e/undo-redo.spec.ts#public-history-api';
    if (/crop/.test(search)) return 'tests/browser/e2e/crop.spec.ts#public-crop-api';
    if (/mosaic/.test(search)) return 'tests/browser/e2e/mosaic.spec.ts#public-mosaic-api';
    if (/annotation|draw|text|shape|eraser/.test(search)) {
        return 'tests/browser/e2e/export.spec.ts#public-annotation-api';
    }
    if (/export/.test(search)) return 'tests/browser/e2e/export.spec.ts#public-export-api';
    if (/load|imageinfo/.test(search))
        return 'tests/browser/e2e/image-load.spec.ts#public-load-api';
    if (/dispose|init/.test(search))
        return 'tests/browser/e2e/dispose-reinit.spec.ts#public-lifecycle-api';
    if (/layout|resize|relayout/.test(search))
        return 'tests/layout-mode-public-api.test.mjs#public-layout-api';
    if (/state|selection|toolmode/.test(search)) {
        return 'tests/browser/e2e/public-state-api.spec.ts#public-state-api';
    }
    if (/rotate|flip|scale|reset|transform/.test(search)) {
        return 'tests/overlay-transform-binding.test.mjs#public-transform-api';
    }
    return 'tests/public-surface.test.mjs#public-surface';
}

function targetActionFor(record, targetOwner) {
    if (record.kind === 'owner') {
        const canonical =
            (record.ownerFamily === 'Canvas' &&
                record.sourceFile.startsWith('src/core-runtime/')) ||
            (record.ownerFamily === 'AnimationQueue' &&
                record.sourceFile.startsWith('src/plugins/transform/')) ||
            (record.ownerFamily === 'OperationGuard' &&
                record.sourceFile.startsWith('src/plugins/transform/')) ||
            (record.ownerFamily === 'HistoryStack' &&
                record.sourceFile.startsWith('src/plugins/history/')) ||
            record.ownerFamily === 'HistoryCommitRouter' ||
            record.ownerFamily === 'StaticCanvas';
        return canonical ? 'KEEP_CANONICAL' : 'DELETE_DUPLICATE';
    }
    if (record.kind !== 'import') return 'MIGRATE_TO_TARGET_OWNER';
    if (targetOwner === 'CORE') return 'REPLACE_WITH_CORE_OR_COMPOSITION_PORT';
    if (targetOwner.endsWith('_PLUGIN')) return 'ROUTE_THROUGH_PLUGIN_API';
    if (targetOwner.startsWith('LEGACY_')) return `MOVE_TO_${targetOwner}`;
    return 'RETAIN_ONLY_AS_THIN_FACADE_CONTRACT';
}

function rootReachableAfterFor(record, targetOwner) {
    if (record.publicApi) return true;
    if (record.kind === 'module') {
        return sourceModuleDisposition(record.sourceFile).rootReachableAfter;
    }
    if (record.kind === 'owner') return targetActionFor(record, targetOwner) === 'KEEP_CANONICAL';
    return false;
}

function seedOwnershipPolicy(gitCommit, sourceFingerprint, inventoryEntries) {
    return {
        schemaVersion: 1,
        metadata: {
            reviewedAtCommit: gitCommit,
            sourceFingerprint,
            reviewBasis: 'Phase 5A-R R0 ownership and reachability review',
            completedMigrationStages: [],
        },
        entries: sortById(
            inventoryEntries.map((record) => {
                const targetOwner = targetOwnerFor(record);
                const migrationStage = migrationStageFor(targetOwner);
                const targetAction = targetActionFor(record, targetOwner);
                return {
                    id: record.id,
                    currentOwner: currentOwnerFor(record),
                    targetOwner,
                    classification: classificationFor(targetOwner, record),
                    migrationStage,
                    rootReachableAfter: rootReachableAfterFor(record, targetOwner),
                    targetAction,
                    duplicateResolutionStage: record.kind === 'owner' ? migrationStage : null,
                    testId: record.publicApi
                        ? publicApiTest(record.memberName)
                        : `scripts/check-full-facade-ownership.mjs#${record.id}`,
                };
            }),
        ),
    };
}

const legacyTargetByFamily = Object.freeze({
    FILTERS: ['LEGACY_FILTERS_ADAPTER', 'R5B', ['CoreImagePort', 'HistoryCommitPort']],
    CROP: ['LEGACY_CROP_ADAPTER', 'R5C', ['CoreCanvasPort', 'OverlaySessionPort']],
    MOSAIC: ['LEGACY_MOSAIC_ADAPTER', 'R5D', ['CoreCanvasPort', 'PixelRegionPort']],
    ANNOTATION: ['LEGACY_ANNOTATION_ADAPTER', 'R5E', ['CoreCanvasPort', 'OverlayRegistryPort']],
    OVERLAY_STATE: [
        'LEGACY_OVERLAY_STATE_ADAPTER',
        'R5F',
        ['OverlayRegistryPort', 'StateMigrationPort'],
    ],
    UI: ['LEGACY_DOM_ADAPTER', 'R5G', ['PublicStatePort', 'ToolCommandPort']],
    MASK: ['MASK_PLUGIN', 'R4', ['MaskPluginApi', 'OverlayRegistryPort']],
    HISTORY: ['HISTORY_PLUGIN', 'R3', ['HistoryPluginApi', 'CoreMementoPort']],
    RUNTIME: ['THIN_FACADE', 'R2', ['FullCompositionPort', 'LegacyCallbackPort']],
});

function legacyRegressionTest(family) {
    return {
        FILTERS: 'tests/image-filters.test.mjs#legacy-filter-behavior',
        CROP: 'tests/browser/e2e/crop.spec.ts#legacy-crop-behavior',
        MOSAIC: 'tests/browser/e2e/mosaic.spec.ts#legacy-mosaic-behavior',
        ANNOTATION: 'tests/browser/e2e/export.spec.ts#legacy-annotation-behavior',
        OVERLAY_STATE: 'tests/overlay-state-api.test.mjs#legacy-overlay-state-behavior',
        UI: 'tests/dom-bindings.property.test.mjs#legacy-dom-behavior',
        MASK: 'tests/mask-history-regression.test.mjs#legacy-mask-behavior',
        HISTORY: 'tests/browser/e2e/undo-redo.spec.ts#legacy-history-behavior',
        RUNTIME: 'tests/runtime-wiring.test.mjs#legacy-runtime-behavior',
    }[family];
}

function seedLegacyPolicy(gitCommit, sourceFingerprint, generatedEntries) {
    return {
        schemaVersion: 1,
        metadata: {
            reviewedAtCommit: gitCommit,
            sourceFingerprint,
            completedMigrationStages: [],
        },
        entries: sortById(
            generatedEntries.map((record) => {
                const [targetAdapter, migrationSubstage, narrowPorts] =
                    legacyTargetByFamily[record.family];
                const mutating = !/^(?:get|is|can|export|list|find|read)/i.test(
                    record.publicApiSource.split('.').at(-1) ?? '',
                );
                return {
                    id: record.id,
                    publicApiSource: record.publicApiSource,
                    helperSymbol: record.helperSymbol,
                    currentStateDependencies: record.currentStateDependencies,
                    targetAdapter,
                    narrowPorts,
                    operationId: `legacy:${record.family.toLowerCase()}:${slug(record.publicApiSource)}:${slug(record.helperSymbol)}`,
                    historyBehavior:
                        record.kind === 'import'
                            ? 'No runtime behavior at the import declaration.'
                            : mutating
                              ? 'Preserve the existing single post-commit history record and rollback boundary.'
                              : 'Read-only operation; do not create a history record.',
                    callbackOrder:
                        record.kind === 'import'
                            ? 'No callback at the import declaration.'
                            : 'Preserve the enclosing public method callback and state-notification order.',
                    errorRoute:
                        record.kind === 'import'
                            ? 'No error route at the import declaration.'
                            : 'Route through the existing callback reporter and preserve rejection timing.',
                    migrationSubstage,
                    regressionTest: legacyRegressionTest(record.family),
                };
            }),
        ),
    };
}

function bridgeDecision(record) {
    const source = record.sourceFile;
    const symbol = record.symbol.toLowerCase();
    if (source.endsWith('plugin-history-adapter.ts')) {
        return {
            classification: 'HISTORY_DUPLICATE',
            finalOwner: 'HISTORY_PLUGIN',
            deleteStage: 'R4',
            rationale:
                'Remove the legacy command-to-Memento bridge after all callers use one History Plugin stack.',
        };
    }
    if (source.endsWith('full-facade-annotation-plugin.ts')) {
        return {
            classification: 'FEATURE_SPECIFIC',
            finalOwner: 'LEGACY_ANNOTATION_ADAPTER',
            deleteStage: 'R5E',
            rationale:
                'Retain Annotation kind, serializer, and geometry semantics only until the Annotation adapter owns them.',
        };
    }
    if (/currentscale|currentrotation|baseimagescale/.test(symbol)) {
        return {
            classification: 'TRANSFORM_DUPLICATE',
            finalOwner: 'TRANSFORM_PLUGIN',
            deleteStage: 'R3',
            rationale: 'Transform state is authoritative in Core and the Transform Plugin.',
        };
    }
    if (/imagemimetype/.test(symbol)) {
        return {
            classification: 'CORE_DUPLICATE',
            finalOwner: 'CORE',
            deleteStage: 'R4',
            rationale: 'Loaded-image metadata belongs to Core state.',
        };
    }
    if (/imagefilter/.test(symbol)) {
        return {
            classification: 'FEATURE_SPECIFIC',
            finalOwner: 'LEGACY_FILTERS_ADAPTER',
            deleteStage: 'R5B',
            rationale: 'Filter configuration remains feature-specific compatibility state.',
        };
    }
    if (/annotation|selectedannotation/.test(symbol)) {
        return {
            classification: 'FEATURE_SPECIFIC',
            finalOwner: 'LEGACY_ANNOTATION_ADAPTER',
            deleteStage: 'R5E',
            rationale: 'Annotation identity and selection belong to the Annotation adapter.',
        };
    }
    if (/mask/.test(symbol)) {
        return {
            classification: 'FEATURE_SPECIFIC',
            finalOwner: 'MASK_PLUGIN',
            deleteStage: 'R4',
            rationale: 'Mask metadata and transient labels belong to the Mask Plugin.',
        };
    }
    if (/crop/.test(symbol)) {
        return {
            classification: 'TRANSIENT_RUNTIME',
            finalOwner: 'LEGACY_CROP_ADAPTER',
            deleteStage: 'R5C',
            rationale: 'Crop session objects are transient state owned by the Crop adapter.',
        };
    }
    if (/mosaic/.test(symbol)) {
        return {
            classification: 'TRANSIENT_RUNTIME',
            finalOwner: 'LEGACY_MOSAIC_ADAPTER',
            deleteStage: 'R5D',
            rationale: 'Mosaic preview objects are transient state owned by the Mosaic adapter.',
        };
    }
    if (/transientobjects/.test(symbol)) {
        return {
            classification: 'TRANSIENT_RUNTIME',
            finalOwner: 'FEATURE_ADAPTERS',
            deleteStage: 'R5F',
            rationale:
                'Split the aggregate predicate among Mask, Crop, Mosaic, and Annotation owners.',
        };
    }
    if (/objectproperties/.test(symbol)) {
        return {
            classification: 'COMPATIBILITY_ONLY',
            finalOwner: 'FEATURE_ADAPTERS',
            deleteStage: 'R5F',
            rationale: 'Split the aggregate property list into owner-specific registrations.',
        };
    }
    return {
        classification: 'COMPATIBILITY_ONLY',
        finalOwner: 'LEGACY_OVERLAY_STATE_ADAPTER',
        deleteStage: 'R5F',
        rationale:
            'Remove the aggregate compatibility slice after owner-specific slices are authoritative.',
    };
}

function seedBridgePolicy(gitCommit, sourceFingerprint, bridgeFacts) {
    return {
        schemaVersion: 1,
        metadata: {
            reviewedAtCommit: gitCommit,
            sourceFingerprint,
            fullFacadeStatePluginDecision:
                'TEMPORARY_ONLY: split all state and registrations by R5F, then remove the plugin.',
            fullFacadeAnnotationPluginDecision:
                'TEMPORARY_ONLY: retain only Annotation kind, serializer, and geometry behavior through R5E.',
            pluginHistoryAdapterDecision:
                'DELETE_IN_R4: route all legacy history calls directly to the single History Plugin stack.',
        },
        entries: sortById(
            bridgeFacts.map((record) => ({
                id: record.id,
                ...bridgeDecision(record),
                rootReachableAfter: false,
                testId: `scripts/check-full-facade-ownership.mjs#${record.id}`,
            })),
        ),
    };
}

function disposition(classification, rootReachableAfter, targetAction, deletionStage, rationale) {
    return { classification, rootReachableAfter, targetAction, deletionStage, rationale };
}

function sourceModuleDisposition(sourceFileName) {
    if (sourceFileName === 'src/index.ts' || sourceFileName === 'src/image-editor.ts') {
        return disposition(
            'COMPATIBILITY_ONLY',
            true,
            'REWRITE_AS_THIN_FACADE',
            'RETAIN',
            'The package root and public ImageEditor class remain, but implementation ownership moves behind composition ports.',
        );
    }
    if (sourceFileName.startsWith('src/core-runtime/')) {
        return disposition(
            'REQUIRED_CORE',
            true,
            'RETAIN',
            'RETAIN',
            'Core owns the authoritative Canvas, image lifecycle, state, geometry, export registry, and Mementos.',
        );
    }
    if (sourceFileName.startsWith('src/plugin-kernel/')) {
        return disposition(
            'REQUIRED_PLUGIN_KERNEL',
            true,
            'RETAIN',
            'RETAIN',
            'ImageEditorCore and official plugins require the instance-local Plugin Kernel.',
        );
    }
    if (
        sourceFileName.startsWith('src/plugins/transform/') ||
        sourceFileName === 'src/animation/animation-queue.ts' ||
        sourceFileName === 'src/fabric/fabric-animation.ts'
    ) {
        return disposition(
            'REQUIRED_TRANSFORM',
            true,
            'RETAIN_CANONICAL_PLUGIN_PATH',
            'RETAIN',
            'The Transform Plugin owns the single animation queue and transform operations.',
        );
    }
    if (sourceFileName.startsWith('src/foundations/overlay/')) {
        return disposition(
            'REQUIRED_OVERLAY',
            true,
            'RETAIN',
            'RETAIN',
            'Overlay Foundation supplies feature-neutral object kind, serializer, and geometry policies.',
        );
    }
    if (sourceFileName.startsWith('src/plugins/mask/') || sourceFileName.startsWith('src/mask/')) {
        return disposition(
            'REQUIRED_MASK',
            true,
            'RETAIN_BEHIND_MASK_PLUGIN',
            'RETAIN',
            'Mask behavior remains reachable only through the Mask Plugin API.',
        );
    }
    if (sourceFileName.startsWith('src/plugins/history/')) {
        return disposition(
            'REQUIRED_HISTORY',
            true,
            'RETAIN_CANONICAL_PLUGIN_PATH',
            'RETAIN',
            'The History Plugin owns the single undo/redo stack.',
        );
    }
    if (sourceFileName.startsWith('src/compatibility/')) {
        return disposition(
            'COMPATIBILITY_ONLY',
            false,
            'ABSORB_INTO_OWNER_SPECIFIC_ADAPTERS',
            sourceFileName.includes('history') ? 'R4' : 'R5F',
            'The aggregate compatibility bridge is temporary and must disappear after owner-specific state and APIs are wired.',
        );
    }
    if (sourceFileName.startsWith('src/runtime/')) {
        return disposition(
            'DUPLICATE_CORE_RUNTIME_INFRASTRUCTURE',
            false,
            'REMOVE_AFTER_COMPOSITION_PORTS_REPLACE_RUNTIME',
            sourceFileName.includes('facade-wiring') || sourceFileName.includes('contexts')
                ? 'R5G'
                : 'R2',
            'EditorRuntime and broad context/action factories duplicate Core and keep legacy infrastructure root-reachable.',
        );
    }
    if (sourceFileName.startsWith('src/history/')) {
        return disposition(
            'DUPLICATE_QUEUE_GUARD_HISTORY_STATE',
            false,
            'ROUTE_DIRECTLY_TO_HISTORY_PLUGIN',
            'R4',
            'Legacy history ports and state actions disappear after the History Plugin becomes the only stack owner.',
        );
    }
    if (sourceFileName.startsWith('src/export/')) {
        return disposition(
            'DUPLICATE_CORE_RUNTIME_INFRASTRUCTURE',
            false,
            'ABSORB_EXPORT_WORKSPACE_INTO_CORE',
            'R5A',
            'Core must own export readiness and workspace composition without a parallel facade export service.',
        );
    }
    if (
        sourceFileName === 'src/core/state-serializer.ts' ||
        sourceFileName === 'src/core/operation-guard.ts' ||
        sourceFileName === 'src/core/default-options.ts' ||
        sourceFileName === 'src/core/editor-elements.ts' ||
        sourceFileName === 'src/core/callback-reporter.ts'
    ) {
        return disposition(
            sourceFileName.includes('operation-guard') ||
                sourceFileName.includes('state-serializer')
                ? 'DUPLICATE_QUEUE_GUARD_HISTORY_STATE'
                : 'DUPLICATE_CORE_RUNTIME_INFRASTRUCTURE',
            false,
            'ABSORB_INTO_CORE_OR_NARROW_COMPATIBILITY_ADAPTER',
            sourceFileName.includes('editor-elements') ? 'R5G' : 'R2',
            'The current broad legacy helper is replaced by an authoritative Core service or a narrow facade adapter.',
        );
    }
    if (sourceFileName.startsWith('src/annotation/')) {
        const pureAlgorithm = /(?:path-segments|annotation-style)\.ts$/.test(sourceFileName);
        return disposition(
            'REQUIRED_LEGACY_FEATURE_ALGORITHM',
            pureAlgorithm,
            pureAlgorithm ? 'RETAIN_BEHIND_ANNOTATION_ADAPTER' : 'ABSORB_INTO_ANNOTATION_ADAPTER',
            pureAlgorithm ? 'RETAIN' : 'R5E',
            pureAlgorithm
                ? 'Preserve the tested Annotation algorithm behind the narrow adapter.'
                : 'Consolidate facade-oriented Annotation controllers and actions into the narrow adapter.',
        );
    }
    if (sourceFileName.startsWith('src/crop/')) {
        return disposition(
            'REQUIRED_LEGACY_FEATURE_ALGORITHM',
            false,
            'ABSORB_INTO_CROP_ADAPTER',
            'R5C',
            'Preserve Crop behavior while replacing the current facade-oriented action/session modules with one adapter boundary.',
        );
    }
    if (sourceFileName.startsWith('src/mosaic/')) {
        const pureAlgorithm = /(?:mosaic-geometry|mosaic-pixelate)\.ts$/.test(sourceFileName);
        return disposition(
            'REQUIRED_LEGACY_FEATURE_ALGORITHM',
            pureAlgorithm,
            pureAlgorithm ? 'RETAIN_BEHIND_MOSAIC_ADAPTER' : 'ABSORB_INTO_MOSAIC_ADAPTER',
            pureAlgorithm ? 'RETAIN' : 'R5D',
            pureAlgorithm
                ? 'Preserve deterministic Mosaic pixel and geometry algorithms.'
                : 'Consolidate facade-oriented Mosaic action/session ownership into the adapter.',
        );
    }
    if (sourceFileName.startsWith('src/overlay/')) {
        const pureAlgorithm =
            /(?:overlay-color|overlay-coordinate-transform|overlay-metadata)\.ts$/.test(
                sourceFileName,
            );
        return disposition(
            'REQUIRED_LEGACY_FEATURE_ALGORITHM',
            pureAlgorithm,
            pureAlgorithm ? 'RETAIN_BEHIND_OVERLAY_ADAPTER' : 'ABSORB_INTO_OVERLAY_STATE_ADAPTER',
            pureAlgorithm ? 'RETAIN' : 'R5F',
            pureAlgorithm
                ? 'Preserve feature-neutral overlay value and coordinate algorithms.'
                : 'Replace facade-oriented overlay actions and aggregate state modules with the narrow adapter.',
        );
    }
    if (sourceFileName.startsWith('src/ui/')) {
        return disposition(
            'REQUIRED_LEGACY_FEATURE_ALGORITHM',
            false,
            'CONSOLIDATE_INTO_LEGACY_DOM_ADAPTER',
            'R5G',
            'Preserve DOM behavior while collapsing broad runtime-facing UI modules behind one adapter.',
        );
    }
    if (
        sourceFileName.startsWith('src/lifecycle/') ||
        sourceFileName.startsWith('src/selection/') ||
        sourceFileName.startsWith('src/tool-mode/')
    ) {
        return disposition(
            'DUPLICATE_CORE_RUNTIME_INFRASTRUCTURE',
            false,
            'ABSORB_INTO_CORE_OR_THIN_FACADE',
            sourceFileName.startsWith('src/lifecycle/') ? 'R6' : 'R5G',
            'The current module exists to coordinate EditorRuntime and is removed after composition convergence.',
        );
    }
    if (sourceFileName === 'src/image/transform-actions.ts') {
        return disposition(
            'DUPLICATE_QUEUE_GUARD_HISTORY_STATE',
            false,
            'ROUTE_TO_TRANSFORM_PLUGIN',
            'R3',
            'The Transform Plugin replaces the legacy Transform action port.',
        );
    }
    if (sourceFileName === 'src/image/image-filters.ts') {
        return disposition(
            'REQUIRED_LEGACY_FEATURE_ALGORITHM',
            true,
            'RETAIN_BEHIND_FILTERS_ADAPTER',
            'RETAIN',
            'Preserve the tested image-filter algorithm behind the Filters adapter.',
        );
    }
    if (
        sourceFileName.startsWith('src/image/') ||
        sourceFileName === 'src/fabric/fabric-adapter.ts'
    ) {
        return disposition(
            'REQUIRED_CORE',
            true,
            'REUSE_FROM_CORE',
            'RETAIN',
            'Core reuses the existing tested image input, layout, loading, and resampling algorithms.',
        );
    }
    if (sourceFileName.startsWith('src/core/') || sourceFileName.startsWith('src/utils/')) {
        return disposition(
            'REQUIRED_CORE',
            true,
            'RETAIN_AS_SHARED_PRIMITIVE',
            'RETAIN',
            'The module supplies a shared type, guard, value operation, or utility without owning duplicate runtime state.',
        );
    }
    return disposition(
        'REQUIRED_LEGACY_FEATURE_ALGORITHM',
        true,
        'RETAIN_PENDING_NARROWER_REVIEW',
        'RETAIN',
        'The module is currently behavior-bearing and has no duplicate infrastructure owner.',
    );
}

function sourcePathForBundleModule(moduleName, analysis) {
    if (!moduleName.startsWith('dist/esm/') || !moduleName.endsWith('.js')) return null;
    const base = `src/${moduleName.slice('dist/esm/'.length, -'.js'.length)}`;
    for (const extension of ['.ts', '.tsx', '/index.ts']) {
        const candidate = `${base}${extension}`;
        if (analysis.sourceFiles.has(candidate)) return candidate;
    }
    return null;
}

function importUsageForChain(chain, analysis) {
    if (chain.length < 2) return ['Root entry module.'];
    const source = chain.at(-2);
    const target = chain.at(-1);
    const edge = (analysis.importsByFile.get(source) ?? []).find(
        (candidate) => candidate.target === target,
    );
    if (!edge) return [`Reachable through ${source}.`];
    const symbols = edge.bindings.map(
        (binding) =>
            `${binding.imported}${binding.local === binding.imported ? '' : ` as ${binding.local}`}`,
    );
    return [`${source} imports ${symbols.join(', ')} from ${edge.specifier}.`];
}

function seedReachabilityPolicy(gitCommit, sourceFingerprint, bundle, analysis) {
    const fullRoot = bundle.fixtures?.['full-root'];
    if (!fullRoot || !Array.isArray(fullRoot.modules)) {
        throw new Error('Current bundle measurement is missing full-root module metadata.');
    }
    const occurrenceCounts = new Map();
    const entries = fullRoot.modules.map((moduleName) => {
        const occurrence = (occurrenceCounts.get(moduleName) ?? 0) + 1;
        occurrenceCounts.set(moduleName, occurrence);
        const sourceFile = sourcePathForBundleModule(moduleName, analysis);
        let decision;
        if (sourceFile) {
            decision = sourceModuleDisposition(sourceFile);
        } else if (
            moduleName === 'commonjsHelpers.js' ||
            moduleName.startsWith('node_modules/semver/')
        ) {
            decision = disposition(
                'DEAD_UNNECESSARY_ROOT_DEPENDENCY',
                false,
                'REPLACE_CJS_GRAPH_WITH_BUNDLE_NEUTRAL_SEMVER_VALIDATION',
                'R7',
                'Full SemVer behavior remains required, but the current node-semver CommonJS module graph and wrapper are not required owners. Replace them without externalization and retain conformance tests.',
            );
        } else if (moduleName.startsWith('tests/bundle/fixtures/')) {
            decision = disposition(
                'DEAD_UNNECESSARY_ROOT_DEPENDENCY',
                true,
                'RETAIN_MEASUREMENT_FIXTURE_ONLY',
                'RETAIN',
                'This is the measurement entry wrapper, not shipped library implementation.',
            );
        } else {
            decision = disposition(
                'DEAD_UNNECESSARY_ROOT_DEPENDENCY',
                false,
                'REMOVE_UNEXPLAINED_BUNDLE_MODULE',
                'R6',
                'The module has no mapped source owner and must not remain unexplained in the root graph.',
            );
        }
        const sourceChain = sourceFile ? analysis.importChain(sourceFile) : [];
        const actualImportChain = sourceFile
            ? ['tests/bundle/fixtures/full-root/index.mjs', 'dist/esm/index.js', ...sourceChain]
            : moduleName.startsWith('node_modules/semver/') || moduleName === 'commonjsHelpers.js'
              ? [
                    'tests/bundle/fixtures/full-root/index.mjs',
                    'dist/esm/index.js',
                    'src/plugin-kernel/semver.ts',
                    moduleName,
                ]
              : ['tests/bundle/fixtures/full-root/index.mjs', moduleName];
        return {
            id: createStableId('bundle-module', moduleName, String(occurrence)),
            module: moduleName,
            occurrence,
            sourceFile,
            ...decision,
            actualImportChain,
            symbolUsage: sourceFile
                ? importUsageForChain(sourceChain, analysis)
                : [`Rollup full-root module occurrence ${occurrence}.`],
            sourceBytes: sourceFile
                ? Buffer.byteLength(analysis.sourceTexts.get(sourceFile) ?? '', 'utf8')
                : null,
        };
    });
    return {
        schemaVersion: 1,
        metadata: {
            reviewedAtCommit: gitCommit,
            sourceFingerprint,
            bundleArtifactFingerprint: bundle.metadata?.artifactFingerprint ?? null,
            measuredModuleCount: fullRoot.moduleCount,
            completedMigrationStages: [],
            note: 'rootReachableAfter is a target assertion for the current module. Replacement adapter modules are not included in the gross-removal count.',
        },
        entries: sortById(entries),
    };
}

function generateOwnershipInventory(analysis, gitCommit, bundle, legacyEntries) {
    const records = [
        ...memberRecords(analysis, 'src/image-editor.ts', 'ImageEditor'),
        ...memberRecords(analysis, 'src/runtime/editor-runtime.ts', 'EditorRuntime', true),
        ...rootImportRecords(analysis),
        ...compatibilityStateFieldRecords(analysis),
        ...moduleRecords(analysis),
        ...ownerRecords(analysis),
        ...bridgeCallRecords(analysis),
        ...optionsAndCallbackRecords(analysis),
        ...legacyEntries.map((entry) => ({
            id: createStableId('inventory-legacy-site', entry.id),
            kind: 'call-site',
            sourceFile: entry.sourceFile,
            symbol: entry.helperSymbol,
            line: entry.line,
            currentReachableFromRoot: entry.currentReachableFromRoot,
            evidence: entry.evidence,
            callSiteKind: 'legacy-helper',
            legacyCallSiteId: entry.id,
            enclosingSymbol: entry.publicApiSource,
        })),
    ];
    const unique = new Map();
    for (const record of records) {
        if (unique.has(record.id))
            throw new Error(`Duplicate generated ownership ID: ${record.id}`);
        unique.set(record.id, record);
    }
    return {
        schemaVersion: 1,
        metadata: {
            gitCommit,
            packageVersion: bundle.metadata?.packageVersion ?? null,
            sourceFingerprint: analysis.sourceFingerprint,
            bundleArtifactFingerprint: bundle.metadata?.artifactFingerprint ?? null,
            sourceFileCount: analysis.sourceFiles.size,
            rootReachableModuleCount: analysis.reachable.size,
            rootReachableSourceBytes: analysis.reachableSourceBytes,
            generatedBy: 'scripts/check-full-facade-ownership.mjs --generate',
        },
        entries: sortById([...unique.values()]),
    };
}

function generateLegacyInventory(analysis, gitCommit, bundle, entries) {
    return {
        schemaVersion: 1,
        metadata: {
            gitCommit,
            packageVersion: bundle.metadata?.packageVersion ?? null,
            sourceFingerprint: analysis.sourceFingerprint,
            generatedBy: 'scripts/check-full-facade-ownership.mjs --generate',
        },
        entries,
    };
}

export function validatePolicyCoverage(generatedEntries, policyEntries, label) {
    const errors = [];
    const generatedCounts = new Map();
    const policyCounts = new Map();
    for (const entry of generatedEntries) {
        generatedCounts.set(entry.id, (generatedCounts.get(entry.id) ?? 0) + 1);
    }
    for (const entry of policyEntries) {
        policyCounts.set(entry.id, (policyCounts.get(entry.id) ?? 0) + 1);
    }
    for (const [id, count] of generatedCounts) {
        if (count !== 1) errors.push(`${label}: generated ID ${id} appears ${count} times.`);
        const policyCount = policyCounts.get(id) ?? 0;
        if (policyCount !== 1) {
            errors.push(`${label}: policy must cover ${id} exactly once; found ${policyCount}.`);
        }
    }
    for (const [id, count] of policyCounts) {
        if (count !== 1) errors.push(`${label}: policy ID ${id} appears ${count} times.`);
        if (!generatedCounts.has(id)) errors.push(`${label}: orphan policy entry ${id}.`);
    }
    return errors;
}

export function findUnclassifiedValues(value, location = '$') {
    const errors = [];
    if (typeof value === 'string' && /UNCLASSIFIED/i.test(value)) {
        errors.push(`${location} contains UNCLASSIFIED.`);
    } else if (Array.isArray(value)) {
        value.forEach((item, index) =>
            errors.push(...findUnclassifiedValues(item, `${location}[${index}]`)),
        );
    } else if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) {
            errors.push(...findUnclassifiedValues(child, `${location}.${key}`));
        }
    }
    return errors;
}

function testFileFromId(testId) {
    return String(testId).split('#', 1)[0];
}

async function validateOwnershipPolicy(inventory, policy) {
    const errors = validatePolicyCoverage(inventory.entries, policy.entries, 'ownership');
    if (policy.metadata?.sourceFingerprint !== inventory.metadata.sourceFingerprint) {
        errors.push('ownership: policy source fingerprint does not match generated inventory.');
    }
    const generatedById = new Map(inventory.entries.map((entry) => [entry.id, entry]));
    const policyById = new Map(policy.entries.map((entry) => [entry.id, entry]));
    for (const entry of policy.entries) {
        if (!validCurrentOwners.has(entry.currentOwner)) {
            errors.push(`ownership: invalid currentOwner for ${entry.id}: ${entry.currentOwner}`);
        }
        if (!validTargetOwners.has(entry.targetOwner)) {
            errors.push(`ownership: invalid targetOwner for ${entry.id}: ${entry.targetOwner}`);
        }
        if (!validClassifications.has(entry.classification)) {
            errors.push(
                `ownership: invalid classification for ${entry.id}: ${entry.classification}`,
            );
        }
        if (!validMigrationStages.has(entry.migrationStage)) {
            errors.push(
                `ownership: invalid migrationStage for ${entry.id}: ${entry.migrationStage}`,
            );
        }
        if (typeof entry.rootReachableAfter !== 'boolean') {
            errors.push(`ownership: rootReachableAfter must be boolean for ${entry.id}.`);
        }
        if (!entry.targetAction) errors.push(`ownership: missing targetAction for ${entry.id}.`);
        const generated = generatedById.get(entry.id);
        if (generated?.publicApi && !entry.testId) {
            errors.push(`ownership: public method ${generated.symbol} has no testId.`);
        }
        if (generated?.rootDirectImport && !entry.targetAction) {
            errors.push(`ownership: root direct import ${generated.symbol} has no target action.`);
        }
        if (
            entry.testId &&
            !(await fileExists(path.join(repositoryRoot, testFileFromId(entry.testId))))
        ) {
            errors.push(`ownership: test file for ${entry.id} does not exist: ${entry.testId}`);
        }
    }

    const ownersByFamily = new Map();
    for (const generated of inventory.entries.filter((entry) => entry.kind === 'owner')) {
        const owners = ownersByFamily.get(generated.ownerFamily) ?? [];
        owners.push(generated);
        ownersByFamily.set(generated.ownerFamily, owners);
    }
    for (const [family, owners] of ownersByFamily) {
        if (
            owners.length < 2 ||
            !new Set(['Canvas', 'AnimationQueue', 'OperationGuard', 'HistoryStack']).has(family)
        ) {
            continue;
        }
        const decisions = owners.map((owner) => policyById.get(owner.id));
        if (decisions.some((decision) => !decision?.duplicateResolutionStage)) {
            errors.push(`ownership: duplicate owner family ${family} lacks a resolution stage.`);
        }
        if (!decisions.some((decision) => decision?.targetAction === 'DELETE_DUPLICATE')) {
            errors.push(`ownership: duplicate owner family ${family} has no deletion action.`);
        }
        if (!decisions.some((decision) => decision?.targetAction === 'KEEP_CANONICAL')) {
            errors.push(`ownership: duplicate owner family ${family} has no canonical owner.`);
        }
    }

    for (const completedStage of policy.metadata?.completedMigrationStages ?? []) {
        for (const entry of policy.entries) {
            if (
                entry.migrationStage === completedStage &&
                entry.rootReachableAfter === false &&
                generatedById.has(entry.id)
            ) {
                errors.push(
                    `ownership: ${entry.id} remains reachable after completed stage ${completedStage}.`,
                );
            }
        }
    }
    return errors;
}

async function validateLegacyPolicy(generated, policy) {
    const errors = validatePolicyCoverage(generated.entries, policy.entries, 'legacy-call-sites');
    if (policy.metadata?.sourceFingerprint !== generated.metadata.sourceFingerprint) {
        errors.push(
            'legacy-call-sites: policy source fingerprint does not match generated inventory.',
        );
    }
    for (const entry of policy.entries) {
        if (!validTargetOwners.has(entry.targetAdapter)) {
            errors.push(`legacy-call-sites: invalid target adapter for ${entry.id}.`);
        }
        if (!validMigrationStages.has(entry.migrationSubstage)) {
            errors.push(`legacy-call-sites: invalid migration substage for ${entry.id}.`);
        }
        for (const required of [
            'publicApiSource',
            'helperSymbol',
            'operationId',
            'historyBehavior',
            'callbackOrder',
            'errorRoute',
            'regressionTest',
        ]) {
            if (!entry[required]) errors.push(`legacy-call-sites: ${entry.id} lacks ${required}.`);
        }
        if (!Array.isArray(entry.currentStateDependencies) || !Array.isArray(entry.narrowPorts)) {
            errors.push(
                `legacy-call-sites: ${entry.id} lacks state dependency or narrow Port data.`,
            );
        }
        if (
            entry.regressionTest &&
            !(await fileExists(path.join(repositoryRoot, testFileFromId(entry.regressionTest))))
        ) {
            errors.push(
                `legacy-call-sites: regression test file does not exist for ${entry.id}: ${entry.regressionTest}`,
            );
        }
    }
    return errors;
}

async function validateBridgePolicy(bridgeFacts, policy, sourceFingerprint) {
    const errors = validatePolicyCoverage(bridgeFacts, policy.entries, 'compatibility-bridge');
    if (policy.metadata?.sourceFingerprint !== sourceFingerprint) {
        errors.push('compatibility-bridge: policy source fingerprint is stale.');
    }
    for (const entry of policy.entries) {
        if (!validBridgeClassifications.has(entry.classification)) {
            errors.push(`compatibility-bridge: invalid classification for ${entry.id}.`);
        }
        if (!entry.finalOwner || !entry.deleteStage || !entry.rationale || !entry.testId) {
            errors.push(`compatibility-bridge: incomplete decision for ${entry.id}.`);
        }
    }
    return errors;
}

function expectedBundleModuleIds(bundle) {
    const modules = bundle.fixtures?.['full-root']?.modules ?? [];
    const counts = new Map();
    return modules.map((moduleName) => {
        const occurrence = (counts.get(moduleName) ?? 0) + 1;
        counts.set(moduleName, occurrence);
        return createStableId('bundle-module', moduleName, String(occurrence));
    });
}

function validateReachabilityPolicy(policy, bundle, gitCommit, sourceFingerprint) {
    const expectedEntries = expectedBundleModuleIds(bundle).map((id) => ({ id }));
    const errors = validatePolicyCoverage(expectedEntries, policy.entries, 'root-reachability');
    if (bundle.metadata?.gitCommit !== gitCommit) {
        errors.push(
            `root-reachability: current bundle commit ${bundle.metadata?.gitCommit ?? '<missing>'} does not equal HEAD ${gitCommit}.`,
        );
    }
    if (policy.metadata?.sourceFingerprint !== sourceFingerprint) {
        errors.push('root-reachability: policy source fingerprint is stale.');
    }
    if (policy.metadata?.bundleArtifactFingerprint !== bundle.metadata?.artifactFingerprint) {
        errors.push('root-reachability: policy bundle artifact fingerprint is stale.');
    }
    if (policy.metadata?.measuredModuleCount !== bundle.fixtures?.['full-root']?.moduleCount) {
        errors.push('root-reachability: measured module count is stale.');
    }
    for (const entry of policy.entries) {
        if (!validReachabilityClassifications.has(entry.classification)) {
            errors.push(`root-reachability: invalid classification for ${entry.id}.`);
        }
        if (
            typeof entry.rootReachableAfter !== 'boolean' ||
            !entry.targetAction ||
            !entry.deletionStage ||
            !entry.rationale ||
            !Array.isArray(entry.actualImportChain) ||
            entry.actualImportChain.length === 0 ||
            !Array.isArray(entry.symbolUsage) ||
            entry.symbolUsage.length === 0
        ) {
            errors.push(`root-reachability: incomplete module evidence for ${entry.id}.`);
        }
    }
    return errors;
}

function validateR2CanvasOwnership(analysis) {
    const errors = [];
    const canvasOwners = ownerRecords(analysis).filter((entry) => entry.ownerFamily === 'Canvas');
    if (
        canvasOwners.length !== 1 ||
        canvasOwners[0]?.sourceFile !== 'src/core-runtime/image-editor-core.ts'
    ) {
        errors.push(
            `R2 Canvas ownership requires one Core owner; found ${canvasOwners.map((entry) => `${entry.sourceFile}:${entry.line}`).join(', ') || 'none'}.`,
        );
    }
    const facadeSource = analysis.sourceTexts.get('src/image-editor.ts') ?? '';
    const coreSource = analysis.sourceTexts.get('src/core-runtime/image-editor-core.ts') ?? '';
    for (const forbidden of ['attachExistingCanvas', 'synchronizeCompatibilityImage']) {
        if (facadeSource.includes(forbidden) || coreSource.includes(forbidden)) {
            errors.push(`R2 forbidden compatibility bridge remains reachable: ${forbidden}.`);
        }
    }
    if (/new\s+[^;\n]*\.Canvas\s*\(/.test(facadeSource)) {
        errors.push('R2 root facade still constructs a Canvas.');
    }
    return errors;
}

function markdownCode(value) {
    return `\`${String(value).replace(/`/g, '\\`')}\``;
}

function markdownText(value) {
    return String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

async function formatMarkdown(content) {
    const config = (await resolveConfig(path.join(repositoryRoot, 'package.json'))) ?? {};
    return format(content, { ...config, parser: 'markdown' });
}

async function renderRuntimeOwnership(inventory, policy) {
    const generatedById = new Map(inventory.entries.map((entry) => [entry.id, entry]));
    const rows = policy.entries
        .map((entry) => ({ ...entry, generated: generatedById.get(entry.id) }))
        .filter(
            ({ generated }) =>
                generated &&
                (generated.kind === 'field' ||
                    generated.kind === 'owner' ||
                    generated.kind === 'state-field'),
        );
    const lines = [
        '# Phase 5A-R Runtime Ownership',
        '',
        '> Generated and verified by `scripts/check-full-facade-ownership.mjs`. Edit the policy JSON, not this table.',
        '',
        `Inventory commit: ${markdownCode(inventory.metadata.gitCommit)}. Source fingerprint: ${markdownCode(inventory.metadata.sourceFingerprint)}.`,
        '',
        `The root currently reaches ${inventory.metadata.rootReachableModuleCount} TypeScript modules (${inventory.metadata.rootReachableSourceBytes.toLocaleString('en-US')} source bytes). The table covers ${rows.length} fields, state properties, and concrete owner sites.`,
        '',
        '| Stable ID | Existing field/service | Current owner | Target owner | Migration stage | Root reachable after | Test |',
        '| --- | --- | --- | --- | --- | --- | --- |',
    ];
    for (const row of rows) {
        lines.push(
            `| ${markdownCode(row.id)} | ${markdownCode(row.generated.symbol)} | ${markdownCode(row.currentOwner)} | ${markdownCode(row.targetOwner)} | ${markdownCode(row.migrationStage)} | ${row.rootReachableAfter ? 'yes' : 'no'} | ${markdownCode(row.testId)} |`,
        );
    }
    lines.push(
        '',
        '## Ownership conclusion',
        '',
        'Core is the target owner of the live Canvas, load/layout/export/state lifecycle, and Mementos. Transform and History each converge to one plugin-owned queue/stack. Existing broad `EditorRuntime`, context factories, compatibility state, and direct helper calls are migration inputs, not target architecture.',
        '',
    );
    return formatMarkdown(lines.join('\n'));
}

async function renderBridgeAudit(bridgeFacts, policy) {
    const factsById = new Map(bridgeFacts.map((entry) => [entry.id, entry]));
    const lines = [
        '# Phase 5A-R Compatibility Bridge Audit',
        '',
        '> Generated and verified by `scripts/check-full-facade-ownership.mjs`. Edit the policy JSON, not this table.',
        '',
        '## Decisions',
        '',
        `- Full facade state plugin: ${policy.metadata.fullFacadeStatePluginDecision}`,
        `- Full facade Annotation plugin: ${policy.metadata.fullFacadeAnnotationPluginDecision}`,
        `- Plugin History adapter: ${policy.metadata.pluginHistoryAdapterDecision}`,
        '',
        '| Stable ID | Existing item | Kind | Classification | Final owner | Delete stage | Rationale |',
        '| --- | --- | --- | --- | --- | --- | --- |',
    ];
    for (const entry of policy.entries) {
        const fact = factsById.get(entry.id);
        lines.push(
            `| ${markdownCode(entry.id)} | ${markdownCode(fact.symbol)} | ${markdownCode(fact.bridgeKind)} | ${markdownCode(entry.classification)} | ${markdownCode(entry.finalOwner)} | ${markdownCode(entry.deleteStage)} | ${markdownText(entry.rationale)} |`,
        );
    }
    lines.push(
        '',
        '## Required split',
        '',
        'Filter configuration moves to the Filters adapter; Annotation identity, selection, serializer, kind, and geometry policy move to the Annotation adapter; Mask properties and label predicates move to the Mask Plugin. Crop and Mosaic transient predicates move to their adapters. Object-property registration is split by those owners. The aggregate state slice is removed after these owner-specific slices are authoritative.',
        '',
    );
    return formatMarkdown(lines.join('\n'));
}

async function renderBundleOwnership(policy) {
    const categoryCounts = new Map();
    for (const entry of policy.entries) {
        categoryCounts.set(
            entry.classification,
            (categoryCounts.get(entry.classification) ?? 0) + 1,
        );
    }
    const removalCandidates = policy.entries.filter((entry) => !entry.rootReachableAfter);
    const grossTarget = policy.entries.length - removalCandidates.length;
    const lines = [
        '# Phase 5A-R Bundle Ownership',
        '',
        '> Generated and verified by `scripts/check-full-facade-ownership.mjs`. Edit the policy JSON, not this table.',
        '',
        `The current Full fixture contains ${policy.entries.length} Rollup module occurrences. ${removalCandidates.length} current module occurrences are explicit removal/absorption candidates, leaving a gross current-module target of ${grossTarget} before replacement adapter modules. This is an architectural feasibility inventory, not a substitute for the locked byte/module gate.`,
        '',
        '## Classification summary',
        '',
        '| Classification | Module occurrences |',
        '| --- | ---: |',
    ];
    for (const [category, count] of [...categoryCounts].sort(([left], [right]) =>
        left.localeCompare(right),
    )) {
        lines.push(`| ${markdownCode(category)} | ${count} |`);
    }
    lines.push(
        '',
        '## Module evidence',
        '',
        '| Stable ID | Module | Classification | Target action | Delete stage | Root after | Actual import chain / symbol usage |',
        '| --- | --- | --- | --- | --- | --- | --- |',
    );
    for (const entry of policy.entries) {
        const evidence = `${entry.actualImportChain.join(' -> ')}; ${entry.symbolUsage.join(' ')}`;
        lines.push(
            `| ${markdownCode(entry.id)} | ${markdownCode(entry.module)} | ${markdownCode(entry.classification)} | ${markdownCode(entry.targetAction)} | ${markdownCode(entry.deletionStage)} | ${entry.rootReachableAfter ? 'yes' : 'no'} | ${markdownText(evidence)} |`,
        );
    }
    lines.push(
        '',
        '## Budget interpretation',
        '',
        'Required feature algorithms are preserved even when their current facade-oriented wrapper module is absorbed into a narrow adapter. Duplicate runtime/context/export/history/state modules are removal candidates. The formal success condition remains the live deterministic Full measurement at or below all five locked maxima; this gross module inventory does not authorize budget changes or externalization.',
        '',
    );
    return formatMarkdown(lines.join('\n'));
}

async function readPolicies() {
    return {
        ownership: await readJson(ownershipPolicyPath),
        legacy: await readJson(legacyPolicyPath),
        bridge: await readJson(bridgePolicyPath),
        reachability: await readJson(reachabilityPolicyPath),
    };
}

async function seedPoliciesIfNeeded(
    refreshPolicies,
    gitCommit,
    analysis,
    bundle,
    ownershipInventory,
    legacyInventory,
    bridgeFacts,
) {
    const seeds = [
        [
            ownershipPolicyPath,
            seedOwnershipPolicy(gitCommit, analysis.sourceFingerprint, ownershipInventory.entries),
        ],
        [
            legacyPolicyPath,
            seedLegacyPolicy(gitCommit, analysis.sourceFingerprint, legacyInventory.entries),
        ],
        [bridgePolicyPath, seedBridgePolicy(gitCommit, analysis.sourceFingerprint, bridgeFacts)],
        [
            reachabilityPolicyPath,
            seedReachabilityPolicy(gitCommit, analysis.sourceFingerprint, bundle, analysis),
        ],
    ];
    for (const [filePath, seed] of seeds) {
        if (refreshPolicies || !(await fileExists(filePath))) await writeJson(filePath, seed);
    }
}

async function compareFileWithValue(filePath, expected, label) {
    const actual = await readJson(filePath);
    return JSON.stringify(actual) === JSON.stringify(expected)
        ? []
        : [`${label} does not match the current AST; run --generate and review policy impact.`];
}

async function compareTextFile(filePath, expected, label) {
    const actual = await readFile(filePath, 'utf8');
    return actual === expected ? [] : [`${label} drifted from its machine policy.`];
}

async function validateAll(
    gitCommit,
    analysis,
    bundle,
    ownershipInventory,
    legacyInventory,
    bridgeFacts,
    policies,
) {
    const errors = [];
    if (ownershipInventory.metadata.gitCommit !== gitCommit) {
        errors.push('ownership inventory commit does not equal HEAD.');
    }
    if (legacyInventory.metadata.gitCommit !== gitCommit) {
        errors.push('legacy call-site inventory commit does not equal HEAD.');
    }
    errors.push(
        ...(await validateOwnershipPolicy(ownershipInventory, policies.ownership)),
        ...(await validateLegacyPolicy(legacyInventory, policies.legacy)),
        ...(await validateBridgePolicy(bridgeFacts, policies.bridge, analysis.sourceFingerprint)),
        ...validateReachabilityPolicy(
            policies.reachability,
            bundle,
            gitCommit,
            analysis.sourceFingerprint,
        ),
        ...validateR2CanvasOwnership(analysis),
        ...findUnclassifiedValues({ ownershipInventory, legacyInventory, policies }),
    );
    return errors;
}

async function main() {
    const options = parseArguments(process.argv.slice(2));
    const [analysis, gitCommit, bundle] = await Promise.all([
        analyzeSources(),
        getGitCommit(),
        readJson(currentBundlePath),
    ]);
    const legacyEntries = generateLegacyCallSites(analysis);
    const ownershipInventory = generateOwnershipInventory(
        analysis,
        gitCommit,
        bundle,
        legacyEntries,
    );
    const legacyInventory = generateLegacyInventory(analysis, gitCommit, bundle, legacyEntries);
    const bridgeFacts = compatibilityBridgeFacts(analysis);

    if (options.mode === 'generate') {
        await writeJson(ownershipGeneratedPath, ownershipInventory);
        await writeJson(legacyGeneratedPath, legacyInventory);
        await seedPoliciesIfNeeded(
            options.refreshPolicies,
            gitCommit,
            analysis,
            bundle,
            ownershipInventory,
            legacyInventory,
            bridgeFacts,
        );
    }

    const policies = await readPolicies();
    const runtimeDoc = await renderRuntimeOwnership(ownershipInventory, policies.ownership);
    const bridgeDoc = await renderBridgeAudit(bridgeFacts, policies.bridge);
    const bundleDoc = await renderBundleOwnership(policies.reachability);

    if (options.mode === 'generate') {
        await mkdir(refactorDocsRoot, { recursive: true });
        await Promise.all([
            writeFile(runtimeOwnershipDocPath, runtimeDoc, 'utf8'),
            writeFile(bridgeAuditDocPath, bridgeDoc, 'utf8'),
            writeFile(bundleOwnershipDocPath, bundleDoc, 'utf8'),
        ]);
    }

    const errors = await validateAll(
        gitCommit,
        analysis,
        bundle,
        ownershipInventory,
        legacyInventory,
        bridgeFacts,
        policies,
    );
    errors.push(
        ...(await compareFileWithValue(
            ownershipGeneratedPath,
            ownershipInventory,
            'Full Facade generated inventory',
        )),
        ...(await compareFileWithValue(
            legacyGeneratedPath,
            legacyInventory,
            'Legacy call-site generated inventory',
        )),
        ...(await compareTextFile(runtimeOwnershipDocPath, runtimeDoc, 'Runtime ownership doc')),
        ...(await compareTextFile(bridgeAuditDocPath, bridgeDoc, 'Compatibility bridge doc')),
        ...(await compareTextFile(bundleOwnershipDocPath, bundleDoc, 'Bundle ownership doc')),
    );

    if (errors.length > 0) {
        console.error(`Full Facade ownership check failed (${errors.length} issue(s)):`);
        for (const error of errors) console.error(`- ${error}`);
        process.exitCode = 1;
        return;
    }

    const removalCandidates = policies.reachability.entries.filter(
        (entry) => !entry.rootReachableAfter,
    ).length;
    console.log(
        `Full Facade ownership check passed (${ownershipInventory.entries.length} ownership facts, ${legacyInventory.entries.length} legacy call-site facts, ${bridgeFacts.length} bridge facts, ${policies.reachability.entries.length} bundle modules, ${removalCandidates} removal candidates).`,
    );
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
    await main();
}
