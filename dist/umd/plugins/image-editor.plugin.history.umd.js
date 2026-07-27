(function(global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ?  factory(exports, require('@bensitu/image-editor/sdk'), require('@bensitu/image-editor/core')) :
  typeof define === 'function' && define.amd ? define(['exports', '@bensitu/image-editor/sdk', '@bensitu/image-editor/core'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory((global.ImageEditorPlugins = global.ImageEditorPlugins || {},global.ImageEditorPlugins.History = global.ImageEditorPlugins.History || {}), global.ImageEditor,global.ImageEditor));
})(this, function(exports, _bensitu_image_editor_sdk, _bensitu_image_editor_core) {
if (Object.prototype.hasOwnProperty.call(exports, "historyPlugin")) return;
Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

//#region dist/esm/plugins/history/history-controller.js
	function resolveMaxSize(value) {
		return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : 50;
	}
	var HistoryPluginController = class {
		constructor(state, operations, options = {}, reportWarning) {
			Object.defineProperty(this, "state", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: state
			});
			Object.defineProperty(this, "operations", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: operations
			});
			Object.defineProperty(this, "reportWarning", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: reportWarning
			});
			Object.defineProperty(this, "records", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: []
			});
			Object.defineProperty(this, "position", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: 0
			});
			Object.defineProperty(this, "baseline", {
				enumerable: true,
				configurable: true,
				writable: true,
				value: null
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
			this.enabled = options.enabled !== false;
			this.maxSize = resolveMaxSize(options.maxSize);
			if (options.onChange) this.listeners.add(options.onChange);
		}
		get isEnabled() {
			return !this.disposed && this.enabled;
		}
		get length() {
			return this.records.length;
		}
		isAvailable() {
			return !this.disposed;
		}
		commit(record) {
			if (!this.isEnabled) return;
			if (record.operationId === "core:load-image" || record.operationId === "core:commit-load-image" || record.operationId === "core:load-state") {
				const changed = this.resetTimeline();
				this.baseline = record.after;
				if (changed) this.emitChange();
				return;
			}
			this.push(record);
		}
		push(record) {
			var _a;
			this.assertActive("push History");
			if (!this.enabled) return;
			if (!record || typeof record.operationId !== "string" || record.operationId.length === 0) throw new _bensitu_image_editor_core.CoreRuntimeError("[ImageEditor] History record operationId is invalid.");
			(_a = this.baseline) !== null && _a !== void 0 || (this.baseline = record.before);
			if (this.position < this.records.length) this.records = this.records.slice(0, this.position);
			this.records.push(Object.freeze({
				operationId: record.operationId,
				before: record.before,
				after: record.after,
				timestamp: record.timestamp,
				detail: record.detail
			}));
			if (this.records.length > this.maxSize) {
				const overflow = this.records.length - this.maxSize;
				this.records.splice(0, overflow);
			}
			this.position = this.records.length;
			this.emitChange();
		}
		enable(options) {
			this.assertActive("enable History");
			if ((options === null || options === void 0 ? void 0 : options.baseline) !== "current") throw new _bensitu_image_editor_core.CoreRuntimeError("[ImageEditor] History can enable only from the current baseline.", { code: "HISTORY_BASELINE_UNSUPPORTED" });
			return this.operations.run("history:enable", async () => {
				if (this.enabled) return;
				const baseline = this.state.captureMemento();
				this.records = [];
				this.position = 0;
				this.baseline = baseline;
				this.enabled = true;
				this.emitChange();
			});
		}
		disable(options = {}) {
			var _a;
			this.assertActive("disable History");
			if (options.clear !== void 0 && typeof options.clear !== "boolean") throw new _bensitu_image_editor_core.CoreRuntimeError("[ImageEditor] History disable clear must be a boolean.", { code: "HISTORY_DISABLE_OPTION_INVALID" });
			const shouldClear = (_a = options.clear) !== null && _a !== void 0 ? _a : true;
			return this.operations.run("history:disable", async () => {
				const wasEnabled = this.enabled;
				const hadRecords = this.records.length > 0 || this.position !== 0;
				this.enabled = false;
				if (shouldClear) this.resetTimeline();
				if (wasEnabled || shouldClear && hadRecords) this.emitChange();
			});
		}
		undo() {
			this.assertActive("undo");
			if (!this.canUndo()) return Promise.resolve();
			return this.operations.run("history:undo", async () => {
				const record = this.records[this.position - 1];
				if (!record) return;
				await this.restoreTransactionally(record.before, "undo");
				this.position -= 1;
				this.emitChange();
			});
		}
		redo() {
			this.assertActive("redo");
			if (!this.canRedo()) return Promise.resolve();
			return this.operations.run("history:redo", async () => {
				const record = this.records[this.position];
				if (!record) return;
				await this.restoreTransactionally(record.after, "redo");
				this.position += 1;
				this.emitChange();
			});
		}
		canUndo() {
			return this.isEnabled && this.position > 0;
		}
		canRedo() {
			return this.isEnabled && this.position < this.records.length;
		}
		clear() {
			if (this.disposed) return;
			if (this.resetTimeline()) this.emitChange();
		}
		onChange(handler) {
			this.assertActive("subscribe to History");
			this.listeners.add(handler);
			return () => {
				this.listeners.delete(handler);
			};
		}
		getState() {
			return Object.freeze({
				isEnabled: this.isEnabled,
				canUndo: this.canUndo(),
				canRedo: this.canRedo(),
				length: this.records.length,
				size: this.records.length,
				position: this.position
			});
		}
		dispose() {
			if (this.disposed) return;
			this.records = [];
			this.position = 0;
			this.baseline = null;
			this.enabled = false;
			this.listeners.clear();
			this.disposed = true;
		}
		resetTimeline() {
			const changed = this.records.length > 0 || this.position !== 0;
			this.records = [];
			this.position = 0;
			this.baseline = null;
			return changed;
		}
		async restoreTransactionally(target, operation) {
			const rollback = this.state.captureMemento();
			try {
				await this.state.restoreMemento(target);
			} catch (error) {
				try {
					await this.state.restoreMemento(rollback);
				} catch (rollbackError) {
					const failure = new _bensitu_image_editor_core.CoreRuntimeError(`[ImageEditor] History ${operation} failed and rollback could not restore state.`, {
						code: "HISTORY_UNRECOVERABLE_ERROR",
						cause: Object.freeze([error, rollbackError]),
						behavior: "fatal-rollback"
					});
					this.state.reportFatal(failure);
					throw failure;
				}
				throw new _bensitu_image_editor_core.CoreRuntimeError(`[ImageEditor] History ${operation} failed.`, {
					code: "HISTORY_RESTORE_ERROR",
					cause: error
				});
			}
		}
		emitChange() {
			const availability = this.getState();
			for (const listener of [...this.listeners]) try {
				listener(availability);
			} catch (error) {
				this.reportWarning(error, "History onChange callback failed.");
			}
		}
		assertActive(operation) {
			if (this.disposed) throw new _bensitu_image_editor_core.CoreRuntimeError(`[ImageEditor] Cannot ${operation} after History disposal.`);
		}
	};

