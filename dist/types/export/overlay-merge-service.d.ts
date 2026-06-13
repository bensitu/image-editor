/**
 * Shared transaction service for baking editable overlays into the base image.
 *
 * Mask and annotation merges use the same snapshot, export, reload, restore,
 * history, and rollback flow while preserving the opposite overlay group.
 *
 * @module
 */
import type * as FabricNS from 'fabric';
import type { AnnotationObject, Base64ExportOptions, LoadImageOptions, MaskObject, ResolvedOptions } from '../core/public-types.js';
import { type HistoryManager } from '../history/history-manager.js';
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
    exportImageBase64(options: Base64ExportOptions): Promise<string>;
    updateUi(): void;
    updateInputs(): void;
}
export interface OverlayMergeGroupOptions<TTarget extends FabricNS.FabricObject, TPreserved extends FabricNS.FabricObject> {
    operation: OverlayMergeOperation;
    exportOptions: Base64ExportOptions & {
        exportArea: 'image';
        fileType: 'png';
    };
    getTargets(): TTarget[];
    getPreservedObjects(): TPreserved[];
    removeTargetsNoHistory(): void;
    restorePreservedObjects(objects: TPreserved[]): void | Promise<void>;
}
export declare function flattenOverlayGroupToBaseImage<TTarget extends MaskObject | AnnotationObject, TPreserved extends MaskObject | AnnotationObject>(context: OverlayMergeTransactionContext, options: OverlayMergeGroupOptions<TTarget, TPreserved>): Promise<void>;
//# sourceMappingURL=overlay-merge-service.d.ts.map