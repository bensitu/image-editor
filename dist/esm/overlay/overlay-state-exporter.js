import { canvasToSourcePixel, normalizeRotationDegrees, sourcePixelToImageNormalized, } from './overlay-coordinate-transform.js';
import { getPathPoints } from '../annotation/path-segments.js';
import { normalizeOverlayColor } from './overlay-color.js';
import { cloneOverlayMetadata } from './overlay-metadata.js';
import { isAnnotationObject, isDrawAnnotationObject, isEditableOverlayObject, isMaskObject, isShapeAnnotationObject, isTextAnnotationObject, } from '../core/public-types.js';
function finiteNumber(value, fallback = 0) {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
function clamp01(value) {
    if (!Number.isFinite(value))
        return 0;
    return Math.max(0, Math.min(1, value));
}
function normalizedPoint(point, geometry) {
    const source = canvasToSourcePixel(point, geometry);
    const normalized = sourcePixelToImageNormalized(source, {
        naturalWidth: geometry.naturalWidth,
        naturalHeight: geometry.naturalHeight,
    });
    return { x: clamp01(normalized.x), y: clamp01(normalized.y) };
}
function normalizedCanvasLengthX(length, geometry) {
    return clamp01(Math.abs(length / geometry.scaleX / geometry.naturalWidth));
}
function normalizedCanvasLengthY(length, geometry) {
    return clamp01(Math.abs(length / geometry.scaleY / geometry.naturalHeight));
}
function getObjectCenter(object) {
    var _a;
    const center = (_a = object.getCenterPoint) === null || _a === void 0 ? void 0 : _a.call(object);
    if (center)
        return { x: center.x, y: center.y };
    return {
        x: finiteNumber(object.left) + finiteNumber(object.width) / 2,
        y: finiteNumber(object.top) + finiteNumber(object.height) / 2,
    };
}
export function createCurrentImageGeometry(image, currentRotation) {
    const center = getObjectCenter(image);
    return {
        naturalWidth: Math.max(1, finiteNumber(image.width, 1)),
        naturalHeight: Math.max(1, finiteNumber(image.height, 1)),
        canvasCenterX: center.x,
        canvasCenterY: center.y,
        scaleX: Math.max(0.000001, Math.abs(finiteNumber(image.scaleX, 1))),
        scaleY: Math.max(0.000001, Math.abs(finiteNumber(image.scaleY, 1))),
        transform: {
            rotation: normalizeRotationDegrees(currentRotation),
            flipX: image.flipX === true,
            flipY: image.flipY === true,
        },
    };
}
function getBaseImageTransform(image, currentRotation) {
    const rotation = normalizeRotationDegrees(currentRotation);
    const flipX = image.flipX === true;
    const flipY = image.flipY === true;
    if (rotation === 0 && !flipX && !flipY)
        return undefined;
    return {
        ...(rotation !== 0 ? { rotation } : {}),
        ...(flipX ? { flipX } : {}),
        ...(flipY ? { flipY } : {}),
    };
}
function getImageInfo(image, mimeType) {
    return {
        naturalWidth: Math.max(1, finiteNumber(image.width, 1)),
        naturalHeight: Math.max(1, finiteNumber(image.height, 1)),
        ...(mimeType ? { mimeType } : {}),
        orientation: 1,
    };
}
function getPersistentId(object) {
    const persistent = object.overlayPersistentId;
    if (typeof persistent === 'string' && persistent.trim() !== '')
        return persistent;
    if (isMaskObject(object))
        return object.maskUid || `mask-${object.maskId}`;
    return `annotation-${object.annotationId}`;
}
function getPersistentMetadata(object, includeMetadata) {
    if (!includeMetadata)
        return undefined;
    const metadata = object.overlayMetadata;
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata))
        return undefined;
    return cloneOverlayMetadata(metadata);
}
function isHidden(object) {
    if (isAnnotationObject(object) && object.annotationHidden === true)
        return true;
    return object.visible === false;
}
function isLocked(object) {
    return isAnnotationObject(object) && object.annotationLocked === true;
}
function overlayBase(object, options) {
    const hidden = isHidden(object);
    const metadata = getPersistentMetadata(object, options.includeMetadata);
    return {
        id: getPersistentId(object),
        ...(hidden ? { hidden: true } : {}),
        ...(metadata ? { metadata } : {}),
    };
}
function localOverlayAngle(object, geometry) {
    var _a;
    const objectAngle = finiteNumber(object.angle);
    const baseRotation = normalizeRotationDegrees((_a = geometry.transform) === null || _a === void 0 ? void 0 : _a.rotation);
    const local = objectAngle - baseRotation;
    return Math.abs(local) < 0.000001 ? 0 : local;
}
function applyOptionalAngle(output, object, geometry) {
    const angle = localOverlayAngle(object, geometry);
    const target = output;
    if (angle !== 0)
        target.angle = angle;
    return target;
}
function exportMask(mask, geometry, options) {
    var _a, _b;
    const type = String((_a = mask.type) !== null && _a !== void 0 ? _a : '').toLowerCase();
    const base = overlayBase(mask, options);
    const fill = normalizeOverlayColor(mask.fill, '#000000');
    const alpha = clamp01(finiteNumber(mask.originalAlpha, finiteNumber(mask.opacity, 0.5)));
    const strokeSource = mask.originalStroke !== undefined ? mask.originalStroke : mask.stroke;
    const stroke = strokeSource === null
        ? null
        : strokeSource === undefined
            ? undefined
            : normalizeOverlayColor(strokeSource, '#000000');
    const strokeWidth = finiteNumber(mask.originalStrokeWidth, finiteNumber(mask.strokeWidth, 1));
    const style = {
        fill,
        alpha,
        ...(stroke !== undefined ? { stroke } : {}),
        strokeWidth,
        ...(Array.isArray(mask.strokeDashArray)
            ? { strokeDashArray: mask.strokeDashArray.map((entry) => finiteNumber(entry)) }
            : {}),
        ...(typeof mask.selectable === 'boolean' ? { selectable: mask.selectable } : {}),
        ...(typeof mask.evented === 'boolean' ? { evented: mask.evented } : {}),
        ...(typeof mask.hasControls === 'boolean' ? { hasControls: mask.hasControls } : {}),
    };
    if (type === 'rect') {
        const point = normalizedPoint({ x: finiteNumber(mask.left), y: finiteNumber(mask.top) }, geometry);
        return {
            kind: 'mask',
            ...base,
            maskShape: 'rect',
            geometry: applyOptionalAngle({
                type: 'rect',
                x: point.x,
                y: point.y,
                width: normalizedCanvasLengthX(finiteNumber(mask.width) * finiteNumber(mask.scaleX, 1), geometry),
                height: normalizedCanvasLengthY(finiteNumber(mask.height) * finiteNumber(mask.scaleY, 1), geometry),
                ...(finiteNumber(mask.rx) > 0
                    ? {
                        rx: normalizedCanvasLengthX(finiteNumber(mask.rx), geometry),
                    }
                    : {}),
                ...(finiteNumber(mask.ry) > 0
                    ? {
                        ry: normalizedCanvasLengthY(finiteNumber(mask.ry), geometry),
                    }
                    : {}),
            }, mask, geometry),
            style,
        };
    }
    if (type === 'circle') {
        const radius = finiteNumber(mask.radius) * finiteNumber(mask.scaleX, 1);
        const center = normalizedPoint({
            x: finiteNumber(mask.left) + radius,
            y: finiteNumber(mask.top) + radius,
        }, geometry);
        return {
            kind: 'mask',
            ...base,
            maskShape: 'circle',
            geometry: applyOptionalAngle({
                type: 'circle',
                cx: center.x,
                cy: center.y,
                radius: normalizedCanvasLengthX(radius, geometry),
            }, mask, geometry),
            style,
        };
    }
    if (type === 'ellipse') {
        const rx = finiteNumber(mask.rx) * finiteNumber(mask.scaleX, 1);
        const ry = finiteNumber(mask.ry) * finiteNumber(mask.scaleY, 1);
        const center = normalizedPoint({
            x: finiteNumber(mask.left) + rx,
            y: finiteNumber(mask.top) + ry,
        }, geometry);
        return {
            kind: 'mask',
            ...base,
            maskShape: 'ellipse',
            geometry: applyOptionalAngle({
                type: 'ellipse',
                cx: center.x,
                cy: center.y,
                rx: normalizedCanvasLengthX(rx, geometry),
                ry: normalizedCanvasLengthY(ry, geometry),
            }, mask, geometry),
            style,
        };
    }
    if (type === 'polygon' && Array.isArray(mask.points)) {
        const points = ((_b = mask.points) !== null && _b !== void 0 ? _b : []).map((point) => normalizedPoint({
            x: finiteNumber(mask.left) + finiteNumber(point.x),
            y: finiteNumber(mask.top) + finiteNumber(point.y),
        }, geometry));
        return {
            kind: 'mask',
            ...base,
            maskShape: 'polygon',
            geometry: applyOptionalAngle({ type: 'polygon', points }, mask, geometry),
            style,
        };
    }
    return null;
}
function transformPathPoint(annotation, point) {
    var _a, _b;
    const pathLike = annotation;
    const offset = (_a = pathLike.pathOffset) !== null && _a !== void 0 ? _a : { x: 0, y: 0 };
    const x = point.x - finiteNumber(offset.x);
    const y = point.y - finiteNumber(offset.y);
    const matrix = (_b = pathLike.calcTransformMatrix) === null || _b === void 0 ? void 0 : _b.call(pathLike);
    if (!Array.isArray(matrix) || matrix.length < 6) {
        return {
            x: finiteNumber(annotation.left) + point.x,
            y: finiteNumber(annotation.top) + point.y,
        };
    }
    const [a = 1, b = 0, c = 0, d = 1, e = 0, f = 0] = matrix;
    return {
        x: a * x + c * y + e,
        y: b * x + d * y + f,
    };
}
function extractPathPoints(annotation) {
    const pathData = annotation.path;
    return getPathPoints(pathData, (point) => transformPathPoint(annotation, point));
}
function exportTextAnnotation(annotation, geometry, options) {
    var _a;
    const text = annotation;
    const point = normalizedPoint({ x: finiteNumber(annotation.left), y: finiteNumber(annotation.top) }, geometry);
    const angle = localOverlayAngle(annotation, geometry);
    const width = finiteNumber(annotation.width) * finiteNumber(annotation.scaleX, 1);
    return {
        kind: 'annotation',
        annotationType: 'text',
        ...overlayBase(annotation, options),
        geometry: {
            x: point.x,
            y: point.y,
            ...(width > 0 ? { width: normalizedCanvasLengthX(width, geometry) } : {}),
            ...(angle !== 0 ? { angle } : {}),
        },
        text: { value: String((_a = text.text) !== null && _a !== void 0 ? _a : '') },
        style: {
            ...(finiteNumber(text.fontSize) > 0 ? { fontSize: finiteNumber(text.fontSize) } : {}),
            ...(typeof text.fontFamily === 'string' ? { fontFamily: text.fontFamily } : {}),
            ...(typeof text.fontWeight === 'string' || typeof text.fontWeight === 'number'
                ? { fontWeight: text.fontWeight }
                : {}),
            ...(text.fill !== undefined
                ? { fill: normalizeOverlayColor(text.fill, '#000000') }
                : {}),
            ...(text.backgroundColor !== undefined
                ? { backgroundColor: normalizeOverlayColor(text.backgroundColor, '#00000000') }
                : {}),
            ...(text.textAlign === 'left' ||
                text.textAlign === 'center' ||
                text.textAlign === 'right' ||
                text.textAlign === 'justify'
                ? { textAlign: text.textAlign }
                : {}),
            ...(finiteNumber(text.lineHeight) > 0
                ? { lineHeight: finiteNumber(text.lineHeight) }
                : {}),
        },
        ...(annotation.annotationLocked === true ? { locked: true } : {}),
    };
}
function exportShapeAnnotation(annotation, geometry, options) {
    const baseStyle = {
        ...(annotation.stroke !== undefined
            ? { stroke: normalizeOverlayColor(annotation.stroke, '#000000') }
            : {}),
        ...(finiteNumber(annotation.strokeWidth) >= 0
            ? { strokeWidth: finiteNumber(annotation.strokeWidth) }
            : {}),
        ...(annotation.fill !== undefined
            ? { fill: normalizeOverlayColor(annotation.fill, '#00000000') }
            : {}),
        ...(finiteNumber(annotation.opacity, 1) !== 1
            ? { opacity: clamp01(finiteNumber(annotation.opacity, 1)) }
            : {}),
        ...(Array.isArray(annotation.strokeDashArray)
            ? { strokeDashArray: annotation.strokeDashArray.map((entry) => finiteNumber(entry)) }
            : {}),
        ...(typeof annotation.selectable === 'boolean'
            ? { selectable: annotation.selectable }
            : {}),
        ...(typeof annotation.evented === 'boolean' ? { evented: annotation.evented } : {}),
    };
    const shape = annotation.shapeAnnotationKind;
    if (shape === 'rect') {
        const point = normalizedPoint({ x: finiteNumber(annotation.left), y: finiteNumber(annotation.top) }, geometry);
        const angle = localOverlayAngle(annotation, geometry);
        return {
            kind: 'annotation',
            annotationType: 'shape',
            ...overlayBase(annotation, options),
            shape: 'rect',
            geometry: {
                type: 'rect',
                x: point.x,
                y: point.y,
                width: normalizedCanvasLengthX(finiteNumber(annotation.width) * finiteNumber(annotation.scaleX, 1), geometry),
                height: normalizedCanvasLengthY(finiteNumber(annotation.height) * finiteNumber(annotation.scaleY, 1), geometry),
                ...(angle !== 0 ? { angle } : {}),
            },
            style: baseStyle,
            ...(annotation.annotationLocked === true ? { locked: true } : {}),
        };
    }
    const points = extractPathPoints(annotation);
    if (points.length < 2)
        return null;
    const first = normalizedPoint(points[0], geometry);
    const second = normalizedPoint(points[1], geometry);
    if (shape === 'line') {
        return {
            kind: 'annotation',
            annotationType: 'shape',
            ...overlayBase(annotation, options),
            shape: 'line',
            geometry: { type: 'line', x1: first.x, y1: first.y, x2: second.x, y2: second.y },
            style: baseStyle,
            ...(annotation.annotationLocked === true ? { locked: true } : {}),
        };
    }
    return {
        kind: 'annotation',
        annotationType: 'shape',
        ...overlayBase(annotation, options),
        shape: 'arrow',
        geometry: { type: 'arrow', x1: first.x, y1: first.y, x2: second.x, y2: second.y },
        style: baseStyle,
        ...(annotation.annotationLocked === true ? { locked: true } : {}),
    };
}
function exportDrawAnnotation(annotation, geometry, options) {
    const points = extractPathPoints(annotation).map((point) => normalizedPoint(point, geometry));
    return {
        kind: 'annotation',
        annotationType: 'draw',
        ...overlayBase(annotation, options),
        strokes: [
            {
                id: `${getPersistentId(annotation)}-stroke-1`,
                points,
                brush: {
                    color: normalizeOverlayColor(annotation.stroke, '#000000'),
                    width: finiteNumber(annotation.strokeWidth, 1),
                    ...(finiteNumber(annotation.opacity, 1) !== 1
                        ? { opacity: clamp01(finiteNumber(annotation.opacity, 1)) }
                        : {}),
                    lineCap: 'round',
                    lineJoin: 'round',
                },
            },
        ],
        ...(annotation.annotationLocked === true ? { locked: true } : {}),
    };
}
function exportAnnotation(annotation, geometry, options) {
    if (isTextAnnotationObject(annotation)) {
        return exportTextAnnotation(annotation, geometry, options);
    }
    if (isShapeAnnotationObject(annotation)) {
        return exportShapeAnnotation(annotation, geometry, options);
    }
    if (isDrawAnnotationObject(annotation)) {
        return exportDrawAnnotation(annotation, geometry, options);
    }
    return null;
}
export function exportOverlayState(context, options = {}) {
    const canvas = context.canvas;
    const image = context.originalImage;
    if (!canvas || !image) {
        throw new Error('[ImageEditor] exportOverlayState requires a loaded image.');
    }
    const resolvedOptions = {
        includeHidden: options.includeHidden !== false,
        includeLocked: options.includeLocked !== false,
        includeMetadata: options.includeMetadata !== false,
    };
    const imageInfo = getImageInfo(image, context.currentImageMimeType);
    const geometry = createCurrentImageGeometry(image, context.currentRotation);
    const overlays = canvas
        .getObjects()
        .filter(isEditableOverlayObject)
        .filter((object) => resolvedOptions.includeHidden || !isHidden(object))
        .filter((object) => resolvedOptions.includeLocked || !isLocked(object))
        .map((object) => {
        if (isMaskObject(object))
            return exportMask(object, geometry, resolvedOptions);
        if (isAnnotationObject(object))
            return exportAnnotation(object, geometry, resolvedOptions);
        return null;
    })
        .filter((overlay) => !!overlay);
    const baseImageTransform = getBaseImageTransform(image, context.currentRotation);
    return {
        schema: 'image-editor.overlay-state',
        version: 1,
        image: imageInfo,
        coordinateSpace: 'image-normalized',
        ...(baseImageTransform ? { baseImageTransform } : {}),
        overlays,
    };
}
//# sourceMappingURL=overlay-state-exporter.js.map