(function(global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ?  factory(exports, require('@bensitu/image-editor/sdk'), require('@bensitu/image-editor/core')) :
  typeof define === 'function' && define.amd ? define(['exports', '@bensitu/image-editor/sdk', '@bensitu/image-editor/core'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory((global.ImageEditorPlugins = global.ImageEditorPlugins || {},global.ImageEditorPlugins.CanvasInteractions = global.ImageEditorPlugins.CanvasInteractions || {}), global.ImageEditor,global.ImageEditor));
})(this, function(exports, _bensitu_image_editor_sdk, _bensitu_image_editor_core) {
if (Object.prototype.hasOwnProperty.call(exports, "canvasInteractionsPlugin")) return;
Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: 'Module' } });
//#region dist/esm/plugins/canvas-interactions/fabric-pointer-source.js
	function finiteNumber(value) {
		return typeof value === "number" && Number.isFinite(value) ? value : null;
	}
	function pointerId(event) {
		return finiteNumber(event.pointerId);
	}
	function pointerType(event) {
		return typeof event.pointerType === "string" && event.pointerType.length > 0 ? event.pointerType : null;
	}
	function samePointer(activePointerId, event) {
		const incoming = pointerId(event);
		return activePointerId === null || incoming === null || activePointerId === incoming;
	}
	var FabricPointerSource = class {
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
			this.disposers.push(canvas.on("mouse:down", (event) => this.handleDown(event)), canvas.on("mouse:move", (event) => this.handleMove(event)), canvas.on("mouse:up", (event) => this.handleUp(event)));
			const view = canvas.upperCanvasEl.ownerDocument.defaultView;
			if (view) {
				const handleWindowUp = (event) => this.handleNativeUp(event);
				const handleCancel = () => this.cancelActivePointer();
				view.addEventListener("pointerup", handleWindowUp);
				view.addEventListener("pointercancel", handleCancel);
				view.addEventListener("blur", handleCancel);
				canvas.upperCanvasEl.addEventListener("lostpointercapture", handleCancel);
				this.disposers.push(() => view.removeEventListener("pointerup", handleWindowUp), () => view.removeEventListener("pointercancel", handleCancel), () => view.removeEventListener("blur", handleCancel), () => canvas.upperCanvasEl.removeEventListener("lostpointercapture", handleCancel));
			}
		}
		dispose() {
			if (this.disposed) return;
			this.disposed = true;
			this.cancelActivePointer();
			for (const dispose of this.disposers.splice(0).reverse()) dispose();
		}
		handleDown(event) {
			var _a, _b;
			if (this.disposed || this.pointerActive) return;
			const native = event.e;
			if (native.isPrimary === false || ((_a = finiteNumber(native.button)) !== null && _a !== void 0 ? _a : 0) !== 0) return;
			const sample = this.createSample(event.scenePoint, (_b = event.target) !== null && _b !== void 0 ? _b : null, native);
			if (!sample) return;
			this.pointerActive = true;
			this.activePointerId = sample.pointerId;
			this.sink.down(sample);
		}
		handleMove(event) {
			var _a;
			if (this.disposed || !this.pointerActive) return;
			const native = event.e;
			if (!samePointer(this.activePointerId, native)) return;
			const sample = this.createSample(event.scenePoint, (_a = event.target) !== null && _a !== void 0 ? _a : null, native);
			if (sample) this.sink.move(sample);
		}
		handleUp(event) {
			var _a;
			if (this.disposed || !this.pointerActive) return;
			const native = event.e;
			if (!samePointer(this.activePointerId, native)) return;
			const sample = this.createSample(event.scenePoint, (_a = event.target) !== null && _a !== void 0 ? _a : null, native);
			this.clearPointer();
			if (sample) this.sink.up(sample);
			else this.sink.cancel();
		}
		handleNativeUp(event) {
			if (this.disposed || !this.pointerActive || !samePointer(this.activePointerId, event)) return;
			const scenePoint = this.canvas.getScenePoint(event);
			const sample = this.createSample(scenePoint, null, event);
			this.clearPointer();
			if (sample) this.sink.up(sample);
			else this.sink.cancel();
		}
		cancelActivePointer() {
			if (!this.pointerActive) return;
			this.clearPointer();
			this.sink.cancel();
		}
		clearPointer() {
			this.pointerActive = false;
			this.activePointerId = null;
		}
		createSample(scenePoint, target, native) {
			var _a, _b;
			if (!Number.isFinite(scenePoint.x) || !Number.isFinite(scenePoint.y)) return null;
			const canvasPoint = Object.freeze({
				x: scenePoint.x,
				y: scenePoint.y
			});
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
				target
			});
		}
	};

