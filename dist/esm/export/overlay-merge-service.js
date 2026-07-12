import { MergeAnnotationsError, MergeMasksError } from '../core/errors.js';
import { normalizeLayerOrder } from '../core/layer-order.js';
import { reportWarning } from '../core/callback-reporter.js';
import { Command } from '../history/history-port.js';
function createMergeError(operation, error) {
    if (operation === 'mergeAnnotations') {
        if (error instanceof MergeAnnotationsError)
            return error;
        const message = error instanceof Error
            ? `mergeAnnotations failed: ${error.message}`
            : 'mergeAnnotations failed';
        return new MergeAnnotationsError(message, error);
    }
    if (error instanceof MergeMasksError)
        return error;
    const message = error instanceof Error ? `mergeMasks failed: ${error.message}` : 'mergeMasks failed';
    return new MergeMasksError(message, error);
}
function detachObjects(canvas, objects) {
    for (const object of objects) {
        if (!canvas.getObjects().includes(object))
            continue;
        canvas.remove(object);
    }
    canvas.discardActiveObject();
    canvas.renderAll();
}
export async function flattenOverlayGroupToBaseImage(context, options) {
    if (!context.isImageLoaded())
        return;
    if (options.getTargets().length === 0)
        return;
    const beforeSnapshot = context.captureSnapshot();
    const preservedObjects = options.getPreservedObjects();
    const preScrollTop = context.containerElement ? context.containerElement.scrollTop : null;
    const preScrollLeft = context.containerElement ? context.containerElement.scrollLeft : null;
    try {
        const detachPreservedObjects = async () => {
            detachObjects(context.canvas, preservedObjects);
        };
        if (context.withSelectionChangeSuppressed) {
            await context.withSelectionChangeSuppressed(detachPreservedObjects);
        }
        else {
            await detachPreservedObjects();
        }
        const exportedDataUrl = await context.exportImageBase64(options.exportOptions);
        if (!exportedDataUrl) {
            throw createMergeError(options.operation, `${options.operation}: exportImageBase64 returned an empty data URL.`);
        }
        options.removeTargetsNoHistory();
        await context.loadImage(exportedDataUrl, { preserveScroll: true });
        await options.restorePreservedObjects(preservedObjects);
        normalizeLayerOrder(context.canvas);
        context.canvas.renderAll();
        context.updateInputs();
        context.updateUi();
        if (context.containerElement) {
            try {
                if (preScrollTop !== null)
                    context.containerElement.scrollTop = preScrollTop;
                if (preScrollLeft !== null)
                    context.containerElement.scrollLeft = preScrollLeft;
            }
            catch (scrollError) {
                reportWarning(context.options, scrollError, `${options.operation}: scroll restore failed.`);
            }
        }
        const afterSnapshot = context.captureSnapshot();
        if (beforeSnapshot && afterSnapshot && beforeSnapshot !== afterSnapshot) {
            context.historyManager.push(new Command(() => context.loadFromState(afterSnapshot), () => context.loadFromState(beforeSnapshot)));
        }
    }
    catch (error) {
        try {
            await context.loadFromState(beforeSnapshot);
        }
        catch (rollbackError) {
            reportWarning(context.options, rollbackError, `${options.operation}: rollback failed.`);
        }
        throw createMergeError(options.operation, error);
    }
}
//# sourceMappingURL=overlay-merge-service.js.map