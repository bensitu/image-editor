/**
 * Converts frozen maintenance snapshots into the current public Snapshot contract.
 *
 * This optional entry is intentionally isolated from normal runtime entries.
 *
 * @module
 */

import type {
    EditorSnapshot,
    ImageEditorCore,
    MissingPluginPolicy,
    SnapshotMigration,
    SnapshotMigrationContext,
} from '../core/index.js';
import { isDangerousStateKey as isUnsafeObjectKey } from '../plugin-kernel/plugin-identifier.js';

const SOURCE_SCHEMA = 'image-editor.canvas@2';
const TARGET_SCHEMA = 'image-editor.state@3' as const;
const MAX_INPUT_BYTES = 16 * 1024 * 1024;
const MAX_OBJECT_COUNT = 100_000;
const MAX_DEPTH = 64;
const MAX_CANVAS_DIMENSION = 32_768;
const MAX_CANVAS_PIXELS = 50_000_000;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

const TOP_LEVEL_KEYS = new Set([
    'version',
    'width',
    'height',
    'background',
    'objects',
    '_editorState',
]);
const EDITOR_STATE_KEYS = new Set([
    'currentScale',
    'currentRotation',
    'baseImageScale',
    'currentImageMimeType',
    'imageFilterConfig',
    'activeObjectKind',
    'activeMaskId',
    'activeAnnotationId',
]);
const EDITOR_OBJECT_KEYS = new Set([
    'editorObjectKind',
    'sessionObjectType',
    'maskId',
    'maskUid',
    'maskName',
    'isCropRect',
    'maskLabel',
    'originalAlpha',
    'originalStroke',
    'originalStrokeWidth',
    'isMosaicPreview',
    'annotationId',
    'annotationType',
    'shapeAnnotationKind',
    'annotationName',
    'annotationHidden',
    'annotationLocked',
    'annotationSelectable',
    'annotationEvented',
    'annotationHasControls',
    'annotationEditable',
    'overlayPersistentId',
    'overlayMetadata',
]);
const FILTER_KEYS = [
    'brightness',
    'contrast',
    'saturation',
    'blur',
    'sharpen',
    'grayscale',
    'sepia',
    'vintage',
] as const;

export type UnsupportedFieldPolicy = 'error' | 'warn-and-skip';

export interface SnapshotMigrationWarning {
    readonly code: string;
    readonly path: string;
    readonly message: string;
}

export interface SnapshotConversionOptions {
    readonly unsupportedFieldPolicy?: UnsupportedFieldPolicy;
    readonly onWarning?: (warning: SnapshotMigrationWarning) => void;
    readonly canvasSize?: Readonly<{ width: number; height: number }>;
    readonly maxInputBytes?: number;
    readonly maxObjectCount?: number;
    readonly maxDepth?: number;
}

export interface SnapshotMigrationLoadOptions extends SnapshotConversionOptions {
    readonly missingPluginPolicy?: MissingPluginPolicy;
    readonly signal?: AbortSignal;
}

export type SnapshotVersionDetection =
    | Readonly<{ kind: 'source'; schema: typeof SOURCE_SCHEMA; version: 2 }>
    | Readonly<{ kind: 'current'; schema: 'image-editor.state'; version: 3 }>
    | Readonly<{ kind: 'unsupported'; schema: string; version: unknown }>
    | Readonly<{ kind: 'unknown' }>;

export class SnapshotMigrationError extends Error {
    override readonly name = 'SnapshotMigrationError';

    constructor(
        readonly code: string,
        message: string,
        readonly path = '$',
        options?: Readonly<{ cause?: unknown }>,
    ) {
        super(`${message} (${path})`);
        if (options && 'cause' in options) {
            (this as Error & { cause?: unknown }).cause = options.cause;
        }
    }
}

interface ConversionContext {
    readonly policy: UnsupportedFieldPolicy;
    readonly onWarning?: (warning: SnapshotMigrationWarning) => void;
}

