export function adaptLegacyOptions(options) {
    var _a, _b;
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
            onError: (_a = options.onError) !== null && _a !== void 0 ? _a : undefined,
            onWarning: (_b = options.onWarning) !== null && _b !== void 0 ? _b : undefined,
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
//# sourceMappingURL=legacy-options-adapter.js.map