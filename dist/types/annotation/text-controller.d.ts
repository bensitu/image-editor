/**
 * Text annotation creation and Text mode controller.
 *
 * Owns default text placement, inline editing setup, Text mode click handling,
 * and conversion of Fabric text objects into editor-owned annotations.
 *
 * @module
 */
import type * as FabricNS from 'fabric';
import { type AnnotationObject, type FabricModule, type ImageEditorCallbackContext, type ResolvedOptions, type ResolvedTextAnnotationConfig, type TextAnnotationConfig, type TextAnnotationObject } from '../core/public-types.js';
export interface TextSession {
    mode: 'text';
    previousCanvasSelection: boolean;
    previousDefaultCursor: string | undefined;
    handlers: Array<{
        eventName: string;
        callback: (event: unknown) => void;
    }>;
    dispose(): void;
}
export interface TextControllerContext {
    readonly fabric: FabricModule;
    readonly canvas: FabricNS.Canvas;
    readonly options: ResolvedOptions;
    getOriginalImage(): FabricNS.FabricImage | null;
    getTextConfig(): ResolvedTextAnnotationConfig;
    isImageLoaded(): boolean;
    getAnnotationCounter(): number;
    setAnnotationCounter(value: number): void;
    getTextSession(): TextSession | null;
    setTextSession(session: TextSession | null): void;
    saveCanvasState(): void;
    updateAnnotationList(): void;
    updateUi(): void;
    emitAnnotationsChanged(context: ImageEditorCallbackContext): void;
    emitImageChanged(context: ImageEditorCallbackContext): void;
    buildCallbackContext(operation: 'createTextAnnotation' | 'enterTextMode' | 'exitTextMode' | 'updateAnnotation'): ImageEditorCallbackContext;
}
export declare function attachTextEditingHandlers(context: TextControllerContext, annotation: TextAnnotationObject): void;
export declare function createTextAnnotation(context: TextControllerContext, config?: TextAnnotationConfig): TextAnnotationObject | null;
export declare function enterTextMode(context: TextControllerContext): void;
export declare function exitTextMode(context: TextControllerContext): void;
export declare function finalizeActiveTextEditing(context: TextControllerContext, options: {
    commit: boolean;
}): void;
export declare function attachTextEditingHandlersToAnnotations(context: TextControllerContext, annotations: AnnotationObject[]): void;
//# sourceMappingURL=text-controller.d.ts.map