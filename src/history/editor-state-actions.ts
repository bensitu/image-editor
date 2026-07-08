/**
 * History and serialized-state action adapters for ImageEditor.
 *
 * This module coordinates guarded save, undo, redo, and load-from-state flows
 * around the shared state serializer and history manager.
 */

import type * as FabricNS from 'fabric';

import { reportError, reportWarning } from '../core/callback-reporter.js';
import {
    loadFromState as loadFromStateImpl,
    saveState as saveStateImpl,
    type CanvasJson,
} from '../core/state-serializer.js';
import {
    isAnnotationObject,
    isMaskObject,
    type AnnotationObject,
    type BaseImageObject,
    type ImageEditorCallbackContext,
    type ImageEditorOperation,
    type ImageMimeType,
    type MaskObject,
    type ResolvedImageFilterConfig,
    type ResolvedOptions,
} from '../core/public-types.js';
import { applyMaskUnselectedStyle, reattachMaskHoverHandlers } from '../mask/mask-style.js';
import { syncAnnotationRuntimeStates } from '../annotation/annotation-style.js';
import {
    attachTextEditingHandlersToAnnotations,
    type TextControllerContext,
} from '../annotation/text-controller.js';
import { Command, type HistoryManager } from './history-manager.js';

export const TRUSTED_STATE_RESTORE = Symbol('ImageEditorTrustedStateRestore');

export type TrustedStateRestoreOptions = {
    [TRUSTED_STATE_RESTORE]?: true;
};

export interface EditorStateActionAccess {
    getCanvas(): FabricNS.Canvas | null;
    getLiveCanvas(operationName: string): FabricNS.Canvas;
    getOptions(): ResolvedOptions;
    isDisposed(): boolean;
    canRunIdleOperation(operation: ImageEditorOperation, options?: object | null): boolean;
    getActiveStateRestoreOperation(): ImageEditorOperation | null;
    buildCallbackContext(
        operation: ImageEditorOperation,
        isInternalOperation: boolean,
    ): ImageEditorCallbackContext;

    getOriginalImage(): BaseImageObject | null;
    setOriginalImage(image: BaseImageObject | null): void;
    getMaskCollectionSignature(): string;
    getAnnotationCollectionSignature(): string;

    setCanvasSize(widthPx: number, heightPx: number): void;
    hideAllMaskLabels(): void;
    inferCurrentImageMimeType(): ImageMimeType | null;
    setCurrentImageMimeType(mimeType: ImageMimeType | null): void;
    getCurrentImageFilterConfig(): ResolvedImageFilterConfig;
    restoreImageFilterConfig(config: ResolvedImageFilterConfig | null): void;
    setIsImageLoadedToCanvas(value: boolean): void;
    setMaskCounter(value: number): void;
    setAnnotationCounter(value: number): void;
    setCurrentScale(value: number): void;
    setCurrentRotation(value: number): void;
    setBaseImageScale(value: number): void;
    setLastMask(mask: MaskObject | null): void;
    getLastSnapshot(): string | null;
    setLastSnapshot(snapshot: string | null): void;

    shouldNormalizeCanvasSizeAfterStateRestore(): boolean;
    updateCanvasSizeToImageBounds(options: { stabilizeContainedViewport?: boolean }): void;
    alignObjectBoundingBoxToCanvasTopLeft(object: FabricNS.FabricObject): void;
    settleFitCoverScrollbarsAfterStateRestore(): void;
    buildTextControllerContext(): TextControllerContext;

    updateInputs(): void;
    updateMaskList(): void;
    updateAnnotationList(): void;
    updateUi(): void;
    emitImageCleared(image: BaseImageObject, context: ImageEditorCallbackContext): void;
    emitMasksChanged(context: ImageEditorCallbackContext): void;
    emitAnnotationsChanged(context: ImageEditorCallbackContext): void;
    emitImageChanged(context: ImageEditorCallbackContext): void;
    withSelectionChangeContext<T>(context: ImageEditorCallbackContext, callback: () => T): T;
    handleSelectionChanged(selected: FabricNS.FabricObject[]): void;

    shouldSuppressSaveState(): boolean;
    getCurrentScale(): number;
    getCurrentRotation(): number;
    getBaseImageScale(): number;
    getCurrentImageMimeType(): ImageMimeType | null;
    getHistoryManager(): HistoryManager;
    withAnimationQueueBypass(): object;
    showLabelForMask(mask: MaskObject): void;
    updateMaskListSelection(mask: MaskObject): void;
    updateAnnotationListSelection(annotation: AnnotationObject): void;
}

