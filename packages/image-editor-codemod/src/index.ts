/**
 * Provides conservative source transformation and filesystem orchestration for the public CLI.
 *
 * Ambiguous integrations are reported without being rewritten.
 *
 * @module
 */

import { randomUUID } from 'node:crypto';
import {
    chmod,
    lstat,
    mkdir,
    readFile,
    readdir,
    rename,
    rm,
    stat,
    writeFile,
} from 'node:fs/promises';
import path from 'node:path';

import ts from 'typescript';

const PACKAGE_ROOT = '@bensitu/image-editor';
const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.mts', '.cts']);
const SKIPPED_DIRECTORIES = new Set(['.git', '.internal', 'dist', 'node_modules']);
const MAX_SOURCE_BYTES = 2 * 1024 * 1024;

const CORE_OPTION_NAMES = new Map<string, string>([
    ['canvasWidth', 'canvasWidth'],
    ['canvasHeight', 'canvasHeight'],
    ['backgroundColor', 'backgroundColor'],
    ['defaultLayoutMode', 'defaultLayoutMode'],
    ['groupSelection', 'groupSelection'],
    ['maxInputBytes', 'maxInputBytes'],
    ['maxInputPixels', 'maxInputPixels'],
    ['imageLoadTimeoutMs', 'imageLoadTimeoutMs'],
    ['maxExportPixels', 'maxExportPixels'],
    ['maxExportDimension', 'maxExportDimension'],
    ['exportMultiplier', 'exportMultiplier'],
    ['initialImageBase64', 'initialImageBase64'],
    ['onError', 'onError'],
    ['onWarning', 'onWarning'],
]);
const TRANSFORM_OPTION_NAMES = new Map<string, string>([
    ['animationDuration', 'animationDuration'],
    ['minScale', 'minScale'],
    ['maxScale', 'maxScale'],
    ['scaleStep', 'scaleStep'],
    ['rotationStep', 'rotationStep'],
]);
const HISTORY_OPTION_NAMES = new Map<string, string>([['maxHistorySize', 'maxSize']]);
const MASK_OPTION_NAMES = new Map<string, string>([
    ['defaultMaskWidth', 'defaultWidth'],
    ['defaultMaskHeight', 'defaultHeight'],
    ['defaultMaskConfig', 'defaultConfig'],
    ['maskRotatable', 'rotatable'],
    ['label', 'label'],
    ['maskLabelOffset', 'labelOffset'],
    ['maskListOrder', 'listOrder'],
    ['bindMasksToImageTransform', 'bindToImageTransform'],
    ['maskName', 'namePrefix'],
]);
const ANNOTATION_OPTION_NAMES = new Map<string, string>([['annotationListOrder', 'listOrder']]);

const CORE_METHODS = new Set([
    'init',
    'loadImage',
    'isImageLoaded',
    'getImageInfo',
    'setLayoutMode',
    'saveState',
    'exportImageBase64',
    'exportImageFile',
    'dispose',
    'disposeAsync',
]);
const FEATURE_METHODS = new Map<string, readonly [string, string]>([
    ['scaleImage', ['transform', 'scale']],
    ['rotateImage', ['transform', 'rotate']],
    ['flipHorizontal', ['transform', 'flipHorizontal']],
    ['flipVertical', ['transform', 'flipVertical']],
    ['resetImageTransform', ['transform', 'resetImageTransform']],
    ['undo', ['history', 'undo']],
    ['redo', ['history', 'redo']],
    ['createMask', ['masks', 'create']],
    ['getMasks', ['masks', 'getAll']],
    ['removeSelectedMask', ['masks', 'removeSelected']],
    ['removeAllMasks', ['masks', 'removeAll']],
    ['mergeMasks', ['masks', 'flatten']],
    ['exportOverlayState', ['overlayState', 'exportState']],
    ['validateOverlayState', ['overlayState', 'validate']],
    ['importOverlayState', ['overlayState', 'importState']],
]);
const CORE_ELEMENT_NAMES = new Set(['canvas', 'canvasContainer', 'imagePlaceholder']);

export type CodemodMode = 'write' | 'dry-run' | 'diff';

export interface CodemodFinding {
    readonly file: string;
    readonly line: number;
    readonly column: number;
    readonly code: string;
    readonly message: string;
}

export interface SourceTransformResult {
    readonly code: string;
    readonly changed: boolean;
    readonly unresolved: readonly CodemodFinding[];
}

export interface CodemodFileReport {
    readonly file: string;
    readonly changed: boolean;
    readonly written: boolean;
    readonly unresolved: readonly CodemodFinding[];
    readonly diff?: string;
}

export interface CodemodReport {
    readonly command: 'migrate';
    readonly mode: CodemodMode;
    readonly result: 'PASS' | 'CHANGES_AVAILABLE' | 'UNRESOLVED';
    readonly filesScanned: number;
    readonly filesChanged: number;
    readonly filesWritten: number;
    readonly unresolvedCount: number;
    readonly files: readonly CodemodFileReport[];
}

export interface RunCodemodOptions {
    readonly mode?: CodemodMode;
    readonly cwd?: string;
}

interface TextEdit {
    readonly start: number;
    readonly end: number;
    readonly text: string;
}

