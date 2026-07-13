import type { ImageEditorCoreOptions } from '../core-runtime/public-types.js';
import type { ResolvedOptions } from '../core/public-types.js';
import type { HistoryPluginOptions } from '../plugins/history/index.js';
import type { MaskPluginOptions } from '../plugins/mask/index.js';
import type { TransformPluginOptions } from '../plugins/transform/index.js';

export interface FullCompatibilityOptions {
    readonly core: ImageEditorCoreOptions;
    readonly history: HistoryPluginOptions;
    readonly transform: TransformPluginOptions;
    readonly mask: MaskPluginOptions;
}

export function adaptLegacyOptions(options: ResolvedOptions): FullCompatibilityOptions {
    return Object.freeze({
        core: Object.freeze({
            canvasWidth: options.canvasWidth,
            canvasHeight: options.canvasHeight,
            backgroundColor: options.backgroundColor,
            defaultLayoutMode: options.layoutMode,
            groupSelection: options.groupSelection,
            maxInputBytes: options.maxInputBytes,
            maxInputPixels: options.maxInputPixels,
            imageLoadTimeoutMs: options.imageLoadTimeoutMs,
            maxExportPixels: options.maxExportPixels,
            maxExportDimension: options.maxExportDimension,
            exportMultiplier: options.exportMultiplier,
            onError: options.onError ?? undefined,
            onWarning: options.onWarning ?? undefined,
        }),
        history: Object.freeze({ maxSize: options.maxHistorySize }),
        transform: Object.freeze({
            animationDuration: options.animationDuration,
            minScale: options.minScale,
            maxScale: options.maxScale,
            scaleStep: options.scaleStep,
            rotationStep: options.rotationStep,
        }),
        mask: Object.freeze({
            defaultWidth: options.defaultMaskWidth,
            defaultHeight: options.defaultMaskHeight,
            defaultConfig: options.defaultMaskConfig,
            rotatable: options.maskRotatable,
            label: options.maskLabelOnSelect ? options.label : false,
            labelOffset: options.maskLabelOffset,
            listOrder: options.maskListOrder,
            bindToImageTransform: options.bindMasksToImageTransform,
            namePrefix: options.maskName,
        }),
    });
}