//#endregion
//#region dist/esm/plugins/canvas-interactions/interaction-runtime.js
	function isPromiseLike(value) {
		return (typeof value === "object" || typeof value === "function") && value !== null && typeof value.then === "function";
	}
	var InteractionRuntime = class {
		constructor(bindings, tools, diagnostics, options, onStatusChange) {
			Object.defineProperty(this, "bindings", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: bindings
			});
			Object.defineProperty(this, "diagnostics", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: diagnostics
			});
			Object.defineProperty(this, "options", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: options
			});
			Object.defineProperty(this, "onStatusChange", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: onStatusChange
			});
			Object.defineProperty(this, "toolSubscription", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: void 0
			});
			Object.defineProperty(this, "activeToolId", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: null
			});
			Object.defineProperty(this, "activeGesture", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: null
			});
			Object.defineProperty(this, "epoch", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: 0
			});
			Object.defineProperty(this, "lifecycleEpoch", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: 0
			});
			Object.defineProperty(this, "disposed", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: false
			});
			this.assertUniqueBindings();
			this.activeToolId = tools.getActiveToolId();
			this.toolSubscription = tools.subscribe(({ activeToolId }) => {
				this.activeToolId = activeToolId;
				const owner = this.activeGesture;
				if (owner && owner.binding.toolId !== activeToolId) this.invalidateLocal("tool-change");
				else this.onStatusChange();
			}, { emitCurrent: false });
		}
		down(sample) {
			if (this.disposed || this.activeGesture || !this.activeToolId) return;
			const binding = this.bindings.find((candidate) => candidate.toolId === this.activeToolId);
			if (!binding) return;
			const epoch = ++this.epoch;
			const lifecycleEpoch = this.lifecycleEpoch;
			const gestureContext = Object.freeze({
				epoch,
				isCurrent: () => this.isEpochCurrent(epoch),
				canResume: (toolId) => !this.disposed && this.lifecycleEpoch === lifecycleEpoch && (this.activeToolId === null || this.activeToolId === toolId)
			});
			try {
				const claim = binding.claim({
					sample,
					activeToolId: this.activeToolId,
					gesture: gestureContext
				});
				if (!claim) return;
				this.activeGesture = {
					binding,
					gesture: claim.gesture,
					epoch,
					geometryRevision: sample.geometryRevision,
					ending: false
				};
				this.onStatusChange();
				if (isPromiseLike(claim.started)) (0, _bensitu_image_editor_sdk.observePromise)(claim.started, (error) => {
					var _a;
					if (((_a = this.activeGesture) === null || _a === void 0 ? void 0 : _a.epoch) === epoch) this.handleError(error, binding.id, "claim");
				});
			} catch (error) {
				this.handleError(error, binding.id, "claim");
			}
		}
		move(sample) {
			const owner = this.activeGesture;
			if (!owner || owner.ending || !this.isSampleCurrent(owner, sample)) return;
			this.invoke(owner, "move", () => owner.binding.move(owner.gesture, sample));
		}
		up(sample) {
			const owner = this.activeGesture;
			if (!owner || owner.ending || !this.isSampleCurrent(owner, sample)) return;
			owner.ending = true;
			this.invoke(owner, "end", () => owner.binding.end(owner.gesture, sample), true);
		}
		cancel() {
			if (this.disposed) return;
			(0, _bensitu_image_editor_sdk.observePromise)(this.cancelGesture("pointer-cancel"), (error) => {
				this.reportError(error, null, "cancel");
			});
		}
		async cancelGesture(reason = "requested") {
			this.assertActive("cancel Canvas interactions");
			const owner = this.activeGesture;
			this.invalidateLocal(reason);
			if (!owner) return;
			try {
				await owner.binding.cancel(owner.gesture, reason);
			} catch (error) {
				this.reportError(error, owner.binding.id, "cancel");
				throw error;
			}
		}
		invalidateLifecycle(reason) {
			if (this.disposed) return;
			this.lifecycleEpoch += 1;
			this.invalidateLocal(reason);
		}
		status() {
			var _a;
			const activeBinding = this.activeToolId ? this.bindings.find((binding) => binding.toolId === this.activeToolId) : void 0;
			return Object.freeze({
				activeBindingId: (_a = activeBinding === null || activeBinding === void 0 ? void 0 : activeBinding.id) !== null && _a !== void 0 ? _a : null,
				gestureActive: this.activeGesture !== null
			});
		}
		dispose() {
			if (this.disposed) return;
			this.lifecycleEpoch += 1;
			this.invalidateLocal("dispose");
			this.disposed = true;
			this.toolSubscription.dispose();
		}
		invoke(owner, operation, task, complete = false) {
			try {
				const result = task();
				if (isPromiseLike(result)) (0, _bensitu_image_editor_sdk.observePromise)(Promise.resolve(result).then(() => {
					if (complete && this.activeGesture === owner) this.complete(owner);
				}), (error) => {
					if (this.activeGesture === owner) this.handleError(error, owner.binding.id, operation);
				});
				else if (complete && this.activeGesture === owner) this.complete(owner);
			} catch (error) {
				this.handleError(error, owner.binding.id, operation);
			}
		}
		complete(owner) {
			if (this.activeGesture !== owner) return;
			this.activeGesture = null;
			this.onStatusChange();
		}
		isSampleCurrent(owner, sample) {
			if (sample.geometryRevision === owner.geometryRevision) return true;
			this.invalidateLocal("image-replaced");
			return false;
		}
		isEpochCurrent(epoch) {
			var _a;
			return !this.disposed && this.epoch === epoch && ((_a = this.activeGesture) === null || _a === void 0 ? void 0 : _a.epoch) === epoch;
		}
		invalidateLocal(_reason) {
			this.epoch += 1;
			const hadGesture = this.activeGesture !== null;
			this.activeGesture = null;
			if (hadGesture) this.onStatusChange();
		}
		handleError(error, bindingId, operation) {
			const owner = this.activeGesture;
			this.invalidateLocal("error");
			if (owner) try {
				const cleanup = owner.binding.cancel(owner.gesture, "error");
				if (isPromiseLike(cleanup)) (0, _bensitu_image_editor_sdk.observePromise)(cleanup, (cleanupError) => {
					this.reportError(cleanupError, owner.binding.id, "cancel");
				});
			} catch (cleanupError) {
				this.reportError(cleanupError, owner.binding.id, "cancel");
			}
			this.reportError(error, bindingId, operation);
		}
		reportError(error, bindingId, operation) {
			var _a, _b;
			this.diagnostics.reportError(error, `Canvas interaction ${operation} failed${bindingId ? ` for "${bindingId}"` : ""}.`);
			try {
				(_b = (_a = this.options).onInteractionError) === null || _b === void 0 || _b.call(_a, error, Object.freeze({
					bindingId,
					operation
				}));
			} catch (callbackError) {
				this.diagnostics.reportWarning(callbackError, "A Canvas interaction error observer failed.");
			}
		}
		assertUniqueBindings() {
			const ids = /* @__PURE__ */ new Set();
			const tools = /* @__PURE__ */ new Set();
			for (const binding of this.bindings) {
				if (ids.has(binding.id)) throw new Error(`[ImageEditor] Duplicate Canvas interaction binding "${binding.id}".`);
				if (tools.has(binding.toolId)) throw new Error(`[ImageEditor] Canvas interaction Tool "${binding.toolId}" has multiple bindings.`);
				ids.add(binding.id);
				tools.add(binding.toolId);
			}
		}
		assertActive(operation) {
			if (this.disposed) throw new Error(`[ImageEditor] Cannot ${operation} after Canvas Interactions disposal.`);
		}
	};

