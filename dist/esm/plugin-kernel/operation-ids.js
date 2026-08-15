export const coreOperationIds = Object.freeze({
    loadImage: 'core:load-image',
    commitLoadImage: 'core:commit-load-image',
    loadState: 'core:load-state',
    export: 'core:export',
    relayout: 'core:relayout',
});
export const cropOperationIds = Object.freeze({
    enter: 'crop:enter',
    updateRect: 'crop:update-rect',
    setAspectRatio: 'crop:set-aspect-ratio',
    setRotation: 'crop:set-rotation',
    apply: 'crop:apply',
    cancel: 'crop:cancel',
});
export const mosaicOperationIds = Object.freeze({
    enter: 'mosaic:enter',
    beginStroke: 'mosaic:begin-stroke',
    appendStroke: 'mosaic:append-stroke',
    endStroke: 'mosaic:end-stroke',
    commit: 'mosaic:commit',
    cancel: 'mosaic:cancel',
    configure: 'mosaic:configure',
});
export const historyOperationIds = Object.freeze({
    undo: 'history:undo',
    redo: 'history:redo',
});
//# sourceMappingURL=operation-ids.js.map