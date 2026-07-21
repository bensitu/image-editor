'use strict';

var foundations_overlay_index = require('../../foundations/overlay/index.cjs');
var affineMatrix = require('../../chunks/affine-matrix-DRJ0b89x.cjs');
var cloneStateValue = require('../../chunks/clone-state-value-CnsEsCNe.cjs');
var pluginManifest = require('../../chunks/plugin-manifest-BCkXHQr2.cjs');
var pluginDefinition = require('../../chunks/plugin-definition-B3UyurRp.cjs');
var coreCapabilities = require('../../chunks/core-capabilities-ewP5YPVJ.cjs');
require('../../chunks/errors-DeAfrgDC.cjs');
require('../../chunks/disposable-Sj4tt6Lk.cjs');

class OverlayStateValidationError extends TypeError {
    constructor(issues) {
        const first = issues[0];
        super(`[ImageEditor] Overlay State is invalid${first ? ` at ${first.path}: ${first.message}` : '.'}`);
        Object.defineProperty(this, "code", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'OVERLAY_STATE_INVALID'
        });
        Object.defineProperty(this, "issues", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.name = 'OverlayStateValidationError';
        this.issues = Object.freeze([...issues]);
    }
}
class OverlayStateImageMissingError extends Error {
    constructor() {
        super('[ImageEditor] Overlay State requires a loaded Base Image.');
        Object.defineProperty(this, "code", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'OVERLAY_STATE_IMAGE_MISSING'
        });
        this.name = 'OverlayStateImageMissingError';
    }
}
class OverlayStateCodecError extends Error {
    constructor(kind, message = 'has no compatible State Codec') {
        super(`[ImageEditor] Overlay kind "${kind}" ${message}.`);
        Object.defineProperty(this, "code", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'OVERLAY_STATE_CODEC_UNAVAILABLE'
        });
        this.name = 'OverlayStateCodecError';
    }
}
class OverlayStateIdConflictError extends Error {
    constructor(id) {
        super(`[ImageEditor] Overlay State ID "${id}" already exists.`);
        Object.defineProperty(this, "code", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'OVERLAY_STATE_ID_CONFLICT'
        });
        this.name = 'OverlayStateIdConflictError';
    }
}
class OverlayStatePluginDisposedError extends Error {
    constructor(operation) {
        super(`[ImageEditor] Cannot ${operation} after Overlay State Plugin disposal.`);
        Object.defineProperty(this, "code", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'OVERLAY_STATE_PLUGIN_DISPOSED'
        });
        this.name = 'OverlayStatePluginDisposedError';
    }
}

function createOverlayStateContext(baseImagePort) {
    const baseImage = baseImagePort.getBaseImage();
    const imageInfo = baseImagePort.getImageInfo();
    if (!baseImage ||
        !imageInfo ||
        !Number.isSafeInteger(imageInfo.naturalWidth) ||
        imageInfo.naturalWidth <= 0 ||
        !Number.isSafeInteger(imageInfo.naturalHeight) ||
        imageInfo.naturalHeight <= 0) {
        throw new OverlayStateImageMissingError();
    }
    const matrixValue = baseImage.calcTransformMatrix();
    if (!affineMatrix.isFiniteAffineMatrix(matrixValue)) {
        throw new TypeError('[ImageEditor] Base Image transform is invalid.');
    }
    const matrix = matrixValue;
    const inverse = affineMatrix.invertAffine(matrix);
    const naturalWidth = imageInfo.naturalWidth;
    const naturalHeight = imageInfo.naturalHeight;
    const image = Object.freeze({
        naturalWidth,
        naturalHeight,
        mimeType: imageInfo.mimeType,
    });
    const canvasScale = Math.sqrt(Math.abs(affineMatrix.affineDeterminant(matrix)));
    const scalarReference = Math.min(naturalWidth, naturalHeight) * canvasScale;
    if (!Number.isFinite(scalarReference) || scalarReference <= 0) {
        throw new TypeError('[ImageEditor] Base Image transform is singular.');
    }
    const codec = Object.freeze({
        image,
        toImageNormalized(point) {
            const local = affineMatrix.applyAffineToPoint(inverse, point);
            return Object.freeze({
                x: (local.x + naturalWidth / 2) / naturalWidth,
                y: (local.y + naturalHeight / 2) / naturalHeight,
            });
        },
        toCanvasPoint(point) {
            return affineMatrix.applyAffineToPoint(matrix, {
                x: point.x * naturalWidth - naturalWidth / 2,
                y: point.y * naturalHeight - naturalHeight / 2,
            });
        },
        toImageNormalizedScalar(value) {
            if (!Number.isFinite(value)) {
                throw new TypeError('[ImageEditor] Overlay State scalar must be finite.');
            }
            return value / scalarReference;
        },
        toCanvasScalar(value) {
            if (!Number.isFinite(value)) {
                throw new TypeError('[ImageEditor] Overlay State scalar must be finite.');
            }
            return value * scalarReference;
        },
    });
    return Object.freeze({ codec, image });
}

