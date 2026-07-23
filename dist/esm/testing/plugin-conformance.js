import { isDangerousStateKey } from '../plugin-kernel/plugin-identifier.js';
import { isValidSemVer } from '../plugin-kernel/semver.js';
import { CapabilityMissingError, CORE_API_VERSION, PluginSetupError, createCapabilityToken, } from '../sdk/index.js';
import { createPluginTestHost, } from './plugin-test-host.js';
import { assertBaseImageInvariant, assertBundleIsolation, assertCompoundTransaction, assertNoUndeclaredFabricGlobalMutation, assertOverlayMutationHistory, assertPackageDoesNotBundleCoreOrFabric, assertPeerDependencyContract, assertSliceMigration, assertStrongMultiInstanceIsolation, } from './responsibility-assertions.js';
export const CONFORMANCE_PROFILE = '3.0';
const PACKAGE_VERSION = '3.0.0-rc.1';
function describeError(error) {
    if (error instanceof Error)
        return `${error.name}: ${error.message}`;
    return String(error);
}
function assertionResult(id, contract, status, message) {
    return Object.freeze({
        id,
        contract,
        required: true,
        status,
        ...(message === undefined ? {} : { message }),
    });
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
        const clone = Object.create(null);
        for (const key of Object.keys(value).sort()) {
            if (isDangerousStateKey(key)) {
                throw new Error(`State fixtures must not contain dangerous key "${key}".`);
            }
            const descriptor = Object.getOwnPropertyDescriptor(value, key);
            if (!descriptor || !('value' in descriptor)) {
                throw new Error('State fixtures must contain only data properties.');
            }
            clone[key] = cloneStateValue(descriptor.value, seen);
        }
        seen.delete(value);
        return clone;
    }
    throw new Error('State fixtures must be JSON-compatible.');
}
function stateFingerprint(value) {
    return JSON.stringify(cloneStateValue(value));
}
export async function assertInstallRollback(plugin, options = {}) {
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
            if (!(failure instanceof PluginSetupError) || failure.cause !== sentinel) {
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
export async function assertLifecycleOrder(plugin, options = {}) {
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
export async function assertNoLeakedRegistrations(plugin, options = {}) {
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
export async function assertStateRoundTrip(plugin, options = {}) {
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
export async function assertMissingCapabilityFailure(plugin, options = {}) {
    return executeAssertion('missing-capability', 'A missing required Capability fails before Plugin setup starts.', async () => {
        const missingToken = createCapabilityToken('testing:missing-capability', '1.0.0');
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
            if (!(failure instanceof CapabilityMissingError) ||
                failure.capabilityId !== missingToken.id) {
                throw new Error('Missing Capability did not produce the typed failure.');
            }
            if (setupCalls !== 0) {
                throw new Error('Plugin setup ran before required Capability validation.');
            }
        });
    });
}
export async function assertOptionalCapabilityFallback(plugin, options = {}) {
    return executeAssertion('optional-capability-fallback', 'An unavailable optional Capability resolves to null without blocking setup.', async () => {
        const optionalToken = createCapabilityToken('testing:optional-capability', '1.0.0');
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
export async function assertPermissionDeclarationMatchesUsage(plugin, options = {}) {
    return executeAssertion('permission-declaration', 'Manifest permissions authorize every privileged Host Capability used by setup.', async () => {
        await useFixture(options, async ({ host }) => {
            await host.install(createSourcePlugin(plugin, options));
        });
    });
}
export async function assertPersistentKindCodecCoverage(plugin, options = {}) {
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
                    !isValidSemVer(codec.version) ||
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
export async function assertTypeInferenceFixtures(runFixtures) {
    return executeAssertion('type-inference-fixtures', 'Published type fixtures preserve Plugin, Plan, Capability, configuration, and testing inference.', async () => {
        if (!runFixtures)
            return unavailable('No type fixture runner was supplied.');
        await runFixtures();
        return undefined;
    });
}
export async function runPluginConformance(plugin, options) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    if (options.profile !== CONFORMANCE_PROFILE) {
        throw new RangeError('Unsupported Plugin conformance profile.');
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
        coreApiVersion: CORE_API_VERSION,
        plugin: Object.freeze({
            id: plugin.manifest.id,
            version: plugin.manifest.version,
            apiVersion: plugin.manifest.apiVersion,
        }),
        assertions: Object.freeze(assertions),
        result: failed ? 'FAIL' : 'PASS',
    });
}
//# sourceMappingURL=plugin-conformance.js.map