interface SerializedOverlayRecord {
    readonly kind: string;
    readonly persistentId: string;
    readonly hidden: boolean;
    readonly locked: boolean;
    readonly codec: Readonly<{ type: string; version: string }>;
    readonly data: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function byteLength(value: string): number {
    return new TextEncoder().encode(value).byteLength;
}

function limit(value: number | undefined, fallback: number, label: string): number {
    if (value === undefined) return fallback;
    if (!Number.isSafeInteger(value) || value < 1) {
        throw new SnapshotMigrationError('limit.invalid', `${label} must be a positive integer.`);
    }
    return value;
}

function inspectJsonValue(
    value: unknown,
    limits: Readonly<{ maxObjectCount: number; maxDepth: number; maxInputBytes: number }>,
    path = '$',
    depth = 0,
    ancestors = new WeakSet<object>(),
    counter: { objects: number; bytes: number } = { objects: 0, bytes: 0 },
): void {
    const addBytes = (amount: number): void => {
        counter.bytes += amount;
        if (!Number.isSafeInteger(counter.bytes) || counter.bytes > limits.maxInputBytes) {
            throw new SnapshotMigrationError('input.bytes', 'Snapshot input is too large.', path);
        }
    };
    if (depth > limits.maxDepth) {
        throw new SnapshotMigrationError('input.depth', 'Snapshot nesting is too deep.', path);
    }
    if (value === null || typeof value !== 'object') {
        if (
            value === undefined ||
            typeof value === 'function' ||
            typeof value === 'symbol' ||
            typeof value === 'bigint'
        ) {
            throw new SnapshotMigrationError(
                'input.value',
                `Snapshot contains unsupported ${typeof value} data.`,
                path,
            );
        }
        if (typeof value === 'number' && !Number.isFinite(value)) {
            throw new SnapshotMigrationError(
                'input.number',
                'Snapshot numbers must be finite.',
                path,
            );
        }
        const serialized = JSON.stringify(value);
        if (serialized === undefined) {
            throw new SnapshotMigrationError(
                'input.value',
                'Snapshot contains unsupported data.',
                path,
            );
        }
        addBytes(byteLength(serialized));
        return;
    }
    if (!Array.isArray(value) && !isRecord(value)) {
        throw new SnapshotMigrationError(
            'input.prototype',
            'Snapshot data must contain only plain objects and arrays.',
            path,
        );
    }
    if (
        Object.prototype.hasOwnProperty.call(value, 'toJSON') ||
        Object.getOwnPropertySymbols(value).length > 0
    ) {
        throw new SnapshotMigrationError(
            'input.property',
            'Snapshot data must not contain toJSON hooks or symbol properties.',
            path,
        );
    }
    if (ancestors.has(value)) {
        throw new SnapshotMigrationError('input.cycle', 'Snapshot data must not be cyclic.', path);
    }
    counter.objects += 1;
    if (counter.objects > limits.maxObjectCount) {
        throw new SnapshotMigrationError(
            'input.objects',
            'Snapshot object count exceeds the configured limit.',
            path,
        );
    }
    ancestors.add(value);

    const keys = Object.keys(value);
    if (Array.isArray(value)) {
        const extraKey = keys.find(
            (key) => !/^(?:0|[1-9]\d*)$/u.test(key) || Number(key) >= value.length,
        );
        if (extraKey !== undefined) {
            throw new SnapshotMigrationError(
                'input.array-property',
                'Snapshot arrays must not contain named enumerable properties.',
                `${path}.${extraKey}`,
            );
        }
        addBytes(2 + Math.max(0, value.length - 1));
        for (let index = 0; index < value.length; index += 1) {
            const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
            if (!descriptor) {
                addBytes(4);
                continue;
            }
            if (!('value' in descriptor)) {
                throw new SnapshotMigrationError(
                    'input.accessor',
                    'Snapshot data must not contain accessor properties.',
                    `${path}[${index}]`,
                );
            }
            inspectJsonValue(
                descriptor.value,
                limits,
                `${path}[${index}]`,
                depth + 1,
                ancestors,
                counter,
            );
        }
        ancestors.delete(value);
        return;
    }

    addBytes(2 + Math.max(0, keys.length - 1));
    for (const key of keys) {
        if (isUnsafeObjectKey(key)) {
            throw new SnapshotMigrationError(
                'input.key',
                `Snapshot contains dangerous key "${key}".`,
                `${path}.${key}`,
            );
        }
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || !('value' in descriptor)) {
            throw new SnapshotMigrationError(
                'input.accessor',
                'Snapshot data must not contain accessor properties.',
                `${path}.${key}`,
            );
        }
        addBytes(byteLength(JSON.stringify(key)) + 1);
        inspectJsonValue(descriptor.value, limits, `${path}.${key}`, depth + 1, ancestors, counter);
    }
    ancestors.delete(value);
}

