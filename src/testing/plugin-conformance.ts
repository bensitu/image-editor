/**
 * Runs the public Plugin conformance profile for lifecycle, rollback, state, permissions, and packaging.
 *
 * @module
 */

import { isDangerousStateKey } from '../plugin-kernel/plugin-identifier.js';
import type { PluginLifecycleContext, PluginSetupContext } from '../plugin-kernel/plugin-types.js';
import { isValidSemVer } from '../plugin-kernel/semver.js';
import {
    CapabilityMissingError,
    CORE_API_VERSION,
    PluginSetupError,
    createCapabilityToken,
    type EditorPlugin,
    type PluginManifest,
} from '../sdk/index.js';
import type {
    ConformanceAssertionResult,
    ConformanceAssertionStatus,
} from './conformance-types.js';
import {
    createPluginTestHost,
    type PluginTestCapabilityProvider,
    type PluginTestHost,
} from './plugin-test-host.js';
import {
    assertBaseImageInvariant,
    assertBundleIsolation,
    assertCompoundTransaction,
    assertNoUndeclaredFabricGlobalMutation,
    assertOverlayMutationHistory,
    assertPackageDoesNotBundleCoreOrFabric,
    assertPeerDependencyContract,
    assertSliceMigration,
    assertStrongMultiInstanceIsolation,
    type ResponsibilityAssertionOptions,
} from './responsibility-assertions.js';

export const CONFORMANCE_PROFILE = '3.0' as const;

export type {
    ConformanceAssertionResult,
    ConformanceAssertionStatus,
} from './conformance-types.js';

const PACKAGE_VERSION = '3.0.0-rc.1';

export interface PluginConformanceReport {
    readonly schemaVersion: 1;
    readonly profile: typeof CONFORMANCE_PROFILE;
    readonly packageVersion: string;
    readonly coreApiVersion: string;
    readonly plugin: Readonly<{
        id: string;
        version: string;
        apiVersion: string;
    }>;
    readonly assertions: readonly ConformanceAssertionResult[];
    readonly result: 'PASS' | 'FAIL';
}

export type PluginFactory<TApi, TEvents extends object = object> = () => EditorPlugin<
    TApi,
    TEvents
>;

export interface StateRoundTripAdapter<TApi, TState> {
    capture(api: TApi): TState | Promise<TState>;
    mutate(api: TApi): void | Promise<void>;
    restore(api: TApi, state: TState): void | Promise<void>;
}

export interface PersistentKindContract {
    readonly id: string;
    readonly persistence:
        | Readonly<{ mode: 'transient' }>
        | Readonly<{
              mode: 'persistent';
              codec: Readonly<{
                  type: string;
                  version: string;
                  serialize: unknown;
                  validate: unknown;
                  deserialize: unknown;
              }>;
          }>;
}

export interface PersistentKindInspection<TApi> {
    inspect(
        api: TApi,
        providers: readonly PluginTestCapabilityProvider[],
    ): readonly PersistentKindContract[] | Promise<readonly PersistentKindContract[]>;
}

export interface PluginAssertionOptions<TApi, TEvents extends object = object, TState = unknown> {
    readonly createPlugin?: PluginFactory<TApi, TEvents>;
    readonly createDependencies?: () => readonly EditorPlugin<unknown, TEvents>[];
    readonly createHostCapabilities?: () => readonly PluginTestCapabilityProvider[];
    readonly lifecycleImage?: unknown;
    readonly stateRoundTrip?: StateRoundTripAdapter<TApi, TState> | 'not-applicable';
    readonly persistentKinds?: PersistentKindInspection<TApi> | 'not-applicable';
    readonly typeInferenceFixtures?: () => void | Promise<void>;
    readonly responsibilities?: ResponsibilityAssertionOptions;
}

export interface PluginConformanceOptions<
    TApi,
    TEvents extends object = object,
    TState = unknown,
> extends PluginAssertionOptions<TApi, TEvents, TState> {
    readonly profile: typeof CONFORMANCE_PROFILE;
}

interface Fixture<TEvents extends object> {
    readonly host: PluginTestHost<TEvents>;
    readonly providers: readonly PluginTestCapabilityProvider[];
}

interface AssertionOutcome {
    readonly status: 'NOT_APPLICABLE' | 'NOT_AVAILABLE';
    readonly message: string;
}

type AssertionOperation = () => void | AssertionOutcome | Promise<void | AssertionOutcome>;

