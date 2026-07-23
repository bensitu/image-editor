import assert from 'node:assert/strict';
import test from 'node:test';

import * as sdk from '../../src/sdk/index.js';
import { PluginManager } from '../../src/plugin-kernel/plugin-manager.js';

const {
    PluginApiVersionError,
    PluginEngineVersionError,
    PluginIdentityConflictError,
    PluginManifestError,
    createCapabilityToken,
    definePlugin,
    definePluginRef,
} = sdk;

function createSurfacePlugin(overrides = {}) {
    const ref = overrides.ref ?? definePluginRef('example:surface-plugin', '1.0.0');
    return definePlugin({
        ref,
        manifest: {
            id: ref.id,
            version: '1.2.3',
            apiVersion: ref.apiVersion,
            engine: '^3.0.0',
            requiresPlugins: [],
            requires: [],
            optional: [],
            permissions: ['fabric:canvas-read'],
            ...overrides.manifest,
        },
        setupMode: 'sync',
        setup: overrides.setup ?? (() => Object.freeze({ answer: 42 })),
    });
}

test('public SDK exports contracts without concrete Kernel implementations', () => {
    for (const exportName of [
        'definePlugin',
        'definePluginRef',
        'createCapabilityToken',
        'isValidSemVer',
        'composePlugins',
        'PluginError',
        'PluginManifestError',
        'PluginPermissionError',
        'FABRIC_RUNTIME_CAPABILITY',
        'BASE_IMAGE_INFO_CAPABILITY',
        'BASE_IMAGE_READ_CAPABILITY',
        'CANVAS_READ_CAPABILITY',
        'CANVAS_RESIZE_CAPABILITY',
        'CORE_DIAGNOSTICS_CAPABILITY',
        'CORE_PRESENTATION_CAPABILITY',
        'CORE_STATUS_CAPABILITY',
        'DOCUMENT_MUTATION_CAPABILITY',
        'EXPORT_CONTRIBUTION_CAPABILITY',
        'GEOMETRY_MUTATION_CAPABILITY',
        'IMAGE_RESOURCE_POLICY_CAPABILITY',
        'MEMENTO_HISTORY_CAPABILITY',
        'RASTER_MUTATION_CAPABILITY',
        'RENDER_REQUEST_CAPABILITY',
        'SNAPSHOT_REGISTRATION_CAPABILITY',
        'VISIBLE_RASTER_BAKE_CAPABILITY',
    ]) {
        assert.ok(exportName in sdk, `${exportName} must be exported by the SDK entry`);
    }

    for (const internalName of [
        'PluginManager',
        'CapabilityRegistry',
        'OperationRegistry',
        'RegistrationScope',
        'CORE_ENVIRONMENT_CAPABILITY',
    ]) {
        assert.equal(internalName in sdk, false, `${internalName} must remain internal`);
    }
});

test('plugin identities, manifests, dependency lists, and permissions are immutable', () => {
    const dependencyRef = definePluginRef('example:dependency', '1.0.0');
    const capability = createCapabilityToken('example:read-port', '1.0.0');
    const optionalCapability = createCapabilityToken('example:optional-port', '1.0.0');
    const plugin = createSurfacePlugin({
        manifest: {
            requiresPlugins: [dependencyRef],
            requires: [{ token: capability, range: '^1.0.0' }],
            optional: [{ token: optionalCapability, range: '^1.0.0' }],
            permissions: ['fabric:canvas-read'],
        },
    });

    assert.equal(Object.isFrozen(plugin), true);
    assert.equal(Object.isFrozen(plugin.ref), true);
    assert.equal(Object.isFrozen(plugin.manifest), true);
    assert.equal(Object.isFrozen(plugin.manifest.requiresPlugins), true);
    assert.equal(Object.isFrozen(plugin.manifest.requires), true);
    assert.equal(Object.isFrozen(plugin.manifest.optional), true);
    assert.equal(Object.isFrozen(plugin.manifest.permissions), true);
});

test('public SDK requires the synchronous Plugin installation contract', () => {
    const ref = definePluginRef('example:missing-sync-contract', '1.0.0');
    assert.throws(
        () =>
            definePlugin({
                ref,
                manifest: {
                    id: ref.id,
                    version: '1.0.0',
                    apiVersion: ref.apiVersion,
                    engine: '^3.0.0',
                },
                setup: () => Object.freeze({ ready: true }),
            }),
        /setupMode "sync"/,
    );
});

test('manifest validation rejects identity, API, engine, and permission failures before setup', async (t) => {
    const scenarios = [
        {
            name: 'identity',
            error: PluginIdentityConflictError,
            manifest: { id: 'example:different-plugin' },
        },
        {
            name: 'API version',
            error: PluginApiVersionError,
            manifest: { apiVersion: '2.0.0' },
        },
        {
            name: 'engine range',
            error: PluginEngineVersionError,
            manifest: { engine: '^4.0.0' },
        },
        {
            name: 'permission',
            error: PluginManifestError,
            manifest: { permissions: ['fabric:unknown-access'] },
        },
    ];

    for (const scenario of scenarios) {
        await t.test(scenario.name, async () => {
            const manager = new PluginManager();
            const ref = definePluginRef(
                `example:${scenario.name.toLowerCase().replaceAll(' ', '-')}`,
                '1.0.0',
            );
            let setupCalls = 0;
            const plugin = {
                ref,
                manifest: {
                    id: ref.id,
                    version: '1.0.0',
                    apiVersion: ref.apiVersion,
                    engine: '^3.0.0',
                    ...scenario.manifest,
                },
                setup() {
                    setupCalls += 1;
                    return {};
                },
            };

            await assert.rejects(manager.install(plugin), scenario.error);
            assert.equal(setupCalls, 0);
            await manager.dispose();
        });
    }
});

test('manifest input limits reject unsafe identities and excessive dependency lists', () => {
    assert.throws(() => definePluginRef('__proto__:pollution', '1.0.0'), PluginManifestError);
    assert.throws(
        () => definePluginRef(`example:${'x'.repeat(128)}`, '1.0.0'),
        PluginManifestError,
    );

    const ref = definePluginRef('example:dependency-limit', '1.0.0');
    const dependencies = Array.from({ length: 65 }, (_, index) =>
        definePluginRef(`example:dependency-${index}`, '1.0.0'),
    );
    assert.throws(
        () =>
            createSurfacePlugin({
                ref,
                manifest: { requiresPlugins: dependencies },
            }),
        PluginManifestError,
    );
});
