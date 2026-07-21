/**
 * Validates Overlay State wire documents against structural and resource limits.
 *
 * @module
 */

import { isRuntimeIdentifier } from '../../sdk/index.js';
import { isDangerousStateKey as isUnsafeObjectKey } from '../../plugin-kernel/plugin-identifier.js';

import {
    OVERLAY_STATE_COORDINATE_SPACE,
    OVERLAY_STATE_SCHEMA,
    OVERLAY_STATE_WIRE_VERSION,
    type OverlayStateDocument,
    type OverlayStateImageReference,
    type OverlayStateItem,
    type OverlayStateLimits,
    type OverlayStateValidationIssue,
    type OverlayStateValidationResult,
} from './overlay-state-types.js';

export const DEFAULT_OVERLAY_STATE_LIMITS: OverlayStateLimits = Object.freeze({
    maxPayloadBytes: 5_000_000,
    maxDepth: 32,
    maxArrayLength: 100_000,
    maxOverlays: 500,
    maxMetadataKeys: 256,
    maxMetadataDepth: 8,
    maxStringLength: 10_000,
    maxIdentifierLength: 128,
    maxCodecPayloadBytes: 1_000_000,
    maxCoordinates: 200_000,
    maxCoordinateMagnitude: 1_000_000,
    maxDrawPoints: 100_000,
    maxPathCommands: 100_000,
});

const PERSISTENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const SEMVER_PATTERN =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const ROOT_KEYS = new Set([
    'schema',
    'version',
    'coordinateSpace',
    'image',
    'overlays',
    'metadata',
]);
const IMAGE_KEYS = new Set(['naturalWidth', 'naturalHeight', 'mimeType', 'sourceId', 'checksum']);
const ITEM_KEYS = new Set([
    'id',
    'kind',
    'codec',
    'geometry',
    'layer',
    'hidden',
    'locked',
    'metadata',
    'data',
]);
const CODEC_KEYS = new Set(['type', 'version']);
const MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_ISSUES = 100;

interface JsonCloneContext {
    readonly limits: OverlayStateLimits;
    readonly issues: OverlayStateValidationIssue[];
    readonly active: WeakSet<object>;
    estimatedBytes: number;
    payloadLimitReported: boolean;
}

interface JsonCloneResult {
    readonly ok: boolean;
    readonly value?: unknown;
}

function utf8Bytes(value: string): number {
    let bytes = 0;
    for (let index = 0; index < value.length; index += 1) {
        const code = value.charCodeAt(index);
        if (code < 0x80) bytes += 1;
        else if (code < 0x800) bytes += 2;
        else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
            const next = value.charCodeAt(index + 1);
            if (next >= 0xdc00 && next <= 0xdfff) {
                bytes += 4;
                index += 1;
            } else bytes += 3;
        } else bytes += 3;
    }
    return bytes;
}

function addIssue(
    issues: OverlayStateValidationIssue[],
    code: string,
    path: string,
    message: string,
): void {
    if (issues.length >= MAX_ISSUES) return;
    issues.push(Object.freeze({ code, path, message }));
}

