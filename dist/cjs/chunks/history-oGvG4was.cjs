const require_core_capabilities = require('./core-capabilities-CWXMFfBX.cjs');
const require_core = require('./core-ByV0wgHe.cjs');
const require_internal_operation_conflict_domains = require('./internal-operation-conflict-domains-H4wymp0y.cjs');
const require_sdk = require('./sdk-gbqAx9cR.cjs');

//#region dist/esm/plugins/history/retained-size-estimator.js
const BOOLEAN_BYTES = 4;
const DATE_BYTES = 8;
const NUMBER_BYTES = 8;
const OBJECT_OVERHEAD_BYTES = 16;
const COLLECTION_ENTRY_OVERHEAD_BYTES = 8;
const PROPERTY_OVERHEAD_BYTES = 8;
function addBytes(total, additional) {
	return total > Number.MAX_SAFE_INTEGER - additional ? Number.MAX_SAFE_INTEGER : total + additional;
}
function utf8ByteLength(value) {
	let bytes = 0;
	for (let index = 0; index < value.length; index += 1) {
		const codeUnit = value.charCodeAt(index);
		if (codeUnit <= 127) bytes += 1;
		else if (codeUnit <= 2047) bytes += 2;
		else if (codeUnit >= 55296 && codeUnit <= 56319 && index + 1 < value.length && value.charCodeAt(index + 1) >= 56320 && value.charCodeAt(index + 1) <= 57343) {
			bytes += 4;
			index += 1;
		} else bytes += 3;
	}
	return bytes;
}
function estimatePropertyKeyBytes(key) {
	var _a;
	return utf8ByteLength(typeof key === "symbol" ? (_a = key.description) !== null && _a !== void 0 ? _a : "" : String(key));
}
function estimateObjectBytes(value, seen) {
	if (seen.has(value)) return 0;
	seen.add(value);
	if (value instanceof ArrayBuffer) return value.byteLength;
	if (ArrayBuffer.isView(value)) return value.byteLength;
	if (value instanceof Date) return DATE_BYTES;
	let bytes = OBJECT_OVERHEAD_BYTES;
	if (value instanceof Map) {
		for (const [key, entryValue] of value) {
			bytes = addBytes(bytes, COLLECTION_ENTRY_OVERHEAD_BYTES);
			bytes = addBytes(bytes, estimateValueBytes(key, seen));
			bytes = addBytes(bytes, estimateValueBytes(entryValue, seen));
		}
		return bytes;
	}
	if (value instanceof Set) {
		for (const entryValue of value) {
			bytes = addBytes(bytes, COLLECTION_ENTRY_OVERHEAD_BYTES);
			bytes = addBytes(bytes, estimateValueBytes(entryValue, seen));
		}
		return bytes;
	}
	for (const key of Reflect.ownKeys(value)) {
		const descriptor = Object.getOwnPropertyDescriptor(value, key);
		if (!descriptor || !("value" in descriptor)) continue;
		bytes = addBytes(bytes, PROPERTY_OVERHEAD_BYTES);
		bytes = addBytes(bytes, estimatePropertyKeyBytes(key));
		bytes = addBytes(bytes, estimateValueBytes(descriptor.value, seen));
	}
	return bytes;
}
function estimateValueBytes(value, seen) {
	var _a;
	switch (typeof value) {
		case "undefined": return 0;
		case "boolean": return BOOLEAN_BYTES;
		case "number": return NUMBER_BYTES;
		case "bigint": return utf8ByteLength(value.toString());
		case "string": return utf8ByteLength(value);
		case "symbol": return utf8ByteLength((_a = value.description) !== null && _a !== void 0 ? _a : "");
		case "function": return estimateObjectBytes(value, seen);
		case "object": return value === null ? 0 : estimateObjectBytes(value, seen);
	}
}
function estimateRetainedBytes(value) {
	return estimateValueBytes(value, /* @__PURE__ */ new WeakSet());
}

