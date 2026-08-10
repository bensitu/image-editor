function finiteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
function pointerId(event) {
    return finiteNumber(event.pointerId);
}
function pointerType(event) {
    return typeof event.pointerType === 'string' && event.pointerType.length > 0
        ? event.pointerType
        : null;
}
function samePointer(activePointerId, event) {
    const incoming = pointerId(event);
    return activePointerId === null || incoming === null || activePointerId === incoming;
}
export class FabricPointerSource {
    constructor(canvas, coordinates, sink) {
        Object.defineProperty(this, "canvas", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: canvas
        });
        Object.defineProperty(this, "coordinates", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: coordinates
        });
        Object.defineProperty(this, "sink", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: sink
        });
        Object.defineProperty(this, "disposers", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "activePointerId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "pointerActive", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "disposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        this.disposers.push(canvas.on('mouse:down', (event) => this.handleDown(event)), canvas.on('mouse:move', (event) => this.handleMove(event)), canvas.on('mouse:up', (event) => this.handleUp(event)));
        const view = canvas.upperCanvasEl.ownerDocument.defaultView;
        if (view) {
            const handleWindowUp = (event) => this.handleNativeUp(event);
            const handleCancel = () => this.cancelActivePointer();
            view.addEventListener('pointerup', handleWindowUp);
            view.addEventListener('pointercancel', handleCancel);
            view.addEventListener('blur', handleCancel);
            canvas.upperCanvasEl.addEventListener('lostpointercapture', handleCancel);
            this.disposers.push(() => view.removeEventListener('pointerup', handleWindowUp), () => view.removeEventListener('pointercancel', handleCancel), () => view.removeEventListener('blur', handleCancel), () => canvas.upperCanvasEl.removeEventListener('lostpointercapture', handleCancel));
        }
    }
    dispose() {
        if (this.disposed)
            return;
        this.disposed = true;
        this.cancelActivePointer();
        for (const dispose of this.disposers.splice(0).reverse())
            dispose();
    }
    handleDown(event) {
        var _a, _b;
        if (this.disposed || this.pointerActive)
            return;
        const native = event.e;
        if (native.isPrimary === false || ((_a = finiteNumber(native.button)) !== null && _a !== void 0 ? _a : 0) !== 0)
            return;
        const sample = this.createSample(event.scenePoint, (_b = event.target) !== null && _b !== void 0 ? _b : null, native);
        if (!sample)
            return;
        this.pointerActive = true;
        this.activePointerId = sample.pointerId;
        this.sink.down(sample);
    }
    handleMove(event) {
        var _a;
        if (this.disposed || !this.pointerActive)
            return;
        const native = event.e;
        if (!samePointer(this.activePointerId, native))
            return;
        const sample = this.createSample(event.scenePoint, (_a = event.target) !== null && _a !== void 0 ? _a : null, native);
        if (sample)
            this.sink.move(sample);
    }
    handleUp(event) {
        var _a;
        if (this.disposed || !this.pointerActive)
            return;
        const native = event.e;
        if (!samePointer(this.activePointerId, native))
            return;
        const sample = this.createSample(event.scenePoint, (_a = event.target) !== null && _a !== void 0 ? _a : null, native);
        this.clearPointer();
        if (sample)
            this.sink.up(sample);
        else
            this.sink.cancel();
    }
    handleNativeUp(event) {
        if (this.disposed || !this.pointerActive || !samePointer(this.activePointerId, event)) {
            return;
        }
        const scenePoint = this.canvas.getScenePoint(event);
        const sample = this.createSample(scenePoint, null, event);
        this.clearPointer();
        if (sample)
            this.sink.up(sample);
        else
            this.sink.cancel();
    }
    cancelActivePointer() {
        if (!this.pointerActive)
            return;
        this.clearPointer();
        this.sink.cancel();
    }
    clearPointer() {
        this.pointerActive = false;
        this.activePointerId = null;
    }
    createSample(scenePoint, target, native) {
        var _a, _b;
        if (!Number.isFinite(scenePoint.x) || !Number.isFinite(scenePoint.y))
            return null;
        const canvasPoint = Object.freeze({ x: scenePoint.x, y: scenePoint.y });
        return Object.freeze({
            canvasPoint,
            imagePoint: this.coordinates.toImagePoint(canvasPoint),
            geometryRevision: this.coordinates.getGeometryRevision(),
            timestamp: (_a = finiteNumber(native.timeStamp)) !== null && _a !== void 0 ? _a : Date.now(),
            pointerId: pointerId(native),
            pointerType: pointerType(native),
            button: (_b = finiteNumber(native.button)) !== null && _b !== void 0 ? _b : 0,
            shiftKey: native.shiftKey === true,
            altKey: native.altKey === true,
            ctrlKey: native.ctrlKey === true,
            metaKey: native.metaKey === true,
            target,
        });
    }
}
//# sourceMappingURL=fabric-pointer-source.js.map