function cloneInput(input: string | unknown, options: SnapshotConversionOptions): unknown {
    const maxInputBytes = limit(options.maxInputBytes, MAX_INPUT_BYTES, 'maxInputBytes');
    const limits = {
        maxObjectCount: limit(options.maxObjectCount, MAX_OBJECT_COUNT, 'maxObjectCount'),
        maxDepth: limit(options.maxDepth, MAX_DEPTH, 'maxDepth'),
        maxInputBytes,
    };
    let value: unknown;
    if (typeof input === 'string') {
        if (byteLength(input) > maxInputBytes) {
            throw new SnapshotMigrationError('input.bytes', 'Snapshot input is too large.');
        }
        try {
            value = JSON.parse(input) as unknown;
        } catch (error) {
            throw new SnapshotMigrationError(
                'input.json',
                'Snapshot input is not valid JSON.',
                '$',
                {
                    cause: error,
                },
            );
        }
    } else {
        value = input;
    }
    inspectJsonValue(value, limits);
    const serialized = JSON.stringify(value);
    if (byteLength(serialized) > maxInputBytes) {
        throw new SnapshotMigrationError('input.bytes', 'Snapshot input is too large.');
    }
    return JSON.parse(serialized) as unknown;
}

function detectionValue(input: string | unknown): unknown {
    try {
        return cloneInput(input, {});
    } catch {
        return null;
    }
}

function hasSourceDiscriminator(value: unknown): value is Record<string, unknown> {
    if (!isRecord(value) || 'schema' in value || !Array.isArray(value.objects)) return false;
    const state = value._editorState;
    return (
        isRecord(state) &&
        isFiniteNumber(state.currentScale) &&
        isFiniteNumber(state.currentRotation) &&
        isFiniteNumber(state.baseImageScale)
    );
}

export function detectSnapshotVersion(input: string | unknown): SnapshotVersionDetection {
    const value = detectionValue(input);
    if (isRecord(value) && value.schema === 'image-editor.state') {
        return value.version === 3
            ? Object.freeze({ kind: 'current', schema: 'image-editor.state', version: 3 })
            : Object.freeze({
                  kind: 'unsupported',
                  schema: 'image-editor.state',
                  version: value.version,
              });
    }
    if (hasSourceDiscriminator(value)) {
        return Object.freeze({ kind: 'source', schema: SOURCE_SCHEMA, version: 2 });
    }
    return Object.freeze({ kind: 'unknown' });
}

function issue(context: ConversionContext, code: string, path: string, message: string): void {
    if (context.policy === 'error') throw new SnapshotMigrationError(code, message, path);
    context.onWarning?.(Object.freeze({ code, path, message }));
}

function rejectObject(
    context: ConversionContext,
    code: string,
    path: string,
    message: string,
): null {
    issue(context, code, path, message);
    return null;
}

function reportUnknownKeys(
    value: Record<string, unknown>,
    allowed: ReadonlySet<string>,
    path: string,
    context: ConversionContext,
): void {
    for (const key of Object.keys(value)) {
        if (!allowed.has(key)) {
            issue(
                context,
                'field.unsupported',
                `${path}.${key}`,
                `Unsupported persisted field "${key}" cannot be converted.`,
            );
        }
    }
}

function sanitizedFabricObject(value: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(value).filter(([key]) => !EDITOR_OBJECT_KEYS.has(key)),
    );
}

function objectType(value: Record<string, unknown>): string {
    return typeof value.type === 'string' ? value.type.toLowerCase() : '';
}

function requireSource(input: string | unknown, options: SnapshotConversionOptions) {
    const value = cloneInput(input, options);
    if (!hasSourceDiscriminator(value)) {
        const detection = detectSnapshotVersion(value);
        throw new SnapshotMigrationError(
            'schema.unsupported',
            detection.kind === 'current'
                ? 'Current Snapshots do not require conversion.'
                : 'Input is not a supported frozen maintenance Snapshot.',
        );
    }
    return value;
}

function sourceObjects(value: Record<string, unknown>): Record<string, unknown>[] {
    return (value.objects as unknown[]).map((object, index) => {
        if (!isRecord(object)) {
            throw new SnapshotMigrationError(
                'object.invalid',
                'Canvas objects must be plain records.',
                `$.objects[${index}]`,
            );
        }
        return object;
    });
}