function describeError(error: unknown): string {
    if (error instanceof Error) return `${error.name}: ${error.message}`;
    return String(error);
}

function assertionResult(
    id: string,
    contract: string,
    status: ConformanceAssertionStatus,
    message?: string,
): ConformanceAssertionResult {
    return Object.freeze({ id, contract, required: true, status, message });
}

function unavailable(message: string): AssertionOutcome {
    return Object.freeze({ status: 'NOT_AVAILABLE', message });
}

function notApplicable(message: string): AssertionOutcome {
    return Object.freeze({ status: 'NOT_APPLICABLE', message });
}

async function executeAssertion(
    id: string,
    contract: string,
    operation: AssertionOperation,
): Promise<ConformanceAssertionResult> {
    try {
        const outcome = await operation();
        if (outcome) return assertionResult(id, contract, outcome.status, outcome.message);
        return assertionResult(id, contract, 'PASS');
    } catch (error) {
        return assertionResult(id, contract, 'FAIL', describeError(error));
    }
}

function createSourcePlugin<TApi, TEvents extends object>(
    plugin: EditorPlugin<TApi, TEvents>,
    options: PluginAssertionOptions<TApi, TEvents, unknown>,
): EditorPlugin<TApi, TEvents> {
    const source = options.createPlugin?.() ?? plugin;
    if (
        source.ref.id !== plugin.ref.id ||
        source.ref.apiVersion !== plugin.ref.apiVersion ||
        source.manifest.version !== plugin.manifest.version
    ) {
        throw new Error('Plugin factory returned a different Plugin identity.');
    }
    return source;
}

function wrapPlugin<TApi, TEvents extends object>(
    source: EditorPlugin<TApi, TEvents>,
    definition: {
        readonly manifest?: PluginManifest;
        readonly setup?: (context: PluginSetupContext<TEvents>) => Promise<TApi>;
        readonly onInit?: (context: PluginLifecycleContext<TEvents>) => Promise<void>;
        readonly onImageLoaded?: (
            image: unknown,
            context: PluginLifecycleContext<TEvents>,
        ) => Promise<void>;
        readonly onImageCleared?: (context: PluginLifecycleContext<TEvents>) => Promise<void>;
        readonly onDispose?: (context: PluginLifecycleContext<TEvents>) => Promise<void>;
    },
): EditorPlugin<TApi, TEvents> {
    return Object.freeze({
        ref: source.ref,
        manifest: definition.manifest ?? source.manifest,
        setup:
            definition.setup ??
            ((context: PluginSetupContext<TEvents>) => Promise.resolve(source.setup(context))),
        onInit:
            definition.onInit ??
            ((context: PluginLifecycleContext<TEvents>) =>
                Promise.resolve(source.onInit?.(context)).then(() => undefined)),
        onImageLoaded:
            definition.onImageLoaded ??
            ((image: unknown, context: PluginLifecycleContext<TEvents>) =>
                Promise.resolve(source.onImageLoaded?.(image, context)).then(() => undefined)),
        onImageCleared:
            definition.onImageCleared ??
            ((context: PluginLifecycleContext<TEvents>) =>
                Promise.resolve(source.onImageCleared?.(context)).then(() => undefined)),
        onDispose:
            definition.onDispose ??
            ((context: PluginLifecycleContext<TEvents>) =>
                Promise.resolve(source.onDispose?.(context)).then(() => undefined)),
    });
}

async function createFixture<TApi, TEvents extends object>(
    options: PluginAssertionOptions<TApi, TEvents, unknown>,
): Promise<Fixture<TEvents>> {
    const providers = Object.freeze([...(options.createHostCapabilities?.() ?? [])]);
    const host = createPluginTestHost<TEvents>({ hostCapabilities: providers });
    const fixture = { host, providers };
    try {
        for (const dependency of options.createDependencies?.() ?? []) {
            await host.install(dependency);
        }
        return fixture;
    } catch (error) {
        try {
            await disposeFixture(fixture);
        } catch (cleanupFailure) {
            if (cleanupFailure instanceof Error && !('cause' in cleanupFailure)) {
                Object.defineProperty(cleanupFailure, 'cause', { value: error });
            }
            throw cleanupFailure;
        }
        throw error;
    }
}

