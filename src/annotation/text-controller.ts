/**
 * Text annotation creation and Text mode controller.
 *
 * Owns default text placement, inline editing setup, Text mode click handling,
 * and conversion of Fabric text objects into editor-owned annotations.
 *
 * @module
 */

import type * as FabricNS from 'fabric';

import { markAnnotationObject } from '../core/editor-object-kind.js';
import { placeAnnotationObject } from '../core/layer-order.js';
import {
    isEditableOverlayObject,
    isTextAnnotationObject,
    type AnnotationObject,
    type FabricModule,
    type ImageEditorCallbackContext,
    type ResolvedOptions,
    type ResolvedTextAnnotationConfig,
    type TextAnnotationConfig,
    type TextAnnotationObject,
} from '../core/public-types.js';
import { mergeTextAnnotationConfigPatch } from '../core/default-options.js';
import { getObjectBBox } from '../utils/canvas-region.js';
import { resolveNumeric } from '../utils/number.js';
import { getPointerFromFabricEvent } from '../utils/pointer.js';
import { markSessionObject } from '../core/editor-object-kind.js';
import { syncAnnotationRuntimeState } from './annotation-style.js';
import { isAnnotationUnlocked } from './annotation-lock.js';

export interface TextSession {
    mode: 'text';
    previousCanvasSelection: boolean;
    previousDefaultCursor: string | undefined;
    handlers: Array<{ eventName: string; callback: (event: unknown) => void }>;
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
    buildCallbackContext(
        operation: 'createTextAnnotation' | 'enterTextMode' | 'exitTextMode',
    ): ImageEditorCallbackContext;
}

type TextWithEditTag = TextAnnotationObject & {
    imageEditorTextEditingInitialText?: string;
    imageEditorTextEditingCancel?: boolean;
    imageEditorTextEditingHandlers?: {
        entered: () => void;
        exited: () => void;
    };
    enterEditing?: () => void;
    exitEditing?: () => void;
    isEditing?: boolean;
    text?: string;
    selectAll?: () => void;
    selectionStart?: number;
    selectionEnd?: number;
    setSelectionStart?: (index: number) => void;
    setSelectionEnd?: (index: number) => void;
};

function resolveDefaultTextPosition(context: TextControllerContext): { left: number; top: number } {
    const image = context.getOriginalImage();
    if (image) {
        const bounds = getObjectBBox(image);
        return { left: Math.round(bounds.left + 10), top: Math.round(bounds.top + 10) };
    }
    return { left: 10, top: 10 };
}

function resolveTextCreationConfig(
    context: TextControllerContext,
    config: TextAnnotationConfig,
): ResolvedTextAnnotationConfig {
    const base = mergeTextAnnotationConfigPatch(context.getTextConfig(), config);
    const fallback = resolveDefaultTextPosition(context);
    const leftInput = config.left ?? base.left;
    const topInput = config.top ?? base.top;
    return {
        ...base,
        left: resolveNumeric(leftInput, 'x', fallback.left, context.canvas, context.options),
        top: resolveNumeric(topInput, 'y', fallback.top, context.canvas, context.options),
    };
}

function nextAnnotationMeta(
    context: TextControllerContext,
    config: ResolvedTextAnnotationConfig,
): {
    annotationId: number;
    annotationName: string;
    annotationHidden: boolean;
    annotationLocked: boolean;
} {
    const annotationId = context.getAnnotationCounter() + 1;
    context.setAnnotationCounter(annotationId);
    return {
        annotationId,
        annotationName: `${context.options.textAnnotationName}${annotationId}`,
        annotationHidden: config.annotationHidden,
        annotationLocked: config.annotationLocked,
    };
}

export function attachTextEditingHandlers(
    context: TextControllerContext,
    annotation: TextAnnotationObject,
): void {
    const textObject = annotation as TextWithEditTag;
    if (textObject.imageEditorTextEditingHandlers) {
        try {
            textObject.off(
                'editing:entered' as never,
                textObject.imageEditorTextEditingHandlers.entered,
            );
            textObject.off(
                'editing:exited' as never,
                textObject.imageEditorTextEditingHandlers.exited,
            );
        } catch {
            /* ignore */
        }
    }

    const entered = (): void => {
        textObject.imageEditorTextEditingInitialText = String(textObject.text ?? '');
        textObject.imageEditorTextEditingCancel = false;
    };
    const exited = (): void => {
        const initial = textObject.imageEditorTextEditingInitialText;
        const finalText = String(textObject.text ?? '');
        const cancel = textObject.imageEditorTextEditingCancel === true;
        if (cancel && initial !== undefined) {
            textObject.set({ text: initial } as Partial<FabricNS.TextboxProps>);
        }
        delete textObject.imageEditorTextEditingInitialText;
        delete textObject.imageEditorTextEditingCancel;
        if (!cancel && initial !== undefined && initial !== finalText) {
            context.saveCanvasState();
            const callbackContext = context.buildCallbackContext('createTextAnnotation');
            context.emitAnnotationsChanged(callbackContext);
            context.emitImageChanged(callbackContext);
        }
    };

    textObject.on('editing:entered' as never, entered);
    textObject.on('editing:exited' as never, exited);
    textObject.imageEditorTextEditingHandlers = { entered, exited };
}

