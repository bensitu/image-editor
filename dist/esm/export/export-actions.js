import { isAnnotationObject, isMaskObject, } from '../core/public-types.js';
import { runBusyOperation, runBusyOperationWithoutUi } from '../runtime/editor-operation-runner.js';
import { downloadImage as downloadImageImpl, exportImageBase64 as exportImageBase64Impl, exportImageFile as exportImageFileImpl, mergeAnnotations as mergeAnnotationsImpl, mergeMasks as mergeMasksImpl, } from './export-service.js';
export async function mergeMasksAction(access) {
    const canvas = access.getCanvas();
    if (!canvas)
        return;
    if (!access.canRunIdleOperation('mergeMasks'))
        return;
    access.finalizeActiveTextEditingIfNeeded();
    const hasMasks = canvas.getObjects().some(isMaskObject);
    if (!hasMasks)
        return;
    await runBusyOperation(access.buildBusyOperationAccess(), 'mergeMasks', async (callbackContext, operationToken) => {
        await mergeMasksImpl(access.buildMergeMasksContext(operationToken));
        access.updateInputs();
        access.updateMaskList();
        access.updateAnnotationList();
        access.emitMasksChanged(callbackContext);
        if (access.getAnnotations().length > 0) {
            access.emitAnnotationsChanged(callbackContext);
        }
        access.emitImageChanged(callbackContext);
    });
}
export async function mergeAnnotationsAction(access) {
    const canvas = access.getCanvas();
    if (!canvas)
        return;
    if (!access.canRunIdleOperation('mergeAnnotations'))
        return;
    access.finalizeActiveTextEditingIfNeeded();
    const hasAnnotations = canvas.getObjects().some(isAnnotationObject);
    if (!hasAnnotations)
        return;
    await runBusyOperation(access.buildBusyOperationAccess(), 'mergeAnnotations', async (callbackContext, operationToken) => {
        await mergeAnnotationsImpl(access.buildMergeAnnotationsContext(operationToken));
        access.updateInputs();
        access.updateMaskList();
        access.updateAnnotationList();
        access.emitAnnotationsChanged(callbackContext);
        if (access.getMasks().length > 0)
            access.emitMasksChanged(callbackContext);
        access.emitImageChanged(callbackContext);
    });
}
export async function downloadImageAction(access, options) {
    if (!access.getCanvas())
        return;
    if (!access.canRunIdleOperation('downloadImage'))
        return;
    access.finalizeActiveTextEditingIfNeeded();
    await runBusyOperationWithoutUi(access.buildBusyOperationAccess(), 'downloadImage', async () => {
        await downloadImageImpl(access.buildExportServiceContext(), options);
    });
}
export async function exportImageBase64Action(access, options) {
    if (!access.getCanvas())
        return '';
    if (!access.canRunIdleOperation('exportImageBase64', options))
        return '';
    access.finalizeActiveTextEditingIfNeeded();
    return await runBusyOperationWithoutUi(access.buildBusyOperationAccess(), 'exportImageBase64', async () => await exportImageBase64Impl(access.buildExportServiceContext(), options));
}
export async function exportImageFileAction(access, options) {
    access.assertIdleForOperation('exportImageFile', options);
    access.finalizeActiveTextEditingIfNeeded();
    return await runBusyOperationWithoutUi(access.buildBusyOperationAccess(), 'exportImageFile', async () => await exportImageFileImpl(access.buildExportServiceContext(), options));
}
//# sourceMappingURL=export-actions.js.map