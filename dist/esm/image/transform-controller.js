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
        imageObject.setCoords();
        const beforeMatrix = imageObject.calcTransformMatrix();
        const previousScale = this.context.getCurrentScale();
        const previousScaleX = imageObject.scaleX;
        const previousScaleY = imageObject.scaleY;
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
            this.context.setCurrentScale(previousScale);
            if (!this.context.guard.isDisposed()) {
                imageObject.set({ scaleX: previousScaleX, scaleY: previousScaleY });
                imageObject.setCoords();
                this.completeImageTransform(beforeMatrix);
            }
            reportWarning(this.context.options, error, 'scaleImage animation failed.');
            return;
        }
        if (this.context.guard.isDisposed())
            return;
        imageObject.set({ scaleX: targetAbs, scaleY: targetAbs });
        imageObject.setCoords();
        try {
            this.completeImageTransform(beforeMatrix);
        }
        finally {
            this.context.saveCanvasState();
        }
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
        imageObject.setCoords();
        const beforeMatrix = imageObject.calcTransformMatrix();
        const previousRotation = this.context.getCurrentRotation();
        const previousAngle = imageObject.angle;
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
            this.context.setCurrentRotation(previousRotation);
            if (!this.context.guard.isDisposed()) {
                imageObject.set('angle', previousAngle !== null && previousAngle !== void 0 ? previousAngle : previousRotation);
                imageObject.setCoords();
                restoreOrigin(imageObject, 'left', 'top');
                this.completeImageTransform(beforeMatrix);
            }
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
        try {
            const newTopLeft = computeTopLeftPoint(imageObject);
            imageObject.set({ originX: 'left', originY: 'top' });
            imageObject.setPositionByOrigin(newTopLeft, 'left', 'top');
            imageObject.setCoords();
        }
        catch (error) {
            reportWarning(this.context.options, error, 'rotateImage origin post-restore failed.');
        }
        try {
            this.completeImageTransform(beforeMatrix);
        }
        finally {
            this.context.saveCanvasState();
        }
    }
    async flipHorizontal() {
        await this.flipImage('flipX');
    }
    async flipVertical() {
        await this.flipImage('flipY');
    }
    async flipImage(property) {
        var _a, _b;
        const imageObject = this.context.getOriginalImage();
        if (!imageObject)
            return;
        if (this.context.guard.isAnimating())
            return;
        if (this.context.guard.isDisposed())
            return;
        imageObject.setCoords();
        const beforeMatrix = imageObject.calcTransformMatrix();
        const previousFlipX = imageObject.flipX;
        const previousFlipY = imageObject.flipY;
        const previousOriginX = (_a = imageObject.originX) !== null && _a !== void 0 ? _a : 'left';
        const previousOriginY = (_b = imageObject.originY) !== null && _b !== void 0 ? _b : 'top';
        const operationName = property === 'flipX' ? 'flipHorizontal' : 'flipVertical';
        let centre = null;
        try {
            centre = imageObject.getCenterPoint();
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
            if (!this.context.guard.isDisposed()) {
                try {
                    imageObject.set({
                        flipX: previousFlipX,
                        flipY: previousFlipY,
                        originX: previousOriginX,
                        originY: previousOriginY,
                    });
                    if (centre) {
                        imageObject.setPositionByOrigin(centre, 'center', 'center');
                    }
                    imageObject.setCoords();
                    this.completeImageTransform(beforeMatrix);
                }
                catch (rollbackError) {
                    reportWarning(this.context.options, rollbackError, `${operationName} rollback failed.`);
                }
            }
            reportWarning(this.context.options, error, `${operationName} failed.`);
            return;
        }
        if (this.context.guard.isDisposed())
            return;
        this.completeImageTransform(beforeMatrix);
        this.context.saveCanvasState();
    }
    async resetImageTransform() {
        const initialImage = this.context.getOriginalImage();
        if (!initialImage)
            return;
        initialImage.setCoords();
        const beforeMatrix = initialImage.calcTransformMatrix();
        const previousOverlaySyncSuppressed = this.context.isOverlaySyncSuppressed();
        this.context.setSuppressSaveState(true);
        this.context.setSuppressOverlaySync(true);
        try {
            await this.scaleImage(1);
            await this.rotateImage(0);
            const imageObject = this.context.getOriginalImage();
            if (imageObject && !this.context.guard.isDisposed()) {
                imageObject.set({ flipX: false, flipY: false });
                imageObject.setCoords();
                this.context.finalizeImageTransformSnap();
            }
        }
        finally {
            this.context.setSuppressOverlaySync(previousOverlaySyncSuppressed);
            this.context.setSuppressSaveState(false);
        }
        if (this.context.guard.isDisposed())
            return;
        if (!this.context.isOverlaySyncSuppressed()) {
            this.context.applyOverlayTransformDelta(beforeMatrix);
        }
        this.context.syncOverlayAfterTransform();
        this.context.saveCanvasState();
    }
    completeImageTransform(beforeMatrix) {
        this.context.finalizeImageTransformSnap();
        if (this.context.isOverlaySyncSuppressed())
            return;
        this.context.applyOverlayTransformDelta(beforeMatrix);
        this.context.syncOverlayAfterTransform();
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