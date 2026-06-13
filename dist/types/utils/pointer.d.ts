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
export declare function isFinitePoint(value: unknown): value is CanvasPoint;
export declare function getPointerFromFabricEvent(canvas: FabricNS.Canvas, event: unknown): CanvasPoint | null;
//# sourceMappingURL=pointer.d.ts.map