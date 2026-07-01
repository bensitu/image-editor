/**
 * Export and merge action adapters for the ImageEditor facade.
 *
 * The adapters enforce idle/busy guards and callback emission around the
 * lower-level export service operations.
 */
import type * as FabricNS from 'fabric';
import type { OperationToken } from '../core/operation-guard.js';
import { type AnnotationObject, type ImageEditorCallbackContext, type ImageEditorOperation, type ImageExportOptions, type MaskObject } from '../core/public-types.js';
import type { BusyOperationAccess } from '../runtime/editor-operation-runner.js';
import { type ExportServiceContext, type MergeAnnotationsContext, type MergeMasksContext } from './export-service.js';
export interface ExportActionAccess {
    getCanvas(): FabricNS.Canvas | null;
    getAnnotations(): AnnotationObject[];
    getMasks(): MaskObject[];
    canRunIdleOperation(operation: ImageEditorOperation, options?: object | null): boolean;
    assertIdleForOperation(operation: ImageEditorOperation, options?: object | null): void;
    finalizeActiveTextEditingIfNeeded(): void;
    buildExportServiceContext(): ExportServiceContext;
    buildMergeMasksContext(token?: OperationToken): MergeMasksContext;
    buildMergeAnnotationsContext(token?: OperationToken): MergeAnnotationsContext;
    buildBusyOperationAccess(): BusyOperationAccess;
    updateInputs(): void;
    updateMaskList(): void;
    updateAnnotationList(): void;
    emitMasksChanged(context: ImageEditorCallbackContext): void;
    emitAnnotationsChanged(context: ImageEditorCallbackContext): void;
    emitImageChanged(context: ImageEditorCallbackContext): void;
}
export declare function mergeMasksAction(access: ExportActionAccess): Promise<void>;
export declare function mergeAnnotationsAction(access: ExportActionAccess): Promise<void>;
export declare function downloadImageAction(access: ExportActionAccess, options?: ImageExportOptions): Promise<void>;
export declare function exportImageBase64Action(access: ExportActionAccess, options?: ImageExportOptions): Promise<string>;
export declare function exportImageFileAction(access: ExportActionAccess, options?: ImageExportOptions): Promise<File>;