function accountBytes(context: JsonCloneContext, amount: number, path: string): boolean {
    context.estimatedBytes += amount;
    if (context.estimatedBytes <= context.limits.maxPayloadBytes) return true;
    if (!context.payloadLimitReported) {
        context.payloadLimitReported = true;
        addIssue(
            context.issues,
            'payload.tooLarge',
            path,
            `Payload exceeds ${context.limits.maxPayloadBytes} bytes.`,
        );
    }
    return false;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function cloneJsonValue(
    value: unknown,
    path: string,
    depth: number,
    context: JsonCloneContext,
): JsonCloneResult {
    if (depth > context.limits.maxDepth) {
        addIssue(
            context.issues,
            'value.tooDeep',
            path,
            `Value exceeds depth ${context.limits.maxDepth}.`,
        );
        return { ok: false };
    }
    if (value === null) {
        return { ok: accountBytes(context, 4, path), value: null };
    }
    if (typeof value === 'boolean') {
        return { ok: accountBytes(context, value ? 4 : 5, path), value };
    }
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            addIssue(context.issues, 'number.nonFinite', path, 'Numbers must be finite.');
            return { ok: false };
        }
        return { ok: accountBytes(context, String(value).length, path), value };
    }
    if (typeof value === 'string') {
        if (value.length > context.limits.maxStringLength) {
            addIssue(
                context.issues,
                'string.tooLong',
                path,
                `String exceeds ${context.limits.maxStringLength} characters.`,
            );
            return { ok: false };
        }
        return { ok: accountBytes(context, utf8Bytes(value) + 2, path), value };
    }
    if (typeof value !== 'object') {
        addIssue(context.issues, 'value.unsupported', path, 'Value must be JSON-compatible.');
        return { ok: false };
    }
    if (context.active.has(value)) {
        addIssue(context.issues, 'value.cycle', path, 'Cyclic values are not supported.');
        return { ok: false };
    }
    if (Object.getOwnPropertySymbols(value).length > 0) {
        addIssue(context.issues, 'value.symbolKey', path, 'Symbol keys are not supported.');
        return { ok: false };
    }
    context.active.add(value);
    try {
        if (Array.isArray(value)) {
            if (value.length > context.limits.maxArrayLength) {
                addIssue(
                    context.issues,
                    'array.tooLong',
                    path,
                    `Array exceeds ${context.limits.maxArrayLength} entries.`,
                );
                return { ok: false };
            }
            const keys = Object.keys(value);
            if (keys.length !== value.length || keys.some((key, index) => key !== String(index))) {
                addIssue(
                    context.issues,
                    'array.invalidShape',
                    path,
                    'Arrays must be dense and must not have named properties.',
                );
                return { ok: false };
            }
            const output: unknown[] = [];
            let ok = accountBytes(context, 2, path);
            for (let index = 0; index < value.length && !context.payloadLimitReported; index += 1) {
                const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
                if (!descriptor || !('value' in descriptor)) {
                    addIssue(
                        context.issues,
                        'value.accessor',
                        `${path}[${index}]`,
                        'Accessor properties are not supported.',
                    );
                    ok = false;
                    continue;
                }
                const cloned = cloneJsonValue(
                    descriptor.value,
                    `${path}[${index}]`,
                    depth + 1,
                    context,
                );
                ok = cloned.ok && ok;
                output.push(cloned.value);
            }
            return ok ? { ok: true, value: Object.freeze(output) } : { ok: false };
        }
        if (!isPlainRecord(value)) {
            addIssue(
                context.issues,
                'object.invalidPrototype',
                path,
                'Objects must use a plain or null prototype.',
            );
            return { ok: false };
        }
        const keys = Object.keys(value).sort();
        if (keys.length > context.limits.maxArrayLength) {
            addIssue(
                context.issues,
                'object.tooLarge',
                path,
                `Object exceeds ${context.limits.maxArrayLength} keys.`,
            );
            return { ok: false };
        }
        if (Object.getOwnPropertyNames(value).length !== keys.length) {
            addIssue(
                context.issues,
                'object.nonEnumerable',
                path,
                'Non-enumerable properties are not supported.',
            );
            return { ok: false };
        }
        const output: Record<string, unknown> = {};
        let ok = accountBytes(context, 2, path);
        for (const key of keys) {
            const childPath = `${path}.${key}`;
            if (isUnsafeObjectKey(key)) {
                addIssue(context.issues, 'object.dangerousKey', childPath, 'Key is not allowed.');
                ok = false;
                continue;
            }
            if (key.length > context.limits.maxStringLength) {
                addIssue(context.issues, 'object.keyTooLong', childPath, 'Object key is too long.');
                ok = false;
                continue;
            }
            const descriptor = Object.getOwnPropertyDescriptor(value, key);
            if (!descriptor || !('value' in descriptor)) {
                addIssue(
                    context.issues,
                    'value.accessor',
                    childPath,
                    'Accessor properties are not supported.',
                );
                ok = false;
                continue;
            }
            accountBytes(context, utf8Bytes(key) + 3, childPath);
            const cloned = cloneJsonValue(descriptor.value, childPath, depth + 1, context);
            ok = cloned.ok && ok;
            if (cloned.ok) output[key] = cloned.value;
        }
        return ok ? { ok: true, value: Object.freeze(output) } : { ok: false };
    } finally {
        context.active.delete(value);
    }
}

