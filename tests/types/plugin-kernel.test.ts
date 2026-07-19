import {
    PluginManager,
    composePlugins,
    createCapabilityToken,
    definePluginRef,
    type EditorPlugin,
    type PluginRef,
} from '../../src/plugin-kernel/index.js';

type Equal<TLeft, TRight> =
    (<TValue>() => TValue extends TLeft ? 1 : 2) extends <TValue>() => TValue extends TRight ? 1 : 2
        ? true
        : false;
type Expect<TValue extends true> = TValue;

interface MaskApi {
    readonly kind: 'mask';
    create(): void;
}

interface OtherApi {
    readonly kind: 'other';
    remove(): void;
}

const maskRef = definePluginRef<MaskApi>('example-test:types-mask', '1.0.0');
const otherRef = definePluginRef<OtherApi>('example-test:types-other', '1.0.0');
const manager = new PluginManager();
const optionalMask = manager.get(maskRef);
const requiredMask = manager.require(maskRef);
const byId = manager.getById(maskRef.id);

type OptionalMaskInference = Expect<Equal<typeof optionalMask, MaskApi | null>>;
type RequiredMaskInference = Expect<Equal<typeof requiredMask, MaskApi>>;
type StringLookupInference = Expect<Equal<typeof byId, unknown | null>>;

const maskPlugin: EditorPlugin<MaskApi> = {
    ref: maskRef,
    manifest: {
        id: maskRef.id,
        version: '1.0.0',
        apiVersion: maskRef.apiVersion,
        engine: '^3.0.0',
    },
    setup: () => ({ kind: 'mask', create: () => undefined }),
};
const otherPlugin: EditorPlugin<OtherApi> = {
    ref: otherRef,
    manifest: {
        id: otherRef.id,
        version: '1.0.0',
        apiVersion: otherRef.apiVersion,
        engine: '^3.0.0',
    },
    setup: () => ({ kind: 'other', remove: () => undefined }),
};
const compositeRef = definePluginRef<{ readonly mask: MaskApi; readonly other: OtherApi }>(
    'example-test:types-composite',
    '1.0.0',
);
const composite = composePlugins({
    ref: compositeRef,
    version: '1.0.0',
    plugins: [maskPlugin, otherPlugin] as const,
    createApi: ([mask, other]) => ({ mask, other }),
});
const compositeInstall = manager.install(composite);

type CompositeInference = Expect<
    Equal<typeof compositeInstall, Promise<{ readonly mask: MaskApi; readonly other: OtherApi }>>
>;

const capability = createCapabilityToken<{ read(): string }>('example-test:types-port', '1.0.0');

manager.has(maskRef);
manager.has(maskRef.id);

// @ts-expect-error PluginRef is readonly.
maskRef.id = 'changed';
// @ts-expect-error Invariant phantom types prevent API impersonation.
const wrongRef: PluginRef<OtherApi> = maskRef;
// @ts-expect-error String lookup returns unknown and cannot be treated as a Mask API.
const unsafeMask: MaskApi = manager.getById(maskRef.id);
// @ts-expect-error CapabilityToken and PluginRef have distinct contracts.
manager.get(capability);

void optionalMask;
void requiredMask;
void byId;
void compositeInstall;
void wrongRef;
void unsafeMask;
export type Assertions =
    OptionalMaskInference | RequiredMaskInference | StringLookupInference | CompositeInference;
