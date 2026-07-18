import assert from 'node:assert/strict';
import test from 'node:test';

import {
    CapabilityMissingError,
    CapabilityVersionError,
    PluginSetupError,
    createCapabilityToken,
    definePlugin,
    definePluginRef,
} from '../../src/sdk/index.js';
import { PluginManager } from '../../src/plugin-kernel/plugin-manager.js';

function defineTestPlugin(ref, options = {}) {
    return definePlugin({
        ref,
        manifest: {
            id: ref.id,
            version: '1.0.0',
            apiVersion: ref.apiVersion,
            engine: '^3.0.0',
            requiresPlugins: options.requiresPlugins,
            requires: options.requires,
            optional: options.optional,
        },
        setupMode: 'sync',
        setup: options.setup ?? (() => Object.freeze({ ready: true })),
    });
}

test('required Capability failures distinguish missing and incompatible providers', () => {
    const token = createCapabilityToken('example:versioned-reader', '2.0.0');
    const missingRef = definePluginRef('example:missing-reader-consumer', '1.0.0');
    const missing = defineTestPlugin(missingRef, {
        requires: [{ token, range: '^2.0.0' }],
    });
    const missingManager = new PluginManager();

    assert.throws(() => missingManager.installSync(missing), CapabilityMissingError);
    missingManager.disposeSync();

    const providerRef = definePluginRef('example:reader-provider', '1.0.0');
    const consumerRef = definePluginRef('example:reader-consumer', '1.0.0');
    const provider = defineTestPlugin(providerRef, {
        setup: (context) => {
            context.capabilities.provide(token, Object.freeze({ read: () => 'value' }), {
                version: '2.0.0',
            });
            return Object.freeze({ ready: true });
        },
    });
    const incompatible = defineTestPlugin(consumerRef, {
        requiresPlugins: [providerRef],
        requires: [{ token, range: '^1.0.0' }],
    });
    const incompatibleManager = new PluginManager();
    incompatibleManager.installSync(provider);

    assert.throws(() => incompatibleManager.installSync(incompatible), CapabilityVersionError);
    incompatibleManager.disposeSync();
});

test('provider runtime version must match its Capability Token declaration', () => {
    const token = createCapabilityToken('example:provider-version', '1.2.0');
    const ref = definePluginRef('example:provider-version-plugin', '1.0.0');
    const plugin = defineTestPlugin(ref, {
        setup: (context) => {
            context.capabilities.provide(token, Object.freeze({ ready: true }), {
                version: '1.3.0',
            });
            return Object.freeze({ ready: true });
        },
    });
    const manager = new PluginManager();

    assert.throws(
        () => manager.installSync(plugin),
        (error) => {
            assert.ok(error instanceof PluginSetupError);
            assert.ok(error.cause instanceof CapabilityVersionError);
            return true;
        },
    );
    assert.equal(manager.get(ref), null);
    manager.disposeSync();
});

test('optional incompatible Capability returns null and emits a structured Warning', () => {
    const warnings = [];
    const token = createCapabilityToken('example:optional-reader', '2.0.0');
    const providerRef = definePluginRef('example:optional-provider', '1.0.0');
    const consumerRef = definePluginRef('example:optional-consumer', '1.0.0');
    const provider = defineTestPlugin(providerRef, {
        setup: (context) => {
            context.capabilities.provide(token, Object.freeze({ read: () => 'value' }), {
                version: token.version,
            });
            return Object.freeze({ ready: true });
        },
    });
    const consumer = defineTestPlugin(consumerRef, {
        requiresPlugins: [providerRef],
        optional: [{ token, range: '^1.0.0' }],
        setup: (context) => {
            assert.equal(context.capabilities.optional(token), null);
            return Object.freeze({ ready: true });
        },
    });
    const manager = new PluginManager({ warningSink: (warning) => warnings.push(warning) });

    manager.installBatchSync([consumer, provider]);

    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].code, 'OPTIONAL_CAPABILITY_INCOMPATIBLE');
    assert.equal(warnings[0].details.optionalIntegrationDisabled, true);
    manager.disposeSync();
});

test('optional Capability status distinguishes missing, incompatible, and available providers', () => {
    const token = createCapabilityToken('example:optional-status-reader', '2.0.0');
    const providerRef = definePluginRef('example:optional-status-provider', '1.0.0');
    const provider = defineTestPlugin(providerRef, {
        setup: (context) => {
            context.capabilities.provide(token, Object.freeze({ read: () => 'value' }), {
                version: token.version,
            });
            return Object.freeze({ ready: true });
        },
    });
    const installConsumer = (manager, id, range) => {
        const ref = definePluginRef(id, '1.0.0');
        return manager.installSync(
            defineTestPlugin(ref, {
                optional: [{ token, range }],
                setup: (context) =>
                    Object.freeze({
                        value: context.capabilities.optional(token),
                        status: context.capabilities.getOptionalStatus(token),
                    }),
            }),
        );
    };

    const missingManager = new PluginManager();
    assert.deepEqual(installConsumer(missingManager, 'example:optional-status-missing', '^2.0.0'), {
        value: null,
        status: 'missing',
    });
    missingManager.disposeSync();

    const incompatibleManager = new PluginManager();
    incompatibleManager.installSync(provider);
    assert.deepEqual(
        installConsumer(incompatibleManager, 'example:optional-status-incompatible', '^1.0.0'),
        { value: null, status: 'incompatible' },
    );
    incompatibleManager.disposeSync();

    const availableManager = new PluginManager();
    availableManager.installSync(provider);
    const available = installConsumer(
        availableManager,
        'example:optional-status-available',
        '^2.0.0',
    );
    assert.equal(available.status, 'available');
    assert.equal(available.value.read(), 'value');
    availableManager.disposeSync();
});

test('a configurable Plugin validates and swaps complete configuration atomically', () => {
    const ref = definePluginRef('example:atomic-configuration', '1.0.0');
    let configuration = Object.freeze({ minimum: 1, maximum: 5 });
    const plugin = defineTestPlugin(ref, {
        setup: () =>
            Object.freeze({
                configure(patch) {
                    const next = Object.freeze({ ...configuration, ...patch });
                    if (
                        !Number.isFinite(next.minimum) ||
                        !Number.isFinite(next.maximum) ||
                        next.minimum > next.maximum
                    ) {
                        throw new RangeError('Configuration range is invalid.');
                    }
                    configuration = next;
                },
                getConfiguration: () => configuration,
            }),
    });
    const manager = new PluginManager();
    const api = manager.installSync(plugin);

    api.configure({ maximum: 8 });
    const committed = api.getConfiguration();
    assert.deepEqual(committed, { minimum: 1, maximum: 8 });
    assert.equal(Object.isFrozen(committed), true);
    assert.throws(() => api.configure({ minimum: 9 }), RangeError);
    assert.equal(api.getConfiguration(), committed);
    manager.disposeSync();
});
