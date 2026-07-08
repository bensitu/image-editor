/**
 * Defensive validator for the public overlay-state wire format.
 *
 * Import accepts unknown input, so every field is checked before runtime
 * objects are constructed. The validator returns a normalized overlay-state
 * schema version 1 payload with accepted color strings canonicalized to
 * #RRGGBB or #RRGGBBAA.
 *
 * @module
 */

import { tryNormalizeOverlayColor } from './overlay-color.js';
import { getOverlaySerializer } from './overlay-custom-registry.js';
import { migrateOverlayState } from './overlay-state-migration.js';
import {
    validateOverlayMetadata,
    DEFAULT_METADATA_BYTES,
    DEFAULT_METADATA_DEPTH,
} from './overlay-metadata.js';
import type {
    OverlayBaseImageTransform,
    OverlayImageInfo,
    OverlayImportWarning,
    OverlayMetadata,
    OverlayState,
    OverlayValidationError,
    OverlayValidationOptions,
    OverlayValidationResult,
    SerializedCustomOverlay,
    SerializedDrawAnnotationOverlay,
    SerializedDrawBrush,
    SerializedDrawPoint,
    SerializedDrawStroke,
    SerializedMaskOverlay,
    SerializedOverlay,
    SerializedShapeAnnotationOverlay,
    SerializedTextAnnotationOverlay,
} from './overlay-state-types.js';

export interface ResolvedOverlayValidationLimits {
    maxOverlays: number;
    maxPolygonPoints: number;
    maxDrawStrokes: number;
    maxDrawPointsPerStroke: number;
    maxDrawTotalPoints: number;
    maxTextLength: number;
    maxMetadataDepth: number;
    maxMetadataBytes: number;
}

export const DEFAULT_OVERLAY_VALIDATION_LIMITS: ResolvedOverlayValidationLimits = Object.freeze({
    maxOverlays: 500,
    maxPolygonPoints: 1000,
    maxDrawStrokes: 500,
    maxDrawPointsPerStroke: 5000,
    maxDrawTotalPoints: 100000,
    maxTextLength: 10000,
    maxMetadataDepth: DEFAULT_METADATA_DEPTH,
    maxMetadataBytes: DEFAULT_METADATA_BYTES,
});

interface ValidationContext {
    limits: ResolvedOverlayValidationLimits;
    errors: OverlayValidationError[];
    warnings: OverlayImportWarning[];
    drawTotalPoints: number;
}

function resolveLimits(options: OverlayValidationOptions = {}): ResolvedOverlayValidationLimits {
    const positive = (value: number | undefined, fallback: number): number =>
        Number.isFinite(value) && Number(value) > 0 ? Math.floor(Number(value)) : fallback;
    return {
        maxOverlays: positive(options.maxOverlays, DEFAULT_OVERLAY_VALIDATION_LIMITS.maxOverlays),
        maxPolygonPoints: positive(
            options.maxPolygonPoints,
            DEFAULT_OVERLAY_VALIDATION_LIMITS.maxPolygonPoints,
        ),
        maxDrawStrokes: positive(
            options.maxDrawStrokes,
            DEFAULT_OVERLAY_VALIDATION_LIMITS.maxDrawStrokes,
        ),
        maxDrawPointsPerStroke: positive(
            options.maxDrawPointsPerStroke,
            DEFAULT_OVERLAY_VALIDATION_LIMITS.maxDrawPointsPerStroke,
        ),
        maxDrawTotalPoints: positive(
            options.maxDrawTotalPoints,
            DEFAULT_OVERLAY_VALIDATION_LIMITS.maxDrawTotalPoints,
        ),
        maxTextLength: positive(
            options.maxTextLength,
            DEFAULT_OVERLAY_VALIDATION_LIMITS.maxTextLength,
        ),
        maxMetadataDepth: positive(
            options.maxMetadataDepth,
            DEFAULT_OVERLAY_VALIDATION_LIMITS.maxMetadataDepth,
        ),
        maxMetadataBytes: positive(
            options.maxMetadataBytes,
            DEFAULT_OVERLAY_VALIDATION_LIMITS.maxMetadataBytes,
        ),
    };
}

function addError(context: ValidationContext, path: string, code: string, message: string): void {
    context.errors.push({ path, code, message });
}

function addWarning(
    context: ValidationContext,
    path: string,
    code: string,
    message: string,
    details?: Record<string, unknown>,
): void {
    context.warnings.push({ path, code, message, ...(details ? { details } : {}) });
}

