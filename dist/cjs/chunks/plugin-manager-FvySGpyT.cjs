const require_plugin_identifier = require('./plugin-identifier-gLkfk0AM.cjs');
const require_core_capabilities = require('./core-capabilities-CWXMFfBX.cjs');

//#region dist/esm/plugin-kernel/capability-registry.js
function validateProvider(token, implementation, providerPluginId, providerVersion, requiredPermission) {
	var _a, _b;
	if (!require_core_capabilities.isCapabilityToken(token) || !require_core_capabilities.isValidSemVer(token.version)) throw new require_plugin_identifier.InvalidCapabilityVersionError((_a = token === null || token === void 0 ? void 0 : token.id) !== null && _a !== void 0 ? _a : "unknown", (_b = token === null || token === void 0 ? void 0 : token.version) !== null && _b !== void 0 ? _b : "", "version");
	if (!require_plugin_identifier.isRuntimeIdentifier(providerPluginId)) throw new require_plugin_identifier.InvalidPluginDefinitionError(`Invalid Capability provider Runtime ID for "${token.id}".`, providerPluginId);
	if (!require_core_capabilities.isValidSemVer(providerVersion)) throw new require_plugin_identifier.InvalidCapabilityVersionError(token.id, providerVersion, "version");
	if (providerVersion !== token.version) throw new require_plugin_identifier.CapabilityVersionError({
		capabilityId: token.id,
		expectedRange: token.version,
		actualVersion: providerVersion,
		providerPluginId
	});
	if (requiredPermission !== void 0 && !require_core_capabilities.isPluginPermission(requiredPermission)) throw new require_plugin_identifier.InvalidPluginDefinitionError(`Capability "${token.id}" requires an unsupported Plugin permission.`, providerPluginId);
	if (implementation === null || implementation === void 0) throw new require_plugin_identifier.PluginCapabilityError({
		consumerPluginId: providerPluginId,
		capabilityId: token.id,
		requestedRange: token.version,
		installedVersion: token.version,
		providerPluginId,
		reason: "incomplete"
	});
}
var CapabilityRegistry = class {
	constructor(options = {}) {
		Object.defineProperty(this, "options", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: options
		});
		Object.defineProperty(this, "providers", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: /* @__PURE__ */ new Map()
		});
		Object.defineProperty(this, "disposed", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: false
		});
	}
	provide(token, implementation, providerPluginId, requiredPermission) {
		const registration = this.providePending(token, implementation, providerPluginId, Symbol(`capability:${token.id}`), token.version, requiredPermission);
		registration.commit();
		return registration;
	}
	provideHost(token, implementation, providerPluginId = "core:host", requiredPermission) {
		if (!require_core_capabilities.isCapabilityToken(token)) throw new require_plugin_identifier.InvalidPluginDefinitionError("Host capability must use createCapabilityToken().");
		return this.provide(token, implementation, providerPluginId, requiredPermission);
	}
	providePending(token, implementation, providerPluginId, transactionId, providerVersion = token.version, requiredPermission) {
		this.assertActive("provide a capability");
		validateProvider(token, implementation, providerPluginId, providerVersion, requiredPermission);
		const existing = this.providers.get(token.id);
		if (existing) {
			if (existing.providerPluginId === providerPluginId && existing.transactionId === transactionId && existing.version === providerVersion && existing.requiredPermission === requiredPermission && Object.is(existing.implementation, implementation)) {
				const noop = require_core_capabilities.createNoopDisposable();
				return {
					commit: () => {
						existing.complete = true;
					},
					dispose: () => noop.dispose()
				};
			}
			throw new require_plugin_identifier.CapabilityConflictError(token.id, existing.providerPluginId, providerPluginId);
		}
		const record = {
			token,
			version: providerVersion,
			requiredPermission,
			implementation,
			providerPluginId,
			transactionId,
			complete: false
		};
		this.providers.set(token.id, record);
		const disposable = require_core_capabilities.createDisposable(() => {
			if (this.providers.get(token.id) === record) this.providers.delete(token.id);
		});
		return {
			commit: () => {
				if (this.providers.get(token.id) === record) record.complete = true;
			},
			dispose: () => disposable.dispose()
		};
	}
	require(requirement, consumerPluginId) {
		return this.resolve(requirement, consumerPluginId, false);
	}
	optional(requirement, consumerPluginId) {
		return this.resolve(requirement, consumerPluginId, true);
	}
	requireDefinition(requirement, consumerPluginId, visibleTransactions) {
		return this.resolve(requirement, consumerPluginId, false, visibleTransactions);
	}
	optionalDefinition(requirement, consumerPluginId, visibleTransactions) {
		return this.resolve(requirement, consumerPluginId, true, visibleTransactions);
	}
	getProviderInfo(tokenOrId) {
		this.assertActive("inspect a capability provider");
		const id = typeof tokenOrId === "string" ? tokenOrId : tokenOrId.id;
		if (!require_plugin_identifier.isRuntimeIdentifier(id)) throw new require_plugin_identifier.InvalidPluginDefinitionError("Invalid Capability Runtime ID.");
		const record = this.providers.get(id);
		if (!record) return null;
		return Object.freeze({
			capabilityId: record.token.id,
			version: record.version,
			providerPluginId: record.providerPluginId,
			requiredPermission: record.requiredPermission,
			complete: record.complete
		});
	}
	has(tokenOrId) {
		return this.getProviderInfo(tokenOrId) !== null;
	}
	getRequiredPermission(capabilityId, visibleTransactions) {
		this.assertActive("inspect a Capability permission");
		if (!require_plugin_identifier.isRuntimeIdentifier(capabilityId)) throw new require_plugin_identifier.InvalidPluginDefinitionError("Invalid Capability Runtime ID.");
		const record = this.providers.get(capabilityId);
		if (!record) return void 0;
		if (!record.complete && !(visibleTransactions === null || visibleTransactions === void 0 ? void 0 : visibleTransactions.has(record.transactionId))) return void 0;
		return record.requiredPermission;
	}
	dispose() {
		if (this.disposed) return;
		this.providers.clear();
		this.disposed = true;
	}
	resolve(requirement, consumerPluginId, optional, visibleTransactions) {
		var _a, _b, _c;
		this.assertActive("resolve a capability");
		if (!require_plugin_identifier.isRuntimeIdentifier(consumerPluginId)) throw new require_plugin_identifier.InvalidPluginDefinitionError("Invalid Capability consumer Runtime ID.", consumerPluginId);
		try {
			require_core_capabilities.assertCapabilityRequirement(requirement);
		} catch (error) {
			throw new require_plugin_identifier.PluginCapabilityError({
				consumerPluginId,
				capabilityId: (_b = (_a = requirement === null || requirement === void 0 ? void 0 : requirement.token) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : "unknown",
				requestedRange: (_c = requirement === null || requirement === void 0 ? void 0 : requirement.range) !== null && _c !== void 0 ? _c : "",
				reason: "invalid-range",
				cause: error
			});
		}
		const record = this.providers.get(requirement.token.id);
		if (!record) {
			if (optional) return null;
			throw new require_plugin_identifier.CapabilityMissingError({
				consumerPluginId,
				capabilityId: requirement.token.id,
				requestedRange: requirement.range,
				availableProviders: this.describeProviders()
			});
		}
		if (!record.complete && !(visibleTransactions === null || visibleTransactions === void 0 ? void 0 : visibleTransactions.has(record.transactionId))) {
			if (optional) return null;
			throw new require_plugin_identifier.PluginCapabilityError({
				consumerPluginId,
				capabilityId: requirement.token.id,
				requestedRange: requirement.range,
				installedVersion: record.version,
				providerPluginId: record.providerPluginId,
				reason: "incomplete"
			});
		}
		if (!require_core_capabilities.satisfiesSemVer(record.version, requirement.range)) {
			if (!optional) throw new require_plugin_identifier.CapabilityVersionError({
				capabilityId: requirement.token.id,
				expectedRange: requirement.range,
				actualVersion: record.version,
				providerPluginId: record.providerPluginId,
				consumerPluginId
			});
			require_core_capabilities.reportWarningSafely(this.options.warningSink, this.options.errorSink, {
				code: "OPTIONAL_CAPABILITY_INCOMPATIBLE",
				message: `Optional integration "${requirement.token.id}" was disabled for plugin "${consumerPluginId}" because installed version "${record.version}" does not satisfy "${requirement.range}".`,
				pluginId: consumerPluginId,
				details: {
					capabilityId: requirement.token.id,
					requestedRange: requirement.range,
					installedVersion: record.version,
					providerPluginId: record.providerPluginId,
					optionalIntegrationDisabled: true
				}
			});
			return null;
		}
		return record.implementation;
	}
	describeProviders() {
		return Object.freeze([...this.providers.values()].filter((record) => record.complete).map((record) => `${record.token.id}@${record.version} (${record.providerPluginId})`).sort());
	}
	assertActive(operation) {
		if (this.disposed) throw new require_plugin_identifier.PluginKernelDisposedError(operation);
	}
};

