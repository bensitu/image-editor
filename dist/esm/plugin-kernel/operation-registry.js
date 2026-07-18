import { createDisposable } from './disposable.js';
import { OperationConflictError, OperationRegistrationError, PluginKernelDisposedError, } from './errors.js';
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
export class OperationRegistry {
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
            throw new OperationRegistrationError(`Operation "${definition.id}" is already registered by "${existing.ownerPluginId}".`, ownerPluginId);
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
        return createDisposable(() => {
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
                return Promise.reject(new OperationRegistrationError(`Operation "${operationId}" has no coalesce function.`, ownerPluginId));
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
        const registered = this.requireRegistered(operationId, '@bensitu/core');
        return this.begin(operationId, registered.ownerPluginId);
    }
    runForHost(operationId, args, task, options = {}) {
        const registered = this.requireRegistered(operationId, '@bensitu/core');
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
            throw new OperationConflictError(`Operation "${operationId}" is not registered.`, ownerPluginId);
        }
        return registered;
    }
    requireOwned(operationId, ownerPluginId) {
        const registered = this.requireRegistered(operationId, ownerPluginId);
        if (registered.ownerPluginId !== ownerPluginId) {
            throw new OperationConflictError(`Operation "${operationId}" belongs to "${registered.ownerPluginId}", not "${ownerPluginId}".`, ownerPluginId);
        }
        return registered;
    }
    validateParent(parent) {
        if (!parent)
            return;
        if (!parent.active ||
            parent.signal.aborted ||
            ![...this.activeOperations].some((active) => active.token === parent)) {
            throw new OperationConflictError(`Parent operation "${parent.id}" is not active.`, parent.ownerPluginId);
        }
    }
    validateDefinition(definition, ownerPluginId) {
        if (definition.id.trim().length === 0 || definition.id.trim() !== definition.id) {
            throw new OperationRegistrationError('Operation id must be a non-empty trimmed string.', ownerPluginId);
        }
        if (!OPERATION_MODES.includes(definition.mode)) {
            throw new OperationRegistrationError(`Operation "${definition.id}" has invalid mode "${definition.mode}".`, ownerPluginId);
        }
        if (!REENTRANCY_POLICIES.includes(definition.reentrancy)) {
            throw new OperationRegistrationError(`Operation "${definition.id}" has invalid reentrancy policy.`, ownerPluginId);
        }
        if (!Array.isArray(definition.conflictDomains) ||
            definition.conflictDomains.length === 0 ||
            definition.conflictDomains.some((domain) => !CONFLICT_DOMAINS.includes(domain)) ||
            new Set(definition.conflictDomains).size !== definition.conflictDomains.length) {
            throw new OperationRegistrationError(`Operation "${definition.id}" has invalid conflict domains.`, ownerPluginId);
        }
        if (definition.reentrancy === 'coalesce' && typeof definition.coalesce !== 'function') {
            throw new OperationRegistrationError(`Operation "${definition.id}" must define coalesce().`, ownerPluginId);
        }
    }
    conflictError(requested, active, ownerPluginId) {
        return new OperationConflictError(`Operation "${requested.definition.id}" conflicts with active operation "${active.definition.id}" in domain(s) ${requested.definition.conflictDomains
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
            throw new PluginKernelDisposedError(operation);
    }
}
//# sourceMappingURL=operation-registry.js.map