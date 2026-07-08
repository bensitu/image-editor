/**
 * Import validated overlay state into a live editor canvas.
 *
 * This module assumes validation has already produced a normalized v1 state.
 * The ImageEditor facade owns operation guards, history bracketing, and
 * rollback; the importer only mutates the supplied canvas.
 *
 * @module
 */

import type * as FabricNS from 'fabric';

import { isAnnotationUnlocked } from '../annotation/annotation-lock.js';
import { syncAnnotationRuntimeState } from '../annotation/annotation-style.js';
import { attachTextEditingHandlers } from '../annotation/text-controller.js';
import { markAnnotationObject, markMaskObject } from '../core/editor-object-kind.js';
import {
    normalizeLayerOrder,
    placeAnnotationObject,
    placeMaskObject,
} from '../core/layer-order.js';
import type {
    AnnotationObject,
    BaseImageObject,
    FabricModule,
    MaskObject,
    ResolvedOptions,
    TextAnnotationObject,
} from '../core/public-types.js';
import { isAnnotationObject, isMaskObject } from '../core/public-types.js';
import { detachMaskHoverHandlers, attachMaskHoverHandlers } from '../mask/mask-style.js';
import type { TextControllerContext } from '../annotation/text-controller.js';
import {
    imageNormalizedToSourcePixel,
    normalizeRotationDegrees,
    sourcePixelToCanvas,
    type CurrentImageGeometry,
    type OverlayPoint,
} from './overlay-coordinate-transform.js';
import { getOverlaySerializer } from './overlay-custom-registry.js';
import type {
    ImportOverlayStateOptions,
    ImportOverlayStateResult,
    OverlayBaseImageTransform,
    OverlayImportWarning,
    OverlayMetadata,
    OverlayState,
    SerializedCustomOverlay,
    SerializedDrawAnnotationOverlay,
    SerializedDrawPoint,
    SerializedMaskOverlay,
    SerializedOverlay,
    SerializedShapeAnnotationOverlay,
    SerializedTextAnnotationOverlay,
} from './overlay-state-types.js';

export interface OverlayStateImportRuntimeContext {
    fabric: FabricModule;
    canvas: FabricNS.Canvas;
    options: ResolvedOptions;
    originalImage: BaseImageObject;
    getMaskCounter(): number;
    setMaskCounter(value: number): void;
    getAnnotationCounter(): number;
    setAnnotationCounter(value: number): void;
    setLastMask(mask: MaskObject | null): void;
    setCurrentRotation(rotation: number): void;
    removeLabelForMask(mask: MaskObject): void;
    buildTextControllerContext(): TextControllerContext;
}

type PersistentOverlayFields = {
    overlayPersistentId?: string;
    overlayMetadata?: OverlayMetadata;
};

function finiteNumber(value: unknown, fallback = 0): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function cloneMetadata(metadata: OverlayMetadata | undefined): OverlayMetadata | undefined {
    return metadata ? (JSON.parse(JSON.stringify(metadata)) as OverlayMetadata) : undefined;
}

function getObjectCenter(object: FabricNS.FabricObject): { x: number; y: number } {
    const center = object.getCenterPoint?.();
    if (center) return { x: center.x, y: center.y };
    return {
        x: finiteNumber(object.left) + finiteNumber(object.width) / 2,
        y: finiteNumber(object.top) + finiteNumber(object.height) / 2,
    };
}

function createImportGeometry(
    image: BaseImageObject,
    transform: OverlayBaseImageTransform | undefined,
): CurrentImageGeometry {
    const center = getObjectCenter(image);
    return {
        naturalWidth: Math.max(1, finiteNumber(image.width, 1)),
        naturalHeight: Math.max(1, finiteNumber(image.height, 1)),
        canvasCenterX: center.x,
        canvasCenterY: center.y,
        scaleX: Math.max(0.000001, Math.abs(finiteNumber(image.scaleX, 1))),
        scaleY: Math.max(0.000001, Math.abs(finiteNumber(image.scaleY, 1))),
        transform: {
            rotation: normalizeRotationDegrees(transform?.rotation),
            flipX: transform?.flipX === true,
            flipY: transform?.flipY === true,
        },
    };
}

function sourcePointFromNormalized(point: OverlayPoint, state: OverlayState): OverlayPoint {
    return imageNormalizedToSourcePixel(point, state.image);
}