const OVERLAY_STATE_SCHEMA = 'image-editor.overlay-state';
const OVERLAY_STATE_WIRE_VERSION = 1;
const OVERLAY_STATE_COORDINATE_SPACE = 'image-normalized';

const DEFAULT_OVERLAY_STATE_LIMITS = Object.freeze({
    maxPayloadBytes: 5000000,
    maxDepth: 32,
    maxArrayLength: 100000,
    maxOverlays: 500,
    maxMetadataKeys: 256,
    maxMetadataDepth: 8,
    maxStringLength: 10000,
    maxIdentifierLength: 128,
    maxCodecPayloadBytes: 1000000,
    maxCoordinates: 200000,
    maxCoordinateMagnitude: 1000000,
    maxDrawPoints: 100000,
    maxPathCommands: 100000,
});
const PERSISTENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const SEMVER_PATTERN$1 = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
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
function utf8Bytes(value) {
    let bytes = 0;
    for (let index = 0; index < value.length; index += 1) {
        const code = value.charCodeAt(index);
        if (code < 0x80)
            bytes += 1;
        else if (code < 0x800)
            bytes += 2;
        else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
            const next = value.charCodeAt(index + 1);
            if (next >= 0xdc00 && next <= 0xdfff) {
                bytes += 4;
                index += 1;
            }
            else
                bytes += 3;
        }
        else
            bytes += 3;
    }
    return bytes;
}
function addIssue(issues, code, path, message) {
    if (issues.length >= MAX_ISSUES)
        return;
    issues.push(Object.freeze({ code, path, message }));
}
function accountBytes(context, amount, path) {
    context.estimatedBytes += amount;
    if (context.estimatedBytes <= context.limits.maxPayloadBytes)
        return true;
    if (!context.payloadLimitReported) {
        context.payloadLimitReported = true;
        addIssue(context.issues, 'payload.tooLarge', path, `Payload exceeds ${context.limits.maxPayloadBytes} bytes.`);
    }
    return false;
}
function isPlainRecord(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
        return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}
