/**
 * Builds editor context factories from the shared runtime state.
 *
 * The facade wiring module supplies callback groups to this adapter, keeping
 * module-facing context objects explicit while avoiding duplicated state
 * forwarding code in ImageEditor.
 */
import type * as FabricNS from 'fabric';
import type { OperationToken } from '../core/operation-guard.js';
import type { AnnotationObject, ImageEditorCallbackContext, ImageEditorOperation, LoadImageOptions, MaskObject } from '../core/public-types.js';
import { EditorContextFactory } from './editor-contexts.js';
import type { EditorRuntime } from './editor-runtime.js';
export interface EditorContextStateCallbacks {
    saveCanvasState(): void;
    saveCanvasStateWithAnimationBypass(): void;
    captureSnapshot(): string;
    loadImageForOperation(operationToken: OperationToken | undefined, imageBase64: string, options?: LoadImageOptions): Promise<void>;
    loadMergedImage(operationToken: OperationToken | undefined, imageBase64: string, options?: LoadImageOptions): Promise<void>;
    loadFromStateForOperation(operationToken: OperationToken | undefined, snapshot: string): Promise<void>;
}
export interface EditorContextDisplayCallbacks {
    setCanvasSize(widthPx: number, heightPx: number): void;
    updateCanvasSizeToImageBounds(): void;
    alignObjectBoundingBoxToCanvasTopLeft(object: FabricNS.FabricObject): void;
}
export interface EditorContextMaskLabelCallbacks {
    syncMaskLabel(mask: MaskObject): void;
    removeLabelForMask(mask: MaskObject): void;
    hideAllMaskLabels(): void;
}
export interface EditorContextUiCallbacks {
    updateMaskList(): void;
    updateAnnotationList(): void;
    updateUi(): void;
    updateInputs(): void;
}
export interface EditorContextSelectionCallbacks {
    handleSelectionChanged(selected: FabricNS.FabricObject[]): void;
    getMasks(): MaskObject[];
    getAnnotations(): AnnotationObject[];
}
export interface EditorContextCallbackEmitters {
    emitImageChanged(context: ImageEditorCallbackContext): void;
    emitAnnotationsChanged(context: ImageEditorCallbackContext): void;
    emitBusyChangeIfChanged(context: ImageEditorCallbackContext): void;
    reportWarning(error: unknown, message: string): void;
    buildCallbackContext(operation: ImageEditorOperation, isInternalOperation?: boolean): ImageEditorCallbackContext;
}
export interface EditorContextFactoryCallbacks extends EditorContextStateCallbacks, EditorContextDisplayCallbacks, EditorContextMaskLabelCallbacks, EditorContextUiCallbacks, EditorContextSelectionCallbacks, EditorContextCallbackEmitters {
}
export declare function createEditorContextFactory(runtime: EditorRuntime, callbacks: EditorContextFactoryCallbacks): EditorContextFactory;
