'use strict';

var pluginManager = require('../chunks/plugin-manager-C-UJ_Yc9.cjs');
var pluginManifest = require('../chunks/plugin-manifest-BCkXHQr2.cjs');
require('../chunks/disposable-Sj4tt6Lk.cjs');

function createDeferredOperation() {
    let settled = false;
    let resolvePromise;
    let rejectPromise;
    const promise = new Promise((resolve, reject) => {
        resolvePromise = resolve;
        rejectPromise = reject;
    });
    return Object.freeze({
        promise,
        get settled() {
            return settled;
        },
        resolve(value) {
            if (settled)
                return;
            settled = true;
            resolvePromise(value);
        },
        reject(reason) {
            if (settled)
                return;
            settled = true;
            rejectPromise(reason);
        },
    });
}
function createAbortError() {
    const error = new Error('Image decoding was aborted.');
    error.name = 'AbortError';
    return error;
}
function createControlledImageDecoder() {
    const pending = [];
    const remove = (entry) => {
        var _a;
        const index = pending.indexOf(entry);
        if (index >= 0)
            pending.splice(index, 1);
        (_a = entry.signal) === null || _a === void 0 ? void 0 : _a.removeEventListener('abort', entry.abortListener);
    };
    const takeNext = () => {
        const entry = pending[0];
        if (!entry)
            throw new Error('No controlled image decode is pending.');
        remove(entry);
        return entry;
    };
    return Object.freeze({
        get pendingInputs() {
            return Object.freeze(pending.map((entry) => entry.input));
        },
        decode(input, signal) {
            const deferred = createDeferredOperation();
            const abortListener = () => {
                const index = pending.findIndex((entry) => entry.deferred === deferred);
                if (index >= 0)
                    pending.splice(index, 1);
                deferred.reject(createAbortError());
            };
            const entry = { input, deferred, signal, abortListener };
            if (signal === null || signal === void 0 ? void 0 : signal.aborted) {
                deferred.reject(createAbortError());
            }
            else {
                pending.push(entry);
                signal === null || signal === void 0 ? void 0 : signal.addEventListener('abort', abortListener, { once: true });
            }
            return deferred.promise;
        },
        resolveNext(image) {
            takeNext().deferred.resolve(image);
        },
        rejectNext(reason) {
            takeNext().deferred.reject(reason);
        },
    });
}

function descriptorMatches(left, right) {
    if (!left || !right)
        return left === right;
    return (left.configurable === right.configurable &&
        left.enumerable === right.enumerable &&
        left.writable === right.writable &&
        left.value === right.value &&
        left.get === right.get &&
        left.set === right.set);
}
function createPluginTestFabric(module) {
    const keys = Reflect.ownKeys(module);
    const descriptors = new Map(keys.map((key) => [key, Object.getOwnPropertyDescriptor(module, key)]));
    return Object.freeze({
        module,
        assertUnchanged() {
            const currentKeys = Reflect.ownKeys(module);
            const sameKeys = currentKeys.length === keys.length &&
                currentKeys.every((key, index) => key === keys[index]);
            const sameDescriptors = keys.every((key) => descriptorMatches(descriptors.get(key), Object.getOwnPropertyDescriptor(module, key)));
            if (!sameKeys || !sameDescriptors) {
                throw new Error('Fabric namespace changed during the Plugin test.');
            }
        },
    });
}

function createPluginTestHost(options = {}) {
    var _a;
    const warnings = [];
    const errors = [];
    const manager = new pluginManager.PluginManager({
        warningSink: (warning) => warnings.push(warning),
        errorSink: (error) => errors.push(error),
        hostCapabilities: ((_a = options.hostCapabilities) !== null && _a !== void 0 ? _a : []).map((provider) => ({
            token: provider.token,
            implementation: provider.implementation,
            providerId: provider.providerId,
            requiredPermission: provider.requiredPermission,
        })),
    });
    return Object.freeze({
        get state() {
            return manager.state;
        },
        get warnings() {
            return Object.freeze([...warnings]);
        },
        get errors() {
            return Object.freeze([...errors]);
        },
        install: (plugin) => manager.install(plugin),
        installSync: (plugin) => manager.installSync(plugin),
        get: (ref) => manager.get(ref),
        has: (refOrId) => manager.has(refOrId),
        initialize: () => manager.initialize(),
        initializeSync: () => manager.initializeSync(),
        notifyImageLoaded: (image) => manager.notifyImageLoaded(image),
        notifyImageCleared: () => manager.notifyImageCleared(),
        dispose: () => manager.dispose(),
        disposeSync: () => manager.disposeSync(),
    });
}

function result(id, contract, status, message, details) {
    return Object.freeze({ id, contract, required: true, status, message, details });
}
function unavailable$1(id, contract) {
    return result(id, contract, 'NOT_AVAILABLE', 'No proof adapter was supplied.');
}
function describeError$1(error) {
    return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}