function findBaseImage(
    objects: readonly Record<string, unknown>[],
): Record<string, unknown> | null {
    const explicit = objects.filter((object) => object.editorObjectKind === 'baseImage');
    if (explicit.length > 1) {
        throw new SnapshotMigrationError(
            'base.multiple',
            'Snapshot contains more than one Base Image.',
            '$.objects',
        );
    }
    if (explicit.length === 1) {
        const image = explicit[0]!;
        if (objectType(image) !== 'image') {
            throw new SnapshotMigrationError(
                'base.type',
                'The Base Image must be a Fabric Image.',
                '$.objects',
            );
        }
        return image;
    }
    const images = objects.filter((object) => objectType(object) === 'image');
    if (images.length > 1) {
        throw new SnapshotMigrationError(
            'base.ambiguous',
            'Snapshot has multiple unmarked Images and no unambiguous Base Image.',
            '$.objects',
        );
    }
    return images[0] ?? null;
}

function dimensions(
    source: Record<string, unknown>,
    options: SnapshotConversionOptions,
): Readonly<{ width: number; height: number }> {
    const sourceWidth = source.width;
    const sourceHeight = source.height;
    const fallback = options.canvasSize;
    const width = isFiniteNumber(sourceWidth) && sourceWidth > 0 ? sourceWidth : fallback?.width;
    const height =
        isFiniteNumber(sourceHeight) && sourceHeight > 0 ? sourceHeight : fallback?.height;
    if (!isFiniteNumber(width) || width <= 0 || !isFiniteNumber(height) || height <= 0) {
        throw new SnapshotMigrationError(
            'canvas.size',
            'Snapshot Canvas dimensions are missing; provide canvasSize explicitly.',
            '$',
        );
    }
    if (
        width > MAX_CANVAS_DIMENSION ||
        height > MAX_CANVAS_DIMENSION ||
        width * height > MAX_CANVAS_PIXELS
    ) {
        throw new SnapshotMigrationError(
            'canvas.size',
            'Snapshot Canvas dimensions exceed the public Snapshot limits.',
            '$',
        );
    }
    return Object.freeze({ width, height });
}

function transformState(state: Record<string, unknown>, base: Record<string, unknown> | null) {
    if (!isFiniteNumber(state.currentScale) || state.currentScale <= 0) {
        throw new SnapshotMigrationError(
            'transform.scale',
            'Snapshot scale must be positive and finite.',
            '$._editorState.currentScale',
        );
    }
    if (!isFiniteNumber(state.currentRotation)) {
        throw new SnapshotMigrationError(
            'transform.rotation',
            'Snapshot rotation must be finite.',
            '$._editorState.currentRotation',
        );
    }
    return Object.freeze({
        scale: state.currentScale,
        rotationDegrees: state.currentRotation,
        flipX: base?.flipX === true,
        flipY: base?.flipY === true,
    });
}

function imageMimeType(
    state: Record<string, unknown>,
    context: ConversionContext,
): 'image/jpeg' | 'image/png' | 'image/webp' | null {
    const value = state.currentImageMimeType;
    if (value === undefined || value === null) return null;
    if (value === 'image/jpeg' || value === 'image/png' || value === 'image/webp') return value;
    issue(
        context,
        'image.mime',
        '$._editorState.currentImageMimeType',
        'Unsupported image MIME metadata was skipped.',
    );
    return null;
}

function filterDefinitions(
    state: Record<string, unknown>,
    base: Record<string, unknown> | null,
    context: ConversionContext,
): readonly Readonly<Record<string, unknown>>[] {
    const raw = state.imageFilterConfig;
    if (raw === undefined) {
        if (Array.isArray(base?.filters) && base.filters.length > 0) {
            issue(
                context,
                'filter.fabric',
                '$.objects.filters',
                'Fabric filter payload has no authoritative editor filter configuration.',
            );
        }
        return Object.freeze([]);
    }
    if (!isRecord(raw)) {
        issue(
            context,
            'filter.config',
            '$._editorState.imageFilterConfig',
            'Image filter configuration is malformed.',
        );
        return Object.freeze([]);
    }
    reportUnknownKeys(raw, new Set(FILTER_KEYS), '$._editorState.imageFilterConfig', context);
    const definitions: Readonly<Record<string, unknown>>[] = [];
    for (const key of FILTER_KEYS) {
        const value = raw[key];
        if (key === 'grayscale' || key === 'sepia' || key === 'vintage') {
            if (value === undefined || value === false) continue;
            if (value === true) definitions.push(Object.freeze({ type: key }));
            else
                issue(
                    context,
                    'filter.value',
                    `$._editorState.imageFilterConfig.${key}`,
                    `Filter "${key}" must be boolean.`,
                );
            continue;
        }
        if (value === undefined || value === 0) continue;
        const minimum = key === 'blur' || key === 'sharpen' ? 0 : -1;
        if (!isFiniteNumber(value) || value < minimum || value > 1) {
            issue(
                context,
                'filter.value',
                `$._editorState.imageFilterConfig.${key}`,
                `Filter "${key}" is outside its supported range.`,
            );
            continue;
        }
        definitions.push(Object.freeze({ type: key, value }));
    }
    return Object.freeze(definitions);
}

