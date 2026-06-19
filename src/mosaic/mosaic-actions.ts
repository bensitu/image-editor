import type * as FabricNS from 'fabric';

import { reportWarning } from '../core/callback-reporter.js';
import {
    areResolvedMosaicConfigsEqual,
    cloneResolvedMosaicConfig,
    getInvalidMosaicConfigFields,
    mergeMosaicConfigPatch,
} from '../core/default-options.js';
import type {
    BaseImageObject,
    ImageEditorCallbackContext,
    ImageEditorOperation,
    MosaicConfig,
    ResolvedMosaicConfig,
    ResolvedOptions,
} from '../core/public-types.js';
import {
    enterMosaicMode as enterMosaicModeImpl,
    exitMosaicMode as exitMosaicModeImpl,
    updateMosaicPreview,
    type MosaicControllerContext,
    type MosaicSession,
} from './mosaic-controller.js';

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
    canRunIdleOperation(operation: ImageEditorOperation): boolean;
    buildMosaicControllerContext(): MosaicControllerContext;
    buildCallbackContext(
        operation: ImageEditorOperation,
        isInternalOperation: boolean,
    ): ImageEditorCallbackContext;

    updateInputs(): void;
    updateUi(): void;
    emitImageChanged(context: ImageEditorCallbackContext): void;
    emitBusyChangeIfChanged(context: ImageEditorCallbackContext): void;
}

export function enterMosaicModeAction(access: MosaicActionAccess): void {
    if (!access.getCanvas() || !access.getOriginalImage()) return;
    if (access.getMosaicSession()) return;
    if (!access.isImageLoaded()) return;
    if (!access.canRunIdleOperation('enterMosaicMode')) return;

    enterMosaicModeImpl(access.buildMosaicControllerContext());
    access.updateInputs();
    access.updateUi();
    const callbackContext = access.buildCallbackContext('enterMosaicMode', false);
    access.emitBusyChangeIfChanged(callbackContext);
    access.emitImageChanged(callbackContext);
}

export function exitMosaicModeAction(access: MosaicActionAccess): void {
    if (!access.getCanvas() || !access.getMosaicSession()) return;
    if (!access.canRunIdleOperation('exitMosaicMode')) return;

    exitMosaicModeImpl(access.buildMosaicControllerContext());
    access.updateInputs();
    access.updateUi();
    const callbackContext = access.buildCallbackContext('exitMosaicMode', false);
    access.emitBusyChangeIfChanged(callbackContext);
    access.emitImageChanged(callbackContext);
}

export function resetMosaicConfigAction(access: MosaicActionAccess): void {
    if (access.isDisposed()) return;
    const nextConfig = cloneResolvedMosaicConfig(access.getDefaultMosaicConfig());
    if (areResolvedMosaicConfigsEqual(access.getMosaicConfig(), nextConfig)) return;

    access.setMosaicConfig(nextConfig);
    updateActivePreview(access);
    access.updateInputs();
    access.updateUi();
    access.emitImageChanged(access.buildCallbackContext('resetMosaicConfig', false));
}

export function applyMosaicConfigPatchAction(
    access: MosaicActionAccess,
    config: MosaicConfig,
    operation: ImageEditorOperation,
): void {
    if (access.isDisposed()) return;
    if (config === null || typeof config !== 'object' || Array.isArray(config)) {
        reportWarning(
            access.getOptions(),
            new TypeError('[ImageEditor] Invalid Mosaic config object.'),
            'Ignored invalid Mosaic config.',
        );
        return;
    }

    const invalidFields = getInvalidMosaicConfigFields(config);
    if (invalidFields.length > 0) {
        reportWarning(
            access.getOptions(),
            new TypeError(
                `[ImageEditor] Ignored invalid Mosaic config field(s): ` +
                    `${invalidFields.join(', ')}.`,
            ),
            'Ignored invalid Mosaic config fields.',
        );
    }

    const nextConfig = mergeMosaicConfigPatch(access.getMosaicConfig(), config);
    if (areResolvedMosaicConfigsEqual(access.getMosaicConfig(), nextConfig)) return;

    access.setMosaicConfig(nextConfig);
    updateActivePreview(access);
    access.updateInputs();
    access.updateUi();
    access.emitImageChanged(access.buildCallbackContext(operation, false));
}

function updateActivePreview(access: MosaicActionAccess): void {
    if (access.getMosaicSession() && access.getCanvas()) {
        updateMosaicPreview(access.buildMosaicControllerContext());
    }
}