async function resolveProof(source) {
    return typeof source === 'function' ? source() : source;
}
async function evaluate(id, contract, source, inspect) {
    if (!source)
        return unavailable$1(id, contract);
    try {
        const inspected = inspect(await resolveProof(source));
        return result(id, contract, inspected.passed ? 'PASS' : 'FAIL', inspected.message, inspected.details);
    }
    catch (error) {
        return result(id, contract, 'FAIL', describeError$1(error));
    }
}
function isBundledCoreModule(moduleId) {
    const normalized = moduleId.replace(/\\/gu, '/');
    return /(?:^|\/)node_modules\/@bensitu\/image-editor(?:\/|$)/u.test(normalized);
}
function isBundledFabricModule(moduleId) {
    const normalized = moduleId.replace(/\\/gu, '/');
    return /(?:^|\/)node_modules\/fabric(?:\/|$)/u.test(normalized);
}
function assertBundleIsolation(source) {
    return evaluate('bundle-isolation', 'The package uses public imports and has no private or unknown bundled modules.', source, (observation) => {
        var _a, _b;
        const bundledRuntimeModules = observation.moduleIds.filter((moduleId) => isBundledCoreModule(moduleId) || isBundledFabricModule(moduleId));
        const passed = observation.internalImports === 0 &&
            observation.privateAliases === 0 &&
            ((_a = observation.unknownModules) !== null && _a !== void 0 ? _a : 0) === 0 &&
            bundledRuntimeModules.length === 0;
        return {
            passed,
            message: passed
                ? 'Package module isolation is intact.'
                : 'Package module isolation contains forbidden imports or modules.',
            details: Object.freeze({
                internalImports: observation.internalImports,
                privateAliases: observation.privateAliases,
                unknownModules: (_b = observation.unknownModules) !== null && _b !== void 0 ? _b : 0,
                bundledRuntimeModules: Object.freeze([...bundledRuntimeModules].sort()),
            }),
        };
    });
}
function descriptorFingerprint(descriptor) {
    return Object.freeze({
        configurable: descriptor.configurable === true,
        enumerable: descriptor.enumerable === true,
        writable: 'writable' in descriptor ? descriptor.writable === true : undefined,
        value: 'value' in descriptor ? descriptor.value : undefined,
        get: descriptor.get,
        set: descriptor.set,
    });
}
function captureSurface(surfaces, name, value) {
    const properties = new Map();
    for (const key of Reflect.ownKeys(value)) {
        const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
        if (descriptor)
            properties.set(key, descriptorFingerprint(descriptor));
    }
    if (value instanceof Map) {
        for (const [key, entry] of value) {
            properties.set(`[[Map:${String(key)}]]`, descriptorFingerprint({ value: entry }));
        }
    }
    if (value instanceof Set) {
        for (const entry of value) {
            properties.set(`[[Set:${String(entry)}]]`, descriptorFingerprint({ value: entry }));
        }
    }
    surfaces.set(name, properties);
}
function captureFabricGlobalState(fabric) {
    const surfaces = new Map();
    captureSurface(surfaces, 'fabric', fabric);
    for (const key of Reflect.ownKeys(fabric)) {
        const descriptor = Reflect.getOwnPropertyDescriptor(fabric, key);
        if (!descriptor || !('value' in descriptor))
            continue;
        const value = descriptor.value;
        const name = `fabric.${String(key)}`;
        if (typeof value === 'function' && value.prototype && typeof value.prototype === 'object') {
            captureSurface(surfaces, `${name}.prototype`, value.prototype);
        }
        if (typeof value === 'object' &&
            value !== null &&
            ['classRegistry', 'config', 'filters'].includes(String(key))) {
            captureSurface(surfaces, name, value);
            for (const childKey of Reflect.ownKeys(value)) {
                const childDescriptor = Reflect.getOwnPropertyDescriptor(value, childKey);
                if (childDescriptor &&
                    'value' in childDescriptor &&
                    typeof childDescriptor.value === 'object' &&
                    childDescriptor.value !== null) {
                    captureSurface(surfaces, `${name}.${String(childKey)}`, childDescriptor.value);
                }
            }
        }
    }
    return surfaces;
}
function descriptorsEqual(left, right) {
    return (left.configurable === right.configurable &&
        left.enumerable === right.enumerable &&
        left.writable === right.writable &&
        Object.is(left.value, right.value) &&
        left.get === right.get &&
        left.set === right.set);
}
function globalDifferences(before, after) {
    var _a, _b;
    const differences = new Set();
    const surfaceNames = new Set([...before.keys(), ...after.keys()]);
    for (const surfaceName of surfaceNames) {
        const left = (_a = before.get(surfaceName)) !== null && _a !== void 0 ? _a : new Map();
        const right = (_b = after.get(surfaceName)) !== null && _b !== void 0 ? _b : new Map();
        const keys = new Set([...left.keys(), ...right.keys()]);
        for (const key of keys) {
            const leftValue = left.get(key);
            const rightValue = right.get(key);
            if (!leftValue || !rightValue || !descriptorsEqual(leftValue, rightValue)) {
                differences.add(`${surfaceName}.${String(key)}`);
            }
        }
    }
    return Object.freeze([...differences].sort());
}
async function assertNoUndeclaredFabricGlobalMutation(lifecycle) {
    var _a, _b, _c;
    const id = 'fabric-global-mutation';
    const contract = 'Known Fabric global surfaces remain unchanged unless global mutation permission is declared.';
    if (!lifecycle)
        return unavailable$1(id, contract);
    const changes = [];
    let previous = captureFabricGlobalState(lifecycle.fabric);
    let definition;
    let runtime;
    try {
        const module = await lifecycle.importModule();
        let current = captureFabricGlobalState(lifecycle.fabric);
        let surfaces = globalDifferences(previous, current);
        if (surfaces.length > 0)
            changes.push(Object.freeze({ phase: 'import', surfaces }));
        previous = current;
        definition = await lifecycle.createDefinition(module);
        current = captureFabricGlobalState(lifecycle.fabric);
        surfaces = globalDifferences(previous, current);
        if (surfaces.length > 0)
            changes.push(Object.freeze({ phase: 'definition', surfaces }));
        previous = current;
        runtime = await lifecycle.setup(definition);
        current = captureFabricGlobalState(lifecycle.fabric);
        surfaces = globalDifferences(previous, current);
        if (surfaces.length > 0)
            changes.push(Object.freeze({ phase: 'setup', surfaces }));
        previous = current;
        await lifecycle.dispose(runtime, definition);
        current = captureFabricGlobalState(lifecycle.fabric);
        surfaces = globalDifferences(previous, current);
        if (surfaces.length > 0)
            changes.push(Object.freeze({ phase: 'dispose', surfaces }));
    }
    catch (error) {
        return result(id, contract, 'FAIL', describeError$1(error));
    }
    const permissions = (_c = (_a = lifecycle.declaredPermissions) !== null && _a !== void 0 ? _a : (_b = definition === null || definition === void 0 ? void 0 : definition.manifest) === null || _b === void 0 ? void 0 : _b.permissions) !== null && _c !== void 0 ? _c : Object.freeze([]);
    const declared = permissions.includes('fabric:global-mutation');
    const changedSurfaces = Object.freeze([...new Set(changes.flatMap((entry) => entry.surfaces))].sort());
    const details = Object.freeze({
        changedSurfaces,
        phases: Object.freeze(changes),
        declarationPresent: declared,
        isolation: changedSurfaces.length === 0 ? 'STRONG' : declared ? 'DOWNGRADED' : 'FAILED',
        detectionScope: 'KNOWN_MEASURABLE_SURFACES',
    });
    if (changedSurfaces.length === 0) {
        return result(id, contract, 'PASS', 'Known Fabric global surfaces are unchanged.', details);
    }
    if (declared) {
        return result(id, contract, 'PASS_WITH_DOWNGRADED_ISOLATION', 'Declared Fabric global mutation requires downgraded isolation.', details);
    }
    return result(id, contract, 'FAIL', 'Fabric global mutation was detected without the required declaration.', details);
}
function assertStrongMultiInstanceIsolation(source) {
    return evaluate('multi-instance-isolation', 'Core, Plugin, operation, tool, Overlay, History, and Fabric state are isolated by instance.', source, (observation) => {
        const failures = Object.entries(observation)
            .filter(([, isolated]) => !isolated)
            .map(([name]) => name)
            .sort();
        return {
            passed: failures.length === 0,
            message: failures.length === 0
                ? 'Strong multi-instance isolation is intact.'
                : `Isolation failed for ${failures.join(', ')}.`,
            details: Object.freeze({ failures: Object.freeze(failures) }),
        };
    });
}
function assertPeerDependencyContract(source) {
    return evaluate('peer-dependency-contract', 'Core and Fabric are peers and are never vendored by the Plugin package.', source, (manifest) => {
        var _a, _b, _c;
        const peerDependencies = (_a = manifest.peerDependencies) !== null && _a !== void 0 ? _a : {};
        const runtimeDependencies = (_b = manifest.dependencies) !== null && _b !== void 0 ? _b : {};
        const optionalDependencies = (_c = manifest.optionalDependencies) !== null && _c !== void 0 ? _c : {};
        const bundled = Array.isArray(manifest.bundledDependencies)
            ? manifest.bundledDependencies
            : [];
        const requiredPeers = ['@bensitu/image-editor', 'fabric'];
        const missingPeers = requiredPeers.filter((dependency) => typeof peerDependencies[dependency] !== 'string');
        const vendored = requiredPeers.filter((dependency) => dependency in runtimeDependencies ||
            dependency in optionalDependencies ||
            bundled.includes(dependency) ||
            manifest.bundledDependencies === true);
        const passed = missingPeers.length === 0 && vendored.length === 0;
        return {
            passed,
            message: passed
                ? 'Core and Fabric peer dependency declarations are valid.'
                : 'Core or Fabric peer dependency declarations are invalid.',
            details: Object.freeze({
                missingPeers: Object.freeze(missingPeers),
                vendored: Object.freeze(vendored),
            }),
        };
    });
}
function assertPackageDoesNotBundleCoreOrFabric(source) {
    return evaluate('package-runtime-externalization', 'The Plugin artifact contains no Core or Fabric runtime module.', source, (observation) => {
        var _a, _b;
        const core = (_a = observation.bundledCoreModules) !== null && _a !== void 0 ? _a : observation.moduleIds.filter(isBundledCoreModule).length;
        const fabric = (_b = observation.bundledFabricModules) !== null && _b !== void 0 ? _b : observation.moduleIds.filter(isBundledFabricModule).length;
        return {
            passed: core === 0 && fabric === 0,
            message: core === 0 && fabric === 0
                ? 'Core and Fabric remain external.'
                : 'The Plugin artifact bundles Core or Fabric.',
            details: Object.freeze({ bundledCoreModules: core, bundledFabricModules: fabric }),
        };
    });
}
function assertBaseImageInvariant(source) {
    return evaluate('base-image-invariant', 'Prohibited Base Image actions are rejected without observable document effects.', source, (observation) => {
        const failed = observation.attempts
            .filter((attempt) => !attempt.rejected ||
            !attempt.documentUnchanged ||
            !attempt.historyUnchanged ||
            !attempt.committedEventAbsent ||
            !attempt.instanceUsable)
            .map((attempt) => attempt.action)
            .sort();
        return {
            passed: observation.attempts.length > 0 && failed.length === 0,
            message: observation.attempts.length > 0 && failed.length === 0
                ? 'Base Image invariants rejected every prohibited action.'
                : 'A prohibited Base Image action produced an observable effect.',
            details: Object.freeze({
                attemptCount: observation.attempts.length,
                failedActions: Object.freeze(failed),
            }),
        };
    });
}
function assertOverlayMutationHistory(source) {
    return evaluate('overlay-mutation-history', 'A committed Overlay mutation owns one transaction, History record, and event.', source, (observation) => {
        const passed = observation.topLevelTransactions === 1 &&
            observation.historyRecords === 1 &&
            observation.committedEvents === 1 &&
            observation.registrationLeaks === 0;
        return {
            passed,
            message: passed
                ? 'Overlay mutation ownership and cleanup are exact.'
                : 'Overlay mutation ownership or cleanup is not exact.',
            details: Object.freeze({ ...observation }),
        };
    });
}
function assertCompoundTransaction(source) {
    return evaluate('compound-transaction', 'Compound work commits one Memento pair, History record, and event with atomic restore.', source, (observation) => {
        const passed = observation.topLevelTransactions === 1 &&
            observation.mementoPairs === 1 &&
            observation.historyRecords === 1 &&
            observation.committedEvents === 1 &&
            observation.undoRestoredAll &&
            observation.redoRestoredAll &&
            observation.participantFailureRolledBackAll &&
            observation.nestedWorkPublishedOnce &&
            observation.activeSelectionAtomic;
        return {
            passed,
            message: passed
                ? 'Compound transaction ownership and restoration are atomic.'
                : 'Compound transaction evidence is incomplete or non-atomic.',
            details: Object.freeze({ ...observation }),
        };
    });
}
function assertSliceMigration(source) {
    return evaluate('slice-migration', 'Plugin-owned Slice migration is deterministic, validated, isolated, and failure-atomic.', source, (observation) => {
        const passed = Number.isSafeInteger(observation.sourceVersion) &&
            Number.isSafeInteger(observation.targetVersion) &&
            observation.sourceVersion < observation.targetVersion &&
            observation.migrated &&
            observation.deterministic &&
            observation.validatedBeforeCommit &&
            observation.failedMigrationMutationCount === 0 &&
            observation.futureVersionTypedFailure &&
            observation.missingPluginPolicyPreserved &&
            observation.privateAccesses === 0;
        return {
            passed,
            message: passed
                ? 'Plugin-owned Slice migration satisfies the public contract.'
                : 'Plugin-owned Slice migration evidence is incomplete.',
            details: Object.freeze({ ...observation }),
        };
    });
}