function canvasPointFromNormalized(
    point: OverlayPoint,
    state: OverlayState,
    geometry: CurrentImageGeometry,
): OverlayPoint {
    return sourcePixelToCanvas(sourcePointFromNormalized(point, state), geometry);
}

function normalizedLengthX(value: number, geometry: CurrentImageGeometry): number {
    return value * geometry.naturalWidth * geometry.scaleX;
}

function normalizedLengthY(value: number, geometry: CurrentImageGeometry): number {
    return value * geometry.naturalHeight * geometry.scaleY;
}

function nextMaskId(context: OverlayStateImportRuntimeContext): number {
    const id = context.getMaskCounter() + 1;
    context.setMaskCounter(id);
    return id;
}

function nextAnnotationId(context: OverlayStateImportRuntimeContext): number {
    const id = context.getAnnotationCounter() + 1;
    context.setAnnotationCounter(id);
    return id;
}

function newPersistentId(
    overlay: SerializedOverlay,
    kind: 'mask' | 'annotation',
    runtimeId: number,
    options: ImportOverlayStateOptions,
    existingPersistentIds: Set<string>,
    result: ImportOverlayStateResult,
): string {
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

function assignPersistentFields(
    object: MaskObject | AnnotationObject,
    overlay: SerializedOverlay,
    persistentId: string,
): void {
    const target = object as (MaskObject | AnnotationObject) & PersistentOverlayFields;
    target.overlayPersistentId = persistentId;
    const metadata = cloneMetadata(overlay.metadata);
    if (metadata) target.overlayMetadata = metadata;
}

function maskStyleProps(
    style: SerializedMaskOverlay['style'],
): Partial<FabricNS.FabricObjectProps> {
    return {
        fill: style.fill,
        opacity: style.alpha,
        stroke: style.stroke ?? undefined,
        strokeWidth: style.strokeWidth ?? 1,
        strokeDashArray: style.strokeDashArray ?? undefined,
        selectable: style.selectable ?? true,
        evented: style.evented ?? true,
        hasControls: style.hasControls ?? true,
        originX: 'left',
        originY: 'top',
        strokeUniform: true,
    };
}

function createMaskObject(
    context: OverlayStateImportRuntimeContext,
    state: OverlayState,
    overlay: SerializedMaskOverlay,
    geometry: CurrentImageGeometry,
): MaskObject {
    const fabric = context.fabric;
    let object: FabricNS.FabricObject;
    if (overlay.geometry.type === 'rect') {
        const point = canvasPointFromNormalized(
            { x: overlay.geometry.x, y: overlay.geometry.y },
            state,
            geometry,
        );
        object = new fabric.Rect({
            ...maskStyleProps(overlay.style),
            left: point.x,
            top: point.y,
            width: normalizedLengthX(overlay.geometry.width, geometry),
            height: normalizedLengthY(overlay.geometry.height, geometry),
            rx:
                overlay.geometry.rx !== undefined
                    ? normalizedLengthX(overlay.geometry.rx, geometry)
                    : undefined,
            ry:
                overlay.geometry.ry !== undefined
                    ? normalizedLengthY(overlay.geometry.ry, geometry)
                    : undefined,
            angle:
                normalizeRotationDegrees(state.baseImageTransform?.rotation) +
                finiteNumber(overlay.geometry.angle),
        } as Partial<FabricNS.RectProps>);
    } else if (overlay.geometry.type === 'circle') {
        const radius = normalizedLengthX(overlay.geometry.radius, geometry);
        const center = canvasPointFromNormalized(
            { x: overlay.geometry.cx, y: overlay.geometry.cy },
            state,
            geometry,
        );
        object = new fabric.Circle({
            ...maskStyleProps(overlay.style),
            left: center.x - radius,
            top: center.y - radius,
            radius,
            angle:
                normalizeRotationDegrees(state.baseImageTransform?.rotation) +
                finiteNumber(overlay.geometry.angle),
        } as Partial<FabricNS.CircleProps>);
    } else if (overlay.geometry.type === 'ellipse') {
        const rx = normalizedLengthX(overlay.geometry.rx, geometry);
        const ry = normalizedLengthY(overlay.geometry.ry, geometry);
        const center = canvasPointFromNormalized(
            { x: overlay.geometry.cx, y: overlay.geometry.cy },
            state,
            geometry,
        );
        object = new fabric.Ellipse({
            ...maskStyleProps(overlay.style),
            left: center.x - rx,
            top: center.y - ry,
            rx,
            ry,
            angle:
                normalizeRotationDegrees(state.baseImageTransform?.rotation) +
                finiteNumber(overlay.geometry.angle),
        } as Partial<FabricNS.EllipseProps>);
    } else {
        const points = overlay.geometry.points.map((point) =>
            canvasPointFromNormalized(point, state, geometry),
        );
        const minX = Math.min(...points.map((point) => point.x));
        const minY = Math.min(...points.map((point) => point.y));
        object = new fabric.Polygon(
            points.map((point) => ({ x: point.x - minX, y: point.y - minY })),
            {
                ...maskStyleProps(overlay.style),
                left: minX,
                top: minY,
                angle:
                    normalizeRotationDegrees(state.baseImageTransform?.rotation) +
                    finiteNumber(overlay.geometry.angle),
            } as Partial<FabricNS.FabricObjectProps>,
        );
    }

    const maskId = nextMaskId(context);
    const mask = markMaskObject(object, {
        maskId,
        maskUid: `mask-${maskId}`,
        maskName: `${context.options.maskName}${maskId}`,
        originalAlpha: overlay.style.alpha,
        originalStroke: overlay.style.stroke ?? null,
        originalStrokeWidth: overlay.style.strokeWidth ?? 1,
    });
    mask.selectable = overlay.style.selectable ?? true;
    mask.evented = overlay.style.evented ?? true;
    mask.hasControls = overlay.style.hasControls ?? true;
    mask.transparentCorners = false;
    mask.strokeUniform = true;
    attachMaskHoverHandlers(mask);
    return mask;
}

function annotationBaseProps(locked: boolean | undefined): {
    annotationHidden: boolean;
    annotationLocked: boolean;
} {
    return {
        annotationHidden: false,
        annotationLocked: locked === true,
    };
}

function createTextObject(
    context: OverlayStateImportRuntimeContext,
    state: OverlayState,
    overlay: SerializedTextAnnotationOverlay,
    geometry: CurrentImageGeometry,
    warnings: OverlayImportWarning[],
): TextAnnotationObject {
    const point = canvasPointFromNormalized(
        { x: overlay.geometry.x, y: overlay.geometry.y },
        state,
        geometry,
    );
    const requestedFont = overlay.style.fontFamily;
    const fontFamily = requestedFont || context.options.defaultTextConfig.fontFamily;
    const metadata = cloneMetadata(overlay.metadata) ?? {};
    if (requestedFont) {
        metadata['core.font'] = {
            ...(metadata['core.font'] ?? {}),
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
        width:
            overlay.geometry.width !== undefined
                ? normalizedLengthX(overlay.geometry.width, geometry)
                : context.options.defaultTextConfig.width,
        fontSize: overlay.style.fontSize ?? context.options.defaultTextConfig.fontSize,
        fontFamily,
        fontWeight: overlay.style.fontWeight ?? context.options.defaultTextConfig.fontWeight,
        fill: overlay.style.fill ?? context.options.defaultTextConfig.fill,
        backgroundColor:
            overlay.style.backgroundColor ?? context.options.defaultTextConfig.backgroundColor,
        textAlign: overlay.style.textAlign ?? context.options.defaultTextConfig.textAlign,
        lineHeight: overlay.style.lineHeight,
        angle:
            normalizeRotationDegrees(state.baseImageTransform?.rotation) +
            finiteNumber(overlay.geometry.angle),
        originX: 'left',
        originY: 'top',
        selectable: true,
        evented: true,
        editable: true,
    } as Partial<FabricNS.TextboxProps>);

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
    }) as TextAnnotationObject;
    if (Object.keys(metadata).length > 0) {
        (annotation as TextAnnotationObject & PersistentOverlayFields).overlayMetadata = metadata;
    }
    syncAnnotationRuntimeState(annotation);
    attachTextEditingHandlers(context.buildTextControllerContext(), annotation);
    return annotation;
}

