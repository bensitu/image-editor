/**
 * Draw annotation mode controller.
 *
 * Owns Fabric free-drawing setup, draw-session teardown, and conversion of
 * completed paths into editor-owned annotation objects.
 *
 * @module
 */
import type * as FabricNS from 'fabric';
import { type DrawSubMode, type FabricModule, type ImageEditorCallbackContext, type ResolvedDrawConfig, type ResolvedEraserConfig, type ResolvedOptions, type SessionObject } from '../core/public-types.js';
export interface DrawSession {
    mode: 'draw';
    subMode: DrawSubMode;
    previousDrawingMode: boolean;
    previousBrush: unknown;
    previousCanvasSelection: boolean;
    previousDefaultCursor: string | undefined;
    eraserPreview: (FabricNS.Circle & SessionObject) | null;
    eraserPoints: Array<{
        x: number;
        y: number;
    }>;
    isErasing: boolean;
    handlers: Array<{
        eventName: string;
        callback: (event: unknown) => void;
    }>;
    dispose(): void;
}
export interface DrawControllerContext {
    readonly fabric: FabricModule;
    readonly canvas: FabricNS.Canvas;
    readonly options: ResolvedOptions;
    getDrawConfig(): ResolvedDrawConfig;
    getEraserConfig(): ResolvedEraserConfig;
    isImageLoaded(): boolean;
    getAnnotationCounter(): number;
    setAnnotationCounter(value: number): void;
    getDrawSession(): DrawSession | null;
    setDrawSession(session: DrawSession | null): void;
    saveCanvasState(): void;
    updateAnnotationList(): void;
    updateUi(): void;
    emitAnnotationsChanged(context: ImageEditorCallbackContext): void;
    emitImageChanged(context: ImageEditorCallbackContext): void;
    buildCallbackContext(operation: 'enterDrawMode' | 'exitDrawMode' | 'createDrawAnnotation' | 'commitEraserStroke'): ImageEditorCallbackContext;
}
export declare function enterDrawMode(context: DrawControllerContext): void;
export declare function exitDrawMode(context: DrawControllerContext): void;
export declare function updateDrawBrush(context: DrawControllerContext): void;
export declare function setDrawSubMode(context: DrawControllerContext, subMode: DrawSubMode): void;
export declare function updateEraserPreview(context: DrawControllerContext): void;