const CONFORMANCE_PROFILE = '3.0';
const PACKAGE_VERSION = '3.0.0-rc.1';
function describeError(error) {
    if (error instanceof Error)
        return `${error.name}: ${error.message}`;
    return String(error);
}
function assertionResult(id, contract, status, message) {
    return Object.freeze({ id, contract, required: true, status, message });
}
function unavailable(message) {
    return Object.freeze({ status: 'NOT_AVAILABLE', message });
}
function notApplicable(message) {
    return Object.freeze({ status: 'NOT_APPLICABLE', message });
}
async function executeAssertion(id, contract, operation) {
    try {
        const outcome = await operation();
        if (outcome)
            return assertionResult(id, contract, outcome.status, outcome.message);
        return assertionResult(id, contract, 'PASS');
    }
    catch (error) {
        return assertionResult(id, contract, 'FAIL', describeError(error));
    }
}
function createSourcePlugin(plugin, options) {
    var _a, _b;
    const source = (_b = (_a = options.createPlugin) === null || _a === void 0 ? void 0 : _a.call(options)) !== null && _b !== void 0 ? _b : plugin;
    if (source.ref.id !== plugin.ref.id ||
        source.ref.apiVersion !== plugin.ref.apiVersion ||
        source.manifest.version !== plugin.manifest.version) {
        throw new Error('Plugin factory returned a different Plugin identity.');
    }
    return source;
}
function wrapPlugin(source, definition) {
    var _a, _b, _c, _d, _e, _f;
    return Object.freeze({
        ref: source.ref,
        manifest: (_a = definition.manifest) !== null && _a !== void 0 ? _a : source.manifest,
        setup: (_b = definition.setup) !== null && _b !== void 0 ? _b : ((context) => Promise.resolve(source.setup(context))),
        onInit: (_c = definition.onInit) !== null && _c !== void 0 ? _c : ((context) => { var _a; return Promise.resolve((_a = source.onInit) === null || _a === void 0 ? void 0 : _a.call(source, context)).then(() => undefined); }),
        onImageLoaded: (_d = definition.onImageLoaded) !== null && _d !== void 0 ? _d : ((image, context) => { var _a; return Promise.resolve((_a = source.onImageLoaded) === null || _a === void 0 ? void 0 : _a.call(source, image, context)).then(() => undefined); }),
        onImageCleared: (_e = definition.onImageCleared) !== null && _e !== void 0 ? _e : ((context) => { var _a; return Promise.resolve((_a = source.onImageCleared) === null || _a === void 0 ? void 0 : _a.call(source, context)).then(() => undefined); }),
        onDispose: (_f = definition.onDispose) !== null && _f !== void 0 ? _f : ((context) => { var _a; return Promise.resolve((_a = source.onDispose) === null || _a === void 0 ? void 0 : _a.call(source, context)).then(() => undefined); }),
    });
}
async function createFixture(options) {
    var _a, _b, _c, _d;
    const providers = Object.freeze([...((_b = (_a = options.createHostCapabilities) === null || _a === void 0 ? void 0 : _a.call(options)) !== null && _b !== void 0 ? _b : [])]);
    const host = createPluginTestHost({ hostCapabilities: providers });
    const fixture = { host, providers };
    try {
        for (const dependency of (_d = (_c = options.createDependencies) === null || _c === void 0 ? void 0 : _c.call(options)) !== null && _d !== void 0 ? _d : []) {
            await host.install(dependency);
        }
        return fixture;
    }
    catch (error) {
        try {
            await disposeFixture(fixture);
        }
        catch (cleanupFailure) {
            if (cleanupFailure instanceof Error && !('cause' in cleanupFailure)) {
                Object.defineProperty(cleanupFailure, 'cause', { value: error });
            }
            throw cleanupFailure;
        }
        throw error;
    }
}
async function disposeFixture(fixture) {
    var _a;
    const failures = [];
    try {
        await fixture.host.dispose();
    }
    catch (error) {
        failures.push(describeError(error));
    }
    for (const provider of fixture.providers) {
        try {
            await ((_a = provider.verifyCleanup) === null || _a === void 0 ? void 0 : _a.call(provider));
        }
        catch (error) {
            failures.push(describeError(error));
        }
    }
    if (fixture.host.state !== 'disposed')
        failures.push('Plugin test Host was not disposed.');
    if (failures.length > 0) {
        throw new Error(`Plugin test cleanup failed: ${failures.join(' | ')}`);
    }
}
async function useFixture(options, operation) {
    const fixture = await createFixture(options);
    let result;
    let operationFailure;
    try {
        result = await operation(fixture);
    }
    catch (error) {
        operationFailure = error;
    }
    try {
        await disposeFixture(fixture);
    }
    catch (cleanupFailure) {
        if (operationFailure === undefined)
            throw cleanupFailure;
        if (cleanupFailure instanceof Error && !('cause' in cleanupFailure)) {
            Object.defineProperty(cleanupFailure, 'cause', { value: operationFailure });
        }
        throw cleanupFailure;
    }
    if (operationFailure !== undefined)
        throw operationFailure;
    return result;
}
function cloneStateValue(value, seen = new Set()) {
    var _a;
    if (value === null || typeof value === 'string' || typeof value === 'boolean')
        return value;
    if (typeof value === 'number') {
        if (!Number.isFinite(value))
            throw new Error('State fixtures must contain finite numbers.');
        return value;
    }
    if (Array.isArray(value)) {
        if (seen.has(value))
            throw new Error('State fixtures must not contain cycles.');
        seen.add(value);
        const clone = value.map((entry) => cloneStateValue(entry, seen));
        seen.delete(value);
        return clone;
    }
    if (typeof value === 'object') {
        if (seen.has(value))
            throw new Error('State fixtures must not contain cycles.');
        seen.add(value);
        const clone = {};
        for (const key of Object.keys(value).sort()) {
            clone[key] = cloneStateValue((_a = Object.getOwnPropertyDescriptor(value, key)) === null || _a === void 0 ? void 0 : _a.value, seen);
        }
        seen.delete(value);
        return clone;
    }
    throw new Error('State fixtures must be JSON-compatible.');
}
function stateFingerprint(value) {
    return JSON.stringify(cloneStateValue(value));
}
async function assertInstallRollback(plugin, options = {}) {
    return executeAssertion('install-rollback', 'Failed setup removes all scoped registrations and permits a clean installation.', async () => {
        let probeDisposed = false;
        const sentinel = new Error('Forced setup failure.');
        await useFixture(options, async ({ host }) => {
            const source = createSourcePlugin(plugin, options);
            const failing = wrapPlugin(source, {
                setup: async (context) => {
                    context.disposables.add({
                        dispose: () => {
                            probeDisposed = true;
                        },
                    });
                    await source.setup(context);
                    throw sentinel;
                },
            });
            let failure;
            try {
                await host.install(failing);
            }
            catch (error) {
                failure = error;
            }
            if (!(failure instanceof pluginManifest.PluginSetupError) || failure.cause !== sentinel) {
                throw new Error('Forced setup failure did not surface as PluginSetupError.');
            }
            if (host.has(source.ref)) {
                throw new Error('Failed setup left the Plugin API installed.');
            }
        });
        if (!probeDisposed)
            throw new Error('Failed setup leaked a scoped Disposable.');
        await useFixture(options, async ({ host }) => {
            await host.install(createSourcePlugin(plugin, options));
        });
    });
}
async function assertLifecycleOrder(plugin, options = {}) {
    return executeAssertion('lifecycle-order', 'Lifecycle callbacks run in setup, initialization, image, clear, and disposal order.', async () => {
        const observed = [];
        await useFixture(options, async ({ host }) => {
            var _a;
            const source = createSourcePlugin(plugin, options);
            const wrapped = wrapPlugin(source, {
                setup: async (context) => {
                    observed.push('setup');
                    return source.setup(context);
                },
                onInit: async (context) => {
                    var _a;
                    observed.push('initialize');
                    await ((_a = source.onInit) === null || _a === void 0 ? void 0 : _a.call(source, context));
                },
                onImageLoaded: async (image, context) => {
                    var _a;
                    observed.push('image-loaded');
                    await ((_a = source.onImageLoaded) === null || _a === void 0 ? void 0 : _a.call(source, image, context));
                },
                onImageCleared: async (context) => {
                    var _a;
                    observed.push('image-cleared');
                    await ((_a = source.onImageCleared) === null || _a === void 0 ? void 0 : _a.call(source, context));
                },
                onDispose: async (context) => {
                    var _a;
                    observed.push('dispose');
                    await ((_a = source.onDispose) === null || _a === void 0 ? void 0 : _a.call(source, context));
                },
            });
            await host.install(wrapped);
            await host.initialize();
            await host.notifyImageLoaded((_a = options.lifecycleImage) !== null && _a !== void 0 ? _a : Object.freeze({}));
            await host.notifyImageCleared();
        });
        const expected = ['setup', 'initialize', 'image-loaded', 'image-cleared', 'dispose'];
        if (observed.join('|') !== expected.join('|')) {
            throw new Error(`Unexpected lifecycle order: ${observed.join(' -> ')}.`);
        }
    });
}
async function assertNoLeakedRegistrations(plugin, options = {}) {
    return executeAssertion('registration-cleanup', 'Host disposal releases Plugin-owned registrations and Disposables.', async () => {
        let probeDisposed = false;
        await useFixture(options, async ({ host }) => {
            const source = createSourcePlugin(plugin, options);
            await host.install(wrapPlugin(source, {
                setup: async (context) => {
                    context.disposables.add({
                        dispose: () => {
                            probeDisposed = true;
                        },
                    });
                    return source.setup(context);
                },
            }));
            await host.initialize();
        });
        if (!probeDisposed)
            throw new Error('Plugin disposal leaked a scoped Disposable.');
    });
}
async function assertStateRoundTrip(plugin, options = {}) {
    return executeAssertion('state-round-trip', 'Captured Plugin state survives mutation and restoration without semantic drift.', async () => {
        const adapter = options.stateRoundTrip;
        if (adapter === undefined) {
            return unavailable('No state round-trip adapter was supplied.');
        }
        if (adapter === 'not-applicable') {
            return notApplicable('The Plugin declares no persistent state.');
        }
        await useFixture(options, async ({ host }) => {
            const api = await host.install(createSourcePlugin(plugin, options));
            const captured = await adapter.capture(api);
            const protectedState = cloneStateValue(captured);
            const before = stateFingerprint(protectedState);
            await adapter.mutate(api);
            const mutated = stateFingerprint(await adapter.capture(api));
            if (mutated === before) {
                throw new Error('State mutation did not change the captured fixture.');
            }
            await adapter.restore(api, protectedState);
            const restored = stateFingerprint(await adapter.capture(api));
            if (restored !== before) {
                throw new Error('Restored Plugin state differs from the captured fixture.');
            }
        });
        return undefined;
    });
}
async function assertMissingCapabilityFailure(plugin, options = {}) {
    return executeAssertion('missing-capability', 'A missing required Capability fails before Plugin setup starts.', async () => {
        const missingToken = pluginManifest.createCapabilityToken('testing:missing-capability', '1.0.0');
        await useFixture(options, async ({ host }) => {
            var _a;
            const source = createSourcePlugin(plugin, options);
            let setupCalls = 0;
            const manifest = {
                ...source.manifest,
                requires: [
                    ...((_a = source.manifest.requires) !== null && _a !== void 0 ? _a : []),
                    { token: missingToken, range: '^1.0.0' },
                ],
            };
            const wrapped = wrapPlugin(source, {
                manifest,
                setup: async (context) => {
                    setupCalls += 1;
                    return source.setup(context);
                },
            });
            let failure;
            try {
                await host.install(wrapped);
            }
            catch (error) {
                failure = error;
            }
            if (!(failure instanceof pluginManifest.CapabilityMissingError) ||
                failure.capabilityId !== missingToken.id) {
                throw new Error('Missing Capability did not produce the typed failure.');
            }
            if (setupCalls !== 0) {
                throw new Error('Plugin setup ran before required Capability validation.');
            }
        });
    });
}
async function assertOptionalCapabilityFallback(plugin, options = {}) {
    return executeAssertion('optional-capability-fallback', 'An unavailable optional Capability resolves to null without blocking setup.', async () => {
        const optionalToken = pluginManifest.createCapabilityToken('testing:optional-capability', '1.0.0');
        await useFixture(options, async ({ host }) => {
            var _a;
            const source = createSourcePlugin(plugin, options);
            let observedFallback = false;
            const manifest = {
                ...source.manifest,
                optional: [
                    ...((_a = source.manifest.optional) !== null && _a !== void 0 ? _a : []),
                    { token: optionalToken, range: '^1.0.0' },
                ],
            };
            await host.install(wrapPlugin(source, {
                manifest,
                setup: async (context) => {
                    observedFallback =
                        context.capabilities.optional(optionalToken) === null;
                    return source.setup(context);
                },
            }));
            if (!observedFallback) {
                throw new Error('Optional Capability did not resolve to null.');
            }
        });
    });
}
async function assertPermissionDeclarationMatchesUsage(plugin, options = {}) {
    return executeAssertion('permission-declaration', 'Manifest permissions authorize every privileged Host Capability used by setup.', async () => {
        await useFixture(options, async ({ host }) => {
            await host.install(createSourcePlugin(plugin, options));
        });
    });
}
async function assertPersistentKindCodecCoverage(plugin, options = {}) {
    return executeAssertion('persistent-codec-coverage', 'Every persistent object Kind provides a complete, versioned Codec.', async () => {
        const inspection = options.persistentKinds;
        if (inspection === undefined) {
            return unavailable('No persistent Kind inspection was supplied.');
        }
        if (inspection === 'not-applicable') {
            return notApplicable('The Plugin registers no persistent object Kinds.');
        }
        return useFixture(options, async ({ host, providers }) => {
            const api = await host.install(createSourcePlugin(plugin, options));
            const definitions = await inspection.inspect(api, providers);
            const persistent = definitions.filter((definition) => definition.persistence.mode === 'persistent');
            if (persistent.length === 0) {
                return notApplicable('The Plugin registers no persistent object Kinds.');
            }
            for (const definition of persistent) {
                const persistence = definition.persistence;
                if (persistence.mode !== 'persistent')
                    continue;
                const codec = persistence.codec;
                if (codec.type.trim().length === 0 ||
                    !pluginManifest.isValidSemVer(codec.version) ||
                    typeof codec.serialize !== 'function' ||
                    typeof codec.validate !== 'function' ||
                    typeof codec.deserialize !== 'function') {
                    throw new Error(`Persistent Kind "${definition.id}" has an incomplete Codec.`);
                }
            }
            return undefined;
        });
    });
}
async function assertTypeInferenceFixtures(runFixtures) {
    return executeAssertion('type-inference-fixtures', 'Published type fixtures preserve Plugin, Plan, Capability, configuration, and testing inference.', async () => {
        if (!runFixtures)
            return unavailable('No type fixture runner was supplied.');
        await runFixtures();
        return undefined;
    });
}
async function runPluginConformance(plugin, options) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    if (options.profile !== CONFORMANCE_PROFILE) {
        throw new RangeError(`Unsupported Plugin conformance profile "${options.profile}".`);
    }
    const assertions = [];
    assertions.push(await assertInstallRollback(plugin, options));
    assertions.push(await assertLifecycleOrder(plugin, options));
    assertions.push(await assertNoLeakedRegistrations(plugin, options));
    assertions.push(await assertStateRoundTrip(plugin, options));
    assertions.push(await assertMissingCapabilityFailure(plugin, options));
    assertions.push(await assertOptionalCapabilityFallback(plugin, options));
    assertions.push(await assertPermissionDeclarationMatchesUsage(plugin, options));
    assertions.push(await assertPersistentKindCodecCoverage(plugin, options));
    assertions.push(await assertTypeInferenceFixtures(options.typeInferenceFixtures));
    assertions.push(await assertBundleIsolation((_a = options.responsibilities) === null || _a === void 0 ? void 0 : _a.bundleIsolation));
    assertions.push(await assertNoUndeclaredFabricGlobalMutation((_b = options.responsibilities) === null || _b === void 0 ? void 0 : _b.fabricGlobalMutation));
    assertions.push(await assertStrongMultiInstanceIsolation((_c = options.responsibilities) === null || _c === void 0 ? void 0 : _c.multiInstanceIsolation));
    assertions.push(await assertPeerDependencyContract((_d = options.responsibilities) === null || _d === void 0 ? void 0 : _d.peerDependencyContract));
    assertions.push(await assertPackageDoesNotBundleCoreOrFabric((_e = options.responsibilities) === null || _e === void 0 ? void 0 : _e.packageModules));
    assertions.push(await assertBaseImageInvariant((_f = options.responsibilities) === null || _f === void 0 ? void 0 : _f.baseImageInvariant));
    assertions.push(await assertOverlayMutationHistory((_g = options.responsibilities) === null || _g === void 0 ? void 0 : _g.overlayMutationHistory));
    assertions.push(await assertCompoundTransaction((_h = options.responsibilities) === null || _h === void 0 ? void 0 : _h.compoundTransaction));
    assertions.push(await assertSliceMigration((_j = options.responsibilities) === null || _j === void 0 ? void 0 : _j.sliceMigration));
    const failed = assertions.some((assertion) => assertion.status === 'FAIL' ||
        (assertion.required && assertion.status === 'NOT_AVAILABLE'));
    return Object.freeze({
        schemaVersion: 1,
        profile: CONFORMANCE_PROFILE,
        packageVersion: PACKAGE_VERSION,
        coreApiVersion: pluginManifest.CORE_API_VERSION,
        plugin: Object.freeze({
            id: plugin.manifest.id,
            version: plugin.manifest.version,
            apiVersion: plugin.manifest.apiVersion,
        }),
        assertions: Object.freeze(assertions),
        result: failed ? 'FAIL' : 'PASS',
    });
}

