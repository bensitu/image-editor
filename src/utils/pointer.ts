/**
 * Fabric event pointer extraction helpers.
 *
 * Supports Fabric v7 `scenePoint`, older pointer fields, and the
 * `canvas.getPointer(event.e)` fallback used by controller event handlers.
 *
 * @module
 */

import type * as FabricNS from 'fabric';

export interface CanvasPoint {
    x: number;
    y: number;
}

export function isFinitePoint(value: unknown): value is CanvasPoint {
    const point = value as { x?: unknown; y?: unknown } | null | undefined;
    return (
        !!point &&
        typeof point.x === 'number' &&
        Number.isFinite(point.x) &&
        typeof point.y === 'number' &&
        Number.isFinite(point.y)
    );
}

export function getPointerFromFabricEvent(
    canvas: FabricNS.Canvas,
    event: unknown,
): CanvasPoint | null {
    const fabricEvent =
        event && typeof event === 'object'
            ? (event as {
                  scenePoint?: unknown;
                  pointer?: unknown;
                  absolutePointer?: unknown;
                  e?: Event;
              })
            : null;
    if (!fabricEvent) return null;

    if (isFinitePoint(fabricEvent.scenePoint)) return { ...fabricEvent.scenePoint };
    if (isFinitePoint(fabricEvent.pointer)) return { ...fabricEvent.pointer };
    if (isFinitePoint(fabricEvent.absolutePointer)) return { ...fabricEvent.absolutePointer };

    if (fabricEvent.e && typeof (canvas as { getPointer?: unknown }).getPointer === 'function') {
        const pointer = (canvas as unknown as { getPointer(e: Event): unknown }).getPointer(
            fabricEvent.e,
        );
        if (isFinitePoint(pointer)) return { ...pointer };
    }

    return null;
}
