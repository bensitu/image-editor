'use strict';

var pluginManifest = require('./plugin-manifest-B3zCkHWm.cjs');
var disposable = require('./disposable-Sj4tt6Lk.cjs');
var pluginIdentifier = require('./plugin-identifier-CjVVyVRY.cjs');

function validateProvider(token, implementation, providerPluginId, providerVersion, requiredPermission) {
    var _a, _b;
    if (!pluginManifest.isCapabilityToken(token) || !pluginManifest.isValidSemVer(token.version)) {
        throw new pluginIdentifier.InvalidCapabilityVersionError((_a = token === null || token === void 0 ? void 0 : token.id) !== null && _a !== void 0 ? _a : 'unknown', (_b = token === null || token === void 0 ? void 0 : token.version) !== null && _b !== void 0 ? _b : '', 'version');
    }
    if (!pluginIdentifier.isRuntimeIdentifier(providerPluginId)) {
        throw new pluginIdentifier.InvalidPluginDefinitionError(`Invalid Capability provider Runtime ID for "${token.id}".`, providerPluginId);
    }
    if (!pluginManifest.isValidSemVer(providerVersion)) {
        throw new pluginIdentifier.InvalidCapabilityVersionError(token.id, providerVersion, 'version');
    }
    if (providerVersion !== token.version) {
        throw new pluginIdentifier.CapabilityVersionError({
            capabilityId: token.id,
            expectedRange: token.version,
            actualVersion: providerVersion,
            providerPluginId,
        });
    }
    if (requiredPermission !== undefined && !pluginManifest.isPluginPermission(requiredPermission)) {
        throw new pluginIdentifier.InvalidPluginDefinitionError(`Capability "${token.id}" requires an unsupported Plugin permission.`, providerPluginId);
    }
    if (implementation === null || implementation === undefined) {
        throw new pluginIdentifier.PluginCapabilityError({
            consumerPluginId: providerPluginId,
            capabilityId: token.id,
            requestedRange: token.version,
            installedVersion: token.version,
            providerPluginId,
            reason: 'incomplete',
        });
    }
}
class CapabilityRegistry {
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
            value: new Map()
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
    provideHost(token, implementation, providerPluginId = 'core:host', requiredPermission) {
        if (!pluginManifest.isCapabilityToken(token)) {
            throw new pluginIdentifier.InvalidPluginDefinitionError('Host capability must use createCapabilityToken().');
        }
        return this.provide(token, implementation, providerPluginId, requiredPermission);
    }
    providePending(token, implementation, providerPluginId, transactionId, providerVersion = token.version, requiredPermission) {
        this.assertActive('provide a capability');
        validateProvider(token, implementation, providerPluginId, providerVersion, requiredPermission);
        const existing = this.providers.get(token.id);
        if (existing) {
            const isSameTransaction = existing.providerPluginId === providerPluginId &&
                existing.transactionId === transactionId &&
                existing.version === providerVersion &&
                existing.requiredPermission === requiredPermission &&
                Object.is(existing.implementation, implementation);
            if (isSameTransaction) {
                const noop = disposable.createNoopDisposable();
                return {
                    commit: () => {
                        existing.complete = true;
                    },
                    dispose: () => noop.dispose(),
                };
            }
            throw new pluginIdentifier.CapabilityConflictError(token.id, existing.providerPluginId, providerPluginId);
        }
        const record = {
            token,
            version: providerVersion,
            requiredPermission,
            implementation,
            providerPluginId,
            transactionId,
            complete: false,
        };
        this.providers.set(token.id, record);
        const disposable$1 = disposable.createDisposable(() => {
            if (this.providers.get(token.id) === record)
                this.providers.delete(token.id);
        });
        return {
            commit: () => {
                if (this.providers.get(token.id) === record)
                    record.complete = true;
            },
            dispose: () => disposable$1.dispose(),
        };
    }
    require(requirement, consumerPluginId) {
        const value = this.resolve(requirement, consumerPluginId, false);
        return value;
    }
    optional(requirement, consumerPluginId) {
        const value = this.resolve(requirement, consumerPluginId, true);
        return value;
    }
    requireDefinition(requirement, consumerPluginId, visibleTransactions) {
        return this.resolve(requirement, consumerPluginId, false, visibleTransactions);
    }
    optionalDefinition(requirement, consumerPluginId, visibleTransactions) {
        return this.resolve(requirement, consumerPluginId, true, visibleTransactions);
    }
    getProviderInfo(tokenOrId) {
        this.assertActive('inspect a capability provider');
        const id = typeof tokenOrId === 'string' ? tokenOrId : tokenOrId.id;
        if (!pluginIdentifier.isRuntimeIdentifier(id)) {
            throw new pluginIdentifier.InvalidPluginDefinitionError('Invalid Capability Runtime ID.');
        }
        const record = this.providers.get(id);
        if (!record)
            return null;
        return Object.freeze({
            capabilityId: record.token.id,
            version: record.version,
            providerPluginId: record.providerPluginId,
            requiredPermission: record.requiredPermission,
            complete: record.complete,
        });
    }
    has(tokenOrId) {
        return this.getProviderInfo(tokenOrId) !== null;
    }
    getRequiredPermission(capabilityId, visibleTransactions) {
        this.assertActive('inspect a Capability permission');
        if (!pluginIdentifier.isRuntimeIdentifier(capabilityId)) {
            throw new pluginIdentifier.InvalidPluginDefinitionError('Invalid Capability Runtime ID.');
        }
        const record = this.providers.get(capabilityId);
        if (!record)
            return undefined;
        if (!record.complete && !(visibleTransactions === null || visibleTransactions === void 0 ? void 0 : visibleTransactions.has(record.transactionId)))
            return undefined;
        return record.requiredPermission;
    }
    dispose() {
        if (this.disposed)
            return;
        this.providers.clear();
        this.disposed = true;
    }
    resolve(requirement, consumerPluginId, optional, visibleTransactions) {
        var _a, _b, _c;
        this.assertActive('resolve a capability');
        if (!pluginIdentifier.isRuntimeIdentifier(consumerPluginId)) {
            throw new pluginIdentifier.InvalidPluginDefinitionError('Invalid Capability consumer Runtime ID.', consumerPluginId);
        }
        try {
            pluginManifest.assertCapabilityRequirement(requirement);
        }
        catch (error) {
            throw new pluginIdentifier.PluginCapabilityError({
                consumerPluginId,
                capabilityId: (_b = (_a = requirement === null || requirement === void 0 ? void 0 : requirement.token) === null || _a === void 0 ? void 0 : _a.id) !== null && _b !== void 0 ? _b : 'unknown',
                requestedRange: (_c = requirement === null || requirement === void 0 ? void 0 : requirement.range) !== null && _c !== void 0 ? _c : '',
                reason: 'invalid-range',
                cause: error,
            });
        }
        const record = this.providers.get(requirement.token.id);
        if (!record) {
            if (optional)
                return null;
            throw new pluginIdentifier.CapabilityMissingError({
                consumerPluginId,
                capabilityId: requirement.token.id,
                requestedRange: requirement.range,
                availableProviders: this.describeProviders(),
            });
        }
        if (!record.complete && !(visibleTransactions === null || visibleTransactions === void 0 ? void 0 : visibleTransactions.has(record.transactionId))) {
            if (optional)
                return null;
            throw new pluginIdentifier.PluginCapabilityError({
                consumerPluginId,
                capabilityId: requirement.token.id,
                requestedRange: requirement.range,
                installedVersion: record.version,
                providerPluginId: record.providerPluginId,
                reason: 'incomplete',
            });
        }
        if (!pluginManifest.satisfiesSemVer(record.version, requirement.range)) {
            if (!optional) {
                throw new pluginIdentifier.CapabilityVersionError({
                    capabilityId: requirement.token.id,
                    expectedRange: requirement.range,
                    actualVersion: record.version,
                    providerPluginId: record.providerPluginId,
                    consumerPluginId,
                });
            }
            disposable.reportWarningSafely(this.options.warningSink, this.options.errorSink, {
                code: 'OPTIONAL_CAPABILITY_INCOMPATIBLE',
                message: `Optional integration "${requirement.token.id}" was disabled for plugin "${consumerPluginId}" because installed version "${record.version}" does not satisfy "${requirement.range}".`,
                pluginId: consumerPluginId,
                details: {
                    capabilityId: requirement.token.id,
                    requestedRange: requirement.range,
                    installedVersion: record.version,
                    providerPluginId: record.providerPluginId,
                    optionalIntegrationDisabled: true,
                },
            });
            return null;
        }
        return record.implementation;
    }
    describeProviders() {
        return Object.freeze([...this.providers.values()]
            .filter((record) => record.complete)
            .map((record) => `${record.token.id}@${record.version} (${record.providerPluginId})`)
            .sort());
    }
    assertActive(operation) {
        if (this.disposed)
            throw new pluginIdentifier.PluginKernelDisposedError(operation);
    }
}