function resolvedPositiveInteger(
    value: number | undefined,
    fallback: number,
    key: keyof OverlayStateLimits,
): number {
    if (value === undefined) return fallback;
    if (!Number.isSafeInteger(value) || value <= 0) {
        throw new TypeError(
            `[ImageEditor] Overlay State limit "${key}" must be a positive integer.`,
        );
    }
    return value;
}

export function resolveOverlayStateLimits(
    base: Partial<OverlayStateLimits> = {},
    override: Partial<OverlayStateLimits> = {},
): OverlayStateLimits {
    const merged = { ...base, ...override };
    const entries = Object.entries(DEFAULT_OVERLAY_STATE_LIMITS).map(([key, fallback]) => [
        key,
        resolvedPositiveInteger(
            merged[key as keyof OverlayStateLimits],
            fallback,
            key as keyof OverlayStateLimits,
        ),
    ]);
    return Object.freeze(Object.fromEntries(entries) as unknown as OverlayStateLimits);
}

function hasOnlyKeys(
    value: Record<string, unknown>,
    allowed: ReadonlySet<string>,
    path: string,
    issues: OverlayStateValidationIssue[],
): boolean {
    const unknown = Object.keys(value).filter((key) => !allowed.has(key));
    for (const key of unknown) {
        addIssue(issues, 'object.unknownKey', `${path}.${key}`, 'Unknown field.');
    }
    return unknown.length === 0;
}

function validIdentifier(
    value: unknown,
    path: string,
    limits: OverlayStateLimits,
    issues: OverlayStateValidationIssue[],
    persistent = false,
): value is string {
    if (
        typeof value !== 'string' ||
        value.length === 0 ||
        value.length > limits.maxIdentifierLength ||
        !(persistent ? PERSISTENT_ID_PATTERN.test(value) : isRuntimeIdentifier(value))
    ) {
        addIssue(issues, 'identifier.invalid', path, 'Identifier is invalid.');
        return false;
    }
    return true;
}

function validateMetadata(
    value: unknown,
    path: string,
    limits: OverlayStateLimits,
    issues: OverlayStateValidationIssue[],
): value is Readonly<Record<string, unknown>> {
    if (!isPlainRecord(value)) {
        addIssue(issues, 'metadata.invalid', path, 'Metadata must be an object.');
        return false;
    }
    let keys = 0;
    const visit = (entry: unknown, entryPath: string, depth: number): void => {
        if (depth > limits.maxMetadataDepth) {
            addIssue(
                issues,
                'metadata.tooDeep',
                entryPath,
                `Metadata exceeds depth ${limits.maxMetadataDepth}.`,
            );
            return;
        }
        if (Array.isArray(entry)) {
            for (let index = 0; index < entry.length; index += 1) {
                visit(entry[index], `${entryPath}[${index}]`, depth + 1);
            }
            return;
        }
        if (!isPlainRecord(entry)) return;
        for (const [key, child] of Object.entries(entry)) {
            keys += 1;
            if (keys > limits.maxMetadataKeys) {
                addIssue(
                    issues,
                    'metadata.tooManyKeys',
                    entryPath,
                    `Metadata exceeds ${limits.maxMetadataKeys} keys.`,
                );
                return;
            }
            visit(child, `${entryPath}.${key}`, depth + 1);
        }
    };
    visit(value, path, 0);
    return true;
}

function jsonBytes(value: unknown): number {
    return utf8Bytes(JSON.stringify(value));
}

function inspectCodecValue(
    value: unknown,
    path: string,
    limits: OverlayStateLimits,
    issues: OverlayStateValidationIssue[],
): void {
    let coordinates = 0;
    const visit = (entry: unknown, entryPath: string, key: string | null): void => {
        if (typeof entry === 'number') {
            coordinates += 1;
            if (Math.abs(entry) > limits.maxCoordinateMagnitude) {
                addIssue(
                    issues,
                    'coordinate.outOfRange',
                    entryPath,
                    `Coordinate magnitude exceeds ${limits.maxCoordinateMagnitude}.`,
                );
            }
            return;
        }
        if (Array.isArray(entry)) {
            if (key === 'points' && entry.length > limits.maxDrawPoints) {
                addIssue(
                    issues,
                    'draw.tooManyPoints',
                    entryPath,
                    `Point count exceeds ${limits.maxDrawPoints}.`,
                );
            }
            if ((key === 'commands' || key === 'path') && entry.length > limits.maxPathCommands) {
                addIssue(
                    issues,
                    'path.tooManyCommands',
                    entryPath,
                    `Path command count exceeds ${limits.maxPathCommands}.`,
                );
            }
            entry.forEach((child, index) => visit(child, `${entryPath}[${index}]`, null));
            return;
        }
        if (!isPlainRecord(entry)) return;
        for (const [childKey, child] of Object.entries(entry)) {
            visit(child, `${entryPath}.${childKey}`, childKey);
        }
    };
    visit(value, path, null);
    if (coordinates > limits.maxCoordinates) {
        addIssue(
            issues,
            'coordinate.tooMany',
            path,
            `Coordinate count exceeds ${limits.maxCoordinates}.`,
        );
    }
}