//#endregion
//#region dist/esm/plugin-kernel/committed-event-bus.js
const DEFAULT_COMMITTED_EVENT_LISTENER_TIMEOUT_MS = 5e3;
const DISPOSED_LISTENER_OUTCOME = Symbol("disposed-listener-outcome");
const eventBusDisposalStates = /* @__PURE__ */ new WeakMap();
function getDisposalState(owner) {
	const state = eventBusDisposalStates.get(owner);
	if (!state) throw new Error("Committed event bus disposal state is unavailable.");
	return state;
}
var CommittedEventBus = class {
	constructor(options = {}) {
		var _a;
		Object.defineProperty(this, "options", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: options
		});
		Object.defineProperty(this, "listeners", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: /* @__PURE__ */ new Map()
		});
		Object.defineProperty(this, "emissionTails", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: /* @__PURE__ */ new Map()
		});
		Object.defineProperty(this, "listenerTimeoutMs", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "disposed", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: false
		});
		const timeout = (_a = options.listenerTimeoutMs) !== null && _a !== void 0 ? _a : DEFAULT_COMMITTED_EVENT_LISTENER_TIMEOUT_MS;
		if (!Number.isSafeInteger(timeout) || timeout <= 0) throw new require_plugin_identifier.InvalidPluginDefinitionError("Committed event listener timeout must be a positive safe integer.");
		this.listenerTimeoutMs = timeout;
		eventBusDisposalStates.set(this, {
			controller: new AbortController(),
			activeTimeouts: /* @__PURE__ */ new Set()
		});
	}
	on(eventName, listener) {
		this.assertActive("register a committed event listener");
		this.assertEventName(eventName);
		let eventListeners = this.listeners.get(eventName);
		if (!eventListeners) {
			eventListeners = [];
			this.listeners.set(eventName, eventListeners);
		}
		const erasedListener = listener;
		eventListeners.push(erasedListener);
		return require_core_capabilities.createDisposable(() => {
			const current = this.listeners.get(eventName);
			if (!current) return;
			const index = current.indexOf(erasedListener);
			if (index >= 0) current.splice(index, 1);
			if (current.length === 0) this.listeners.delete(eventName);
		});
	}
	async emitCommitted(eventName, payload) {
		var _a;
		this.assertActive("emit a committed event");
		this.assertEventName(eventName);
		const emission = ((_a = this.emissionTails.get(eventName)) !== null && _a !== void 0 ? _a : Promise.resolve()).then(() => this.dispatch(eventName, payload));
		this.emissionTails.set(eventName, emission);
		try {
			await emission;
		} finally {
			if (this.emissionTails.get(eventName) === emission) this.emissionTails.delete(eventName);
		}
	}
	async dispatch(eventName, payload) {
		var _a;
		if (this.disposed) return;
		const snapshot = [...(_a = this.listeners.get(eventName)) !== null && _a !== void 0 ? _a : []];
		for (let index = 0; index < snapshot.length; index += 1) {
			if (this.disposed) return;
			const listener = snapshot[index];
			if (listener) await this.invokeListener(eventName, index, listener, payload);
		}
	}
	async invokeListener(eventName, listenerIndex, listener, payload) {
		const disposalState = getDisposalState(this);
		const settlement = Promise.resolve().then(() => listener(payload)).then(() => Object.freeze({ status: "fulfilled" }), (error) => Object.freeze({
			status: "rejected",
			error
		}));
		let timeoutHandle;
		const timeout = new Promise((resolve) => {
			timeoutHandle = setTimeout(() => {
				if (timeoutHandle !== void 0) disposalState.activeTimeouts.delete(timeoutHandle);
				resolve(null);
			}, this.listenerTimeoutMs);
			disposalState.activeTimeouts.add(timeoutHandle);
		});
		const disposalSignal = disposalState.controller.signal;
		let removeDisposalListener = () => void 0;
		const disposal = new Promise((resolve) => {
			const abort = () => {
				if (timeoutHandle !== void 0) {
					clearTimeout(timeoutHandle);
					disposalState.activeTimeouts.delete(timeoutHandle);
				}
				resolve(DISPOSED_LISTENER_OUTCOME);
			};
			removeDisposalListener = () => disposalSignal.removeEventListener("abort", abort);
			disposalSignal.addEventListener("abort", abort, { once: true });
			if (disposalSignal.aborted) abort();
		});
		let outcome;
		try {
			outcome = await Promise.race([
				settlement,
				timeout,
				disposal
			]);
		} finally {
			removeDisposalListener();
			if (timeoutHandle !== void 0) {
				clearTimeout(timeoutHandle);
				disposalState.activeTimeouts.delete(timeoutHandle);
			}
		}
		if (outcome === DISPOSED_LISTENER_OUTCOME) return;
		if (outcome === null) {
			require_core_capabilities.reportWarningSafely(this.options.warningSink, this.options.errorSink, {
				code: "COMMITTED_EVENT_LISTENER_TIMEOUT",
				message: `Committed event listener ${listenerIndex} for "${eventName}" exceeded ${this.listenerTimeoutMs} ms; remaining listeners continued.`,
				details: {
					eventName,
					listenerIndex,
					timeoutMs: this.listenerTimeoutMs
				}
			});
			require_core_capabilities.observePromise(settlement.then((lateOutcome) => {
				if (this.disposed || lateOutcome.status !== "rejected") return;
				require_core_capabilities.reportWarningSafely(this.options.warningSink, this.options.errorSink, {
					code: "COMMITTED_EVENT_LISTENER_LATE_FAILURE",
					message: `Timed-out committed event listener ${listenerIndex} for "${eventName}" later rejected.`,
					cause: lateOutcome.error,
					details: {
						eventName,
						listenerIndex,
						timeoutMs: this.listenerTimeoutMs
					}
				});
			}), (error) => {
				if (this.disposed) return;
				require_core_capabilities.reportWarningSafely(this.options.warningSink, this.options.errorSink, {
					code: "COMMITTED_EVENT_LATE_OBSERVER_FAILURE",
					message: `Late listener observation for "${eventName}" failed.`,
					cause: error
				});
			});
			return;
		}
		if (outcome.status === "rejected") require_core_capabilities.reportWarningSafely(this.options.warningSink, this.options.errorSink, {
			code: "COMMITTED_EVENT_LISTENER_FAILED",
			message: `Committed event listener ${listenerIndex} for "${eventName}" failed; remaining listeners continued.`,
			cause: outcome.error,
			details: {
				eventName,
				listenerIndex
			}
		});
	}
	listenerCount(eventName) {
		var _a, _b;
		this.assertActive("inspect committed event listeners");
		if (eventName) {
			this.assertEventName(eventName);
			return (_b = (_a = this.listeners.get(eventName)) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0;
		}
		let count = 0;
		for (const listeners of this.listeners.values()) count += listeners.length;
		return count;
	}
	dispose() {
		if (this.disposed) return;
		this.disposed = true;
		this.listeners.clear();
		this.emissionTails.clear();
		const disposalState = getDisposalState(this);
		for (const timeout of disposalState.activeTimeouts) clearTimeout(timeout);
		disposalState.activeTimeouts.clear();
		disposalState.controller.abort();
	}
	assertActive(operation) {
		if (this.disposed) throw new require_plugin_identifier.PluginKernelDisposedError(operation);
	}
	assertEventName(eventName) {
		if (!require_plugin_identifier.isRuntimeIdentifier(eventName)) throw new require_plugin_identifier.InvalidPluginDefinitionError("Invalid committed event Runtime ID.");
	}
};

