/**
 * Annotation configuration action adapters for Text and Draw tools.
 *
 * These helpers normalize runtime config patches, apply live tool updates,
 * and route selected-annotation style changes through the facade callbacks.
 */
import type * as FabricNS from 'fabric';
import { type AnnotationUpdateConfig, type DrawConfig, type ImageEditorCallbackContext, type ImageEditorOperation, type ResolvedDrawConfig, type ResolvedTextAnnotationConfig, type TextAnnotationConfig } from '../core/public-types.js';
import { type DrawControllerContext } from './draw-controller.js';
export interface AnnotationConfigActionAccess {
    getCanvas(): FabricNS.Canvas | null;
    isTextMode(): boolean;
    isDrawMode(): boolean;
    getCurrentTextConfig(): ResolvedTextAnnotationConfig;
    setCurrentTextConfig(config: ResolvedTextAnnotationConfig): void;
    getDefaultTextConfig(): ResolvedTextAnnotationConfig;
    getCurrentDrawConfig(): ResolvedDrawConfig;
    setCurrentDrawConfig(config: ResolvedDrawConfig): void;
    getDefaultDrawConfig(): ResolvedDrawConfig;
    canRunIdleOperation(operation: ImageEditorOperation): boolean;
    buildDrawControllerContext(): DrawControllerContext;
    buildCallbackContext(operation: ImageEditorOperation, isInternalOperation: boolean): ImageEditorCallbackContext;
    updateSelectedAnnotation(config: AnnotationUpdateConfig): void;
    setTextColor(color: string): void;
    setTextFontSize(size: number): void;
    setDrawColor(color: string): void;
    setDrawBrushSize(size: number): void;
    reportWarning(error: unknown, message: string): void;
    updateInputs(): void;
    updateUi(): void;
    emitImageChanged(context: ImageEditorCallbackContext): void;
}
export declare function applyTextConfigPatchAction(access: AnnotationConfigActionAccess, config: TextAnnotationConfig, operation: ImageEditorOperation): void;
export declare function applyDrawConfigPatchAction(access: AnnotationConfigActionAccess, config: DrawConfig, operation: ImageEditorOperation): void;
export declare function applyTextColorInputAction(access: AnnotationConfigActionAccess, color: string): void;
export declare function applyTextFontSizeInputAction(access: AnnotationConfigActionAccess, size: number): void;
export declare function applyDrawColorInputAction(access: AnnotationConfigActionAccess, color: string): void;
export declare function applyDrawBrushSizeInputAction(access: AnnotationConfigActionAccess, size: number): void;
//# sourceMappingURL=annotation-config-actions.d.ts.map