//#endregion
//#region dist/esm/plugins/canvas-interactions/pointer-coordinate-mapper.js
	var PointerCoordinateMapper = class {
		constructor(baseImage) {
			Object.defineProperty(this, "baseImage", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: baseImage
			});
		}
		getGeometryRevision() {
			return this.baseImage.getGeometryRevision();
		}
		toImagePoint(scenePoint) {
			const image = this.baseImage.getBaseImage();
			const imageInfo = this.baseImage.getImageInfo();
			if (!image || !imageInfo) return null;
			const matrixValue = image.calcTransformMatrix();
			if (!(0, _bensitu_image_editor_core.isFiniteAffineMatrix)(matrixValue)) return null;
			const local = (0, _bensitu_image_editor_core.applyAffineToPoint)((0, _bensitu_image_editor_core.invertAffine)(matrixValue), scenePoint);
			const x = local.x + imageInfo.naturalWidth / 2;
			const y = local.y + imageInfo.naturalHeight / 2;
			if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x >= imageInfo.naturalWidth || y < 0 || y >= imageInfo.naturalHeight) return null;
			return Object.freeze({
				x,
				y
			});
		}
	};

//#endregion
//#region dist/esm/plugins/canvas-interactions/canvas-property-lease.js
	var CanvasPropertyLease = class {
		constructor(target, key, owned) {
			Object.defineProperty(this, "target", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: target
			});
			Object.defineProperty(this, "key", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: key
			});
			Object.defineProperty(this, "owned", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: owned
			});
			Object.defineProperty(this, "previous", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: void 0
			});
			Object.defineProperty(this, "active", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: true
			});
			this.previous = target[key];
			target[key] = owned;
		}
		dispose() {
			if (!this.active) return;
			this.active = false;
			if (this.target[this.key] === this.owned) this.target[this.key] = this.previous;
		}
	};
	var CanvasPropertyLeaseGroup = class {
		constructor() {
			Object.defineProperty(this, "leases", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: []
			});
			Object.defineProperty(this, "active", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: true
			});
		}
		add(lease) {
			if (!this.active) {
				lease.dispose();
				throw new Error("[ImageEditor] Cannot add a Canvas property lease after release.");
			}
			this.leases.push(lease);
			return lease;
		}
		dispose() {
			if (!this.active) return;
			this.active = false;
			for (const lease of this.leases.reverse()) lease.dispose();
			this.leases.length = 0;
		}
	};

