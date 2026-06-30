import { reportWarning } from '../core/callback-reporter.js';
import { animateProps, restoreOrigin } from '../fabric/fabric-animation.js';
export class TransformController {
    constructor(context) {
        Object.defineProperty(this, "context", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.context = context;
    }
    async scaleImage(factor) {
        if (!Number.isFinite(factor))
            return;
        const imageObject = this.context.getOriginalImage();
        if (!imageObject)
            return;
        if (this.context.guard.isAnimating())
            return;
        if (this.context.guard.isDisposed())
            return;
        const clamped = Math.max(this.context.options.minScale, Math.min(this.context.options.maxScale, factor));
        this.context.setCurrentScale(clamped);
        const targetAbs = this.context.getBaseImageScale() * clamped;
        try {
            const topLeft = computeTopLeftPoint(imageObject);
            imageObject.set({ originX: 'left', originY: 'top' });
            imageObject.setPositionByOrigin(topLeft, 'left', 'top');
            imageObject.setCoords();
        }
        catch (error) {
            reportWarning(this.context.options, error, 'scaleImage origin pre-anchor failed.');
        }
        try {
            await this.context.guard.runAnimation(() => animateProps(imageObject, { scaleX: targetAbs, scaleY: targetAbs }, {
                duration: this.context.options.animationDuration,
                onChange: () => this.context.canvas.requestRenderAll(),
            }, this.context.guard));
        }
        catch (error) {
            reportWarning(this.context.options, error, 'scaleImage animation failed.');
            return;
        }
        if (this.context.guard.isDisposed())
            return;
        imageObject.set({ scaleX: targetAbs, scaleY: targetAbs });
        imageObject.setCoords();
        if (this.context.afterTransformSnap)
            this.context.afterTransformSnap();
        this.context.saveCanvasState();
    }
    async rotateImage(degrees) {
        if (!Number.isFinite(degrees))
            return;
        const imageObject = this.context.getOriginalImage();
        if (!imageObject)
            return;
        if (this.context.guard.isAnimating())
            return;
        if (this.context.guard.isDisposed())
            return;
        this.context.setCurrentRotation(degrees);
        try {
            const centre = imageObject.getCenterPoint();
            imageObject.set({ originX: 'center', originY: 'center' });
            imageObject.setPositionByOrigin(centre, 'center', 'center');
            imageObject.setCoords();
        }
        catch (error) {
            reportWarning(this.context.options, error, 'rotateImage origin pre-anchor failed.');
        }
        let animationFailed = false;
        try {
            await this.context.guard.runAnimation(() => animateProps(imageObject, { angle: degrees }, {
                duration: this.context.options.animationDuration,
                onChange: () => this.context.canvas.requestRenderAll(),
            }, this.context.guard));
        }
        catch (error) {
            animationFailed = true;
            reportWarning(this.context.options, error, 'rotateImage animation failed.');
        }
        finally {
            if (this.context.guard.isDisposed()) {
                restoreOrigin(imageObject, 'left', 'top');
            }
        }
        if (animationFailed)
            return;
        if (this.context.guard.isDisposed())
            return;
        imageObject.set('angle', degrees);
        imageObject.setCoords();
        if (this.context.afterTransformSnap)
            this.context.afterTransformSnap();
        try {
            const newTopLeft = computeTopLeftPoint(imageObject);
            imageObject.set({ originX: 'left', originY: 'top' });
            imageObject.setPositionByOrigin(newTopLeft, 'left', 'top');
            imageObject.setCoords();
        }
        catch (error) {
            reportWarning(this.context.options, error, 'rotateImage origin post-restore failed.');
        }
        this.context.saveCanvasState();
    }
    async flipHorizontal() {
        await this.flipImage('flipX');
    }
    async flipVertical() {
        await this.flipImage('flipY');
    }
    async flipImage(property) {
        const imageObject = this.context.getOriginalImage();
        if (!imageObject)
            return;
        if (this.context.guard.isAnimating())
            return;
        if (this.context.guard.isDisposed())
            return;
        try {
            const centre = imageObject.getCenterPoint();
            imageObject.set({ originX: 'center', originY: 'center' });
            imageObject.setPositionByOrigin(centre, 'center', 'center');
            imageObject.set({ [property]: !imageObject[property] });
            imageObject.setCoords();
            const newTopLeft = computeTopLeftPoint(imageObject);
            imageObject.set({ originX: 'left', originY: 'top' });
            imageObject.setPositionByOrigin(newTopLeft, 'left', 'top');
            imageObject.setCoords();
        }
        catch (error) {
            reportWarning(this.context.options, error, `${property === 'flipX' ? 'flipHorizontal' : 'flipVertical'} failed.`);
            return;
        }
        if (this.context.guard.isDisposed())
            return;
        if (this.context.afterTransformSnap)
            this.context.afterTransformSnap();
        this.context.saveCanvasState();
    }
    async resetImageTransform() {
        if (!this.context.getOriginalImage())
            return;
        this.context.setSuppressSaveState(true);
        try {
            await this.scaleImage(1);
            await this.rotateImage(0);
            const imageObject = this.context.getOriginalImage();
            if (imageObject && !this.context.guard.isDisposed()) {
                imageObject.set({ flipX: false, flipY: false });
                imageObject.setCoords();
                if (this.context.afterTransformSnap)
                    this.context.afterTransformSnap();
            }
        }
        finally {
            this.context.setSuppressSaveState(false);
        }
        if (this.context.guard.isDisposed())
            return;
        this.context.saveCanvasState();
    }
}
function computeTopLeftPoint(object) {
    object.setCoords();
    const coords = object.getCoords();
    const first = coords[0];
    if (first)
        return first;
    const boundingRect = object.getBoundingRect();
    return { x: boundingRect.left, y: boundingRect.top };
}
//# sourceMappingURL=transform-controller.js.map