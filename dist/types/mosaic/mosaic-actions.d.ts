/**
 * Mosaic mode action adapters for the ImageEditor facade.
 *
 * These helpers guard Mosaic session entry, exit, and configuration updates
 * before delegating to the Mosaic controller.
 */
import type * as FabricNS from 'fabric';
import type { BaseImageObject, ImageEditorCallbackContext, ImageEditorOperation, MosaicConfig, ResolvedMosaicConfig, ResolvedOptions } from '../core/public-types.js';
import { type MosaicControllerContext, type MosaicSession } from './mosaic-controller.js';
export interface MosaicActionAccess {
    getCanvas(): FabricNS.Canvas | null;
    getOriginalImage(): BaseImageObject | null;
    getMosaicSession(): MosaicSession | null;
    getMosaicConfig(): ResolvedMosaicConfig;
    setMosaicConfig(config: ResolvedMosaicConfig): void;
    getDefaultMosaicConfig(): ResolvedMosaicConfig;
    getOptions(): ResolvedOptions;
    isDisposed(): boolean;
    isImageLoaded(): boolean;
    canRunIdleOperation(operation: ImageEditorOperation, options?: object | null): boolean;
    buildMosaicControllerContext(): MosaicControllerContext;
    buildCallbackContext(operation: ImageEditorOperation, isInternalOperation: boolean): ImageEditorCallbackContext;
    updateInputs(): void;
    updateUi(): void;
    emitImageChanged(context: ImageEditorCallbackContext): void;
    emitBusyChangeIfChanged(context: ImageEditorCallbackContext): void;
}
export declare function enterMosaicModeAction(access: MosaicActionAccess): void;
export declare function exitMosaicModeAction(access: MosaicActionAccess): void;
export declare function resetMosaicConfigAction(access: MosaicActionAccess): void;
export declare function applyMosaicConfigPatchAction(access: MosaicActionAccess, config: MosaicConfig, operation: ImageEditorOperation): void;
