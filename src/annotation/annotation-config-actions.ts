/**
 * Annotation configuration action adapters for Text and Draw tools.
 *
 * These helpers normalize runtime config patches, apply live tool updates,
 * and route selected-annotation style changes through the facade callbacks.
 */

import type * as FabricNS from 'fabric';

import {
    areResolvedDrawConfigsEqual,
    areResolvedTextAnnotationConfigsEqual,
    getInvalidDrawConfigFields,
    getInvalidTextAnnotationConfigFields,
    mergeDrawConfigPatch,
    mergeTextAnnotationConfigPatch,
} from '../core/default-options.js';
import {
    isDrawAnnotationObject,
    isTextAnnotationObject,
    type AnnotationUpdateConfig,
    type DrawConfig,
    type ImageEditorCallbackContext,
    type ImageEditorOperation,
    type ResolvedDrawConfig,
    type ResolvedTextAnnotationConfig,
    type TextAnnotationConfig,
} from '../core/public-types.js';
import { updateDrawBrush, type DrawControllerContext } from './draw-controller.js';

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

    canRunIdleOperation(operation: ImageEditorOperation, options?: object | null): boolean;
    buildDrawControllerContext(): DrawControllerContext;
    buildCallbackContext(
        operation: ImageEditorOperation,
        isInternalOperation: boolean,
    ): ImageEditorCallbackContext;

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

export function applyTextConfigPatchAction(
    access: AnnotationConfigActionAccess,
    config: TextAnnotationConfig,
    operation: ImageEditorOperation,
): void {
    if (!access.canRunIdleOperation(operation)) return;
    const invalidFields = getInvalidTextAnnotationConfigFields(config);
    if (invalidFields.length > 0) {
        access.reportWarning(
            null,
            `${operation} ignored invalid Text config fields: ${invalidFields.join(', ')}.`,
        );
    }
    const next = mergeTextAnnotationConfigPatch(
        access.getCurrentTextConfig(),
        config,
        access.getDefaultTextConfig(),
    );
    if (areResolvedTextAnnotationConfigsEqual(access.getCurrentTextConfig(), next)) return;

    access.setCurrentTextConfig(next);
    access.updateInputs();
    access.updateUi();
    access.emitImageChanged(access.buildCallbackContext(operation, false));
}

export function applyDrawConfigPatchAction(
    access: AnnotationConfigActionAccess,
    config: DrawConfig,
    operation: ImageEditorOperation,
): void {
    if (!access.canRunIdleOperation(operation)) return;
    const invalidFields = getInvalidDrawConfigFields(config);
    if (invalidFields.length > 0) {
        access.reportWarning(
            null,
            `${operation} ignored invalid Draw config fields: ${invalidFields.join(', ')}.`,
        );
    }
    const next = mergeDrawConfigPatch(
        access.getCurrentDrawConfig(),
        config,
        access.getDefaultDrawConfig(),
    );
    if (areResolvedDrawConfigsEqual(access.getCurrentDrawConfig(), next)) return;

    access.setCurrentDrawConfig(next);
    updateDrawBrush(access.buildDrawControllerContext());
    access.updateInputs();
    access.updateUi();
    access.emitImageChanged(access.buildCallbackContext(operation, false));
}

export function applyTextColorInputAction(
    access: AnnotationConfigActionAccess,
    color: string,
): void {
    if (access.isTextMode()) {
        access.setTextColor(color);
        return;
    }
    const selected = access.getCanvas()?.getActiveObject();
    if (selected && isTextAnnotationObject(selected)) {
        access.updateSelectedAnnotation({ fill: color });
        return;
    }
    access.setTextColor(color);
}

export function applyTextFontSizeInputAction(
    access: AnnotationConfigActionAccess,
    size: number,
): void {
    if (access.isTextMode()) {
        access.setTextFontSize(size);
        return;
    }
    const selected = access.getCanvas()?.getActiveObject();
    if (selected && isTextAnnotationObject(selected)) {
        access.updateSelectedAnnotation({ fontSize: size });
        return;
    }
    access.setTextFontSize(size);
}

export function applyDrawColorInputAction(
    access: AnnotationConfigActionAccess,
    color: string,
): void {
    if (access.isDrawMode()) {
        access.setDrawColor(color);
        return;
    }
    const selected = access.getCanvas()?.getActiveObject();
    if (selected && isDrawAnnotationObject(selected)) {
        access.updateSelectedAnnotation({ stroke: color });
        return;
    }
    access.setDrawColor(color);
}

export function applyDrawBrushSizeInputAction(
    access: AnnotationConfigActionAccess,
    size: number,
): void {
    if (access.isDrawMode()) {
        access.setDrawBrushSize(size);
        return;
    }
    const selected = access.getCanvas()?.getActiveObject();
    if (selected && isDrawAnnotationObject(selected)) {
        access.updateSelectedAnnotation({ strokeWidth: size });
        return;
    }
    access.setDrawBrushSize(size);
}
