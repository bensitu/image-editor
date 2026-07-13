/**
 * Validates the Phase 5A-R public API matrix and narrow legacy Port contracts.
 *
 * @module
 */

import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { format, resolveConfig } from 'prettier';
import ts from 'typescript';

import { findUnclassifiedValues, validatePolicyCoverage } from './check-full-facade-ownership.mjs';

const execFileAsync = promisify(execFile);
const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptsDirectory, '..');
const architectureRoot = path.join(repositoryRoot, 'tests', 'architecture');
const docsRoot = path.join(repositoryRoot, 'docs', 'refactor');
const baselinePath = path.join(docsRoot, 'public-api-v2.9.0.md');
const imageEditorPath = path.join(repositoryRoot, 'src', 'image-editor.ts');
const publicTypesPath = path.join(repositoryRoot, 'src', 'core', 'public-types.ts');
const indexPath = path.join(repositoryRoot, 'src', 'index.ts');
const legacyPortsPath = path.join(repositoryRoot, 'src', 'compatibility', 'legacy-ports.ts');
const apiPolicyPath = path.join(architectureRoot, 'public-api-compatibility.policy.json');
const portPolicyPath = path.join(architectureRoot, 'legacy-port-contracts.policy.json');
const apiMatrixDocPath = path.join(docsRoot, 'phase-5a-r-public-api-matrix.md');
const portContractsDocPath = path.join(docsRoot, 'phase-5a-r-legacy-port-contracts.md');
const legacyCallGeneratedPath = path.join(
    architectureRoot,
    'legacy-feature-call-sites.generated.json',
);
const legacyCallPolicyPath = path.join(architectureRoot, 'legacy-feature-call-sites.policy.json');
const bridgePolicyPath = path.join(architectureRoot, 'compatibility-bridge-state.policy.json');

