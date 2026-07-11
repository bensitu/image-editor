import assert from 'node:assert/strict';
import test from 'node:test';

import {
    CapabilityConflictError,
    CapabilityRegistry,
    InvalidCapabilityVersionError,
    InvalidPluginDefinitionError,
    PluginCapabilityError,
    createCapabilityToken,
    definePluginRef,
} from '../../src/plugin-kernel/index.js';

test('PluginRef and CapabilityToken validate and freeze their identities', () => {
    const ref = definePluginRef('example.test/plugin', '1.2.3');
    const token = createCapabilityToken('example.test/capability', '2.0.0');
    const buildMetadataRef = definePluginRef('example.test/build-metadata', '1.0.0+build.7');

    assert.equal(Object.isFrozen(ref), true);
    assert.equal(Object.isFrozen(token), true);
    assert.equal(buildMetadataRef.apiVersion, '1.0.0+build.7');
    assert.throws(() => definePluginRef('', '1.0.0'), InvalidPluginDefinitionError);
    assert.throws(
        () => definePluginRef('example.test/plugin', 'not-semver'),
        InvalidPluginDefinitionError,
    );
    assert.throws(
        () => createCapabilityToken('example.test/capability', '1'),
        InvalidCapabilityVersionError,
    );
});

test('required capability resolution distinguishes missing, incompatible, and compatible', () => {
    const registry = new CapabilityRegistry();
    const token = createCapabilityToken('example.test/port', '1.4.0');

    assert.throws(
        () => registry.require({ token, range: '^1.0.0' }, 'consumer.missing'),
        (error) => {
            assert.ok(error instanceof PluginCapabilityError);
            assert.equal(error.consumerPluginId, 'consumer.missing');
            assert.equal(error.capabilityId, token.id);
            assert.equal(error.requestedRange, '^1.0.0');
            assert.equal(error.reason, 'missing');
            assert.match(error.message, /consumer\.missing/);
            assert.match(error.message, /example\.test\/port/);
            return true;
        },
    );

    const port = Object.freeze({ value: 42 });
    registry.provide(token, port, 'provider.one');
    assert.equal(registry.require({ token, range: '^1.0.0' }, 'consumer.compatible'), port);
    assert.throws(
        () => registry.require({ token, range: '^2.0.0' }, 'consumer.incompatible'),
        (error) => {
            assert.ok(error instanceof PluginCapabilityError);
            assert.equal(error.installedVersion, '1.4.0');
            assert.equal(error.providerPluginId, 'provider.one');
            assert.equal(error.reason, 'incompatible');
            assert.match(error.message, /\^2\.0\.0/);
            assert.match(error.message, /1\.4\.0/);
            assert.match(error.message, /provider\.one/);
            return true;
        },
    );
});

test('optional capability policy is silent when missing and warns when incompatible', () => {
    const warnings = [];
    const registry = new CapabilityRegistry({ warningSink: (warning) => warnings.push(warning) });
    const token = createCapabilityToken('example.test/optional', '1.1.0');

    assert.equal(registry.optional({ token, range: '^1.0.0' }, 'consumer'), null);
    assert.deepEqual(warnings, []);

    registry.provide(token, { enabled: true }, 'provider.optional');
    assert.equal(registry.optional({ token, range: '^2.0.0' }, 'consumer'), null);
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].code, 'OPTIONAL_CAPABILITY_INCOMPATIBLE');
    assert.equal(warnings[0].pluginId, 'consumer');
    assert.deepEqual(warnings[0].details, {
        capabilityId: token.id,
        requestedRange: '^2.0.0',
        installedVersion: '1.1.0',
        providerPluginId: 'provider.optional',
        optionalIntegrationDisabled: true,
    });
    assert.deepEqual(registry.optional({ token, range: '^1.0.0' }, 'consumer'), { enabled: true });
});

test('invalid ranges are reported as capability errors before setup can continue', () => {
    const registry = new CapabilityRegistry();
    const token = createCapabilityToken('example.test/range', '1.0.0');
    registry.provide(token, {}, 'provider.range');

    assert.throws(
        () => registry.require({ token, range: '' }, 'consumer.range'),
        (error) => {
            assert.ok(error instanceof PluginCapabilityError);
            assert.equal(error.reason, 'invalid-range');
            assert.ok(error.cause instanceof InvalidCapabilityVersionError);
            return true;
        },
    );
});

test('provider conflicts never use last-write-wins', () => {
    const registry = new CapabilityRegistry();
    const token = createCapabilityToken('example.test/single-provider', '1.0.0');
    const first = { provider: 1 };
    registry.provide(token, first, 'provider.first');

    assert.throws(
        () => registry.provide(token, { provider: 2 }, 'provider.second'),
        CapabilityConflictError,
    );
    assert.equal(registry.require({ token, range: '*' }, 'consumer'), first);
});

test('same-scope identical provider registration is idempotent and provisional providers are hidden', () => {
    const registry = new CapabilityRegistry();
    const token = createCapabilityToken('example.test/provisional', '1.0.0');
    const transactionId = Symbol('transaction');
    const implementation = { ready: true };
    const first = registry.providePending(
        token,
        implementation,
        'provider.provisional',
        transactionId,
    );
    const duplicate = registry.providePending(
        token,
        implementation,
        'provider.provisional',
        transactionId,
    );

    assert.throws(
        () => registry.require({ token, range: '^1.0.0' }, 'consumer'),
        (error) => error instanceof PluginCapabilityError && error.reason === 'incomplete',
    );
    duplicate.commit();
    first.commit();
    assert.equal(registry.require({ token, range: '^1.0.0' }, 'consumer'), implementation);
    duplicate.dispose();
    assert.equal(registry.has(token), true);
    first.dispose();
    assert.equal(registry.has(token), false);
});

test('prerelease providers only satisfy ranges that explicitly admit prereleases', () => {
    const registry = new CapabilityRegistry();
    const token = createCapabilityToken('example.test/prerelease', '1.0.0-beta.2');
    registry.provide(token, { prerelease: true }, 'provider.prerelease');

    assert.throws(
        () => registry.require({ token, range: '^1.0.0' }, 'consumer.stable'),
        PluginCapabilityError,
    );
    assert.deepEqual(registry.require({ token, range: '^1.0.0-beta.1' }, 'consumer.prerelease'), {
        prerelease: true,
    });
});