interface OptionEntry {
    readonly name: string;
    readonly value: string;
}

interface OptionAnalysis {
    readonly core: readonly OptionEntry[];
    readonly transform: readonly OptionEntry[];
    readonly history: readonly OptionEntry[];
    readonly masks: readonly OptionEntry[];
    readonly annotations: readonly OptionEntry[];
    readonly blocked: boolean;
    readonly requiresFullPreset: boolean;
}

interface EditorCall {
    readonly property: ts.PropertyAccessExpression;
    readonly call: ts.CallExpression;
    readonly method: string;
    readonly awaitRequired: boolean;
}

interface EditorCandidate {
    readonly variable: string;
    readonly declaration: ts.VariableDeclaration;
    readonly expression: ts.NewExpression;
    readonly calls: readonly EditorCall[];
    readonly blocked: boolean;
    readonly requiresFullPreset: boolean;
    readonly options: OptionAnalysis | null;
}

interface OldEditorImportAnalysis {
    readonly declarations: readonly ts.ImportDeclaration[];
    readonly locals: ReadonlySet<string>;
    readonly unsupportedNamespace: ts.ImportDeclaration | null;
    readonly hasCurrentRuntimeImport: boolean;
}

interface ParsedSource {
    readonly sourceFile: ts.SourceFile;
    readonly parseDiagnostics: readonly ts.Diagnostic[];
    readonly imports: OldEditorImportAnalysis;
}

interface TransformationAnalysis {
    readonly candidates: readonly EditorCandidate[];
    readonly globallyBlocked: boolean;
}

interface TransformEditPlan {
    readonly edits: TextEdit[];
    readonly transformed: number;
    readonly needsCoreImport: boolean;
    readonly needsFullImport: boolean;
    readonly needsMigrationImport: boolean;
}

function scriptKind(fileName: string): ts.ScriptKind {
    switch (path.extname(fileName).toLowerCase()) {
        case '.js':
        case '.mjs':
        case '.cjs':
            return ts.ScriptKind.JS;
        case '.jsx':
            return ts.ScriptKind.JSX;
        case '.tsx':
            return ts.ScriptKind.TSX;
        default:
            return ts.ScriptKind.TS;
    }
}

function sourceLocation(sourceFile: ts.SourceFile, position: number) {
    const value = sourceFile.getLineAndCharacterOfPosition(Math.max(0, position));
    return Object.freeze({ line: value.line + 1, column: value.character + 1 });
}

function finding(
    sourceFile: ts.SourceFile,
    fileName: string,
    node: Pick<ts.Node, 'getStart'>,
    code: string,
    message: string,
): CodemodFinding {
    return Object.freeze({
        file: fileName,
        ...sourceLocation(sourceFile, node.getStart(sourceFile)),
        code,
        message,
    });
}

function diagnosticFinding(
    sourceFile: ts.SourceFile,
    fileName: string,
    diagnostic: ts.Diagnostic,
): CodemodFinding {
    return Object.freeze({
        file: fileName,
        ...sourceLocation(sourceFile, diagnostic.start ?? 0),
        code: 'INVALID_SYNTAX',
        message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
    });
}

function applyTextEdits(source: string, edits: readonly TextEdit[]): string {
    const ordered = [...edits].sort(
        (left, right) => right.start - left.start || right.end - left.end,
    );
    let lastStart = source.length + 1;
    let output = source;
    for (const edit of ordered) {
        if (edit.start < 0 || edit.end < edit.start || edit.end > source.length) {
            throw new RangeError('Codemod produced an invalid source edit.');
        }
        if (edit.end > lastStart)
            throw new RangeError('Codemod produced overlapping source edits.');
        output = `${output.slice(0, edit.start)}${edit.text}${output.slice(edit.end)}`;
        lastStart = edit.start;
    }
    return output;
}

function propertyName(node: ts.PropertyName): string | null {
    if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
        return node.text;
    }
    return null;
}

function optionObject(entries: readonly OptionEntry[]): string {
    return `{ ${entries.map((entry) => `${entry.name}: ${entry.value}`).join(', ')} }`;
}

