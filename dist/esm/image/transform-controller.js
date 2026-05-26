import { animateProps, restoreOrigin } from '../fabric/fabric-animation.js';
export class TransformController {
    constructor(ctx) {
        Object.defineProperty(this, "ctx", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.ctx = ctx;
    }
    async scaleImage(factor) {
        const img = this.ctx.getOriginalImage();
        if (!img)
            return;
        if (this.ctx.guard.isAnimating())
            return;
        if (this.ctx.guard.isDisposed())
            return;
        const clamped = Math.max(this.ctx.options.minScale, Math.min(this.ctx.options.maxScale, factor));
        this.ctx.setCurrentScale(clamped);
        const targetAbs = this.ctx.getBaseImageScale() * clamped;
        try {
            const topLeft = computeTopLeftPoint(img);
            img.set({ originX: 'left', originY: 'top' });
            img.setPositionByOrigin(topLeft, 'left', 'top');
            img.setCoords();
        }
        catch (err) {
            console.warn('[ImageEditor] scaleImage: origin pre-anchor failed', err);
        }
        try {
            await this.ctx.guard.runAnimation(() => animateProps(img, { scaleX: targetAbs, scaleY: targetAbs }, {
                duration: this.ctx.options.animationDuration,
                onChange: () => this.ctx.canvas.requestRenderAll(),
            }, this.ctx.guard));
        }
        catch (err) {
            console.warn('[ImageEditor] scaleImage animation error', err);
            return;
        }
        if (this.ctx.guard.isDisposed())
            return;
        img.set({ scaleX: targetAbs, scaleY: targetAbs });
        img.setCoords();
        if (this.ctx.afterTransformSnap)
            this.ctx.afterTransformSnap();
        this.ctx.saveCanvasState();
    }
    async rotateImage(degrees) {
        if (Number.isNaN(degrees))
            return;
        const img = this.ctx.getOriginalImage();
        if (!img)
            return;
        if (this.ctx.guard.isAnimating())
            return;
        if (this.ctx.guard.isDisposed())
            return;
        this.ctx.setCurrentRotation(degrees);
        try {
            const centre = img.getCenterPoint();
            img.set({ originX: 'center', originY: 'center' });
            img.setPositionByOrigin(centre, 'center', 'center');
            img.setCoords();
        }
        catch (err) {
            console.warn('[ImageEditor] rotateImage: origin pre-anchor failed', err);
        }
        let animationFailed = false;
        try {
            await this.ctx.guard.runAnimation(() => animateProps(img, { angle: degrees }, {
                duration: this.ctx.options.animationDuration,
                onChange: () => this.ctx.canvas.requestRenderAll(),
            }, this.ctx.guard));
        }
        catch (err) {
            animationFailed = true;
            console.warn('[ImageEditor] rotateImage animation error', err);
        }
        finally {
            if (this.ctx.guard.isDisposed()) {
                restoreOrigin(img, 'left', 'top');
            }
        }
        if (animationFailed)
            return;
        if (this.ctx.guard.isDisposed())
            return;
        img.set('angle', degrees);
        img.setCoords();
        if (this.ctx.afterTransformSnap)
            this.ctx.afterTransformSnap();
        try {
            const newTopLeft = computeTopLeftPoint(img);
            img.set({ originX: 'left', originY: 'top' });
            img.setPositionByOrigin(newTopLeft, 'left', 'top');
            img.setCoords();
        }
        catch (err) {
            console.warn('[ImageEditor] rotateImage: origin post-restore failed', err);
        }
        this.ctx.saveCanvasState();
    }
    async resetImageTransform() {
        if (!this.ctx.getOriginalImage())
            return;
        let chainSucceeded = false;
        this.ctx.setSuppressSaveState(true);
        try {
            await this.scaleImage(1);
            await this.rotateImage(0);
            chainSucceeded = true;
        }
        finally {
            this.ctx.setSuppressSaveState(false);
        }
        if (!chainSucceeded)
            return;
        if (this.ctx.guard.isDisposed())
            return;
        this.ctx.saveCanvasState();
    }
}
function computeTopLeftPoint(obj) {
    obj.setCoords();
    const coords = obj.getCoords();
    const first = coords[0];
    if (first)
        return first;
    const br = obj.getBoundingRect();
    return { x: br.left, y: br.top };
}
//# sourceMappingURL=transform-controller.js.map