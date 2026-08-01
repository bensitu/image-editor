import { isDangerousStateKey } from '../plugin-kernel/plugin-identifier.js';
const SCHEMA = 'image-editor.overlay-state';
const COORDINATE_SPACE = 'image-normalized';
const MAX_OVERLAYS = 100000;
const MAX_POINTS = 65536;
const MAX_TEXT_LENGTH = 20000;
export class OverlayStateV1MigrationError extends TypeError {
    constructor(code, message, path = '$') {
        super(`${message} (${path})`);
        Object.defineProperty(this, "code", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: code
        });
        Object.defineProperty(this, "path", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: path
        });
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'OverlayStateV1MigrationError'
        });
    }
}
function fail(code, message, path) {
    throw new OverlayStateV1MigrationError(code, message, path);
}
function isRecord(value) {
    if (typeof value !== 'object' || value === null || Array.isArray(value))
        return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}
function record(value, path) {
    return isRecord(value) ? value : fail('value.object', 'Expected an object.', path);
}
function stringValue(value, path, fallback, allowEmpty = false) {
    if (value === undefined && fallback !== undefined)
        return fallback;
    if (typeof value !== 'string' ||
        (!allowEmpty && value.length === 0) ||
        value.length > MAX_TEXT_LENGTH) {
        return fail('value.string', allowEmpty ? 'Expected a bounded string.' : 'Expected a non-empty bounded string.', path);
    }
    return value;
}
function numberValue(value, path, fallback) {
    if (value === undefined && fallback !== undefined)
        return fallback;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return fail('value.number', 'Expected a finite number.', path);
    }
    return value;
}
function positive(value, path, fallback) {
    const result = numberValue(value, path, fallback);
    return result > 0 ? result : fail('value.positive', 'Expected a positive number.', path);
}
function booleanValue(value, fallback) {
    return typeof value === 'boolean' ? value : fallback;
}
function point(value, path) {
    const candidate = record(value, path);
    return Object.freeze({
        x: numberValue(candidate.x, `${path}.x`),
        y: numberValue(candidate.y, `${path}.y`),
    });
}
function cloneJson(value, path, depth = 0) {
    if (depth > 32)
        return fail('value.depth', 'Metadata nesting is too deep.', path);
    if (value === null ||
        typeof value === 'string' ||
        typeof value === 'boolean' ||
        (typeof value === 'number' && Number.isFinite(value))) {
        return value;
    }
    if (Array.isArray(value)) {
        if (value.length > MAX_POINTS) {
            return fail('value.array', 'Array exceeds the migration limit.', path);
        }
        return Object.freeze(value.map((entry, index) => cloneJson(entry, `${path}[${index}]`, depth + 1)));
    }
    const candidate = record(value, path);
    const output = Object.create(null);
    for (const key of Object.keys(candidate)) {
        if (isDangerousStateKey(key)) {
            return fail('value.key', `Dangerous key "${key}" is not allowed.`, `${path}.${key}`);
        }
        const descriptor = Object.getOwnPropertyDescriptor(candidate, key);
        if (!descriptor || !('value' in descriptor)) {
            return fail('value.accessor', 'Accessor properties are not allowed.', `${path}.${key}`);
        }
        output[key] = cloneJson(descriptor.value, `${path}.${key}`, depth + 1);
    }
    return Object.freeze(output);
}
function metadata(value, path) {
    if (value === undefined)
        return Object.freeze({});
    return cloneJson(record(value, path), path);
}
function radians(degrees) {
    return (degrees * Math.PI) / 180;
}
function rotate(pointValue, origin, degrees) {
    if (degrees === 0)
        return pointValue;
    const angle = radians(degrees);
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const x = pointValue.x - origin.x;
    const y = pointValue.y - origin.y;
    return Object.freeze({
        x: origin.x + x * cosine - y * sine,
        y: origin.y + x * sine + y * cosine,
    });
}
function boundsCorners(left, top, width, height, angle) {
    const origin = Object.freeze({ x: left, y: top });
    return Object.freeze({
        type: 'bounds',
        corners: Object.freeze([
            origin,
            rotate({ x: left + width, y: top }, origin, angle),
            rotate({ x: left + width, y: top + height }, origin, angle),
            rotate({ x: left, y: top + height }, origin, angle),
        ]),
    });
}
function scalarFromPixels(value, image) {
    return value / Math.min(image.naturalWidth, image.naturalHeight);
}
function scalarFromXRatio(value, image) {
    return (value * image.naturalWidth) / Math.min(image.naturalWidth, image.naturalHeight);
}
function dashArray(value, image, path) {
    if (value === undefined || value === null)
        return null;
    if (!Array.isArray(value) || value.length > 16) {
        return fail('style.dash', 'Stroke dash data is invalid.', path);
    }
    return Object.freeze(value.map((entry, index) => scalarFromPixels(numberValue(entry, `${path}[${index}]`), image)));
}
function interaction(source, editable) {
    return Object.freeze({
        selectable: booleanValue(source.selectable, true),
        evented: booleanValue(source.evented, true),
        hasControls: booleanValue(source.hasControls, true),
        ...(editable === undefined ? {} : { editable }),
    });
}
function item(id, kind, layer, hidden, locked, geometry, data, itemMetadata) {
    return Object.freeze({
        id,
        kind,
        codec: Object.freeze({ type: kind, version: '1.0.0' }),
        geometry,
        layer,
        hidden,
        locked,
        ...(itemMetadata ? { metadata: itemMetadata } : {}),
        data,
    });
}
function uniqueId(id, reserved) {
    if (!reserved.has(id)) {
        reserved.add(id);
        return id;
    }
    for (let sequence = 2; sequence <= Number.MAX_SAFE_INTEGER; sequence += 1) {
        const suffix = `:part-${sequence}`;
        const candidate = `${id.slice(0, Math.max(1, 128 - suffix.length))}${suffix}`;
        if (!reserved.has(candidate)) {
            reserved.add(candidate);
            return candidate;
        }
    }
    return fail('overlay.id', 'Could not allocate a unique Overlay id.', '$.overlays');
}
function convertMask(source, path, image, layer, id) {
    var _a;
    const geometry = record(source.geometry, `${path}.geometry`);
    const style = record(source.style, `${path}.style`);
    const shape = stringValue(source.maskShape, `${path}.maskShape`);
    const angle = numberValue(geometry.angle, `${path}.geometry.angle`, 0);
    let left;
    let top;
    let width;
    let height;
    let points = null;
    if (shape === 'rect' && geometry.type === 'rect') {
        left = numberValue(geometry.x, `${path}.geometry.x`);
        top = numberValue(geometry.y, `${path}.geometry.y`);
        width = positive(geometry.width, `${path}.geometry.width`);
        height = positive(geometry.height, `${path}.geometry.height`);
    }
    else if (shape === 'circle' && geometry.type === 'circle') {
        const radius = positive(geometry.radius, `${path}.geometry.radius`);
        left = numberValue(geometry.cx, `${path}.geometry.cx`) - radius;
        top = numberValue(geometry.cy, `${path}.geometry.cy`) - radius;
        width = radius * 2;
        height = radius * 2;
    }
    else if (shape === 'ellipse' && geometry.type === 'ellipse') {
        const rx = positive(geometry.rx, `${path}.geometry.rx`);
        const ry = positive(geometry.ry, `${path}.geometry.ry`);
        left = numberValue(geometry.cx, `${path}.geometry.cx`) - rx;
        top = numberValue(geometry.cy, `${path}.geometry.cy`) - ry;
        width = rx * 2;
        height = ry * 2;
    }
    else if (shape === 'polygon' && geometry.type === 'polygon') {
        if (!Array.isArray(geometry.points) ||
            geometry.points.length < 3 ||
            geometry.points.length > 4096) {
            return fail('mask.points', 'Polygon points are invalid.', `${path}.geometry.points`);
        }
        const absolute = geometry.points.map((entry, index) => point(entry, `${path}.geometry.points[${index}]`));
        left = Math.min(...absolute.map((entry) => entry.x));
        top = Math.min(...absolute.map((entry) => entry.y));
        const right = Math.max(...absolute.map((entry) => entry.x));
        const bottom = Math.max(...absolute.map((entry) => entry.y));
        width = right - left;
        height = bottom - top;
        if (!(width > 0) || !(height > 0)) {
            return fail('mask.points', 'Polygon points must span a positive area.', `${path}.geometry.points`);
        }
        points = Object.freeze(absolute.map((entry) => Object.freeze({ x: (entry.x - left) / width, y: (entry.y - top) / height })));
    }
    else {
        return fail('mask.shape', 'Mask shape and geometry do not match.', path);
    }
    const stroke = style.stroke;
    if (stroke !== undefined && stroke !== null && typeof stroke !== 'string') {
        return fail('style.stroke', 'Mask stroke must be a string or null.', `${path}.style.stroke`);
    }
    const numericId = (_a = /(?:^|[-:])(\d+)$/u.exec(id)) === null || _a === void 0 ? void 0 : _a[1];
    const maskId = numericId ? Number(numericId) : layer + 1;
    return item(id, 'mask:object', layer, source.hidden === true, false, boundsCorners(left, top, width, height, angle), Object.freeze({
        version: 1,
        kind: shape,
        maskId: Number.isSafeInteger(maskId) && maskId > 0 ? maskId : layer + 1,
        name: id,
        fill: stringValue(style.fill, `${path}.style.fill`, '#000000'),
        opacity: numberValue(style.alpha, `${path}.style.alpha`, 1),
        stroke: stroke !== null && stroke !== void 0 ? stroke : null,
        strokeWidth: scalarFromPixels(numberValue(style.strokeWidth, `${path}.style.strokeWidth`, 1), image),
        strokeDashArray: dashArray(style.strokeDashArray, image, `${path}.style.strokeDashArray`),
        cornerRadiusX: geometry.rx === undefined ? 0 : numberValue(geometry.rx, `${path}.geometry.rx`),
        cornerRadiusY: geometry.ry === undefined ? 0 : numberValue(geometry.ry, `${path}.geometry.ry`),
        points,
        hasControls: booleanValue(style.hasControls, true),
        selectable: booleanValue(style.selectable, true),
        evented: booleanValue(style.evented, true),
    }), metadata(source.metadata, `${path}.metadata`));
}
function annotationEnvelope(id, source, feature, editable) {
    const style = isRecord(source.style) ? source.style : {};
    return Object.freeze({
        version: 1,
        name: id,
        interaction: interaction(style, editable),
        feature,
    });
}
function convertText(source, path, image, layer, id, warn) {
    const geometry = record(source.geometry, `${path}.geometry`);
    const text = record(source.text, `${path}.text`);
    const style = record(source.style, `${path}.style`);
    const value = stringValue(text.value, `${path}.text.value`, 'Text', true);
    const x = numberValue(geometry.x, `${path}.geometry.x`);
    const y = numberValue(geometry.y, `${path}.geometry.y`);
    const angle = numberValue(geometry.angle, `${path}.geometry.angle`, 0);
    const width = positive(geometry.width, `${path}.geometry.width`, 0.25);
    const fontSizePx = positive(style.fontSize, `${path}.style.fontSize`, 24);
    const lineHeight = positive(style.lineHeight, `${path}.style.lineHeight`, 1.16);
    const lineCount = Math.max(1, value.split(/\r?\n/u).length);
    const height = (fontSizePx * lineHeight * lineCount) / image.naturalHeight;
    warn('text.bounds.approximated', `${path}.geometry`, 'Wire format 1 did not store rendered text height; wire format 2 bounds were estimated from font size and line height.');
    return item(id, 'annotation:text', layer, source.hidden === true, source.locked === true, boundsCorners(x, y, width, height, angle), annotationEnvelope(id, source, Object.freeze({
        version: 1,
        text: value,
        fontSize: scalarFromPixels(fontSizePx, image),
        width: scalarFromXRatio(width, image),
        fontFamily: stringValue(style.fontFamily, `${path}.style.fontFamily`, 'Arial'),
        fontWeight: typeof style.fontWeight === 'number' || typeof style.fontWeight === 'string'
            ? style.fontWeight
            : 'normal',
        fill: stringValue(style.fill, `${path}.style.fill`, '#111111'),
        backgroundColor: typeof style.backgroundColor === 'string' ? style.backgroundColor : '',
        textAlign: style.textAlign === 'center' ||
            style.textAlign === 'right' ||
            style.textAlign === 'justify'
            ? style.textAlign
            : 'left',
        lineHeight,
        opacity: numberValue(style.opacity, `${path}.style.opacity`, 1),
    }), true), metadata(source.metadata, `${path}.metadata`));
}
function convertShape(source, path, image, layer, id) {
    const shape = stringValue(source.shape, `${path}.shape`);
    const geometry = record(source.geometry, `${path}.geometry`);
    const style = record(source.style, `${path}.style`);
    const angle = numberValue(geometry.angle, `${path}.geometry.angle`, 0);
    let stateGeometry;
    if (shape === 'rect' && geometry.type === 'rect') {
        stateGeometry = Object.freeze({
            kind: 'rect',
            bounds: boundsCorners(numberValue(geometry.x, `${path}.geometry.x`), numberValue(geometry.y, `${path}.geometry.y`), positive(geometry.width, `${path}.geometry.width`), positive(geometry.height, `${path}.geometry.height`), angle),
        });
    }
    else if ((shape === 'line' || shape === 'arrow') && geometry.type === shape) {
        const start = point({ x: geometry.x1, y: geometry.y1 }, `${path}.geometry.start`);
        const end = point({ x: geometry.x2, y: geometry.y2 }, `${path}.geometry.end`);
        const origin = Object.freeze({ x: Math.min(start.x, end.x), y: Math.min(start.y, end.y) });
        stateGeometry = Object.freeze({
            kind: shape,
            start: rotate(start, origin, angle),
            end: rotate(end, origin, angle),
        });
    }
    else {
        return fail('annotation.shape', 'Shape kind and geometry do not match.', path);
    }
    return item(id, 'annotation:shape', layer, source.hidden === true, source.locked === true, stateGeometry, annotationEnvelope(id, source, Object.freeze({
        version: 1,
        stroke: stringValue(style.stroke, `${path}.style.stroke`, '#111111'),
        strokeWidth: scalarFromPixels(numberValue(style.strokeWidth, `${path}.style.strokeWidth`, 3), image),
        fill: typeof style.fill === 'string' ? style.fill : '',
        opacity: numberValue(style.opacity, `${path}.style.opacity`, 1),
        strokeDashArray: dashArray(style.strokeDashArray, image, `${path}.style.strokeDashArray`),
        arrowHeadLength: scalarFromPixels(numberValue(geometry.arrowHeadLength, `${path}.geometry.arrowHeadLength`, 16), image),
    })), metadata(source.metadata, `${path}.metadata`));
}
function convertDraw(source, path, image, layerStart, id, reserved, remainingItemBudget) {
    if (!Array.isArray(source.strokes) ||
        source.strokes.length === 0 ||
        source.strokes.length > remainingItemBudget) {
        return fail('annotation.strokes', 'Draw strokes are invalid or exceed the remaining Overlay limit.', `${path}.strokes`);
    }
    return Object.freeze(source.strokes.map((entry, strokeIndex) => {
        const strokePath = `${path}.strokes[${strokeIndex}]`;
        const stroke = record(entry, strokePath);
        const brush = record(stroke.brush, `${strokePath}.brush`);
        if (!Array.isArray(stroke.points) ||
            stroke.points.length < 2 ||
            stroke.points.length > MAX_POINTS) {
            return fail('annotation.points', 'Draw points are invalid.', `${strokePath}.points`);
        }
        const points = Object.freeze(stroke.points.map((entryPoint, pointIndex) => point(entryPoint, `${strokePath}.points[${pointIndex}]`)));
        const partId = strokeIndex === 0 ? id : uniqueId(`${id}:stroke-${strokeIndex + 1}`, reserved);
        return item(partId, 'annotation:draw', layerStart + strokeIndex, source.hidden === true, source.locked === true, Object.freeze({ type: 'path', points }), annotationEnvelope(partId, source, Object.freeze({
            version: 1,
            color: stringValue(brush.color, `${strokePath}.brush.color`, '#111111'),
            width: scalarFromPixels(positive(brush.width, `${strokePath}.brush.width`, 1), image),
            opacity: numberValue(brush.opacity, `${strokePath}.brush.opacity`, 1),
            lineCap: brush.lineCap === 'butt' || brush.lineCap === 'square'
                ? brush.lineCap
                : 'round',
            lineJoin: brush.lineJoin === 'bevel' || brush.lineJoin === 'miter'
                ? brush.lineJoin
                : 'round',
        })), metadata(source.metadata, `${path}.metadata`));
    }));
}
function resolveMigrationOptions(value) {
    var _a, _b;
    if (!isRecord(value)) {
        return fail('options.object', 'Migration options must be an object.', '$options');
    }
    const allowed = new Set(['unsupportedOverlayPolicy', 'baseImageTransformPolicy', 'onWarning']);
    if (Object.keys(value).some((key) => !allowed.has(key))) {
        return fail('options.key', 'Migration options contain unknown keys.', '$options');
    }
    const unsupportedOverlayPolicy = (_a = value.unsupportedOverlayPolicy) !== null && _a !== void 0 ? _a : 'error';
    if (unsupportedOverlayPolicy !== 'error' && unsupportedOverlayPolicy !== 'skip') {
        return fail('options.policy', 'unsupportedOverlayPolicy must be "error" or "skip".', '$options.unsupportedOverlayPolicy');
    }
    const baseImageTransformPolicy = (_b = value.baseImageTransformPolicy) !== null && _b !== void 0 ? _b : 'error';
    if (baseImageTransformPolicy !== 'error' && baseImageTransformPolicy !== 'drop') {
        return fail('options.policy', 'baseImageTransformPolicy must be "error" or "drop".', '$options.baseImageTransformPolicy');
    }
    if (value.onWarning !== undefined && typeof value.onWarning !== 'function') {
        return fail('options.callback', 'onWarning must be a function.', '$options.onWarning');
    }
    return Object.freeze({
        unsupportedOverlayPolicy,
        baseImageTransformPolicy,
        ...(value.onWarning
            ? {
                onWarning: value.onWarning,
            }
            : {}),
    });
}
function imageReference(value) {
    const source = record(value, '$.image');
    const naturalWidth = positive(source.naturalWidth, '$.image.naturalWidth');
    const naturalHeight = positive(source.naturalHeight, '$.image.naturalHeight');
    if (!Number.isSafeInteger(naturalWidth) || !Number.isSafeInteger(naturalHeight)) {
        return fail('image.dimensions', 'Image dimensions must be positive safe integers.', '$.image');
    }
    const mimeType = source.mimeType;
    if (mimeType !== undefined &&
        mimeType !== 'image/jpeg' &&
        mimeType !== 'image/png' &&
        mimeType !== 'image/webp') {
        return fail('image.mime', 'Image MIME type is unsupported.', '$.image.mimeType');
    }
    return Object.freeze({
        naturalWidth,
        naturalHeight,
        ...(mimeType ? { mimeType } : {}),
        ...(typeof source.sourceId === 'string' ? { sourceId: source.sourceId } : {}),
        ...(typeof source.checksum === 'string' ? { checksum: source.checksum } : {}),
    });
}
export function migrateV1OverlayState(input, options = {}) {
    const resolvedOptions = resolveMigrationOptions(options);
    const source = record(input, '$');
    if (source.schema !== SCHEMA ||
        source.version !== 1 ||
        source.coordinateSpace !== COORDINATE_SPACE) {
        return fail('document.unsupported', 'Input is not a supported Overlay State wire format 1 document.', '$');
    }
    const warn = (code, path, message) => {
        var _a;
        (_a = resolvedOptions.onWarning) === null || _a === void 0 ? void 0 : _a.call(resolvedOptions, Object.freeze({ code, path, message }));
    };
    if (source.baseImageTransform !== undefined) {
        const transform = record(source.baseImageTransform, '$.baseImageTransform');
        const meaningful = numberValue(transform.rotation, '$.baseImageTransform.rotation', 0) !== 0 ||
            transform.flipX === true ||
            transform.flipY === true;
        if (meaningful) {
            if (resolvedOptions.baseImageTransformPolicy === 'error') {
                return fail('transform.unsupported', 'Overlay State wire format 2 does not mutate the Base Image transform; pass baseImageTransformPolicy: "drop" only when the host restores that transform separately.', '$.baseImageTransform');
            }
            warn('transform.dropped', '$.baseImageTransform', 'The wire format 1 Base Image transform was dropped; the host must restore it separately.');
        }
    }
    const image = imageReference(source.image);
    if (record(source.image, '$.image').orientation !== undefined &&
        record(source.image, '$.image').orientation !== 1) {
        return fail('image.orientation', 'Non-normalized wire format 1 image orientation cannot be represented in Overlay State wire format 2.', '$.image.orientation');
    }
    if (!Array.isArray(source.overlays) || source.overlays.length > MAX_OVERLAYS) {
        return fail('document.overlays', 'Overlay collection is invalid.', '$.overlays');
    }
    const overlays = [];
    const reserved = new Set();
    for (let index = 0; index < source.overlays.length; index += 1) {
        const path = `$.overlays[${index}]`;
        const sourceOverlay = record(source.overlays[index], path);
        const requestedId = stringValue(sourceOverlay.id, `${path}.id`);
        if (sourceOverlay.kind === 'mask') {
            if (overlays.length >= MAX_OVERLAYS) {
                return fail('document.overlays', 'Overlay collection exceeds its limit.', path);
            }
            const id = uniqueId(requestedId, reserved);
            overlays.push(convertMask(sourceOverlay, path, image, overlays.length, id));
            continue;
        }
        if (sourceOverlay.kind === 'annotation') {
            const id = uniqueId(requestedId, reserved);
            if (sourceOverlay.annotationType === 'text') {
                if (overlays.length >= MAX_OVERLAYS) {
                    return fail('document.overlays', 'Overlay collection exceeds its limit.', path);
                }
                overlays.push(convertText(sourceOverlay, path, image, overlays.length, id, warn));
            }
            else if (sourceOverlay.annotationType === 'shape') {
                if (overlays.length >= MAX_OVERLAYS) {
                    return fail('document.overlays', 'Overlay collection exceeds its limit.', path);
                }
                overlays.push(convertShape(sourceOverlay, path, image, overlays.length, id));
            }
            else if (sourceOverlay.annotationType === 'draw') {
                overlays.push(...convertDraw(sourceOverlay, path, image, overlays.length, id, reserved, MAX_OVERLAYS - overlays.length));
            }
            else {
                return fail('annotation.type', 'Annotation type is unsupported.', `${path}.annotationType`);
            }
            continue;
        }
        if (resolvedOptions.unsupportedOverlayPolicy === 'error') {
            return fail('overlay.unsupported', `Overlay kind "${String(sourceOverlay.kind)}" has no built-in wire format 2 State Codec mapping.`, `${path}.kind`);
        }
        warn('overlay.skipped', path, `Overlay kind "${String(sourceOverlay.kind)}" was skipped because no wire format 2 State Codec mapping exists.`);
    }
    return Object.freeze({
        schema: SCHEMA,
        version: 2,
        coordinateSpace: COORDINATE_SPACE,
        image,
        overlays: Object.freeze(overlays),
        ...(source.metadata === undefined
            ? {}
            : { metadata: metadata(source.metadata, '$.metadata') }),
    });
}
//# sourceMappingURL=overlay-state-v1.js.map