function analyzeOptions(
    sourceFile: ts.SourceFile,
    fileName: string,
    node: ts.Expression | undefined,
    unresolved: CodemodFinding[],
): OptionAnalysis | null {
    if (!node || node.kind === ts.SyntaxKind.UndefinedKeyword) {
        return Object.freeze({
            core: Object.freeze([]),
            transform: Object.freeze([]),
            history: Object.freeze([]),
            masks: Object.freeze([]),
            annotations: Object.freeze([]),
            blocked: false,
            requiresFullPreset: false,
        });
    }
    if (!ts.isObjectLiteralExpression(node)) {
        unresolved.push(
            finding(
                sourceFile,
                fileName,
                node,
                'RUNTIME_OPTIONS',
                'Runtime-generated options require manual splitting into Core and Plugin options.',
            ),
        );
        return null;
    }

    const groups = {
        core: [] as OptionEntry[],
        transform: [] as OptionEntry[],
        history: [] as OptionEntry[],
        masks: [] as OptionEntry[],
        annotations: [] as OptionEntry[],
    };
    let blocked = false;
    for (const property of node.properties) {
        if (ts.isSpreadAssignment(property)) {
            unresolved.push(
                finding(
                    sourceFile,
                    fileName,
                    property,
                    'SPREAD_OPTIONS',
                    'Spread-heavy options are ambiguous and were not rewritten.',
                ),
            );
            blocked = true;
            continue;
        }
        if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) {
            unresolved.push(
                finding(
                    sourceFile,
                    fileName,
                    property,
                    'UNSUPPORTED_OPTION_SYNTAX',
                    'Option methods, accessors, and computed fields require manual migration.',
                ),
            );
            blocked = true;
            continue;
        }
        const name = propertyName(property.name);
        if (!name) {
            unresolved.push(
                finding(
                    sourceFile,
                    fileName,
                    property,
                    'COMPUTED_OPTION',
                    'Computed option names require manual migration.',
                ),
            );
            blocked = true;
            continue;
        }
        const value = ts.isPropertyAssignment(property)
            ? property.initializer.getText(sourceFile)
            : property.name.getText(sourceFile);
        const mappings = [
            ['core', CORE_OPTION_NAMES],
            ['transform', TRANSFORM_OPTION_NAMES],
            ['history', HISTORY_OPTION_NAMES],
            ['masks', MASK_OPTION_NAMES],
            ['annotations', ANNOTATION_OPTION_NAMES],
        ] as const;
        const mapping = mappings.find(([, names]) => names.has(name));
        if (mapping) {
            groups[mapping[0]].push(Object.freeze({ name: mapping[1].get(name)!, value }));
            continue;
        }
        const callback = name.startsWith('on');
        unresolved.push(
            finding(
                sourceFile,
                fileName,
                property,
                callback ? 'CALLBACK_REVIEW_REQUIRED' : 'UNSUPPORTED_OPTION',
                callback
                    ? `Callback option "${name}" must be rewired to Core events or Plugin subscriptions.`
                    : `Option "${name}" has no unambiguous automatic mapping.`,
            ),
        );
        blocked = true;
    }
    return Object.freeze({
        core: Object.freeze(groups.core),
        transform: Object.freeze(groups.transform),
        history: Object.freeze(groups.history),
        masks: Object.freeze(groups.masks),
        annotations: Object.freeze(groups.annotations),
        blocked,
        requiresFullPreset:
            groups.transform.length +
                groups.history.length +
                groups.masks.length +
                groups.annotations.length >
            0,
    });
}

function fullPresetOptions(options: OptionAnalysis): string | null {
    const groups: string[] = [];
    if (options.core.length > 0) groups.push(`core: ${optionObject(options.core)}`);
    if (options.transform.length > 0) {
        groups.push(`transform: ${optionObject(options.transform)}`);
    }
    if (options.history.length > 0) groups.push(`history: ${optionObject(options.history)}`);
    if (options.masks.length > 0) groups.push(`masks: ${optionObject(options.masks)}`);
    if (options.annotations.length > 0) {
        groups.push(`annotations: ${optionObject(options.annotations)}`);
    }
    return groups.length > 0 ? `{ ${groups.join(', ')} }` : null;
}

function importReplacement(
    sourceFile: ts.SourceFile,
    node: ts.ImportDeclaration,
    oldLocals: ReadonlySet<string>,
): string {
    const clause = node.importClause;
    if (!clause) return node.getText(sourceFile);
    const defaultName = clause.name && !oldLocals.has(clause.name.text) ? clause.name.text : null;
    const named =
        clause.namedBindings && ts.isNamedImports(clause.namedBindings)
            ? clause.namedBindings.elements.filter((element) => {
                  const imported = (element.propertyName ?? element.name).text;
                  return imported !== 'ImageEditor' && !oldLocals.has(element.name.text);
              })
            : [];
    const parts: string[] = [];
    if (defaultName) parts.push(defaultName);
    if (named.length > 0) {
        parts.push(`{ ${named.map((element) => element.getText(sourceFile)).join(', ')} }`);
    }
    if (parts.length === 0) return '';
    const keyword = clause.phaseModifier === ts.SyntaxKind.TypeKeyword ? 'import type' : 'import';
    return `${keyword} ${parts.join(', ')} from ${node.moduleSpecifier.getText(sourceFile)};`;
}

function visit(node: ts.Node, callback: (node: ts.Node) => void): void {
    callback(node);
    node.forEachChild((child) => visit(child, callback));
}

const NEWLY_ASYNC_VOID_METHODS = new Set(['init', 'removeSelectedMask', 'removeAllMasks']);

function containingFunction(node: ts.Node): ts.SignatureDeclaration | null {
    let current: ts.Node | undefined = node.parent;
    while (current) {
        if (ts.isFunctionLike(current)) return current;
        current = current.parent;
    }
    return null;
}

function canInsertAwait(call: ts.CallExpression, fileName: string): boolean {
    if (ts.isAwaitExpression(call.parent)) return true;
    const owner = containingFunction(call);
    if (owner) {
        return Boolean(
            ts.canHaveModifiers(owner) &&
            ts
                .getModifiers(owner)
                ?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword),
        );
    }
    const extension = path.extname(fileName).toLowerCase();
    return extension !== '.cjs' && extension !== '.cts';
}