//#endregion
//#region dist/esm/plugin-kernel/operation-registry.js
const OPERATION_MODES = [
	"read",
	"busy",
	"animation",
	"mutation"
];
const REENTRANCY_POLICIES = [
	"reject",
	"queue",
	"replace",
	"coalesce"
];
const CONFLICT_DOMAINS = [
	"document",
	"base-image",
	"geometry",
	"raster",
	"overlay",
	"selection",
	"tool",
	"export",
	"state",
	"image-decode"
];
function abortError(message) {
	return new DOMException(message, "AbortError");
}
function abortReason(signal, fallback) {
	var _a;
	return (_a = signal.reason) !== null && _a !== void 0 ? _a : abortError(fallback);
}
function domainsOverlap(first, second) {
	return first.some((domain) => second.includes(domain));
}
function definitionsConflict(first, second) {
	if (first.mode === "read" && second.mode === "read") return false;
	return domainsOverlap(first.conflictDomains, second.conflictDomains);
}
var OperationRegistry = class {
	constructor() {
		Object.defineProperty(this, "operations", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: /* @__PURE__ */ new Map()
		});
		Object.defineProperty(this, "activeOperations", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: /* @__PURE__ */ new Set()
		});
		Object.defineProperty(this, "executingRequests", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: /* @__PURE__ */ new Set()
		});
		Object.defineProperty(this, "idleWaiters", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: /* @__PURE__ */ new Set()
		});
		Object.defineProperty(this, "pendingRequests", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: []
		});
		Object.defineProperty(this, "suspendedReason", {
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
	}
	register(definition, ownerPluginId) {
		this.assertActive("register an operation");
		this.validateDefinition(definition, ownerPluginId);
		const existing = this.operations.get(definition.id);
		if (existing) throw new require_plugin_identifier.OperationRegistrationError(`Operation "${definition.id}" is already registered by "${existing.ownerPluginId}".`, ownerPluginId);
		const record = {
			definition: Object.freeze({
				...definition,
				conflictDomains: Object.freeze([...definition.conflictDomains]),
				allowedDuringTool: definition.allowedDuringTool ? Object.freeze([...definition.allowedDuringTool]) : void 0
			}),
			ownerPluginId
		};
		this.operations.set(definition.id, record);
		return require_core_capabilities.createDisposable(() => {
			if (this.operations.get(definition.id) !== record) return;
			const reason = abortError(`Operation "${definition.id}" was unregistered.`);
			for (const active of [...this.activeOperations]) if (active.record === record) this.retireActive(active, reason);
			this.rejectPending((request) => request.record === record, reason);
			this.operations.delete(definition.id);
			this.drainPending();
		});
	}
	begin(operationId, ownerPluginId) {
		this.assertActive("begin an operation");
		if (this.suspendedReason !== null) throw this.suspendedReason;
		const record = this.requireOwned(operationId, ownerPluginId);
		const conflicts = this.findConflicts(record, void 0);
		if (conflicts.length > 0) throw this.conflictError(record, conflicts[0].record, ownerPluginId);
		const active = this.createActive(record, void 0, null);
		this.activeOperations.add(active);
		return active.token;
	}
	run(operationId, ownerPluginId, args, task, options = {}) {
		var _a;
		this.assertActive("run an operation");
		if (this.suspendedReason !== null) return Promise.reject(this.suspendedReason);
		const record = this.requireOwned(operationId, ownerPluginId);
		this.validateParent(options.parent);
		if ((_a = options.signal) === null || _a === void 0 ? void 0 : _a.aborted) return Promise.reject(abortReason(options.signal, `Operation "${operationId}" was aborted.`));
		const existingPending = this.findCoalesciblePending(record, options.parent);
		if (record.definition.reentrancy === "coalesce" && existingPending) {
			const coalesce = record.definition.coalesce;
			if (!coalesce) return Promise.reject(new require_plugin_identifier.OperationRegistrationError(`Operation "${operationId}" has no coalesce function.`, ownerPluginId));
			existingPending.args = coalesce(existingPending.args, args);
			return this.addWaiter(existingPending, options.signal);
		}
		const request = {
			record,
			args,
			task,
			options,
			waiters: [],
			active: null,
			state: "pending",
			removeExternalAbortListener: null
		};
		const result = this.addWaiter(request, options.signal);
		this.attachExternalAbort(request);
		this.schedule(request);
		return result;
	}
	beginForHost(operationId) {
		this.assertActive("begin an operation");
		const registered = this.requireRegistered(operationId, "core:host");
		return this.begin(operationId, registered.ownerPluginId);
	}
	runForHost(operationId, args, task, options = {}) {
		const registered = this.requireRegistered(operationId, "core:host");
		return this.run(operationId, registered.ownerPluginId, args, task, options);
	}
	has(operationId) {
		this.assertActive("inspect an operation");
		return this.operations.has(operationId);
	}
	get(operationId) {
		var _a, _b;
		this.assertActive("inspect an operation");
		return (_b = (_a = this.operations.get(operationId)) === null || _a === void 0 ? void 0 : _a.definition) !== null && _b !== void 0 ? _b : null;
	}
	isActive(operationId) {
		this.assertActive("inspect operation state");
		if (!operationId) return this.activeOperations.size > 0;
		return [...this.activeOperations].some((active) => active.record.definition.id === operationId);
	}
	waitForIdle() {
		if (this.isIdle()) return Promise.resolve();
		return new Promise((resolve) => this.idleWaiters.add(resolve));
	}
	hasInFlightOperations() {
		return !this.isIdle();
	}
	async abortAll(reason = abortError("All Plugin Kernel operations were aborted.")) {
		this.assertActive("abort operations");
		this.rejectPending(() => true, reason);
		for (const active of [...this.activeOperations]) if (active.request) this.abortActive(active, reason);
		else this.retireActive(active, reason);
		await Promise.allSettled([...this.executingRequests]);
		this.resolveIdleWaiters();
	}
	suspend(reason) {
		this.assertActive("suspend operations");
		this.suspendedReason = reason;
		return this.abortAll(reason);
	}
	dispose() {
		if (this.disposed) return;
		const reason = abortError("Operation Registry was disposed.");
		this.rejectPending(() => true, reason);
		for (const active of [...this.activeOperations]) this.retireActive(active, reason);
		this.operations.clear();
		this.suspendedReason = null;
		this.disposed = true;
		this.resolveIdleWaiters();
	}
	schedule(request) {
		var _a, _b;
		if (request.state !== "pending") return;
		const conflicts = this.findConflicts(request.record, request.options.parent);
		const sameOperationActive = conflicts.filter((active) => active.record.definition.id === request.record.definition.id);
		const policy = request.record.definition.reentrancy;
		if (policy === "replace" && sameOperationActive.length > 0) {
			const reason = abortError(`Operation "${request.record.definition.id}" was replaced by a newer request.`);
			for (const active of sameOperationActive) this.retireActive(active, reason);
			this.rejectPending((pending) => pending.record === request.record, reason);
		} else if (conflicts.length > 0 && policy === "reject") {
			this.rejectRequest(request, this.conflictError(request.record, conflicts[0].record, request.record.ownerPluginId));
			(_a = request.removeExternalAbortListener) === null || _a === void 0 || _a.call(request);
			request.removeExternalAbortListener = null;
			request.state = "settled";
			this.resolveIdleWaiters();
			return;
		} else if (conflicts.length > 0 && policy === "replace") {
			this.rejectRequest(request, this.conflictError(request.record, conflicts[0].record, request.record.ownerPluginId));
			(_b = request.removeExternalAbortListener) === null || _b === void 0 || _b.call(request);
			request.removeExternalAbortListener = null;
			request.state = "settled";
			this.resolveIdleWaiters();
			return;
		}
		if (this.findConflicts(request.record, request.options.parent).length === 0) this.startRequest(request);
		else this.pendingRequests.push(request);
	}
	startRequest(request) {
		if (request.state !== "pending") return;
		const active = this.createActive(request.record, request.options.parent, request);
		request.active = active;
		request.state = "active";
		this.activeOperations.add(active);
		const context = Object.freeze({
			signal: active.controller.signal,
			token: active.token,
			topLevel: active.token.topLevel,
			ownsHistory: active.token.ownsHistory
		});
		let output;
		try {
			output = request.task(request.args, context);
		} catch (error) {
			output = Promise.reject(error);
		}
		const tracked = Promise.resolve(output).then((value) => ({
			status: "fulfilled",
			value
		}), (error) => ({
			status: "rejected",
			error
		})).then((outcome) => {
			this.finishRequest(request);
			if (outcome.status === "rejected") this.rejectRequest(request, outcome.error);
			else if (active.controller.signal.aborted) this.rejectRequest(request, abortReason(active.controller.signal, `Operation "${active.token.id}" was aborted.`));
			else this.resolveRequest(request, outcome.value);
		}).finally(() => {
			this.executingRequests.delete(tracked);
			this.resolveIdleWaiters();
		});
		this.executingRequests.add(tracked);
		tracked.catch(() => void 0);
	}
	finishRequest(request) {
		var _a;
		const active = request.active;
		if (active) {
			this.activeOperations.delete(active);
			active.deactivate();
		}
		(_a = request.removeExternalAbortListener) === null || _a === void 0 || _a.call(request);
		request.removeExternalAbortListener = null;
		request.state = "settled";
		this.drainPending();
		this.resolveIdleWaiters();
	}
	drainPending() {
		if (this.disposed) return;
		let started = true;
		while (started) {
			started = false;
			for (let index = 0; index < this.pendingRequests.length; index += 1) {
				const request = this.pendingRequests[index];
				if (this.findConflicts(request.record, request.options.parent).length > 0) continue;
				this.pendingRequests.splice(index, 1);
				this.startRequest(request);
				started = true;
				break;
			}
		}
	}
	createActive(record, parent, request) {
		var _a;
		const controller = new AbortController();
		let active = true;
		const activeReference = { current: null };
		const entry = {
			record,
			controller,
			token: Object.freeze({
				id: record.definition.id,
				ownerPluginId: record.ownerPluginId,
				parentId: (_a = parent === null || parent === void 0 ? void 0 : parent.id) !== null && _a !== void 0 ? _a : null,
				topLevel: parent === void 0,
				ownsHistory: parent === void 0,
				signal: controller.signal,
				get active() {
					return active;
				},
				dispose: () => {
					const entry = activeReference.current;
					if (!active || !entry) return;
					this.retireActive(entry, abortError(`Operation "${record.definition.id}" was cancelled.`));
					this.drainPending();
					this.resolveIdleWaiters();
				}
			}),
			deactivate: () => {
				active = false;
			},
			request
		};
		activeReference.current = entry;
		return entry;
	}
	retireActive(active, reason) {
		if (!active.token.active) return;
		this.activeOperations.delete(active);
		active.deactivate();
		active.controller.abort(reason);
		if (active.request && active.request.state === "active") active.request.state = "retired";
	}
	abortActive(active, reason) {
		if (!active.token.active || active.controller.signal.aborted) return;
		active.controller.abort(reason);
	}
	findConflicts(record, parent) {
		return [...this.activeOperations].filter((active) => {
			if (parent && active.token === parent) return false;
			return definitionsConflict(record.definition, active.record.definition);
		});
	}
	findCoalesciblePending(record, parent) {
		return this.pendingRequests.find((request) => request.record === record && request.options.parent === parent);
	}
	addWaiter(request, signal) {
		return new Promise((resolve, reject) => {
			const waiter = {
				resolve,
				reject,
				removeAbortListener: null,
				settled: false
			};
			request.waiters.push(waiter);
			if (!signal) return;
			const abort = () => {
				var _a, _b;
				if (waiter.settled) return;
				if (request.state === "active" && request.active && request.waiters.length === 1) {
					(_a = waiter.removeAbortListener) === null || _a === void 0 || _a.call(waiter);
					waiter.removeAbortListener = null;
					this.abortActive(request.active, abortReason(signal, `Operation "${request.record.definition.id}" was aborted.`));
					return;
				}
				waiter.settled = true;
				(_b = waiter.removeAbortListener) === null || _b === void 0 || _b.call(waiter);
				waiter.removeAbortListener = null;
				const index = request.waiters.indexOf(waiter);
				if (index >= 0) request.waiters.splice(index, 1);
				reject(abortReason(signal, `Operation "${request.record.definition.id}" was aborted.`));
				if (request.waiters.length === 0) this.abortRequestWithoutWaiters(request, signal);
			};
			signal.addEventListener("abort", abort, { once: true });
			waiter.removeAbortListener = () => signal.removeEventListener("abort", abort);
			if (signal.aborted) abort();
		});
	}
	abortRequestWithoutWaiters(request, signal) {
		var _a;
		const reason = abortReason(signal, `Operation "${request.record.definition.id}" was aborted.`);
		if (request.state === "pending") {
			this.pendingRequests = this.pendingRequests.filter((entry) => entry !== request);
			(_a = request.removeExternalAbortListener) === null || _a === void 0 || _a.call(request);
			request.removeExternalAbortListener = null;
			request.state = "settled";
		} else if (request.active) this.abortActive(request.active, reason);
		this.drainPending();
		this.resolveIdleWaiters();
	}
	attachExternalAbort(request) {
		var _a;
		const signals = [.../* @__PURE__ */ new Set([(_a = request.options.parent) === null || _a === void 0 ? void 0 : _a.signal])].filter((signal) => signal !== void 0);
		if (signals.length === 0) return;
		const abort = () => {
			var _a;
			const signal = signals.find((candidate) => candidate.aborted);
			const reason = signal ? abortReason(signal, `Operation "${request.record.definition.id}" was aborted.`) : abortError(`Operation "${request.record.definition.id}" was aborted.`);
			if (request.state === "pending") {
				this.pendingRequests = this.pendingRequests.filter((entry) => entry !== request);
				this.rejectRequest(request, reason);
				(_a = request.removeExternalAbortListener) === null || _a === void 0 || _a.call(request);
				request.removeExternalAbortListener = null;
				request.state = "settled";
			} else if (request.active) this.abortActive(request.active, reason);
			this.drainPending();
			this.resolveIdleWaiters();
		};
		for (const signal of signals) signal.addEventListener("abort", abort, { once: true });
		request.removeExternalAbortListener = () => {
			for (const signal of signals) signal.removeEventListener("abort", abort);
		};
		if (signals.some((signal) => signal.aborted)) abort();
	}
	rejectPending(predicate, reason) {
		var _a;
		const retained = [];
		for (const request of this.pendingRequests) {
			if (!predicate(request)) {
				retained.push(request);
				continue;
			}
			this.rejectRequest(request, reason);
			(_a = request.removeExternalAbortListener) === null || _a === void 0 || _a.call(request);
			request.state = "settled";
		}
		this.pendingRequests = retained;
		this.resolveIdleWaiters();
	}
	resolveRequest(request, value) {
		var _a;
		for (const waiter of request.waiters) {
			if (waiter.settled) continue;
			waiter.settled = true;
			(_a = waiter.removeAbortListener) === null || _a === void 0 || _a.call(waiter);
			waiter.removeAbortListener = null;
			waiter.resolve(value);
		}
		request.waiters.length = 0;
	}
	rejectRequest(request, error) {
		var _a;
		for (const waiter of request.waiters) {
			if (waiter.settled) continue;
			waiter.settled = true;
			(_a = waiter.removeAbortListener) === null || _a === void 0 || _a.call(waiter);
			waiter.removeAbortListener = null;
			waiter.reject(error);
		}
		request.waiters.length = 0;
	}
	requireRegistered(operationId, ownerPluginId) {
		this.assertActive("access an operation");
		const registered = this.operations.get(operationId);
		if (!registered) throw new require_plugin_identifier.OperationConflictError(`Operation "${operationId}" is not registered.`, ownerPluginId);
		return registered;
	}
	requireOwned(operationId, ownerPluginId) {
		const registered = this.requireRegistered(operationId, ownerPluginId);
		if (registered.ownerPluginId !== ownerPluginId) throw new require_plugin_identifier.OperationConflictError(`Operation "${operationId}" belongs to "${registered.ownerPluginId}", not "${ownerPluginId}".`, ownerPluginId);
		return registered;
	}
	validateParent(parent) {
		if (!parent) return;
		if (!parent.active || parent.signal.aborted || ![...this.activeOperations].some((active) => active.token === parent)) throw new require_plugin_identifier.OperationConflictError(`Parent operation "${parent.id}" is not active.`, parent.ownerPluginId);
	}
	validateDefinition(definition, ownerPluginId) {
		if (!require_plugin_identifier.isRuntimeIdentifier(ownerPluginId)) throw new require_plugin_identifier.OperationRegistrationError("Invalid Operation owner Runtime ID.", ownerPluginId);
		if (!require_plugin_identifier.isRuntimeIdentifier(definition.id)) throw new require_plugin_identifier.OperationRegistrationError("Invalid Operation Runtime ID.", ownerPluginId);
		if (!OPERATION_MODES.includes(definition.mode)) throw new require_plugin_identifier.OperationRegistrationError(`Operation "${definition.id}" has invalid mode "${definition.mode}".`, ownerPluginId);
		if (!REENTRANCY_POLICIES.includes(definition.reentrancy)) throw new require_plugin_identifier.OperationRegistrationError(`Operation "${definition.id}" has invalid reentrancy policy.`, ownerPluginId);
		if (!Array.isArray(definition.conflictDomains) || definition.conflictDomains.length === 0 || definition.conflictDomains.some((domain) => !CONFLICT_DOMAINS.includes(domain)) || new Set(definition.conflictDomains).size !== definition.conflictDomains.length) throw new require_plugin_identifier.OperationRegistrationError(`Operation "${definition.id}" has invalid conflict domains.`, ownerPluginId);
		if (definition.reentrancy === "coalesce" && typeof definition.coalesce !== "function") throw new require_plugin_identifier.OperationRegistrationError(`Operation "${definition.id}" must define coalesce().`, ownerPluginId);
		if (definition.allowedDuringTool !== void 0 && (!Array.isArray(definition.allowedDuringTool) || definition.allowedDuringTool.some((toolId) => !require_plugin_identifier.isRuntimeIdentifier(toolId)) || new Set(definition.allowedDuringTool).size !== definition.allowedDuringTool.length)) throw new require_plugin_identifier.OperationRegistrationError(`Operation "${definition.id}" has invalid allowed Tool ids.`, ownerPluginId);
	}
	conflictError(requested, active, ownerPluginId) {
		return new require_plugin_identifier.OperationConflictError(`Operation "${requested.definition.id}" conflicts with active operation "${active.definition.id}" in domain(s) ${requested.definition.conflictDomains.filter((domain) => active.definition.conflictDomains.includes(domain)).join(", ")}.`, ownerPluginId);
	}
	isIdle() {
		return this.activeOperations.size === 0 && this.pendingRequests.length === 0 && this.executingRequests.size === 0;
	}
	resolveIdleWaiters() {
		if (!this.isIdle()) return;
		for (const resolve of this.idleWaiters) resolve();
		this.idleWaiters.clear();
	}
	assertActive(operation) {
		if (this.disposed) throw new require_plugin_identifier.PluginKernelDisposedError(operation);
	}
};