//#endregion
//#region dist/esm/plugins/canvas-interactions/canvas-interactions-controller.js
	var CanvasInteractionsController = class {
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
				value: /* @__PURE__ */ new Set()
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
			this.assertActive("refresh Canvas interactions");
			const canvas = this.host.getCanvas();
			if (canvas === this.canvas && this.pointerSource) return;
			this.releasePointerSource();
			this.canvas = canvas;
			if (canvas) this.pointerSource = new FabricPointerSource(canvas, new PointerCoordinateMapper(this.host), this.runtime);
			this.updateCanvasPresentation();
			this.publishStatus();
		}
		async cancel(reason = "requested") {
			this.assertActive("cancel Canvas interactions");
			await this.runtime.cancelGesture(reason);
		}
		getStatus() {
			return this.status();
		}
		subscribe(listener) {
			this.assertActive("subscribe to Canvas interaction status");
			if (typeof listener !== "function") throw new TypeError("[ImageEditor] Canvas interaction status listener must be a function.");
			this.listeners.add(listener);
			this.invokeListener(listener, this.status());
			let active = true;
			return Object.freeze({ dispose: () => {
				if (!active) return;
				active = false;
				this.listeners.delete(listener);
			} });
		}
		dispose() {
			if (this.disposed) return;
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
				...this.runtime.status()
			});
		}
		releasePointerSource() {
			var _a;
			this.releaseCanvasPresentation();
			(_a = this.pointerSource) === null || _a === void 0 || _a.dispose();
			this.pointerSource = null;
			this.canvas = null;
		}
		invalidateLifecycle(reason) {
			this.runtime.invalidateLifecycle(reason);
		}
		updateCanvasPresentation() {
			const canvas = this.canvas;
			const bindingId = this.runtime.status().activeBindingId;
			if (canvas && this.propertyLeases && this.leasedBindingId === bindingId) return;
			this.releaseCanvasPresentation();
			if (!canvas || !bindingId) return;
			const cursor = this.cursorFor(bindingId);
			const allowSelection = bindingId === "text";
			const leases = new CanvasPropertyLeaseGroup();
			leases.add(new CanvasPropertyLease(canvas, "defaultCursor", cursor));
			leases.add(new CanvasPropertyLease(canvas, "hoverCursor", cursor));
			leases.add(new CanvasPropertyLease(canvas, "selection", allowSelection));
			leases.add(new CanvasPropertyLease(canvas, "skipTargetFind", !allowSelection));
			this.propertyLeases = leases;
			this.leasedBindingId = bindingId;
			canvas.requestRenderAll();
		}
		releaseCanvasPresentation() {
			var _a;
			if (!this.propertyLeases) return;
			this.propertyLeases.dispose();
			this.propertyLeases = null;
			this.leasedBindingId = null;
			(_a = this.canvas) === null || _a === void 0 || _a.requestRenderAll();
		}
		cursorFor(bindingId) {
			var _a, _b, _c, _d, _e, _f, _g, _h;
			if (bindingId === "text") return (_b = (_a = this.options.cursors) === null || _a === void 0 ? void 0 : _a.text) !== null && _b !== void 0 ? _b : "text";
			if (bindingId === "shape") return (_d = (_c = this.options.cursors) === null || _c === void 0 ? void 0 : _c.shape) !== null && _d !== void 0 ? _d : "crosshair";
			if (bindingId === "draw") return (_f = (_e = this.options.cursors) === null || _e === void 0 ? void 0 : _e.draw) !== null && _f !== void 0 ? _f : "crosshair";
			return (_h = (_g = this.options.cursors) === null || _g === void 0 ? void 0 : _g.mosaic) !== null && _h !== void 0 ? _h : "crosshair";
		}
		publishStatus() {
			const status = this.status();
			for (const listener of [...this.listeners]) this.invokeListener(listener, status);
		}
		invokeListener(listener, status) {
			try {
				listener(status);
			} catch (error) {
				this.host.reportWarning(error, "A Canvas interaction status listener failed.");
			}
		}
		assertActive(operation) {
			if (this.disposed) throw new Error(`[ImageEditor] Cannot ${operation} after Canvas Interactions disposal.`);
		}
	};