function validateImage(
    value: unknown,
    limits: OverlayStateLimits,
    issues: OverlayStateValidationIssue[],
): value is OverlayStateImageReference {
    if (!isPlainRecord(value)) {
        addIssue(issues, 'image.invalid', '$.image', 'Image reference must be an object.');
        return false;
    }
    hasOnlyKeys(value, IMAGE_KEYS, '$.image', issues);
    for (const key of ['naturalWidth', 'naturalHeight'] as const) {
        const dimension = value[key];
        if (!Number.isSafeInteger(dimension) || Number(dimension) <= 0) {
            addIssue(
                issues,
                'image.dimensionInvalid',
                `$.image.${key}`,
                'Image dimensions must be positive safe integers.',
            );
        }
    }
    if (value.mimeType !== undefined && !MIME_TYPES.has(String(value.mimeType))) {
        addIssue(issues, 'image.mimeTypeInvalid', '$.image.mimeType', 'MIME type is invalid.');
    }
    for (const key of ['sourceId', 'checksum'] as const) {
        const entry = value[key];
        if (
            entry !== undefined &&
            (typeof entry !== 'string' ||
                entry.length === 0 ||
                entry.length > limits.maxStringLength)
        ) {
            addIssue(
                issues,
                'image.referenceInvalid',
                `$.image.${key}`,
                'Image reference is invalid.',
            );
        }
    }
    return true;
}

function validateItem(
    value: unknown,
    index: number,
    limits: OverlayStateLimits,
    issues: OverlayStateValidationIssue[],
): value is OverlayStateItem {
    const path = `$.overlays[${index}]`;
    if (!isPlainRecord(value)) {
        addIssue(issues, 'overlay.invalid', path, 'Overlay item must be an object.');
        return false;
    }
    hasOnlyKeys(value, ITEM_KEYS, path, issues);
    validIdentifier(value.id, `${path}.id`, limits, issues, true);
    validIdentifier(value.kind, `${path}.kind`, limits, issues);
    if (!isPlainRecord(value.codec)) {
        addIssue(issues, 'codec.invalid', `${path}.codec`, 'Codec reference must be an object.');
    } else {
        hasOnlyKeys(value.codec, CODEC_KEYS, `${path}.codec`, issues);
        validIdentifier(value.codec.type, `${path}.codec.type`, limits, issues);
        if (
            typeof value.codec.version !== 'string' ||
            value.codec.version.length > limits.maxIdentifierLength ||
            !SEMVER_PATTERN.test(value.codec.version)
        ) {
            addIssue(
                issues,
                'codec.versionInvalid',
                `${path}.codec.version`,
                'Codec version must be valid semantic versioning.',
            );
        }
    }
    if (!Object.prototype.hasOwnProperty.call(value, 'geometry')) {
        addIssue(issues, 'overlay.geometryMissing', `${path}.geometry`, 'Geometry is required.');
    }
    if (!Object.prototype.hasOwnProperty.call(value, 'data')) {
        addIssue(issues, 'overlay.dataMissing', `${path}.data`, 'Codec data is required.');
    }
    if (!Number.isSafeInteger(value.layer) || Number(value.layer) < 0) {
        addIssue(
            issues,
            'overlay.layerInvalid',
            `${path}.layer`,
            'Layer must be a non-negative integer.',
        );
    }
    if (typeof value.hidden !== 'boolean') {
        addIssue(issues, 'overlay.hiddenInvalid', `${path}.hidden`, 'Hidden must be boolean.');
    }
    if (typeof value.locked !== 'boolean') {
        addIssue(issues, 'overlay.lockedInvalid', `${path}.locked`, 'Locked must be boolean.');
    }
    if (value.metadata !== undefined) {
        validateMetadata(value.metadata, `${path}.metadata`, limits, issues);
    }
    const codecPayload = Object.freeze({
        geometry: value.geometry,
        data: value.data,
        ...(value.metadata !== undefined ? { metadata: value.metadata } : {}),
    });
    if (jsonBytes(codecPayload) > limits.maxCodecPayloadBytes) {
        addIssue(
            issues,
            'codec.payloadTooLarge',
            path,
            `Codec payload exceeds ${limits.maxCodecPayloadBytes} bytes.`,
        );
    }
    inspectCodecValue(codecPayload, path, limits, issues);
    return true;
}

