import { StateSliceRegistry } from '../../../src/core/index.js';
import { OVERLAY_REGISTRATION_CAPABILITY } from '../../../src/foundations/overlay/index.js';
import { createCapabilityToken, definePlugin, definePluginRef } from '../../../src/sdk/index.js';
import { createDeferredOperation } from '../../../src/testing/index.js';

export const syntheticDependencyRef = definePluginRef('testing:synthetic-dependency', '1.0.0');
export const syntheticPluginRef = definePluginRef('testing:synthetic-plugin', '1.0.0');

const clockCapability = createCapabilityToken('testing:clock', '1.0.0');
const stateRegistrationCapability = createCapabilityToken('testing:state-registration', '1.0.0');

function createRegistration(collection, value) {
    collection.push(value);
    let active = true;
    return {
        dispose() {
            if (!active) return;
            active = false;
            const index = collection.indexOf(value);
            if (index >= 0) collection.splice(index, 1);
        },
    };
}

function assertConfiguration(value) {
    if (
        typeof value !== 'object' ||
        value === null ||
        !Number.isSafeInteger(value.count) ||
        value.count < 0 ||
        typeof value.label !== 'string'
    ) {
        throw new TypeError('Synthetic configuration is invalid.');
    }
}

export function createSyntheticDependencies() {
    return [
        definePlugin({
            ref: syntheticDependencyRef,
            manifest: {
                id: syntheticDependencyRef.id,
                version: '1.0.0',
                apiVersion: syntheticDependencyRef.apiVersion,
                engine: '^3.0.0',
            },
            setupMode: 'sync',
            setup: () => Object.freeze({ label: 'dependency-ready' }),
        }),
    ];
}

export function createSyntheticHostCapabilities() {
    const stateRegistry = new StateSliceRegistry();
    const kinds = [];
    const geometryPolicies = [];
    const interactionPolicies = [];
    const renderers = [];
    const overlayRegistration = Object.freeze({
        registerKind: (definition) => createRegistration(kinds, definition),
        registerGeometryPolicy: (definition) => createRegistration(geometryPolicies, definition),
        registerInteractionPolicy: (definition) =>
            createRegistration(interactionPolicies, definition),
        registerExportRenderer: (definition) => createRegistration(renderers, definition),
        inspectKinds: () => Object.freeze([...kinds]),
    });
    const stateRegistration = Object.freeze({
        registerSlice: (definition) => stateRegistry.register(definition),
        inspectSlices: () => stateRegistry.list(),
    });

    return [
        {
            token: clockCapability,
            implementation: Object.freeze({ now: () => 42 }),
            providerId: 'testing:clock-host',
        },
        {
            token: stateRegistrationCapability,
            implementation: stateRegistration,
            providerId: 'testing:state-host',
            verifyCleanup() {
                if (stateRegistry.list().length !== 0) {
                    throw new Error('Synthetic State Slice registration leaked.');
                }
                stateRegistry.dispose();
            },
        },
        {
            token: OVERLAY_REGISTRATION_CAPABILITY,
            implementation: overlayRegistration,
            providerId: 'testing:overlay-host',
            requiredPermission: 'fabric:custom-class',
            verifyCleanup() {
                const count =
                    kinds.length +
                    geometryPolicies.length +
                    interactionPolicies.length +
                    renderers.length;
                if (count !== 0) throw new Error('Synthetic Overlay registration leaked.');
            },
        },
    ];
}

export function createSyntheticPlugin() {
    let configuration = Object.freeze({ count: 1, label: 'ready' });
    let disposed = false;

    return definePlugin({
        ref: syntheticPluginRef,
        manifest: {
            id: syntheticPluginRef.id,
            version: '1.2.3',
            apiVersion: syntheticPluginRef.apiVersion,
            engine: '^3.0.0',
            requiresPlugins: [syntheticDependencyRef],
            requires: [
                { token: clockCapability, range: '^1.0.0' },
                { token: stateRegistrationCapability, range: '^1.0.0' },
                { token: OVERLAY_REGISTRATION_CAPABILITY, range: '^1.0.0' },
            ],
            permissions: ['fabric:custom-class'],
        },
        setup(context) {
            const clock = context.capabilities.require(clockCapability);
            const state = context.capabilities.require(stateRegistrationCapability);
            const overlay = context.capabilities.require(OVERLAY_REGISTRATION_CAPABILITY);
            const stateDefinition = Object.freeze({
                id: 'testing:synthetic-state',
                version: 1,
                capture: () => Object.freeze({ ...configuration }),
                validate: (value) => {
                    try {
                        assertConfiguration(value);
                        return { valid: true, value: Object.freeze({ ...value }) };
                    } catch (error) {
                        return { valid: false, message: error.message };
                    }
                },
                restore: (value) => {
                    const operation = createDeferredOperation();
                    operation.resolve();
                    return operation.promise.then(() => {
                        assertConfiguration(value);
                        configuration = Object.freeze({ ...value });
                    });
                },
                clearState: () => {
                    configuration = Object.freeze({ count: 0, label: 'cleared' });
                },
            });
            context.disposables.add(state.registerSlice(stateDefinition));
            context.disposables.add(
                overlay.registerKind({
                    id: 'testing:synthetic-kind',
                    ownerPluginId: syntheticPluginRef.id,
                    classify: (object) => object?.syntheticKind === true,
                    getPersistentId: (object) => object?.syntheticId ?? null,
                    persistence: {
                        mode: 'persistent',
                        codec: {
                            type: 'testing:synthetic-object',
                            version: '1.0.0',
                            serialize: (object) => ({ count: object?.count ?? 0 }),
                            validate: (value) =>
                                typeof value === 'object' &&
                                value !== null &&
                                Number.isSafeInteger(value.count),
                            deserialize: (value) => ({
                                syntheticKind: true,
                                count: value.count,
                            }),
                        },
                    },
                }),
            );
            context.disposables.add({
                dispose() {
                    disposed = true;
                },
            });

            const api = {
                configure(patch) {
                    const candidate = Object.freeze({ ...configuration, ...patch });
                    assertConfiguration(candidate);
                    configuration = candidate;
                },
                getConfiguration: () => Object.freeze({ ...configuration }),
                captureState: () => stateDefinition.capture(),
                async restoreState(value) {
                    const validation = stateDefinition.validate(value);
                    if (!validation.valid) throw new TypeError(validation.message);
                    await stateDefinition.restore(validation.value);
                },
                getClockValue: () => clock.now(),
                isDisposed: () => disposed,
            };
            return Object.freeze(api);
        },
        onInit: () => undefined,
        onImageLoaded: () => undefined,
        onImageCleared: () => undefined,
        onDispose: () => undefined,
    });
}

export const syntheticStateRoundTrip = Object.freeze({
    capture: (api) => api.captureState(),
    mutate: (api) => api.configure({ count: api.getConfiguration().count + 1 }),
    restore: (api, state) => api.restoreState(state),
});

export const syntheticPersistentKinds = Object.freeze({
    inspect(_api, providers) {
        const provider = providers.find(
            (candidate) => candidate.token === OVERLAY_REGISTRATION_CAPABILITY,
        );
        if (!provider) throw new Error('Synthetic Overlay provider is unavailable.');
        return provider.implementation.inspectKinds();
    },
});
