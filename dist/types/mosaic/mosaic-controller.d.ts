/**
 * Mosaic mode controller.
 *
 * Owns the Mosaic session lifecycle, preview circle, Fabric pointer handlers,
 * and the base-image pixel replacement pipeline. The ImageEditor facade owns
 * canonical editor state and passes it in through the context callbacks.
 *
 * @module
 */
import type * as FabricNS from 'fabric';
import type { FabricModule, ImageEditorCallbackContext, ImageEditorOperation, ImageMimeType, ResolvedMosaicConfig, ResolvedOptions } from '../core/public-types.js';
import { type HistoryManager } from '../history/history-manager.js';
interface MosaicPreviewCircle extends FabricNS.Circle {
    isMosaicPreview?: boolean;
}
export interface MosaicSession {
    previewCircle: MosaicPreviewCircle | null;
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
    isApplying: boolean;
}
export interface MosaicControllerContext {
    readonly fabric: FabricModule;
    readonly canvas: FabricNS.Canvas;
    readonly options: ResolvedOptions;
    readonly historyManager: HistoryManager;
    getMosaicConfig(): ResolvedMosaicConfig;
    isImageLoaded(): boolean;
    getOriginalImage(): FabricNS.FabricImage | null;
    setOriginalImage(image: FabricNS.FabricImage | null): void;
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
export declare function enterMosaicMode(context: MosaicControllerContext): void;
export declare function exitMosaicMode(context: MosaicControllerContext): void;
export declare function updateMosaicPreview(context: MosaicControllerContext): void;
export declare function isMosaicPreviewObject(object: FabricNS.FabricObject): boolean;
export {};
//# sourceMappingURL=mosaic-controller.d.ts.map