async function disposeFixture<TEvents extends object>(fixture: Fixture<TEvents>): Promise<void> {
    const failures: string[] = [];
    try {
        await fixture.host.dispose();
    } catch (error) {
        failures.push(describeError(error));
    }
    for (const provider of fixture.providers) {
        try {
            await provider.verifyCleanup?.();
        } catch (error) {
            failures.push(describeError(error));
        }
    }
    if (fixture.host.state !== 'disposed') failures.push('Plugin test Host was not disposed.');
    if (failures.length > 0) {
        throw new Error(`Plugin test cleanup failed: ${failures.join(' | ')}`);
    }
}

async function useFixture<TApi, TEvents extends object, TResult>(
    options: PluginAssertionOptions<TApi, TEvents, unknown>,
    operation: (fixture: Fixture<TEvents>) => TResult | Promise<TResult>,
): Promise<TResult> {
    const fixture = await createFixture(options);
    let result: TResult | undefined;
    let operationFailure: unknown;
    try {
        result = await operation(fixture);
    } catch (error) {
        operationFailure = error;
    }
    try {
        await disposeFixture(fixture);
    } catch (cleanupFailure) {
        if (operationFailure === undefined) throw cleanupFailure;
        if (cleanupFailure instanceof Error && !('cause' in cleanupFailure)) {
            Object.defineProperty(cleanupFailure, 'cause', { value: operationFailure });
        }
        throw cleanupFailure;
    }
    if (operationFailure !== undefined) throw operationFailure;
    return result as TResult;
}

function cloneStateValue(value: unknown, seen = new Set<object>()): unknown {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) throw new Error('State fixtures must contain finite numbers.');
        return value;
    }
    if (Array.isArray(value)) {
        if (seen.has(value)) throw new Error('State fixtures must not contain cycles.');
        seen.add(value);
        const clone = value.map((entry) => cloneStateValue(entry, seen));
        seen.delete(value);
        return clone;
    }
    if (typeof value === 'object') {
        if (seen.has(value)) throw new Error('State fixtures must not contain cycles.');
        seen.add(value);
        const clone = Object.create(null) as Record<string, unknown>;
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

function stateFingerprint(value: unknown): string {
    return JSON.stringify(cloneStateValue(value));
}

export async function assertInstallRollback<TApi, TEvents extends object = object>(
    plugin: EditorPlugin<TApi, TEvents>,
    options: PluginAssertionOptions<TApi, TEvents> = {},
): Promise<ConformanceAssertionResult> {
    return executeAssertion(
        'install-rollback',
        'Failed setup removes all scoped registrations and permits a clean installation.',
        async () => {
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
                let failure: unknown;
                try {
                    await host.install(failing);
                } catch (error) {
                    failure = error;
                }
                if (!(failure instanceof PluginSetupError) || failure.cause !== sentinel) {
                    throw new Error('Forced setup failure did not surface as PluginSetupError.');
                }
                if (host.has(source.ref)) {
                    throw new Error('Failed setup left the Plugin API installed.');
                }
            });
            if (!probeDisposed) throw new Error('Failed setup leaked a scoped Disposable.');

            await useFixture(options, async ({ host }) => {
                await host.install(createSourcePlugin(plugin, options));
            });
        },
    );
}

export async function assertLifecycleOrder<TApi, TEvents extends object = object>(
    plugin: EditorPlugin<TApi, TEvents>,
    options: PluginAssertionOptions<TApi, TEvents> = {},
): Promise<ConformanceAssertionResult> {
    return executeAssertion(
        'lifecycle-order',
        'Lifecycle callbacks run in setup, initialization, image, clear, and disposal order.',
        async () => {
            const observed: string[] = [];
            await useFixture(options, async ({ host }) => {
                const source = createSourcePlugin(plugin, options);
                const wrapped = wrapPlugin(source, {
                    setup: async (context) => {
                        observed.push('setup');
                        return source.setup(context);
                    },
                    onInit: async (context) => {
                        observed.push('initialize');
                        await source.onInit?.(context);
                    },
                    onImageLoaded: async (image, context) => {
                        observed.push('image-loaded');
                        await source.onImageLoaded?.(image, context);
                    },
                    onImageCleared: async (context) => {
                        observed.push('image-cleared');
                        await source.onImageCleared?.(context);
                    },
                    onDispose: async (context) => {
                        observed.push('dispose');
                        await source.onDispose?.(context);
                    },
                });
                await host.install(wrapped);
                await host.initialize();
                await host.notifyImageLoaded(options.lifecycleImage ?? Object.freeze({}));
                await host.notifyImageCleared();
            });
            const expected = ['setup', 'initialize', 'image-loaded', 'image-cleared', 'dispose'];
            if (observed.join('|') !== expected.join('|')) {
                throw new Error(`Unexpected lifecycle order: ${observed.join(' -> ')}.`);
            }
        },
    );
}

