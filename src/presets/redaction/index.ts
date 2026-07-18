import {
    ImageEditorCore,
    type FabricModule,
    type ImageEditorCoreOptions,
} from '../../core/index.js';
import {
    overlayFoundationPlugin,
    overlayFoundationRef,
    type OverlayFoundationApi,
} from '../../foundations/overlay/index.js';
import type { DomControlsPluginApi, DomPluginBinding } from '../../plugins/dom-controls/index.js';
import {
    cropPlugin,
    cropPluginRef,
    type CropPluginApi,
    type CropPluginOptions,
} from '../../plugins/crop/index.js';
import {
    filtersPlugin,
    filtersPluginRef,
    type FiltersPluginApi,
    type FiltersPluginOptions,
} from '../../plugins/filters/index.js';
import {
    historyPlugin,
    historyPluginRef,
    type HistoryPluginOptions,
    type HistoryPort,
} from '../../plugins/history/index.js';
import {
    maskPlugin,
    maskPluginRef,
    type MaskPluginApi,
    type MaskPluginOptions,
} from '../../plugins/mask/index.js';
import {
    mosaicPlugin,
    mosaicPluginRef,
    type MosaicPluginApi,
    type MosaicPluginOptions,
} from '../../plugins/mosaic/index.js';
import {
    overlayStatePlugin,
    overlayStatePluginRef,
    type OverlayStatePluginApi,
    type OverlayStatePluginOptions,
} from '../../plugins/overlay-state/index.js';
import {
    transformPlugin,
    transformPluginRef,
    type TransformPluginApi,
    type TransformPluginOptions,
} from '../../plugins/transform/index.js';
import { composePlugins } from '../../sdk/index.js';
import {
    createDomBinding,
    createDomPlugin,
    type PresetDomApi,
    type PresetDomControlsFactory,
} from '../preset-support.js';

export interface RedactionPresetDomBindings {
    readonly transform: DomPluginBinding<TransformPluginApi>;
    readonly history: DomPluginBinding<HistoryPort>;
    readonly overlays: DomPluginBinding<OverlayFoundationApi>;
    readonly masks: DomPluginBinding<MaskPluginApi>;
    readonly filters: DomPluginBinding<FiltersPluginApi>;
    readonly crop: DomPluginBinding<CropPluginApi>;
    readonly mosaic: DomPluginBinding<MosaicPluginApi>;
    readonly overlayState: DomPluginBinding<OverlayStatePluginApi>;
}

export interface RedactionPresetOptions {
    readonly core?: ImageEditorCoreOptions;
    readonly transform?: TransformPluginOptions;
    readonly history?: HistoryPluginOptions;
    readonly masks?: MaskPluginOptions;
    readonly filters?: FiltersPluginOptions;
    readonly crop?: CropPluginOptions;
    readonly mosaic?: MosaicPluginOptions;
    readonly overlayState?: OverlayStatePluginOptions;
    readonly domControls?: PresetDomControlsFactory<RedactionPresetDomBindings>;
}

export interface RedactionPresetResult<
    TDomControls extends DomControlsPluginApi | null = DomControlsPluginApi | null,
> {
    readonly editor: ImageEditorCore;
    readonly transform: TransformPluginApi;
    readonly history: HistoryPort;
    readonly overlays: OverlayFoundationApi;
    readonly masks: MaskPluginApi;
    readonly filters: FiltersPluginApi;
    readonly crop: CropPluginApi;
    readonly mosaic: MosaicPluginApi;
    readonly overlayState: OverlayStatePluginApi;
    readonly domControls: TDomControls;
}

export function createRedactionPreset<
    const TOptions extends RedactionPresetOptions = Record<never, never>,
>(
    fabric: FabricModule,
    options: TOptions & RedactionPresetOptions = {} as TOptions & RedactionPresetOptions,
): RedactionPresetResult<PresetDomApi<TOptions>> {
    const editor = new ImageEditorCore(fabric, options.core);
    const definitions = {
        transform: transformPlugin(options.transform),
        history: historyPlugin(options.history),
        overlays: overlayFoundationPlugin(),
        masks: maskPlugin(options.masks),
        filters: filtersPlugin(options.filters),
        crop: cropPlugin(options.crop),
        mosaic: mosaicPlugin(options.mosaic),
        overlayState: overlayStatePlugin(options.overlayState),
    } as const;
    const bindings: RedactionPresetDomBindings = Object.freeze({
        transform: createDomBinding(editor, transformPluginRef),
        history: createDomBinding(editor, historyPluginRef),
        overlays: createDomBinding(editor, overlayFoundationRef),
        masks: createDomBinding(editor, maskPluginRef),
        filters: createDomBinding(editor, filtersPluginRef),
        crop: createDomBinding(editor, cropPluginRef),
        mosaic: createDomBinding(editor, mosaicPluginRef),
        overlayState: createDomBinding(editor, overlayStatePluginRef),
    });
    const domDefinition = createDomPlugin(options.domControls, bindings);
    if (domDefinition) {
        const apis = editor.install(composePlugins({ ...definitions, domControls: domDefinition }));
        return Object.freeze({ editor, ...apis }) as RedactionPresetResult<PresetDomApi<TOptions>>;
    }
    const apis = editor.install(composePlugins(definitions));
    return Object.freeze({ editor, ...apis, domControls: null }) as RedactionPresetResult<
        PresetDomApi<TOptions>
    >;
}

export default createRedactionPreset;