//#endregion
//#region dist/esm/plugins/canvas-interactions/schedulers/latest-value-scheduler.js
	var LatestValueScheduler = class {
		constructor(worker) {
			Object.defineProperty(this, "worker", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: worker
			});
			Object.defineProperty(this, "pending", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: null
			});
			Object.defineProperty(this, "flushWaiters", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: []
			});
			Object.defineProperty(this, "running", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: false
			});
			Object.defineProperty(this, "cancelled", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: false
			});
			Object.defineProperty(this, "failure", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: null
			});
		}
		pushLatest(value) {
			if (this.cancelled) return Promise.resolve();
			if (this.failure !== null) return Promise.reject(this.failure);
			return new Promise((resolve, reject) => {
				var _a;
				(_a = this.pending) === null || _a === void 0 || _a.resolve();
				this.pending = {
					value,
					resolve,
					reject
				};
				this.startNext();
			});
		}
		flush() {
			if (this.cancelled) return Promise.resolve();
			if (this.failure !== null) return Promise.reject(this.failure);
			if (!this.running && !this.pending) return Promise.resolve();
			return new Promise((resolve, reject) => {
				this.flushWaiters.push({
					resolve,
					reject
				});
			});
		}
		cancel() {
			var _a;
			if (this.cancelled) return;
			this.cancelled = true;
			(_a = this.pending) === null || _a === void 0 || _a.resolve();
			this.pending = null;
			this.settleFlushWaiters();
		}
		startNext() {
			if (this.running || this.cancelled || this.failure !== null) return;
			const scheduled = this.pending;
			if (!scheduled) {
				this.settleFlushWaiters();
				return;
			}
			this.pending = null;
			this.running = true;
			Promise.resolve().then(() => this.worker(scheduled.value)).then(() => scheduled.resolve(), (error) => {
				var _a;
				if (this.cancelled) {
					scheduled.resolve();
					return;
				}
				this.failure = error;
				scheduled.reject(error);
				(_a = this.pending) === null || _a === void 0 || _a.reject(error);
				this.pending = null;
			}).finally(() => {
				this.running = false;
				if (!this.cancelled && this.failure === null && this.pending) this.startNext();
				else this.settleFlushWaiters();
			});
		}
		settleFlushWaiters() {
			if (this.running && !this.cancelled && this.failure === null) return;
			for (const waiter of this.flushWaiters.splice(0)) if (this.failure !== null) waiter.reject(this.failure);
			else waiter.resolve();
		}
	};

//#endregion
//#region dist/esm/plugins/canvas-interactions/bindings/shape-interaction-binding.js
	const SHAPE_TOOL_ID = "annotation:shape";
	const DEFAULT_MINIMUM_DRAG_DISTANCE = 2;
	function geometry(kind, start, end) {
		if (kind === "rect") return Object.freeze({
			kind,
			left: Math.min(start.x, end.x),
			top: Math.min(start.y, end.y),
			width: Math.abs(end.x - start.x),
			height: Math.abs(end.y - start.y)
		});
		return Object.freeze({
			kind,
			start: Object.freeze({ ...start }),
			end: Object.freeze({ ...end })
		});
	}
	function validFinalGeometry(value) {
		return value.kind !== "rect" || value.width > 0 && value.height > 0;
	}
	var ShapeInteractionBinding = class {
		constructor(options) {
			var _a;
			Object.defineProperty(this, "id", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: "shape"
			});
			Object.defineProperty(this, "toolId", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: SHAPE_TOOL_ID
			});
			Object.defineProperty(this, "apiValue", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: null
			});
			Object.defineProperty(this, "minimumDragDistance", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: void 0
			});
			Object.defineProperty(this, "continuous", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: void 0
			});
			Object.defineProperty(this, "plugin", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: void 0
			});
			this.plugin = options.plugin;
			this.minimumDragDistance = (_a = options.minimumDragDistance) !== null && _a !== void 0 ? _a : DEFAULT_MINIMUM_DRAG_DISTANCE;
			if (!Number.isFinite(this.minimumDragDistance) || this.minimumDragDistance < 0) throw new TypeError("[ImageEditor] Shape minimum drag distance must be a finite non-negative number.");
			this.continuous = options.continuous === true;
		}
		claim(context) {
			const session = this.api().getSession();
			if (!session) return null;
			const gesture = {
				start: context.sample.canvasPoint,
				kind: session.kind,
				sessionOptions: session.options,
				context: context.gesture,
				previews: new LatestValueScheduler((value) => {
					if (!context.gesture.isCurrent()) return;
					return this.api().updatePreview(value);
				})
			};
			return Object.freeze({ gesture });
		}
		move(gesture, sample) {
			return gesture.previews.pushLatest(geometry(gesture.kind, gesture.start, sample.canvasPoint));
		}
		async end(gesture, sample) {
			const distance = Math.hypot(sample.canvasPoint.x - gesture.start.x, sample.canvasPoint.y - gesture.start.y);
			const finalGeometry = geometry(gesture.kind, gesture.start, sample.canvasPoint);
			if (distance < this.minimumDragDistance || !validFinalGeometry(finalGeometry)) {
				gesture.previews.cancel();
				await this.api().cancel();
				return;
			}
			await gesture.previews.pushLatest(finalGeometry);
			await gesture.previews.flush();
			if (!gesture.context.isCurrent()) return;
			await this.api().commit();
			if (this.continuous && gesture.context.canResume(this.toolId)) await this.api().enter(gesture.sessionOptions);
		}
		async cancel(gesture, _reason) {
			gesture.previews.cancel();
			const api = this.api();
			if (api.getSession()) await api.cancel();
		}
		api() {
			var _a;
			return (_a = this.apiValue) !== null && _a !== void 0 ? _a : this.apiValue = this.plugin.resolve();
		}
	};

