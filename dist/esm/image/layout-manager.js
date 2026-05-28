import { forceReflow } from '../utils/dom.js';
export function selectLayoutStrategy(options) {
    if (options.fitImageToCanvas)
        return 'fit';
    if (options.coverImageToCanvas)
        return 'cover';
    return 'expand';
}
export function detectLayoutConflict(options) {
    if (!options.fitImageToCanvas || !options.coverImageToCanvas)
        return null;
    const enabled = ['fit', 'cover'];
    if (options.expandCanvasToImage)
        enabled.push('expand');
    const selected = selectLayoutStrategy(options);
    return {
        enabled,
        selected,
        message: `Layout flags ${enabled.map((s) => `\`${s}\``).join(', ')} are enabled simultaneously. ` +
            `Using precedence \`fit > cover > expand\`; selected \`${selected}\`.`,
    };
}
export class ViewportCache {
    constructor() {
        Object.defineProperty(this, "lastVisible", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
    }
    measure(container, fallback) {
        var _a;
        if (!container)
            return fallback;
        const cw = Math.floor(container.clientWidth);
        const ch = Math.floor(container.clientHeight);
        if (cw > 0 && ch > 0) {
            this.lastVisible = { width: cw, height: ch };
            return this.lastVisible;
        }
        return (_a = this.lastVisible) !== null && _a !== void 0 ? _a : fallback;
    }
    peek() {
        return this.lastVisible;
    }
    clear() {
        this.lastVisible = null;
    }
}
export function computeFitLayout(imageWidth, imageHeight, optionsCanvasWidth, optionsCanvasHeight, containerSize) {
    const cw = Math.max(1, Math.min(optionsCanvasWidth, containerSize.width) - 1);
    const ch = Math.max(1, Math.min(optionsCanvasHeight, containerSize.height) - 1);
    const fitScale = Math.min(cw / imageWidth, ch / imageHeight, 1);
    return {
        canvasWidth: cw,
        canvasHeight: ch,
        imageScale: fitScale,
        imageLeft: 0,
        imageTop: 0,
        baseImageScale: fitScale,
    };
}
export function computeCoverLayout(imageWidth, imageHeight, optionsCanvasWidth, optionsCanvasHeight, containerSize) {
    const cw = containerSize.width || optionsCanvasWidth;
    const ch = containerSize.height || optionsCanvasHeight;
    const coverScale = Math.max(cw / imageWidth, ch / imageHeight);
    return {
        canvasWidth: cw,
        canvasHeight: ch,
        imageScale: coverScale,
        imageLeft: 0,
        imageTop: 0,
        baseImageScale: coverScale,
    };
}
export function computeExpandLayout(imageWidth, imageHeight, _optionsCanvasWidth, _optionsCanvasHeight, containerSize) {
    const cw = Math.max(containerSize.width, Math.floor(imageWidth));
    const ch = Math.max(containerSize.height, Math.floor(imageHeight));
    return {
        canvasWidth: cw,
        canvasHeight: ch,
        imageScale: 1,
        imageLeft: 0,
        imageTop: 0,
        baseImageScale: 1,
    };
}
export function applyCanvasDimensions(canvas, width, height, containerElement) {
    const iw = Math.max(1, Math.round(Number(width) || 1));
    const ih = Math.max(1, Math.round(Number(height) || 1));
    canvas.setDimensions({ width: iw, height: ih });
    forceReflow(containerElement);
}
//# sourceMappingURL=layout-manager.js.map