export function validateOverlayStateDocument(
    payload: unknown,
    limits: OverlayStateLimits,
): OverlayStateValidationResult {
    const issues: OverlayStateValidationIssue[] = [];
    const cloneContext: JsonCloneContext = {
        limits,
        issues,
        active: new WeakSet(),
        estimatedBytes: 0,
        payloadLimitReported: false,
    };
    const cloned = cloneJsonValue(payload, '$', 0, cloneContext);
    if (!cloned.ok || !isPlainRecord(cloned.value)) {
        if (cloned.ok) addIssue(issues, 'document.invalid', '$', 'Document must be an object.');
        return Object.freeze({ valid: false, errors: Object.freeze(issues) });
    }
    const document = cloned.value;
    if (jsonBytes(document) > limits.maxPayloadBytes) {
        addIssue(
            issues,
            'payload.tooLarge',
            '$',
            `Payload exceeds ${limits.maxPayloadBytes} bytes.`,
        );
    }
    hasOnlyKeys(document, ROOT_KEYS, '$', issues);
    if (document.schema !== OVERLAY_STATE_SCHEMA) {
        addIssue(issues, 'document.schemaUnsupported', '$.schema', 'Schema is unsupported.');
    }
    if (document.version !== OVERLAY_STATE_WIRE_VERSION) {
        addIssue(
            issues,
            'document.versionUnsupported',
            '$.version',
            'Wire version is unsupported.',
        );
    }
    if (document.coordinateSpace !== OVERLAY_STATE_COORDINATE_SPACE) {
        addIssue(
            issues,
            'document.coordinateSpaceUnsupported',
            '$.coordinateSpace',
            'Coordinate space is unsupported.',
        );
    }
    validateImage(document.image, limits, issues);
    if (!Array.isArray(document.overlays)) {
        addIssue(issues, 'document.overlaysInvalid', '$.overlays', 'Overlays must be an array.');
    } else if (document.overlays.length > limits.maxOverlays) {
        addIssue(
            issues,
            'document.tooManyOverlays',
            '$.overlays',
            `Overlay count exceeds ${limits.maxOverlays}.`,
        );
    } else {
        document.overlays.forEach((item, index) => validateItem(item, index, limits, issues));
        const ids = new Set<string>();
        const layers = new Set<number>();
        document.overlays.forEach((item, index) => {
            if (!isPlainRecord(item)) return;
            if (typeof item.id === 'string') {
                if (ids.has(item.id)) {
                    addIssue(
                        issues,
                        'overlay.duplicateId',
                        `$.overlays[${index}].id`,
                        'Persistent IDs must be unique.',
                    );
                }
                ids.add(item.id);
            }
            if (Number.isSafeInteger(item.layer)) {
                if (layers.has(Number(item.layer))) {
                    addIssue(
                        issues,
                        'overlay.duplicateLayer',
                        `$.overlays[${index}].layer`,
                        'Layer values must be unique.',
                    );
                }
                layers.add(Number(item.layer));
            }
        });
    }
    if (document.metadata !== undefined) {
        validateMetadata(document.metadata, '$.metadata', limits, issues);
    }
    if (issues.length > 0) {
        return Object.freeze({ valid: false, errors: Object.freeze(issues) });
    }
    return Object.freeze({
        valid: true,
        document: document as unknown as OverlayStateDocument,
        errors: Object.freeze([]),
    });
}