export async function assertNoLeakedRegistrations<TApi, TEvents extends object = object>(
    plugin: EditorPlugin<TApi, TEvents>,
    options: PluginAssertionOptions<TApi, TEvents> = {},
): Promise<ConformanceAssertionResult> {
    return executeAssertion(
        'registration-cleanup',
        'Host disposal releases Plugin-owned registrations and Disposables.',
        async () => {
            let probeDisposed = false;
            await useFixture(options, async ({ host }) => {
                const source = createSourcePlugin(plugin, options);
                await host.install(
                    wrapPlugin(source, {
                        setup: async (context) => {
                            context.disposables.add({
                                dispose: () => {
                                    probeDisposed = true;
                                },
                            });
                            return source.setup(context);
                        },
                    }),
                );
                await host.initialize();
            });
            if (!probeDisposed) throw new Error('Plugin disposal leaked a scoped Disposable.');
        },
    );
}

export async function assertStateRoundTrip<TApi, TEvents extends object = object, TState = unknown>(
    plugin: EditorPlugin<TApi, TEvents>,
    options: PluginAssertionOptions<TApi, TEvents, TState> = {},
): Promise<ConformanceAssertionResult> {
    return executeAssertion(
        'state-round-trip',
        'Captured Plugin state survives mutation and restoration without semantic drift.',
        async () => {
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
                const protectedState = cloneStateValue(captured) as TState;
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
        },
    );
}

export async function assertMissingCapabilityFailure<TApi, TEvents extends object = object>(
    plugin: EditorPlugin<TApi, TEvents>,
    options: PluginAssertionOptions<TApi, TEvents> = {},
): Promise<ConformanceAssertionResult> {
    return executeAssertion(
        'missing-capability',
        'A missing required Capability fails before Plugin setup starts.',
        async () => {
            const missingToken = createCapabilityToken<unknown>(
                'testing:missing-capability',
                '1.0.0',
            );
            await useFixture(options, async ({ host }) => {
                const source = createSourcePlugin(plugin, options);
                let setupCalls = 0;
                const manifest = {
                    ...source.manifest,
                    requires: [
                        ...(source.manifest.requires ?? []),
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
                let failure: unknown;
                try {
                    await host.install(wrapped);
                } catch (error) {
                    failure = error;
                }
                if (
                    !(failure instanceof CapabilityMissingError) ||
                    failure.capabilityId !== missingToken.id
                ) {
                    throw new Error('Missing Capability did not produce the typed failure.');
                }
                if (setupCalls !== 0) {
                    throw new Error('Plugin setup ran before required Capability validation.');
                }
            });
        },
    );
}

export async function assertOptionalCapabilityFallback<TApi, TEvents extends object = object>(
    plugin: EditorPlugin<TApi, TEvents>,
    options: PluginAssertionOptions<TApi, TEvents> = {},
): Promise<ConformanceAssertionResult> {
    return executeAssertion(
        'optional-capability-fallback',
        'An unavailable optional Capability resolves to null without blocking setup.',
        async () => {
            const optionalToken = createCapabilityToken<unknown>(
                'testing:optional-capability',
                '1.0.0',
            );
            await useFixture(options, async ({ host }) => {
                const source = createSourcePlugin(plugin, options);
                let observedFallback = false;
                const manifest = {
                    ...source.manifest,
                    optional: [
                        ...(source.manifest.optional ?? []),
                        { token: optionalToken, range: '^1.0.0' },
                    ],
                };
                await host.install(
                    wrapPlugin(source, {
                        manifest,
                        setup: async (context) => {
                            observedFallback =
                                context.capabilities.optional(optionalToken) === null;
                            return source.setup(context);
                        },
                    }),
                );
                if (!observedFallback) {
                    throw new Error('Optional Capability did not resolve to null.');
                }
            });
        },
    );
}

export async function assertPermissionDeclarationMatchesUsage<
    TApi,
    TEvents extends object = object,
>(
    plugin: EditorPlugin<TApi, TEvents>,
    options: PluginAssertionOptions<TApi, TEvents> = {},
): Promise<ConformanceAssertionResult> {
    return executeAssertion(
        'permission-declaration',
        'Manifest permissions authorize every privileged Host Capability used by setup.',
        async () => {
            await useFixture(options, async ({ host }) => {
                await host.install(createSourcePlugin(plugin, options));
            });
        },
    );
}

export async function assertPersistentKindCodecCoverage<TApi, TEvents extends object = object>(
    plugin: EditorPlugin<TApi, TEvents>,
    options: PluginAssertionOptions<TApi, TEvents> = {},
): Promise<ConformanceAssertionResult> {
    return executeAssertion(
        'persistent-codec-coverage',
        'Every persistent object Kind provides a complete, versioned Codec.',
        async () => {
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
                const persistent = definitions.filter(
                    (definition) => definition.persistence.mode === 'persistent',
                );
                if (persistent.length === 0) {
                    return notApplicable('The Plugin registers no persistent object Kinds.');
                }
                for (const definition of persistent) {
                    const persistence = definition.persistence;
                    if (persistence.mode !== 'persistent') continue;
                    const codec = persistence.codec;
                    if (
                        codec.type.trim().length === 0 ||
                        !isValidSemVer(codec.version) ||
                        typeof codec.serialize !== 'function' ||
                        typeof codec.validate !== 'function' ||
                        typeof codec.deserialize !== 'function'
                    ) {
                        throw new Error(
                            `Persistent Kind "${definition.id}" has an incomplete Codec.`,
                        );
                    }
                }
                return undefined;
            });
        },
    );
}

