import { ImageEditorCore, type FabricModule } from '../../../src/core/index.js';
import {
    composePlugins,
    createCapabilityToken,
    definePlugin,
    definePluginRef,
    type CapabilityProviderDefinition,
    type ConfigurablePluginApi,
    type PluginRef,
} from '../../../src/sdk/index.js';

type Equal<TLeft, TRight> =
    (<TValue>() => TValue extends TLeft ? 1 : 2) extends <TValue>() => TValue extends TRight ? 1 : 2
        ? true
        : false;
type Expect<TValue extends true> = TValue;

interface CounterApi extends ConfigurablePluginApi<{ readonly step: number }> {
    increment(): number;
}

interface UnrelatedApi {
    reset(): void;
}

declare const fabricModule: FabricModule;

const counterRef = definePluginRef<CounterApi>('example:counter', '1.0.0');
const unrelatedRef = definePluginRef<UnrelatedApi>('example:unrelated', '1.0.0');
const counterPlugin = definePlugin({
    ref: counterRef,
    manifest: {
        id: counterRef.id,
        version: '1.0.0',
        apiVersion: counterRef.apiVersion,
        engine: '^3.0.0',
    },
    setupMode: 'sync',
    setup: (): CounterApi => ({
        configure: () => undefined,
        getConfiguration: () => Object.freeze({ step: 1 }),
        increment: () => 1,
    }),
});

const editor = new ImageEditorCore(fabricModule);
const installed = editor.use(counterPlugin);
const optional = editor.getPlugin(counterRef);
const required = editor.requirePlugin(counterRef);
const plan = composePlugins({ counter: counterPlugin });
const planApis = editor.install(plan);
const tupleApis = editor.install([counterPlugin] as const);

type InstalledInference = Expect<Equal<typeof installed, CounterApi>>;
type OptionalInference = Expect<Equal<typeof optional, CounterApi | null>>;
type RequiredInference = Expect<Equal<typeof required, CounterApi>>;
type PlanInference = Expect<Equal<typeof planApis, { readonly counter: CounterApi }>>;
type TupleInference = Expect<Equal<typeof tupleApis, readonly [CounterApi]>>;

const capability = createCapabilityToken<{ read(): string }>('example:reader', '1.0.0');
const provider: CapabilityProviderDefinition<{ read(): string }> = {
    token: capability,
    implementation: { read: () => 'value' },
    version: '1.0.0',
};

// @ts-expect-error A reference for another API must not satisfy this lookup.
const wrongReference: PluginRef<UnrelatedApi> = counterRef;
// @ts-expect-error A counter API cannot be assigned from an unrelated reference lookup.
const wrongApi: CounterApi = editor.requirePlugin(unrelatedRef);
const wrongProvider: CapabilityProviderDefinition<{ read(): string }> = {
    token: capability,
    // @ts-expect-error Capability implementations must satisfy the token Port.
    implementation: { read: () => 1 },
    version: '1.0.0',
};

definePlugin({
    ref: definePluginRef<{ readonly ready: true }>('example:typed-provider', '1.0.0'),
    manifest: {
        id: 'example:typed-provider',
        version: '1.0.0',
        apiVersion: '1.0.0',
        engine: '^3.0.0',
    },
    setupMode: 'sync',
    setup: (context) => {
        context.capabilities.provide(
            capability,
            { read: () => 'value' },
            {
                version: capability.version,
                requiredPermission: 'fabric:canvas-read',
            },
        );
        context.capabilities.provide(
            capability,
            // @ts-expect-error Provider implementations must match the Token Port.
            { read: () => 1 },
            {
                version: capability.version,
            },
        );
        return { ready: true } as const;
    },
});

const asynchronousDefinition = {
    ref: definePluginRef<{ readonly ready: true }>('example:async-provider', '1.0.0'),
    manifest: {
        id: 'example:async-provider',
        version: '1.0.0',
        apiVersion: '1.0.0',
        engine: '^3.0.0',
    },
    setupMode: 'sync' as const,
    setup: async () => ({ ready: true }) as const,
};
// @ts-expect-error The public SDK accepts synchronous Plugin setup only.
definePlugin(asynchronousDefinition);

void installed;
void optional;
void required;
void planApis;
void tupleApis;
void provider;
void wrongReference;
void wrongApi;
void wrongProvider;
export type Assertions =
    InstalledInference | OptionalInference | RequiredInference | PlanInference | TupleInference;
