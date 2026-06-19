import type * as FabricNS from 'fabric';
import type { ImageEditorCallbackContext, ImageEditorOperation, TextAnnotationConfig, TextAnnotationObject } from '../core/public-types.js';
import type { DrawControllerContext, DrawSession } from './draw-controller.js';
import type { TextControllerContext, TextSession } from './text-controller.js';
export interface AnnotationModeActionAccess {
    getCanvas(): FabricNS.Canvas | null;
    getTextSession(): TextSession | null;
    getDrawSession(): DrawSession | null;
    isToolModeActive(): boolean;
    canRunIdleOperation(operation: ImageEditorOperation): boolean;
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
//# sourceMappingURL=annotation-mode-actions.d.ts.map