function needsInsertedAwait(call: ts.CallExpression): boolean {
    return !ts.isAwaitExpression(call.parent);
}

function exportOptionsAreSafe(call: ts.CallExpression): boolean {
    const options = call.arguments[0];
    if (!options || options.kind === ts.SyntaxKind.UndefinedKeyword) return true;
    if (!ts.isObjectLiteralExpression(options)) return false;
    const safeKeys = new Set([
        'area',
        'format',
        'quality',
        'multiplier',
        'fileName',
        'contributors',
    ]);
    return options.properties.every((property) => {
        if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) {
            return false;
        }
        const name = propertyName(property.name);
        return Boolean(name && safeKeys.has(name));
    });
}

function callsForCandidate(
    sourceFile: ts.SourceFile,
    fileName: string,
    declaration: ts.VariableDeclaration,
    variable: string,
    unresolved: CodemodFinding[],
): Readonly<{ calls: readonly EditorCall[]; blocked: boolean; requiresFullPreset: boolean }> {
    const calls: EditorCall[] = [];
    let blocked = false;
    let requiresFullPreset = false;
    visit(sourceFile, (node) => {
        if (ts.isElementAccessExpression(node) && ts.isIdentifier(node.expression)) {
            if (node.expression.text !== variable) return;
            unresolved.push(
                finding(
                    sourceFile,
                    fileName,
                    node,
                    'DYNAMIC_PROPERTY_ACCESS',
                    'Dynamic editor property access was not rewritten.',
                ),
            );
            blocked = true;
            return;
        }
        if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
            if (node.expression.text !== variable) return;
            if (node.questionDotToken) {
                unresolved.push(
                    finding(
                        sourceFile,
                        fileName,
                        node,
                        'OPTIONAL_EDITOR_ACCESS',
                        'Optional editor access requires manual ownership review.',
                    ),
                );
                blocked = true;
                return;
            }
            if (!ts.isCallExpression(node.parent) || node.parent.expression !== node) {
                unresolved.push(
                    finding(
                        sourceFile,
                        fileName,
                        node,
                        'ALIASED_METHOD',
                        `Editor method "${node.name.text}" is referenced indirectly.`,
                    ),
                );
                blocked = true;
                return;
            }
            const method = node.name.text;
            if (
                !CORE_METHODS.has(method) &&
                method !== 'loadFromState' &&
                !FEATURE_METHODS.has(method)
            ) {
                unresolved.push(
                    finding(
                        sourceFile,
                        fileName,
                        node,
                        'UNSUPPORTED_METHOD',
                        `Editor method "${method}" has no safe automatic mapping.`,
                    ),
                );
                blocked = true;
                return;
            }
            if (method === 'saveState') {
                unresolved.push(
                    finding(
                        sourceFile,
                        fileName,
                        node.parent,
                        'SAVE_STATE_SEMANTICS_CHANGED',
                        'The former saveState() created a History checkpoint, while Core saveState() serializes a Snapshot. Select an explicit History or Snapshot workflow manually.',
                    ),
                );
                blocked = true;
                return;
            }
            if (method === 'createMask') {
                unresolved.push(
                    finding(
                        sourceFile,
                        fileName,
                        node.parent,
                        'MASK_CREATE_SEMANTICS_CHANGED',
                        'Mask creation is now asynchronous and rejects on failure instead of returning an object or null; migrate its control flow manually.',
                    ),
                );
                blocked = true;
                return;
            }
            if (method === 'removeAllMasks' && node.parent.arguments.length > 0) {
                unresolved.push(
                    finding(
                        sourceFile,
                        fileName,
                        node.parent,
                        'MASK_REMOVE_ALL_OPTIONS_CHANGED',
                        'The former removeAllMasks() options do not have an equivalent Mask Plugin argument.',
                    ),
                );
                blocked = true;
                return;
            }
            if (
                (method === 'exportImageBase64' || method === 'exportImageFile') &&
                !exportOptionsAreSafe(node.parent)
            ) {
                unresolved.push(
                    finding(
                        sourceFile,
                        fileName,
                        node.parent,
                        'EXPORT_OPTIONS_SEMANTICS_CHANGED',
                        'Legacy export option names and Mask/Annotation merge switches require explicit modular export contributor options.',
                    ),
                );
                blocked = true;
                return;
            }
            if (method === 'init') {
                const elements = node.parent.arguments[0];
                if (!elements || !ts.isObjectLiteralExpression(elements)) {
                    unresolved.push(
                        finding(
                            sourceFile,
                            fileName,
                            node.parent,
                            'DOM_ELEMENT_MAP_REVIEW_REQUIRED',
                            'Initialization must supply an explicit Core Element Map; move UI bindings to DOM Controls.',
                        ),
                    );
                    blocked = true;
                    return;
                }
                const unsupportedElement = elements.properties.find((property) => {
                    if (!('name' in property) || !property.name) return true;
                    const name = propertyName(property.name);
                    return !name || !CORE_ELEMENT_NAMES.has(name);
                });
                if (unsupportedElement) {
                    unresolved.push(
                        finding(
                            sourceFile,
                            fileName,
                            unsupportedElement,
                            'DOM_ELEMENT_MAP_REVIEW_REQUIRED',
                            'Non-Core DOM targets must move to the DOM Controls Plugin or host integration.',
                        ),
                    );
                    blocked = true;
                    return;
                }
            }
            const newlyAsync = NEWLY_ASYNC_VOID_METHODS.has(method);
            if (newlyAsync && !canInsertAwait(node.parent, fileName)) {
                unresolved.push(
                    finding(
                        sourceFile,
                        fileName,
                        node.parent,
                        'ASYNC_CONTEXT_REQUIRED',
                        `Editor method "${method}" is asynchronous in the modular API, but this context cannot safely accept an inserted await.`,
                    ),
                );
                blocked = true;
                return;
            }
            if (FEATURE_METHODS.has(method)) requiresFullPreset = true;
            calls.push(
                Object.freeze({
                    property: node,
                    call: node.parent,
                    method,
                    awaitRequired: newlyAsync && needsInsertedAwait(node.parent),
                }),
            );
            return;
        }
        if (!ts.isIdentifier(node) || node.text !== variable || node === declaration.name) return;
        const parent = node.parent;
        if (
            (ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) &&
            parent.expression === node
        ) {
            return;
        }
        unresolved.push(
            finding(
                sourceFile,
                fileName,
                node,
                'EDITOR_ESCAPE',
                'Passing or storing the former editor object requires manual capability selection.',
            ),
        );
        blocked = true;
    });
    return Object.freeze({ calls: Object.freeze(calls), blocked, requiresFullPreset });
}