//#endregion
//#region dist/esm/plugin-kernel/plugin-state-store.js
function assertStateKey(key) {
	if (key.trim().length === 0 || key.trim() !== key) throw new require_plugin_identifier.InvalidPluginDefinitionError("Plugin state keys must be non-empty trimmed strings.");
}
var PluginStateStore = class {
	constructor() {
		Object.defineProperty(this, "stateByPlugin", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: /* @__PURE__ */ new Map()
		});
		Object.defineProperty(this, "activePluginIds", {
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
	createScoped(pluginId, registerCleanup, registerFinalizer, isScopeActive) {
		this.assertActive("create plugin state");
		require_plugin_identifier.assertPluginIdentifier(pluginId, "Plugin state owner id");
		if (this.activePluginIds.has(pluginId)) throw new require_plugin_identifier.InvalidPluginDefinitionError(`Plugin state scope "${pluginId}" is already active.`, pluginId);
		this.activePluginIds.add(pluginId);
		let active = true;
		let cleanupRegistered = false;
		const cleanup = require_core_capabilities.createDisposable(() => {
			this.stateByPlugin.delete(pluginId);
		});
		try {
			registerFinalizer(require_core_capabilities.createDisposable(() => {
				this.stateByPlugin.delete(pluginId);
				this.activePluginIds.delete(pluginId);
				active = false;
			}));
		} catch (error) {
			this.activePluginIds.delete(pluginId);
			throw error;
		}
		const assertScopedActive = () => {
			this.assertActive("access plugin state");
			if (!active || !isScopeActive()) throw new require_plugin_identifier.PluginKernelDisposedError(`access state for plugin "${pluginId}"`);
		};
		const activate = () => {
			assertScopedActive();
			if (!cleanupRegistered) {
				registerCleanup(cleanup);
				cleanupRegistered = true;
			}
			let namespace = this.stateByPlugin.get(pluginId);
			if (!namespace) {
				namespace = /* @__PURE__ */ new Map();
				this.stateByPlugin.set(pluginId, namespace);
			}
			return namespace;
		};
		return Object.freeze({
			has: (key) => {
				var _a, _b;
				assertStateKey(key);
				assertScopedActive();
				return (_b = (_a = this.stateByPlugin.get(pluginId)) === null || _a === void 0 ? void 0 : _a.has(key)) !== null && _b !== void 0 ? _b : false;
			},
			get: (key) => {
				var _a;
				assertStateKey(key);
				assertScopedActive();
				return (_a = this.stateByPlugin.get(pluginId)) === null || _a === void 0 ? void 0 : _a.get(key);
			},
			set: (key, value) => {
				assertStateKey(key);
				activate().set(key, value);
			},
			delete: (key) => {
				var _a, _b;
				assertStateKey(key);
				assertScopedActive();
				return (_b = (_a = this.stateByPlugin.get(pluginId)) === null || _a === void 0 ? void 0 : _a.delete(key)) !== null && _b !== void 0 ? _b : false;
			},
			clear: () => {
				var _a;
				assertScopedActive();
				(_a = this.stateByPlugin.get(pluginId)) === null || _a === void 0 || _a.clear();
			}
		});
	}
	hasPluginState(pluginId) {
		this.assertActive("inspect plugin state");
		return this.stateByPlugin.has(pluginId);
	}
	dispose() {
		if (this.disposed) return;
		this.stateByPlugin.clear();
		this.activePluginIds.clear();
		this.disposed = true;
	}
	assertActive(operation) {
		if (this.disposed) throw new require_plugin_identifier.PluginKernelDisposedError(operation);
	}
};

//#endregion
//#region dist/esm/plugin-kernel/registration-scope.js
var RegistrationScope = class {
	constructor(pluginId, options = {}) {
		Object.defineProperty(this, "pluginId", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: pluginId
		});
		Object.defineProperty(this, "options", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: options
		});
		Object.defineProperty(this, "transactionId", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: void 0
		});
		Object.defineProperty(this, "entries", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: []
		});
		Object.defineProperty(this, "finalizers", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: []
		});
		Object.defineProperty(this, "state", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: "open"
		});
		require_plugin_identifier.assertPluginIdentifier(pluginId, "RegistrationScope Plugin id");
		this.transactionId = Symbol(`plugin-install:${pluginId}`);
	}
	get active() {
		return this.state !== "disposed";
	}
	assertOpen(operation = "register installation resources") {
		if (this.state !== "open") throw new require_plugin_identifier.PluginKernelStateError(operation, `registration-scope:${this.state}`);
	}
	add(disposable) {
		this.assertOpen();
		this.entries.push({
			disposable,
			rollbackOnly: false
		});
		return disposable;
	}
	addRollback(disposable) {
		this.assertOpen();
		this.entries.push({
			disposable,
			rollbackOnly: true
		});
		return disposable;
	}
	addFinalizer(disposable) {
		this.assertOpen();
		this.finalizers.push(disposable);
		return disposable;
	}
	addCleanup(cleanup) {
		return this.add(require_core_capabilities.createDisposable(cleanup));
	}
	commit() {
		var _a;
		this.assertOpen("commit plugin installation");
		for (const entry of this.entries) if (!entry.rollbackOnly && "commit" in entry.disposable) entry.disposable.commit();
		for (let index = this.entries.length - 1; index >= 0; index -= 1) if ((_a = this.entries[index]) === null || _a === void 0 ? void 0 : _a.rollbackOnly) this.entries.splice(index, 1);
		this.state = "committed";
	}
	async rollback() {
		if (this.state === "disposed") return [];
		const errors = [...await require_core_capabilities.disposeInReverse(this.entries.map((entry) => entry.disposable), {
			pluginId: this.pluginId,
			...this.options
		}), ...await require_core_capabilities.disposeInReverse(this.finalizers, {
			pluginId: this.pluginId,
			...this.options
		})];
		this.entries.length = 0;
		this.finalizers.length = 0;
		this.state = "disposed";
		return errors;
	}
	rollbackSync() {
		if (this.state === "disposed") return Object.freeze([]);
		const errors = [...require_core_capabilities.disposeInReverseSync(this.entries.map((entry) => entry.disposable), {
			pluginId: this.pluginId,
			...this.options
		}), ...require_core_capabilities.disposeInReverseSync(this.finalizers, {
			pluginId: this.pluginId,
			...this.options
		})];
		this.entries.length = 0;
		this.finalizers.length = 0;
		this.state = "disposed";
		return Object.freeze(errors);
	}
	async dispose() {
		if (this.state === "disposed") return;
		const errors = [...await require_core_capabilities.disposeInReverse(this.entries.map((entry) => entry.disposable), {
			pluginId: this.pluginId,
			...this.options
		}), ...await require_core_capabilities.disposeInReverse(this.finalizers, {
			pluginId: this.pluginId,
			...this.options
		})];
		this.entries.length = 0;
		this.finalizers.length = 0;
		this.state = "disposed";
		if (errors.length > 0) throw new require_plugin_identifier.PluginAggregateError(`[ImageEditor] Plugin "${this.pluginId}" cleanup failed.`, errors, { pluginId: this.pluginId });
	}
	disposeSync() {
		if (this.state === "disposed") return;
		const errors = this.rollbackSync();
		if (errors.length > 0) throw new require_plugin_identifier.PluginAggregateError(`[ImageEditor] Plugin "${this.pluginId}" synchronous cleanup failed.`, errors, { pluginId: this.pluginId });
	}
};

