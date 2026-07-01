/**
 * Annotation mode action adapters for Text and Draw sessions.
 *
 * The facade uses these helpers to guard mode entry/exit and to delegate
 * session object creation to the focused controllers.
 */

import type * as FabricNS from 'fabric';

import type {
    ImageEditorCallbackContext,
    ImageEditorOperation,
    TextAnnotationConfig,
    TextAnnotationObject,
} from '../core/public-types.js';
import type { DrawControllerContext, DrawSession } from './draw-controller.js';
import {
    enterDrawMode as enterDrawModeImpl,
    exitDrawMode as exitDrawModeImpl,
} from './draw-controller.js';
import type { TextControllerContext, TextSession } from './text-controller.js';
import {
    createTextAnnotation as createTextAnnotationImpl,
    enterTextMode as enterTextModeImpl,
    exitTextMode as exitTextModeImpl,
} from './text-controller.js';

export interface AnnotationModeActionAccess {
    getCanvas(): FabricNS.Canvas | null;
    getTextSession(): TextSession | null;
    getDrawSession(): DrawSession | null;
    isToolModeActive(): boolean;
    canRunIdleOperation(operation: ImageEditorOperation, options?: object | null): boolean;
    buildTextControllerContext(): TextControllerContext;
    buildDrawControllerContext(): DrawControllerContext;
    buildCallbackContext(
        operation: ImageEditorOperation,
        isInternalOperation: boolean,
    ): ImageEditorCallbackContext;
    emitBusyChangeIfChanged(context: ImageEditorCallbackContext): void;
    emitImageChanged(context: ImageEditorCallbackContext): void;
}

export function enterTextModeAction(access: AnnotationModeActionAccess): void {
    if (!access.getCanvas()) return;
    if (!access.canRunIdleOperation('enterTextMode')) return;
    if (access.isToolModeActive()) return;
    enterTextModeImpl(access.buildTextControllerContext());
    const callbackContext = access.buildCallbackContext('enterTextMode', false);
    access.emitBusyChangeIfChanged(callbackContext);
    access.emitImageChanged(callbackContext);
}

export function exitTextModeAction(access: AnnotationModeActionAccess): void {
    if (!access.getCanvas() || !access.getTextSession()) return;
    if (!access.canRunIdleOperation('exitTextMode')) return;
    exitTextModeImpl(access.buildTextControllerContext());
    const callbackContext = access.buildCallbackContext('exitTextMode', false);
    access.emitBusyChangeIfChanged(callbackContext);
    access.emitImageChanged(callbackContext);
}

export function createTextAnnotationAction(
    access: AnnotationModeActionAccess,
    config: TextAnnotationConfig = {},
): TextAnnotationObject | null {
    if (!access.getCanvas()) return null;
    if (!access.canRunIdleOperation('createTextAnnotation')) return null;
    return createTextAnnotationImpl(access.buildTextControllerContext(), config);
}

export function enterDrawModeAction(access: AnnotationModeActionAccess): void {
    if (!access.getCanvas()) return;
    if (!access.canRunIdleOperation('enterDrawMode')) return;
    if (access.isToolModeActive()) return;
    enterDrawModeImpl(access.buildDrawControllerContext());
    const callbackContext = access.buildCallbackContext('enterDrawMode', false);
    access.emitBusyChangeIfChanged(callbackContext);
    access.emitImageChanged(callbackContext);
}

export function exitDrawModeAction(access: AnnotationModeActionAccess): void {
    if (!access.getCanvas() || !access.getDrawSession()) return;
    if (!access.canRunIdleOperation('exitDrawMode')) return;
    exitDrawModeImpl(access.buildDrawControllerContext());
    const callbackContext = access.buildCallbackContext('exitDrawMode', false);
    access.emitBusyChangeIfChanged(callbackContext);
    access.emitImageChanged(callbackContext);
}