//#endregion
//#region dist/esm/plugins/canvas-interactions/schedulers/ordered-sample-scheduler.js
	var OrderedSampleScheduler = class {
		constructor(worker) {
			Object.defineProperty(this, "worker", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: worker
			});
			Object.defineProperty(this, "pending", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: []
			});
			Object.defineProperty(this, "flushWaiters", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: []
			});
			Object.defineProperty(this, "running", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: false
			});
			Object.defineProperty(this, "cancelled", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: false
			});
			Object.defineProperty(this, "failure", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: null
			});
		}
		push(sample) {
			if (this.cancelled) return Promise.resolve();
			if (this.failure !== null) return Promise.reject(this.failure);
			return new Promise((resolve, reject) => {
				this.pending.push({
					sample,
					resolve,
					reject
				});
				this.startNext();
			});
		}
		flush() {
			if (this.cancelled) return Promise.resolve();
			if (this.failure !== null) return Promise.reject(this.failure);
			if (!this.running && this.pending.length === 0) return Promise.resolve();
			return new Promise((resolve, reject) => {
				this.flushWaiters.push({
					resolve,
					reject
				});
			});
		}
		cancel() {
			if (this.cancelled) return;
			this.cancelled = true;
			for (const scheduled of this.pending.splice(0)) scheduled.resolve();
			this.settleFlushWaiters();
		}
		startNext() {
			if (this.running || this.cancelled || this.failure !== null) return;
			const scheduled = this.pending.shift();
			if (!scheduled) {
				this.settleFlushWaiters();
				return;
			}
			this.running = true;
			Promise.resolve().then(() => this.worker(scheduled.sample)).then(() => scheduled.resolve(), (error) => {
				if (this.cancelled) {
					scheduled.resolve();
					return;
				}
				this.failure = error;
				scheduled.reject(error);
				for (const pending of this.pending.splice(0)) pending.reject(error);
			}).finally(() => {
				this.running = false;
				if (!this.cancelled && this.failure === null && this.pending.length > 0) this.startNext();
				else this.settleFlushWaiters();
			});
		}
		settleFlushWaiters() {
			if (this.running && !this.cancelled && this.failure === null) return;
			for (const waiter of this.flushWaiters.splice(0)) if (this.failure !== null) waiter.reject(this.failure);
			else waiter.resolve();
		}
	};

//#endregion
//#region dist/esm/plugins/canvas-interactions/bindings/draw-interaction-binding.js
	const DRAW_TOOL_ID = "annotation:draw";
	var DrawInteractionBinding = class {
		constructor(options) {
			Object.defineProperty(this, "id", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: "draw"
			});
			Object.defineProperty(this, "toolId", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: DRAW_TOOL_ID
			});
			Object.defineProperty(this, "plugin", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: void 0
			});
			Object.defineProperty(this, "apiValue", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: null
			});
			this.plugin = options.plugin;
		}
		claim(context) {
			const session = this.api().getSession();
			if (!session || session.isStrokeActive) return null;
			const started = Promise.resolve().then(async () => {
				if (!context.gesture.isCurrent()) return;
				await this.api().beginStroke(context.sample.canvasPoint);
			});
			const gesture = {
				context: context.gesture,
				started,
				samples: new OrderedSampleScheduler(async (point) => {
					await started;
					if (!context.gesture.isCurrent()) return;
					await this.api().appendStroke(point);
				})
			};
			return Object.freeze({
				gesture,
				started
			});
		}
		move(gesture, sample) {
			return gesture.samples.push(sample.canvasPoint);
		}
		async end(gesture, _sample) {
			await gesture.started;
			await gesture.samples.flush();
			if (!gesture.context.isCurrent()) return;
			await this.api().endStroke();
		}
		async cancel(gesture, _reason) {
			var _a;
			gesture.samples.cancel();
			try {
				await gesture.started;
			} catch {
				return;
			}
			const api = this.api();
			if ((_a = api.getSession()) === null || _a === void 0 ? void 0 : _a.isStrokeActive) await api.cancelStroke();
		}
		api() {
			var _a;
			return (_a = this.apiValue) !== null && _a !== void 0 ? _a : this.apiValue = this.plugin.resolve();
		}
	};

