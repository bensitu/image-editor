/**
 * Places editor-owned raster visuals, Masks, and transient session objects in stable Canvas bands.
 *
 * Core owns Base Image placement. The Overlay Foundation owns persistent Annotation ordering. This
 * helper covers the remaining shared objects: raster previews sit above Base Images, Masks stay
 * below session UI, and session objects remain at the top of the Canvas stack.
 *
 * @module
 */

import type * as FabricNS from 'fabric';

import {
    isBaseImageObject,
    isSessionObject,
    type MaskObject,
    type SessionObject,
    type SessionObjectType,
} from '../core/public-types.js';

type CanvasWithLayerApi = FabricNS.Canvas & {
    moveObjectTo?: (object: FabricNS.FabricObject, index: number) => boolean;
};

interface InternalLayerObject extends FabricNS.FabricObject {
    editorLayerRole: 'rasterVisual' | 'session';
}

interface RasterVisualObject extends InternalLayerObject {
    editorLayerRole: 'rasterVisual';
}

function isRasterVisualObject(object: FabricNS.FabricObject): object is RasterVisualObject {
    return (
        (object as FabricNS.FabricObject & { editorLayerRole?: unknown }).editorLayerRole ===
        'rasterVisual'
    );
}

function isInternallyMarkedSessionObject(object: FabricNS.FabricObject): boolean {
    return (
        (object as FabricNS.FabricObject & { editorLayerRole?: unknown }).editorLayerRole ===
        'session'
    );
}

function isPropertyMarkedSessionObject(object: FabricNS.FabricObject): boolean {
    const candidate = object as {
        isCropRect?: unknown;
        maskLabel?: unknown;
        isMosaicPreview?: unknown;
    };
    return (
        candidate.isCropRect === true ||
        candidate.maskLabel === true ||
        candidate.isMosaicPreview === true
    );
}

function moveObjectTo(canvas: FabricNS.Canvas, object: FabricNS.FabricObject, index: number): void {
    const canvasWithLayerApi = canvas as CanvasWithLayerApi;
    if (typeof canvasWithLayerApi.moveObjectTo === 'function') {
        canvasWithLayerApi.moveObjectTo(object, index);
        return;
    }

    try {
        canvas.remove(object);
        canvas.insertAt(index, object);
    } catch {
        canvas.add(object);
    }
}

function ensureOnCanvas(canvas: FabricNS.Canvas, object: FabricNS.FabricObject): void {
    if (!canvas.getObjects().includes(object)) canvas.add(object);
}

function withoutObject(
    canvas: FabricNS.Canvas,
    object: FabricNS.FabricObject,
): FabricNS.FabricObject[] {
    return canvas.getObjects().filter((candidate) => candidate !== object);
}

function findFirstSessionIndex(objects: FabricNS.FabricObject[]): number {
    return objects.findIndex(
        (object) =>
            isSessionObject(object) ||
            isInternallyMarkedSessionObject(object) ||
            isPropertyMarkedSessionObject(object),
    );
}

export function markRasterVisualObject<T extends FabricNS.FabricObject>(
    object: T,
): T & RasterVisualObject {
    const rasterVisual = object as T & RasterVisualObject;
    rasterVisual.editorLayerRole = 'rasterVisual';
    return rasterVisual;
}

export function placeRasterVisualObject(
    canvas: FabricNS.Canvas,
    rasterVisual: FabricNS.FabricObject,
): void {
    const markedVisual = markRasterVisualObject(rasterVisual);
    ensureOnCanvas(canvas, markedVisual);
    const objects = withoutObject(canvas, markedVisual);
    const targetIndex =
        objects.filter(isBaseImageObject).length + objects.filter(isRasterVisualObject).length;
    moveObjectTo(canvas, markedVisual, targetIndex);
}

export function placeMaskObject(canvas: FabricNS.Canvas, mask: MaskObject): void {
    ensureOnCanvas(canvas, mask);
    const objects = withoutObject(canvas, mask);
    const firstSessionIndex = findFirstSessionIndex(objects);
    moveObjectTo(canvas, mask, firstSessionIndex === -1 ? objects.length : firstSessionIndex);
}

export function markSessionObject<T extends FabricNS.FabricObject>(
    object: T,
    sessionObjectType: SessionObjectType,
): T & SessionObject {
    const sessionObject = object as T & SessionObject;
    sessionObject.editorObjectKind = 'session';
    sessionObject.sessionObjectType = sessionObjectType;
    return sessionObject;
}

export function placeSessionObject(
    canvas: FabricNS.Canvas,
    sessionObject: FabricNS.FabricObject,
): void {
    (sessionObject as InternalLayerObject).editorLayerRole = 'session';
    ensureOnCanvas(canvas, sessionObject);
    moveObjectTo(canvas, sessionObject, withoutObject(canvas, sessionObject).length);
}
