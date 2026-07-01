/**
 * Annotation mode action adapters for Text and Draw sessions.
 *
 * The facade uses these helpers to guard mode entry/exit and to delegate
 * session object creation to the focused controllers.
 */
import type * as FabricNS from 'fabric';
import type { ImageEditorCallbackContext, ImageEditorOperation, TextAnnotationConfig, TextAnnotationObject } from '../core/public-types.js';
import type { DrawControllerContext, DrawSession } from './draw-controller.js';
import type { TextControllerContext, TextSession } from './text-controller.js';
export interface AnnotationModeActionAccess {
    getCanvas(): FabricNS.Canvas | null;
    getTextSession(): TextSession | null;
    getDrawSession(): DrawSession | null;
    isToolModeActive(): boolean;
    canRunIdleOperation(operation: ImageEditorOperation, options?: object | null): boolean;
    buildTextControllerContext(): TextControllerContext;
    buildDrawControllerContext(): DrawControllerContext;
    buildCallbackContext(operation: ImageEditorOperation, isInternalOperation: boolean): ImageEditorCallbackContext;
    emitBusyChangeIfChanged(context: ImageEditorCallbackContext): void;
    emitImageChanged(context: ImageEditorCallbackContext): void;
}
export declare function enterTextModeAction(access: AnnotationModeActionAccess): void;
export declare function exitTextModeAction(access: AnnotationModeActionAccess): void;
export declare function createTextAnnotationAction(access: AnnotationModeActionAccess, config?: TextAnnotationConfig): TextAnnotationObject | null;
export declare function enterDrawModeAction(access: AnnotationModeActionAccess): void;
export declare function exitDrawModeAction(access: AnnotationModeActionAccess): void;