exports.CONFORMANCE_PROFILE = CONFORMANCE_PROFILE;
exports.assertBaseImageInvariant = assertBaseImageInvariant;
exports.assertBundleIsolation = assertBundleIsolation;
exports.assertCompoundTransaction = assertCompoundTransaction;
exports.assertInstallRollback = assertInstallRollback;
exports.assertLifecycleOrder = assertLifecycleOrder;
exports.assertMissingCapabilityFailure = assertMissingCapabilityFailure;
exports.assertNoLeakedRegistrations = assertNoLeakedRegistrations;
exports.assertNoUndeclaredFabricGlobalMutation = assertNoUndeclaredFabricGlobalMutation;
exports.assertOptionalCapabilityFallback = assertOptionalCapabilityFallback;
exports.assertOverlayMutationHistory = assertOverlayMutationHistory;
exports.assertPackageDoesNotBundleCoreOrFabric = assertPackageDoesNotBundleCoreOrFabric;
exports.assertPeerDependencyContract = assertPeerDependencyContract;
exports.assertPermissionDeclarationMatchesUsage = assertPermissionDeclarationMatchesUsage;
exports.assertPersistentKindCodecCoverage = assertPersistentKindCodecCoverage;
exports.assertSliceMigration = assertSliceMigration;
exports.assertStateRoundTrip = assertStateRoundTrip;
exports.assertStrongMultiInstanceIsolation = assertStrongMultiInstanceIsolation;
exports.assertTypeInferenceFixtures = assertTypeInferenceFixtures;
exports.captureFabricGlobalState = captureFabricGlobalState;
exports.createControlledImageDecoder = createControlledImageDecoder;
exports.createDeferredOperation = createDeferredOperation;
exports.createPluginTestFabric = createPluginTestFabric;
exports.createPluginTestHost = createPluginTestHost;
exports.runPluginConformance = runPluginConformance;
//# sourceMappingURL=index.cjs.map