class CommittedEventBus {
    constructor(options = {}) {
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
            value: new Map()
        });
        Object.defineProperty(this, "disposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
    }
    on(eventName, listener) {
        this.assertActive('register a committed event listener');
        this.assertEventName(eventName);
        let eventListeners = this.listeners.get(eventName);
        if (!eventListeners) {
            eventListeners = [];
            this.listeners.set(eventName, eventListeners);
        }
        const erasedListener = listener;
        eventListeners.push(erasedListener);
        return disposable.createDisposable(() => {
            const current = this.listeners.get(eventName);
            if (!current)
                return;
            const index = current.indexOf(erasedListener);
            if (index >= 0)
                current.splice(index, 1);
            if (current.length === 0)
                this.listeners.delete(eventName);
        });
    }
    async emitCommitted(eventName, payload) {
        var _a, _b;
        this.assertActive('emit a committed event');
        this.assertEventName(eventName);
        const snapshot = [...((_a = this.listeners.get(eventName)) !== null && _a !== void 0 ? _a : [])];
        for (let index = 0; index < snapshot.length; index += 1) {
            try {
                await ((_b = snapshot[index]) === null || _b === void 0 ? void 0 : _b.call(snapshot, payload));
            }
            catch (error) {
                disposable.reportWarningSafely(this.options.warningSink, this.options.errorSink, {
                    code: 'COMMITTED_EVENT_LISTENER_FAILED',
                    message: `Committed event listener ${index} for "${eventName}" failed; remaining listeners continued.`,
                    cause: error,
                    details: { eventName, listenerIndex: index },
                });
            }
        }
    }
    listenerCount(eventName) {
        var _a, _b;
        this.assertActive('inspect committed event listeners');
        if (eventName) {
            this.assertEventName(eventName);
            return (_b = (_a = this.listeners.get(eventName)) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : 0;
        }
        let count = 0;
        for (const listeners of this.listeners.values())
            count += listeners.length;
        return count;
    }
    dispose() {
        if (this.disposed)
            return;
        this.listeners.clear();
        this.disposed = true;
    }
    assertActive(operation) {
        if (this.disposed)
            throw new pluginIdentifier.PluginKernelDisposedError(operation);
    }
    assertEventName(eventName) {
        if (!pluginIdentifier.isRuntimeIdentifier(eventName)) {
            throw new pluginIdentifier.InvalidPluginDefinitionError('Invalid committed event Runtime ID.');
        }
    }
}

