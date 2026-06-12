/**
 * Mosaic mode controller.
 *
 * Owns the Mosaic session lifecycle, preview objects, Fabric pointer handlers,
 * and the base-image pixel replacement pipeline. The ImageEditor facade owns
 * canonical editor state and passes it in through the context callbacks.
 *
 * @module
 */
import type * as FabricNS from 'fabric';
import type { BaseImageObject, FabricModule, ImageEditorCallbackContext, ImageEditorOperation, ImageMimeType, ResolvedMosaicConfig, ResolvedOptions } from '../core/public-types.js';
import { type HistoryManager } from '../history/history-manager.js';
import { type MosaicImagePoint } from './mosaic-geometry.js';
interface MosaicPreviewCircle extends FabricNS.Circle {
    isMosaicPreview?: boolean;
}
interface MosaicPreviewImage extends FabricNS.FabricImage {
    isMosaicPreview?: boolean;
}
export interface MosaicSession {
    previewCircle: MosaicPreviewCircle | null;
    previewImage: MosaicPreviewImage | null;
    prevSelection: boolean;
    prevDefaultCursor: string | undefined;
    prevObjectStates: Array<{
        object: FabricNS.FabricObject;
        evented: boolean;
        selectable: boolean;
    }>;
    handlers: Array<{
        eventName: string;
        callback: (event: unknown) => void;
    }>;
    rasterCache: MosaicRasterCache | null;
    pendingCanvasPoints: Array<{
        x: number;
        y: number;
    }>;
    isPointerDown: boolean;
    isApplying: boolean;
    commitRequested: boolean;
    hasUncommittedChanges: boolean;
    lastImagePoint: MosaicImagePoint | null;
}
export interface MosaicControllerContext {
    readonly fabric: FabricModule;
    readonly canvas: FabricNS.Canvas;
    readonly options: ResolvedOptions;
    readonly historyManager: HistoryManager;
    getMosaicConfig(): ResolvedMosaicConfig;
    isImageLoaded(): boolean;
    getOriginalImage(): BaseImageObject | null;
    setOriginalImage(image: BaseImageObject | null): void;
    getCurrentImageMimeType(): ImageMimeType | null;
    setCurrentImageMimeType(mimeType: ImageMimeType | null): void;
    getLastSnapshot(): string | null;
    setLastSnapshot(snapshot: string | null): void;
    captureSnapshot(): string;
    loadFromState(snapshot: string): Promise<void>;
    updateUi(): void;
    updateInputs(): void;
    hideAllMaskLabels(): void;
    emitImageChanged(context: ImageEditorCallbackContext): void;
    emitBusyChangeIfChanged(context: ImageEditorCallbackContext): void;
    buildCallbackContext(operation: ImageEditorOperation, isInternal?: boolean): ImageEditorCallbackContext;
    getMosaicSession(): MosaicSession | null;
    setMosaicSession(session: MosaicSession | null): void;
}
interface MosaicRasterCache {
    offscreenCanvas: HTMLCanvasElement;
    renderingContext: CanvasRenderingContext2D;
    imageData: ImageData;
    source: string;
    width: number;
    height: number;
}
export declare function enterMosaicMode(context: MosaicControllerContext): void;
export declare function exitMosaicMode(context: MosaicControllerContext): void;
export declare function updateMosaicPreview(context: MosaicControllerContext): void;
export declare function isMosaicPreviewObject(object: FabricNS.FabricObject): boolean;
export {};
//# sourceMappingURL=mosaic-controller.d.ts.map