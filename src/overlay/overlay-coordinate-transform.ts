/**
 * Coordinate helpers for the overlay persistence wire format.
 *
 * Persisted overlay coordinates live in original image pixel space normalized
 * to [0, 1]. Runtime canvas coordinates are derived by applying the base image
 * transform around the original image center, then applying the current image
 * scale and canvas center.
 *
 * @module
 */

import type { OverlayBaseImageTransform, OverlayImageInfo } from './overlay-state-types.js';

export interface OverlayPoint {
    x: number;
    y: number;
}

export interface CurrentImageGeometry {
    naturalWidth: number;
    naturalHeight: number;
    canvasCenterX: number;
    canvasCenterY: number;
    scaleX: number;
    scaleY: number;
    transform?: OverlayBaseImageTransform;
}

export function normalizeRotationDegrees(rotation: number | undefined): number {
    const value = Number(rotation ?? 0);
    if (!Number.isFinite(value)) return 0;
    return ((value % 360) + 360) % 360;
}

export function imageNormalizedToSourcePixel(
    point: OverlayPoint,
    imageInfo: OverlayImageInfo,
): OverlayPoint {
    return {
        x: point.x * imageInfo.naturalWidth,
        y: point.y * imageInfo.naturalHeight,
    };
}

export function sourcePixelToImageNormalized(
    point: OverlayPoint,
    imageInfo: OverlayImageInfo,
): OverlayPoint {
    return {
        x: point.x / imageInfo.naturalWidth,
        y: point.y / imageInfo.naturalHeight,
    };
}

export function applyBaseImageTransform(
    point: OverlayPoint,
    imageInfo: OverlayImageInfo,
    transform: OverlayBaseImageTransform | undefined,
): OverlayPoint {
    const centerX = imageInfo.naturalWidth / 2;
    const centerY = imageInfo.naturalHeight / 2;
    let x = point.x - centerX;
    let y = point.y - centerY;

    if (transform?.flipX === true) x = -x;
    if (transform?.flipY === true) y = -y;

    const radians = (normalizeRotationDegrees(transform?.rotation) * Math.PI) / 180;
    if (radians !== 0) {
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);
        const nextX = x * cos - y * sin;
        const nextY = x * sin + y * cos;
        x = nextX;
        y = nextY;
    }

    return { x: centerX + x, y: centerY + y };
}

export function unapplyBaseImageTransform(
    point: OverlayPoint,
    imageInfo: OverlayImageInfo,
    transform: OverlayBaseImageTransform | undefined,
): OverlayPoint {
    const centerX = imageInfo.naturalWidth / 2;
    const centerY = imageInfo.naturalHeight / 2;
    let x = point.x - centerX;
    let y = point.y - centerY;

    const radians = (-normalizeRotationDegrees(transform?.rotation) * Math.PI) / 180;
    if (radians !== 0) {
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);
        const nextX = x * cos - y * sin;
        const nextY = x * sin + y * cos;
        x = nextX;
        y = nextY;
    }

    if (transform?.flipY === true) y = -y;
    if (transform?.flipX === true) x = -x;

    return { x: centerX + x, y: centerY + y };
}

export function sourcePixelToCanvas(
    point: OverlayPoint,
    geometry: CurrentImageGeometry,
): OverlayPoint {
    const transformed = applyBaseImageTransform(
        point,
        {
            naturalWidth: geometry.naturalWidth,
            naturalHeight: geometry.naturalHeight,
        },
        geometry.transform,
    );
    return {
        x: geometry.canvasCenterX + (transformed.x - geometry.naturalWidth / 2) * geometry.scaleX,
        y: geometry.canvasCenterY + (transformed.y - geometry.naturalHeight / 2) * geometry.scaleY,
    };
}

export function canvasToSourcePixel(
    point: OverlayPoint,
    geometry: CurrentImageGeometry,
): OverlayPoint {
    const transformed = {
        x: geometry.naturalWidth / 2 + (point.x - geometry.canvasCenterX) / geometry.scaleX,
        y: geometry.naturalHeight / 2 + (point.y - geometry.canvasCenterY) / geometry.scaleY,
    };
    return unapplyBaseImageTransform(
        transformed,
        {
            naturalWidth: geometry.naturalWidth,
            naturalHeight: geometry.naturalHeight,
        },
        geometry.transform,
    );
}

export function getTransformedRectBounds(
    rect: { x: number; y: number; width: number; height: number },
    imageInfo: OverlayImageInfo,
    transform: OverlayBaseImageTransform | undefined,
): { x: number; y: number; width: number; height: number } {
    const corners = [
        { x: rect.x, y: rect.y },
        { x: rect.x + rect.width, y: rect.y },
        { x: rect.x, y: rect.y + rect.height },
        { x: rect.x + rect.width, y: rect.y + rect.height },
    ].map((point) => applyBaseImageTransform(point, imageInfo, transform));
    const xs = corners.map((point) => point.x);
    const ys = corners.map((point) => point.y);
    const left = Math.min(...xs);
    const top = Math.min(...ys);
    const right = Math.max(...xs);
    const bottom = Math.max(...ys);
    return {
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
    };
}
