import assert from 'node:assert/strict';
import test from 'node:test';

import {
    CapabilityConflictError,
    CapabilityMissingError,
    CapabilityVersionError,
    InvalidCapabilityVersionError,
    InvalidPluginDefinitionError,
    OperationConflictError,
    OperationRegistrationError,
    PluginAggregateError,
    PluginAlreadyInstalledError,
    PluginApiVersionError,
    PluginBatchInstallError,
    PluginCapabilityError,
    PluginDefinitionConflictError,
    PluginDependencyCycleError,
    PluginDependencyError,
    PluginEngineVersionError,
    PluginError,
    PluginIdentityConflictError,
    PluginKernelDisposedError,
    PluginKernelStateError,
    PluginLifecycleError,
    PluginManifestError,
    PluginNotInstalledError,
    PluginPermissionError,
    PluginSetupError,
    PluginVersionMismatchError,
    ToolRegistrationError,
    ToolTransitionError,
} from '../../src/plugin-kernel/errors.js';

test('Plugin Kernel errors retain stable public names and enumerable diagnostics', () => {
    const errors = [
        new PluginError('EXAMPLE', 'example'),
        new PluginManifestError('example'),
        new PluginIdentityConflictError('example-test:ref', 'example-test:manifest'),
        new PluginEngineVersionError('example-test:plugin', '^2.0.0', '3.0.0'),
        new PluginApiVersionError('example-test:plugin', '1.0.0', '2.0.0'),
        new PluginAggregateError('example', []),
        new PluginAlreadyInstalledError('example-test:plugin'),
        new PluginNotInstalledError('example-test:plugin'),
        new PluginDependencyError({
            consumerPluginId: 'example-test:consumer',
            dependencyId: 'example-test:dependency',
            requiredApiVersion: '1.0.0',
            availablePluginIds: [],
            planHint: 'Install the dependency.',
        }),
        new PluginDependencyCycleError(['example-test:a', 'example-test:a']),
        new PluginDefinitionConflictError('example-test:plugin'),
        new PluginBatchInstallError(new Error('example')),
        new PluginPermissionError('example-test:plugin', 'fabric:objects', 'fabric:object-access'),
        new CapabilityMissingError({
            consumerPluginId: 'example-test:plugin',
            capabilityId: 'example:test',
            requestedRange: '^1.0.0',
            availableProviders: [],
        }),
        new CapabilityVersionError({
            capabilityId: 'example:test',
            expectedRange: '^1.0.0',
            actualVersion: '2.0.0',
        }),
        new PluginCapabilityError({
            consumerPluginId: 'example-test:plugin',
            capabilityId: 'example:test',
            requestedRange: '^1.0.0',
            reason: 'missing',
        }),
        new CapabilityConflictError(
            'example:test',
            'example-test:installed',
            'example-test:conflicting',
        ),
        new PluginLifecycleError('example-test:plugin', 'init', new Error('example')),
        new PluginSetupError('example-test:plugin', new Error('example')),
        new InvalidPluginDefinitionError('example'),
        new InvalidCapabilityVersionError('example:test', 'invalid', 'version'),
        new PluginVersionMismatchError('example-test:plugin', '1.0.0', '2.0.0', '1.0.0', '2.0.0'),
        new OperationRegistrationError('example'),
        new OperationConflictError('example'),
        new ToolRegistrationError('example'),
        new ToolTransitionError('example:tool', 'failed'),
        new PluginKernelDisposedError('run an operation'),
        new PluginKernelStateError('run an operation', 'initializing'),
    ];

    for (const error of errors) {
        assert.equal(error.name, error.constructor.name);
        assert.equal(error instanceof Error, true);
        assert.equal(Object.keys(error).includes('name'), true);
    }
});