const OPERATION_MODES = ['read', 'busy', 'animation', 'mutation'];
const REENTRANCY_POLICIES = [
    'reject',
    'queue',
    'replace',
    'coalesce',
];
const CONFLICT_DOMAINS = [
    'document',
    'base-image',
    'geometry',
    'raster',
    'overlay',
    'selection',
    'tool',
    'export',
    'state',
    'image-decode',
];
function abortError(message) {
    return new DOMException(message, 'AbortError');
}
function abortReason(signal, fallback) {
    var _a;
    return (_a = signal.reason) !== null && _a !== void 0 ? _a : abortError(fallback);
}
function domainsOverlap(first, second) {
    return first.some((domain) => second.includes(domain));
}
function definitionsConflict(first, second) {
    if (first.mode === 'read' && second.mode === 'read')
        return false;
    return domainsOverlap(first.conflictDomains, second.conflictDomains);
}
class OperationRegistry {
    constructor() {
        Object.defineProperty(this, "operations", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "activeOperations", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Set()
        });
        Object.defineProperty(this, "executingRequests", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Set()
        });
        Object.defineProperty(this, "idleWaiters", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Set()
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
        this.assertActive('register an operation');
        this.validateDefinition(definition, ownerPluginId);
        const existing = this.operations.get(definition.id);
        if (existing) {
            throw new pluginIdentifier.OperationRegistrationError(`Operation "${definition.id}" is already registered by "${existing.ownerPluginId}".`, ownerPluginId);
        }
        const frozenDefinition = Object.freeze({
            ...definition,
            conflictDomains: Object.freeze([...definition.conflictDomains]),
            allowedDuringTool: definition.allowedDuringTool
                ? Object.freeze([...definition.allowedDuringTool])
                : undefined,
        });
        const record = { definition: frozenDefinition, ownerPluginId };
        this.operations.set(definition.id, record);
        return disposable.createDisposable(() => {
            if (this.operations.get(definition.id) !== record)
                return;
            const reason = abortError(`Operation "${definition.id}" was unregistered.`);
            for (const active of [...this.activeOperations]) {
                if (active.record === record)
                    this.retireActive(active, reason);
            }
            this.rejectPending((request) => request.record === record, reason);
            this.operations.delete(definition.id);
            this.drainPending();
        });
    }
    begin(operationId, ownerPluginId) {
        this.assertActive('begin an operation');
        if (this.suspendedReason !== null)
            throw this.suspendedReason;
        const record = this.requireOwned(operationId, ownerPluginId);
        const conflicts = this.findConflicts(record, undefined);
        if (conflicts.length > 0) {
            throw this.conflictError(record, conflicts[0].record, ownerPluginId);
        }
        const active = this.createActive(record, undefined, null);
        this.activeOperations.add(active);
        return active.token;
    }
    run(operationId, ownerPluginId, args, task, options = {}) {
        var _a;
        this.assertActive('run an operation');
        if (this.suspendedReason !== null)
            return Promise.reject(this.suspendedReason);
        const record = this.requireOwned(operationId, ownerPluginId);
        this.validateParent(options.parent);
        if ((_a = options.signal) === null || _a === void 0 ? void 0 : _a.aborted) {
            return Promise.reject(abortReason(options.signal, `Operation "${operationId}" was aborted.`));
        }
        const existingPending = this.findCoalesciblePending(record, options.parent);
        if (record.definition.reentrancy === 'coalesce' && existingPending) {
            const coalesce = record.definition.coalesce;
            if (!coalesce) {
                return Promise.reject(new pluginIdentifier.OperationRegistrationError(`Operation "${operationId}" has no coalesce function.`, ownerPluginId));
            }
            existingPending.args = coalesce(existingPending.args, args);
            return new Promise((resolve, reject) => {
                existingPending.waiters.push({ resolve, reject });
            });
        }
        const request = {
            record,
            args,
            task,
            options,
            waiters: [],
            active: null,
            state: 'pending',
            removeExternalAbortListener: null,
        };
        const result = new Promise((resolve, reject) => {
            request.waiters.push({ resolve, reject });
        });
        this.attachExternalAbort(request);
        this.schedule(request);
        return result;
    }
    beginForHost(operationId) {
        this.assertActive('begin an operation');
        const registered = this.requireRegistered(operationId, 'core:host');
        return this.begin(operationId, registered.ownerPluginId);
    }
    runForHost(operationId, args, task, options = {}) {
        const registered = this.requireRegistered(operationId, 'core:host');
        return this.run(operationId, registered.ownerPluginId, args, task, options);
    }
    has(operationId) {
        this.assertActive('inspect an operation');
        return this.operations.has(operationId);
    }
    get(operationId) {
        var _a, _b;
        this.assertActive('inspect an operation');
        return (_b = (_a = this.operations.get(operationId)) === null || _a === void 0 ? void 0 : _a.definition) !== null && _b !== void 0 ? _b : null;
    }
    isActive(operationId) {
        this.assertActive('inspect operation state');
        if (!operationId)
            return this.activeOperations.size > 0;
        return [...this.activeOperations].some((active) => active.record.definition.id === operationId);
    }
    waitForIdle() {
        if (this.isIdle())
            return Promise.resolve();
        return new Promise((resolve) => this.idleWaiters.add(resolve));
    }
    async abortAll(reason = abortError('All Plugin Kernel operations were aborted.')) {
        this.assertActive('abort operations');
        this.rejectPending(() => true, reason);
        for (const active of [...this.activeOperations]) {
            if (active.request)
                this.abortActive(active, reason);
            else
                this.retireActive(active, reason);
        }
        await Promise.allSettled([...this.executingRequests]);
        this.resolveIdleWaiters();
    }
    suspend(reason) {
        this.assertActive('suspend operations');
        this.suspendedReason = reason;
        return this.abortAll(reason);
    }
    dispose() {
        if (this.disposed)
            return;
        const reason = abortError('Operation Registry was disposed.');
        this.rejectPending(() => true, reason);
        for (const active of [...this.activeOperations])
            this.retireActive(active, reason);
        this.operations.clear();
        this.suspendedReason = null;
        this.disposed = true;
        this.resolveIdleWaiters();
    }
    schedule(request) {
        var _a, _b;
        if (request.state !== 'pending')
            return;
        const conflicts = this.findConflicts(request.record, request.options.parent);
        const sameOperationActive = conflicts.filter((active) => active.record.definition.id === request.record.definition.id);
        const policy = request.record.definition.reentrancy;
        if (policy === 'replace' && sameOperationActive.length > 0) {
            const reason = abortError(`Operation "${request.record.definition.id}" was replaced by a newer request.`);
            for (const active of sameOperationActive)
                this.retireActive(active, reason);
            this.rejectPending((pending) => pending.record === request.record, reason);
        }
        else if (conflicts.length > 0 && policy === 'reject') {
            this.rejectRequest(request, this.conflictError(request.record, conflicts[0].record, request.record.ownerPluginId));
            (_a = request.removeExternalAbortListener) === null || _a === void 0 ? void 0 : _a.call(request);
            request.removeExternalAbortListener = null;
            request.state = 'settled';
            this.resolveIdleWaiters();
            return;
        }
        else if (conflicts.length > 0 && policy === 'replace') {
            this.rejectRequest(request, this.conflictError(request.record, conflicts[0].record, request.record.ownerPluginId));
            (_b = request.removeExternalAbortListener) === null || _b === void 0 ? void 0 : _b.call(request);
            request.removeExternalAbortListener = null;
            request.state = 'settled';
            this.resolveIdleWaiters();
            return;
        }
        if (this.findConflicts(request.record, request.options.parent).length === 0) {
            this.startRequest(request);
        }
        else {
            this.pendingRequests.push(request);
        }
    }
    startRequest(request) {
        if (request.state !== 'pending')
            return;
        const active = this.createActive(request.record, request.options.parent, request);
        request.active = active;
        request.state = 'active';
        this.activeOperations.add(active);
        const context = Object.freeze({
            signal: active.controller.signal,
            token: active.token,
            topLevel: active.token.topLevel,
            ownsHistory: active.token.ownsHistory,
        });
        let output;
        try {
            output = request.task(request.args, context);
        }
        catch (error) {
            output = Promise.reject(error);
        }
        const execution = Promise.resolve(output).then((value) => ({ status: 'fulfilled', value }), (error) => ({ status: 'rejected', error }));
        const tracked = execution
            .then((outcome) => {
            this.finishRequest(request);
            if (outcome.status === 'rejected') {
                this.rejectRequest(request, outcome.error);
            }
            else if (active.controller.signal.aborted) {
                this.rejectRequest(request, abortReason(active.controller.signal, `Operation "${active.token.id}" was aborted.`));
            }
            else {
                this.resolveRequest(request, outcome.value);
            }
        })
            .finally(() => {
            this.executingRequests.delete(tracked);
            this.resolveIdleWaiters();
        });
        this.executingRequests.add(tracked);
        void tracked.catch(() => undefined);
    }
    finishRequest(request) {
        var _a;
        const active = request.active;
        if (active) {
            this.activeOperations.delete(active);
            active.deactivate();
        }
        (_a = request.removeExternalAbortListener) === null || _a === void 0 ? void 0 : _a.call(request);
        request.removeExternalAbortListener = null;
        request.state = 'settled';
        this.drainPending();
        this.resolveIdleWaiters();
    }
    drainPending() {
        if (this.disposed)
            return;
        let started = true;
        while (started) {
            started = false;
            for (let index = 0; index < this.pendingRequests.length; index += 1) {
                const request = this.pendingRequests[index];
                if (this.findConflicts(request.record, request.options.parent).length > 0)
                    continue;
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
        const token = Object.freeze({
            id: record.definition.id,
            ownerPluginId: record.ownerPluginId,
            parentId: (_a = parent === null || parent === void 0 ? void 0 : parent.id) !== null && _a !== void 0 ? _a : null,
            topLevel: parent === undefined,
            ownsHistory: parent === undefined,
            signal: controller.signal,
            get active() {
                return active;
            },
            dispose: () => {
                const entry = activeReference.current;
                if (!active || !entry)
                    return;
                this.retireActive(entry, abortError(`Operation "${record.definition.id}" was cancelled.`));
                this.drainPending();
                this.resolveIdleWaiters();
            },
        });
        const entry = {
            record,
            controller,
            token,
            deactivate: () => {
                active = false;
            },
            request,
        };
        activeReference.current = entry;
        return entry;
    }
    retireActive(active, reason) {
        if (!active.token.active)
            return;
        this.activeOperations.delete(active);
        active.deactivate();
        active.controller.abort(reason);
        if (active.request && active.request.state === 'active') {
            active.request.state = 'retired';
        }
    }
    abortActive(active, reason) {
        if (!active.token.active || active.controller.signal.aborted)
            return;
        active.controller.abort(reason);
    }
    findConflicts(record, parent) {
        return [...this.activeOperations].filter((active) => {
            if (parent && active.token === parent)
                return false;
            return definitionsConflict(record.definition, active.record.definition);
        });
    }
    findCoalesciblePending(record, parent) {
        return this.pendingRequests.find((request) => request.record === record && request.options.parent === parent);
    }
    attachExternalAbort(request) {
        var _a;
        const signals = [
            ...new Set([request.options.signal, (_a = request.options.parent) === null || _a === void 0 ? void 0 : _a.signal]),
        ].filter((signal) => signal !== undefined);
        if (signals.length === 0)
            return;
        const abort = () => {
            const signal = signals.find((candidate) => candidate.aborted);
            const reason = signal
                ? abortReason(signal, `Operation "${request.record.definition.id}" was aborted.`)
                : abortError(`Operation "${request.record.definition.id}" was aborted.`);
            if (request.state === 'pending') {
                this.pendingRequests = this.pendingRequests.filter((entry) => entry !== request);
                this.rejectRequest(request, reason);
                request.state = 'settled';
            }
            else if (request.active) {
                this.abortActive(request.active, reason);
            }
            this.drainPending();
            this.resolveIdleWaiters();
        };
        for (const signal of signals)
            signal.addEventListener('abort', abort, { once: true });
        request.removeExternalAbortListener = () => {
            for (const signal of signals)
                signal.removeEventListener('abort', abort);
        };
        if (signals.some((signal) => signal.aborted))
            abort();
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
            (_a = request.removeExternalAbortListener) === null || _a === void 0 ? void 0 : _a.call(request);
            request.state = 'settled';
        }
        this.pendingRequests = retained;
        this.resolveIdleWaiters();
    }
    resolveRequest(request, value) {
        for (const waiter of request.waiters)
            waiter.resolve(value);
        request.waiters.length = 0;
    }
    rejectRequest(request, error) {
        for (const waiter of request.waiters)
            waiter.reject(error);
        request.waiters.length = 0;
    }
    requireRegistered(operationId, ownerPluginId) {
        this.assertActive('access an operation');
        const registered = this.operations.get(operationId);
        if (!registered) {
            throw new pluginIdentifier.OperationConflictError(`Operation "${operationId}" is not registered.`, ownerPluginId);
        }
        return registered;
    }
    requireOwned(operationId, ownerPluginId) {
        const registered = this.requireRegistered(operationId, ownerPluginId);
        if (registered.ownerPluginId !== ownerPluginId) {
            throw new pluginIdentifier.OperationConflictError(`Operation "${operationId}" belongs to "${registered.ownerPluginId}", not "${ownerPluginId}".`, ownerPluginId);
        }
        return registered;
    }
    validateParent(parent) {
        if (!parent)
            return;
        if (!parent.active ||
            parent.signal.aborted ||
            ![...this.activeOperations].some((active) => active.token === parent)) {
            throw new pluginIdentifier.OperationConflictError(`Parent operation "${parent.id}" is not active.`, parent.ownerPluginId);
        }
    }
    validateDefinition(definition, ownerPluginId) {
        if (!pluginIdentifier.isRuntimeIdentifier(ownerPluginId)) {
            throw new pluginIdentifier.OperationRegistrationError('Invalid Operation owner Runtime ID.', ownerPluginId);
        }
        if (!pluginIdentifier.isRuntimeIdentifier(definition.id)) {
            throw new pluginIdentifier.OperationRegistrationError('Invalid Operation Runtime ID.', ownerPluginId);
        }
        if (!OPERATION_MODES.includes(definition.mode)) {
            throw new pluginIdentifier.OperationRegistrationError(`Operation "${definition.id}" has invalid mode "${definition.mode}".`, ownerPluginId);
        }
        if (!REENTRANCY_POLICIES.includes(definition.reentrancy)) {
            throw new pluginIdentifier.OperationRegistrationError(`Operation "${definition.id}" has invalid reentrancy policy.`, ownerPluginId);
        }
        if (!Array.isArray(definition.conflictDomains) ||
            definition.conflictDomains.length === 0 ||
            definition.conflictDomains.some((domain) => !CONFLICT_DOMAINS.includes(domain)) ||
            new Set(definition.conflictDomains).size !== definition.conflictDomains.length) {
            throw new pluginIdentifier.OperationRegistrationError(`Operation "${definition.id}" has invalid conflict domains.`, ownerPluginId);
        }
        if (definition.reentrancy === 'coalesce' && typeof definition.coalesce !== 'function') {
            throw new pluginIdentifier.OperationRegistrationError(`Operation "${definition.id}" must define coalesce().`, ownerPluginId);
        }
        if (definition.allowedDuringTool !== undefined &&
            (!Array.isArray(definition.allowedDuringTool) ||
                definition.allowedDuringTool.some((toolId) => !pluginIdentifier.isRuntimeIdentifier(toolId)) ||
                new Set(definition.allowedDuringTool).size !== definition.allowedDuringTool.length)) {
            throw new pluginIdentifier.OperationRegistrationError(`Operation "${definition.id}" has invalid allowed Tool ids.`, ownerPluginId);
        }
    }
    conflictError(requested, active, ownerPluginId) {
        return new pluginIdentifier.OperationConflictError(`Operation "${requested.definition.id}" conflicts with active operation "${active.definition.id}" in domain(s) ${requested.definition.conflictDomains
            .filter((domain) => active.definition.conflictDomains.includes(domain))
            .join(', ')}.`, ownerPluginId);
    }
    isIdle() {
        return (this.activeOperations.size === 0 &&
            this.pendingRequests.length === 0 &&
            this.executingRequests.size === 0);
    }
    resolveIdleWaiters() {
        if (!this.isIdle())
            return;
        for (const resolve of this.idleWaiters)
            resolve();
        this.idleWaiters.clear();
    }
    assertActive(operation) {
        if (this.disposed)
            throw new pluginIdentifier.PluginKernelDisposedError(operation);
    }
}