export async function assertTypeInferenceFixtures(
    runFixtures?: () => void | Promise<void>,
): Promise<ConformanceAssertionResult> {
    return executeAssertion(
        'type-inference-fixtures',
        'Published type fixtures preserve Plugin, Plan, Capability, configuration, and testing inference.',
        async () => {
            if (!runFixtures) return unavailable('No type fixture runner was supplied.');
            await runFixtures();
            return undefined;
        },
    );
}

/** Runs the required Plugin contracts and returns a deterministic machine report. */
export async function runPluginConformance<TApi, TEvents extends object = object, TState = unknown>(
    plugin: EditorPlugin<TApi, TEvents>,
    options: PluginConformanceOptions<TApi, TEvents, TState>,
): Promise<PluginConformanceReport> {
    if (options.profile !== CONFORMANCE_PROFILE) {
        throw new RangeError(`Unsupported Plugin conformance profile "${options.profile}".`);
    }
    const assertions: ConformanceAssertionResult[] = [];
    assertions.push(await assertInstallRollback(plugin, options));
    assertions.push(await assertLifecycleOrder(plugin, options));
    assertions.push(await assertNoLeakedRegistrations(plugin, options));
    assertions.push(await assertStateRoundTrip(plugin, options));
    assertions.push(await assertMissingCapabilityFailure(plugin, options));
    assertions.push(await assertOptionalCapabilityFallback(plugin, options));
    assertions.push(await assertPermissionDeclarationMatchesUsage(plugin, options));
    assertions.push(await assertPersistentKindCodecCoverage(plugin, options));
    assertions.push(await assertTypeInferenceFixtures(options.typeInferenceFixtures));
    assertions.push(await assertBundleIsolation(options.responsibilities?.bundleIsolation));
    assertions.push(
        await assertNoUndeclaredFabricGlobalMutation(
            options.responsibilities?.fabricGlobalMutation,
        ),
    );
    assertions.push(
        await assertStrongMultiInstanceIsolation(options.responsibilities?.multiInstanceIsolation),
    );
    assertions.push(
        await assertPeerDependencyContract(options.responsibilities?.peerDependencyContract),
    );
    assertions.push(
        await assertPackageDoesNotBundleCoreOrFabric(options.responsibilities?.packageModules),
    );
    assertions.push(await assertBaseImageInvariant(options.responsibilities?.baseImageInvariant));
    assertions.push(
        await assertOverlayMutationHistory(options.responsibilities?.overlayMutationHistory),
    );
    assertions.push(await assertCompoundTransaction(options.responsibilities?.compoundTransaction));
    assertions.push(await assertSliceMigration(options.responsibilities?.sliceMigration));

    const failed = assertions.some(
        (assertion) =>
            assertion.status === 'FAIL' ||
            (assertion.required && assertion.status === 'NOT_AVAILABLE'),
    );
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