function overlayId(value: unknown): value is string {
    return typeof value === 'string' && ID_PATTERN.test(value);
}

function maskRecord(
    object: Record<string, unknown>,
    index: number,
    context: ConversionContext,
): SerializedOverlayRecord | null {
    const path = `$.objects[${index}]`;
    if (!Number.isSafeInteger(object.maskId) || Number(object.maskId) <= 0) {
        return rejectObject(context, 'mask.id', path, 'Mask identifier is invalid.');
    }
    if (!overlayId(object.maskUid)) {
        return rejectObject(context, 'mask.uid', path, 'Mask persistent identifier is invalid.');
    }
    if (typeof object.maskName !== 'string') {
        return rejectObject(context, 'mask.name', path, 'Mask name is invalid.');
    }
    const originalAlpha = isFiniteNumber(object.originalAlpha)
        ? object.originalAlpha
        : isFiniteNumber(object.opacity)
          ? object.opacity
          : 0.5;
    const serialized = sanitizedFabricObject(object);
    let overlayMetadata: Readonly<Record<string, unknown>> | undefined;
    if (object.overlayMetadata !== undefined) {
        if (isRecord(object.overlayMetadata)) {
            overlayMetadata = Object.freeze({ ...object.overlayMetadata });
        } else {
            issue(
                context,
                'mask.metadata',
                `${path}.overlayMetadata`,
                'Mask metadata was skipped because it is not an object.',
            );
        }
    }
    const data = Object.freeze({
        object: serialized,
        maskId: Number(object.maskId),
        maskUid: object.maskUid,
        maskName: object.maskName,
        originalAlpha,
        ...(Object.prototype.hasOwnProperty.call(object, 'originalStroke')
            ? { originalStroke: object.originalStroke }
            : {}),
        ...(isFiniteNumber(object.originalStrokeWidth)
            ? { originalStrokeWidth: object.originalStrokeWidth }
            : {}),
        ...(typeof object.overlayPersistentId === 'string'
            ? { overlayPersistentId: object.overlayPersistentId }
            : {}),
        ...(overlayMetadata ? { overlayMetadata } : {}),
    });
    return Object.freeze({
        kind: 'mask:object',
        persistentId: object.maskUid,
        hidden: object.visible === false,
        locked: false,
        codec: Object.freeze({ type: 'mask:object', version: '1.0.0' }),
        data,
    });
}

function pathPoints(value: unknown): readonly Readonly<{ x: number; y: number }>[] {
    if (!Array.isArray(value)) return Object.freeze([]);
    const points: Readonly<{ x: number; y: number }>[] = [];
    for (const segment of value) {
        if (!Array.isArray(segment) || typeof segment[0] !== 'string') continue;
        const command = segment[0].toUpperCase();
        if (!['M', 'L', 'T', 'Q', 'S', 'C'].includes(command)) continue;
        const x = segment[segment.length - 2];
        const y = segment[segment.length - 1];
        if (!isFiniteNumber(x) || !isFiniteNumber(y)) continue;
        const previous = points[points.length - 1];
        if (!previous || previous.x !== x || previous.y !== y) {
            points.push(Object.freeze({ x, y }));
        }
    }
    return Object.freeze(points);
}