function hasCycle(value: unknown, seen = new WeakSet<object>()): boolean {
    if (!value || typeof value !== 'object') return false;
    if (seen.has(value)) return true;
    seen.add(value);
    if (Array.isArray(value)) return value.some((entry) => hasCycle(entry, seen));
    return Object.values(value as Record<string, unknown>).some((entry) => hasCycle(entry, seen));
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function finite(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function readFinite(
    context: ValidationContext,
    object: Record<string, unknown>,
    key: string,
    path: string,
    options: { required?: boolean; min?: number; max?: number } = {},
): number | undefined {
    const value = object[key];
    if (value === undefined) {
        if (options.required) addError(context, path, 'number.required', `${path} is required.`);
        return undefined;
    }
    if (!finite(value)) {
        addError(context, path, 'number.invalid', `${path} must be a finite number.`);
        return undefined;
    }
    if (options.min !== undefined && value < options.min) {
        addError(context, path, 'number.min', `${path} must be >= ${options.min}.`);
    }
    if (options.max !== undefined && value > options.max) {
        addError(context, path, 'number.max', `${path} must be <= ${options.max}.`);
    }
    return value;
}

function readNormalized(
    context: ValidationContext,
    object: Record<string, unknown>,
    key: string,
    path: string,
    required = true,
): number | undefined {
    return readFinite(context, object, key, path, {
        required,
        min: 0,
        max: 1,
    });
}

function readBoolean(
    context: ValidationContext,
    object: Record<string, unknown>,
    key: string,
    path: string,
): boolean | undefined {
    const value = object[key];
    if (value === undefined) return undefined;
    if (typeof value !== 'boolean') {
        addError(context, path, 'boolean.invalid', `${path} must be a boolean.`);
        return undefined;
    }
    return value;
}

function readString(
    context: ValidationContext,
    object: Record<string, unknown>,
    key: string,
    path: string,
    required = false,
): string | undefined {
    const value = object[key];
    if (value === undefined) {
        if (required) addError(context, path, 'string.required', `${path} is required.`);
        return undefined;
    }
    if (typeof value !== 'string') {
        addError(context, path, 'string.invalid', `${path} must be a string.`);
        return undefined;
    }
    return value;
}

function normalizeColorField(
    context: ValidationContext,
    value: unknown,
    path: string,
    required: boolean,
): `#${string}` | undefined {
    if (value === undefined || value === null) {
        if (required) addError(context, path, 'color.required', `${path} is required.`);
        return undefined;
    }
    const normalized = tryNormalizeOverlayColor(value);
    if (!normalized) {
        addError(
            context,
            path,
            'color.invalid',
            `${path} must be #RRGGBB, #RRGGBBAA, rgb(), or rgba().`,
        );
        return undefined;
    }
    return normalized;
}

function normalizeDashArray(
    context: ValidationContext,
    value: unknown,
    path: string,
): number[] | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (!Array.isArray(value)) {
        addError(context, path, 'dash.invalid', `${path} must be an array or null.`);
        return undefined;
    }
    const output: number[] = [];
    value.forEach((entry, index) => {
        if (!finite(entry) || entry < 0) {
            addError(
                context,
                `${path}[${index}]`,
                'dash.invalidEntry',
                'Dash entries must be non-negative finite numbers.',
            );
            return;
        }
        output.push(entry);
    });
    return output;
}

function normalizeMetadata(
    context: ValidationContext,
    value: unknown,
    path: string,
): OverlayMetadata | undefined {
    const result = validateOverlayMetadata(value, path, {
        maxMetadataDepth: context.limits.maxMetadataDepth,
        maxMetadataBytes: context.limits.maxMetadataBytes,
    });
    context.errors.push(...result.errors);
    context.warnings.push(...result.warnings);
    return result.value;
}

function normalizeOverlayId(context: ValidationContext, value: unknown, path: string): string {
    if (typeof value !== 'string' || value.trim() === '') {
        addError(context, path, 'overlay.id.invalid', `${path} must be a non-empty string.`);
        return '';
    }
    if (value.length > 256 || !/^[A-Za-z0-9._:-]+$/.test(value)) {
        addError(
            context,
            path,
            'overlay.id.unsupported',
            `${path} contains unsupported characters.`,
        );
    }
    return value;
}

function normalizeBaseOverlay(
    context: ValidationContext,
    overlay: Record<string, unknown>,
    path: string,
): {
    id: string;
    overlayVersion?: number;
    hidden?: boolean;
    metadata?: OverlayMetadata;
} {
    const id = normalizeOverlayId(context, overlay.id, `${path}.id`);
    const version = overlay.overlayVersion;
    let overlayVersion: number | undefined;
    if (version !== undefined) {
        if (!Number.isInteger(version) || Number(version) <= 0) {
            addError(
                context,
                `${path}.overlayVersion`,
                'overlay.version.invalid',
                'overlayVersion must be a positive integer.',
            );
        } else {
            overlayVersion = Number(version);
        }
    }
    const hidden = readBoolean(context, overlay, 'hidden', `${path}.hidden`);
    const metadata = normalizeMetadata(context, overlay.metadata, `${path}.metadata`);
    return {
        id,
        ...(overlayVersion !== undefined ? { overlayVersion } : {}),
        ...(hidden !== undefined ? { hidden } : {}),
        ...(metadata !== undefined ? { metadata } : {}),
    };
}

function validateImageInfo(
    context: ValidationContext,
    value: unknown,
): OverlayImageInfo | undefined {
    if (!isRecord(value)) {
        addError(context, 'image', 'image.invalid', 'image must be an object.');
        return undefined;
    }
    const naturalWidth = readFinite(context, value, 'naturalWidth', 'image.naturalWidth', {
        required: true,
        min: 1,
    });
    const naturalHeight = readFinite(context, value, 'naturalHeight', 'image.naturalHeight', {
        required: true,
        min: 1,
    });
    const mimeType = value.mimeType;
    const orientation = value.orientation;
    const sourceId = readString(context, value, 'sourceId', 'image.sourceId');
    const checksum = readString(context, value, 'checksum', 'image.checksum');

    if (
        mimeType !== undefined &&
        mimeType !== 'image/jpeg' &&
        mimeType !== 'image/png' &&
        mimeType !== 'image/webp'
    ) {
        addError(
            context,
            'image.mimeType',
            'image.mimeType.invalid',
            'Unsupported image MIME type.',
        );
    }
    if (orientation !== undefined && ![1, 2, 3, 4, 5, 6, 7, 8].includes(orientation as number)) {
        addError(
            context,
            'image.orientation',
            'image.orientation.invalid',
            'EXIF orientation must be 1 through 8.',
        );
    }
    if (naturalWidth === undefined || naturalHeight === undefined) return undefined;
    return {
        naturalWidth,
        naturalHeight,
        ...(typeof mimeType === 'string'
            ? { mimeType: mimeType as OverlayImageInfo['mimeType'] }
            : {}),
        ...(typeof orientation === 'number'
            ? { orientation: orientation as OverlayImageInfo['orientation'] }
            : {}),
        ...(sourceId !== undefined ? { sourceId } : {}),
        ...(checksum !== undefined ? { checksum } : {}),
    };
}

function validateBaseImageTransform(
    context: ValidationContext,
    value: unknown,
): OverlayBaseImageTransform | undefined {
    if (value === undefined) return undefined;
    if (!isRecord(value)) {
        addError(
            context,
            'baseImageTransform',
            'baseTransform.invalid',
            'baseImageTransform must be an object.',
        );
        return undefined;
    }
    const rotation = readFinite(context, value, 'rotation', 'baseImageTransform.rotation', {
        required: false,
    });
    const flipX = readBoolean(context, value, 'flipX', 'baseImageTransform.flipX');
    const flipY = readBoolean(context, value, 'flipY', 'baseImageTransform.flipY');
    return {
        ...(rotation !== undefined ? { rotation } : {}),
        ...(flipX !== undefined ? { flipX } : {}),
        ...(flipY !== undefined ? { flipY } : {}),
    };
}

function validateMaskOverlay(
    context: ValidationContext,
    overlay: Record<string, unknown>,
    path: string,
): SerializedMaskOverlay | null {
    const base = normalizeBaseOverlay(context, overlay, path);
    const maskShape = overlay.maskShape;
    if (
        maskShape !== 'rect' &&
        maskShape !== 'circle' &&
        maskShape !== 'ellipse' &&
        maskShape !== 'polygon'
    ) {
        addError(context, `${path}.maskShape`, 'mask.shape.invalid', 'Unsupported mask shape.');
        return null;
    }
    if (!isRecord(overlay.geometry)) {
        addError(
            context,
            `${path}.geometry`,
            'mask.geometry.invalid',
            'Mask geometry must be an object.',
        );
        return null;
    }
    if (!isRecord(overlay.style)) {
        addError(context, `${path}.style`, 'mask.style.invalid', 'Mask style must be an object.');
        return null;
    }
    const geometry = overlay.geometry;
    let normalizedGeometry: SerializedMaskOverlay['geometry'] | null = null;
    if (maskShape === 'rect' && geometry.type === 'rect') {
        const x = readNormalized(context, geometry, 'x', `${path}.geometry.x`);
        const y = readNormalized(context, geometry, 'y', `${path}.geometry.y`);
        const width = readNormalized(context, geometry, 'width', `${path}.geometry.width`);
        const height = readNormalized(context, geometry, 'height', `${path}.geometry.height`);
        const rx = readNormalized(context, geometry, 'rx', `${path}.geometry.rx`, false);
        const ry = readNormalized(context, geometry, 'ry', `${path}.geometry.ry`, false);
        const angle = readFinite(context, geometry, 'angle', `${path}.geometry.angle`);
        if (x !== undefined && y !== undefined && width !== undefined && height !== undefined) {
            normalizedGeometry = {
                type: 'rect',
                x,
                y,
                width,
                height,
                ...(rx !== undefined ? { rx } : {}),
                ...(ry !== undefined ? { ry } : {}),
                ...(angle !== undefined ? { angle } : {}),
            };
        }
    } else if (maskShape === 'circle' && geometry.type === 'circle') {
        const cx = readNormalized(context, geometry, 'cx', `${path}.geometry.cx`);
        const cy = readNormalized(context, geometry, 'cy', `${path}.geometry.cy`);
        const radius = readNormalized(context, geometry, 'radius', `${path}.geometry.radius`);
        const angle = readFinite(context, geometry, 'angle', `${path}.geometry.angle`);
        if (cx !== undefined && cy !== undefined && radius !== undefined) {
            normalizedGeometry = {
                type: 'circle',
                cx,
                cy,
                radius,
                ...(angle !== undefined ? { angle } : {}),
            };
        }
    } else if (maskShape === 'ellipse' && geometry.type === 'ellipse') {
        const cx = readNormalized(context, geometry, 'cx', `${path}.geometry.cx`);
        const cy = readNormalized(context, geometry, 'cy', `${path}.geometry.cy`);
        const rx = readNormalized(context, geometry, 'rx', `${path}.geometry.rx`);
        const ry = readNormalized(context, geometry, 'ry', `${path}.geometry.ry`);
        const angle = readFinite(context, geometry, 'angle', `${path}.geometry.angle`);
        if (cx !== undefined && cy !== undefined && rx !== undefined && ry !== undefined) {
            normalizedGeometry = {
                type: 'ellipse',
                cx,
                cy,
                rx,
                ry,
                ...(angle !== undefined ? { angle } : {}),
            };
        }
    } else if (maskShape === 'polygon' && geometry.type === 'polygon') {
        if (!Array.isArray(geometry.points)) {
            addError(
                context,
                `${path}.geometry.points`,
                'mask.polygon.points.invalid',
                'Polygon points must be an array.',
            );
        } else if (geometry.points.length > context.limits.maxPolygonPoints) {
            addError(
                context,
                `${path}.geometry.points`,
                'mask.polygon.points.max',
                `Polygon has ${geometry.points.length} points, exceeding maxPolygonPoints ${context.limits.maxPolygonPoints}.`,
            );
        } else {
            const points = geometry.points.map((point, index) => {
                if (!isRecord(point)) {
                    addError(
                        context,
                        `${path}.geometry.points[${index}]`,
                        'mask.polygon.point.invalid',
                        'Polygon point must be an object.',
                    );
                    return { x: 0, y: 0 };
                }
                return {
                    x:
                        readNormalized(
                            context,
                            point,
                            'x',
                            `${path}.geometry.points[${index}].x`,
                        ) ?? 0,
                    y:
                        readNormalized(
                            context,
                            point,
                            'y',
                            `${path}.geometry.points[${index}].y`,
                        ) ?? 0,
                };
            });
            const angle = readFinite(context, geometry, 'angle', `${path}.geometry.angle`);
            normalizedGeometry = {
                type: 'polygon',
                points,
                ...(angle !== undefined ? { angle } : {}),
            };
        }
    } else {
        addError(
            context,
            `${path}.geometry.type`,
            'mask.geometry.typeMismatch',
            'Mask geometry type must match maskShape.',
        );
    }

    const style = overlay.style;
    const fill = normalizeColorField(context, style.fill, `${path}.style.fill`, true);
    const alpha = readFinite(context, style, 'alpha', `${path}.style.alpha`, {
        required: true,
        min: 0,
        max: 1,
    });
    const stroke =
        style.stroke === null
            ? null
            : normalizeColorField(context, style.stroke, `${path}.style.stroke`, false);
    const strokeWidth = readFinite(context, style, 'strokeWidth', `${path}.style.strokeWidth`, {
        min: 0,
    });
    const strokeDashArray = normalizeDashArray(
        context,
        style.strokeDashArray,
        `${path}.style.strokeDashArray`,
    );
    const selectable = readBoolean(context, style, 'selectable', `${path}.style.selectable`);
    const evented = readBoolean(context, style, 'evented', `${path}.style.evented`);
    const hasControls = readBoolean(context, style, 'hasControls', `${path}.style.hasControls`);

    if (!normalizedGeometry || !fill || alpha === undefined) return null;
    return {
        kind: 'mask',
        ...base,
        maskShape,
        geometry: normalizedGeometry,
        style: {
            fill,
            alpha,
            ...(stroke !== undefined ? { stroke } : {}),
            ...(strokeWidth !== undefined ? { strokeWidth } : {}),
            ...(strokeDashArray !== undefined ? { strokeDashArray } : {}),
            ...(selectable !== undefined ? { selectable } : {}),
            ...(evented !== undefined ? { evented } : {}),
            ...(hasControls !== undefined ? { hasControls } : {}),
        },
    };
}

function validateTextOverlay(
    context: ValidationContext,
    overlay: Record<string, unknown>,
    path: string,
): SerializedTextAnnotationOverlay | null {
    const base = normalizeBaseOverlay(context, overlay, path);
    if (!isRecord(overlay.geometry) || !isRecord(overlay.text) || !isRecord(overlay.style)) {
        addError(
            context,
            path,
            'text.invalid',
            'Text overlays require geometry, text, and style objects.',
        );
        return null;
    }
    const x = readNormalized(context, overlay.geometry, 'x', `${path}.geometry.x`);
    const y = readNormalized(context, overlay.geometry, 'y', `${path}.geometry.y`);
    const width = readNormalized(
        context,
        overlay.geometry,
        'width',
        `${path}.geometry.width`,
        false,
    );
    const angle = readFinite(context, overlay.geometry, 'angle', `${path}.geometry.angle`);
    const value = readString(context, overlay.text, 'value', `${path}.text.value`, true) ?? '';
    if (value.length > context.limits.maxTextLength) {
        addError(
            context,
            `${path}.text.value`,
            'text.maxLength',
            `Text length exceeds maxTextLength ${context.limits.maxTextLength}.`,
        );
    }
    const fontSize = readFinite(context, overlay.style, 'fontSize', `${path}.style.fontSize`, {
        min: 0,
    });
    const fontFamily = readString(context, overlay.style, 'fontFamily', `${path}.style.fontFamily`);
    const fontWeight = overlay.style.fontWeight;
    if (
        fontWeight !== undefined &&
        typeof fontWeight !== 'string' &&
        (typeof fontWeight !== 'number' || !Number.isFinite(fontWeight))
    ) {
        addError(
            context,
            `${path}.style.fontWeight`,
            'text.fontWeight.invalid',
            'fontWeight must be a string or finite number.',
        );
    }
    const fill = normalizeColorField(context, overlay.style.fill, `${path}.style.fill`, false);
    const backgroundColor = normalizeColorField(
        context,
        overlay.style.backgroundColor,
        `${path}.style.backgroundColor`,
        false,
    );
    const textAlign = overlay.style.textAlign;
    if (
        textAlign !== undefined &&
        textAlign !== 'left' &&
        textAlign !== 'center' &&
        textAlign !== 'right' &&
        textAlign !== 'justify'
    ) {
        addError(
            context,
            `${path}.style.textAlign`,
            'text.align.invalid',
            'Unsupported textAlign.',
        );
    }
    const lineHeight = readFinite(
        context,
        overlay.style,
        'lineHeight',
        `${path}.style.lineHeight`,
        { min: 0 },
    );
    const locked = readBoolean(context, overlay, 'locked', `${path}.locked`);
    if (x === undefined || y === undefined) return null;
    return {
        kind: 'annotation',
        annotationType: 'text',
        ...base,
        geometry: {
            x,
            y,
            ...(width !== undefined ? { width } : {}),
            ...(angle !== undefined ? { angle } : {}),
        },
        text: { value },
        style: {
            ...(fontSize !== undefined ? { fontSize } : {}),
            ...(fontFamily !== undefined ? { fontFamily } : {}),
            ...(fontWeight !== undefined ? { fontWeight: fontWeight as string | number } : {}),
            ...(fill !== undefined ? { fill } : {}),
            ...(backgroundColor !== undefined ? { backgroundColor } : {}),
            ...(typeof textAlign === 'string'
                ? { textAlign: textAlign as SerializedTextAnnotationOverlay['style']['textAlign'] }
                : {}),
            ...(lineHeight !== undefined ? { lineHeight } : {}),
        },
        ...(locked !== undefined ? { locked } : {}),
    };
}

function validateShapeOverlay(
    context: ValidationContext,
    overlay: Record<string, unknown>,
    path: string,
): SerializedShapeAnnotationOverlay | null {
    const base = normalizeBaseOverlay(context, overlay, path);
    const shape = overlay.shape;
    if (shape !== 'rect' && shape !== 'line' && shape !== 'arrow') {
        addError(context, `${path}.shape`, 'shape.invalid', 'Unsupported shape annotation kind.');
        return null;
    }
    if (!isRecord(overlay.geometry) || !isRecord(overlay.style)) {
        addError(
            context,
            path,
            'shape.invalidObjects',
            'Shape overlays require geometry and style objects.',
        );
        return null;
    }
    let geometry: SerializedShapeAnnotationOverlay['geometry'] | null = null;
    if (shape === 'rect' && overlay.geometry.type === 'rect') {
        const x = readNormalized(context, overlay.geometry, 'x', `${path}.geometry.x`);
        const y = readNormalized(context, overlay.geometry, 'y', `${path}.geometry.y`);
        const width = readNormalized(context, overlay.geometry, 'width', `${path}.geometry.width`);
        const height = readNormalized(
            context,
            overlay.geometry,
            'height',
            `${path}.geometry.height`,
        );
        const angle = readFinite(context, overlay.geometry, 'angle', `${path}.geometry.angle`);
        if (x !== undefined && y !== undefined && width !== undefined && height !== undefined) {
            geometry = {
                type: 'rect',
                x,
                y,
                width,
                height,
                ...(angle !== undefined ? { angle } : {}),
            };
        }
    } else if ((shape === 'line' || shape === 'arrow') && overlay.geometry.type === shape) {
        const x1 = readNormalized(context, overlay.geometry, 'x1', `${path}.geometry.x1`);
        const y1 = readNormalized(context, overlay.geometry, 'y1', `${path}.geometry.y1`);
        const x2 = readNormalized(context, overlay.geometry, 'x2', `${path}.geometry.x2`);
        const y2 = readNormalized(context, overlay.geometry, 'y2', `${path}.geometry.y2`);
        const angle = readFinite(context, overlay.geometry, 'angle', `${path}.geometry.angle`);
        if (x1 !== undefined && y1 !== undefined && x2 !== undefined && y2 !== undefined) {
            if (shape === 'line') {
                geometry = {
                    type: 'line',
                    x1,
                    y1,
                    x2,
                    y2,
                    ...(angle !== undefined ? { angle } : {}),
                };
            } else {
                const arrowHeadLength = readFinite(
                    context,
                    overlay.geometry,
                    'arrowHeadLength',
                    `${path}.geometry.arrowHeadLength`,
                    { min: 0 },
                );
                geometry = {
                    type: 'arrow',
                    x1,
                    y1,
                    x2,
                    y2,
                    ...(arrowHeadLength !== undefined ? { arrowHeadLength } : {}),
                    ...(angle !== undefined ? { angle } : {}),
                };
            }
        }
    } else {
        addError(
            context,
            `${path}.geometry.type`,
            'shape.geometry.typeMismatch',
            'Shape geometry type must match shape.',
        );
    }
    const stroke = normalizeColorField(
        context,
        overlay.style.stroke,
        `${path}.style.stroke`,
        false,
    );
    const strokeWidth = readFinite(
        context,
        overlay.style,
        'strokeWidth',
        `${path}.style.strokeWidth`,
        { min: 0 },
    );
    const fill = normalizeColorField(context, overlay.style.fill, `${path}.style.fill`, false);
    const opacity = readFinite(context, overlay.style, 'opacity', `${path}.style.opacity`, {
        min: 0,
        max: 1,
    });
    const strokeDashArray = normalizeDashArray(
        context,
        overlay.style.strokeDashArray,
        `${path}.style.strokeDashArray`,
    );
    const selectable = readBoolean(
        context,
        overlay.style,
        'selectable',
        `${path}.style.selectable`,
    );
    const evented = readBoolean(context, overlay.style, 'evented', `${path}.style.evented`);
    const locked = readBoolean(context, overlay, 'locked', `${path}.locked`);
    if (!geometry) return null;
    return {
        kind: 'annotation',
        annotationType: 'shape',
        ...base,
        shape,
        geometry,
        style: {
            ...(stroke !== undefined ? { stroke } : {}),
            ...(strokeWidth !== undefined ? { strokeWidth } : {}),
            ...(fill !== undefined ? { fill } : {}),
            ...(opacity !== undefined ? { opacity } : {}),
            ...(strokeDashArray !== undefined ? { strokeDashArray } : {}),
            ...(selectable !== undefined ? { selectable } : {}),
            ...(evented !== undefined ? { evented } : {}),
        },
        ...(locked !== undefined ? { locked } : {}),
    };
}

function normalizeDrawBrush(
    context: ValidationContext,
    value: unknown,
    path: string,
): SerializedDrawBrush | null {
    if (!isRecord(value)) {
        addError(context, path, 'draw.brush.invalid', 'Draw brush must be an object.');
        return null;
    }
    const color = normalizeColorField(context, value.color, `${path}.color`, true);
    const width = readFinite(context, value, 'width', `${path}.width`, { required: true, min: 0 });
    const opacity = readFinite(context, value, 'opacity', `${path}.opacity`, { min: 0, max: 1 });
    const lineCap = value.lineCap;
    const lineJoin = value.lineJoin;
    if (
        lineCap !== undefined &&
        lineCap !== 'butt' &&
        lineCap !== 'round' &&
        lineCap !== 'square'
    ) {
        addError(context, `${path}.lineCap`, 'draw.lineCap.invalid', 'Unsupported lineCap.');
    }
    if (
        lineJoin !== undefined &&
        lineJoin !== 'bevel' &&
        lineJoin !== 'round' &&
        lineJoin !== 'miter'
    ) {
        addError(context, `${path}.lineJoin`, 'draw.lineJoin.invalid', 'Unsupported lineJoin.');
    }
    if (!color || width === undefined) return null;
    return {
        color,
        width,
        ...(opacity !== undefined ? { opacity } : {}),
        ...(typeof lineCap === 'string' ? { lineCap: lineCap as CanvasLineCap } : {}),
        ...(typeof lineJoin === 'string' ? { lineJoin: lineJoin as CanvasLineJoin } : {}),
    };
}

function normalizeDrawPoint(
    context: ValidationContext,
    value: unknown,
    path: string,
): SerializedDrawPoint | null {
    if (!isRecord(value)) {
        addError(context, path, 'draw.point.invalid', 'Draw points must be objects.');
        return null;
    }
    const x = readNormalized(context, value, 'x', `${path}.x`);
    const y = readNormalized(context, value, 'y', `${path}.y`);
    const pressure = readFinite(context, value, 'pressure', `${path}.pressure`, { min: 0, max: 1 });
    const t = readFinite(context, value, 't', `${path}.t`, { min: 0 });
    if (x === undefined || y === undefined) return null;
    return {
        x,
        y,
        ...(pressure !== undefined ? { pressure } : {}),
        ...(t !== undefined ? { t } : {}),
    };
}

function validateDrawOverlay(
    context: ValidationContext,
    overlay: Record<string, unknown>,
    path: string,
): SerializedDrawAnnotationOverlay | null {
    const base = normalizeBaseOverlay(context, overlay, path);
    if (!Array.isArray(overlay.strokes)) {
        addError(
            context,
            `${path}.strokes`,
            'draw.strokes.invalid',
            'Draw strokes must be an array.',
        );
        return null;
    }
    if (overlay.strokes.length > context.limits.maxDrawStrokes) {
        addError(
            context,
            `${path}.strokes`,
            'draw.strokes.max',
            `Draw strokes exceed maxDrawStrokes ${context.limits.maxDrawStrokes}.`,
        );
        return null;
    }
    const strokes: SerializedDrawStroke[] = [];
    overlay.strokes.forEach((strokeValue, strokeIndex) => {
        const strokePath = `${path}.strokes[${strokeIndex}]`;
        if (!isRecord(strokeValue)) {
            addError(context, strokePath, 'draw.stroke.invalid', 'Draw stroke must be an object.');
            return;
        }
        const id = readString(context, strokeValue, 'id', `${strokePath}.id`);
        if (!Array.isArray(strokeValue.points)) {
            addError(
                context,
                `${strokePath}.points`,
                'draw.points.invalid',
                'Draw stroke points must be an array.',
            );
            return;
        }
        if (strokeValue.points.length > context.limits.maxDrawPointsPerStroke) {
            addError(
                context,
                `${strokePath}.points`,
                'draw.points.maxPerStroke',
                `Draw stroke exceeds maxDrawPointsPerStroke ${context.limits.maxDrawPointsPerStroke}.`,
            );
        }
        const points = strokeValue.points
            .map((point, pointIndex) =>
                normalizeDrawPoint(context, point, `${strokePath}.points[${pointIndex}]`),
            )
            .filter((point): point is SerializedDrawPoint => !!point);
        context.drawTotalPoints += points.length;
        if (context.drawTotalPoints > context.limits.maxDrawTotalPoints) {
            addError(
                context,
                `${strokePath}.points`,
                'draw.points.maxTotal',
                `Draw points exceed maxDrawTotalPoints ${context.limits.maxDrawTotalPoints}.`,
            );
        }
        let previousT = -Infinity;
        points.forEach((point, pointIndex) => {
            if (point.t === undefined) return;
            if (point.t < previousT) {
                addError(
                    context,
                    `${strokePath}.points[${pointIndex}].t`,
                    'draw.t.notMonotonic',
                    'Draw point t values must be monotonically non-decreasing.',
                );
            }
            previousT = point.t;
        });
        const brush = normalizeDrawBrush(context, strokeValue.brush, `${strokePath}.brush`);
        if (brush) strokes.push({ ...(id !== undefined ? { id } : {}), points, brush });
    });
    const locked = readBoolean(context, overlay, 'locked', `${path}.locked`);
    return {
        kind: 'annotation',
        annotationType: 'draw',
        ...base,
        strokes,
        ...(locked !== undefined ? { locked } : {}),
    };
}

function validateCustomOverlay(
    context: ValidationContext,
    overlay: Record<string, unknown>,
    path: string,
): SerializedCustomOverlay | null {
    const base = normalizeBaseOverlay(context, overlay, path);
    const customType = readString(context, overlay, 'customType', `${path}.customType`, true);
    if (
        customType &&
        !/^(builtin|app|plugin)\.[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/.test(customType)
    ) {
        addError(
            context,
            `${path}.customType`,
            'custom.type.invalid',
            'customType must be namespaced.',
        );
    }
    if (!isRecord(overlay.data)) {
        addError(
            context,
            `${path}.data`,
            'custom.data.invalid',
            'Custom overlay data must be an object.',
        );
        return null;
    }
    const metadataResult = validateOverlayMetadata(
        { 'app.customData': overlay.data },
        `${path}.data`,
        {
            maxMetadataDepth: context.limits.maxMetadataDepth,
            maxMetadataBytes: context.limits.maxMetadataBytes,
        },
    );
    context.errors.push(...metadataResult.errors);
    if (customType && !getOverlaySerializer(customType)) {
        addWarning(
            context,
            path,
            'custom.unknownType',
            `Custom overlay type "${customType}" has no registered importer and will be skipped.`,
            { customType },
        );
    }
    return customType
        ? {
              kind: 'custom',
              ...base,
              customType,
              data: JSON.parse(JSON.stringify(overlay.data)) as Record<string, unknown>,
          }
        : null;
}

function validateOverlay(
    context: ValidationContext,
    value: unknown,
    index: number,
): SerializedOverlay | null {
    const path = `overlays[${index}]`;
    if (!isRecord(value)) {
        addError(context, path, 'overlay.invalid', 'Overlay must be an object.');
        return null;
    }
    if (value.kind === 'mask') return validateMaskOverlay(context, value, path);
    if (value.kind === 'custom') return validateCustomOverlay(context, value, path);
    if (value.kind === 'annotation') {
        if (value.annotationType === 'text') return validateTextOverlay(context, value, path);
        if (value.annotationType === 'shape') return validateShapeOverlay(context, value, path);
        if (value.annotationType === 'draw') return validateDrawOverlay(context, value, path);
        addError(
            context,
            `${path}.annotationType`,
            'annotation.type.invalid',
            'Unsupported annotation type.',
        );
        return null;
    }
    addError(context, `${path}.kind`, 'overlay.kind.invalid', 'Unsupported overlay kind.');
    return null;
}

export function validateOverlayState(
    input: unknown,
    options: OverlayValidationOptions = {},
): OverlayValidationResult {
    const context: ValidationContext = {
        limits: resolveLimits(options),
        errors: [],
        warnings: [],
        drawTotalPoints: 0,
    };

    if (hasCycle(input)) {
        addError(context, '', 'state.cyclic', 'Overlay state must not contain cyclic objects.');
        return { valid: false, errors: context.errors, warnings: context.warnings };
    }

    const migration = migrateOverlayState(input);
    context.errors.push(...migration.errors);
    context.warnings.push(...migration.warnings);
    if (!migration.state || context.errors.length > 0) {
        return { valid: false, errors: context.errors, warnings: context.warnings };
    }

    const raw = migration.state as unknown as Record<string, unknown>;
    const image = validateImageInfo(context, raw.image);
    if (raw.coordinateSpace !== 'image-normalized') {
        addError(
            context,
            'coordinateSpace',
            'state.coordinateSpace.invalid',
            'coordinateSpace must be "image-normalized".',
        );
    }
    const baseImageTransform = validateBaseImageTransform(context, raw.baseImageTransform);
    if (!Array.isArray(raw.overlays)) {
        addError(context, 'overlays', 'overlays.invalid', 'overlays must be an array.');
    } else if (raw.overlays.length > context.limits.maxOverlays) {
        addError(
            context,
            'overlays',
            'overlays.max',
            `Overlay count ${raw.overlays.length} exceeds maxOverlays ${context.limits.maxOverlays}.`,
        );
    }
    const metadata = normalizeMetadata(context, raw.metadata, 'metadata');
    const overlays = Array.isArray(raw.overlays)
        ? raw.overlays
              .map((overlay, index) => validateOverlay(context, overlay, index))
              .filter((overlay): overlay is SerializedOverlay => !!overlay)
        : [];

    if (!image || context.errors.length > 0) {
        return { valid: false, errors: context.errors, warnings: context.warnings };
    }

    const state: OverlayState = {
        schema: 'image-editor.overlay-state',
        version: 1,
        image,
        coordinateSpace: 'image-normalized',
        ...(baseImageTransform !== undefined ? { baseImageTransform } : {}),
        overlays,
        ...(metadata !== undefined ? { metadata } : {}),
    };
    return { valid: true, state, errors: [], warnings: context.warnings };
}