function selectAllText(annotation: TextAnnotationObject): void {
    const textObject = annotation as TextWithEditTag;
    const textLength = String(textObject.text ?? '').length;
    if (textLength <= 0) return;

    if (typeof textObject.selectAll === 'function') {
        textObject.selectAll();
        return;
    }

    if (
        typeof textObject.setSelectionStart === 'function' &&
        typeof textObject.setSelectionEnd === 'function'
    ) {
        textObject.setSelectionStart(0);
        textObject.setSelectionEnd(textLength);
        return;
    }

    textObject.selectionStart = 0;
    textObject.selectionEnd = textLength;
}

export function createTextAnnotation(
    context: TextControllerContext,
    config: TextAnnotationConfig = {},
): TextAnnotationObject | null {
    if (!context.isImageLoaded()) return null;
    const resolved = resolveTextCreationConfig(context, config);
    const textbox = new context.fabric.Textbox(resolved.text, {
        left: resolved.left,
        top: resolved.top,
        width: resolved.width,
        fontSize: resolved.fontSize,
        fontFamily: resolved.fontFamily,
        fontWeight: resolved.fontWeight,
        fill: resolved.fill,
        backgroundColor: resolved.backgroundColor,
        textAlign: resolved.textAlign,
        angle: resolved.angle,
        selectable: resolved.selectable,
        evented: resolved.evented,
        editable: resolved.editable,
        originX: 'left',
        originY: 'top',
        ...resolved.styles,
    } as Partial<FabricNS.TextboxProps>);
    const meta = nextAnnotationMeta(context, resolved);
    const annotation = markAnnotationObject(textbox, {
        annotationId: meta.annotationId,
        annotationType: 'text',
        annotationName: meta.annotationName,
        annotationHidden: meta.annotationHidden,
        annotationLocked: meta.annotationLocked,
    }) as TextAnnotationObject;
    syncAnnotationRuntimeState(annotation);
    attachTextEditingHandlers(context, annotation);
    placeAnnotationObject(context.canvas, annotation);
    if (resolved.selectable !== false && isAnnotationUnlocked(annotation)) {
        context.canvas.setActiveObject(annotation);
    }
    context.canvas.renderAll();
    context.updateAnnotationList();
    context.saveCanvasState();
    const callbackContext = context.buildCallbackContext('createTextAnnotation');
    context.emitAnnotationsChanged(callbackContext);
    context.emitImageChanged(callbackContext);
    if (resolved.enterEditing && isAnnotationUnlocked(annotation)) {
        (annotation as TextWithEditTag).enterEditing?.();
        selectAllText(annotation);
    }
    return annotation;
}

function handleTextModePointer(context: TextControllerContext, event: unknown): void {
    const fabricEvent = event as { target?: FabricNS.FabricObject };
    const target = fabricEvent.target;
    if (target) {
        if (isTextAnnotationObject(target) && isAnnotationUnlocked(target)) {
            context.canvas.setActiveObject(target);
            (target as TextWithEditTag).enterEditing?.();
        } else if (isEditableOverlayObject(target)) {
            context.canvas.setActiveObject(target);
        }
        return;
    }

    const pointer = getPointerFromFabricEvent(context.canvas, event);
    if (!pointer) return;
    createTextAnnotation(context, {
        left: pointer.x,
        top: pointer.y,
    });
}

export function enterTextMode(context: TextControllerContext): void {
    if (context.getTextSession()) return;
    if (!context.isImageLoaded()) return;
    const { canvas } = context;
    const previousCanvasSelection = !!canvas.selection;
    const previousDefaultCursor = canvas.defaultCursor;
    canvas.selection = true;
    canvas.defaultCursor = 'text';

    const callback = (event: unknown): void => handleTextModePointer(context, event);
    (canvas as unknown as { on(event: string, handler: (event: unknown) => void): void }).on(
        'mouse:down',
        callback,
    );
    const session: TextSession = {
        mode: 'text',
        previousCanvasSelection,
        previousDefaultCursor,
        handlers: [{ eventName: 'mouse:down', callback }],
        dispose: () => {
            try {
                (
                    canvas as unknown as {
                        off(event: string, handler: (event: unknown) => void): void;
                    }
                ).off('mouse:down', callback);
            } catch {
                /* ignore */
            }
            canvas.selection = previousCanvasSelection;
            canvas.defaultCursor = previousDefaultCursor ?? 'default';
        },
    };
    const preview = new context.fabric.Rect({
        left: -1,
        top: -1,
        width: 1,
        height: 1,
        selectable: false,
        evented: false,
        visible: false,
        excludeFromExport: true,
    });
    markSessionObject(preview, 'textPreview');
    context.setTextSession(session);
    context.updateUi();
}

export function exitTextMode(context: TextControllerContext): void {
    const session = context.getTextSession();
    if (!session) return;
    session.dispose();
    context.setTextSession(null);
    context.canvas.requestRenderAll();
    context.updateUi();
}

export function finalizeActiveTextEditing(
    context: TextControllerContext,
    options: { commit: boolean },
): void {
    const active = context.canvas.getActiveObject();
    if (!active || !isTextAnnotationObject(active)) return;
    const textObject = active as TextWithEditTag;
    if (textObject.isEditing !== true) return;
    textObject.imageEditorTextEditingCancel = !options.commit;
    textObject.exitEditing?.();
    context.canvas.requestRenderAll();
}

export function attachTextEditingHandlersToAnnotations(
    context: TextControllerContext,
    annotations: AnnotationObject[],
): void {
    annotations.filter(isTextAnnotationObject).forEach((annotation) => {
        attachTextEditingHandlers(context, annotation);
    });
}