function shapeGeometry(
    object: Record<string, unknown>,
    kind: 'rect' | 'line' | 'arrow',
    path: string,
): Readonly<Record<string, unknown>> {
    if (kind === 'rect') {
        if (
            !isFiniteNumber(object.left) ||
            !isFiniteNumber(object.top) ||
            !isFiniteNumber(object.width) ||
            object.width <= 0 ||
            !isFiniteNumber(object.height) ||
            object.height <= 0
        ) {
            throw new SnapshotMigrationError(
                'annotation.geometry',
                'Rectangle geometry is invalid.',
                path,
            );
        }
        return Object.freeze({
            kind,
            left: object.left,
            top: object.top,
            width: object.width,
            height: object.height,
        });
    }
    let start: Readonly<{ x: number; y: number }> | undefined;
    let end: Readonly<{ x: number; y: number }> | undefined;
    if (kind === 'line') {
        if (
            isFiniteNumber(object.x1) &&
            isFiniteNumber(object.y1) &&
            isFiniteNumber(object.x2) &&
            isFiniteNumber(object.y2)
        ) {
            start = Object.freeze({ x: object.x1, y: object.y1 });
            end = Object.freeze({ x: object.x2, y: object.y2 });
        }
    } else {
        const points = pathPoints(object.path);
        start = points[0];
        end = points[points.length - 1];
    }
    if (!start || !end || Math.hypot(end.x - start.x, end.y - start.y) < 0.5) {
        throw new SnapshotMigrationError(
            'annotation.geometry',
            'Linear geometry is invalid.',
            path,
        );
    }
    return Object.freeze({ kind, start, end });
}

function interactionValue(
    object: Record<string, unknown>,
    key: string,
    fallback: boolean,
    path: string,
    context: ConversionContext,
): boolean {
    const value = object[key];
    if (value === undefined) return fallback;
    if (typeof value === 'boolean') return value;
    issue(
        context,
        'annotation.interaction',
        `${path}.${key}`,
        `Interaction field "${key}" was skipped.`,
    );
    return fallback;
}

function annotationRecord(
    object: Record<string, unknown>,
    index: number,
    context: ConversionContext,
): SerializedOverlayRecord | null {
    const path = `$.objects[${index}]`;
    if (!Number.isSafeInteger(object.annotationId) || Number(object.annotationId) <= 0) {
        return rejectObject(context, 'annotation.id', path, 'Annotation identifier is invalid.');
    }
    if (
        object.annotationType !== 'text' &&
        object.annotationType !== 'shape' &&
        object.annotationType !== 'draw'
    ) {
        return rejectObject(context, 'annotation.type', path, 'Annotation type is unsupported.');
    }
    if (typeof object.annotationName !== 'string') {
        return rejectObject(context, 'annotation.name', path, 'Annotation name is invalid.');
    }
    const kind = `annotation:${object.annotationType}`;
    const generatedId = `${kind}:${Number(object.annotationId)}`;
    const persistentId = overlayId(object.overlayPersistentId)
        ? object.overlayPersistentId
        : generatedId;
    if (!overlayId(persistentId)) {
        return rejectObject(
            context,
            'annotation.persistentId',
            path,
            'Annotation persistent identifier is invalid.',
        );
    }
    let metadata: Readonly<Record<string, unknown>> = Object.freeze({});
    if (object.overlayMetadata !== undefined) {
        if (isRecord(object.overlayMetadata))
            metadata = Object.freeze({ ...object.overlayMetadata });
        else
            issue(
                context,
                'annotation.metadata',
                `${path}.overlayMetadata`,
                'Annotation metadata was skipped because it is not an object.',
            );
    }
    const interaction = Object.freeze({
        selectable: interactionValue(
            object,
            'annotationSelectable',
            object.selectable !== false,
            path,
            context,
        ),
        evented: interactionValue(
            object,
            'annotationEvented',
            object.evented !== false,
            path,
            context,
        ),
        hasControls: interactionValue(
            object,
            'annotationHasControls',
            object.hasControls !== false,
            path,
            context,
        ),
        ...(object.annotationType === 'text'
            ? {
                  editable: interactionValue(
                      object,
                      'annotationEditable',
                      object.editable !== false,
                      path,
                      context,
                  ),
              }
            : {}),
    });
    const serialized = sanitizedFabricObject(object);
    let codecType: string;
    let feature: unknown;
    if (object.annotationType === 'text') {
        if (
            objectType(serialized) !== 'textbox' ||
            typeof serialized.text !== 'string' ||
            !isFiniteNumber(serialized.left) ||
            !isFiniteNumber(serialized.top) ||
            !isFiniteNumber(serialized.width) ||
            !isFiniteNumber(serialized.fontSize)
        ) {
            return rejectObject(
                context,
                'annotation.text',
                path,
                'Text Annotation payload is invalid.',
            );
        }
        codecType = 'annotation:textbox';
        feature = serialized;
    } else if (object.annotationType === 'shape') {
        const shapeKind =
            object.shapeAnnotationKind === 'line' || object.shapeAnnotationKind === 'arrow'
                ? object.shapeAnnotationKind
                : 'rect';
        const expectedType = shapeKind === 'arrow' ? 'path' : shapeKind;
        if (objectType(serialized) !== expectedType) {
            return rejectObject(
                context,
                'annotation.shape',
                path,
                'Shape Annotation payload is invalid.',
            );
        }
        codecType = 'annotation:shape-object';
        try {
            feature = Object.freeze({
                version: 1,
                shapeKind,
                geometry: shapeGeometry(serialized, shapeKind, path),
                object: serialized,
            });
        } catch (error) {
            if (error instanceof SnapshotMigrationError && context.policy === 'warn-and-skip') {
                context.onWarning?.(
                    Object.freeze({ code: error.code, path: error.path, message: error.message }),
                );
                return null;
            }
            throw error;
        }
    } else {
        const points = pathPoints(serialized.path);
        if (objectType(serialized) !== 'path' || points.length < 2) {
            return rejectObject(
                context,
                'annotation.draw',
                path,
                'Draw Annotation payload is invalid.',
            );
        }
        codecType = 'annotation:draw-path';
        feature = Object.freeze({ version: 1, points, object: serialized });
    }
    return Object.freeze({
        kind,
        persistentId,
        hidden: object.annotationHidden === true || object.visible === false,
        locked: object.annotationLocked === true,
        codec: Object.freeze({ type: codecType, version: '1.0.0' }),
        data: Object.freeze({
            version: 1,
            name: object.annotationName,
            metadata,
            interaction,
            feature,
        }),
    });
}