function oldEditorImports(sourceFile: ts.SourceFile): OldEditorImportAnalysis {
    const declarations: ts.ImportDeclaration[] = [];
    const locals = new Set<string>();
    let unsupportedNamespace: ts.ImportDeclaration | null = null;
    let hasCurrentRuntimeImport = false;
    for (const statement of sourceFile.statements) {
        if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
            continue;
        }
        const specifier = statement.moduleSpecifier.text;
        if (specifier.startsWith(`${PACKAGE_ROOT}/`)) hasCurrentRuntimeImport = true;
        if (specifier !== PACKAGE_ROOT || !statement.importClause) continue;
        declarations.push(statement);
        const clause = statement.importClause;
        if (clause.name) locals.add(clause.name.text);
        if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
            unsupportedNamespace = statement;
        } else if (clause.namedBindings) {
            for (const element of clause.namedBindings.elements) {
                if ((element.propertyName ?? element.name).text === 'ImageEditor') {
                    locals.add(element.name.text);
                }
            }
        }
    }
    return Object.freeze({
        declarations: Object.freeze(declarations),
        locals,
        unsupportedNamespace,
        hasCurrentRuntimeImport,
    });
}

function sortFindings(values: readonly CodemodFinding[]): readonly CodemodFinding[] {
    return Object.freeze(
        [...values].sort(
            (left, right) =>
                left.file.localeCompare(right.file) ||
                left.line - right.line ||
                left.column - right.column ||
                left.code.localeCompare(right.code),
        ),
    );
}

function parseAndDetectImports(source: string, fileName: string): ParsedSource {
    const sourceFile = ts.createSourceFile(
        fileName,
        source,
        ts.ScriptTarget.Latest,
        true,
        scriptKind(fileName),
    );
    const parseDiagnostics = (
        sourceFile as ts.SourceFile & { readonly parseDiagnostics: readonly ts.Diagnostic[] }
    ).parseDiagnostics;
    return Object.freeze({
        sourceFile,
        parseDiagnostics,
        imports: oldEditorImports(sourceFile),
    });
}

function collectEditorCandidates(
    sourceFile: ts.SourceFile,
    imports: OldEditorImportAnalysis,
): readonly ts.NewExpression[] {
    const expressions: ts.NewExpression[] = [];
    visit(sourceFile, (node) => {
        if (
            ts.isNewExpression(node) &&
            ts.isIdentifier(node.expression) &&
            imports.locals.has(node.expression.text)
        ) {
            expressions.push(node);
        }
    });
    return Object.freeze(expressions);
}

