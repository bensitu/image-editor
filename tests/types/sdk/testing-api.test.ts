import { expectTypeOf } from 'expect-type';

import type { OverlayKindDefinition } from '../../../src/foundations/overlay/index.js';
import {
    composePlugins,
    createCapabilityToken,
    definePlugin,
    definePluginRef,
    type ConfigurablePluginApi,
    type PluginPlan,
    type PluginRef,
} from '../../../src/sdk/index.js';
import {
    createPluginTestHost,
    runPluginConformance,
    type PluginConformanceReport,
    type PluginTestCapabilityProvider,
    type PersistentKindContract,
    type PersistentKindInspection,
} from '../../../src/testing/index.js';

interface ReaderPort {
    read(): string;
}

interface ExampleApi extends ConfigurablePluginApi<{ readonly enabled: boolean }> {
    getStatus(): 'ready';
}

interface UnrelatedApi {
    reset(): void;
}

const readerCapability = createCapabilityToken<ReaderPort>('testing:type-reader', '1.0.0');
const exampleRef = definePluginRef<ExampleApi>('testing:type-plugin', '1.0.0');
const unrelatedRef = definePluginRef<UnrelatedApi>('testing:type-unrelated', '1.0.0');
const plugin = definePlugin({
    ref: exampleRef,
    manifest: {
        id: exampleRef.id,
        version: '1.0.0',
        apiVersion: exampleRef.apiVersion,
        engine: '^3.0.0',
        requires: [{ token: readerCapability, range: '^1.0.0' }],
    },
    setupMode: 'sync',
    setup: (context): ExampleApi => {
        context.capabilities.require(readerCapability).read();
        return {
            configure: () => undefined,
            getConfiguration: () => Object.freeze({ enabled: true }),
            getStatus: () => 'ready',
        };
    },
});
const provider: PluginTestCapabilityProvider<ReaderPort> = {
    token: readerCapability,
    implementation: { read: () => 'value' },
};
declare const overlayKinds: readonly OverlayKindDefinition[];
declare const inspectionApi: ExampleApi;
const persistentKinds: PersistentKindInspection<ExampleApi> = {
    inspect: () => overlayKinds,
};
const inspectedKinds = persistentKinds.inspect(inspectionApi, [provider]);
const host = createPluginTestHost({ hostCapabilities: [provider] });
const installed = host.install(plugin);
const plan = composePlugins({ example: plugin });
const report = runPluginConformance(plugin, {
    profile: '3.0',
    createPlugin: () => plugin,
    createHostCapabilities: () => [provider],
    stateRoundTrip: 'not-applicable',
    persistentKinds: 'not-applicable',
    typeInferenceFixtures: () => undefined,
});

expectTypeOf(installed).toEqualTypeOf<Promise<ExampleApi>>();
expectTypeOf(plan).toMatchTypeOf<PluginPlan<{ readonly example: ExampleApi }>>();
expectTypeOf(provider.implementation.read()).toEqualTypeOf<string>();
expectTypeOf(inspectedKinds).toEqualTypeOf<
    readonly PersistentKindContract[] | Promise<readonly PersistentKindContract[]>
>();
expectTypeOf(report).toEqualTypeOf<Promise<PluginConformanceReport>>();
expectTypeOf(plugin.setup).returns.toMatchTypeOf<ExampleApi>();

// @ts-expect-error A reference with a different API contract is not assignable.
const wrongReference: PluginRef<UnrelatedApi> = exampleRef;
// @ts-expect-error A Plugin API cannot be inferred from an unrelated reference.
const wrongApi: ExampleApi = host.get(unrelatedRef);

void wrongReference;
void wrongApi;
