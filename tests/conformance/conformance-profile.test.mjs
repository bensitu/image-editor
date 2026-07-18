import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

import {
    CONFORMANCE_PROFILE,
    assertBaseImageInvariant,
    assertBundleIsolation,
    assertCompoundTransaction,
    assertInstallRollback,
    assertLifecycleOrder,
    assertMissingCapabilityFailure,
    assertNoLeakedRegistrations,
    assertNoUndeclaredFabricGlobalMutation,
    assertOptionalCapabilityFallback,
    assertOverlayMutationHistory,
    assertPackageDoesNotBundleCoreOrFabric,
    assertPeerDependencyContract,
    assertPermissionDeclarationMatchesUsage,
    assertPersistentKindCodecCoverage,
    assertSliceMigration,
    assertStateRoundTrip,
    assertStrongMultiInstanceIsolation,
    assertTypeInferenceFixtures,
    runPluginConformance,
} from '../../src/testing/index.js';
import { fabric } from '../helpers/fabric-environment.mjs';
import {
    createSyntheticDependencies,
    createSyntheticHostCapabilities,
    createSyntheticPlugin,
    syntheticPersistentKinds,
    syntheticStateRoundTrip,
} from './fixtures/synthetic-plugin.mjs';

const assertionFunctions = [
    assertInstallRollback,
    assertLifecycleOrder,
    assertMissingCapabilityFailure,
    assertNoLeakedRegistrations,
    assertOptionalCapabilityFallback,
    assertPermissionDeclarationMatchesUsage,
    assertPersistentKindCodecCoverage,
    assertStateRoundTrip,
    assertTypeInferenceFixtures,
    assertBundleIsolation,
    assertNoUndeclaredFabricGlobalMutation,
    assertStrongMultiInstanceIsolation,
    assertPeerDependencyContract,
    assertPackageDoesNotBundleCoreOrFabric,
    assertBaseImageInvariant,
    assertOverlayMutationHistory,
    assertCompoundTransaction,
    assertSliceMigration,
];

const execFileAsync = promisify(execFile);

async function runTypeInferenceFixtures() {
    await execFileAsync(
        process.execPath,
        [
            path.resolve('node_modules/typescript/bin/tsc'),
            '-p',
            'tests/types/tsconfig.json',
            '--noEmit',
        ],
        { cwd: process.cwd(), windowsHide: true },
    );
}

function conformanceOptions() {
    return {
        profile: CONFORMANCE_PROFILE,
        createPlugin: createSyntheticPlugin,
        createDependencies: createSyntheticDependencies,
        createHostCapabilities: createSyntheticHostCapabilities,
        stateRoundTrip: syntheticStateRoundTrip,
        persistentKinds: syntheticPersistentKinds,
        typeInferenceFixtures: runTypeInferenceFixtures,
        responsibilities: {
            bundleIsolation: {
                moduleIds: ['synthetic-plugin.js'],
                internalImports: 0,
                privateAliases: 0,
                unknownModules: 0,
            },
            fabricGlobalMutation: {
                fabric,
                importModule: () => ({ create: createSyntheticPlugin }),
                createDefinition: (module) => module.create(),
                setup: () => Object.freeze({ ready: true }),
                dispose: () => undefined,
            },
            multiInstanceIsolation: {
                coreRegistriesIsolated: true,
                pluginStateIsolated: true,
                operationsIsolated: true,
                toolsIsolated: true,
                overlayIndexesIsolated: true,
                historyIsolated: true,
                fabricGlobalStateIsolated: true,
            },
            peerDependencyContract: {
                peerDependencies: {
                    '@bensitu/image-editor': '^3.0.0-0',
                    fabric: '>=7.4.0 <8',
                },
            },
            packageModules: { moduleIds: ['synthetic-plugin.js'] },
            baseImageInvariant: {
                attempts: [
                    {
                        action: 'synthetic-prohibited-action',
                        rejected: true,
                        documentUnchanged: true,
                        historyUnchanged: true,
                        committedEventAbsent: true,
                        instanceUsable: true,
                    },
                ],
            },
            overlayMutationHistory: {
                topLevelTransactions: 1,
                historyRecords: 1,
                committedEvents: 1,
                registrationLeaks: 0,
            },
            compoundTransaction: {
                topLevelTransactions: 1,
                mementoPairs: 1,
                historyRecords: 1,
                committedEvents: 1,
                undoRestoredAll: true,
                redoRestoredAll: true,
                participantFailureRolledBackAll: true,
                nestedWorkPublishedOnce: true,
                activeSelectionAtomic: true,
            },
            sliceMigration: {
                sourceVersion: 1,
                targetVersion: 2,
                migrated: true,
                deterministic: true,
                validatedBeforeCommit: true,
                failedMigrationMutationCount: 0,
                futureVersionTypedFailure: true,
                missingPluginPolicyPreserved: true,
                privateAccesses: 0,
            },
        },
    };
}

