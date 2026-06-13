/**
 * Layer-order helpers for editor-owned Fabric objects.
 *
 * The invariant is base images at the bottom, host objects next, editable
 * overlays above them, and session-only objects at the top.
 *
 * @module
 */

import type * as FabricNS from 'fabric';

import {
    isBaseImageObject,
    isEditableOverlayObject,
    isSessionObject,
    type AnnotationObject,
    type BaseImageObject,
    type MaskObject,
    type SessionObject,
} from './public-types.js';

type CanvasWithLayerApi = FabricNS.Canvas & {
    moveObjectTo?: (object: FabricNS.FabricObject, index: number) => boolean;
};

function isLegacySessionObject(object: FabricNS.FabricObject): boolean {
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
    if (!canvas.getObjects().includes(object)) {
        canvas.add(object);
    }
}

function withoutObject(
    canvas: FabricNS.Canvas,
    object: FabricNS.FabricObject,
): FabricNS.FabricObject[] {
    return canvas.getObjects().filter((candidate) => candidate !== object);
}

function findFirstSessionIndex(objects: FabricNS.FabricObject[]): number {
    return objects.findIndex((object) => isSessionObject(object) || isLegacySessionObject(object));
}

function getOrderedGroups(canvas: FabricNS.Canvas): {
    baseImages: BaseImageObject[];
    overlays: Array<MaskObject | AnnotationObject>;
    sessions: SessionObject[];
    others: FabricNS.FabricObject[];
} {
    const baseImages: BaseImageObject[] = [];
    const overlays: Array<MaskObject | AnnotationObject> = [];
    const sessions: SessionObject[] = [];
    const others: FabricNS.FabricObject[] = [];

    for (const object of canvas.getObjects()) {
        if (isBaseImageObject(object)) {
            baseImages.push(object);
        } else if (isEditableOverlayObject(object)) {
            overlays.push(object);
        } else if (isSessionObject(object) || isLegacySessionObject(object)) {
            sessions.push(object as SessionObject);
        } else {
            others.push(object);
        }
    }

    return { baseImages, overlays, sessions, others };
}

export function normalizeLayerOrder(canvas: FabricNS.Canvas): void {
    const groups = getOrderedGroups(canvas);
    const ordered: FabricNS.FabricObject[] = [
        ...groups.baseImages,
        ...groups.others,
        ...groups.overlays,
        ...groups.sessions,
    ];

    ordered.forEach((object, index) => {
        moveObjectTo(canvas, object, index);
    });
}

export function placeBaseImageObject(canvas: FabricNS.Canvas, image: BaseImageObject): void {
    ensureOnCanvas(canvas, image);
    const targetIndex = withoutObject(canvas, image).filter(isBaseImageObject).length;
    moveObjectTo(canvas, image, targetIndex);
}

export function placeMaskObject(canvas: FabricNS.Canvas, mask: MaskObject): void {
    ensureOnCanvas(canvas, mask);
    const objects = withoutObject(canvas, mask);
    const firstSessionIndex = findFirstSessionIndex(objects);
    moveObjectTo(canvas, mask, firstSessionIndex === -1 ? objects.length : firstSessionIndex);
}

export function placeAnnotationObject(canvas: FabricNS.Canvas, annotation: AnnotationObject): void {
    ensureOnCanvas(canvas, annotation);
    const objects = withoutObject(canvas, annotation);
    const firstSessionIndex = findFirstSessionIndex(objects);
    moveObjectTo(canvas, annotation, firstSessionIndex === -1 ? objects.length : firstSessionIndex);
}

export function placeSessionObject(canvas: FabricNS.Canvas, sessionObject: SessionObject): void {
    ensureOnCanvas(canvas, sessionObject);
    moveObjectTo(canvas, sessionObject, withoutObject(canvas, sessionObject).length);
}

export function getEditableOverlayRange(canvas: FabricNS.Canvas): {
    start: number;
    end: number;
    overlays: Array<MaskObject | AnnotationObject>;
} {
    const objects = canvas.getObjects();
    const overlayIndexes = objects
        .map((object, index) => ({ object, index }))
        .filter(({ object }) => isEditableOverlayObject(object));
    if (overlayIndexes.length === 0) return { start: -1, end: -1, overlays: [] };
    return {
        start: overlayIndexes[0]!.index,
        end: overlayIndexes[overlayIndexes.length - 1]!.index,
        overlays: overlayIndexes.map(({ object }) => object as MaskObject | AnnotationObject),
    };
}