function selectionIds(
    state: Record<string, unknown>,
    maskIds: ReadonlyMap<number, string>,
    annotationIds: ReadonlyMap<number, string>,
    context: ConversionContext,
): readonly string[] {
    const ids: string[] = [];
    if (state.activeObjectKind === 'mask' && Number.isSafeInteger(state.activeMaskId)) {
        const id = maskIds.get(Number(state.activeMaskId));
        if (id) ids.push(id);
        else
            issue(
                context,
                'selection.missing',
                '$._editorState.activeMaskId',
                'Selected Mask was not present in the converted overlays.',
            );
    } else if (
        state.activeObjectKind === 'annotation' &&
        Number.isSafeInteger(state.activeAnnotationId)
    ) {
        const id = annotationIds.get(Number(state.activeAnnotationId));
        if (id) ids.push(id);
        else
            issue(
                context,
                'selection.missing',
                '$._editorState.activeAnnotationId',
                'Selected Annotation was not present in the converted overlays.',
            );
    } else if (
        state.activeObjectKind !== undefined &&
        state.activeObjectKind !== null &&
        state.activeObjectKind !== 'mask' &&
        state.activeObjectKind !== 'annotation'
    ) {
        issue(
            context,
            'selection.kind',
            '$._editorState.activeObjectKind',
            'Unsupported active object state was skipped.',
        );
    }
    return Object.freeze(ids);
}