export async function loadFromStateAction(
    access: EditorStateActionAccess,
    jsonString: string | CanvasJson,
    options?: object | null,
): Promise<void> {
    const canvas = access.getCanvas();
    if (!jsonString || !canvas) return;
    if (access.isDisposed()) return;
    if (!access.canRunIdleOperation('loadFromState', options)) return;

    const activeRestoreOperation = access.getActiveStateRestoreOperation();
    const context = access.buildCallbackContext(
        activeRestoreOperation ?? 'loadFromState',
        activeRestoreOperation === 'undo' || activeRestoreOperation === 'redo',
    );
    const previousImage = access.getOriginalImage();
    const previousMaskSignature = access.getMaskCollectionSignature();
    const previousAnnotationSignature = access.getAnnotationCollectionSignature();

    try {
        const restoredState = await loadFromStateImpl({
            canvas,
            jsonString,
            setCanvasSize: (widthPx, heightPx) => access.setCanvasSize(widthPx, heightPx),
            maxCanvasPixels: access.getOptions().maxExportPixels,
            maxRestoreCanvasDimension: access.getOptions().maxExportDimension,
            restoreTrustLevel: isTrustedStateRestoreOptions(options) ? 'trusted' : 'public',
        });

        if (access.isDisposed() || !access.getCanvas()) return;

        access.hideAllMaskLabels();
        access.setOriginalImage(restoredState.originalImage);
        const originalImage = restoredState.originalImage;
        if (originalImage) {
            originalImage.set({
                originX: 'left',
                originY: 'top',
                selectable: false,
                evented: false,
                hasControls: false,
                hoverCursor: 'default',
            });
            access.getCanvas()?.sendObjectToBack(originalImage);
        }

        access.setMaskCounter(restoredState.maxMaskId);
        access.setAnnotationCounter(restoredState.maxAnnotationId);

        const editorState = restoredState.editorState;
        if (editorState) {
            access.setCurrentScale(editorState.currentScale);
            access.setCurrentRotation(editorState.currentRotation);
            access.setBaseImageScale(editorState.baseImageScale);
        }
        if (originalImage) {
            access.setCurrentImageMimeType(
                editorState && 'currentImageMimeType' in editorState
                    ? (editorState.currentImageMimeType ?? null)
                    : access.inferCurrentImageMimeType(),
            );
            access.restoreImageFilterConfig(editorState?.imageFilterConfig ?? null);
        } else {
            access.setCurrentImageMimeType(null);
            access.restoreImageFilterConfig(null);
        }

        access.setIsImageLoadedToCanvas(!!originalImage);
        if (originalImage && access.shouldNormalizeCanvasSizeAfterStateRestore()) {
            access.updateCanvasSizeToImageBounds({ stabilizeContainedViewport: false });
            access.alignObjectBoundingBoxToCanvasTopLeft(originalImage);
        }
        if (originalImage) access.settleFitCoverScrollbarsAfterStateRestore();

        const restoredMasks = restoredState.masks;
        access.setLastMask(
            restoredMasks.reduce<MaskObject | null>(
                (lastMask, maskObject) =>
                    !lastMask || maskObject.maskId > lastMask.maskId ? maskObject : lastMask,
                null,
            ),
        );
        restoredMasks.forEach((maskObject) => {
            applyMaskUnselectedStyle(maskObject);
            reattachMaskHoverHandlers(maskObject);
        });
        syncAnnotationRuntimeStates(restoredState.annotations);
        attachTextEditingHandlersToAnnotations(
            access.buildTextControllerContext(),
            restoredState.annotations,
        );

        access.setLastSnapshot(captureSnapshotAction(access));
        access.getCanvas()?.renderAll();
        access.updateInputs();
        access.updateMaskList();
        access.updateAnnotationList();
        access.updateUi();
        if (previousImage && previousImage !== access.getOriginalImage()) {
            access.emitImageCleared(previousImage, context);
        }
        if (previousMaskSignature !== access.getMaskCollectionSignature()) {
            access.emitMasksChanged(context);
        }
        if (previousAnnotationSignature !== access.getAnnotationCollectionSignature()) {
            access.emitAnnotationsChanged(context);
        }
        access.emitImageChanged(context);

        restoreActiveSelection(access, restoredState, editorState, context);
    } catch (error) {
        reportError(access.getOptions(), error, 'Failed to restore canvas state.');
        throw error;
    }
}

function isTrustedStateRestoreOptions(options?: object | null): boolean {
    return !!(options as TrustedStateRestoreOptions | null | undefined)?.[TRUSTED_STATE_RESTORE];
}