function assertStateKey(key) {
    if (key.trim().length === 0 || key.trim() !== key) {
        throw new pluginIdentifier.InvalidPluginDefinitionError('Plugin state keys must be non-empty trimmed strings.');
    }
}
class PluginStateStore {
    constructor() {
        Object.defineProperty(this, "stateByPlugin", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "activePluginIds", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Set()
        });
        Object.defineProperty(this, "disposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
    }
    createScoped(pluginId, registerCleanup, registerFinalizer, isScopeActive) {
        this.assertActive('create plugin state');
        pluginIdentifier.assertPluginIdentifier(pluginId, 'Plugin state owner id');
        if (this.activePluginIds.has(pluginId)) {
            throw new pluginIdentifier.InvalidPluginDefinitionError(`Plugin state scope "${pluginId}" is already active.`, pluginId);
        }
        this.activePluginIds.add(pluginId);
        let active = true;
        let cleanupRegistered = false;
        const cleanup = disposable.createDisposable(() => {
            this.stateByPlugin.delete(pluginId);
        });
        try {
            registerFinalizer(disposable.createDisposable(() => {
                this.stateByPlugin.delete(pluginId);
                this.activePluginIds.delete(pluginId);
                active = false;
            }));
        }
        catch (error) {
            this.activePluginIds.delete(pluginId);
            throw error;
        }
        const assertScopedActive = () => {
            this.assertActive('access plugin state');
            if (!active || !isScopeActive()) {
                throw new pluginIdentifier.PluginKernelDisposedError(`access state for plugin "${pluginId}"`);
            }
        };
        const activate = () => {
            assertScopedActive();
            if (!cleanupRegistered) {
                registerCleanup(cleanup);
                cleanupRegistered = true;
            }
            let namespace = this.stateByPlugin.get(pluginId);
            if (!namespace) {
                namespace = new Map();
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
                (_a = this.stateByPlugin.get(pluginId)) === null || _a === void 0 ? void 0 : _a.clear();
            },
        });
    }
    hasPluginState(pluginId) {
        this.assertActive('inspect plugin state');
        return this.stateByPlugin.has(pluginId);
    }
    dispose() {
        if (this.disposed)
            return;
        this.stateByPlugin.clear();
        this.activePluginIds.clear();
        this.disposed = true;
    }
    assertActive(operation) {
        if (this.disposed)
            throw new pluginIdentifier.PluginKernelDisposedError(operation);
    }
}

class RegistrationScope {
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
            value: 'open'
        });
        pluginIdentifier.assertPluginIdentifier(pluginId, 'RegistrationScope Plugin id');
        this.transactionId = Symbol(`plugin-install:${pluginId}`);
    }
    get active() {
        return this.state !== 'disposed';
    }
    assertOpen(operation = 'register installation resources') {
        if (this.state !== 'open') {
            throw new pluginIdentifier.PluginKernelStateError(operation, `registration-scope:${this.state}`);
        }
    }
    add(disposable) {
        this.assertOpen();
        this.entries.push({ disposable, rollbackOnly: false });
        return disposable;
    }
    addRollback(disposable) {
        this.assertOpen();
        this.entries.push({ disposable, rollbackOnly: true });
        return disposable;
    }
    addFinalizer(disposable) {
        this.assertOpen();
        this.finalizers.push(disposable);
        return disposable;
    }
    addCleanup(cleanup) {
        return this.add(disposable.createDisposable(cleanup));
    }
    commit() {
        var _a;
        this.assertOpen('commit plugin installation');
        for (const entry of this.entries) {
            if (!entry.rollbackOnly && 'commit' in entry.disposable) {
                entry.disposable.commit();
            }
        }
        for (let index = this.entries.length - 1; index >= 0; index -= 1) {
            if ((_a = this.entries[index]) === null || _a === void 0 ? void 0 : _a.rollbackOnly)
                this.entries.splice(index, 1);
        }
        this.state = 'committed';
    }
    async rollback() {
        if (this.state === 'disposed')
            return [];
        const errors = [
            ...(await disposable.disposeInReverse(this.entries.map((entry) => entry.disposable), { pluginId: this.pluginId, ...this.options })),
            ...(await disposable.disposeInReverse(this.finalizers, {
                pluginId: this.pluginId,
                ...this.options,
            })),
        ];
        this.entries.length = 0;
        this.finalizers.length = 0;
        this.state = 'disposed';
        return errors;
    }
    rollbackSync() {
        if (this.state === 'disposed')
            return Object.freeze([]);
        const errors = [
            ...disposable.disposeInReverseSync(this.entries.map((entry) => entry.disposable), { pluginId: this.pluginId, ...this.options }),
            ...disposable.disposeInReverseSync(this.finalizers, {
                pluginId: this.pluginId,
                ...this.options,
            }),
        ];
        this.entries.length = 0;
        this.finalizers.length = 0;
        this.state = 'disposed';
        return Object.freeze(errors);
    }
    async dispose() {
        if (this.state === 'disposed')
            return;
        const errors = [
            ...(await disposable.disposeInReverse(this.entries.map((entry) => entry.disposable), { pluginId: this.pluginId, ...this.options })),
            ...(await disposable.disposeInReverse(this.finalizers, {
                pluginId: this.pluginId,
                ...this.options,
            })),
        ];
        this.entries.length = 0;
        this.finalizers.length = 0;
        this.state = 'disposed';
        if (errors.length > 0) {
            throw new pluginIdentifier.PluginAggregateError(`[ImageEditor] Plugin "${this.pluginId}" cleanup failed.`, errors, { pluginId: this.pluginId });
        }
    }
    disposeSync() {
        if (this.state === 'disposed')
            return;
        const errors = this.rollbackSync();
        if (errors.length > 0) {
            throw new pluginIdentifier.PluginAggregateError(`[ImageEditor] Plugin "${this.pluginId}" synchronous cleanup failed.`, errors, { pluginId: this.pluginId });
        }
    }
}

class ToolCoordinator {
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
            value: new Map()
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
        Object.defineProperty(this, "disposed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
    }
    register(definition, ownerPluginId) {
        this.assertActive('register a tool');
        if (!pluginIdentifier.isRuntimeIdentifier(ownerPluginId)) {
            throw new pluginIdentifier.ToolRegistrationError('Invalid Tool owner Runtime ID.', ownerPluginId);
        }
        if (!pluginIdentifier.isRuntimeIdentifier(definition.id)) {
            throw new pluginIdentifier.ToolRegistrationError('Invalid Tool Runtime ID.', ownerPluginId);
        }
        const existing = this.tools.get(definition.id);
        if (existing) {
            throw new pluginIdentifier.ToolRegistrationError(`Tool "${definition.id}" is already registered by "${existing.ownerPluginId}".`, ownerPluginId);
        }
        const record = {
            definition,
            ownerPluginId,
            context: Object.freeze({ toolId: definition.id, ownerPluginId }),
        };
        this.tools.set(definition.id, record);
        return disposable.createDisposable(() => {
            if (this.active === record) {
                return this.exitCurrent('plugin-dispose').finally(() => {
                    if (this.tools.get(definition.id) === record)
                        this.tools.delete(definition.id);
                });
            }
            if (this.tools.get(definition.id) === record)
                this.tools.delete(definition.id);
            return undefined;
        });
    }
    disposeSync() {
        if (this.disposed)
            return;
        let exitError;
        try {
            const current = this.active;
            this.active = null;
            if (current) {
                const result = current.definition.exit('host-dispose', current.context);
                if (disposable.isPromiseLike(result)) {
                    void Promise.resolve(result).catch((error) => {
                        disposable.reportErrorSafely(this.options.errorSink, error);
                    });
                    throw new pluginIdentifier.ToolTransitionError(current.definition.id, 'returned a Promise during synchronous host disposal', current.ownerPluginId);
                }
            }
        }
        catch (error) {
            exitError = error;
        }
        finally {
            this.active = null;
            this.tools.clear();
            this.disposed = true;
        }
        if (exitError)
            throw exitError;
    }
    async enter(toolId, requesterPluginId) {
        this.assertActive('enter a tool');
        const next = this.tools.get(toolId);
        if (!next)
            throw new pluginIdentifier.ToolTransitionError(toolId, 'is not registered', requesterPluginId);
        if (requesterPluginId && requesterPluginId !== next.ownerPluginId) {
            throw new pluginIdentifier.ToolTransitionError(toolId, `belongs to "${next.ownerPluginId}", not "${requesterPluginId}"`, requesterPluginId);
        }
        if (this.active === next)
            return;
        await this.runTransition(toolId, async () => {
            if (this.active)
                await this.exitCurrent('switch');
            try {
                await next.definition.enter(next.context);
                this.active = next;
            }
            catch (error) {
                this.active = null;
                const transitionError = new pluginIdentifier.ToolTransitionError(toolId, 'failed to enter', next.ownerPluginId, error);
                disposable.reportErrorSafely(this.options.errorSink, transitionError);
                throw transitionError;
            }
        });
    }
    async exit(reason = 'requested') {
        this.assertActive('exit a tool');
        if (!this.active)
            return;
        await this.runTransition(this.active.definition.id, () => this.exitCurrent(reason));
    }
    getActiveToolId() {
        var _a, _b;
        this.assertActive('inspect active tool state');
        return (_b = (_a = this.active) === null || _a === void 0 ? void 0 : _a.definition.id) !== null && _b !== void 0 ? _b : null;
    }
    canRunOperation(operationId) {
        var _a;
        this.assertActive('check tool operation policy');
        if (!((_a = this.active) === null || _a === void 0 ? void 0 : _a.definition.canRunOperation))
            return true;
        try {
            return this.active.definition.canRunOperation(operationId);
        }
        catch (error) {
            const transitionError = new pluginIdentifier.ToolTransitionError(this.active.definition.id, `operation policy failed for "${operationId}"`, this.active.ownerPluginId, error);
            disposable.reportErrorSafely(this.options.errorSink, transitionError);
            return false;
        }
    }
    async dispose() {
        if (this.disposed)
            return;
        let exitError;
        try {
            if (this.active)
                await this.exitCurrent('host-dispose');
        }
        catch (error) {
            exitError = error;
        }
        finally {
            this.active = null;
            this.tools.clear();
            this.disposed = true;
        }
        if (exitError)
            throw exitError;
    }
    async exitCurrent(reason) {
        const current = this.active;
        if (!current)
            return;
        this.active = null;
        try {
            await current.definition.exit(reason, current.context);
        }
        catch (error) {
            const transitionError = new pluginIdentifier.ToolTransitionError(current.definition.id, `failed to exit for reason "${reason}"`, current.ownerPluginId, error);
            disposable.reportErrorSafely(this.options.errorSink, transitionError);
            throw transitionError;
        }
    }
    async runTransition(toolId, task) {
        if (this.transitioning) {
            throw new pluginIdentifier.ToolTransitionError(toolId, 'cannot transition while another transition is active');
        }
        this.transitioning = true;
        try {
            await task();
        }
        finally {
            this.transitioning = false;
        }
    }
    assertActive(operation) {
        if (this.disposed)
            throw new pluginIdentifier.PluginKernelDisposedError(operation);
    }
}

