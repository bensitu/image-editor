import { isAnnotationUnlocked } from '../annotation/annotation-lock.js';
import { syncAnnotationRuntimeState } from '../annotation/annotation-style.js';
import { attachTextEditingHandlers } from '../annotation/text-controller.js';
import { markAnnotationObject, markMaskObject } from '../core/editor-object-kind.js';
import { normalizeLayerOrder, placeAnnotationObject, placeMaskObject, } from '../core/layer-order.js';
import { isAnnotationObject, isMaskObject } from '../core/public-types.js';
import { detachMaskHoverHandlers, attachMaskHoverHandlers } from '../mask/mask-style.js';
import { imageNormalizedToSourcePixel, normalizeRotationDegrees, sourcePixelToCanvas, } from './overlay-coordinate-transform.js';
import { getOverlaySerializer } from './overlay-custom-registry.js';
function finiteNumber(value, fallback = 0) {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
function cloneMetadata(metadata) {
    return metadata ? JSON.parse(JSON.stringify(metadata)) : undefined;
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
function createImportGeometry(image, transform) {
    const center = getObjectCenter(image);
    return {
        naturalWidth: Math.max(1, finiteNumber(image.width, 1)),
        naturalHeight: Math.max(1, finiteNumber(image.height, 1)),
        canvasCenterX: center.x,
        canvasCenterY: center.y,
        scaleX: Math.max(0.000001, Math.abs(finiteNumber(image.scaleX, 1))),
        scaleY: Math.max(0.000001, Math.abs(finiteNumber(image.scaleY, 1))),
        transform: {
            rotation: normalizeRotationDegrees(transform === null || transform === void 0 ? void 0 : transform.rotation),
            flipX: (transform === null || transform === void 0 ? void 0 : transform.flipX) === true,
            flipY: (transform === null || transform === void 0 ? void 0 : transform.flipY) === true,
        },
    };
}
function sourcePointFromNormalized(point, state) {
    return imageNormalizedToSourcePixel(point, state.image);
}
function canvasPointFromNormalized(point, state, geometry) {
    return sourcePixelToCanvas(sourcePointFromNormalized(point, state), geometry);
}
function normalizedLengthX(value, geometry) {
    return value * geometry.naturalWidth * geometry.scaleX;
}
function normalizedLengthY(value, geometry) {
    return value * geometry.naturalHeight * geometry.scaleY;
}
function nextMaskId(context) {
    const id = context.getMaskCounter() + 1;
    context.setMaskCounter(id);
    return id;
}
function nextAnnotationId(context) {
    const id = context.getAnnotationCounter() + 1;
    context.setAnnotationCounter(id);
    return id;
}
function newPersistentId(overlay, kind, runtimeId, options, existingPersistentIds, result) {
    if (options.idStrategy === 'preserve' && !existingPersistentIds.has(overlay.id)) {
        existingPersistentIds.add(overlay.id);
        return overlay.id;
    }
    const generated = `${kind}-${runtimeId}`;
    existingPersistentIds.add(generated);
    if (generated !== overlay.id) {
        result.regeneratedIds.push({ originalId: overlay.id, newId: generated });
    }
    return generated;
}
function assignPersistentFields(object, overlay, persistentId) {
    const target = object;
    target.overlayPersistentId = persistentId;
    const metadata = cloneMetadata(overlay.metadata);
    if (metadata)
        target.overlayMetadata = metadata;
}
function maskStyleProps(style) {
    var _a, _b, _c, _d, _e, _f;
    return {
        fill: style.fill,
        opacity: style.alpha,
        stroke: (_a = style.stroke) !== null && _a !== void 0 ? _a : undefined,
        strokeWidth: (_b = style.strokeWidth) !== null && _b !== void 0 ? _b : 1,
        strokeDashArray: (_c = style.strokeDashArray) !== null && _c !== void 0 ? _c : undefined,
        selectable: (_d = style.selectable) !== null && _d !== void 0 ? _d : true,
        evented: (_e = style.evented) !== null && _e !== void 0 ? _e : true,
        hasControls: (_f = style.hasControls) !== null && _f !== void 0 ? _f : true,
        originX: 'left',
        originY: 'top',
        strokeUniform: true,
    };
}
function createMaskObject(context, state, overlay, geometry) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const fabric = context.fabric;
    let object;
    if (overlay.geometry.type === 'rect') {
        const point = canvasPointFromNormalized({ x: overlay.geometry.x, y: overlay.geometry.y }, state, geometry);
        object = new fabric.Rect({
            ...maskStyleProps(overlay.style),
            left: point.x,
            top: point.y,
            width: normalizedLengthX(overlay.geometry.width, geometry),
            height: normalizedLengthY(overlay.geometry.height, geometry),
            rx: overlay.geometry.rx !== undefined
                ? normalizedLengthX(overlay.geometry.rx, geometry)
                : undefined,
            ry: overlay.geometry.ry !== undefined
                ? normalizedLengthY(overlay.geometry.ry, geometry)
                : undefined,
            angle: normalizeRotationDegrees((_a = state.baseImageTransform) === null || _a === void 0 ? void 0 : _a.rotation) +
                finiteNumber(overlay.geometry.angle),
        });
    }
    else if (overlay.geometry.type === 'circle') {
        const radius = normalizedLengthX(overlay.geometry.radius, geometry);
        const center = canvasPointFromNormalized({ x: overlay.geometry.cx, y: overlay.geometry.cy }, state, geometry);
        object = new fabric.Circle({
            ...maskStyleProps(overlay.style),
            left: center.x - radius,
            top: center.y - radius,
            radius,
            angle: normalizeRotationDegrees((_b = state.baseImageTransform) === null || _b === void 0 ? void 0 : _b.rotation) +
                finiteNumber(overlay.geometry.angle),
        });
    }
    else if (overlay.geometry.type === 'ellipse') {
        const rx = normalizedLengthX(overlay.geometry.rx, geometry);
        const ry = normalizedLengthY(overlay.geometry.ry, geometry);
        const center = canvasPointFromNormalized({ x: overlay.geometry.cx, y: overlay.geometry.cy }, state, geometry);
        object = new fabric.Ellipse({
            ...maskStyleProps(overlay.style),
            left: center.x - rx,
            top: center.y - ry,
            rx,
            ry,
            angle: normalizeRotationDegrees((_c = state.baseImageTransform) === null || _c === void 0 ? void 0 : _c.rotation) +
                finiteNumber(overlay.geometry.angle),
        });
    }
    else {
        const points = overlay.geometry.points.map((point) => canvasPointFromNormalized(point, state, geometry));
        const minX = Math.min(...points.map((point) => point.x));
        const minY = Math.min(...points.map((point) => point.y));
        object = new fabric.Polygon(points.map((point) => ({ x: point.x - minX, y: point.y - minY })), {
            ...maskStyleProps(overlay.style),
            left: minX,
            top: minY,
            angle: normalizeRotationDegrees((_d = state.baseImageTransform) === null || _d === void 0 ? void 0 : _d.rotation) +
                finiteNumber(overlay.geometry.angle),
        });
    }
    const maskId = nextMaskId(context);
    const mask = markMaskObject(object, {
        maskId,
        maskUid: `mask-${maskId}`,
        maskName: `${context.options.maskName}${maskId}`,
        originalAlpha: overlay.style.alpha,
        originalStroke: (_e = overlay.style.stroke) !== null && _e !== void 0 ? _e : null,
        originalStrokeWidth: (_f = overlay.style.strokeWidth) !== null && _f !== void 0 ? _f : 1,
    });
    mask.selectable = (_g = overlay.style.selectable) !== null && _g !== void 0 ? _g : true;
    mask.evented = (_h = overlay.style.evented) !== null && _h !== void 0 ? _h : true;
    mask.hasControls = (_j = overlay.style.hasControls) !== null && _j !== void 0 ? _j : true;
    mask.transparentCorners = false;
    mask.strokeUniform = true;
    attachMaskHoverHandlers(mask);
    return mask;
}
function annotationBaseProps(locked) {
    return {
        annotationHidden: false,
        annotationLocked: locked === true,
    };
}
function createTextObject(context, state, overlay, geometry, warnings) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const point = canvasPointFromNormalized({ x: overlay.geometry.x, y: overlay.geometry.y }, state, geometry);
    const requestedFont = overlay.style.fontFamily;
    const fontFamily = requestedFont || context.options.defaultTextConfig.fontFamily;
    const metadata = (_a = cloneMetadata(overlay.metadata)) !== null && _a !== void 0 ? _a : {};
    if (requestedFont) {
        metadata['core.font'] = {
            ...((_b = metadata['core.font']) !== null && _b !== void 0 ? _b : {}),
            requestedFontFamily: requestedFont,
        };
        warnings.push({
            code: 'text.fontFamily.requested',
            path: `overlays.${overlay.id}.style.fontFamily`,
            message: `Text overlay requested fontFamily "${requestedFont}". Runtime font availability is host-dependent.`,
            details: { fontFamily: requestedFont },
        });
    }
    const textbox = new context.fabric.Textbox(overlay.text.value, {
        left: point.x,
        top: point.y,
        width: overlay.geometry.width !== undefined
            ? normalizedLengthX(overlay.geometry.width, geometry)
            : context.options.defaultTextConfig.width,
        fontSize: (_c = overlay.style.fontSize) !== null && _c !== void 0 ? _c : context.options.defaultTextConfig.fontSize,
        fontFamily,
        fontWeight: (_d = overlay.style.fontWeight) !== null && _d !== void 0 ? _d : context.options.defaultTextConfig.fontWeight,
        fill: (_e = overlay.style.fill) !== null && _e !== void 0 ? _e : context.options.defaultTextConfig.fill,
        backgroundColor: (_f = overlay.style.backgroundColor) !== null && _f !== void 0 ? _f : context.options.defaultTextConfig.backgroundColor,
        textAlign: (_g = overlay.style.textAlign) !== null && _g !== void 0 ? _g : context.options.defaultTextConfig.textAlign,
        lineHeight: overlay.style.lineHeight,
        angle: normalizeRotationDegrees((_h = state.baseImageTransform) === null || _h === void 0 ? void 0 : _h.rotation) +
            finiteNumber(overlay.geometry.angle),
        originX: 'left',
        originY: 'top',
        selectable: true,
        evented: true,
        editable: true,
    });
    const annotationId = nextAnnotationId(context);
    const annotation = markAnnotationObject(textbox, {
        annotationId,
        annotationType: 'text',
        annotationName: `${context.options.textAnnotationName}${annotationId}`,
        annotationSelectable: true,
        annotationEvented: true,
        annotationHasControls: textbox.hasControls !== false,
        annotationEditable: true,
        ...annotationBaseProps(overlay.locked),
    });
    if (Object.keys(metadata).length > 0) {
        annotation.overlayMetadata = metadata;
    }
    syncAnnotationRuntimeState(annotation);
    attachTextEditingHandlers(context.buildTextControllerContext(), annotation);
    return annotation;
}
function buildArrowPath(x1, y1, x2, y2, headLength) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const length = Math.max(1, headLength);
    const wingAngle = Math.PI / 7;
    const head1x = x2 - length * Math.cos(angle - wingAngle);
    const head1y = y2 - length * Math.sin(angle - wingAngle);
    const head2x = x2 - length * Math.cos(angle + wingAngle);
    const head2y = y2 - length * Math.sin(angle + wingAngle);
    return `M ${x1} ${y1} L ${x2} ${y2} M ${x2} ${y2} L ${head1x} ${head1y} M ${x2} ${y2} L ${head2x} ${head2y}`;
}
function createShapeObject(context, state, overlay, geometry) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    const style = {
        stroke: (_a = overlay.style.stroke) !== null && _a !== void 0 ? _a : context.options.defaultShapeConfig.stroke,
        strokeWidth: (_b = overlay.style.strokeWidth) !== null && _b !== void 0 ? _b : context.options.defaultShapeConfig.strokeWidth,
        fill: (_c = overlay.style.fill) !== null && _c !== void 0 ? _c : context.options.defaultShapeConfig.fill,
        opacity: (_d = overlay.style.opacity) !== null && _d !== void 0 ? _d : context.options.defaultShapeConfig.opacity,
        strokeDashArray: (_e = overlay.style.strokeDashArray) !== null && _e !== void 0 ? _e : undefined,
        selectable: (_f = overlay.style.selectable) !== null && _f !== void 0 ? _f : true,
        evented: (_g = overlay.style.evented) !== null && _g !== void 0 ? _g : true,
        originX: 'left',
        originY: 'top',
    };
    let object;
    if (overlay.geometry.type === 'rect') {
        const point = canvasPointFromNormalized({ x: overlay.geometry.x, y: overlay.geometry.y }, state, geometry);
        object = new context.fabric.Rect({
            ...style,
            left: point.x,
            top: point.y,
            width: normalizedLengthX(overlay.geometry.width, geometry),
            height: normalizedLengthY(overlay.geometry.height, geometry),
            angle: normalizeRotationDegrees((_h = state.baseImageTransform) === null || _h === void 0 ? void 0 : _h.rotation) +
                finiteNumber(overlay.geometry.angle),
        });
    }
    else {
        const start = canvasPointFromNormalized({ x: overlay.geometry.x1, y: overlay.geometry.y1 }, state, geometry);
        const end = canvasPointFromNormalized({ x: overlay.geometry.x2, y: overlay.geometry.y2 }, state, geometry);
        const path = overlay.geometry.type === 'arrow'
            ? buildArrowPath(start.x, start.y, end.x, end.y, (_j = overlay.geometry.arrowHeadLength) !== null && _j !== void 0 ? _j : context.options.defaultShapeConfig.arrowHeadLength)
            : `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
        object = new context.fabric.Path(path, {
            ...style,
            fill: '',
            strokeLineCap: 'round',
            strokeLineJoin: 'round',
            objectCaching: false,
            angle: normalizeRotationDegrees((_k = state.baseImageTransform) === null || _k === void 0 ? void 0 : _k.rotation) +
                finiteNumber(overlay.geometry.angle),
        });
    }
    const annotationId = nextAnnotationId(context);
    const annotation = markAnnotationObject(object, {
        annotationId,
        annotationType: 'shape',
        annotationName: `${context.options.shapeAnnotationName}${annotationId}`,
        annotationSelectable: (_l = overlay.style.selectable) !== null && _l !== void 0 ? _l : true,
        annotationEvented: (_m = overlay.style.evented) !== null && _m !== void 0 ? _m : true,
        annotationHasControls: object.hasControls !== false,
        shapeAnnotationKind: overlay.shape,
        ...annotationBaseProps(overlay.locked),
    });
    syncAnnotationRuntimeState(annotation);
    return annotation;
}
function createDrawObject(context, state, overlay, geometry) {
    var _a, _b, _c, _d;
    const commands = [];
    const firstStroke = overlay.strokes[0];
    const brush = (_a = firstStroke === null || firstStroke === void 0 ? void 0 : firstStroke.brush) !== null && _a !== void 0 ? _a : {
        color: context.options.defaultDrawConfig.color,
        width: context.options.defaultDrawConfig.brushSize,
    };
    for (const stroke of overlay.strokes) {
        stroke.points.forEach((point, index) => {
            const canvasPoint = canvasPointFromNormalized(point, state, geometry);
            commands.push(`${index === 0 ? 'M' : 'L'} ${canvasPoint.x} ${canvasPoint.y}`);
        });
    }
    const object = new context.fabric.Path(commands.join(' '), {
        fill: '',
        stroke: brush.color,
        strokeWidth: brush.width,
        opacity: (_b = brush.opacity) !== null && _b !== void 0 ? _b : context.options.defaultDrawConfig.opacity,
        strokeLineCap: (_c = brush.lineCap) !== null && _c !== void 0 ? _c : context.options.defaultDrawConfig.lineCap,
        strokeLineJoin: (_d = brush.lineJoin) !== null && _d !== void 0 ? _d : context.options.defaultDrawConfig.lineJoin,
        selectable: true,
        evented: true,
        objectCaching: false,
    });
    const annotationId = nextAnnotationId(context);
    const annotation = markAnnotationObject(object, {
        annotationId,
        annotationType: 'draw',
        annotationName: `${context.options.drawAnnotationName}${annotationId}`,
        annotationSelectable: true,
        annotationEvented: true,
        annotationHasControls: object.hasControls !== false,
        ...annotationBaseProps(overlay.locked),
    });
    syncAnnotationRuntimeState(annotation);
    return annotation;
}
function removeExistingOverlays(context) {
    const objects = [...context.canvas.getObjects()];
    for (const object of objects) {
        if (isMaskObject(object)) {
            context.removeLabelForMask(object);
            detachMaskHoverHandlers(object);
            context.canvas.remove(object);
        }
        else if (isAnnotationObject(object)) {
            context.canvas.remove(object);
        }
    }
    context.canvas.discardActiveObject();
    context.setLastMask(null);
}
function readExistingPersistentIds(canvas) {
    const ids = new Set();
    canvas.getObjects().forEach((object) => {
        const id = object.overlayPersistentId;
        if (typeof id === 'string')
            ids.add(id);
    });
    return ids;
}
function computeTopLeftPoint(object) {
    object.setCoords();
    const coords = object.getCoords();
    const first = coords[0];
    if (first)
        return first;
    const boundingRect = object.getBoundingRect();
    return { x: boundingRect.left, y: boundingRect.top };
}
function applyBaseTransformToImage(context, transform) {
    if (transform === undefined)
        return;
    const image = context.originalImage;
    const rotation = normalizeRotationDegrees(transform.rotation);
    const flipX = transform.flipX === true;
    const flipY = transform.flipY === true;
    const center = image.getCenterPoint();
    image.set({ originX: 'center', originY: 'center' });
    image.setPositionByOrigin(center, 'center', 'center');
    image.set({ angle: rotation, flipX, flipY });
    image.setCoords();
    const nextTopLeft = computeTopLeftPoint(image);
    image.set({ originX: 'left', originY: 'top' });
    image.setPositionByOrigin(nextTopLeft, 'left', 'top');
    image.setCoords();
    context.setCurrentRotation(rotation);
}
function skipCustomOverlay(overlay, result) {
    result.skippedOverlays += 1;
    result.warnings.push({
        code: 'custom.unknownType',
        path: `overlays.${overlay.id}`,
        message: `Custom overlay type "${overlay.customType}" has no registered importer and was skipped.`,
        details: { customType: overlay.customType },
    });
}
export async function importOverlayStateIntoEditor(context, state, options = {}) {
    var _a;
    const result = {
        importedOverlays: 0,
        importedMasks: 0,
        importedAnnotations: 0,
        skippedOverlays: 0,
        regeneratedIds: [],
        warnings: [],
    };
    const mode = (_a = options.mode) !== null && _a !== void 0 ? _a : 'replace';
    if (mode === 'replace')
        removeExistingOverlays(context);
    applyBaseTransformToImage(context, state.baseImageTransform);
    const geometry = createImportGeometry(context.originalImage, state.baseImageTransform);
    const existingPersistentIds = readExistingPersistentIds(context.canvas);
    const importedObjects = [];
    for (const overlay of state.overlays) {
        if (overlay.kind === 'custom') {
            const entry = getOverlaySerializer(overlay.customType);
            if (!entry) {
                skipCustomOverlay(overlay, result);
                continue;
            }
            await entry.import(overlay.data, { state });
            result.importedOverlays += 1;
            continue;
        }
        if (overlay.kind === 'mask') {
            const mask = createMaskObject(context, state, overlay, geometry);
            const persistentId = newPersistentId(overlay, 'mask', mask.maskId, options, existingPersistentIds, result);
            assignPersistentFields(mask, overlay, persistentId);
            placeMaskObject(context.canvas, mask);
            context.setLastMask(mask);
            importedObjects.push(mask);
            result.importedOverlays += 1;
            result.importedMasks += 1;
            continue;
        }
        let annotation;
        if (overlay.annotationType === 'text') {
            annotation = createTextObject(context, state, overlay, geometry, result.warnings);
        }
        else if (overlay.annotationType === 'shape') {
            annotation = createShapeObject(context, state, overlay, geometry);
        }
        else {
            annotation = createDrawObject(context, state, overlay, geometry);
        }
        const persistentId = newPersistentId(overlay, 'annotation', annotation.annotationId, options, existingPersistentIds, result);
        assignPersistentFields(annotation, overlay, persistentId);
        placeAnnotationObject(context.canvas, annotation);
        if (annotation.selectable !== false && isAnnotationUnlocked(annotation)) {
            context.canvas.setActiveObject(annotation);
        }
        importedObjects.push(annotation);
        result.importedOverlays += 1;
        result.importedAnnotations += 1;
    }
    normalizeLayerOrder(context.canvas);
    if (options.preserveSelection !== true) {
        context.canvas.discardActiveObject();
    }
    context.canvas.renderAll();
    return result;
}
//# sourceMappingURL=overlay-state-importer.js.map