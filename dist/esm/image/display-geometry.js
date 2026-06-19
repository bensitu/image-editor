import { computeScrollableCanvasSize, measureScrollbarSize, } from './layout-manager.js';
const LAYOUT_EPSILON = 0.5;
const SCROLLBAR_SETTLE_EPSILON = 1;
export function measureLayoutViewport(context, scrollbarSize) {
    return context.viewportCache.measure(context.containerElement, {
        width: context.options.canvasWidth,
        height: context.options.canvasHeight,
    }, scrollbarSize);
}
export function getScrollbarStableViewportCanvasSize(viewport) {
    return {
        width: Math.max(1, viewport.width - 1),
        height: Math.max(1, viewport.height - 1),
    };
}
export function updateCanvasSizeToImageBounds(context, options = {}) {
    var _a, _b;
    const originalImage = context.getOriginalImage();
    if (!originalImage)
        return;
    originalImage.setCoords();
    const boundingRect = originalImage.getBoundingRect();
    const scrollbarSize = measureScrollbarSize((_b = (_a = context.containerElement) === null || _a === void 0 ? void 0 : _a.ownerDocument) !== null && _b !== void 0 ? _b : null);
    const viewport = measureLayoutViewport(context, scrollbarSize);
    const shouldStabilizeContainedViewport = options.stabilizeContainedViewport !== false;
    const imageFitsViewport = boundingRect.width <= viewport.width + LAYOUT_EPSILON &&
        boundingRect.height <= viewport.height + LAYOUT_EPSILON;
    if (context.currentLayoutMode === 'fit' || context.currentLayoutMode === 'cover') {
        if (imageFitsViewport) {
            const canvasSize = shouldStabilizeContainedViewport
                ? getScrollbarStableViewportCanvasSize(viewport)
                : viewport;
            context.setCanvasSize(canvasSize.width, canvasSize.height);
            return;
        }
        const canvasSize = computeScrollableCanvasSize(boundingRect.width, boundingRect.height, viewport, scrollbarSize);
        context.setCanvasSize(canvasSize.width, canvasSize.height);
        return;
    }
    if (imageFitsViewport) {
        const canvasSize = shouldStabilizeContainedViewport
            ? getScrollbarStableViewportCanvasSize(viewport)
            : viewport;
        context.setCanvasSize(canvasSize.width, canvasSize.height);
        return;
    }
    context.setCanvasSize(Math.max(viewport.width, Math.ceil(boundingRect.width)), Math.max(viewport.height, Math.ceil(boundingRect.height)));
}
export function shouldNormalizeCanvasSizeAfterStateRestore(context) {
    var _a, _b;
    const originalImage = context.getOriginalImage();
    if (!context.canvas || !originalImage)
        return false;
    originalImage.setCoords();
    const boundingRect = originalImage.getBoundingRect();
    const viewport = measureLayoutViewport(context, measureScrollbarSize((_b = (_a = context.containerElement) === null || _a === void 0 ? void 0 : _a.ownerDocument) !== null && _b !== void 0 ? _b : null));
    const canvasW = Math.ceil(context.canvas.getWidth());
    const canvasH = Math.ceil(context.canvas.getHeight());
    const clipsImage = boundingRect.width > canvasW + LAYOUT_EPSILON ||
        boundingRect.height > canvasH + LAYOUT_EPSILON;
    if (context.currentLayoutMode === 'fit' || context.currentLayoutMode === 'cover') {
        const staleOverflowWidth = canvasW > viewport.width + LAYOUT_EPSILON &&
            boundingRect.width <= viewport.width + LAYOUT_EPSILON;
        const staleOverflowHeight = canvasH > viewport.height + LAYOUT_EPSILON &&
            boundingRect.height <= viewport.height + LAYOUT_EPSILON;
        return clipsImage || staleOverflowWidth || staleOverflowHeight;
    }
    if (context.currentLayoutMode === 'expand') {
        const expectedW = Math.max(viewport.width, Math.ceil(boundingRect.width));
        const expectedH = Math.max(viewport.height, Math.ceil(boundingRect.height));
        return (Math.abs(canvasW - expectedW) > LAYOUT_EPSILON ||
            Math.abs(canvasH - expectedH) > LAYOUT_EPSILON);
    }
    return clipsImage;
}
export function settleFitCoverScrollbarsAfterStateRestore(context) {
    if (!context.canvas ||
        !context.containerElement ||
        (context.currentLayoutMode !== 'fit' && context.currentLayoutMode !== 'cover')) {
        return;
    }
    const canvasW = Math.ceil(context.canvas.getWidth());
    const canvasH = Math.ceil(context.canvas.getHeight());
    if (canvasW <= 1 || canvasH <= 1)
        return;
    const clientW = Math.floor(context.containerElement.clientWidth || 0);
    const clientH = Math.floor(context.containerElement.clientHeight || 0);
    if (clientW <= 0 || clientH <= 0)
        return;
    const scrollW = Math.ceil(context.containerElement.scrollWidth || 0);
    const scrollH = Math.ceil(context.containerElement.scrollHeight || 0);
    const hasHorizontalScrollbar = scrollW > clientW + LAYOUT_EPSILON;
    const hasVerticalScrollbar = scrollH > clientH + LAYOUT_EPSILON;
    if (!hasHorizontalScrollbar && !hasVerticalScrollbar)
        return;
    const nudgeWidth = hasVerticalScrollbar && Math.abs(canvasW - clientW) <= SCROLLBAR_SETTLE_EPSILON;
    const nudgeHeight = hasHorizontalScrollbar && Math.abs(canvasH - clientH) <= SCROLLBAR_SETTLE_EPSILON;
    if (!nudgeWidth && !nudgeHeight)
        return;
    context.setCanvasSize(nudgeWidth ? canvasW - 1 : canvasW, nudgeHeight ? canvasH - 1 : canvasH);
    context.setCanvasSize(canvasW, canvasH);
}
export function captureImageDisplayGeometry(context) {
    const originalImage = context.getOriginalImage();
    if (!context.canvas || !originalImage)
        return null;
    originalImage.setCoords();
    const boundingRect = originalImage.getBoundingRect();
    return {
        canvasWidth: context.canvas.getWidth(),
        canvasHeight: context.canvas.getHeight(),
        imageDisplayWidth: Math.max(1, boundingRect.width),
        imageDisplayHeight: Math.max(1, boundingRect.height),
    };
}
export function restoreMergedImageDisplayGeometry(context, geometry) {
    const originalImage = context.getOriginalImage();
    if (!geometry || !context.canvas || !originalImage)
        return;
    context.setCanvasSize(geometry.canvasWidth, geometry.canvasHeight);
    const sourceW = Math.max(1, originalImage.width || geometry.imageDisplayWidth);
    const sourceH = Math.max(1, originalImage.height || geometry.imageDisplayHeight);
    const scale = Math.min(geometry.imageDisplayWidth / sourceW, geometry.imageDisplayHeight / sourceH);
    originalImage.set({
        left: 0,
        top: 0,
        angle: 0,
        scaleX: scale,
        scaleY: scale,
        originX: 'left',
        originY: 'top',
        selectable: false,
        evented: false,
        hasControls: false,
        hoverCursor: 'default',
    });
    originalImage.setCoords();
    context.canvas.sendObjectToBack(originalImage);
    context.setCurrentScale(1);
    context.setCurrentRotation(0);
    context.setBaseImageScale(scale);
    context.setLastSnapshot(context.captureSnapshot());
    context.canvas.renderAll();
}
//# sourceMappingURL=display-geometry.js.map