function isPluginApi(value) {
    return (typeof value === 'object' && value !== null) || typeof value === 'function';
}
function sameArray(left, right, equal) {
    if (left === undefined || right === undefined)
        return left === right;
    return (left.length === right.length &&
        left.every((leftValue, index) => equal(leftValue, right[index])));
}
function sameInstallationDefinition(left, right) {
    return (left.ref === right.ref &&
        left.manifest.id === right.manifest.id &&
        left.manifest.version === right.manifest.version &&
        left.manifest.apiVersion === right.manifest.apiVersion &&
        left.manifest.engine === right.manifest.engine &&
        sameArray(left.manifest.requiresPlugins, right.manifest.requiresPlugins, (leftRef, rightRef) => leftRef === rightRef) &&
        sameArray(left.manifest.requires, right.manifest.requires, (leftRequirement, rightRequirement) => leftRequirement.token === rightRequirement.token &&
            leftRequirement.range === rightRequirement.range) &&
        sameArray(left.manifest.optional, right.manifest.optional, (leftRequirement, rightRequirement) => leftRequirement.token === rightRequirement.token &&
            leftRequirement.range === rightRequirement.range) &&
        sameArray(left.manifest.permissions, right.manifest.permissions, (leftPermission, rightPermission) => leftPermission === rightPermission) &&
        left.setupMode === right.setupMode &&
        left.setup === right.setup &&
        left.onInit === right.onInit &&
        left.onImageLoaded === right.onImageLoaded &&
        left.onImageCleared === right.onImageCleared &&
        left.onDispose === right.onDispose);
}
const pluginPackageHints = new Map([
    ['foundation:overlay', '@bensitu/image-editor/plugins/overlay'],
    ['plugin:transform', '@bensitu/image-editor/plugins/transform'],
    ['plugin:mask', '@bensitu/image-editor/plugins/mask'],
    ['plugin:history', '@bensitu/image-editor/plugins/history'],
    ['plugin:filters', '@bensitu/image-editor/plugins/filters'],
]);
class PluginManager {
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
            value: new Map()
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
            value: 'created'
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
        this.toolCoordinator = new ToolCoordinator({ errorSink: options.errorSink });
        this.eventBus = new CommittedEventBus(options);
        for (const provider of (_a = options.hostCapabilities) !== null && _a !== void 0 ? _a : []) {
            this.capabilityRegistry.provideHost(provider.token, provider.implementation, provider.providerId, provider.requiredPermission);
        }
    }
    get state() {
        return this.hostState;
    }
    async install(plugin) {
        this.assertCanInstall();
        if (this.topLevelInstallActive) {
            throw new pluginIdentifier.PluginKernelStateError('start a concurrent plugin installation', this.hostState);
        }
        this.topLevelInstallActive = true;
        try {
            const outcome = await this.performInstall(plugin, 'strict', []);
            return outcome.api;
        }
        finally {
            this.topLevelInstallActive = false;
        }
    }
    installSync(plugin) {
        this.assertCanInstall();
        if (this.topLevelInstallActive) {
            throw new pluginIdentifier.PluginKernelStateError('start a concurrent plugin installation', this.hostState);
        }
        this.topLevelInstallActive = true;
        try {
            const outcome = this.performInstallSync(plugin, 'strict', []);
            return outcome.api;
        }
        finally {
            this.topLevelInstallActive = false;
        }
    }
    installBatchSync(plugins) {
        this.assertCanInstall();
        if (this.topLevelInstallActive) {
            throw new pluginIdentifier.PluginKernelStateError('start a concurrent plugin installation', this.hostState);
        }
        this.topLevelInstallActive = true;
        try {
            const prepared = this.prepareBatch(plugins);
            const visibleTransactions = new Set();
            const pendingRecords = [];
            try {
                for (const entry of prepared.ordered) {
                    const record = this.performPendingInstallSync(entry.plugin, visibleTransactions);
                    pendingRecords.push(record);
                    prepared.apisByPluginId.set(entry.plugin.ref.id, record.api);
                }
                for (const record of pendingRecords)
                    record.scope.commit();
                for (const record of pendingRecords) {
                    const pluginId = record.plugin.ref.id;
                    this.installed.set(pluginId, record);
                    this.installationOrder.push(pluginId);
                }
            }
            catch (cause) {
                const cleanupErrors = [
                    ...(cause instanceof pluginIdentifier.PluginSetupError ? cause.cleanupErrors : []),
                    ...this.rollbackPendingBatchSync(pendingRecords),
                ];
                throw new pluginIdentifier.PluginBatchInstallError(cause, cleanupErrors);
            }
            return Object.freeze({
                apisByPluginId: prepared.apisByPluginId,
                installedPlugins: Object.freeze(pendingRecords.map((record) => record.plugin)),
            });
        }
        finally {
            this.topLevelInstallActive = false;
        }
    }
    get(ref) {
        this.assertUsable('query a plugin');
        const record = this.installed.get(ref.id);
        if (!record || record.refObject !== ref)
            return null;
        return record.api;
    }
    require(ref) {
        const api = this.get(ref);
        if (api === null)
            throw new pluginIdentifier.PluginNotInstalledError(ref.id);
        return api;
    }
    getById(pluginId) {
        var _a, _b;
        this.assertUsable('query a plugin by id');
        return (_b = (_a = this.installed.get(pluginId)) === null || _a === void 0 ? void 0 : _a.api) !== null && _b !== void 0 ? _b : null;
    }
    has(refOrId) {
        this.assertUsable('inspect installed plugins');
        if (typeof refOrId === 'string')
            return this.installed.has(refOrId);
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
        return this.operationRegistry.register(definition, 'core:host');
    }
    beginOperationForHost(operationId) {
        if (!this.toolCoordinator.canRunOperation(operationId)) {
            throw new pluginIdentifier.PluginKernelStateError(`run operation "${operationId}" while the active tool rejects it`, this.hostState);
        }
        return this.operationRegistry.beginForHost(operationId);
    }
    runOperationForHost(operationId, args, task, options = {}) {
        if (!this.toolCoordinator.canRunOperation(operationId)) {
            return Promise.reject(new pluginIdentifier.PluginKernelStateError(`run operation "${operationId}" while the active tool rejects it`, this.hostState));
        }
        return this.operationRegistry.runForHost(operationId, args, task, options);
    }
    waitForOperations() {
        return this.operationRegistry.waitForIdle();
    }
    abortOperationsForHost(reason) {
        return this.operationRegistry.abortAll(reason);
    }
    suspendOperationsForHost(reason) {
        return this.operationRegistry.suspend(reason);
    }
    exitActiveToolForHost() {
        return this.toolCoordinator.exit('host-dispose');
    }
    emitCommitted(eventName, payload) {
        return this.eventBus.emitCommitted(eventName, payload);
    }
    async initialize() {
        var _a;
        this.assertUsable('initialize the Plugin Kernel');
        if (this.hostState !== 'created' || this.topLevelInstallActive) {
            throw new pluginIdentifier.PluginKernelStateError('initialize the Plugin Kernel', this.hostState);
        }
        this.hostState = 'initializing';
        try {
            for (const pluginId of this.installationOrder) {
                const record = this.installed.get(pluginId);
                if (!(record === null || record === void 0 ? void 0 : record.plugin.onInit))
                    continue;
                try {
                    await record.plugin.onInit(record.lifecycleContext);
                }
                catch (error) {
                    throw new pluginIdentifier.PluginLifecycleError(pluginId, 'init', error);
                }
            }
            this.hostState = 'initialized';
        }
        catch (error) {
            this.hostState = 'disposing';
            const cleanupErrors = await this.cleanupAll();
            this.hostState = 'disposed';
            const lifecycleError = error instanceof pluginIdentifier.PluginLifecycleError
                ? error
                : new pluginIdentifier.PluginLifecycleError('plugin-kernel', 'init', error);
            throw new pluginIdentifier.PluginLifecycleError((_a = lifecycleError.pluginId) !== null && _a !== void 0 ? _a : 'plugin-kernel', 'init', lifecycleError.cause, cleanupErrors);
        }
    }
    initializeSync() {
        var _a;
        this.assertUsable('initialize the Plugin Kernel');
        if (this.hostState !== 'created' || this.topLevelInstallActive) {
            throw new pluginIdentifier.PluginKernelStateError('initialize the Plugin Kernel', this.hostState);
        }
        this.hostState = 'initializing';
        try {
            for (const pluginId of this.installationOrder) {
                const record = this.installed.get(pluginId);
                if (!(record === null || record === void 0 ? void 0 : record.plugin.onInit))
                    continue;
                const result = record.plugin.onInit(record.lifecycleContext);
                if (disposable.isPromiseLike(result)) {
                    throw new pluginIdentifier.PluginLifecycleError(pluginId, 'init', new Error('Synchronous plugin onInit returned a Promise.'));
                }
            }
            this.hostState = 'initialized';
        }
        catch (error) {
            this.hostState = 'disposing';
            const cleanupErrors = this.cleanupAllSync();
            this.hostState = 'disposed';
            const lifecycleError = error instanceof pluginIdentifier.PluginLifecycleError
                ? error
                : new pluginIdentifier.PluginLifecycleError('plugin-kernel', 'init', error);
            throw new pluginIdentifier.PluginLifecycleError((_a = lifecycleError.pluginId) !== null && _a !== void 0 ? _a : 'plugin-kernel', 'init', lifecycleError.cause, cleanupErrors);
        }
    }
    async notifyImageLoaded(image) {
        this.assertLifecycleReady('notify plugins that an image loaded');
        for (const pluginId of this.installationOrder) {
            const record = this.installed.get(pluginId);
            if (!(record === null || record === void 0 ? void 0 : record.plugin.onImageLoaded))
                continue;
            try {
                await record.plugin.onImageLoaded(image, record.lifecycleContext);
            }
            catch (error) {
                throw new pluginIdentifier.PluginLifecycleError(pluginId, 'image-loaded', error);
            }
        }
    }
    async notifyImageCleared() {
        this.assertLifecycleReady('notify plugins that an image cleared');
        for (const pluginId of this.installationOrder) {
            const record = this.installed.get(pluginId);
            if (!(record === null || record === void 0 ? void 0 : record.plugin.onImageCleared))
                continue;
            try {
                await record.plugin.onImageCleared(record.lifecycleContext);
            }
            catch (error) {
                throw new pluginIdentifier.PluginLifecycleError(pluginId, 'image-cleared', error);
            }
        }
    }
    dispose() {
        var _a;
        if (this.hostState === 'disposed')
            return Promise.resolve();
        if (this.hostState === 'disposing')
            return (_a = this.disposePromise) !== null && _a !== void 0 ? _a : Promise.resolve();
        if (this.hostState === 'initializing') {
            return Promise.reject(new pluginIdentifier.PluginKernelStateError('dispose the Plugin Kernel', this.hostState));
        }
        this.hostState = 'disposing';
        this.disposePromise = this.performDispose();
        return this.disposePromise;
    }
    disposeSync() {
        if (this.hostState === 'disposed')
            return;
        if (this.hostState === 'disposing' || this.hostState === 'initializing') {
            throw new pluginIdentifier.PluginKernelStateError('dispose the Plugin Kernel synchronously', this.hostState);
        }
        this.hostState = 'disposing';
        const errors = this.cleanupAllSync();
        this.hostState = 'disposed';
        if (errors.length > 0) {
            throw new pluginIdentifier.PluginAggregateError('[ImageEditor] Plugin Kernel synchronous disposal completed with cleanup errors.', errors);
        }
    }
    prepareBatch(inputs) {
        var _a;
        if (!Array.isArray(inputs) || inputs.length === 0) {
            throw new pluginIdentifier.InvalidPluginDefinitionError('Plugin batch must contain at least one Plugin.');
        }
        const candidatesById = new Map();
        const apisByPluginId = new Map();
        for (const input of inputs) {
            const plugin = this.normalizePluginDefinition(input);
            const pluginId = plugin.ref.id;
            const existing = this.installed.get(pluginId);
            if (existing) {
                if (!sameInstallationDefinition(existing.plugin, plugin)) {
                    throw new pluginIdentifier.PluginDefinitionConflictError(pluginId);
                }
                apisByPluginId.set(pluginId, existing.api);
                continue;
            }
            const duplicate = candidatesById.get(pluginId);
            if (duplicate) {
                if (!sameInstallationDefinition(duplicate.plugin, plugin)) {
                    throw new pluginIdentifier.PluginDefinitionConflictError(pluginId);
                }
                continue;
            }
            candidatesById.set(pluginId, { plugin });
        }
        const candidates = [...candidatesById.values()];
        const dependencies = new Map();
        for (const candidate of candidates) {
            const pluginDependencies = new Set();
            for (const dependency of (_a = candidate.plugin.manifest.requiresPlugins) !== null && _a !== void 0 ? _a : []) {
                const installedDependency = this.installed.get(dependency.id);
                if ((installedDependency === null || installedDependency === void 0 ? void 0 : installedDependency.refObject) === dependency)
                    continue;
                const batchDependency = candidatesById.get(dependency.id);
                if ((batchDependency === null || batchDependency === void 0 ? void 0 : batchDependency.plugin.ref) === dependency) {
                    pluginDependencies.add(dependency.id);
                    continue;
                }
                throw this.createDependencyError(candidate.plugin.ref.id, dependency, [
                    ...this.installed.keys(),
                    ...candidatesById.keys(),
                ]);
            }
            dependencies.set(candidate.plugin.ref.id, pluginDependencies);
        }
        const remaining = new Set(candidatesById.keys());
        const ordered = [];
        while (remaining.size > 0) {
            const next = candidates.find((candidate) => {
                var _a;
                return remaining.has(candidate.plugin.ref.id) &&
                    [...((_a = dependencies.get(candidate.plugin.ref.id)) !== null && _a !== void 0 ? _a : [])].every((dependencyId) => !remaining.has(dependencyId));
            });
            if (!next) {
                throw new pluginIdentifier.PluginDependencyCycleError(this.findDependencyCycle(remaining, dependencies));
            }
            remaining.delete(next.plugin.ref.id);
            ordered.push(next);
        }
        return { ordered: Object.freeze(ordered), apisByPluginId };
    }
    findDependencyCycle(remaining, dependencies) {
        const visited = new Set();
        const visiting = new Set();
        const stack = [];
        const visit = (pluginId) => {
            var _a;
            if (visiting.has(pluginId)) {
                const start = stack.indexOf(pluginId);
                return Object.freeze([...stack.slice(start), pluginId]);
            }
            if (visited.has(pluginId))
                return null;
            visiting.add(pluginId);
            stack.push(pluginId);
            for (const dependencyId of (_a = dependencies.get(pluginId)) !== null && _a !== void 0 ? _a : []) {
                if (!remaining.has(dependencyId))
                    continue;
                const cycle = visit(dependencyId);
                if (cycle)
                    return cycle;
            }
            stack.pop();
            visiting.delete(pluginId);
            visited.add(pluginId);
            return null;
        };
        for (const pluginId of remaining) {
            const cycle = visit(pluginId);
            if (cycle)
                return cycle;
        }
        return Object.freeze([...remaining, remaining.values().next().value]);
    }
    performPendingInstallSync(plugin, visibleTransactions) {
        if (plugin.setupMode !== 'sync') {
            throw new pluginIdentifier.InvalidPluginDefinitionError(`Plugin "${plugin.ref.id}" must declare setupMode "sync" for install().`, plugin.ref.id);
        }
        const { required, optional } = this.resolveCapabilities(plugin, visibleTransactions);
        const scope = new RegistrationScope(plugin.ref.id, this.options);
        visibleTransactions.add(scope.transactionId);
        try {
            const contexts = this.createContexts(plugin.ref, scope, required, optional, [
                plugin.ref.id,
            ]);
            const api = plugin.setup(contexts.setup);
            if (disposable.isPromiseLike(api)) {
                throw new pluginIdentifier.InvalidPluginDefinitionError(`Plugin "${plugin.ref.id}" returned a Promise from synchronous setup.`, plugin.ref.id);
            }
            if (!isPluginApi(api)) {
                throw new pluginIdentifier.InvalidPluginDefinitionError(`Plugin "${plugin.ref.id}" setup must return a non-null object or function API.`, plugin.ref.id);
            }
            return {
                plugin,
                refObject: plugin.ref,
                api,
                scope,
                lifecycleContext: contexts.lifecycle,
            };
        }
        catch (error) {
            visibleTransactions.delete(scope.transactionId);
            const cleanupErrors = scope.rollbackSync();
            throw new pluginIdentifier.PluginSetupError(plugin.ref.id, error, cleanupErrors);
        }
    }
    rollbackPendingBatchSync(pendingRecords) {
        const cleanupErrors = [];
        for (const record of [...pendingRecords].reverse()) {
            if (record.plugin.onDispose) {
                try {
                    const result = record.plugin.onDispose(record.lifecycleContext);
                    if (disposable.isPromiseLike(result)) {
                        void Promise.resolve(result).catch((error) => {
                            disposable.reportErrorSafely(this.options.errorSink, error);
                        });
                        throw new Error('Synchronous Plugin onDispose returned a Promise.');
                    }
                }
                catch (error) {
                    cleanupErrors.push(new pluginIdentifier.PluginLifecycleError(record.plugin.ref.id, 'dispose', error));
                }
            }
            cleanupErrors.push(...record.scope.rollbackSync());
        }
        return Object.freeze(cleanupErrors);
    }
    createDependencyError(consumerPluginId, dependency, availablePluginIds) {
        return new pluginIdentifier.PluginDependencyError({
            consumerPluginId,
            dependencyId: dependency.id,
            requiredApiVersion: dependency.apiVersion,
            availablePluginIds: Object.freeze([...new Set(availablePluginIds)].sort()),
            packageHint: pluginPackageHints.get(dependency.id),
            planHint: 'Pass the dependency to install([...]) or include it in composePlugins(...).',
        });
    }
    assertPluginDependenciesInstalled(plugin) {
        var _a;
        for (const dependency of (_a = plugin.manifest.requiresPlugins) !== null && _a !== void 0 ? _a : []) {
            const installedDependency = this.installed.get(dependency.id);
            if ((installedDependency === null || installedDependency === void 0 ? void 0 : installedDependency.refObject) === dependency)
                continue;
            throw this.createDependencyError(plugin.ref.id, dependency, [...this.installed.keys()]);
        }
    }
    async performInstall(input, mode, parentStack) {
        const plugin = this.normalizePluginDefinition(input);
        const pluginId = plugin.ref.id;
        if (parentStack.includes(pluginId)) {
            throw new pluginIdentifier.InvalidPluginDefinitionError(`Plugin dependency cycle detected: ${[...parentStack, pluginId].join(' -> ')}.`, pluginId);
        }
        const existing = this.installed.get(pluginId);
        if (existing) {
            if (mode === 'strict')
                throw new pluginIdentifier.PluginAlreadyInstalledError(pluginId);
            const compatible = sameInstallationDefinition(existing.plugin, plugin);
            if (!compatible) {
                throw new pluginIdentifier.PluginVersionMismatchError(pluginId, existing.plugin.manifest.version, plugin.manifest.version, existing.plugin.ref.apiVersion, plugin.ref.apiVersion);
            }
            return { api: existing.api };
        }
        this.assertPluginDependenciesInstalled(plugin);
        const { required, optional } = this.resolveCapabilities(plugin);
        const scope = new RegistrationScope(pluginId, this.options);
        const stack = [...parentStack, pluginId];
        try {
            const contexts = this.createContexts(plugin.ref, scope, required, optional, stack);
            const api = await plugin.setup(contexts.setup);
            if (!isPluginApi(api)) {
                throw new pluginIdentifier.InvalidPluginDefinitionError(`Plugin "${pluginId}" setup must return a non-null object or function API.`, pluginId);
            }
            scope.commit();
            const record = {
                plugin,
                refObject: plugin.ref,
                api,
                scope,
                lifecycleContext: contexts.lifecycle,
            };
            this.installed.set(pluginId, record);
            this.installationOrder.push(pluginId);
            return { api };
        }
        catch (error) {
            const cleanupErrors = await scope.rollback();
            throw new pluginIdentifier.PluginSetupError(pluginId, error, cleanupErrors);
        }
    }
    performInstallSync(input, mode, parentStack) {
        const plugin = this.normalizePluginDefinition(input);
        if (plugin.setupMode !== 'sync') {
            throw new pluginIdentifier.InvalidPluginDefinitionError(`Plugin "${plugin.ref.id}" must declare setupMode "sync" for installSync().`, plugin.ref.id);
        }
        const pluginId = plugin.ref.id;
        if (parentStack.includes(pluginId)) {
            throw new pluginIdentifier.InvalidPluginDefinitionError(`Plugin dependency cycle detected: ${[...parentStack, pluginId].join(' -> ')}.`, pluginId);
        }
        const existing = this.installed.get(pluginId);
        if (existing) {
            if (mode === 'strict')
                throw new pluginIdentifier.PluginAlreadyInstalledError(pluginId);
            const compatible = sameInstallationDefinition(existing.plugin, plugin);
            if (!compatible) {
                throw new pluginIdentifier.PluginVersionMismatchError(pluginId, existing.plugin.manifest.version, plugin.manifest.version, existing.plugin.ref.apiVersion, plugin.ref.apiVersion);
            }
            return { api: existing.api };
        }
        this.assertPluginDependenciesInstalled(plugin);
        const { required, optional } = this.resolveCapabilities(plugin);
        const scope = new RegistrationScope(pluginId, this.options);
        try {
            const contexts = this.createContexts(plugin.ref, scope, required, optional, [
                ...parentStack,
                pluginId,
            ]);
            const api = plugin.setup(contexts.setup);
            if (disposable.isPromiseLike(api)) {
                throw new pluginIdentifier.InvalidPluginDefinitionError(`Plugin "${pluginId}" returned a Promise from synchronous setup.`, pluginId);
            }
            if (!isPluginApi(api)) {
                throw new pluginIdentifier.InvalidPluginDefinitionError(`Plugin "${pluginId}" setup must return a non-null object or function API.`, pluginId);
            }
            scope.commit();
            this.installed.set(pluginId, {
                plugin,
                refObject: plugin.ref,
                api,
                scope,
                lifecycleContext: contexts.lifecycle,
            });
            this.installationOrder.push(pluginId);
            return { api };
        }
        catch (error) {
            const cleanupErrors = scope.rollbackSync();
            throw new pluginIdentifier.PluginSetupError(pluginId, error, cleanupErrors);
        }
    }
    resolveCapabilities(plugin, visibleTransactions) {
        var _a, _b;
        const required = new Map();
        const optional = new Map();
        for (const requirement of (_a = plugin.manifest.requires) !== null && _a !== void 0 ? _a : []) {
            this.assertCapabilityPermission(plugin, requirement.token.id, visibleTransactions);
            required.set(requirement.token.id, {
                token: requirement.token,
                value: this.capabilityRegistry.requireDefinition(requirement, plugin.ref.id, visibleTransactions),
            });
        }
        for (const requirement of (_b = plugin.manifest.optional) !== null && _b !== void 0 ? _b : []) {
            this.assertCapabilityPermission(plugin, requirement.token.id, visibleTransactions);
            const value = this.capabilityRegistry.optionalDefinition(requirement, plugin.ref.id, visibleTransactions);
            optional.set(requirement.token.id, {
                token: requirement.token,
                value,
                status: value !== null
                    ? 'available'
                    : this.capabilityRegistry.getProviderInfo(requirement.token.id)
                        ? 'incompatible'
                        : 'missing',
            });
        }
        return { required, optional };
    }
    assertCapabilityPermission(plugin, capabilityId, visibleTransactions) {
        var _a;
        const permission = this.capabilityRegistry.getRequiredPermission(capabilityId, visibleTransactions);
        if (!permission || ((_a = plugin.manifest.permissions) === null || _a === void 0 ? void 0 : _a.includes(permission)))
            return;
        throw new pluginIdentifier.PluginPermissionError(plugin.ref.id, permission, capabilityId);
    }
    createContexts(plugin, scope, required, optional, stack) {
        const pluginId = plugin.id;
        const state = this.stateStore.createScoped(pluginId, (disposable) => scope.add(disposable), (disposable) => scope.addFinalizer(disposable), () => scope.active);
        const capabilities = Object.freeze({
            require: (token) => {
                const resolved = required.get(token.id);
                if (!resolved || resolved.token !== token) {
                    throw new pluginIdentifier.PluginCapabilityError({
                        consumerPluginId: pluginId,
                        capabilityId: token.id,
                        requestedRange: 'undeclared-required-capability',
                        reason: 'missing',
                    });
                }
                return resolved.value;
            },
            optional: (token) => {
                const resolved = optional.get(token.id);
                if (!resolved || resolved.token !== token) {
                    throw new pluginIdentifier.PluginCapabilityError({
                        consumerPluginId: pluginId,
                        capabilityId: token.id,
                        requestedRange: 'undeclared-optional-capability',
                        reason: 'missing',
                    });
                }
                return resolved.value;
            },
            getOptionalStatus: (token) => {
                const resolved = optional.get(token.id);
                if (!resolved || resolved.token !== token) {
                    throw new pluginIdentifier.PluginCapabilityError({
                        consumerPluginId: pluginId,
                        capabilityId: token.id,
                        requestedRange: 'undeclared-optional-capability',
                        reason: 'missing',
                    });
                }
                return resolved.status;
            },
        });
        const operations = Object.freeze({
            begin: (operationId) => this.operationRegistry.begin(operationId, pluginId),
            run: (operationId, args, task, options = {}) => this.operationRegistry.run(operationId, pluginId, args, task, options),
            get: (operationId) => this.operationRegistry.get(operationId),
            isActive: (operationId) => this.operationRegistry.isActive(operationId),
        });
        const tools = Object.freeze({
            enter: (toolId) => this.toolCoordinator.enter(toolId, pluginId),
            exit: (reason) => this.toolCoordinator.exit(reason),
            getActiveToolId: () => this.toolCoordinator.getActiveToolId(),
            canRunOperation: (operationId) => this.toolCoordinator.canRunOperation(operationId),
        });
        const events = Object.freeze({
            emitCommitted: (eventName, payload) => this.eventBus.emitCommitted(eventName, payload),
        });
        const lifecycle = Object.freeze({
            plugin,
            pluginId,
            state,
            capabilities,
            operations,
            tools,
            events,
        });
        const setupCapabilities = Object.freeze({
            ...capabilities,
            provide: (token, implementation, options) => {
                var _a;
                scope.assertOpen();
                return scope.add(this.capabilityRegistry.providePending(token, implementation, pluginId, scope.transactionId, (_a = options === null || options === void 0 ? void 0 : options.version) !== null && _a !== void 0 ? _a : token.version, options === null || options === void 0 ? void 0 : options.requiredPermission));
            },
        });
        const setupOperations = Object.freeze({
            ...operations,
            register: (definition) => {
                scope.assertOpen();
                return scope.add(this.operationRegistry.register(definition, pluginId));
            },
        });
        const setupTools = Object.freeze({
            ...tools,
            register: (definition) => {
                scope.assertOpen();
                return scope.add(this.toolCoordinator.register(definition, pluginId));
            },
        });
        const setupEvents = Object.freeze({
            ...events,
            on: (eventName, listener) => {
                scope.assertOpen();
                return scope.add(this.eventBus.on(eventName, listener));
            },
        });
        const ensurePluginNow = async (dependency) => {
            scope.assertOpen('ensure a composed plugin dependency');
            const before = new Set(this.installationOrder);
            const outcome = await this.performInstall(dependency, 'ensure', stack);
            const newlyInstalled = this.installationOrder.filter((id) => !before.has(id));
            for (const installedPluginId of newlyInstalled) {
                scope.addRollback(disposable.createDisposable(() => this.rollbackInstalledPlugin(installedPluginId)));
            }
            return outcome.api;
        };
        let ensureQueue = Promise.resolve();
        const ensurePlugin = (dependency) => {
            const result = ensureQueue.then(() => ensurePluginNow(dependency));
            ensureQueue = result.then(() => undefined, () => undefined);
            return result;
        };
        const disposables = Object.freeze({
            get active() {
                return scope.active;
            },
            add: (disposable) => {
                scope.assertOpen();
                return scope.add(disposable);
            },
        });
        const setup = Object.freeze({
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
            ensure: async (dependency) => {
                const api = await ensurePlugin(dependency);
                return api;
            },
            ensurePlugin,
        });
        return { setup, lifecycle };
    }
    async rollbackInstalledPlugin(pluginId) {
        const record = this.installed.get(pluginId);
        if (!record)
            return;
        this.installed.delete(pluginId);
        const orderIndex = this.installationOrder.lastIndexOf(pluginId);
        if (orderIndex >= 0)
            this.installationOrder.splice(orderIndex, 1);
        const errors = [];
        if (record.plugin.onDispose) {
            try {
                await record.plugin.onDispose(record.lifecycleContext);
            }
            catch (error) {
                errors.push(new pluginIdentifier.PluginLifecycleError(pluginId, 'dispose', error));
            }
        }
        try {
            await record.scope.dispose();
        }
        catch (error) {
            errors.push(error);
        }
        if (errors.length > 0) {
            throw new pluginIdentifier.PluginAggregateError(`[ImageEditor] Rollback of composed plugin "${pluginId}" failed.`, errors, { pluginId });
        }
    }
    normalizePluginDefinition(plugin) {
        if (typeof plugin !== 'object' || plugin === null) {
            throw new pluginIdentifier.InvalidPluginDefinitionError('Plugin definition must be an object.');
        }
        if (!pluginManifest.isPluginRef(plugin.ref)) {
            throw new pluginIdentifier.InvalidPluginDefinitionError('Plugin definition must use a PluginRef created by definePluginRef().');
        }
        if (typeof plugin.setup !== 'function') {
            throw new pluginIdentifier.InvalidPluginDefinitionError(`Plugin "${plugin.ref.id}" must define setup().`, plugin.ref.id);
        }
        const manifest = pluginManifest.validatePluginManifest(plugin.ref, 'manifest' in plugin
            ? plugin.manifest
            : {
                id: plugin.ref.id,
                version: plugin.version,
                apiVersion: plugin.ref.apiVersion,
                engine: '*',
                requires: plugin.requires,
                optional: plugin.optional,
                permissions: plugin.permissions,
            });
        return Object.freeze({ ...plugin, ref: plugin.ref, manifest });
    }
    async performDispose() {
        const errors = await this.cleanupAll();
        this.hostState = 'disposed';
        if (errors.length > 0) {
            throw new pluginIdentifier.PluginAggregateError('[ImageEditor] Plugin Kernel disposal completed with cleanup errors.', errors);
        }
    }
    async cleanupAll() {
        const errors = [];
        const records = [...this.installationOrder]
            .reverse()
            .map((pluginId) => this.installed.get(pluginId))
            .filter((record) => record !== undefined);
        for (const record of records) {
            if (!record.plugin.onDispose)
                continue;
            try {
                await record.plugin.onDispose(record.lifecycleContext);
            }
            catch (error) {
                const lifecycleError = new pluginIdentifier.PluginLifecycleError(record.plugin.ref.id, 'dispose', error);
                errors.push(lifecycleError);
                disposable.reportErrorSafely(this.options.errorSink, lifecycleError);
            }
        }
        for (const record of records) {
            try {
                await record.scope.dispose();
            }
            catch (error) {
                errors.push(error);
                disposable.reportErrorSafely(this.options.errorSink, error);
            }
        }
        this.installed.clear();
        this.installationOrder.length = 0;
        const kernelDisposables = [
            this.toolCoordinator,
            this.operationRegistry,
            this.eventBus,
            this.capabilityRegistry,
            this.stateStore,
        ];
        for (const disposable$1 of kernelDisposables) {
            try {
                await disposable$1.dispose();
            }
            catch (error) {
                errors.push(error);
                disposable.reportErrorSafely(this.options.errorSink, error);
            }
        }
        return errors;
    }
    cleanupAllSync() {
        const errors = [];
        const records = [...this.installationOrder]
            .reverse()
            .map((pluginId) => this.installed.get(pluginId))
            .filter((record) => record !== undefined);
        for (const record of records) {
            if (!record.plugin.onDispose)
                continue;
            try {
                const result = record.plugin.onDispose(record.lifecycleContext);
                if (disposable.isPromiseLike(result)) {
                    void Promise.resolve(result).catch((error) => {
                        disposable.reportErrorSafely(this.options.errorSink, error);
                    });
                    throw new pluginIdentifier.PluginLifecycleError(record.plugin.ref.id, 'dispose', new Error('Synchronous plugin onDispose returned a Promise.'));
                }
            }
            catch (error) {
                const lifecycleError = error instanceof pluginIdentifier.PluginLifecycleError
                    ? error
                    : new pluginIdentifier.PluginLifecycleError(record.plugin.ref.id, 'dispose', error);
                errors.push(lifecycleError);
                disposable.reportErrorSafely(this.options.errorSink, lifecycleError);
            }
        }
        for (const record of records) {
            try {
                record.scope.disposeSync();
            }
            catch (error) {
                errors.push(error);
                disposable.reportErrorSafely(this.options.errorSink, error);
            }
        }
        this.installed.clear();
        this.installationOrder.length = 0;
        const cleanup = [
            () => this.toolCoordinator.disposeSync(),
            () => this.operationRegistry.dispose(),
            () => this.eventBus.dispose(),
            () => this.capabilityRegistry.dispose(),
            () => this.stateStore.dispose(),
        ];
        for (const dispose of cleanup) {
            try {
                dispose();
            }
            catch (error) {
                errors.push(error);
                disposable.reportErrorSafely(this.options.errorSink, error);
            }
        }
        return Object.freeze(errors);
    }
    assertCanInstall() {
        this.assertUsable('install a plugin');
        if (this.hostState !== 'created') {
            throw new pluginIdentifier.PluginKernelStateError('install a plugin', this.hostState);
        }
    }
    assertLifecycleReady(operation) {
        this.assertUsable(operation);
        if (this.hostState !== 'initialized') {
            throw new pluginIdentifier.PluginKernelStateError(operation, this.hostState);
        }
    }
    assertUsable(operation) {
        if (this.hostState === 'disposed' || this.hostState === 'disposing') {
            throw new pluginIdentifier.PluginKernelDisposedError(operation);
        }
    }
}

exports.PluginManager = PluginManager;
//# sourceMappingURL=plugin-manager-Bb8UQ105.cjs.map