//#endregion
//#region dist/esm/plugin-kernel/tool-coordinator.js
var ToolCoordinator = class {
	constructor(options = {}) {
		Object.defineProperty(this, "options", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: options
		});
		Object.defineProperty(this, "tools", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: /* @__PURE__ */ new Map()
		});
		Object.defineProperty(this, "active", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: null
		});
		Object.defineProperty(this, "transitioning", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: false
		});
		Object.defineProperty(this, "transitionCompletion", {
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
	}
	register(definition, ownerPluginId) {
		this.assertActive("register a tool");
		if (!require_plugin_identifier.isRuntimeIdentifier(ownerPluginId)) throw new require_plugin_identifier.ToolRegistrationError("Invalid Tool owner Runtime ID.", ownerPluginId);
		if (!require_plugin_identifier.isRuntimeIdentifier(definition.id)) throw new require_plugin_identifier.ToolRegistrationError("Invalid Tool Runtime ID.", ownerPluginId);
		const existing = this.tools.get(definition.id);
		if (existing) throw new require_plugin_identifier.ToolRegistrationError(`Tool "${definition.id}" is already registered by "${existing.ownerPluginId}".`, ownerPluginId);
		const record = {
			definition,
			ownerPluginId,
			context: Object.freeze({
				toolId: definition.id,
				ownerPluginId
			})
		};
		this.tools.set(definition.id, record);
		return require_core_capabilities.createDisposable(() => this.disposeRegistration(record));
	}
	disposeSync() {
		if (this.disposed) return;
		let exitError;
		try {
			const current = this.active;
			this.active = null;
			if (current) {
				const result = current.definition.exit("host-dispose", current.context);
				if (require_core_capabilities.isPromiseLike(result)) {
					Promise.resolve(result).catch((error) => {
						require_core_capabilities.reportErrorSafely(this.options.errorSink, error);
					});
					throw new require_plugin_identifier.ToolTransitionError(current.definition.id, "returned a Promise during synchronous host disposal", current.ownerPluginId);
				}
			}
		} catch (error) {
			exitError = error;
		} finally {
			this.active = null;
			this.tools.clear();
			this.disposed = true;
		}
		if (exitError) throw exitError;
	}
	async enter(toolId, requesterPluginId) {
		this.assertActive("enter a tool");
		const next = this.tools.get(toolId);
		if (!next) throw new require_plugin_identifier.ToolTransitionError(toolId, "is not registered", requesterPluginId);
		if (requesterPluginId && requesterPluginId !== next.ownerPluginId) throw new require_plugin_identifier.ToolTransitionError(toolId, `belongs to "${next.ownerPluginId}", not "${requesterPluginId}"`, requesterPluginId);
		if (this.active === next) return;
		await this.runTransition(toolId, async () => {
			if (this.active) await this.exitCurrent("switch");
			try {
				await next.definition.enter(next.context);
				this.active = next;
			} catch (error) {
				this.active = null;
				const transitionError = new require_plugin_identifier.ToolTransitionError(toolId, "failed to enter", next.ownerPluginId, error);
				require_core_capabilities.reportErrorSafely(this.options.errorSink, transitionError);
				throw transitionError;
			}
		});
	}
	async exit(reason = "requested") {
		this.assertActive("exit a tool");
		if (!this.active) return;
		await this.runTransition(this.active.definition.id, () => this.exitCurrent(reason));
	}
	getActiveToolId() {
		var _a, _b;
		this.assertActive("inspect active tool state");
		return (_b = (_a = this.active) === null || _a === void 0 ? void 0 : _a.definition.id) !== null && _b !== void 0 ? _b : null;
	}
	canRunOperation(operationId) {
		var _a;
		this.assertActive("check tool operation policy");
		if (!((_a = this.active) === null || _a === void 0 ? void 0 : _a.definition.canRunOperation)) return true;
		try {
			return this.active.definition.canRunOperation(operationId);
		} catch (error) {
			const transitionError = new require_plugin_identifier.ToolTransitionError(this.active.definition.id, `operation policy failed for "${operationId}"`, this.active.ownerPluginId, error);
			require_core_capabilities.reportErrorSafely(this.options.errorSink, transitionError);
			return false;
		}
	}
	async dispose() {
		if (this.disposed) return;
		let exitError;
		try {
			await this.waitForTransition();
			if (this.active) await this.exitCurrent("host-dispose");
		} catch (error) {
			exitError = error;
		} finally {
			this.active = null;
			this.tools.clear();
			this.disposed = true;
		}
		if (exitError) throw exitError;
	}
	async exitCurrent(reason) {
		const current = this.active;
		if (!current) return;
		this.active = null;
		try {
			await current.definition.exit(reason, current.context);
		} catch (error) {
			const transitionError = new require_plugin_identifier.ToolTransitionError(current.definition.id, `failed to exit for reason "${reason}"`, current.ownerPluginId, error);
			require_core_capabilities.reportErrorSafely(this.options.errorSink, transitionError);
			throw transitionError;
		}
	}
	async runTransition(toolId, task) {
		if (this.transitioning) throw new require_plugin_identifier.ToolTransitionError(toolId, "cannot transition while another transition is active");
		this.transitioning = true;
		let completeTransition = () => void 0;
		this.transitionCompletion = new Promise((resolve) => {
			completeTransition = resolve;
		});
		try {
			await task();
		} finally {
			completeTransition();
			this.transitionCompletion = null;
			this.transitioning = false;
		}
	}
	async disposeRegistration(record) {
		await this.waitForTransition();
		try {
			if (this.active === record) await this.runTransition(record.definition.id, () => this.exitCurrent("plugin-dispose"));
		} finally {
			if (this.tools.get(record.definition.id) === record) this.tools.delete(record.definition.id);
		}
	}
	async waitForTransition() {
		while (this.transitionCompletion) await this.transitionCompletion;
	}
	assertActive(operation) {
		if (this.disposed) throw new require_plugin_identifier.PluginKernelDisposedError(operation);
	}
};