test('testing entry publishes every required assertion', () => {
    for (const assertion of assertionFunctions) assert.equal(typeof assertion, 'function');
});

test('synthetic public-entry Plugin passes every required contract', async () => {
    const plugin = createSyntheticPlugin();
    const report = await runPluginConformance(plugin, conformanceOptions());
    const packageManifest = JSON.parse(await readFile('package.json', 'utf8'));

    assert.equal(report.schemaVersion, 1);
    assert.equal(report.profile, '3.0');
    assert.equal(report.packageVersion, packageManifest.version);
    assert.equal(report.coreApiVersion, '3.0.0');
    assert.deepEqual(report.plugin, {
        id: 'testing:synthetic-plugin',
        version: '1.2.3',
        apiVersion: '1.0.0',
    });
    assert.equal(report.assertions.length, 18);
    assert.equal(
        report.assertions.every((result) => result.required),
        true,
    );
    assert.equal(
        report.assertions.every((result) => result.status === 'PASS'),
        true,
    );
    assert.equal(report.result, 'PASS');
});

test('conformance output is deterministic and independent of a prior run', async () => {
    const first = await runPluginConformance(createSyntheticPlugin(), conformanceOptions());
    const second = await runPluginConformance(createSyntheticPlugin(), conformanceOptions());
    assert.deepEqual(second, first);
});

test('missing adapters are reported as unavailable and cannot produce an overall pass', async () => {
    const plugin = createSyntheticPlugin();
    const state = await assertStateRoundTrip(plugin, {
        createPlugin: createSyntheticPlugin,
        createDependencies: createSyntheticDependencies,
        createHostCapabilities: createSyntheticHostCapabilities,
    });
    const types = await assertTypeInferenceFixtures();
    assert.equal(state.status, 'NOT_AVAILABLE');
    assert.equal(types.status, 'NOT_AVAILABLE');

    const report = await runPluginConformance(plugin, {
        ...conformanceOptions(),
        stateRoundTrip: undefined,
    });
    assert.equal(report.result, 'FAIL');
    assert.equal(
        report.assertions.some((result) => result.status === 'NOT_AVAILABLE'),
        true,
    );
});

test('incomplete persistent Codec produces a contract failure', async () => {
    const result = await assertPersistentKindCodecCoverage(createSyntheticPlugin(), {
        createPlugin: createSyntheticPlugin,
        createDependencies: createSyntheticDependencies,
        createHostCapabilities: createSyntheticHostCapabilities,
        persistentKinds: {
            inspect: () => [
                {
                    id: 'testing:incomplete-kind',
                    persistence: {
                        mode: 'persistent',
                        codec: {
                            type: '',
                            version: 'not-semver',
                            serialize: () => ({}),
                            validate: () => true,
                            deserialize: () => ({}),
                        },
                    },
                },
            ],
        },
    });
    assert.equal(result.status, 'FAIL');
    assert.match(result.message, /incomplete Codec/);
});