function buildArrowPath(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    headLength: number,
): string {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const length = Math.max(1, headLength);
    const wingAngle = Math.PI / 7;
    const head1x = x2 - length * Math.cos(angle - wingAngle);
    const head1y = y2 - length * Math.sin(angle - wingAngle);
    const head2x = x2 - length * Math.cos(angle + wingAngle);
    const head2y = y2 - length * Math.sin(angle + wingAngle);
    return `M ${x1} ${y1} L ${x2} ${y2} M ${x2} ${y2} L ${head1x} ${head1y} M ${x2} ${y2} L ${head2x} ${head2y}`;
}

function createShapeObject(
    context: OverlayStateImportRuntimeContext,
    state: OverlayState,
    overlay: SerializedShapeAnnotationOverlay,
    geometry: CurrentImageGeometry,
): AnnotationObject {
    const style = {
        stroke: overlay.style.stroke ?? context.options.defaultShapeConfig.stroke,
        strokeWidth: overlay.style.strokeWidth ?? context.options.defaultShapeConfig.strokeWidth,
        fill: overlay.style.fill ?? context.options.defaultShapeConfig.fill,
        opacity: overlay.style.opacity ?? context.options.defaultShapeConfig.opacity,
        strokeDashArray: overlay.style.strokeDashArray ?? undefined,
        selectable: overlay.style.selectable ?? true,
        evented: overlay.style.evented ?? true,
        originX: 'left' as FabricNS.TOriginX,
        originY: 'top' as FabricNS.TOriginY,
    };
    let object: FabricNS.FabricObject;
    if (overlay.geometry.type === 'rect') {
        const point = canvasPointFromNormalized(
            { x: overlay.geometry.x, y: overlay.geometry.y },
            state,
            geometry,
        );
        object = new context.fabric.Rect({
            ...style,
            left: point.x,
            top: point.y,
            width: normalizedLengthX(overlay.geometry.width, geometry),
            height: normalizedLengthY(overlay.geometry.height, geometry),
            angle:
                normalizeRotationDegrees(state.baseImageTransform?.rotation) +
                finiteNumber(overlay.geometry.angle),
        } as Partial<FabricNS.RectProps>);
    } else {
        const start = canvasPointFromNormalized(
            { x: overlay.geometry.x1, y: overlay.geometry.y1 },
            state,
            geometry,
        );
        const end = canvasPointFromNormalized(
            { x: overlay.geometry.x2, y: overlay.geometry.y2 },
            state,
            geometry,
        );
        const path =
            overlay.geometry.type === 'arrow'
                ? buildArrowPath(
                      start.x,
                      start.y,
                      end.x,
                      end.y,
                      overlay.geometry.arrowHeadLength ??
                          context.options.defaultShapeConfig.arrowHeadLength,
                  )
                : `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
        object = new context.fabric.Path(path, {
            ...style,
            fill: '',
            strokeLineCap: 'round',
            strokeLineJoin: 'round',
            objectCaching: false,
            angle:
                normalizeRotationDegrees(state.baseImageTransform?.rotation) +
                finiteNumber(overlay.geometry.angle),
        } as Partial<FabricNS.PathProps>);
    }

    const annotationId = nextAnnotationId(context);
    const annotation = markAnnotationObject(object, {
        annotationId,
        annotationType: 'shape',
        annotationName: `${context.options.shapeAnnotationName}${annotationId}`,
        annotationSelectable: overlay.style.selectable ?? true,
        annotationEvented: overlay.style.evented ?? true,
        annotationHasControls: object.hasControls !== false,
        shapeAnnotationKind: overlay.shape,
        ...annotationBaseProps(overlay.locked),
    });
    syncAnnotationRuntimeState(annotation);
    return annotation;
}

function createDrawObject(
    context: OverlayStateImportRuntimeContext,
    state: OverlayState,
    overlay: SerializedDrawAnnotationOverlay,
    geometry: CurrentImageGeometry,
): AnnotationObject {
    const commands: string[] = [];
    const firstStroke = overlay.strokes[0];
    const brush = firstStroke?.brush ?? {
        color: context.options.defaultDrawConfig.color as `#${string}`,
        width: context.options.defaultDrawConfig.brushSize,
    };
    for (const stroke of overlay.strokes) {
        stroke.points.forEach((point: SerializedDrawPoint, index: number) => {
            const canvasPoint = canvasPointFromNormalized(point, state, geometry);
            commands.push(`${index === 0 ? 'M' : 'L'} ${canvasPoint.x} ${canvasPoint.y}`);
        });
    }
    const object = new context.fabric.Path(commands.join(' '), {
        fill: '',
        stroke: brush.color,
        strokeWidth: brush.width,
        opacity: brush.opacity ?? context.options.defaultDrawConfig.opacity,
        strokeLineCap: brush.lineCap ?? context.options.defaultDrawConfig.lineCap,
        strokeLineJoin: brush.lineJoin ?? context.options.defaultDrawConfig.lineJoin,
        selectable: true,
        evented: true,
        objectCaching: false,
    } as Partial<FabricNS.PathProps>);
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

function removeExistingOverlays(context: OverlayStateImportRuntimeContext): void {
    const objects = [...context.canvas.getObjects()];
    for (const object of objects) {
        if (isMaskObject(object)) {
            context.removeLabelForMask(object);
            detachMaskHoverHandlers(object);
            context.canvas.remove(object);
        } else if (isAnnotationObject(object)) {
            context.canvas.remove(object);
        }
    }
    context.canvas.discardActiveObject();
    context.setLastMask(null);
}

function readExistingPersistentIds(canvas: FabricNS.Canvas): Set<string> {
    const ids = new Set<string>();
    canvas.getObjects().forEach((object) => {
        const id = (object as PersistentOverlayFields).overlayPersistentId;
        if (typeof id === 'string') ids.add(id);
    });
    return ids;
}

function computeTopLeftPoint(object: FabricNS.FabricObject): FabricNS.Point {
    object.setCoords();
    const coords = object.getCoords();
    const first = coords[0];
    if (first) return first as unknown as FabricNS.Point;
    const boundingRect = object.getBoundingRect();
    return { x: boundingRect.left, y: boundingRect.top } as unknown as FabricNS.Point;
}

function applyBaseTransformToImage(
    context: OverlayStateImportRuntimeContext,
    transform: OverlayBaseImageTransform | undefined,
): void {
    if (transform === undefined) return;

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

function skipCustomOverlay(
    overlay: SerializedCustomOverlay,
    result: ImportOverlayStateResult,
): void {
    result.skippedOverlays += 1;
    result.warnings.push({
        code: 'custom.unknownType',
        path: `overlays.${overlay.id}`,
        message: `Custom overlay type "${overlay.customType}" has no registered importer and was skipped.`,
        details: { customType: overlay.customType },
    });
}

export async function importOverlayStateIntoEditor(
    context: OverlayStateImportRuntimeContext,
    state: OverlayState,
    options: ImportOverlayStateOptions = {},
): Promise<ImportOverlayStateResult> {
    const result: ImportOverlayStateResult = {
        importedOverlays: 0,
        importedMasks: 0,
        importedAnnotations: 0,
        skippedOverlays: 0,
        regeneratedIds: [],
        warnings: [],
    };
    const mode = options.mode ?? 'replace';
    if (mode === 'replace') removeExistingOverlays(context);

    applyBaseTransformToImage(context, state.baseImageTransform);
    const geometry = createImportGeometry(context.originalImage, state.baseImageTransform);
    const existingPersistentIds = readExistingPersistentIds(context.canvas);
    const importedObjects: Array<MaskObject | AnnotationObject> = [];

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
            const persistentId = newPersistentId(
                overlay,
                'mask',
                mask.maskId,
                options,
                existingPersistentIds,
                result,
            );
            assignPersistentFields(mask, overlay, persistentId);
            placeMaskObject(context.canvas, mask);
            context.setLastMask(mask);
            importedObjects.push(mask);
            result.importedOverlays += 1;
            result.importedMasks += 1;
            continue;
        }

        let annotation: AnnotationObject;
        if (overlay.annotationType === 'text') {
            annotation = createTextObject(context, state, overlay, geometry, result.warnings);
        } else if (overlay.annotationType === 'shape') {
            annotation = createShapeObject(context, state, overlay, geometry);
        } else {
            annotation = createDrawObject(context, state, overlay, geometry);
        }
        const persistentId = newPersistentId(
            overlay,
            'annotation',
            annotation.annotationId,
            options,
            existingPersistentIds,
            result,
        );
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
