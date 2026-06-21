/**
 * Builds editor context factories from the shared runtime state.
 *
 * This adapter keeps module-facing context objects explicit while avoiding
 * duplicated state forwarding code inside the ImageEditor facade.
 */
import type * as FabricNS from 'fabric';
import type { OperationToken } from '../core/operation-guard.js';
import type { AnnotationObject, ImageEditorCallbackContext, ImageEditorOperation, LoadImageOptions, MaskObject } from '../core/public-types.js';
import { EditorContextFactory } from './editor-contexts.js';
import type { EditorRuntime } from './editor-runtime.js';
export interface EditorContextFactoryCallbacks {
    saveCanvasState(): void;
    saveCanvasStateWithAnimationBypass(): void;
    captureSnapshot(): string;
    loadImageForOperation(operationToken: OperationToken | undefined, imageBase64: string, options?: LoadImageOptions): Promise<void>;
    loadMergedImage(operationToken: OperationToken | undefined, imageBase64: string, options?: LoadImageOptions): Promise<void>;
    loadFromStateForOperation(operationToken: OperationToken | undefined, snapshot: string): Promise<void>;
    setCanvasSize(widthPx: number, heightPx: number): void;
    updateCanvasSizeToImageBounds(): void;
    alignObjectBoundingBoxToCanvasTopLeft(object: FabricNS.FabricObject): void;
    syncMaskLabel(mask: MaskObject): void;
    removeLabelForMask(mask: MaskObject): void;
    hideAllMaskLabels(): void;
    updateMaskList(): void;
    updateAnnotationList(): void;
    updateUi(): void;
    updateInputs(): void;
    handleSelectionChanged(selected: FabricNS.FabricObject[]): void;
    getMasks(): MaskObject[];
    getAnnotations(): AnnotationObject[];
    emitImageChanged(context: ImageEditorCallbackContext): void;
    emitAnnotationsChanged(context: ImageEditorCallbackContext): void;
    emitBusyChangeIfChanged(context: ImageEditorCallbackContext): void;
    buildCallbackContext(operation: ImageEditorOperation, isInternalOperation?: boolean): ImageEditorCallbackContext;
}
export declare function createEditorContextFactory(runtime: EditorRuntime, callbacks: EditorContextFactoryCallbacks): EditorContextFactory;
//# sourceMappingURL=editor-context-factory-access.d.ts.map