function cloneJsonValue(value, path, depth, context) {
    if (depth > context.limits.maxDepth) {
        addIssue(context.issues, 'value.tooDeep', path, `Value exceeds depth ${context.limits.maxDepth}.`);
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
            addIssue(context.issues, 'string.tooLong', path, `String exceeds ${context.limits.maxStringLength} characters.`);
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
                addIssue(context.issues, 'array.tooLong', path, `Array exceeds ${context.limits.maxArrayLength} entries.`);
                return { ok: false };
            }
            const keys = Object.keys(value);
            if (keys.length !== value.length || keys.some((key, index) => key !== String(index))) {
                addIssue(context.issues, 'array.invalidShape', path, 'Arrays must be dense and must not have named properties.');
                return { ok: false };
            }
            const output = [];
            let ok = accountBytes(context, 2, path);
            for (let index = 0; index < value.length && !context.payloadLimitReported; index += 1) {
                const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
                if (!descriptor || !('value' in descriptor)) {
                    addIssue(context.issues, 'value.accessor', `${path}[${index}]`, 'Accessor properties are not supported.');
                    ok = false;
                    continue;
                }
                const cloned = cloneJsonValue(descriptor.value, `${path}[${index}]`, depth + 1, context);
                ok = cloned.ok && ok;
                output.push(cloned.value);
            }
            return ok ? { ok: true, value: Object.freeze(output) } : { ok: false };
        }
        if (!isPlainRecord(value)) {
            addIssue(context.issues, 'object.invalidPrototype', path, 'Objects must use a plain or null prototype.');
            return { ok: false };
        }
        const keys = Object.keys(value).sort();
        if (keys.length > context.limits.maxArrayLength) {
            addIssue(context.issues, 'object.tooLarge', path, `Object exceeds ${context.limits.maxArrayLength} keys.`);
            return { ok: false };
        }
        if (Object.getOwnPropertyNames(value).length !== keys.length) {
            addIssue(context.issues, 'object.nonEnumerable', path, 'Non-enumerable properties are not supported.');
            return { ok: false };
        }
        const output = {};
        let ok = accountBytes(context, 2, path);
        for (const key of keys) {
            const childPath = `${path}.${key}`;
            if (cloneStateValue.isDangerousStateKey(key)) {
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
                addIssue(context.issues, 'value.accessor', childPath, 'Accessor properties are not supported.');
                ok = false;
                continue;
            }
            accountBytes(context, utf8Bytes(key) + 3, childPath);
            const cloned = cloneJsonValue(descriptor.value, childPath, depth + 1, context);
            ok = cloned.ok && ok;
            if (cloned.ok)
                output[key] = cloned.value;
        }
        return ok ? { ok: true, value: Object.freeze(output) } : { ok: false };
    }
    finally {
        context.active.delete(value);
    }
}
function resolvedPositiveInteger(value, fallback, key) {
    if (value === undefined)
        return fallback;
    if (!Number.isSafeInteger(value) || value <= 0) {
        throw new TypeError(`[ImageEditor] Overlay State limit "${key}" must be a positive integer.`);
    }
    return value;
}
function resolveOverlayStateLimits(base = {}, override = {}) {
    const merged = { ...base, ...override };
    const entries = Object.entries(DEFAULT_OVERLAY_STATE_LIMITS).map(([key, fallback]) => [
        key,
        resolvedPositiveInteger(merged[key], fallback, key),
    ]);
    return Object.freeze(Object.fromEntries(entries));
}
function hasOnlyKeys(value, allowed, path, issues) {
    const unknown = Object.keys(value).filter((key) => !allowed.has(key));
    for (const key of unknown) {
        addIssue(issues, 'object.unknownKey', `${path}.${key}`, 'Unknown field.');
    }
    return unknown.length === 0;
}
function validIdentifier(value, path, limits, issues, persistent = false) {
    if (typeof value !== 'string' ||
        value.length === 0 ||
        value.length > limits.maxIdentifierLength ||
        !(persistent ? PERSISTENT_ID_PATTERN.test(value) : pluginManifest.isRuntimeIdentifier(value))) {
        addIssue(issues, 'identifier.invalid', path, 'Identifier is invalid.');
        return false;
    }
    return true;
}
function validateMetadata(value, path, limits, issues) {
    if (!isPlainRecord(value)) {
        addIssue(issues, 'metadata.invalid', path, 'Metadata must be an object.');
        return false;
    }
    let keys = 0;
    const visit = (entry, entryPath, depth) => {
        if (depth > limits.maxMetadataDepth) {
            addIssue(issues, 'metadata.tooDeep', entryPath, `Metadata exceeds depth ${limits.maxMetadataDepth}.`);
            return;
        }
        if (Array.isArray(entry)) {
            for (let index = 0; index < entry.length; index += 1) {
                visit(entry[index], `${entryPath}[${index}]`, depth + 1);
            }
            return;
        }
        if (!isPlainRecord(entry))
            return;
        for (const [key, child] of Object.entries(entry)) {
            keys += 1;
            if (keys > limits.maxMetadataKeys) {
                addIssue(issues, 'metadata.tooManyKeys', entryPath, `Metadata exceeds ${limits.maxMetadataKeys} keys.`);
                return;
            }
            visit(child, `${entryPath}.${key}`, depth + 1);
        }
    };
    visit(value, path, 0);
    return true;
}
function jsonBytes(value) {
    return utf8Bytes(JSON.stringify(value));
}
function inspectCodecValue(value, path, limits, issues) {
    let coordinates = 0;
    const visit = (entry, entryPath, key) => {
        if (typeof entry === 'number') {
            coordinates += 1;
            if (Math.abs(entry) > limits.maxCoordinateMagnitude) {
                addIssue(issues, 'coordinate.outOfRange', entryPath, `Coordinate magnitude exceeds ${limits.maxCoordinateMagnitude}.`);
            }
            return;
        }
        if (Array.isArray(entry)) {
            if (key === 'points' && entry.length > limits.maxDrawPoints) {
                addIssue(issues, 'draw.tooManyPoints', entryPath, `Point count exceeds ${limits.maxDrawPoints}.`);
            }
            if ((key === 'commands' || key === 'path') && entry.length > limits.maxPathCommands) {
                addIssue(issues, 'path.tooManyCommands', entryPath, `Path command count exceeds ${limits.maxPathCommands}.`);
            }
            entry.forEach((child, index) => visit(child, `${entryPath}[${index}]`, null));
            return;
        }
        if (!isPlainRecord(entry))
            return;
        for (const [childKey, child] of Object.entries(entry)) {
            visit(child, `${entryPath}.${childKey}`, childKey);
        }
    };
    visit(value, path, null);
    if (coordinates > limits.maxCoordinates) {
        addIssue(issues, 'coordinate.tooMany', path, `Coordinate count exceeds ${limits.maxCoordinates}.`);
    }
}
function validateImage(value, limits, issues) {
    if (!isPlainRecord(value)) {
        addIssue(issues, 'image.invalid', '$.image', 'Image reference must be an object.');
        return false;
    }
    hasOnlyKeys(value, IMAGE_KEYS, '$.image', issues);
    for (const key of ['naturalWidth', 'naturalHeight']) {
        const dimension = value[key];
        if (!Number.isSafeInteger(dimension) || Number(dimension) <= 0) {
            addIssue(issues, 'image.dimensionInvalid', `$.image.${key}`, 'Image dimensions must be positive safe integers.');
        }
    }
    if (value.mimeType !== undefined && !MIME_TYPES.has(String(value.mimeType))) {
        addIssue(issues, 'image.mimeTypeInvalid', '$.image.mimeType', 'MIME type is invalid.');
    }
    for (const key of ['sourceId', 'checksum']) {
        const entry = value[key];
        if (entry !== undefined &&
            (typeof entry !== 'string' ||
                entry.length === 0 ||
                entry.length > limits.maxStringLength)) {
            addIssue(issues, 'image.referenceInvalid', `$.image.${key}`, 'Image reference is invalid.');
        }
    }
    return true;
}
function validateItem(value, index, limits, issues) {
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
    }
    else {
        hasOnlyKeys(value.codec, CODEC_KEYS, `${path}.codec`, issues);
        validIdentifier(value.codec.type, `${path}.codec.type`, limits, issues);
        if (typeof value.codec.version !== 'string' ||
            value.codec.version.length > limits.maxIdentifierLength ||
            !SEMVER_PATTERN$1.test(value.codec.version)) {
            addIssue(issues, 'codec.versionInvalid', `${path}.codec.version`, 'Codec version must be valid semantic versioning.');
        }
    }
    if (!Object.prototype.hasOwnProperty.call(value, 'geometry')) {
        addIssue(issues, 'overlay.geometryMissing', `${path}.geometry`, 'Geometry is required.');
    }
    if (!Object.prototype.hasOwnProperty.call(value, 'data')) {
        addIssue(issues, 'overlay.dataMissing', `${path}.data`, 'Codec data is required.');
    }
    if (!Number.isSafeInteger(value.layer) || Number(value.layer) < 0) {
        addIssue(issues, 'overlay.layerInvalid', `${path}.layer`, 'Layer must be a non-negative integer.');
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
        addIssue(issues, 'codec.payloadTooLarge', path, `Codec payload exceeds ${limits.maxCodecPayloadBytes} bytes.`);
    }
    inspectCodecValue(codecPayload, path, limits, issues);
    return true;
}
function validateOverlayStateDocument(payload, limits) {
    const issues = [];
    const cloneContext = {
        limits,
        issues,
        active: new WeakSet(),
        estimatedBytes: 0,
        payloadLimitReported: false,
    };
    const cloned = cloneJsonValue(payload, '$', 0, cloneContext);
    if (!cloned.ok || !isPlainRecord(cloned.value)) {
        if (cloned.ok)
            addIssue(issues, 'document.invalid', '$', 'Document must be an object.');
        return Object.freeze({ valid: false, errors: Object.freeze(issues) });
    }
    const document = cloned.value;
    if (jsonBytes(document) > limits.maxPayloadBytes) {
        addIssue(issues, 'payload.tooLarge', '$', `Payload exceeds ${limits.maxPayloadBytes} bytes.`);
    }
    hasOnlyKeys(document, ROOT_KEYS, '$', issues);
    if (document.schema !== OVERLAY_STATE_SCHEMA) {
        addIssue(issues, 'document.schemaUnsupported', '$.schema', 'Schema is unsupported.');
    }
    if (document.version !== OVERLAY_STATE_WIRE_VERSION) {
        addIssue(issues, 'document.versionUnsupported', '$.version', 'Wire version is unsupported.');
    }
    if (document.coordinateSpace !== OVERLAY_STATE_COORDINATE_SPACE) {
        addIssue(issues, 'document.coordinateSpaceUnsupported', '$.coordinateSpace', 'Coordinate space is unsupported.');
    }
    validateImage(document.image, limits, issues);
    if (!Array.isArray(document.overlays)) {
        addIssue(issues, 'document.overlaysInvalid', '$.overlays', 'Overlays must be an array.');
    }
    else if (document.overlays.length > limits.maxOverlays) {
        addIssue(issues, 'document.tooManyOverlays', '$.overlays', `Overlay count exceeds ${limits.maxOverlays}.`);
    }
    else {
        document.overlays.forEach((item, index) => validateItem(item, index, limits, issues));
        const ids = new Set();
        const layers = new Set();
        document.overlays.forEach((item, index) => {
            if (!isPlainRecord(item))
                return;
            if (typeof item.id === 'string') {
                if (ids.has(item.id)) {
                    addIssue(issues, 'overlay.duplicateId', `$.overlays[${index}].id`, 'Persistent IDs must be unique.');
                }
                ids.add(item.id);
            }
            if (Number.isSafeInteger(item.layer)) {
                if (layers.has(Number(item.layer))) {
                    addIssue(issues, 'overlay.duplicateLayer', `$.overlays[${index}].layer`, 'Layer values must be unique.');
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
        document: document,
        errors: Object.freeze([]),
    });
}

const IMPORT_OPERATION_ID = 'overlay-state:import';
const MAX_PERSISTENT_ID_LENGTH = 128;
const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
function invalidResult(issues) {
    return Object.freeze({ valid: false, errors: Object.freeze([...issues]) });
}
function immutableIdMap(entries) {
    return Object.freeze(Object.fromEntries(entries));
}
function stateValue(document, index) {
    const item = document.overlays[index];
    return Object.freeze({
        geometry: item.geometry,
        data: item.data,
        ...(item.metadata !== undefined ? { metadata: item.metadata } : {}),
    });
}
function nextAvailableId(id, reserved) {
    for (let sequence = 1; sequence <= Number.MAX_SAFE_INTEGER; sequence += 1) {
        const suffix = `:copy-${sequence}`;
        const prefixLength = MAX_PERSISTENT_ID_LENGTH - suffix.length;
        const candidate = `${id.slice(0, Math.max(1, prefixLength))}${suffix}`;
        if (!reserved.has(candidate))
            return candidate;
    }
    throw new OverlayStateIdConflictError(id);
}
function isCodecValue(value) {
    return (typeof value === 'object' &&
        value !== null &&
        Object.prototype.hasOwnProperty.call(value, 'geometry') &&
        Object.prototype.hasOwnProperty.call(value, 'data'));
}
function resolveStateKind(overlay, kind) {
    const adapter = overlay.getStateKind(kind);
    const codec = adapter === null || adapter === void 0 ? void 0 : adapter.stateCodec;
    if ((adapter === null || adapter === void 0 ? void 0 : adapter.persistence.mode) !== 'persistent' ||
        !codec ||
        typeof codec.type !== 'string' ||
        !pluginManifest.isRuntimeIdentifier(codec.type) ||
        typeof codec.version !== 'string' ||
        !SEMVER_PATTERN.test(codec.version) ||
        typeof codec.serialize !== 'function' ||
        typeof codec.validate !== 'function' ||
        typeof codec.deserialize !== 'function') {
        return null;
    }
    return Object.freeze({ adapter, codec });
}
function codecAccepts(codec, value) {
    if (!isCodecValue(value))
        return false;
    try {
        return codec.validate(value);
    }
    catch {
        return false;
    }
}
class OverlayStateController {
    constructor(overlay, baseImage, canvas, configuredLimits) {
        Object.defineProperty(this, "overlay", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: overlay
        });
        Object.defineProperty(this, "baseImage", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: baseImage
        });
        Object.defineProperty(this, "canvas", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: canvas
        });
        Object.defineProperty(this, "configuredLimits", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: configuredLimits
        });
        Object.defineProperty(this, "sequence", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "disposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
    }
    validate(payload, options = {}) {
        var _a;
        this.assertActive('validate Overlay State');
        const limits = resolveOverlayStateLimits(this.configuredLimits, options.limits);
        const structural = validateOverlayStateDocument(payload, limits);
        if (!structural.valid || !structural.document)
            return structural;
        const issues = this.validateCodecs(structural.document, (_a = options.missingKindPolicy) !== null && _a !== void 0 ? _a : 'error');
        return issues.length > 0
            ? invalidResult(issues)
            : Object.freeze({
                valid: true,
                document: structural.document,
                errors: Object.freeze([]),
            });
    }
    migrate(payload, options = {}) {
        this.assertActive('migrate Overlay State');
        const limits = resolveOverlayStateLimits(this.configuredLimits, options.limits);
        const result = validateOverlayStateDocument(payload, limits);
        if (!result.valid || !result.document)
            throw new OverlayStateValidationError(result.errors);
        return result.document;
    }
    exportState(options = {}) {
        var _a, _b;
        this.assertActive('export Overlay State');
        const context = createOverlayStateContext(this.baseImage);
        const includeHidden = (_a = options.includeHidden) !== null && _a !== void 0 ? _a : true;
        const missingKindPolicy = (_b = options.missingKindPolicy) !== null && _b !== void 0 ? _b : 'error';
        const kinds = options.kinds ? new Set(options.kinds) : null;
        const objects = this.overlay.list({ includeHidden: true, includeLocked: true });
        const overlays = [];
        objects.forEach((object, layer) => {
            const classification = this.overlay.classify(object);
            if (!classification)
                return;
            const adapter = this.overlay.getStateKind(classification.kind);
            if ((adapter === null || adapter === void 0 ? void 0 : adapter.persistence.mode) === 'transient')
                return;
            if (kinds && !kinds.has(classification.kind))
                return;
            if (!includeHidden && classification.hidden)
                return;
            const resolved = resolveStateKind(this.overlay, classification.kind);
            if (!resolved) {
                if (missingKindPolicy === 'skip')
                    return;
                throw new OverlayStateCodecError(classification.kind);
            }
            const value = resolved.codec.serialize(object, context.codec);
            if (!codecAccepts(resolved.codec, value)) {
                throw new OverlayStateCodecError(classification.kind, `produced invalid State Codec data for "${classification.persistentId}"`);
            }
            overlays.push({
                id: classification.persistentId,
                kind: classification.kind,
                codec: Object.freeze({
                    type: resolved.codec.type,
                    version: resolved.codec.version,
                }),
                geometry: value.geometry,
                layer,
                hidden: classification.hidden,
                locked: classification.locked,
                ...(value.metadata !== undefined ? { metadata: value.metadata } : {}),
                data: value.data,
            });
        });
        const rawDocument = {
            schema: OVERLAY_STATE_SCHEMA,
            version: OVERLAY_STATE_WIRE_VERSION,
            coordinateSpace: OVERLAY_STATE_COORDINATE_SPACE,
            image: {
                naturalWidth: context.image.naturalWidth,
                naturalHeight: context.image.naturalHeight,
                ...(context.image.mimeType ? { mimeType: context.image.mimeType } : {}),
            },
            overlays,
            ...(options.metadata !== undefined ? { metadata: options.metadata } : {}),
        };
        const result = this.validate(rawDocument, { missingKindPolicy: 'error' });
        if (!result.valid || !result.document)
            throw new OverlayStateValidationError(result.errors);
        return result.document;
    }
    async importState(payload, options = {}) {
        var _a, _b, _c, _d, _e, _f;
        this.assertActive('import Overlay State');
        const mode = (_a = options.mode) !== null && _a !== void 0 ? _a : 'replace';
        const idConflict = (_b = options.idConflict) !== null && _b !== void 0 ? _b : 'error';
        const missingKindPolicy = (_c = options.missingKindPolicy) !== null && _c !== void 0 ? _c : 'error';
        const validated = this.validate(payload, {
            missingKindPolicy,
            limits: options.limits,
        });
        if (!validated.valid || !validated.document) {
            throw new OverlayStateValidationError(validated.errors);
        }
        const document = validated.document;
        const context = createOverlayStateContext(this.baseImage);
        const existingObjects = this.overlay.list({ includeHidden: true, includeLocked: true });
        const persistentIds = [];
        const persistentObjects = [];
        const allIds = new Set();
        for (const object of existingObjects) {
            const classification = this.overlay.classify(object);
            if (!classification)
                continue;
            allIds.add(classification.persistentId);
            if (((_d = this.overlay.getStateKind(classification.kind)) === null || _d === void 0 ? void 0 : _d.persistence.mode) === 'persistent') {
                persistentIds.push(classification.persistentId);
                persistentObjects.push(object);
            }
        }
        const removeIds = mode === 'replace' ? Object.freeze(persistentIds) : Object.freeze([]);
        const removeObjects = mode === 'replace' ? Object.freeze(persistentObjects) : Object.freeze([]);
        const reserved = new Set(allIds);
        if (mode === 'replace') {
            for (const id of removeIds)
                reserved.delete(id);
        }
        const idMapEntries = [];
        const additions = [];
        let skipped = 0;
        const ordered = document.overlays
            .map((item, index) => ({ item, index }))
            .sort((left, right) => left.item.layer - right.item.layer);
        for (const { item, index } of ordered) {
            const resolved = resolveStateKind(this.overlay, item.kind);
            if (!resolved ||
                resolved.codec.type !== item.codec.type ||
                resolved.codec.version !== item.codec.version) {
                if (missingKindPolicy === 'skip') {
                    skipped += 1;
                    continue;
                }
                throw new OverlayStateCodecError(item.kind);
            }
            let persistentId = item.id;
            if (reserved.has(persistentId)) {
                if (idConflict === 'error')
                    throw new OverlayStateIdConflictError(persistentId);
                const regenerated = nextAvailableId(persistentId, reserved);
                idMapEntries.push(Object.freeze([persistentId, regenerated]));
                persistentId = regenerated;
            }
            reserved.add(persistentId);
            const value = stateValue(document, index);
            const object = await resolved.codec.deserialize(value, context.codec);
            if (!object || typeof object !== 'object' || object.canvas) {
                throw new OverlayStateCodecError(item.kind, 'restored an incompatible object');
            }
            const marked = object;
            marked.editorOverlayKind = item.kind;
            marked.editorOverlayId = persistentId;
            marked.editorOverlayHidden = item.hidden;
            marked.editorOverlayLocked = item.locked;
            (_f = (_e = resolved.adapter).setPersistentId) === null || _f === void 0 ? void 0 : _f.call(_e, object, persistentId);
            if (!resolved.adapter.classify(object)) {
                throw new OverlayStateCodecError(item.kind, 'restored an incompatible object');
            }
            if (resolved.adapter.setHidden)
                resolved.adapter.setHidden(object, item.hidden);
            else
                object.set({ visible: !item.hidden });
            if (resolved.adapter.setLocked)
                resolved.adapter.setLocked(object, item.locked);
            else
                object.set({ selectable: !item.locked, evented: !item.locked });
            additions.push(Object.freeze({ kind: item.kind, persistentId, object }));
        }
        const additionObjects = Object.freeze(additions.map((entry) => entry.object));
        if (new Set(additionObjects).size !== additionObjects.length) {
            throw new OverlayStateCodecError('multiple', 'restored duplicate object identities');
        }
        if (removeIds.length > 0 || additions.length > 0) {
            await this.overlay.mutate({
                id: `overlay-state:import-${++this.sequence}`,
                operationId: IMPORT_OPERATION_ID,
                action: 'delete',
                objectIds: removeIds,
                mutate: () => {
                    const canvas = this.canvas.requireCanvas('import Overlay State');
                    canvas.discardActiveObject();
                    for (const object of removeObjects)
                        canvas.remove(object);
                    for (const object of additionObjects)
                        canvas.add(object);
                },
                affectedObjects: () => additionObjects,
                validate: () => {
                    for (const addition of additions) {
                        if (this.overlay.getByPersistentId(addition.persistentId) !==
                            addition.object) {
                            throw new OverlayStateCodecError(addition.kind, `did not restore "${addition.persistentId}"`);
                        }
                    }
                },
                metadata: Object.freeze({ mode, imported: additions.length, skipped }),
            });
        }
        return Object.freeze({
            mode,
            imported: additions.length,
            skipped,
            idMap: immutableIdMap(idMapEntries),
        });
    }
    dispose() {
        this.disposed = true;
    }
    validateCodecs(document, missingKindPolicy) {
        const issues = [];
        document.overlays.forEach((item, index) => {
            const resolved = resolveStateKind(this.overlay, item.kind);
            if (!resolved ||
                resolved.codec.type !== item.codec.type ||
                resolved.codec.version !== item.codec.version) {
                if (missingKindPolicy === 'error') {
                    issues.push(Object.freeze({
                        code: 'codec.unavailable',
                        path: `$.overlays[${index}].codec`,
                        message: `No compatible State Codec is installed for "${item.kind}".`,
                    }));
                }
                return;
            }
            if (!codecAccepts(resolved.codec, stateValue(document, index))) {
                issues.push(Object.freeze({
                    code: 'codec.payloadInvalid',
                    path: `$.overlays[${index}]`,
                    message: `State Codec payload for "${item.kind}" is invalid.`,
                }));
            }
        });
        return Object.freeze(issues);
    }
    assertActive(operation) {
        if (this.disposed)
            throw new OverlayStatePluginDisposedError(operation);
    }
}

