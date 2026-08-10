import { FabricPointerSource } from './fabric-pointer-source.js';
import { InteractionRuntime } from './interaction-runtime.js';
import { PointerCoordinateMapper } from './pointer-coordinate-mapper.js';
import { CanvasPropertyLease, CanvasPropertyLeaseGroup } from './canvas-property-lease.js';
export class CanvasInteractionsController {
    constructor(host, tools, options, bindings = []) {
        Object.defineProperty(this, "host", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: host
        });
        Object.defineProperty(this, "listeners", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Set()
        });
        Object.defineProperty(this, "runtime", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "options", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "canvas", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "pointerSource", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "propertyLeases", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "leasedBindingId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "disposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        this.options = options;
        this.runtime = new InteractionRuntime(bindings, tools, host, options, () => {
            this.updateCanvasPresentation();
            this.publishStatus();
        });
    }
    refresh() {
        this.assertActive('refresh Canvas interactions');
        const canvas = this.host.getCanvas();
        if (canvas === this.canvas && this.pointerSource)
            return;
        this.releasePointerSource();
        this.canvas = canvas;
        if (canvas) {
            this.pointerSource = new FabricPointerSource(canvas, new PointerCoordinateMapper(this.host), this.runtime);
        }
        this.updateCanvasPresentation();
        this.publishStatus();
    }
    async cancel(reason = 'requested') {
        this.assertActive('cancel Canvas interactions');
        await this.runtime.cancelGesture(reason);
    }
    getStatus() {
        return this.status();
    }
    subscribe(listener) {
        this.assertActive('subscribe to Canvas interaction status');
        if (typeof listener !== 'function') {
            throw new TypeError('[ImageEditor] Canvas interaction status listener must be a function.');
        }
        this.listeners.add(listener);
        this.invokeListener(listener, this.status());
        let active = true;
        return Object.freeze({
            dispose: () => {
                if (!active)
                    return;
                active = false;
                this.listeners.delete(listener);
            },
        });
    }
    dispose() {
        if (this.disposed)
            return;
        this.runtime.dispose();
        this.releasePointerSource();
        this.disposed = true;
        this.publishStatus();
        this.listeners.clear();
    }
    status() {
        return Object.freeze({
            isBound: this.pointerSource !== null,
            isDisposed: this.disposed,
            ...this.runtime.status(),
        });
    }
    releasePointerSource() {
        var _a;
        this.releaseCanvasPresentation();
        (_a = this.pointerSource) === null || _a === void 0 ? void 0 : _a.dispose();
        this.pointerSource = null;
        this.canvas = null;
    }
    invalidateLifecycle(reason) {
        this.runtime.invalidateLifecycle(reason);
    }
    updateCanvasPresentation() {
        const canvas = this.canvas;
        const bindingId = this.runtime.status().activeBindingId;
        if (canvas && this.propertyLeases && this.leasedBindingId === bindingId)
            return;
        this.releaseCanvasPresentation();
        if (!canvas || !bindingId)
            return;
        const cursor = this.cursorFor(bindingId);
        const allowSelection = bindingId === 'text';
        const leases = new CanvasPropertyLeaseGroup();
        leases.add(new CanvasPropertyLease(canvas, 'defaultCursor', cursor));
        leases.add(new CanvasPropertyLease(canvas, 'hoverCursor', cursor));
        leases.add(new CanvasPropertyLease(canvas, 'selection', allowSelection));
        leases.add(new CanvasPropertyLease(canvas, 'skipTargetFind', !allowSelection));
        this.propertyLeases = leases;
        this.leasedBindingId = bindingId;
        canvas.requestRenderAll();
    }
    releaseCanvasPresentation() {
        var _a;
        if (!this.propertyLeases)
            return;
        this.propertyLeases.dispose();
        this.propertyLeases = null;
        this.leasedBindingId = null;
        (_a = this.canvas) === null || _a === void 0 ? void 0 : _a.requestRenderAll();
    }
    cursorFor(bindingId) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        if (bindingId === 'text')
            return (_b = (_a = this.options.cursors) === null || _a === void 0 ? void 0 : _a.text) !== null && _b !== void 0 ? _b : 'text';
        if (bindingId === 'shape')
            return (_d = (_c = this.options.cursors) === null || _c === void 0 ? void 0 : _c.shape) !== null && _d !== void 0 ? _d : 'crosshair';
        if (bindingId === 'draw')
            return (_f = (_e = this.options.cursors) === null || _e === void 0 ? void 0 : _e.draw) !== null && _f !== void 0 ? _f : 'crosshair';
        return (_h = (_g = this.options.cursors) === null || _g === void 0 ? void 0 : _g.mosaic) !== null && _h !== void 0 ? _h : 'crosshair';
    }
    publishStatus() {
        const status = this.status();
        for (const listener of [...this.listeners])
            this.invokeListener(listener, status);
    }
    invokeListener(listener, status) {
        try {
            listener(status);
        }
        catch (error) {
            this.host.reportWarning(error, 'A Canvas interaction status listener failed.');
        }
    }
    assertActive(operation) {
        if (this.disposed) {
            throw new Error(`[ImageEditor] Cannot ${operation} after Canvas Interactions disposal.`);
        }
    }
}
//# sourceMappingURL=canvas-interactions-controller.js.map