//#endregion
//#region dist/esm/plugins/canvas-interactions/bindings/mosaic-interaction-binding.js
	const MOSAIC_TOOL_ID = "plugin:mosaic";
	function mosaicPoint(point) {
		return Object.freeze({
			xPx: point.x,
			yPx: point.y
		});
	}
	var MosaicInteractionBinding = class {
		constructor(options) {
			Object.defineProperty(this, "id", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: "mosaic"
			});
			Object.defineProperty(this, "toolId", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: MOSAIC_TOOL_ID
			});
			Object.defineProperty(this, "plugin", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: void 0
			});
			Object.defineProperty(this, "apiValue", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: null
			});
			this.plugin = options.plugin;
		}
		claim(context) {
			const session = this.api().getSession();
			const startPoint = context.sample.imagePoint;
			if (!session || session.isStrokeActive || !startPoint) return null;
			const started = Promise.resolve().then(async () => {
				if (!context.gesture.isCurrent()) return;
				await this.api().beginStroke(mosaicPoint(startPoint));
			});
			const gesture = {
				context: context.gesture,
				started,
				samples: new OrderedSampleScheduler(async (point) => {
					await started;
					if (!context.gesture.isCurrent()) return;
					await this.api().appendStroke(mosaicPoint(point));
				})
			};
			return Object.freeze({
				gesture,
				started
			});
		}
		move(gesture, sample) {
			if (sample.imagePoint) return gesture.samples.push(sample.imagePoint);
		}
		async end(gesture, _sample) {
			await gesture.started;
			await gesture.samples.flush();
			if (!gesture.context.isCurrent()) return;
			await this.api().endStroke();
		}
		async cancel(gesture, _reason) {
			gesture.samples.cancel();
			try {
				await gesture.started;
			} catch {
				return;
			}
			const api = this.api();
			if (api.getSession()) await api.cancel();
		}
		api() {
			var _a;
			return (_a = this.apiValue) !== null && _a !== void 0 ? _a : this.apiValue = this.plugin.resolve();
		}
	};

//#endregion
//#region dist/esm/plugins/canvas-interactions/bindings/text-interaction-binding.js
	const TEXT_TOOL_ID = "annotation:text";
	const TEXT_KIND = "annotation:text";
	function textClassification(overlays, sample) {
		if (!sample.target) return null;
		const classification = overlays.classify(sample.target);
		if (!classification || classification.kind !== TEXT_KIND || classification.hidden || classification.locked) return null;
		return classification;
	}
	var TextInteractionBinding = class {
		constructor(options) {
			var _a, _b, _c;
			Object.defineProperty(this, "id", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: "text"
			});
			Object.defineProperty(this, "toolId", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: TEXT_TOOL_ID
			});
			Object.defineProperty(this, "textBinding", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: void 0
			});
			Object.defineProperty(this, "overlayBinding", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: void 0
			});
			Object.defineProperty(this, "annotationBinding", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: void 0
			});
			Object.defineProperty(this, "textValue", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: null
			});
			Object.defineProperty(this, "overlayValue", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: null
			});
			Object.defineProperty(this, "annotationValue", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: null
			});
			Object.defineProperty(this, "blankClick", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: void 0
			});
			Object.defineProperty(this, "existingTextClick", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: void 0
			});
			Object.defineProperty(this, "retargetEditing", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: void 0
			});
			this.textBinding = options.plugin;
			this.overlayBinding = options.overlays;
			this.annotationBinding = options.annotations;
			this.blankClick = (_a = options.blankClick) !== null && _a !== void 0 ? _a : "create";
			this.existingTextClick = (_b = options.existingTextClick) !== null && _b !== void 0 ? _b : "edit";
			this.retargetEditing = (_c = options.retargetEditing) !== null && _c !== void 0 ? _c : "commit";
			if (this.blankClick !== "create" && this.blankClick !== "ignore") throw new TypeError("[ImageEditor] Text blank-click policy is invalid.");
			if (this.existingTextClick !== "edit" && this.existingTextClick !== "select") throw new TypeError("[ImageEditor] Existing Text click policy is invalid.");
			if (this.retargetEditing !== "commit" && this.retargetEditing !== "cancel") throw new TypeError("[ImageEditor] Text editing retarget policy is invalid.");
		}
		claim(context) {
			const classification = textClassification(this.overlays(), context.sample);
			let target;
			if (classification) target = Object.freeze({
				kind: "text",
				id: classification.persistentId
			});
			else if (!context.sample.target && this.blankClick === "create") target = Object.freeze({ kind: "blank" });
			else return null;
			return Object.freeze({ gesture: Object.freeze({
				context: context.gesture,
				point: context.sample.canvasPoint,
				target
			}) });
		}
		move(_gesture, _sample) {}
		async end(gesture, _sample) {
			if (!gesture.context.isCurrent()) return;
			if (gesture.target.kind === "text") {
				await this.activateExisting(gesture, gesture.target.id);
				return;
			}
			if (!await this.finishCurrentEditing(gesture, null)) return;
			const id = await this.text().create({
				left: gesture.point.x,
				top: gesture.point.y
			});
			if (!gesture.context.isCurrent()) return;
			await this.text().beginEditing(id);
		}
		cancel(_gesture, _reason) {}
		async activateExisting(gesture, id) {
			const current = this.text().getEditingSession();
			if ((current === null || current === void 0 ? void 0 : current.annotationId) === id) return;
			if (!await this.finishCurrentEditing(gesture, id)) return;
			if (this.existingTextClick === "select") {
				await this.annotations().select([id]);
				return;
			}
			await this.text().beginEditing(id);
		}
		async finishCurrentEditing(gesture, nextId) {
			const text = this.text();
			const current = text.getEditingSession();
			if (!current || current.annotationId === nextId) return true;
			if (this.retargetEditing === "commit") await text.commitEditing();
			else await text.cancelEditing();
			return gesture.context.canResume(this.toolId);
		}
		text() {
			var _a;
			return (_a = this.textValue) !== null && _a !== void 0 ? _a : this.textValue = this.textBinding.resolve();
		}
		overlays() {
			var _a;
			return (_a = this.overlayValue) !== null && _a !== void 0 ? _a : this.overlayValue = this.overlayBinding.resolve();
		}
		annotations() {
			var _a;
			return (_a = this.annotationValue) !== null && _a !== void 0 ? _a : this.annotationValue = this.annotationBinding.resolve();
		}
	};

