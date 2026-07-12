import { ImageEditorCore, type FabricModule } from '../../src/core/index.js';
import {
    overlayFoundationPlugin,
    overlayFoundationRef,
    type OverlayFoundationApi,
} from '../../src/foundations/overlay/index.js';
import { maskPlugin, maskPluginRef, type MaskPluginApi } from '../../src/plugins/mask/index.js';
import {
    historyPlugin,
    historyPluginRef,
    type HistoryPort,
} from '../../src/plugins/history/index.js';
import {
    transformPlugin,
    transformPluginRef,
    type TransformPluginApi,
    type TransformPluginState,
} from '../../src/plugins/transform/index.js';

type Equal<TLeft, TRight> =
    (<TValue>() => TValue extends TLeft ? 1 : 2) extends <TValue>() => TValue extends TRight ? 1 : 2
        ? true
        : false;
type Expect<TValue extends true> = TValue;

declare const fabricModule: FabricModule;

const editor = new ImageEditorCore(fabricModule);
const overlay = editor.use(overlayFoundationPlugin());
const masks = editor.use(maskPlugin());
const history = editor.use(historyPlugin());
const installed = editor.use(transformPlugin({ animationDuration: 0 }));
const optional = editor.getPlugin(transformPluginRef);
const state = installed.getState();
const optionalOverlay = editor.getPlugin(overlayFoundationRef);
const optionalMasks = editor.getPlugin(maskPluginRef);
const optionalHistory = editor.getPlugin(historyPluginRef);

type InstalledApiInference = Expect<Equal<typeof installed, TransformPluginApi>>;
type OptionalApiInference = Expect<Equal<typeof optional, TransformPluginApi | null>>;
type StateInference = Expect<Equal<typeof state, TransformPluginState>>;
type OverlayApiInference = Expect<Equal<typeof overlay, OverlayFoundationApi>>;
type MaskApiInference = Expect<Equal<typeof masks, MaskPluginApi>>;
type OptionalOverlayInference = Expect<Equal<typeof optionalOverlay, OverlayFoundationApi | null>>;
type OptionalMaskInference = Expect<Equal<typeof optionalMasks, MaskPluginApi | null>>;
type HistoryApiInference = Expect<Equal<typeof history, HistoryPort>>;
type OptionalHistoryInference = Expect<Equal<typeof optionalHistory, HistoryPort | null>>;

installed.scale(1.25);
installed.rotate(30);

// @ts-expect-error Transform factors must be numeric.
installed.scale('1.25');
// @ts-expect-error Plugin APIs are retrieved with a typed PluginRef, not an arbitrary string.
editor.getPlugin(transformPluginRef.id);

void optional;
void overlay;
void masks;
void history;
void optionalOverlay;
void optionalMasks;
void optionalHistory;
void state;
export type Assertions =
    | InstalledApiInference
    | OptionalApiInference
    | StateInference
    | OverlayApiInference
    | MaskApiInference
    | OptionalOverlayInference
    | OptionalMaskInference
    | HistoryApiInference
    | OptionalHistoryInference;