const overlayStatePluginRef = pluginManifest.definePluginRef('plugin:overlay-state', '1.0.0');
function overlayStatePlugin(options = {}) {
    const limits = resolveOverlayStateLimits(options.limits);
    let controller = null;
    return pluginDefinition.definePlugin({
        ref: overlayStatePluginRef,
        manifest: {
            id: overlayStatePluginRef.id,
            version: '1.0.0',
            apiVersion: overlayStatePluginRef.apiVersion,
            engine: '^3.0.0',
            requires: [
                { token: foundations_overlay_index.OVERLAY_CAPABILITY, range: '^1.0.0' },
                { token: coreCapabilities.BASE_IMAGE_READ_CAPABILITY, range: '^1.0.0' },
                { token: coreCapabilities.CANVAS_READ_CAPABILITY, range: '^1.0.0' },
            ],
            permissions: ['fabric:canvas-read'],
        },
        setupMode: 'sync',
        setup(context) {
            const overlay = context.capabilities.require(foundations_overlay_index.OVERLAY_CAPABILITY);
            const baseImage = context.capabilities.require(coreCapabilities.BASE_IMAGE_READ_CAPABILITY);
            const canvas = context.capabilities.require(coreCapabilities.CANVAS_READ_CAPABILITY);
            context.operations.register({
                id: 'overlay-state:import',
                mode: 'mutation',
                conflictDomains: ['document', 'overlay', 'selection', 'state'],
                reentrancy: 'queue',
            });
            controller = new OverlayStateController(overlay, baseImage, canvas, limits);
            return controller;
        },
        onDispose() {
            controller === null || controller === void 0 ? void 0 : controller.dispose();
            controller = null;
        },
    });
}

exports.DEFAULT_OVERLAY_STATE_LIMITS = DEFAULT_OVERLAY_STATE_LIMITS;
exports.OVERLAY_STATE_COORDINATE_SPACE = OVERLAY_STATE_COORDINATE_SPACE;
exports.OVERLAY_STATE_SCHEMA = OVERLAY_STATE_SCHEMA;
exports.OVERLAY_STATE_WIRE_VERSION = OVERLAY_STATE_WIRE_VERSION;
exports.OverlayStateCodecError = OverlayStateCodecError;
exports.OverlayStateIdConflictError = OverlayStateIdConflictError;
exports.OverlayStateImageMissingError = OverlayStateImageMissingError;
exports.OverlayStatePluginDisposedError = OverlayStatePluginDisposedError;
exports.OverlayStateValidationError = OverlayStateValidationError;
exports.overlayStatePlugin = overlayStatePlugin;
exports.overlayStatePluginRef = overlayStatePluginRef;
//# sourceMappingURL=index.cjs.map