//#endregion
//#region dist/esm/plugin-kernel/plugin-manager.js
function isPluginApi(value) {
	return typeof value === "object" && value !== null || typeof value === "function";
}
function sameArray(left, right, equal) {
	if (left === void 0 || right === void 0) return left === right;
	return left.length === right.length && left.every((leftValue, index) => equal(leftValue, right[index]));
}
function sameInstallationDefinition(left, right) {
	return left.ref === right.ref && left.manifest.id === right.manifest.id && left.manifest.version === right.manifest.version && left.manifest.apiVersion === right.manifest.apiVersion && left.manifest.engine === right.manifest.engine && sameArray(left.manifest.requiresPlugins, right.manifest.requiresPlugins, (leftRef, rightRef) => leftRef === rightRef) && sameArray(left.manifest.requires, right.manifest.requires, (leftRequirement, rightRequirement) => leftRequirement.token === rightRequirement.token && leftRequirement.range === rightRequirement.range) && sameArray(left.manifest.optional, right.manifest.optional, (leftRequirement, rightRequirement) => leftRequirement.token === rightRequirement.token && leftRequirement.range === rightRequirement.range) && sameArray(left.manifest.permissions, right.manifest.permissions, (leftPermission, rightPermission) => leftPermission === rightPermission) && left.setupMode === right.setupMode && left.setup === right.setup && left.onInit === right.onInit && left.onImageLoaded === right.onImageLoaded && left.onImageCleared === right.onImageCleared && left.onDispose === right.onDispose;
}
const pluginPackageHints = /* @__PURE__ */ new Map([
	["foundation:overlay", "@bensitu/image-editor/plugins/overlay"],
	["plugin:transform", "@bensitu/image-editor/plugins/transform"],
	["plugin:mask", "@bensitu/image-editor/plugins/mask"],
	["plugin:history", "@bensitu/image-editor/plugins/history"],
	["plugin:filters", "@bensitu/image-editor/plugins/filters"]
]);
var PluginManager = class {
	constructor(options = {}) {
		var _a;
		Object.defineProperty(this, "options", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: options
		});
		Object.defineProperty(this, "operationRegistry", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: new OperationRegistry()
		});
		Object.defineProperty(this, "stateStore", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: new PluginStateStore()
		});
		Object.defineProperty(this, "installed", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: /* @__PURE__ */ new Map()
		});
		Object.defineProperty(this, "installationOrder", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: []
		});
		Object.defineProperty(this, "hostState", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: "created"
		});
		Object.defineProperty(this, "topLevelInstallActive", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: false
		});
		Object.defineProperty(this, "disposePromise", {
			enumerable: true,
			configurable: true,
			writable: true,
			value: null
		});
		this.capabilityRegistry = new CapabilityRegistry(options);
		this.toolCoordinator = new ToolCoordinator(options.errorSink ? { errorSink: options.errorSink } : {});
		this.eventBus = new CommittedEventBus(options);
		for (const provider of (_a = options.hostCapabilities) !== null && _a !== void 0 ? _a : []) this.capabilityRegistry.provideHost(provider.token, provider.implementation, provider.providerId, provider.requiredPermission);
	}
	get state() {
		return this.hostState;
	}
	install(plugin) {
		return Promise.reject(new require_plugin_identifier.PluginKernelStateError("install an asynchronous Plugin", this.hostState));
	}
	installSync(plugin) {
		return this.installSyncForHost(plugin).api;
	}
	installSyncForHost(plugin) {
		this.assertCanInstall();
		if (this.topLevelInstallActive) throw new require_plugin_identifier.PluginKernelStateError("start a concurrent plugin installation", this.hostState);
		this.topLevelInstallActive = true;
		try {
			const outcome = this.performInstallSync(plugin, "strict", []);
			return Object.freeze({
				api: outcome.api,
				installedPlugin: outcome.installedPlugin
			});
		} finally {
			this.topLevelInstallActive = false;
		}
	}
	installBatchSync(plugins) {
		this.assertCanInstall();
		if (this.topLevelInstallActive) throw new require_plugin_identifier.PluginKernelStateError("start a concurrent plugin installation", this.hostState);
		this.topLevelInstallActive = true;
		try {
			const prepared = this.prepareBatch(plugins);
			const visibleTransactions = /* @__PURE__ */ new Set();
			const pendingRecords = [];
			try {
				for (const entry of prepared.ordered) {
					const record = this.performPendingInstallSync(entry.plugin, visibleTransactions);
					pendingRecords.push(record);
					prepared.apisByPluginId.set(entry.plugin.ref.id, record.api);
				}
				for (const record of pendingRecords) record.scope.commit();
				for (const record of pendingRecords) {
					const pluginId = record.plugin.ref.id;
					this.installed.set(pluginId, record);
					this.installationOrder.push(pluginId);
				}
			} catch (cause) {
				throw new require_plugin_identifier.PluginBatchInstallError(cause, [...cause instanceof require_plugin_identifier.PluginSetupError ? cause.cleanupErrors : [], ...this.rollbackPendingBatchSync(pendingRecords)]);
			}
			return Object.freeze({
				apisByPluginId: prepared.apisByPluginId,
				installedPlugins: Object.freeze(pendingRecords.map((record) => record.plugin))
			});
		} finally {
			this.topLevelInstallActive = false;
		}
	}
	get(ref) {
		this.assertUsable("query a plugin");
		const record = this.installed.get(ref.id);
		if (!record || record.refObject !== ref) return null;
		return record.api;
	}
	require(ref) {
		const api = this.get(ref);
		if (api === null) throw new require_plugin_identifier.PluginNotInstalledError(ref.id);
		return api;
	}
	getById(pluginId) {
		var _a, _b;
		this.assertUsable("query a plugin by id");
		return (_b = (_a = this.installed.get(pluginId)) === null || _a === void 0 ? void 0 : _a.api) !== null && _b !== void 0 ? _b : null;
	}
	has(refOrId) {
		this.assertUsable("inspect installed plugins");
		if (typeof refOrId === "string") return this.installed.has(refOrId);
		const record = this.installed.get(refOrId.id);
		return (record === null || record === void 0 ? void 0 : record.refObject) === refOrId;
	}
	hasOperation(operationId) {
		return this.operationRegistry.has(operationId);
	}
	getOperationForHost(operationId) {
		return this.operationRegistry.get(operationId);
	}
	registerHostOperation(definition) {
		this.assertCanInstall();
		return this.operationRegistry.register(definition, "core:host");
	}
	beginOperationForHost(operationId) {
		if (!this.canRunOperation(operationId)) throw new require_plugin_identifier.PluginKernelStateError(`run operation "${operationId}" while the active tool rejects it`, this.hostState);
		return this.operationRegistry.beginForHost(operationId);
	}
	runOperationForHost(operationId, args, task, options = {}) {
		if (!this.canRunOperation(operationId)) return Promise.reject(new require_plugin_identifier.PluginKernelStateError(`run operation "${operationId}" while the active tool rejects it`, this.hostState));
		return this.operationRegistry.runForHost(operationId, args, task, options);
	}
	waitForOperations() {
		return this.operationRegistry.waitForIdle();
	}
	hasRunningOperations() {
		return this.operationRegistry.hasInFlightOperations();
	}
	abortOperationsForHost(reason) {
		return this.operationRegistry.abortAll(reason);
	}
	suspendOperationsForHost(reason) {
		return this.operationRegistry.suspend(reason);
	}
	exitActiveToolForHost() {
		return this.toolCoordinator.exit("host-dispose");
	}
	emitCommitted(eventName, payload) {
		return this.eventBus.emitCommitted(eventName, payload);
	}
	async initialize() {
		var _a;
		this.assertUsable("initialize the Plugin Kernel");
		if (this.hostState !== "created" || this.topLevelInstallActive) throw new require_plugin_identifier.PluginKernelStateError("initialize the Plugin Kernel", this.hostState);
		this.hostState = "initializing";
		try {
			for (const pluginId of this.installationOrder) {
				const record = this.installed.get(pluginId);
				if (!(record === null || record === void 0 ? void 0 : record.plugin.onInit)) continue;
				try {
					await record.plugin.onInit(record.lifecycleContext);
				} catch (error) {
					throw new require_plugin_identifier.PluginLifecycleError(pluginId, "init", error);
				}
			}
			this.hostState = "initialized";
		} catch (error) {
			this.hostState = "disposing";
			const cleanupErrors = await this.cleanupAll();
			this.hostState = "disposed";
			const lifecycleError = error instanceof require_plugin_identifier.PluginLifecycleError ? error : new require_plugin_identifier.PluginLifecycleError("plugin-kernel", "init", error);
			throw new require_plugin_identifier.PluginLifecycleError((_a = lifecycleError.pluginId) !== null && _a !== void 0 ? _a : "plugin-kernel", "init", lifecycleError.cause, cleanupErrors);
		}
	}
	initializeSync() {
		var _a;
		this.assertUsable("initialize the Plugin Kernel");
		if (this.hostState !== "created" || this.topLevelInstallActive) throw new require_plugin_identifier.PluginKernelStateError("initialize the Plugin Kernel", this.hostState);
		this.hostState = "initializing";
		try {
			for (const pluginId of this.installationOrder) {
				const record = this.installed.get(pluginId);
				if (!(record === null || record === void 0 ? void 0 : record.plugin.onInit)) continue;
				if (require_core_capabilities.isPromiseLike(record.plugin.onInit(record.lifecycleContext))) throw new require_plugin_identifier.PluginLifecycleError(pluginId, "init", /* @__PURE__ */ new Error("Synchronous plugin onInit returned a Promise."));
			}
			this.hostState = "initialized";
		} catch (error) {
			this.hostState = "disposing";
			const cleanupErrors = this.cleanupAllSync();
			this.hostState = "disposed";
			const lifecycleError = error instanceof require_plugin_identifier.PluginLifecycleError ? error : new require_plugin_identifier.PluginLifecycleError("plugin-kernel", "init", error);
			throw new require_plugin_identifier.PluginLifecycleError((_a = lifecycleError.pluginId) !== null && _a !== void 0 ? _a : "plugin-kernel", "init", lifecycleError.cause, cleanupErrors);
		}
	}
	async notifyImageLoaded(image) {
		this.assertLifecycleReady("notify plugins that an image loaded");
		for (const pluginId of this.installationOrder) {
			const record = this.installed.get(pluginId);
			if (!(record === null || record === void 0 ? void 0 : record.plugin.onImageLoaded)) continue;
			try {
				await record.plugin.onImageLoaded(image, record.lifecycleContext);
			} catch (error) {
				throw new require_plugin_identifier.PluginLifecycleError(pluginId, "image-loaded", error);
			}
		}
	}
	async notifyImageCleared() {
		this.assertLifecycleReady("notify plugins that an image cleared");
		for (const pluginId of this.installationOrder) {
			const record = this.installed.get(pluginId);
			if (!(record === null || record === void 0 ? void 0 : record.plugin.onImageCleared)) continue;
			try {
				await record.plugin.onImageCleared(record.lifecycleContext);
			} catch (error) {
				throw new require_plugin_identifier.PluginLifecycleError(pluginId, "image-cleared", error);
			}
		}
	}
	dispose() {
		var _a;
		if (this.hostState === "disposed") return Promise.resolve();
		if (this.hostState === "disposing") return (_a = this.disposePromise) !== null && _a !== void 0 ? _a : Promise.resolve();
		if (this.hostState === "initializing") return Promise.reject(new require_plugin_identifier.PluginKernelStateError("dispose the Plugin Kernel", this.hostState));
		this.hostState = "disposing";
		this.disposePromise = this.performDispose();
		return this.disposePromise;
	}
	disposeSync() {
		if (this.hostState === "disposed") return;
		if (this.hostState === "disposing" || this.hostState === "initializing") throw new require_plugin_identifier.PluginKernelStateError("dispose the Plugin Kernel synchronously", this.hostState);
		if (this.operationRegistry.hasInFlightOperations()) throw new require_plugin_identifier.PluginKernelStateError("dispose the Plugin Kernel synchronously while operations are running", this.hostState);
		this.hostState = "disposing";
		const errors = this.cleanupAllSync();
		this.hostState = "disposed";
		if (errors.length > 0) throw new require_plugin_identifier.PluginAggregateError("[ImageEditor] Plugin Kernel synchronous disposal completed with cleanup errors.", errors);
	}
	prepareBatch(inputs) {
		var _a;
		if (!Array.isArray(inputs) || inputs.length === 0) throw new require_plugin_identifier.InvalidPluginDefinitionError("Plugin batch must contain at least one Plugin.");
		const candidatesById = /* @__PURE__ */ new Map();
		const normalizedInputs = /* @__PURE__ */ new WeakMap();
		const apisByPluginId = /* @__PURE__ */ new Map();
		for (const input of inputs) {
			const cacheKey = (typeof input === "object" || typeof input === "function") && input !== null ? input : null;
			let plugin = cacheKey ? normalizedInputs.get(cacheKey) : void 0;
			if (!plugin) {
				plugin = this.normalizePluginDefinition(input);
				if (cacheKey) normalizedInputs.set(cacheKey, plugin);
			}
			const pluginId = plugin.ref.id;
			const existing = this.installed.get(pluginId);
			if (existing) {
				if (!sameInstallationDefinition(existing.plugin, plugin)) throw new require_plugin_identifier.PluginDefinitionConflictError(pluginId);
				apisByPluginId.set(pluginId, existing.api);
				continue;
			}
			const duplicate = candidatesById.get(pluginId);
			if (duplicate) {
				if (!sameInstallationDefinition(duplicate.plugin, plugin)) throw new require_plugin_identifier.PluginDefinitionConflictError(pluginId);
				continue;
			}
			candidatesById.set(pluginId, { plugin });
		}
		const candidates = [...candidatesById.values()];
		const dependencies = /* @__PURE__ */ new Map();
		for (const candidate of candidates) {
			const pluginDependencies = /* @__PURE__ */ new Set();
			for (const dependency of (_a = candidate.plugin.manifest.requiresPlugins) !== null && _a !== void 0 ? _a : []) {
				const installedDependency = this.installed.get(dependency.id);
				if ((installedDependency === null || installedDependency === void 0 ? void 0 : installedDependency.refObject) === dependency) continue;
				const batchDependency = candidatesById.get(dependency.id);
				if ((batchDependency === null || batchDependency === void 0 ? void 0 : batchDependency.plugin.ref) === dependency) {
					pluginDependencies.add(dependency.id);
					continue;
				}
				throw this.createDependencyError(candidate.plugin.ref.id, dependency, [...this.installed.keys(), ...candidatesById.keys()]);
			}
			dependencies.set(candidate.plugin.ref.id, pluginDependencies);
		}
		const remaining = new Set(candidatesById.keys());
		const ordered = [];
		while (remaining.size > 0) {
			const next = candidates.find((candidate) => {
				var _a;
				return remaining.has(candidate.plugin.ref.id) && [...(_a = dependencies.get(candidate.plugin.ref.id)) !== null && _a !== void 0 ? _a : []].every((dependencyId) => !remaining.has(dependencyId));
			});
			if (!next) throw new require_plugin_identifier.PluginDependencyCycleError(this.findDependencyCycle(remaining, dependencies));
			remaining.delete(next.plugin.ref.id);
			ordered.push(next);
		}
		return {
			ordered: Object.freeze(ordered),
			apisByPluginId
		};
	}
	findDependencyCycle(remaining, dependencies) {
		const visited = /* @__PURE__ */ new Set();
		const visiting = /* @__PURE__ */ new Set();
		const stack = [];
		const visit = (pluginId) => {
			var _a;
			if (visiting.has(pluginId)) {
				const start = stack.indexOf(pluginId);
				return Object.freeze([...stack.slice(start), pluginId]);
			}
			if (visited.has(pluginId)) return null;
			visiting.add(pluginId);
			stack.push(pluginId);
			for (const dependencyId of (_a = dependencies.get(pluginId)) !== null && _a !== void 0 ? _a : []) {
				if (!remaining.has(dependencyId)) continue;
				const cycle = visit(dependencyId);
				if (cycle) return cycle;
			}
			stack.pop();
			visiting.delete(pluginId);
			visited.add(pluginId);
			return null;
		};
		for (const pluginId of remaining) {
			const cycle = visit(pluginId);
			if (cycle) return cycle;
		}
		return Object.freeze([...remaining, remaining.values().next().value]);
	}
	performPendingInstallSync(plugin, visibleTransactions) {
		if (plugin.setupMode !== "sync") throw new require_plugin_identifier.InvalidPluginDefinitionError(`Plugin "${plugin.ref.id}" must declare setupMode "sync" for install().`, plugin.ref.id);
		const { required, optional } = this.resolveCapabilities(plugin, visibleTransactions);
		require_core_capabilities.acquirePluginDefinitionLease(plugin, this, plugin.ref.id);
		const scope = new RegistrationScope(plugin.ref.id, this.options);
		visibleTransactions.add(scope.transactionId);
		try {
			const contexts = this.createContexts(plugin.ref, scope, required, optional);
			const api = plugin.setup(contexts.setup);
			if (require_core_capabilities.isPromiseLike(api)) throw new require_plugin_identifier.InvalidPluginDefinitionError(`Plugin "${plugin.ref.id}" returned a Promise from synchronous setup.`, plugin.ref.id);
			if (!isPluginApi(api)) throw new require_plugin_identifier.InvalidPluginDefinitionError(`Plugin "${plugin.ref.id}" setup must return a non-null object or function API.`, plugin.ref.id);
			return {
				plugin,
				refObject: plugin.ref,
				api,
				scope,
				lifecycleContext: contexts.lifecycle
			};
		} catch (error) {
			visibleTransactions.delete(scope.transactionId);
			const cleanupErrors = scope.rollbackSync();
			require_core_capabilities.releasePluginDefinitionLease(plugin, this);
			throw new require_plugin_identifier.PluginSetupError(plugin.ref.id, error, cleanupErrors);
		}
	}
	rollbackPendingBatchSync(pendingRecords) {
		const cleanupErrors = [];
		for (const record of [...pendingRecords].reverse()) {
			if (record.plugin.onDispose) try {
				const result = record.plugin.onDispose(record.lifecycleContext);
				if (require_core_capabilities.isPromiseLike(result)) {
					Promise.resolve(result).catch((error) => {
						require_core_capabilities.reportErrorSafely(this.options.errorSink, error);
					});
					throw new Error("Synchronous Plugin onDispose returned a Promise.");
				}
			} catch (error) {
				cleanupErrors.push(new require_plugin_identifier.PluginLifecycleError(record.plugin.ref.id, "dispose", error));
			}
			cleanupErrors.push(...record.scope.rollbackSync());
			require_core_capabilities.releasePluginDefinitionLease(record.plugin, this);
		}
		return Object.freeze(cleanupErrors);
	}
	createDependencyError(consumerPluginId, dependency, availablePluginIds) {
		return new require_plugin_identifier.PluginDependencyError({
			consumerPluginId,
			dependencyId: dependency.id,
			requiredApiVersion: dependency.apiVersion,
			availablePluginIds: Object.freeze([...new Set(availablePluginIds)].sort()),
			...pluginPackageHints.has(dependency.id) ? { packageHint: pluginPackageHints.get(dependency.id) } : {},
			planHint: "Pass the dependency to install([...]) or include it in composePlugins(...)."
		});
	}
	assertPluginDependenciesInstalled(plugin) {
		var _a;
		for (const dependency of (_a = plugin.manifest.requiresPlugins) !== null && _a !== void 0 ? _a : []) {
			const installedDependency = this.installed.get(dependency.id);
			if ((installedDependency === null || installedDependency === void 0 ? void 0 : installedDependency.refObject) === dependency) continue;
			throw this.createDependencyError(plugin.ref.id, dependency, [...this.installed.keys()]);
		}
	}
	performInstallSync(input, mode, parentStack) {
		const plugin = this.normalizePluginDefinition(input);
		if (plugin.setupMode !== "sync") throw new require_plugin_identifier.InvalidPluginDefinitionError(`Plugin "${plugin.ref.id}" must declare setupMode "sync" for installSync().`, plugin.ref.id);
		const pluginId = plugin.ref.id;
		if (parentStack.includes(pluginId)) throw new require_plugin_identifier.InvalidPluginDefinitionError(`Plugin dependency cycle detected: ${[...parentStack, pluginId].join(" -> ")}.`, pluginId);
		const existing = this.installed.get(pluginId);
		if (existing) {
			if (mode === "strict") throw new require_plugin_identifier.PluginAlreadyInstalledError(pluginId);
			if (!sameInstallationDefinition(existing.plugin, plugin)) throw new require_plugin_identifier.PluginVersionMismatchError(pluginId, existing.plugin.manifest.version, plugin.manifest.version, existing.plugin.ref.apiVersion, plugin.ref.apiVersion);
			return {
				api: existing.api,
				installedPlugin: existing.plugin
			};
		}
		this.assertPluginDependenciesInstalled(plugin);
		const { required, optional } = this.resolveCapabilities(plugin);
		require_core_capabilities.acquirePluginDefinitionLease(plugin, this, pluginId);
		const scope = new RegistrationScope(pluginId, this.options);
		try {
			const contexts = this.createContexts(plugin.ref, scope, required, optional);
			const api = plugin.setup(contexts.setup);
			if (require_core_capabilities.isPromiseLike(api)) throw new require_plugin_identifier.InvalidPluginDefinitionError(`Plugin "${pluginId}" returned a Promise from synchronous setup.`, pluginId);
			if (!isPluginApi(api)) throw new require_plugin_identifier.InvalidPluginDefinitionError(`Plugin "${pluginId}" setup must return a non-null object or function API.`, pluginId);
			scope.commit();
			this.installed.set(pluginId, {
				plugin,
				refObject: plugin.ref,
				api,
				scope,
				lifecycleContext: contexts.lifecycle
			});
			this.installationOrder.push(pluginId);
			return {
				api,
				installedPlugin: plugin
			};
		} catch (error) {
			const cleanupErrors = scope.rollbackSync();
			require_core_capabilities.releasePluginDefinitionLease(plugin, this);
			throw new require_plugin_identifier.PluginSetupError(pluginId, error, cleanupErrors);
		}
	}
	resolveCapabilities(plugin, visibleTransactions) {
		var _a, _b;
		const required = /* @__PURE__ */ new Map();
		const optional = /* @__PURE__ */ new Map();
		for (const requirement of (_a = plugin.manifest.requires) !== null && _a !== void 0 ? _a : []) {
			this.assertCapabilityPermission(plugin, requirement.token.id, visibleTransactions);
			required.set(requirement.token.id, {
				token: requirement.token,
				value: this.capabilityRegistry.requireDefinition(requirement, plugin.ref.id, visibleTransactions)
			});
		}
		for (const requirement of (_b = plugin.manifest.optional) !== null && _b !== void 0 ? _b : []) {
			this.assertCapabilityPermission(plugin, requirement.token.id, visibleTransactions);
			const value = this.capabilityRegistry.optionalDefinition(requirement, plugin.ref.id, visibleTransactions);
			optional.set(requirement.token.id, {
				token: requirement.token,
				value,
				status: value !== null ? "available" : this.capabilityRegistry.getProviderInfo(requirement.token.id) ? "incompatible" : "missing"
			});
		}
		return {
			required,
			optional
		};
	}
	assertCapabilityPermission(plugin, capabilityId, visibleTransactions) {
		var _a;
		const permission = this.capabilityRegistry.getRequiredPermission(capabilityId, visibleTransactions);
		if (!permission || ((_a = plugin.manifest.permissions) === null || _a === void 0 ? void 0 : _a.includes(permission))) return;
		throw new require_plugin_identifier.PluginPermissionError(plugin.ref.id, permission, capabilityId);
	}
	createContexts(plugin, scope, required, optional, dependencyInstaller) {
		const pluginId = plugin.id;
		const state = this.stateStore.createScoped(pluginId, (disposable) => scope.add(disposable), (disposable) => scope.addFinalizer(disposable), () => scope.active);
		const capabilities = Object.freeze({
			require: (token) => {
				const resolved = required.get(token.id);
				if (!resolved || resolved.token !== token) throw new require_plugin_identifier.PluginCapabilityError({
					consumerPluginId: pluginId,
					capabilityId: token.id,
					requestedRange: "undeclared-required-capability",
					reason: "missing"
				});
				return resolved.value;
			},
			optional: (token) => {
				const resolved = optional.get(token.id);
				if (!resolved || resolved.token !== token) throw new require_plugin_identifier.PluginCapabilityError({
					consumerPluginId: pluginId,
					capabilityId: token.id,
					requestedRange: "undeclared-optional-capability",
					reason: "missing"
				});
				return resolved.value;
			},
			getOptionalStatus: (token) => {
				const resolved = optional.get(token.id);
				if (!resolved || resolved.token !== token) throw new require_plugin_identifier.PluginCapabilityError({
					consumerPluginId: pluginId,
					capabilityId: token.id,
					requestedRange: "undeclared-optional-capability",
					reason: "missing"
				});
				return resolved.status;
			}
		});
		const operations = Object.freeze({
			begin: (operationId) => {
				if (!this.canRunOperation(operationId)) throw this.operationRejectedByTool(operationId);
				return this.operationRegistry.begin(operationId, pluginId);
			},
			run: (operationId, args, task, options = {}) => this.canRunOperation(operationId) ? this.operationRegistry.run(operationId, pluginId, args, task, options) : Promise.reject(this.operationRejectedByTool(operationId)),
			get: (operationId) => this.operationRegistry.get(operationId),
			isActive: (operationId) => this.operationRegistry.isActive(operationId)
		});
		const tools = Object.freeze({
			enter: (toolId) => this.toolCoordinator.enter(toolId, pluginId),
			exit: (reason) => this.toolCoordinator.exit(reason),
			getActiveToolId: () => this.toolCoordinator.getActiveToolId(),
			canRunOperation: (operationId) => this.toolCoordinator.canRunOperation(operationId)
		});
		const events = Object.freeze({ emitCommitted: (eventName, payload) => this.eventBus.emitCommitted(eventName, payload) });
		const lifecycle = Object.freeze({
			plugin,
			pluginId,
			state,
			capabilities,
			operations,
			tools,
			events
		});
		const setupCapabilities = Object.freeze({
			...capabilities,
			provide: (token, implementation, options) => {
				var _a;
				scope.assertOpen();
				return scope.add(this.capabilityRegistry.providePending(token, implementation, pluginId, scope.transactionId, (_a = options === null || options === void 0 ? void 0 : options.version) !== null && _a !== void 0 ? _a : token.version, options === null || options === void 0 ? void 0 : options.requiredPermission));
			}
		});
		const setupOperations = Object.freeze({
			...operations,
			register: (definition) => {
				scope.assertOpen();
				return scope.add(this.operationRegistry.register(definition, pluginId));
			}
		});
		const setupTools = Object.freeze({
			...tools,
			register: (definition) => {
				scope.assertOpen();
				return scope.add(this.toolCoordinator.register(definition, pluginId));
			}
		});
		const setupEvents = Object.freeze({
			...events,
			on: (eventName, listener) => {
				scope.assertOpen();
				return scope.add(this.eventBus.on(eventName, listener));
			}
		});
		const ensurePlugin = dependencyInstaller !== null && dependencyInstaller !== void 0 ? dependencyInstaller : (() => {
			throw new require_plugin_identifier.PluginKernelStateError("install a composed dependency from synchronous Plugin setup", this.hostState);
		});
		const disposables = Object.freeze({
			get active() {
				return scope.active;
			},
			add: (disposable) => {
				scope.assertOpen();
				return scope.add(disposable);
			}
		});
		return {
			setup: Object.freeze({
				plugin,
				pluginId,
				state,
				capabilities: setupCapabilities,
				operations: setupOperations,
				tools: setupTools,
				events: setupEvents,
				disposables,
				addDisposable: (disposable) => {
					scope.assertOpen();
					return scope.add(disposable);
				},
				ensure: (dependency) => ensurePlugin(dependency),
				ensurePlugin
			}),
			lifecycle
		};
	}
	normalizePluginDefinition(plugin) {
		if (require_core_capabilities.isCanonicalPluginDefinition(plugin)) return plugin;
		if (typeof plugin !== "object" || plugin === null) throw new require_plugin_identifier.InvalidPluginDefinitionError("Plugin definition must be an object.");
		if (!require_core_capabilities.isPluginRef(plugin.ref)) throw new require_plugin_identifier.InvalidPluginDefinitionError("Plugin definition must use a PluginRef created by definePluginRef().");
		if (typeof plugin.setup !== "function") throw new require_plugin_identifier.InvalidPluginDefinitionError(`Plugin "${plugin.ref.id}" must define setup().`, plugin.ref.id);
		const manifest = require_core_capabilities.validatePluginManifest(plugin.ref, "manifest" in plugin ? plugin.manifest : {
			id: plugin.ref.id,
			version: plugin.version,
			apiVersion: plugin.ref.apiVersion,
			engine: "*",
			...plugin.requires ? { requires: plugin.requires } : {},
			...plugin.optional ? { optional: plugin.optional } : {},
			...plugin.permissions ? { permissions: plugin.permissions } : {}
		});
		return require_core_capabilities.markCanonicalPluginDefinition(Object.freeze({
			...plugin,
			ref: plugin.ref,
			manifest,
			...!("manifest" in plugin) ? {
				version: manifest.version,
				...manifest.requires ? { requires: manifest.requires } : {},
				...manifest.optional ? { optional: manifest.optional } : {},
				...manifest.permissions ? { permissions: manifest.permissions } : {}
			} : {}
		}), plugin);
	}
	getAsyncInstallationHost() {
		return this;
	}
	async performDispose() {
		const errors = await this.cleanupAll();
		this.hostState = "disposed";
		if (errors.length > 0) throw new require_plugin_identifier.PluginAggregateError("[ImageEditor] Plugin Kernel disposal completed with cleanup errors.", errors);
	}
	async cleanupAll() {
		const errors = [];
		try {
			await this.operationRegistry.suspend(new DOMException("Plugin Kernel disposal aborted active operations.", "AbortError"));
		} catch (error) {
			errors.push(error);
			require_core_capabilities.reportErrorSafely(this.options.errorSink, error);
		}
		const records = [...this.installationOrder].reverse().map((pluginId) => this.installed.get(pluginId)).filter((record) => record !== void 0);
		for (const record of records) {
			if (!record.plugin.onDispose) continue;
			try {
				await record.plugin.onDispose(record.lifecycleContext);
			} catch (error) {
				const lifecycleError = new require_plugin_identifier.PluginLifecycleError(record.plugin.ref.id, "dispose", error);
				errors.push(lifecycleError);
				require_core_capabilities.reportErrorSafely(this.options.errorSink, lifecycleError);
			}
		}
		for (const record of records) {
			try {
				await record.scope.dispose();
			} catch (error) {
				errors.push(error);
				require_core_capabilities.reportErrorSafely(this.options.errorSink, error);
			}
			require_core_capabilities.releasePluginDefinitionLease(record.plugin, this);
		}
		this.installed.clear();
		this.installationOrder.length = 0;
		const kernelDisposables = [
			this.toolCoordinator,
			this.operationRegistry,
			this.eventBus,
			this.capabilityRegistry,
			this.stateStore
		];
		for (const disposable of kernelDisposables) try {
			await disposable.dispose();
		} catch (error) {
			errors.push(error);
			require_core_capabilities.reportErrorSafely(this.options.errorSink, error);
		}
		return errors;
	}
	cleanupAllSync() {
		const errors = [];
		const records = [...this.installationOrder].reverse().map((pluginId) => this.installed.get(pluginId)).filter((record) => record !== void 0);
		for (const record of records) {
			if (!record.plugin.onDispose) continue;
			try {
				const result = record.plugin.onDispose(record.lifecycleContext);
				if (require_core_capabilities.isPromiseLike(result)) {
					Promise.resolve(result).catch((error) => {
						require_core_capabilities.reportErrorSafely(this.options.errorSink, error);
					});
					throw new require_plugin_identifier.PluginLifecycleError(record.plugin.ref.id, "dispose", /* @__PURE__ */ new Error("Synchronous plugin onDispose returned a Promise."));
				}
			} catch (error) {
				const lifecycleError = error instanceof require_plugin_identifier.PluginLifecycleError ? error : new require_plugin_identifier.PluginLifecycleError(record.plugin.ref.id, "dispose", error);
				errors.push(lifecycleError);
				require_core_capabilities.reportErrorSafely(this.options.errorSink, lifecycleError);
			}
		}
		for (const record of records) {
			try {
				record.scope.disposeSync();
			} catch (error) {
				errors.push(error);
				require_core_capabilities.reportErrorSafely(this.options.errorSink, error);
			}
			require_core_capabilities.releasePluginDefinitionLease(record.plugin, this);
		}
		this.installed.clear();
		this.installationOrder.length = 0;
		const cleanup = [
			() => this.toolCoordinator.disposeSync(),
			() => this.operationRegistry.dispose(),
			() => this.eventBus.dispose(),
			() => this.capabilityRegistry.dispose(),
			() => this.stateStore.dispose()
		];
		for (const dispose of cleanup) try {
			dispose();
		} catch (error) {
			errors.push(error);
			require_core_capabilities.reportErrorSafely(this.options.errorSink, error);
		}
		return Object.freeze(errors);
	}
	assertCanInstall() {
		this.assertUsable("install a plugin");
		if (this.hostState !== "created") throw new require_plugin_identifier.PluginKernelStateError("install a plugin", this.hostState);
	}
	canRunOperation(operationId) {
		var _a;
		const activeToolId = this.toolCoordinator.getActiveToolId();
		const operation = this.operationRegistry.get(operationId);
		if (activeToolId && ((_a = operation === null || operation === void 0 ? void 0 : operation.allowedDuringTool) === null || _a === void 0 ? void 0 : _a.includes(activeToolId))) return true;
		return this.toolCoordinator.canRunOperation(operationId);
	}
	operationRejectedByTool(operationId) {
		return new require_plugin_identifier.PluginKernelStateError(`run operation "${operationId}" while the active tool rejects it`, this.hostState);
	}
	assertLifecycleReady(operation) {
		this.assertUsable(operation);
		if (this.hostState !== "initialized") throw new require_plugin_identifier.PluginKernelStateError(operation, this.hostState);
	}
	assertUsable(operation) {
		if (this.hostState === "disposed" || this.hostState === "disposing") throw new require_plugin_identifier.PluginKernelDisposedError(operation);
	}
};

//#endregion
Object.defineProperty(exports, 'PluginManager', {
  enumerable: true,
  get: function () {
    return PluginManager;
  }
});
Object.defineProperty(exports, 'RegistrationScope', {
  enumerable: true,
  get: function () {
    return RegistrationScope;
  }
});
Object.defineProperty(exports, 'sameInstallationDefinition', {
  enumerable: true,
  get: function () {
    return sameInstallationDefinition;
  }
});
//# sourceMappingURL=plugin-manager-FvySGpyT.cjs.map