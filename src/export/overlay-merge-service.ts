/**
 * Shared transaction service for baking editable overlays into the base image.
 *
 * Mask and annotation merges use the same snapshot, export, reload, restore,
 * history, and rollback flow while preserving the opposite overlay group.
 *
 * @module
 */

import type * as FabricNS from 'fabric';

import { MergeAnnotationsError, MergeMasksError } from '../core/errors.js';
import { normalizeLayerOrder } from '../core/layer-order.js';
import type {
    AnnotationObject,
    ImageExportOptions,
    LoadImageOptions,
    MaskObject,
    ResolvedOptions,
} from '../core/public-types.js';
import { reportWarning } from '../core/callback-reporter.js';
import { Command, type HistoryManager } from '../history/history-manager.js';

export type OverlayMergeOperation = 'mergeMasks' | 'mergeAnnotations';

export interface OverlayMergeTransactionContext {
    readonly canvas: FabricNS.Canvas;
    readonly options: ResolvedOptions;
    readonly historyManager: HistoryManager;
    readonly containerElement: HTMLElement | null;
    isImageLoaded(): boolean;
    captureSnapshot(): string;
    loadFromState(snapshot: string): Promise<void>;
    loadImage(imageBase64: string, options?: LoadImageOptions): Promise<void>;
    exportImageBase64(options: ImageExportOptions): Promise<string>;
    updateUi(): void;
    updateInputs(): void;
}

export interface OverlayMergeGroupOptions<
    TTarget extends FabricNS.FabricObject,
    TPreserved extends FabricNS.FabricObject,
> {
    operation: OverlayMergeOperation;
    exportOptions: ImageExportOptions & {
        exportArea: 'image';
        fileType: 'png';
    };
    getTargets(): TTarget[];
    getPreservedObjects(): TPreserved[];
    removeTargetsNoHistory(): void;
    restorePreservedObjects(objects: TPreserved[]): void | Promise<void>;
}

function createMergeError(operation: OverlayMergeOperation, error: unknown): Error {
    if (operation === 'mergeAnnotations') {
        if (error instanceof MergeAnnotationsError) return error;
        const message =
            error instanceof Error
                ? `mergeAnnotations failed: ${error.message}`
                : 'mergeAnnotations failed';
        return new MergeAnnotationsError(message, error);
    }
    if (error instanceof MergeMasksError) return error;
    const message =
        error instanceof Error ? `mergeMasks failed: ${error.message}` : 'mergeMasks failed';
    return new MergeMasksError(message, error);
}

function detachObjects(canvas: FabricNS.Canvas, objects: FabricNS.FabricObject[]): void {
    for (const object of objects) {
        if (!canvas.getObjects().includes(object)) continue;
        canvas.remove(object);
    }
    canvas.discardActiveObject();
    canvas.renderAll();
}

export async function flattenOverlayGroupToBaseImage<
    TTarget extends MaskObject | AnnotationObject,
    TPreserved extends MaskObject | AnnotationObject,
>(
    context: OverlayMergeTransactionContext,
    options: OverlayMergeGroupOptions<TTarget, TPreserved>,
): Promise<void> {
    if (!context.isImageLoaded()) return;
    if (options.getTargets().length === 0) return;

    // Capture before detaching preserved overlays so rollback can restore the
    // complete pre-merge canvas with one loadFromState call.
    const beforeSnapshot = context.captureSnapshot();
    const preservedObjects = options.getPreservedObjects();
    const preScrollTop = context.containerElement ? context.containerElement.scrollTop : null;
    const preScrollLeft = context.containerElement ? context.containerElement.scrollLeft : null;

    try {
        detachObjects(context.canvas, preservedObjects);
        const exportedDataUrl = await context.exportImageBase64(options.exportOptions);
        if (!exportedDataUrl) {
            throw createMergeError(
                options.operation,
                `${options.operation}: exportImageBase64 returned an empty data URL.`,
            );
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
                if (preScrollTop !== null) context.containerElement.scrollTop = preScrollTop;
                if (preScrollLeft !== null) context.containerElement.scrollLeft = preScrollLeft;
            } catch (scrollError) {
                reportWarning(
                    context.options,
                    scrollError,
                    `${options.operation}: scroll restore failed.`,
                );
            }
        }

        const afterSnapshot = context.captureSnapshot();
        if (beforeSnapshot && afterSnapshot && beforeSnapshot !== afterSnapshot) {
            context.historyManager.push(
                new Command(
                    () => context.loadFromState(afterSnapshot),
                    () => context.loadFromState(beforeSnapshot),
                ),
            );
        }
    } catch (error) {
        try {
            await context.loadFromState(beforeSnapshot);
        } catch (rollbackError) {
            reportWarning(context.options, rollbackError, `${options.operation}: rollback failed.`);
        }
        throw createMergeError(options.operation, error);
    }
}