function determineTransformationBlockers(
    sourceFile: ts.SourceFile,
    fileName: string,
    imports: OldEditorImportAnalysis,
    newExpressions: readonly ts.NewExpression[],
    unresolved: CodemodFinding[],
): TransformationAnalysis {
    let globallyBlocked = false;
    if (imports.unsupportedNamespace) {
        unresolved.push(
            finding(
                sourceFile,
                fileName,
                imports.unsupportedNamespace,
                'NAMESPACE_IMPORT',
                'Namespace access to the former editor export requires manual migration.',
            ),
        );
        globallyBlocked = true;
    }
    if (imports.hasCurrentRuntimeImport) {
        unresolved.push(
            finding(
                sourceFile,
                fileName,
                imports.declarations[0]!,
                'MIXED_EDITOR_VERSIONS',
                'A file importing both former and current runtime entries must be separated manually.',
            ),
        );
        globallyBlocked = true;
    }

    visit(sourceFile, (node) => {
        if (ts.isClassDeclaration(node) && node.heritageClauses) {
            for (const clause of node.heritageClauses) {
                for (const type of clause.types) {
                    if (
                        ts.isIdentifier(type.expression) &&
                        imports.locals.has(type.expression.text)
                    ) {
                        unresolved.push(
                            finding(
                                sourceFile,
                                fileName,
                                type,
                                'FACADE_SUBCLASS',
                                'Subclasses of the former editor must be redesigned around Core and Plugin composition.',
                            ),
                        );
                        globallyBlocked = true;
                    }
                }
            }
        }
        if (
            ts.isCallExpression(node) &&
            ts.isPropertyAccessExpression(node.expression) &&
            ((ts.isIdentifier(node.expression.expression) &&
                ['Object', 'Reflect'].includes(node.expression.expression.text)) ||
                node.expression.name.text === 'hasOwnProperty') &&
            node.arguments.some((argument) =>
                [...imports.locals].some((name) => argument.getText(sourceFile).includes(name)),
            )
        ) {
            unresolved.push(
                finding(
                    sourceFile,
                    fileName,
                    node,
                    'EDITOR_REFLECTION',
                    'Reflection over the former editor surface cannot be rewritten safely.',
                ),
            );
            globallyBlocked = true;
        }
    });

    const candidates: EditorCandidate[] = [];
    for (const expression of newExpressions) {
        const declaration = expression.parent;
        if (
            !ts.isVariableDeclaration(declaration) ||
            declaration.initializer !== expression ||
            !ts.isIdentifier(declaration.name)
        ) {
            unresolved.push(
                finding(
                    sourceFile,
                    fileName,
                    expression,
                    'CONSTRUCTOR_CONTEXT',
                    'The former constructor must be assigned to a simple local variable before migration.',
                ),
            );
            globallyBlocked = true;
            continue;
        }
        const args = expression.arguments ?? ts.factory.createNodeArray();
        let blocked = false;
        let optionsNode: ts.Expression | undefined;
        if (expression.typeArguments && expression.typeArguments.length > 0) {
            unresolved.push(
                finding(
                    sourceFile,
                    fileName,
                    expression,
                    'CONSTRUCTOR_TYPE_ARGUMENTS',
                    'Constructor type arguments require manual migration.',
                ),
            );
            blocked = true;
        }
        if (args.length === 0 || (args.length === 1 && ts.isObjectLiteralExpression(args[0]!))) {
            unresolved.push(
                finding(
                    sourceFile,
                    fileName,
                    expression,
                    'FABRIC_MODULE_REQUIRED',
                    'Current constructors require an explicit Fabric module.',
                ),
            );
            blocked = true;
        } else if (args.length > 2) {
            unresolved.push(
                finding(
                    sourceFile,
                    fileName,
                    expression,
                    'CONSTRUCTOR_ARGUMENTS',
                    'The constructor argument list is unsupported.',
                ),
            );
            blocked = true;
        } else {
            optionsNode = args[1];
        }
        const options = analyzeOptions(sourceFile, fileName, optionsNode, unresolved);
        if (!options || options.blocked) blocked = true;
        const usage = callsForCandidate(
            sourceFile,
            fileName,
            declaration,
            declaration.name.text,
            unresolved,
        );
        if (usage.blocked) blocked = true;
        candidates.push(
            Object.freeze({
                variable: declaration.name.text,
                declaration,
                expression,
                calls: usage.calls,
                blocked,
                requiresFullPreset:
                    usage.requiresFullPreset || Boolean(options?.requiresFullPreset),
                options,
            }),
        );
    }

    if (newExpressions.length === 0) {
        unresolved.push(
            finding(
                sourceFile,
                fileName,
                imports.declarations[0]!,
                'NO_STATIC_CONSTRUCTOR',
                'No statically recognizable former editor constructor was found.',
            ),
        );
        globallyBlocked = true;
    }
    return Object.freeze({
        candidates: Object.freeze(candidates),
        globallyBlocked,
    });
}

function buildTransformEdits(
    sourceFile: ts.SourceFile,
    candidates: readonly EditorCandidate[],
): TransformEditPlan {
    const edits: TextEdit[] = [];
    let needsCoreImport = false;
    let needsFullImport = false;
    let needsMigrationImport = false;
    let transformed = 0;
    for (const candidate of candidates) {
        if (candidate.blocked || !candidate.options) continue;
        const args = candidate.expression.arguments!;
        const fabric = args[0]!.getText(sourceFile);
        const full = candidate.requiresFullPreset;
        const options = full
            ? fullPresetOptions(candidate.options)
            : candidate.options.core.length > 0
              ? optionObject(candidate.options.core)
              : null;
        const constructor = full
            ? `createFullPreset(${fabric}${options ? `, ${options}` : ''})`
            : `new ImageEditorCore(${fabric}${options ? `, ${options}` : ''})`;
        edits.push(
            Object.freeze({
                start: candidate.expression.getStart(sourceFile),
                end: candidate.expression.end,
                text: constructor,
            }),
        );
        needsFullImport ||= full;
        needsCoreImport ||= !full;
        for (const call of candidate.calls) {
            if (call.method === 'loadFromState') {
                const target = full ? `${candidate.variable}.editor` : candidate.variable;
                const argsText = call.call.arguments.map((value) => value.getText(sourceFile));
                edits.push(
                    Object.freeze({
                        start: call.call.getStart(sourceFile),
                        end: call.call.end,
                        text: `loadV2Snapshot(${[target, ...argsText].join(', ')})`,
                    }),
                );
                needsMigrationImport = true;
                continue;
            }
            if (full) {
                const feature = FEATURE_METHODS.get(call.method);
                const replacement = feature
                    ? `${candidate.variable}.${feature[0]}.${feature[1]}`
                    : `${candidate.variable}.editor.${call.method}`;
                edits.push(
                    Object.freeze({
                        start: call.property.getStart(sourceFile),
                        end: call.property.end,
                        text: `${call.awaitRequired ? 'await ' : ''}${replacement}`,
                    }),
                );
            } else if (call.awaitRequired) {
                edits.push(
                    Object.freeze({
                        start: call.call.getStart(sourceFile),
                        end: call.call.getStart(sourceFile),
                        text: 'await ',
                    }),
                );
            }
        }
        transformed += 1;
    }

    return {
        edits,
        transformed,
        needsCoreImport,
        needsFullImport,
        needsMigrationImport,
    };
}