export function migrateV2Snapshot(
    input: string | unknown,
    options: SnapshotConversionOptions = {},
): EditorSnapshot {
    const source = requireSource(input, options);
    const context: ConversionContext = {
        policy: options.unsupportedFieldPolicy ?? 'error',
        onWarning: options.onWarning,
    };
    reportUnknownKeys(source, TOP_LEVEL_KEYS, '$', context);
    const state = source._editorState as Record<string, unknown>;
    reportUnknownKeys(state, EDITOR_STATE_KEYS, '$._editorState', context);
    const size = dimensions(source, options);
    const objects = sourceObjects(source);
    const base = findBaseImage(objects);
    if (!isFiniteNumber(state.baseImageScale) || state.baseImageScale <= 0) {
        throw new SnapshotMigrationError(
            'base.scale',
            'Base Image scale must be positive and finite.',
            '$._editorState.baseImageScale',
        );
    }
    const overlays: SerializedOverlayRecord[] = [];
    const maskIds = new Map<number, string>();
    const annotationIds = new Map<number, string>();
    let maxMaskId = 0;
    for (let index = 0; index < objects.length; index += 1) {
        const object = objects[index]!;
        if (object === base) continue;
        let record: SerializedOverlayRecord | null = null;
        if (object.editorObjectKind === 'mask' || Number.isSafeInteger(object.maskId)) {
            record = maskRecord(object, index, context);
            if (record) {
                const id = Number(object.maskId);
                maskIds.set(id, record.persistentId);
                maxMaskId = Math.max(maxMaskId, id);
            }
        } else if (
            object.editorObjectKind === 'annotation' ||
            Number.isSafeInteger(object.annotationId)
        ) {
            record = annotationRecord(object, index, context);
            if (record) annotationIds.set(Number(object.annotationId), record.persistentId);
        } else {
            rejectObject(
                context,
                object.editorObjectKind === 'session' ||
                    object.isCropRect === true ||
                    object.maskLabel === true ||
                    object.isMosaicPreview === true
                    ? 'object.transient'
                    : 'object.unsupported',
                `$.objects[${index}]`,
                'Unsupported Canvas object was skipped.',
            );
        }
        if (record) overlays.push(record);
    }
    const persistentIds = overlays.map((record) => record.persistentId);
    if (new Set(persistentIds).size !== persistentIds.length) {
        throw new SnapshotMigrationError(
            'overlay.duplicate',
            'Converted overlays contain duplicate persistent identifiers.',
            '$.objects',
        );
    }
    if (!base && overlays.length > 0) {
        throw new SnapshotMigrationError(
            'base.missing',
            'Overlay state cannot be converted without a Base Image.',
            '$.objects',
        );
    }
    const filters = filterDefinitions(state, base, context);
    const canvasObject = base
        ? Object.freeze({
              ...sanitizedFabricObject(base),
              editorObjectKind: 'baseImage',
              filters: Object.freeze([]),
          })
        : null;
    const canvas = Object.freeze({
        ...(typeof source.version === 'string' ? { version: source.version } : {}),
        width: size.width,
        height: size.height,
        ...(Object.prototype.hasOwnProperty.call(source, 'background')
            ? { background: source.background }
            : {}),
        objects: Object.freeze(canvasObject ? [canvasObject] : []),
    });
    const plugins: Record<string, { readonly version: number; readonly data: unknown }> = {
        'plugin:transform': Object.freeze({ version: 1, data: transformState(state, base) }),
    };
    if (overlays.length > 0) {
        plugins['foundation:overlay'] = Object.freeze({
            version: 1,
            data: Object.freeze({
                version: 1,
                overlays: Object.freeze(overlays),
                selectionIds: selectionIds(state, maskIds, annotationIds, context),
            }),
        });
    }
    if (maxMaskId > 0) {
        plugins['plugin:mask'] = Object.freeze({
            version: 1,
            data: Object.freeze({ counter: maxMaskId }),
        });
    }
    if (filters.length > 0) {
        plugins['plugin:filters'] = Object.freeze({
            version: 1,
            data: Object.freeze({
                schema: 'image-editor.filters',
                version: 1,
                filters,
            }),
        });
    }
    return Object.freeze({
        schema: 'image-editor.state',
        version: 3,
        core: Object.freeze({
            initialized: true,
            canvasWidth: size.width,
            canvasHeight: size.height,
            canvas,
            imageMimeType: imageMimeType(state, context),
            baseImageScale: state.baseImageScale,
            geometryRevision: 0,
        }),
        plugins: Object.freeze(plugins),
    });
}

export function v2SnapshotMigration(options: SnapshotConversionOptions = {}): SnapshotMigration {
    const conversionOptions = Object.freeze({
        ...options,
        ...(options.canvasSize ? { canvasSize: Object.freeze({ ...options.canvasSize }) } : {}),
    });
    return Object.freeze({
        sourceSchema: SOURCE_SCHEMA,
        targetSchema: TARGET_SCHEMA,
        canMigrate: (input: unknown) => detectSnapshotVersion(input).kind === 'source',
        migrate: (input: unknown, context: SnapshotMigrationContext) => {
            context.signal?.throwIfAborted();
            const snapshot = migrateV2Snapshot(input, conversionOptions);
            context.signal?.throwIfAborted();
            return snapshot;
        },
    });
}

export async function loadV2Snapshot(
    editor: ImageEditorCore,
    input: string | unknown,
    options: SnapshotMigrationLoadOptions = {},
): Promise<void> {
    const { missingPluginPolicy = 'error', signal, ...conversionOptions } = options;
    await editor.loadFromState(input, {
        missingPluginPolicy,
        signal,
        migrations: [v2SnapshotMigration(conversionOptions)],
    });
}