//#endregion
//#region dist/esm/plugins/history/history-controller.js
const DEFAULT_MAX_HISTORY_BYTES = 128 * 1024 * 1024;
function resolveMaxSize(value) {
	return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : 50;
}
function resolveMaxBytes(value) {
	if (value === void 0) return DEFAULT_MAX_HISTORY_BYTES;
	if (!Number.isSafeInteger(value) || value <= 0) throw new require_core.CoreRuntimeError("[ImageEditor] History maxBytes must be a positive safe integer.", { code: "HISTORY_MAX_BYTES_INVALID" });
	return value;
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
		Object.defineProperty(this, "retainedBytes", {
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
		this.maxBytes = resolveMaxBytes(options.maxBytes);
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
		if (!record || typeof record.operationId !== "string" || record.operationId.length === 0) throw new require_core.CoreRuntimeError("[ImageEditor] History record operationId is invalid.");
		const retainedRecord = Object.freeze({
			operationId: record.operationId,
			before: record.before,
			after: record.after,
			timestamp: record.timestamp,
			detail: record.detail
		});
		const bytes = estimateRetainedBytes(retainedRecord);
		if (bytes > this.maxBytes) {
			const changed = this.resetTimeline();
			this.baseline = record.after;
			const warning = new require_core.CoreRuntimeError(`[ImageEditor] History record "${record.operationId}" exceeds maxBytes and was not retained.`, { code: "HISTORY_RECORD_BYTE_LIMIT_EXCEEDED" });
			this.reportWarning(warning, `History record "${record.operationId}" requires ${bytes} bytes, exceeding the ${this.maxBytes}-byte limit.`);
			if (changed) this.emitChange();
			return;
		}
		(_a = this.baseline) !== null && _a !== void 0 || (this.baseline = record.before);
		this.removeEntries(this.position, this.records.length - this.position);
		this.records.push(Object.freeze({
			record: retainedRecord,
			bytes
		}));
		this.retainedBytes += bytes;
		this.evictOverflow();
		this.position = this.records.length;
		this.emitChange();
	}
	enable(options) {
		this.assertActive("enable History");
		if ((options === null || options === void 0 ? void 0 : options.baseline) !== "current") throw new require_core.CoreRuntimeError("[ImageEditor] History can enable only from the current baseline.", { code: "HISTORY_BASELINE_UNSUPPORTED" });
		return this.operations.run("history:enable", async () => {
			if (this.enabled) return;
			const baseline = this.state.captureMemento();
			this.records = [];
			this.position = 0;
			this.retainedBytes = 0;
			this.baseline = baseline;
			this.enabled = true;
			this.emitChange();
		});
	}
	disable(options = {}) {
		var _a;
		this.assertActive("disable History");
		if (options.clear !== void 0 && typeof options.clear !== "boolean") throw new require_core.CoreRuntimeError("[ImageEditor] History disable clear must be a boolean.", { code: "HISTORY_DISABLE_OPTION_INVALID" });
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
			const entry = this.records[this.position - 1];
			if (!entry) return;
			await this.restoreTransactionally(entry.record.before, "undo");
			this.position -= 1;
			this.emitChange();
		});
	}
	redo() {
		this.assertActive("redo");
		if (!this.canRedo()) return Promise.resolve();
		return this.operations.run("history:redo", async () => {
			const entry = this.records[this.position];
			if (!entry) return;
			await this.restoreTransactionally(entry.record.after, "redo");
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
			position: this.position,
			bytes: this.retainedBytes,
			maxBytes: this.maxBytes
		});
	}
	dispose() {
		if (this.disposed) return;
		this.records = [];
		this.position = 0;
		this.retainedBytes = 0;
		this.baseline = null;
		this.enabled = false;
		this.listeners.clear();
		this.disposed = true;
	}
	resetTimeline() {
		const changed = this.records.length > 0 || this.position !== 0 || this.retainedBytes !== 0;
		this.records = [];
		this.position = 0;
		this.retainedBytes = 0;
		this.baseline = null;
		return changed;
	}
	removeEntries(start, deleteCount) {
		if (deleteCount <= 0) return;
		const removed = this.records.splice(start, deleteCount);
		for (const entry of removed) this.retainedBytes -= entry.bytes;
	}
	evictOverflow() {
		while (this.records.length > this.maxSize || this.retainedBytes > this.maxBytes) this.removeEntries(0, 1);
	}
	async restoreTransactionally(target, operation) {
		const rollback = this.state.captureMemento();
		try {
			await this.state.restoreMemento(target);
		} catch (error) {
			try {
				await this.state.restoreMemento(rollback);
			} catch (rollbackError) {
				const failure = new require_core.CoreRuntimeError(`[ImageEditor] History ${operation} failed and rollback could not restore state.`, {
					code: "HISTORY_UNRECOVERABLE_ERROR",
					cause: Object.freeze([error, rollbackError]),
					behavior: "fatal-rollback"
				});
				this.state.reportFatal(failure);
				throw failure;
			}
			throw new require_core.CoreRuntimeError(`[ImageEditor] History ${operation} failed.`, {
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
		if (this.disposed) throw new require_core.CoreRuntimeError(`[ImageEditor] Cannot ${operation} after History disposal.`);
	}
};

//#endregion
//#region dist/esm/plugins/history/index.js
const HISTORY_CAPABILITY = require_core_capabilities.createCapabilityToken("plugin:history", "1.0.0");
const historyPluginRef = require_core_capabilities.definePluginRef("plugin:history", "1.0.0");
function historyPlugin(options = {}) {
	let controller = null;
	return require_sdk.definePlugin({
		ref: historyPluginRef,
		manifest: {
			id: historyPluginRef.id,
			version: "1.0.0",
			apiVersion: historyPluginRef.apiVersion,
			engine: "^3.0.0",
			requires: [{
				token: require_core_capabilities.CORE_DIAGNOSTICS_CAPABILITY,
				range: "^1.0.0"
			}, {
				token: require_core_capabilities.MEMENTO_HISTORY_CAPABILITY,
				range: "^1.0.0"
			}]
		},
		setupMode: "sync",
		setup(context) {
			const diagnostics = context.capabilities.require(require_core_capabilities.CORE_DIAGNOSTICS_CAPABILITY);
			const state = context.capabilities.require(require_core_capabilities.MEMENTO_HISTORY_CAPABILITY);
			context.operations.register({
				id: "history:undo",
				mode: "mutation",
				conflictDomains: require_internal_operation_conflict_domains.DOCUMENT_WIDE_MUTATION_CONFLICT_DOMAINS,
				reentrancy: "queue"
			});
			context.operations.register({
				id: "history:redo",
				mode: "mutation",
				conflictDomains: require_internal_operation_conflict_domains.DOCUMENT_WIDE_MUTATION_CONFLICT_DOMAINS,
				reentrancy: "queue"
			});
			for (const operationId of ["history:enable", "history:disable"]) context.operations.register({
				id: operationId,
				mode: "mutation",
				conflictDomains: require_internal_operation_conflict_domains.DOCUMENT_WIDE_MUTATION_CONFLICT_DOMAINS,
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
Object.defineProperty(exports, 'HISTORY_CAPABILITY', {
  enumerable: true,
  get: function () {
    return HISTORY_CAPABILITY;
  }
});
Object.defineProperty(exports, 'historyPlugin', {
  enumerable: true,
  get: function () {
    return historyPlugin;
  }
});
Object.defineProperty(exports, 'historyPluginRef', {
  enumerable: true,
  get: function () {
    return historyPluginRef;
  }
});
//# sourceMappingURL=history-oGvG4was.cjs.map