function replaceImportDeclarations(
    source: string,
    sourceFile: ts.SourceFile,
    imports: OldEditorImportAnalysis,
    edits: TextEdit[],
): void {
    for (const declaration of imports.declarations) {
        const replacement = importReplacement(sourceFile, declaration, imports.locals);
        let end = declaration.end;
        if (!replacement) {
            if (source.slice(end, end + 2) === '\r\n') end += 2;
            else if (source[end] === '\n') end += 1;
        }
        edits.push(
            Object.freeze({
                start: declaration.getStart(sourceFile),
                end,
                text: replacement,
            }),
        );
    }
}

function importInsertionPosition(source: string): number {
    const start = source.charCodeAt(0) === 0xfeff ? 1 : 0;
    if (!source.startsWith('#!', start)) return start;
    const lineEnd = source.indexOf('\n', start);
    return lineEnd === -1 ? source.length : lineEnd + 1;
}

function injectNewImports(source: string, plan: TransformEditPlan): void {
    const newImports: string[] = [];
    if (plan.needsCoreImport) {
        newImports.push(`import { ImageEditorCore } from '${PACKAGE_ROOT}/core';`);
    }
    if (plan.needsFullImport) {
        newImports.push(`import { createFullPreset } from '${PACKAGE_ROOT}/presets/full';`);
    }
    if (plan.needsMigrationImport) {
        newImports.push(`import { loadV2Snapshot } from '${PACKAGE_ROOT}/migrate-v2';`);
    }
    if (newImports.length > 0) {
        const newline = source.includes('\r\n') ? '\r\n' : '\n';
        const insertion = importInsertionPosition(source);
        plan.edits.push(
            Object.freeze({
                start: insertion,
                end: insertion,
                text: `${newImports.join(newline)}${newline}`,
            }),
        );
    }
}

export function transformSource(source: string, fileName = 'source.ts'): SourceTransformResult {
    const parsed = parseAndDetectImports(source, fileName);
    const { sourceFile, parseDiagnostics, imports } = parsed;
    if (parseDiagnostics.length > 0) {
        return Object.freeze({
            code: source,
            changed: false,
            unresolved: sortFindings(
                parseDiagnostics.map((diagnostic) =>
                    diagnosticFinding(sourceFile, fileName, diagnostic),
                ),
            ),
        });
    }
    if (imports.locals.size === 0 && !imports.unsupportedNamespace) {
        return Object.freeze({ code: source, changed: false, unresolved: Object.freeze([]) });
    }

    const unresolved: CodemodFinding[] = [];
    const expressions = collectEditorCandidates(sourceFile, imports);
    const analysis = determineTransformationBlockers(
        sourceFile,
        fileName,
        imports,
        expressions,
        unresolved,
    );
    if (analysis.globallyBlocked) {
        return Object.freeze({
            code: source,
            changed: false,
            unresolved: sortFindings(unresolved),
        });
    }

    const plan = buildTransformEdits(sourceFile, analysis.candidates);
    if (plan.transformed === 0) {
        return Object.freeze({
            code: source,
            changed: false,
            unresolved: sortFindings(unresolved),
        });
    }
    if (plan.transformed === analysis.candidates.length) {
        replaceImportDeclarations(source, sourceFile, imports, plan.edits);
    }
    injectNewImports(source, plan);

    const code = applyTextEdits(source, plan.edits);
    return Object.freeze({
        code,
        changed: code !== source,
        unresolved: sortFindings(unresolved),
    });
}

