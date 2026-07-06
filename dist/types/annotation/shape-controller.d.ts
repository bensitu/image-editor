/**
 * Creates shape annotation objects and manages interactive Shape mode sessions.
 *
 * @module
 */
import type * as FabricNS from 'fabric';
import { type FabricModule, type ImageEditorCallbackContext, type ResolvedOptions, type ResolvedShapeAnnotationConfig, type ShapeAnnotationConfig, type ShapeAnnotationKind, type ShapeAnnotationObject } from '../core/public-types.js';
export interface ShapeSession {
    mode: 'shape';
    shape: ShapeAnnotationKind;
    previousCanvasSelection: boolean;
    previousDefaultCursor: string | undefined;
    startPoint: {
        x: number;
        y: number;
    } | null;
    previewObject: FabricNS.FabricObject | null;
    handlers: Array<{
        eventName: string;
        callback: (event: unknown) => void;
    }>;
    dispose(): void;
}
export interface ShapeControllerContext {
    readonly fabric: FabricModule;
    readonly canvas: FabricNS.Canvas;
    readonly options: ResolvedOptions;
    getOriginalImage(): FabricNS.FabricImage | null;
    getShapeConfig(): ResolvedShapeAnnotationConfig;
    isImageLoaded(): boolean;
    getAnnotationCounter(): number;
    setAnnotationCounter(value: number): void;
    getShapeSession(): ShapeSession | null;
    setShapeSession(session: ShapeSession | null): void;
    saveCanvasState(): void;
    updateAnnotationList(): void;
    updateUi(): void;
    emitAnnotationsChanged(context: ImageEditorCallbackContext): void;
    emitImageChanged(context: ImageEditorCallbackContext): void;
    buildCallbackContext(operation: 'createShapeAnnotation' | 'enterShapeMode' | 'exitShapeMode'): ImageEditorCallbackContext;
}
export declare function createShapeAnnotation(context: ShapeControllerContext, config?: ShapeAnnotationConfig): ShapeAnnotationObject | null;
export declare function enterShapeMode(context: ShapeControllerContext, shape: ShapeAnnotationKind): void;
export declare function exitShapeMode(context: ShapeControllerContext): void;