export function saveStateAction(access: EditorStateActionAccess, options?: object | null): void {
    const canvas = access.getCanvas();
    if (!canvas || access.shouldSuppressSaveState()) return;
    if (!access.canRunIdleOperation('saveState', options)) return;

    const activeObj = canvas.getActiveObject();
    const activeMask = getActiveMaskForSnapshot(canvas);
    const activeAnnotation = getActiveAnnotationForSnapshot(canvas);
    access.hideAllMaskLabels();

    try {
        const after = saveStateImpl({
            canvas,
            activeMaskId: activeMask?.maskId ?? null,
            activeAnnotationId: activeAnnotation?.annotationId ?? null,
            currentScale: access.getCurrentScale(),
            currentRotation: access.getCurrentRotation(),
            baseImageScale: access.getBaseImageScale(),
            currentImageMimeType: access.getCurrentImageMimeType(),
            imageFilterConfig: access.getCurrentImageFilterConfig(),
        });
        const before = access.getLastSnapshot() ?? after;
        if (after === before) return;

        const cmd = new Command(
            async () => {
                await loadFromStateAction(access, after, access.withAnimationQueueBypass());
            },
            async () => {
                await loadFromStateAction(access, before, access.withAnimationQueueBypass());
            },
        );

        access.getHistoryManager().push(cmd);
        access.setLastSnapshot(after);
    } catch (error) {
        reportWarning(access.getOptions(), error, 'Failed to capture canvas snapshot.');
    } finally {
        restoreActiveObjectAfterSnapshot(access, activeObj, activeMask, activeAnnotation);
        access.updateUi();
    }
}

export function captureSnapshotAction(access: EditorStateActionAccess): string {
    const canvas = access.getCanvas();
    if (!canvas) {
        throw new Error(
            '[ImageEditor] Cannot capture canvas snapshot before init or after dispose.',
        );
    }
    const activeMask = getActiveMaskForSnapshot(canvas);
    const activeAnnotation = getActiveAnnotationForSnapshot(canvas);
    access.hideAllMaskLabels();
    return saveStateImpl({
        canvas,
        activeMaskId: activeMask?.maskId ?? null,
        activeAnnotationId: activeAnnotation?.annotationId ?? null,
        currentScale: access.getCurrentScale(),
        currentRotation: access.getCurrentRotation(),
        baseImageScale: access.getBaseImageScale(),
        currentImageMimeType: access.getCurrentImageMimeType(),
        imageFilterConfig: access.getCurrentImageFilterConfig(),
    });
}

function restoreActiveSelection(
    access: EditorStateActionAccess,
    restoredState: Awaited<ReturnType<typeof loadFromStateImpl>>,
    editorState: Awaited<ReturnType<typeof loadFromStateImpl>>['editorState'],
    context: ImageEditorCallbackContext,
): void {
    const canvas = access.getLiveCanvas('loadFromState');
    const activeMaskId = editorState?.activeMaskId;
    const activeAnnotationId = editorState?.activeAnnotationId;
    if (editorState?.activeObjectKind === 'mask' && typeof activeMaskId === 'number') {
        const activeMask = restoredState.masks.find(
            (maskObject) => maskObject.maskId === activeMaskId,
        );
        if (activeMask) {
            access.withSelectionChangeContext(context, () => {
                canvas.setActiveObject(activeMask);
                access.handleSelectionChanged([activeMask]);
            });
        }
    } else if (
        editorState?.activeObjectKind === 'annotation' &&
        typeof activeAnnotationId === 'number'
    ) {
        const activeAnnotation = restoredState.annotations.find(
            (annotation) => annotation.annotationId === activeAnnotationId,
        );
        if (activeAnnotation) {
            access.withSelectionChangeContext(context, () => {
                canvas.setActiveObject(activeAnnotation);
                access.handleSelectionChanged([activeAnnotation]);
            });
        }
    }
}

function getActiveMaskForSnapshot(canvas: FabricNS.Canvas): MaskObject | null {
    const activeObject = canvas.getActiveObject();
    return activeObject && isMaskObject(activeObject) ? activeObject : null;
}

function getActiveAnnotationForSnapshot(canvas: FabricNS.Canvas): AnnotationObject | null {
    const activeObject = canvas.getActiveObject();
    return activeObject && isAnnotationObject(activeObject) ? activeObject : null;
}

function restoreActiveObjectAfterSnapshot(
    access: EditorStateActionAccess,
    activeObj: FabricNS.FabricObject | null | undefined,
    activeMask: MaskObject | null,
    activeAnnotation: AnnotationObject | null,
): void {
    const canvas = access.getCanvas();
    if (!canvas) return;
    const maskToRestore = activeObj && isMaskObject(activeObj) ? activeObj : activeMask;
    const annotationToRestore =
        activeObj && isAnnotationObject(activeObj) ? activeObj : activeAnnotation;
    if (maskToRestore && canvas.getObjects().includes(maskToRestore)) {
        canvas.setActiveObject(maskToRestore);
        access.showLabelForMask(maskToRestore);
        access.updateMaskListSelection(maskToRestore);
        return;
    }
    if (annotationToRestore && canvas.getObjects().includes(annotationToRestore)) {
        canvas.setActiveObject(annotationToRestore);
        access.updateAnnotationListSelection(annotationToRestore);
    }
}
