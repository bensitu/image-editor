(function(global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ?  factory(exports, require('@bensitu/image-editor/sdk')) :
  typeof define === 'function' && define.amd ? define(['exports', '@bensitu/image-editor/sdk'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory((global.ImageEditorPlugins = global.ImageEditorPlugins || {},global.ImageEditorPlugins.CanvasInteractions = global.ImageEditorPlugins.CanvasInteractions || {}), global.ImageEditor));
})(this, function(exports, _bensitu_image_editor_sdk) {
if (Object.prototype.hasOwnProperty.call(exports, "canvasInteractionsPlugin")) return;
Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: 'Module' } });
//#region dist/esm/plugins/canvas-interactions/canvas-interactions-controller.js
	var CanvasInteractionsController = class {
		constructor(host) {
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
			Object.defineProperty(this, "disposed", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: false
			});
		}
		refresh() {
			this.assertActive("refresh Canvas interactions");
		}
		async cancel(_reason = "requested") {
			this.assertActive("cancel Canvas interactions");
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
			this.disposed = true;
			const status = this.status();
			for (const listener of [...this.listeners]) this.invokeListener(listener, status);
			this.listeners.clear();
		}
		status() {
			return Object.freeze({
				isBound: false,
				isDisposed: this.disposed,
				activeBindingId: null,
				gestureActive: false
			});
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
					...context.capabilities.require(_bensitu_image_editor_sdk.CORE_DIAGNOSTICS_CAPABILITY)
				}));
				context.disposables.add(controller);
				return controller;
			},
			onInit() {
				controller === null || controller === void 0 || controller.refresh();
			},
			onImageLoaded() {
				controller === null || controller === void 0 || controller.refresh();
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