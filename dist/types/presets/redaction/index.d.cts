/**
 * Composes the Redaction preset and publishes its options, DOM bindings, and installed APIs.
 *
 * @module
 */
import { ImageEditorCore, type FabricModule, type ImageEditorCoreOptions } from '../../core/index.js';
import { type OverlayFoundationApi } from '../../foundations/overlay/index.js';
import type { DomControlsPluginApi, DomPluginBinding } from '../../plugins/dom-controls/index.js';
import { type CropPluginApi, type CropPluginOptions } from '../../plugins/crop/index.js';
import { type FiltersPluginApi, type FiltersPluginOptions } from '../../plugins/filters/index.js';
import { type HistoryPluginOptions, type HistoryPort } from '../../plugins/history/index.js';
import { type MaskPluginApi, type MaskPluginOptions } from '../../plugins/mask/index.js';
import { type MosaicPluginApi, type MosaicPluginOptions } from '../../plugins/mosaic/index.js';
import { type OverlayStatePluginApi, type OverlayStatePluginOptions } from '../../plugins/overlay-state/index.js';
import { type TransformPluginApi, type TransformPluginOptions } from '../../plugins/transform/index.js';
import { type PresetDomApi, type PresetDomControlsFactory } from '../preset-support.js';
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
export interface RedactionPresetResult<TDomControls extends DomControlsPluginApi | null = DomControlsPluginApi | null> {
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
export declare function createRedactionPreset<const TOptions extends RedactionPresetOptions = Record<never, never>>(fabric: FabricModule, options?: TOptions & RedactionPresetOptions): RedactionPresetResult<PresetDomApi<TOptions>>;
export default createRedactionPreset;