//#endregion
//#region dist/esm/plugins/canvas-interactions/bindings/create-bindings.js
	function createCanvasInteractionBindings(options) {
		const bindings = [];
		if (options.text) bindings.push(new TextInteractionBinding(options.text));
		if (options.shape) bindings.push(new ShapeInteractionBinding(options.shape));
		if (options.draw) bindings.push(new DrawInteractionBinding(options.draw));
		if (options.mosaic) bindings.push(new MosaicInteractionBinding(options.mosaic));
		return Object.freeze(bindings);
	}

//#endregion
//#region dist/esm/plugins/canvas-interactions/index.js
	const canvasInteractionsPluginRef = (0, _bensitu_image_editor_sdk.definePluginRef)("plugin:canvas-interactions", "1.0.0");
	function collectPluginDependencies(options) {
		const bindings = [
			options.text ? options.text.plugin : void 0,
			options.text ? options.text.overlays : void 0,
			options.text ? options.text.annotations : void 0,
			options.shape ? options.shape.plugin : void 0,
			options.draw ? options.draw.plugin : void 0,
			options.mosaic ? options.mosaic.plugin : void 0
		];
		const dependencies = /* @__PURE__ */ new Map();
		for (const binding of bindings) {
			if (!binding) continue;
			if (!binding.ref || typeof binding.resolve !== "function") throw new TypeError("[ImageEditor] Each Canvas interaction requires a PluginRef and API resolver.");
			const existing = dependencies.get(binding.ref.id);
			if (existing && existing !== binding.ref) throw new TypeError(`[ImageEditor] Canvas Interactions received conflicting PluginRef objects for "${binding.ref.id}".`);
			dependencies.set(binding.ref.id, binding.ref);
		}
		return Object.freeze([...dependencies.values()]);
	}
	function canvasInteractionsPlugin(options = {}) {
		const requiresPlugins = collectPluginDependencies(options);
		let controller = null;
		return (0, _bensitu_image_editor_sdk.definePlugin)({
			ref: canvasInteractionsPluginRef,
			manifest: {
				id: canvasInteractionsPluginRef.id,
				version: "1.0.0",
				apiVersion: canvasInteractionsPluginRef.apiVersion,
				engine: "^3.0.0",
				requiresPlugins,
				requires: [
					{
						token: _bensitu_image_editor_sdk.CANVAS_READ_CAPABILITY,
						range: "^1.0.0"
					},
					{
						token: _bensitu_image_editor_sdk.BASE_IMAGE_READ_CAPABILITY,
						range: "^1.0.0"
					},
					{
						token: _bensitu_image_editor_sdk.CORE_DIAGNOSTICS_CAPABILITY,
						range: "^1.0.0"
					}
				],
				permissions: ["fabric:canvas-read", "fabric:global-mutation"]
			},
			setupMode: "sync",
			setup(context) {
				controller = new CanvasInteractionsController(Object.freeze({
					...context.capabilities.require(_bensitu_image_editor_sdk.CANVAS_READ_CAPABILITY),
					...context.capabilities.require(_bensitu_image_editor_sdk.BASE_IMAGE_READ_CAPABILITY),
					...context.capabilities.require(_bensitu_image_editor_sdk.CORE_DIAGNOSTICS_CAPABILITY)
				}), context.tools, options, createCanvasInteractionBindings(options));
				context.disposables.add(controller);
				context.disposables.add(context.events.on("state:loaded", () => controller === null || controller === void 0 ? void 0 : controller.invalidateLifecycle("state-loaded")));
				return controller;
			},
			onInit() {
				controller === null || controller === void 0 || controller.refresh();
			},
			onImageLoaded() {
				controller === null || controller === void 0 || controller.invalidateLifecycle("image-replaced");
				controller === null || controller === void 0 || controller.refresh();
			},
			onImageCleared() {
				controller === null || controller === void 0 || controller.invalidateLifecycle("image-cleared");
			},
			onDispose() {
				controller === null || controller === void 0 || controller.dispose();
				controller = null;
			}
		});
	}

//#endregion
exports.canvasInteractionsPlugin = canvasInteractionsPlugin;
exports.default = canvasInteractionsPlugin;
exports.canvasInteractionsPluginRef = canvasInteractionsPluginRef;
});
//# sourceMappingURL=image-editor.plugin.canvas-interactions.umd.js.map