function unifiedDiff(fileName: string, before: string, after: string): string {
    const beforeLines = before.replaceAll('\r\n', '\n').split('\n');
    const afterLines = after.replaceAll('\r\n', '\n').split('\n');
    let prefix = 0;
    while (
        prefix < beforeLines.length &&
        prefix < afterLines.length &&
        beforeLines[prefix] === afterLines[prefix]
    ) {
        prefix += 1;
    }
    let suffix = 0;
    while (
        suffix < beforeLines.length - prefix &&
        suffix < afterLines.length - prefix &&
        beforeLines[beforeLines.length - 1 - suffix] === afterLines[afterLines.length - 1 - suffix]
    ) {
        suffix += 1;
    }
    const contextStart = Math.max(0, prefix - 2);
    const beforeEnd = Math.min(beforeLines.length, beforeLines.length - suffix + 2);
    const afterEnd = Math.min(afterLines.length, afterLines.length - suffix + 2);
    const removed = beforeLines.slice(contextStart, beforeEnd);
    const added = afterLines.slice(contextStart, afterEnd);
    return [
        `--- a/${fileName}`,
        `+++ b/${fileName}`,
        `@@ -${contextStart + 1},${removed.length} +${contextStart + 1},${added.length} @@`,
        ...removed.map((line) => `-${line}`),
        ...added.map((line) => `+${line}`),
        '',
    ].join('\n');
}

async function collectSourceFiles(targets: readonly string[], cwd: string): Promise<string[]> {
    const files = new Set<string>();
    async function collect(value: string): Promise<void> {
        const absolute = path.resolve(cwd, value);
        const details = await lstat(absolute);
        if (details.isSymbolicLink()) {
            throw new Error(`Refusing to follow symbolic link: ${path.relative(cwd, absolute)}`);
        }
        if (details.isFile()) {
            if (SOURCE_EXTENSIONS.has(path.extname(absolute).toLowerCase())) files.add(absolute);
            return;
        }
        if (!details.isDirectory()) return;
        const entries = await readdir(absolute, { withFileTypes: true });
        for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
            if (entry.isSymbolicLink()) {
                throw new Error(
                    `Refusing to follow symbolic link: ${path.relative(cwd, path.join(absolute, entry.name))}`,
                );
            }
            if (entry.isDirectory() && SKIPPED_DIRECTORIES.has(entry.name)) continue;
            await collect(path.join(absolute, entry.name));
        }
    }
    for (const target of targets) await collect(target);
    return [...files].sort((left, right) => left.localeCompare(right));
}

async function writeAtomically(filePath: string, content: string, mode: number): Promise<void> {
    const temporaryPath = path.join(
        path.dirname(filePath),
        '.' + path.basename(filePath) + '.' + process.pid + '.' + randomUUID() + '.tmp',
    );
    try {
        await writeFile(temporaryPath, content, { encoding: 'utf8', mode });
        await chmod(temporaryPath, mode);
        await rename(temporaryPath, filePath);
    } catch (error) {
        await rm(temporaryPath, { force: true }).catch(() => undefined);
        throw error;
    }
}

export async function runCodemod(
    targets: readonly string[],
    options: RunCodemodOptions = {},
): Promise<CodemodReport> {
    if (targets.length === 0) throw new TypeError('At least one source path is required.');
    const cwd = path.resolve(options.cwd ?? process.cwd());
    const mode = options.mode ?? 'write';
    const files = await collectSourceFiles(targets, cwd);
    const reports: CodemodFileReport[] = [];
    let changed = 0;
    let written = 0;
    let unresolvedCount = 0;

    for (const filePath of files) {
        const relative = path.relative(cwd, filePath).replaceAll('\\', '/');
        const details = await stat(filePath);
        if (details.size > MAX_SOURCE_BYTES) {
            const value = Object.freeze({
                file: relative,
                line: 1,
                column: 1,
                code: 'SOURCE_TOO_LARGE',
                message: 'Source file exceeds ' + MAX_SOURCE_BYTES + ' bytes.',
            });
            reports.push(
                Object.freeze({
                    file: relative,
                    changed: false,
                    written: false,
                    unresolved: Object.freeze([value]),
                }),
            );
            unresolvedCount += 1;
            continue;
        }
        const bytes = await readFile(filePath);
        let source: string;
        try {
            source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        } catch {
            const value = Object.freeze({
                file: relative,
                line: 1,
                column: 1,
                code: 'INVALID_ENCODING',
                message: 'Source file is not valid UTF-8.',
            });
            reports.push(
                Object.freeze({
                    file: relative,
                    changed: false,
                    written: false,
                    unresolved: Object.freeze([value]),
                }),
            );
            unresolvedCount += 1;
            continue;
        }
        const result = transformSource(source, relative);
        const didWrite = mode === 'write' && result.changed;
        if (didWrite) await writeAtomically(filePath, result.code, details.mode);
        if (result.changed) changed += 1;
        if (didWrite) written += 1;
        unresolvedCount += result.unresolved.length;
        reports.push(
            Object.freeze({
                file: relative,
                changed: result.changed,
                written: didWrite,
                unresolved: result.unresolved,
                ...(mode === 'diff' && result.changed
                    ? { diff: unifiedDiff(relative, source, result.code) }
                    : {}),
            }),
        );
    }

    return Object.freeze({
        command: 'migrate',
        mode,
        result:
            unresolvedCount > 0
                ? 'UNRESOLVED'
                : changed > 0 && mode !== 'write'
                  ? 'CHANGES_AVAILABLE'
                  : 'PASS',
        filesScanned: files.length,
        filesChanged: changed,
        filesWritten: written,
        unresolvedCount,
        files: Object.freeze(reports),
    });
}

export async function writeCodemodReport(filePath: string, report: CodemodReport): Promise<void> {
    const absolute = path.resolve(filePath);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}