//#endregion
//#region dist/esm/plugins/history/index.js
	const HISTORY_CAPABILITY = (0, _bensitu_image_editor_sdk.createCapabilityToken)("plugin:history", "1.0.0");
	const historyPluginRef = (0, _bensitu_image_editor_sdk.definePluginRef)("plugin:history", "1.0.0");
	function historyPlugin(options = {}) {
		let controller = null;
		return (0, _bensitu_image_editor_sdk.definePlugin)({
			ref: historyPluginRef,
			manifest: {
				id: historyPluginRef.id,
				version: "1.0.0",
				apiVersion: historyPluginRef.apiVersion,
				engine: "^3.0.0",
				requires: [{
					token: _bensitu_image_editor_sdk.CORE_DIAGNOSTICS_CAPABILITY,
					range: "^1.0.0"
				}, {
					token: _bensitu_image_editor_sdk.MEMENTO_HISTORY_CAPABILITY,
					range: "^1.0.0"
				}]
			},
			setupMode: "sync",
			setup(context) {
				const diagnostics = context.capabilities.require(_bensitu_image_editor_sdk.CORE_DIAGNOSTICS_CAPABILITY);
				const state = context.capabilities.require(_bensitu_image_editor_sdk.MEMENTO_HISTORY_CAPABILITY);
				context.operations.register({
					id: "history:undo",
					mode: "mutation",
					conflictDomains: [
						"document",
						"base-image",
						"geometry",
						"raster",
						"overlay",
						"state"
					],
					reentrancy: "queue"
				});
				context.operations.register({
					id: "history:redo",
					mode: "mutation",
					conflictDomains: [
						"document",
						"base-image",
						"geometry",
						"raster",
						"overlay",
						"state"
					],
					reentrancy: "queue"
				});
				for (const operationId of ["history:enable", "history:disable"]) context.operations.register({
					id: operationId,
					mode: "mutation",
					conflictDomains: [
						"document",
						"base-image",
						"geometry",
						"raster",
						"overlay",
						"state"
					],
					reentrancy: "queue"
				});
				controller = new HistoryPluginController(state, { run: (operationId, body) => context.operations.run(operationId, null, () => body()) }, options, (error, message) => diagnostics.reportWarning(error, message));
				context.disposables.add(state.registerHistoryProvider(historyPluginRef.id, {
					isAvailable: () => {
						var _a;
						return (_a = controller === null || controller === void 0 ? void 0 : controller.isEnabled) !== null && _a !== void 0 ? _a : false;
					},
					commit: (record) => controller === null || controller === void 0 ? void 0 : controller.commit(record)
				}));
				context.capabilities.provide(HISTORY_CAPABILITY, controller, { version: HISTORY_CAPABILITY.version });
				return controller;
			},
			onDispose() {
				controller === null || controller === void 0 || controller.dispose();
				controller = null;
			}
		});
	}

//#endregion
exports.HISTORY_CAPABILITY = HISTORY_CAPABILITY;
exports.historyPlugin = historyPlugin;
exports.historyPluginRef = historyPluginRef;
});
//# sourceMappingURL=image-editor.plugin.history.umd.js.map