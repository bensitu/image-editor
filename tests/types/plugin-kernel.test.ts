import {
    PluginManager,
    createCapabilityToken,
    definePluginRef,
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
const manager = new PluginManager();
const optionalMask = manager.get(maskRef);
const requiredMask = manager.require(maskRef);
const byId = manager.getById(maskRef.id);

type OptionalMaskInference = Expect<Equal<typeof optionalMask, MaskApi | null>>;
type RequiredMaskInference = Expect<Equal<typeof requiredMask, MaskApi>>;
type StringLookupInference = Expect<Equal<typeof byId, unknown | null>>;

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
void wrongRef;
void unsafeMask;
export type Assertions = OptionalMaskInference | RequiredMaskInference | StringLookupInference;