const requiredPorts = Object.freeze([
    'LegacyCanvasReadPort',
    'LegacyBaseImageReadPort',
    'LegacyRasterCommitPort',
    'LegacyOperationPort',
    'LegacyHistoryRecorderPort',
    'LegacyExportContributorPort',
    'LegacyStateSlicePort',
    'LegacyOverlayPort',
    'LegacyToolSessionPort',
    'LegacyCallbackPort',
    'LegacyDomReadModelPort',
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

function hashText(value) {
    return createHash('sha256').update(value).digest('hex');
}

function sourceFile(filePath, text) {
    return ts.createSourceFile(
        filePath,
        text,
        ts.ScriptTarget.Latest,
        true,
        filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
}

function lineOf(file, node) {
    return file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
}

function normalizeSignature(value) {
    return value.replace(/\s+/g, ' ').trim();
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

function propertyName(node) {
    if (!node.name) return '';
    if (ts.isIdentifier(node.name) || ts.isPrivateIdentifier(node.name)) return node.name.text;
    if (ts.isStringLiteralLike(node.name) || ts.isNumericLiteral(node.name)) return node.name.text;
    return normalizeSignature(node.name.getText());
}

function apiId(kind, api) {
    return `api:${kind}:${api}`;
}

function splitIdentifiers(value) {
    return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
}

function section(text, startHeading, endHeading) {
    const start = text.indexOf(startHeading);
    if (start < 0) throw new Error(`Baseline section is missing: ${startHeading}`);
    const end = endHeading ? text.indexOf(endHeading, start + startHeading.length) : text.length;
    if (end < 0) throw new Error(`Baseline section terminator is missing: ${endHeading}`);
    return text.slice(start, end);
}

function parseBaseline(text) {
    const methodsBlock = section(text, '## Public instance methods', '## `ImageEditorOptions`');
    const optionsBlock = section(text, '## `ImageEditorOptions`', '## Snapshot, overlay-state');
    const elementsBlock = section(text, '## DOM `ElementMap`', '## Root type exports');
    const typesBlock = section(text, '## Root type exports', '## Deprecated API');

    const methods = new Set();
    for (const line of methodsBlock.split(/\r?\n/)) {
        const match = /^- `([A-Za-z_$][\w$]*)\(/.exec(line);
        if (match) methods.add(match[1]);
    }

    const options = new Set();
    for (const line of optionsBlock.split(/\r?\n/)) {
        if (!line.startsWith('- ')) continue;
        for (const match of line.matchAll(/`([A-Za-z_$][\w$]*)`/g)) options.add(match[1]);
    }

    const elementKeyStart = elementsBlock.indexOf('The keys are:');
    if (elementKeyStart < 0) throw new Error('ElementMap key baseline is malformed.');
    const elementKeys = new Set(
        [...elementsBlock.slice(elementKeyStart).matchAll(/`([A-Za-z_$][\w$]*)`/g)].map(
            (match) => match[1],
        ),
    );

    const typeExports = new Set();
    for (const match of typesBlock.matchAll(/`([^`]+)`/g)) {
        for (const identifier of splitIdentifiers(match[1])) typeExports.add(identifier);
    }

    const runtimeExports = new Set([
        'default',
        'ImageEditor',
        'isAnnotationObject',
        'isBaseImageObject',
        'isDrawAnnotationObject',
        'isEditableOverlayObject',
        'isMaskObject',
        'isSessionObject',
        'isShapeAnnotationObject',
        'isTextAnnotationObject',
    ]);
    return {
        methods,
        options,
        callbacks: new Set([...options].filter((name) => /^on[A-Z]/.test(name))),
        elementKeys,
        typeExports,
        runtimeExports,
        constructors: new Set([
            'ImageEditor.constructor.explicit-fabric',
            'ImageEditor.constructor.global-fabric',
        ]),
    };
}

function collectMethods(file, text) {
    const declaration = file.statements.find(
        (statement) => ts.isClassDeclaration(statement) && statement.name?.text === 'ImageEditor',
    );
    if (!declaration || !ts.isClassDeclaration(declaration)) {
        throw new Error('ImageEditor class declaration is missing.');
    }
    const records = [];
    let constructorDeclaration = null;
    for (const member of declaration.members) {
        if (ts.isConstructorDeclaration(member)) {
            constructorDeclaration = member;
            continue;
        }
        if (!ts.isMethodDeclaration(member) || visibilityOf(member) !== 'public') continue;
        const name = propertyName(member);
        const parameters = member.parameters.map((parameter) => parameter.getText(file)).join(', ');
        const returnType = member.type?.getText(file) ?? 'unknown';
        records.push({
            id: apiId('method', `ImageEditor.${name}`),
            api: `ImageEditor.${name}`,
            name,
            kind: 'method',
            sourceFile: 'src/image-editor.ts',
            line: lineOf(file, member),
            signature: normalizeSignature(`${name}(${parameters}): ${returnType}`),
            syncMode: /\bPromise\s*</.test(returnType) ? 'promise' : 'sync',
        });
    }
    if (!constructorDeclaration) throw new Error('ImageEditor constructor is missing.');
    const constructorText = constructorDeclaration.getText(file);
    if (
        !constructorText.includes('FabricModule | ImageEditorOptions') ||
        constructorDeclaration.parameters.length !== 2
    ) {
        throw new Error('ImageEditor constructor no longer supports both frozen v2.9 forms.');
    }
    records.push(
        {
            id: apiId('constructor', 'ImageEditor.constructor.explicit-fabric'),
            api: 'ImageEditor.constructor.explicit-fabric',
            name: 'constructor.explicit-fabric',
            kind: 'constructor',
            sourceFile: 'src/image-editor.ts',
            line: lineOf(file, constructorDeclaration),
            signature: 'new ImageEditor(fabricModule?: FabricModule, options?: ImageEditorOptions)',
            syncMode: 'constructor',
        },
        {
            id: apiId('constructor', 'ImageEditor.constructor.global-fabric'),
            api: 'ImageEditor.constructor.global-fabric',
            name: 'constructor.global-fabric',
            kind: 'constructor',
            sourceFile: 'src/image-editor.ts',
            line: lineOf(file, constructorDeclaration),
            signature: 'new ImageEditor(options?: ImageEditorOptions)',
            syncMode: 'constructor',
        },
    );
    void text;
    return records;
}

function collectInterfaceProperties(file, interfaceName, kindForName) {
    const declaration = file.statements.find(
        (statement) =>
            ts.isInterfaceDeclaration(statement) && statement.name.text === interfaceName,
    );
    if (!declaration || !ts.isInterfaceDeclaration(declaration)) {
        throw new Error(`${interfaceName} interface is missing.`);
    }
    return declaration.members.filter(ts.isPropertySignature).map((member) => {
        const name = propertyName(member);
        const kind = kindForName(name);
        return {
            id: apiId(kind, `${interfaceName}.${name}`),
            api: `${interfaceName}.${name}`,
            name,
            kind,
            sourceFile: 'src/core/public-types.ts',
            line: lineOf(file, member),
            signature: normalizeSignature(member.getText(file)),
            syncMode: kind === 'callback' ? 'sync' : 'configuration',
        };
    });
}

function collectRootExports(file) {
    const records = [];
    for (const statement of file.statements) {
        if (!ts.isExportDeclaration(statement) || !statement.exportClause) continue;
        if (!ts.isNamedExports(statement.exportClause)) continue;
        for (const element of statement.exportClause.elements) {
            const exportedName = element.name.text;
            const importedName = element.propertyName?.text ?? exportedName;
            const typeOnly = statement.isTypeOnly || element.isTypeOnly;
            const kind = typeOnly ? 'type-export' : 'runtime-export';
            records.push({
                id: apiId(kind, exportedName),
                api: exportedName,
                name: exportedName,
                kind,
                sourceFile: 'src/index.ts',
                line: lineOf(file, statement),
                signature: `${typeOnly ? 'export type' : 'export'} ${importedName}${importedName === exportedName ? '' : ` as ${exportedName}`}`,
                syncMode: typeOnly ? 'type-only' : 'sync',
            });
        }
    }
    return records;
}

function collectApiFacts(imageEditorText, publicTypesText, indexText) {
    const imageEditorFile = sourceFile(imageEditorPath, imageEditorText);
    const publicTypesFile = sourceFile(publicTypesPath, publicTypesText);
    const indexFile = sourceFile(indexPath, indexText);
    const facts = [
        ...collectMethods(imageEditorFile, imageEditorText),
        ...collectInterfaceProperties(publicTypesFile, 'ImageEditorOptions', (name) =>
            /^on[A-Z]/.test(name) ? 'callback' : 'option',
        ),
        ...collectInterfaceProperties(publicTypesFile, 'ElementIdMap', () => 'element-key'),
        ...collectRootExports(indexFile),
    ];
    const byId = new Map();
    for (const fact of facts) {
        if (byId.has(fact.id)) throw new Error(`Duplicate public API fact: ${fact.id}`);
        byId.set(fact.id, fact);
    }
    return [...byId.values()].sort((left, right) => left.id.localeCompare(right.id));
}

function targetOwnerFor(fact) {
    const search = `${fact.api} ${fact.signature}`.toLowerCase();
    if (fact.kind === 'element-key') return 'LEGACY_DOM_ADAPTER';
    if (fact.kind === 'callback' || fact.kind.endsWith('export') || fact.kind === 'constructor') {
        return 'THIN_FACADE';
    }
    if (/mask/.test(search)) return 'MASK_PLUGIN';
    if (/undo|redo|history/.test(search)) return 'HISTORY_PLUGIN';
    if (
        /scaleimage|rotateimage|fliphorizontal|flipvertical|resetimagetransform|animationduration|minscale|maxscale|scalestep|rotationstep|bindmaskstoimagetransform/.test(
            search,
        )
    ) {
        return 'TRANSFORM_PLUGIN';
    }
    if (/imagefilter|downsample/.test(search)) return 'LEGACY_FILTERS_ADAPTER';
    if (/crop/.test(search)) return 'LEGACY_CROP_ADAPTER';
    if (/mosaic/.test(search)) return 'LEGACY_MOSAIC_ADAPTER';
    if (/annotation|textmode|textconfig|draw|eraser|shape/.test(search)) {
        return 'LEGACY_ANNOTATION_ADAPTER';
    }
    if (
        /overlaystate|selection|selectedobject|layer|forward|backward|groupselection|listorder/.test(
            search,
        )
    ) {
        return 'LEGACY_OVERLAY_STATE_ADAPTER';
    }
    if (/resize|relayout|element|placeholder|downloadimage/.test(search)) {
        return 'LEGACY_DOM_ADAPTER';
    }
    return 'CORE';
}

function targetMethodFor(fact, owner) {
    if (fact.kind.endsWith('export')) return 'preserveRootExport';
    if (fact.kind === 'constructor') return 'createFullCompatibilityComposition';
    if (fact.kind === 'option' || fact.kind === 'callback') return `adapt.${fact.name}`;
    if (fact.kind === 'element-key') return `resolve.${fact.name}`;
    const aliases = {
        scaleImage: 'scale',
        rotateImage: 'rotate',
        resetImageTransform: 'resetImageTransform',
        getMasks: 'getAll',
        removeSelectedMask: 'removeSelected',
        removeAllMasks: 'removeAll',
        mergeMasks: 'flatten',
        undo: 'undo',
        redo: 'redo',
    };
    if (owner === 'CORE' && fact.name === 'init') return 'init';
    return aliases[fact.name] ?? fact.name;
}

function adapterFor(fact, owner) {
    if (fact.kind.endsWith('export')) return 'ROOT_EXPORT_CONTRACT';
    if (fact.kind === 'constructor') return 'FULL_COMPOSITION';
    if (fact.kind === 'callback') return 'LEGACY_CALLBACK_ADAPTER';
    if (fact.kind === 'element-key') return 'LEGACY_DOM_ADAPTER';
    if (owner === 'CORE' && fact.name === 'init') return 'LEGACY_ELEMENT_MAP_ADAPTER';
    if (owner === 'CORE') return 'CORE_COMPOSITION';
    return owner;
}

function operationIdFor(fact, owner) {
    if (fact.kind !== 'method') return 'not-applicable';
    const map = {
        loadImage: 'core:load-image',
        loadFromState: 'core:load-state',
        saveState: 'core:save-state',
        exportImageBase64: 'core:export',
        exportImageFile: 'core:export',
        downloadImage: 'core:export',
        scaleImage: 'transform:scale',
        rotateImage: 'transform:rotate',
        flipHorizontal: 'transform:flip-horizontal',
        flipVertical: 'transform:flip-vertical',
        resetImageTransform: 'transform:reset',
        undo: 'history:undo',
        redo: 'history:redo',
        createMask: 'mask:create',
        removeSelectedMask: 'mask:remove',
        removeAllMasks: 'mask:remove-all',
        mergeMasks: 'overlay:flatten',
        mergeAnnotations: 'overlay:flatten',
    };
    return map[fact.name] ?? `${owner.toLowerCase()}:${fact.name}`;
}

function historyFor(fact) {
    if (fact.kind !== 'method') return 'not-applicable';
    if (fact.name === 'loadImage' || fact.name === 'loadFromState') return 'clear-and-rebaseline';
    if (fact.name === 'undo' || fact.name === 'redo') return 'move-existing-stack';
    if (/^(?:get|is|validate|export|download|save)/.test(fact.name)) return 'no-record';
    if (
        /Config|Color|FontSize|BrushSize|BlockSize|SubMode|LayoutMode|CanvasSize|relayout|resize/.test(
            fact.name,
        )
    ) {
        return 'preserve-v2.9-config-or-layout-semantics';
    }
    return 'one-record-on-success-when-state-mutates';
}

function callbacksFor(fact) {
    if (fact.kind !== 'method') return [];
    if (fact.name === 'loadImage') {
        return ['onImageLoadStart', 'onBusyChange', 'onImageLoaded', 'onImageChanged'];
    }
    if (fact.name === 'dispose' || fact.name === 'disposeAsync') return ['onEditorDisposed'];
    if (/Mask/.test(fact.name)) return ['onMasksChanged', 'onSelectionChange', 'onImageChanged'];
    if (/Annotation|Text|Draw|Eraser|Shape/.test(fact.name)) {
        return ['onAnnotationsChanged', 'onSelectionChange', 'onImageChanged'];
    }
    if (/undo|redo/.test(fact.name)) return ['onHistoryChange', 'onImageChanged'];
    if (/enter|exit|Crop|Mosaic/.test(fact.name)) return ['onToolModeChange', 'onImageChanged'];
    if (fact.syncMode === 'promise' || /set|reset|clear|commit|flip|rotate|scale/.test(fact.name)) {
        return ['onBusyChange', 'onImageChanged'];
    }
    return [];
}

function errorRouteFor(fact) {
    if (fact.kind === 'type-export' || fact.kind === 'runtime-export') {
        return 'compile-time-or-module-resolution-contract';
    }
    if (fact.kind === 'constructor') return 'preserve-throw-and-warning-semantics';
    if (fact.kind === 'option' || fact.kind === 'callback') {
        return 'preserve-option-normalization-and-callback-isolation';
    }
    if (fact.kind === 'element-key') return 'missing-optional-element-remains-non-fatal';
    if (fact.syncMode === 'promise') return 'onError-and-reject-per-v2.9';
    if (/^(?:get|is|validate|export)/.test(fact.name))
        return 'return-v2.9-read-model-or-validation-result';
    return 'preserve-v2.9-warning-or-throw-route';
}

function testIdsFor(fact) {
    if (fact.kind === 'type-export') return ['tests/types/core-plugin-api.test.ts#root-types'];
    if (fact.kind === 'runtime-export') return ['tests/public-surface.test.mjs#root-exports'];
    if (fact.kind === 'constructor') return ['tests/public-surface.test.mjs#constructor-forms'];
    if (fact.kind === 'callback') return ['tests/lifecycle-callbacks.test.mjs#callback-contracts'];
    if (fact.kind === 'option')
        return ['tests/options-resolution.property.test.mjs#option-contracts'];
    if (fact.kind === 'element-key') return ['tests/dom-canonical-bindings.test.mjs#element-map'];
    const search = fact.name.toLowerCase();
    if (/mask/.test(search)) return ['tests/mask-history-regression.test.mjs#mask-public-api'];
    if (/undo|redo/.test(search)) return ['tests/browser/e2e/undo-redo.spec.ts#history-public-api'];
    if (/crop/.test(search)) return ['tests/browser/e2e/crop.spec.ts#crop-public-api'];
    if (/mosaic/.test(search)) return ['tests/browser/e2e/mosaic.spec.ts#mosaic-public-api'];
    if (/annotation|draw|text|shape|eraser/.test(search)) {
        return ['tests/browser/e2e/export.spec.ts#annotation-public-api'];
    }
    if (/export|download/.test(search))
        return ['tests/browser/e2e/export.spec.ts#export-public-api'];
    if (/load|imageinfo/.test(search))
        return ['tests/browser/e2e/image-load.spec.ts#load-public-api'];
    if (/dispose|init/.test(search))
        return ['tests/browser/e2e/dispose-reinit.spec.ts#lifecycle-api'];
    if (/layout|resize|relayout/.test(search))
        return ['tests/layout-mode-public-api.test.mjs#layout-api'];
    if (/state|selection|toolmode/.test(search)) {
        return ['tests/browser/e2e/public-state-api.spec.ts#state-api'];
    }
    if (/rotate|flip|scale|resetimagetransform/.test(search)) {
        return ['tests/overlay-transform-binding.test.mjs#transform-api'];
    }
    return ['tests/public-surface.test.mjs#public-method'];
}

function seedApiPolicy(facts, baselineHash, gitCommit) {
    return {
        schemaVersion: 1,
        metadata: {
            baselineFile: 'docs/refactor/public-api-v2.9.0.md',
            baselineSha256: baselineHash,
            baselineReleaseCommit: '3f1c7a376f424addaed58b65eef6d550d2128a22',
            reviewedAtCommit: gitCommit,
            apiFingerprint: apiFactFingerprint(facts),
        },
        entries: facts.map((fact) => {
            const targetOwner = targetOwnerFor(fact);
            return {
                id: fact.id,
                api: fact.api,
                kind: fact.kind,
                signature: fact.signature,
                targetOwner,
                targetMethod: targetMethodFor(fact, targetOwner),
                adapter: adapterFor(fact, targetOwner),
                syncMode: fact.syncMode,
                operationId: operationIdFor(fact, targetOwner),
                history: historyFor(fact),
                callbacks: callbacksFor(fact),
                errorRoute: errorRouteFor(fact),
                testIds: testIdsFor(fact),
            };
        }),
    };
}

function apiFactFingerprint(facts) {
    return hashText(
        JSON.stringify(
            facts.map(({ id, api, kind, sourceFile, signature, syncMode }) => ({
                id,
                api,
                kind,
                sourceFile,
                signature,
                syncMode,
            })),
        ),
    );
}

function collectPortFacts(text) {
    const file = sourceFile(legacyPortsPath, text);
    const ports = [];
    for (const statement of file.statements) {
        if (!ts.isInterfaceDeclaration(statement) || !statement.name.text.startsWith('Legacy')) {
            continue;
        }
        const members = statement.members.map((member) => ({
            name: propertyName(member),
            signature: normalizeSignature(member.getText(file)),
        }));
        ports.push({
            id: `port:${statement.name.text}`,
            name: statement.name.text,
            sourceFile: 'src/compatibility/legacy-ports.ts',
            line: lineOf(file, statement),
            members,
        });
    }
    return ports.sort((left, right) => left.id.localeCompare(right.id));
}

const portPurposes = Object.freeze({
    LegacyDisposer: 'Dispose a registration without exposing its registry.',
    LegacyCanvasReadPort: 'Read or require the Core-owned live Canvas.',
    LegacyBaseImageReadPort: 'Read Core-owned base-image identity and metadata.',
    LegacyRasterCommitPort: 'Commit one raster mutation through the Core transaction boundary.',
    LegacyOperationPort: 'Run sync or async work under a named operation guard.',
    LegacyHistoryRecorderPort: 'Record or clear committed history without exposing the stack.',
    LegacyExportContributorPort: 'Register feature rendering on an isolated export workspace.',
    LegacyStateSliceDefinition: 'Describe one owner-specific compatibility state slice.',
    LegacyStateSlicePort: 'Register one owner-specific state slice.',
    LegacyOverlayPort: 'Read overlay collections, selection, and request rendering.',
    LegacyToolSessionPort: 'Coordinate one active legacy tool session.',
    LegacyCallbackPort: 'Emit public callbacks through the compatibility callback boundary.',
    LegacyDomReadModelPort: 'Resolve and synchronize documented DOM controls.',
});

const adapterContracts = Object.freeze([
    {
        adapter: 'LEGACY_FILTERS_ADAPTER',
        family: 'FILTERS',
        migrationStage: 'R5B',
        allowedPorts: [
            'LegacyBaseImageReadPort',
            'LegacyRasterCommitPort',
            'LegacyOperationPort',
            'LegacyHistoryRecorderPort',
            'LegacyCallbackPort',
        ],
    },
    {
        adapter: 'LEGACY_CROP_ADAPTER',
        family: 'CROP',
        migrationStage: 'R5C',
        allowedPorts: [
            'LegacyCanvasReadPort',
            'LegacyBaseImageReadPort',
            'LegacyRasterCommitPort',
            'LegacyOperationPort',
            'LegacyHistoryRecorderPort',
            'LegacyOverlayPort',
            'LegacyToolSessionPort',
            'LegacyCallbackPort',
        ],
    },
    {
        adapter: 'LEGACY_MOSAIC_ADAPTER',
        family: 'MOSAIC',
        migrationStage: 'R5D',
        allowedPorts: [
            'LegacyCanvasReadPort',
            'LegacyBaseImageReadPort',
            'LegacyRasterCommitPort',
            'LegacyOperationPort',
            'LegacyHistoryRecorderPort',
            'LegacyToolSessionPort',
            'LegacyCallbackPort',
        ],
    },
    {
        adapter: 'LEGACY_ANNOTATION_ADAPTER',
        family: 'ANNOTATION',
        migrationStage: 'R5E',
        allowedPorts: [
            'LegacyCanvasReadPort',
            'LegacyBaseImageReadPort',
            'LegacyOperationPort',
            'LegacyHistoryRecorderPort',
            'LegacyExportContributorPort',
            'LegacyStateSlicePort',
            'LegacyOverlayPort',
            'LegacyToolSessionPort',
            'LegacyCallbackPort',
        ],
    },
    {
        adapter: 'LEGACY_OVERLAY_STATE_ADAPTER',
        family: 'OVERLAY_STATE',
        migrationStage: 'R5F',
        allowedPorts: [
            'LegacyBaseImageReadPort',
            'LegacyOperationPort',
            'LegacyStateSlicePort',
            'LegacyOverlayPort',
            'LegacyCallbackPort',
        ],
    },
    {
        adapter: 'LEGACY_DOM_ADAPTER',
        family: 'UI',
        migrationStage: 'R5G',
        allowedPorts: [
            'LegacyCanvasReadPort',
            'LegacyToolSessionPort',
            'LegacyCallbackPort',
            'LegacyDomReadModelPort',
        ],
    },
    {
        adapter: 'MASK_PLUGIN',
        family: 'MASK',
        migrationStage: 'R4',
        allowedPorts: [
            'LegacyCanvasReadPort',
            'LegacyOperationPort',
            'LegacyHistoryRecorderPort',
            'LegacyExportContributorPort',
            'LegacyStateSlicePort',
            'LegacyOverlayPort',
            'LegacyCallbackPort',
        ],
    },
    {
        adapter: 'HISTORY_PLUGIN',
        family: 'HISTORY',
        migrationStage: 'R3',
        allowedPorts: [
            'LegacyOperationPort',
            'LegacyHistoryRecorderPort',
            'LegacyStateSlicePort',
            'LegacyCallbackPort',
        ],
    },
    {
        adapter: 'THIN_FACADE',
        family: 'RUNTIME',
        migrationStage: 'R2',
        allowedPorts: ['LegacyOperationPort', 'LegacyCallbackPort', 'LegacyDomReadModelPort'],
    },
]);

function seedPortPolicy(portFacts, gitCommit) {
    return {
        schemaVersion: 1,
        metadata: {
            reviewedAtCommit: gitCommit,
            forbiddenAggregateInterfaces: ['LegacyCoreAccess'],
        },
        ports: portFacts.map((fact) => ({
            id: fact.id,
            name: fact.name,
            members: fact.members,
            purpose: portPurposes[fact.name],
        })),
        adapters: adapterContracts,
    };
}

function setDifference(left, right) {
    return [...left].filter((value) => !right.has(value)).sort();
}

export function compareNamedSets(label, actual, expected) {
    const missing = setDifference(expected, actual);
    const added = setDifference(actual, expected);
    const errors = [];
    if (missing.length > 0) errors.push(`${label} missing: ${missing.join(', ')}`);
    if (added.length > 0) errors.push(`${label} added: ${added.join(', ')}`);
    return errors;
}

function factsByKind(facts, kind) {
    return new Set(
        facts
            .filter((fact) => fact.kind === kind)
            .map((fact) => (kind === 'method' ? fact.name : fact.api.replace(/^[^.]+\./, ''))),
    );
}

function validateAgainstBaseline(facts, baseline) {
    const methods = new Set(
        facts.filter((fact) => fact.kind === 'method').map((fact) => fact.name),
    );
    const options = new Set(
        facts
            .filter((fact) => fact.kind === 'option' || fact.kind === 'callback')
            .map((fact) => fact.name),
    );
    const callbacks = new Set(
        facts.filter((fact) => fact.kind === 'callback').map((fact) => fact.name),
    );
    const elementKeys = new Set(
        facts.filter((fact) => fact.kind === 'element-key').map((fact) => fact.name),
    );
    const typeExports = new Set(
        facts.filter((fact) => fact.kind === 'type-export').map((fact) => fact.api),
    );
    const runtimeExports = new Set(
        facts.filter((fact) => fact.kind === 'runtime-export').map((fact) => fact.api),
    );
    const constructors = new Set(
        facts.filter((fact) => fact.kind === 'constructor').map((fact) => fact.api),
    );
    void factsByKind;
    return [
        ...compareNamedSets('public methods', methods, baseline.methods),
        ...compareNamedSets('ImageEditorOptions', options, baseline.options),
        ...compareNamedSets('callbacks', callbacks, baseline.callbacks),
        ...compareNamedSets('ElementMap keys', elementKeys, baseline.elementKeys),
        ...compareNamedSets('root type exports', typeExports, baseline.typeExports),
        ...compareNamedSets('root runtime exports', runtimeExports, baseline.runtimeExports),
        ...compareNamedSets('constructor forms', constructors, baseline.constructors),
    ];
}

async function fileExists(filePath) {
    try {
        await access(filePath);
        return true;
    } catch {
        return false;
    }
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

async function prettierConfig() {
    return (await resolveConfig(path.join(repositoryRoot, 'package.json'))) ?? {};
}

async function writeJson(filePath, value) {
    await mkdir(path.dirname(filePath), { recursive: true });
    const content = await format(JSON.stringify(value), {
        ...(await prettierConfig()),
        parser: 'json',
    });
    await writeFile(filePath, content, 'utf8');
}

async function validateApiPolicy(facts, policy, baselineHash) {
    const errors = validatePolicyCoverage(facts, policy.entries, 'public-api');
    if (policy.metadata?.baselineSha256 !== baselineHash) {
        errors.push('public-api policy baseline hash is stale.');
    }
    if (policy.metadata?.apiFingerprint !== apiFactFingerprint(facts)) {
        errors.push('public-api policy fact fingerprint is stale.');
    }
    const factsById = new Map(facts.map((fact) => [fact.id, fact]));
    for (const entry of policy.entries) {
        const fact = factsById.get(entry.id);
        if (!fact) continue;
        for (const field of ['api', 'kind', 'signature', 'syncMode']) {
            if (entry[field] !== fact[field]) {
                errors.push(`public-api ${entry.id} has stale ${field}.`);
            }
        }
        if (!validTargetOwners.has(entry.targetOwner)) {
            errors.push(`public-api ${entry.id} has invalid targetOwner ${entry.targetOwner}.`);
        }
        for (const field of ['targetMethod', 'adapter', 'operationId', 'history', 'errorRoute']) {
            if (!entry[field]) errors.push(`public-api ${entry.id} lacks ${field}.`);
        }
        if (
            !Array.isArray(entry.callbacks) ||
            !Array.isArray(entry.testIds) ||
            entry.testIds.length === 0
        ) {
            errors.push(`public-api ${entry.id} lacks callback or test evidence.`);
        }
        for (const testId of entry.testIds ?? []) {
            const testFile = String(testId).split('#', 1)[0];
            if (!(await fileExists(path.join(repositoryRoot, testFile)))) {
                errors.push(`public-api ${entry.id} test file does not exist: ${testId}`);
            }
        }
    }
    return errors;
}

function validatePortPolicy(portFacts, policy, legacyCallGenerated, legacyCallPolicy) {
    const errors = validatePolicyCoverage(portFacts, policy.ports, 'legacy-ports');
    const factsById = new Map(portFacts.map((fact) => [fact.id, fact]));
    const availablePorts = new Set(portFacts.map((fact) => fact.name));
    for (const required of requiredPorts) {
        if (!availablePorts.has(required))
            errors.push(`legacy-ports missing required ${required}.`);
    }
    for (const port of policy.ports) {
        const fact = factsById.get(port.id);
        if (!fact) continue;
        if (
            port.name !== fact.name ||
            JSON.stringify(port.members) !== JSON.stringify(fact.members)
        ) {
            errors.push(`legacy-ports ${port.id} has stale AST members.`);
        }
        if (!port.purpose) errors.push(`legacy-ports ${port.id} has no purpose.`);
    }
    for (const forbidden of policy.metadata?.forbiddenAggregateInterfaces ?? []) {
        if (availablePorts.has(forbidden))
            errors.push(`Forbidden aggregate Port exists: ${forbidden}.`);
    }
    const adaptersByName = new Map();
    for (const adapter of policy.adapters ?? []) {
        if (adaptersByName.has(adapter.adapter)) {
            errors.push(`Duplicate adapter contract: ${adapter.adapter}.`);
        }
        adaptersByName.set(adapter.adapter, adapter);
        const allowed = new Set(adapter.allowedPorts ?? []);
        if (allowed.size !== (adapter.allowedPorts ?? []).length) {
            errors.push(`Adapter ${adapter.adapter} repeats an allowed Port.`);
        }
        if (allowed.size >= requiredPorts.length) {
            errors.push(`Adapter ${adapter.adapter} is an aggregate Core-access interface.`);
        }
        for (const port of allowed) {
            if (!availablePorts.has(port)) {
                errors.push(`Adapter ${adapter.adapter} references missing Port ${port}.`);
            }
        }
        if (!adapter.family || !adapter.migrationStage) {
            errors.push(`Adapter ${adapter.adapter} lacks family or migration stage.`);
        }
    }

    errors.push(
        ...validatePolicyCoverage(
            legacyCallGenerated.entries,
            legacyCallPolicy.entries,
            'R1 legacy call mapping',
        ),
    );
    for (const callSite of legacyCallPolicy.entries) {
        if (!adaptersByName.has(callSite.targetAdapter)) {
            errors.push(
                `Legacy call ${callSite.id} targets adapter ${callSite.targetAdapter} without a Port contract.`,
            );
        }
    }
    return errors;
}

function markdownCode(value) {
    return `\`${String(value).replace(/`/g, '\\`')}\``;
}

function markdownText(value) {
    return String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

async function renderApiMatrix(policy) {
    const counts = new Map();
    for (const entry of policy.entries) counts.set(entry.kind, (counts.get(entry.kind) ?? 0) + 1);
    const summary = [...counts]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([kind, count]) => `${kind}: ${count}`)
        .join(', ');
    const lines = [
        '# Phase 5A-R Public API Matrix',
        '',
        '> Generated and verified by `scripts/check-public-api-compatibility.mjs`. Edit the policy JSON, not this table.',
        '',
        `Frozen baseline: ${markdownCode(policy.metadata.baselineFile)} at ${markdownCode(policy.metadata.baselineReleaseCommit)}. Coverage: ${policy.entries.length} records (${summary}).`,
        '',
        '| v2.9 API | Kind | New target | Adapter | Sync/async | Operation ID | History | Callback order | Error semantics | Test |',
        '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ];
    for (const entry of policy.entries) {
        lines.push(
            `| ${markdownCode(entry.api)} | ${markdownCode(entry.kind)} | ${markdownCode(`${entry.targetOwner}.${entry.targetMethod}`)} | ${markdownCode(entry.adapter)} | ${markdownCode(entry.syncMode)} | ${markdownCode(entry.operationId)} | ${markdownText(entry.history)} | ${markdownText(entry.callbacks.join(' -> ') || 'none')} | ${markdownText(entry.errorRoute)} | ${markdownCode(entry.testIds.join(', '))} |`,
        );
    }
    lines.push(
        '',
        '## Contract conclusion',
        '',
        'The root named/default export, runtime guards, constructor forms, all 92 methods, all options and callbacks, every documented `ElementMap` key, and every root type export remain frozen. This matrix changes implementation ownership only; it does not add a root export or public preset subpath.',
        '',
    );
    return format(lines.join('\n'), { ...(await prettierConfig()), parser: 'markdown' });
}

async function renderPortContracts(policy) {
    const lines = [
        '# Phase 5A-R Legacy Port Contracts',
        '',
        '> Generated and verified by `scripts/check-public-api-compatibility.mjs`. Edit the policy JSON, not this table.',
        '',
        'No `LegacyCoreAccess` aggregate is permitted. Each adapter receives only the capabilities listed below.',
        '',
        '## Port definitions',
        '',
        '| Port | Members | Purpose |',
        '| --- | --- | --- |',
    ];
    for (const port of policy.ports) {
        lines.push(
            `| ${markdownCode(port.name)} | ${markdownCode(port.members.map((member) => member.name).join(', '))} | ${markdownText(port.purpose)} |`,
        );
    }
    lines.push(
        '',
        '## Adapter allowlists',
        '',
        '| Adapter | Feature family | Stage | Allowed Ports |',
        '| --- | --- | --- | --- |',
    );
    for (const adapter of policy.adapters) {
        lines.push(
            `| ${markdownCode(adapter.adapter)} | ${markdownCode(adapter.family)} | ${markdownCode(adapter.migrationStage)} | ${markdownCode(adapter.allowedPorts.join(', '))} |`,
        );
    }
    lines.push(
        '',
        'These are maximum allowlists, not convenience bundles. Implementations must import only the Ports they actually use; adding a Port requires a reviewed policy change and regression evidence.',
        '',
    );
    return format(lines.join('\n'), { ...(await prettierConfig()), parser: 'markdown' });
}

async function compareText(filePath, expected, label) {
    const actual = await readFile(filePath, 'utf8');
    return actual === expected ? [] : [`${label} drifted from its policy.`];
}

async function main() {
    const options = parseArguments(process.argv.slice(2));
    const [
        baselineText,
        imageEditorText,
        publicTypesText,
        indexText,
        legacyPortsText,
        gitCommit,
        legacyCallGenerated,
        legacyCallPolicy,
        bridgePolicy,
    ] = await Promise.all([
        readFile(baselinePath, 'utf8'),
        readFile(imageEditorPath, 'utf8'),
        readFile(publicTypesPath, 'utf8'),
        readFile(indexPath, 'utf8'),
        readFile(legacyPortsPath, 'utf8'),
        getGitCommit(),
        readJson(legacyCallGeneratedPath),
        readJson(legacyCallPolicyPath),
        readJson(bridgePolicyPath),
    ]);
    const baselineHash = hashText(baselineText);
    const baseline = parseBaseline(baselineText);
    const apiFacts = collectApiFacts(imageEditorText, publicTypesText, indexText);
    const portFacts = collectPortFacts(legacyPortsText);

    if (options.mode === 'generate') {
        if (options.refreshPolicies || !(await fileExists(apiPolicyPath))) {
            await writeJson(apiPolicyPath, seedApiPolicy(apiFacts, baselineHash, gitCommit));
        }
        if (options.refreshPolicies || !(await fileExists(portPolicyPath))) {
            await writeJson(portPolicyPath, seedPortPolicy(portFacts, gitCommit));
        }
    }

    const [apiPolicy, portPolicy] = await Promise.all([
        readJson(apiPolicyPath),
        readJson(portPolicyPath),
    ]);
    const apiDoc = await renderApiMatrix(apiPolicy);
    const portDoc = await renderPortContracts(portPolicy);
    if (options.mode === 'generate') {
        await mkdir(docsRoot, { recursive: true });
        await Promise.all([
            writeFile(apiMatrixDocPath, apiDoc, 'utf8'),
            writeFile(portContractsDocPath, portDoc, 'utf8'),
        ]);
    }

    const errors = [
        ...validateAgainstBaseline(apiFacts, baseline),
        ...(await validateApiPolicy(apiFacts, apiPolicy, baselineHash)),
        ...validatePortPolicy(portFacts, portPolicy, legacyCallGenerated, legacyCallPolicy),
        ...findUnclassifiedValues({ apiPolicy, portPolicy }),
        ...(await compareText(apiMatrixDocPath, apiDoc, 'Public API matrix doc')),
        ...(await compareText(portContractsDocPath, portDoc, 'Legacy Port contracts doc')),
    ];
    for (const entry of bridgePolicy.entries ?? []) {
        if (!entry.deleteStage)
            errors.push(`Compatibility bridge ${entry.id} lacks a migration stage.`);
    }

    if (errors.length > 0) {
        console.error(`Public API compatibility check failed (${errors.length} issue(s)):`);
        for (const error of errors) console.error(`- ${error}`);
        process.exitCode = 1;
        return;
    }
    console.log(
        `Public API compatibility check passed (${apiFacts.length} API records, ${portFacts.length} Port contracts, ${portPolicy.adapters.length} adapter allowlists).`,
    );
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) await main();
