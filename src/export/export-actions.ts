/**
 * Export and merge action adapters for the ImageEditor facade.
 *
 * The adapters enforce idle/busy guards and callback emission around the
 * lower-level export service operations.
 */

import type * as FabricNS from 'fabric';

import type { OperationToken } from '../core/operation-guard.js';
import { ExportNotReadyError } from '../core/errors.js';
import {
    isAnnotationObject,
    isMaskObject,
    type AnnotationObject,
    type ImageEditorCallbackContext,
    type ImageEditorOperation,
    type ImageExportOptions,
    type MaskObject,
} from '../core/public-types.js';
import type { BusyOperationAccess } from '../runtime/editor-operation-runner.js';
import { runBusyOperation, runBusyOperationWithoutUi } from '../runtime/editor-operation-runner.js';
import {
    downloadImage as downloadImageImpl,
    exportImageBase64 as exportImageBase64Impl,
    exportImageFile as exportImageFileImpl,
    mergeAnnotations as mergeAnnotationsImpl,
    mergeMasks as mergeMasksImpl,
    type ExportServiceContext,
    type MergeAnnotationsContext,
    type MergeMasksContext,
} from './export-service.js';

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

export async function mergeMasksAction(access: ExportActionAccess): Promise<void> {
    const canvas = access.getCanvas();
    if (!canvas) return;
    if (!access.canRunIdleOperation('mergeMasks')) return;
    access.finalizeActiveTextEditingIfNeeded();
    const hasMasks = canvas.getObjects().some(isMaskObject);
    if (!hasMasks) return;

    await runBusyOperation(
        access.buildBusyOperationAccess(),
        'mergeMasks',
        async (callbackContext, operationToken) => {
            await mergeMasksImpl(access.buildMergeMasksContext(operationToken));
            access.updateInputs();
            access.updateMaskList();
            access.updateAnnotationList();
            access.emitMasksChanged(callbackContext);
            if (access.getAnnotations().length > 0) {
                access.emitAnnotationsChanged(callbackContext);
            }
            access.emitImageChanged(callbackContext);
        },
    );
}

export async function mergeAnnotationsAction(access: ExportActionAccess): Promise<void> {
    const canvas = access.getCanvas();
    if (!canvas) return;
    if (!access.canRunIdleOperation('mergeAnnotations')) return;
    access.finalizeActiveTextEditingIfNeeded();
    const hasAnnotations = canvas.getObjects().some(isAnnotationObject);
    if (!hasAnnotations) return;

    await runBusyOperation(
        access.buildBusyOperationAccess(),
        'mergeAnnotations',
        async (callbackContext, operationToken) => {
            await mergeAnnotationsImpl(access.buildMergeAnnotationsContext(operationToken));
            access.updateInputs();
            access.updateMaskList();
            access.updateAnnotationList();
            access.emitAnnotationsChanged(callbackContext);
            if (access.getMasks().length > 0) access.emitMasksChanged(callbackContext);
            access.emitImageChanged(callbackContext);
        },
    );
}

export async function downloadImageAction(
    access: ExportActionAccess,
    options?: ImageExportOptions,
): Promise<void> {
    if (!access.getCanvas()) return;
    if (!access.canRunIdleOperation('downloadImage')) return;
    access.finalizeActiveTextEditingIfNeeded();

    await runBusyOperationWithoutUi(
        access.buildBusyOperationAccess(),
        'downloadImage',
        async () => {
            await downloadImageImpl(access.buildExportServiceContext(), options);
        },
    );
}

export async function exportImageBase64Action(
    access: ExportActionAccess,
    options?: ImageExportOptions,
): Promise<string> {
    if (!access.getCanvas()) {
        throw new ExportNotReadyError('exportImageBase64', 'editor is not initialized');
    }
    access.assertIdleForOperation('exportImageBase64', options);
    access.finalizeActiveTextEditingIfNeeded();

    return await runBusyOperationWithoutUi(
        access.buildBusyOperationAccess(),
        'exportImageBase64',
        async () => await exportImageBase64Impl(access.buildExportServiceContext(), options),
    );
}

export async function exportImageFileAction(
    access: ExportActionAccess,
    options?: ImageExportOptions,
): Promise<File> {
    access.assertIdleForOperation('exportImageFile', options);
    access.finalizeActiveTextEditingIfNeeded();

    return await runBusyOperationWithoutUi(
        access.buildBusyOperationAccess(),
        'exportImageFile',
        async () => await exportImageFileImpl(access.buildExportServiceContext(), options),
    );
}
