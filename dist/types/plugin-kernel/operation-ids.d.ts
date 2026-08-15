/**
 * Defines stable operation identifiers shared by the editor host and official Plugins.
 *
 * @module
 */
export declare const coreOperationIds: Readonly<{
    readonly loadImage: "core:load-image";
    readonly commitLoadImage: "core:commit-load-image";
    readonly loadState: "core:load-state";
    readonly export: "core:export";
    readonly relayout: "core:relayout";
}>;
export declare const cropOperationIds: Readonly<{
    readonly enter: "crop:enter";
    readonly updateRect: "crop:update-rect";
    readonly setAspectRatio: "crop:set-aspect-ratio";
    readonly setRotation: "crop:set-rotation";
    readonly apply: "crop:apply";
    readonly cancel: "crop:cancel";
}>;
export declare const mosaicOperationIds: Readonly<{
    readonly enter: "mosaic:enter";
    readonly beginStroke: "mosaic:begin-stroke";
    readonly appendStroke: "mosaic:append-stroke";
    readonly endStroke: "mosaic:end-stroke";
    readonly commit: "mosaic:commit";
    readonly cancel: "mosaic:cancel";
    readonly configure: "mosaic:configure";
}>;
export declare const historyOperationIds: Readonly<{
    readonly undo: "history:undo";
    readonly redo: "history:redo";
}>;
